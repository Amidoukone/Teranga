import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DeliveryRequestForm from "./DeliveryRequestForm";
import {
  estimateMissionRequest,
  getTradeCategories,
  submitMissionRequest,
} from "../../services/missionRequests";
import { getMasterCountries } from "../../services/franchises";
import { getLocalUser, me, persistSession } from "../../services/auth";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options = {}) => {
      const labels = {
        "deliveryBooking.package.title": "Que souhaitez-vous livrer ?",
        "deliveryBooking.package.small.label": "Petit colis",
        "deliveryBooking.package.standard.label": "Colis standard",
        "deliveryBooking.package.standard.hint": "Jusqu'à 10 kg",
        "deliveryBooking.package.missionTitle": `Livraison — ${options.package || ""}`,
        "deliveryBooking.steps.next": "Continuer",
        "deliveryBooking.steps.routeTitle": "Trajet du colis",
        "deliveryBooking.pickupLabel": "Point de retrait",
        "deliveryBooking.pickupPlaceholder": "Adresse de retrait",
        "deliveryBooking.destinationLabel": "Destination",
        "deliveryBooking.destinationPlaceholder": "Adresse de livraison",
        "deliveryBooking.estimateCta": "Voir le prix de la livraison",
        "deliveryBooking.estimateTitle": "Prix estimé",
        "deliveryBooking.price": `${options.amount || ""} ${options.currency || ""}`,
        "deliveryBooking.identity.title": "Comment vous joindre ?",
        "deliveryBooking.identity.phone": "Téléphone",
        "deliveryBooking.book": "Confirmer la livraison",
        "deliveryBooking.success.message": "Livraison enregistrée",
        "deliveryBooking.success.title": "Livraison confirmée",
        "deliveryBooking.success.reference": `Référence #${options.id || ""}`,
        "deliveryBooking.success.track": "Suivre ma livraison",
      };
      return labels[key] || key;
    },
  }),
}));

jest.mock("../mission-creation/LocationAutocompleteInput", () =>
  function MockLocationInput({ value, onChange, placeholder }) {
    return (
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
);

jest.mock("../../services/missionRequests", () => ({
  estimateMissionRequest: jest.fn(),
  getTradeCategories: jest.fn(),
  reverseGeocodeMissionRequestLocation: jest.fn(),
  submitMissionRequest: jest.fn(),
}));
jest.mock("../../services/franchises", () => ({ getMasterCountries: jest.fn() }));
jest.mock("../../services/missions", () => ({ createMission: jest.fn() }));
jest.mock("../../services/auth", () => ({
  getLocalUser: jest.fn(),
  me: jest.fn(),
  persistSession: jest.fn(),
}));

describe("DeliveryRequestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    getLocalUser.mockReturnValue(null);
    me.mockResolvedValue({ user: null });
    getMasterCountries.mockResolvedValue([
      { id: 1, name: "Mali", contactPhone: "+223 20 00 00 00" },
    ]);
    getTradeCategories.mockResolvedValue([
      { id: 9, name: "Livraison", slug: "livraison" },
    ]);
    estimateMissionRequest.mockResolvedValue({
      estimate: { basePrice: 3000, currency: "XOF", distanceKm: 4.2 },
      pickup: { address: "Sogoniko", latitude: 12.62, longitude: -7.98 },
      destination: { address: "Hamdallaye", latitude: 12.59, longitude: -8.03 },
    });
    submitMissionRequest.mockResolvedValue({
      service: { id: 85, missionStatus: "CREATED" },
      estimate: { basePrice: 3000, currency: "XOF" },
      user: { id: 3, role: "client" },
      token: "token",
    });
    persistSession.mockResolvedValue(undefined);
  });

  test("calcule le prix selon le type de colis puis crée la livraison", async () => {
    render(<DeliveryRequestForm />);

    await screen.findByText("Que souhaitez-vous livrer ?");
    await userEvent.click(screen.getByRole("button", { name: /Colis standard/ }));
    await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
    await userEvent.type(screen.getByPlaceholderText("Adresse de retrait"), "Sogoniko");
    await userEvent.type(screen.getByPlaceholderText("Adresse de livraison"), "Hamdallaye");
    await userEvent.click(
      screen.getByRole("button", { name: "Voir le prix de la livraison" })
    );

    expect(await screen.findByText("Prix estimé")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Téléphone" }), "+22370000085");
    await userEvent.click(screen.getByRole("button", { name: "Confirmer la livraison" }));

    await waitFor(() => expect(submitMissionRequest).toHaveBeenCalledTimes(1));
    expect(estimateMissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ packageType: "standard", tradeCategoryId: 9 })
    );
    expect(submitMissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        packageType: "standard",
        tradeCategoryId: 9,
        pickupAddress: "Sogoniko",
        address: "Hamdallaye",
      })
    );
    expect(await screen.findByRole("link", { name: "Suivre ma livraison" })).toHaveAttribute(
      "href",
      "/livraisons/85"
    );
  });
});
