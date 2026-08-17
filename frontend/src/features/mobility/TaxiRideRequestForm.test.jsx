import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TaxiRideRequestForm from "./TaxiRideRequestForm";
import {
  estimateMissionRequest,
  getTradeCategories,
  submitMissionRequest,
} from "../../services/missionRequests";
import { getMasterCountries } from "../../services/franchises";
import { createMission } from "../../services/missions";
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
    t: (key, options) => {
      const labels = {
        "mobilityBooking.vehicle.title": "Quel véhicule souhaitez-vous ?",
        "mobilityBooking.vehicle.motorcycle.label": "Moto",
        "mobilityBooking.vehicle.motorcycle.hint": "Rapide",
        "mobilityBooking.vehicle.motorcycle.missionTitle": "Course Teranga en moto",
        "mobilityBooking.vehicle.car.label": "Voiture",
        "mobilityBooking.vehicle.car.hint": "Confort",
        "mobilityBooking.vehicle.car.missionTitle": "Course Teranga en voiture",
        "mobilityBooking.pickupLabel": "Point de départ",
        "mobilityBooking.pickupPlaceholder": "Adresse de départ",
        "mobilityBooking.destinationLabel": "Destination",
        "mobilityBooking.destinationPlaceholder": "Adresse d'arrivée",
        "mobilityBooking.useCurrentLocation": "Utiliser ma position actuelle",
        "mobilityBooking.estimateCta": "Voir le trajet et le prix",
        "mobilityBooking.estimateTitle": "Estimation",
        "mobilityBooking.price": `${options?.amount || ""} ${options?.currency || ""}`,
        "mobilityBooking.book.motorcycle": "Commander cette moto",
        "mobilityBooking.book.car": "Commander cette voiture",
        "mobilityBooking.identity.title": "Comment vous joindre ?",
        "mobilityBooking.identity.hint": "À la fin seulement",
        "mobilityBooking.identity.phone": "Téléphone",
        "mobilityBooking.identity.pin": "PIN Teranga",
        "mobilityBooking.identity.firstName": "Prénom",
        "mobilityBooking.identity.firstNamePlaceholder": "Votre prénom",
        "mobilityBooking.connectedAs": `Compte ${options?.name || ""}`,
        "mobilityBooking.success.message": "Course enregistrée",
        "mobilityBooking.success.title": "Course confirmée",
        "mobilityBooking.success.reference": `Référence #${options?.id}`,
        "mobilityBooking.success.track": "Suivre ma course",
        "mobilityBooking.success.newRide": "Nouvelle course",
      };
      return labels[key] || key;
    },
  }),
}));

jest.mock("../mission-creation/LocationAutocompleteInput", () =>
  function MockLocationInput({ value, onChange, placeholder, onFocus }) {
    return (
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
    );
  }
);
jest.mock("./TaxiRouteMap", () => () => <div data-testid="taxi-map" />);
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

const quote = {
  estimate: { basePrice: 2500, currency: "XOF", distanceKm: 5.2, durationMinutes: 18 },
  pickup: { address: "Sébénikoro", latitude: 12.63, longitude: -8.08 },
  destination: { address: "ACI 2000", latitude: 12.62, longitude: -8.01 },
};

describe("TaxiRideRequestForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getLocalUser.mockReturnValue(null);
    me.mockResolvedValue({ user: null });
    getTradeCategories.mockResolvedValue([{ id: 8, name: "Mobilité", slug: "mobilite" }]);
    getMasterCountries.mockResolvedValue([{ id: 1, name: "Mali", contactPhone: "+22320000000" }]);
    estimateMissionRequest.mockResolvedValue(quote);
    persistSession.mockResolvedValue(undefined);
  });

  async function enterRouteAndEstimate() {
    await screen.findByText("Quel véhicule souhaitez-vous ?");
    await userEvent.type(screen.getByPlaceholderText("Adresse de départ"), "Sébénikoro");
    await userEvent.type(screen.getByPlaceholderText("Adresse d'arrivée"), "ACI 2000");
    await userEvent.click(screen.getByRole("button", { name: "Voir le trajet et le prix" }));
    await screen.findByText("Estimation");
  }

  test("un client connecté ne voit aucun formulaire d'inscription", async () => {
    const client = { id: 12, role: "client", firstName: "Awa", countryId: 1 };
    getLocalUser.mockReturnValue(client);
    me.mockResolvedValue({ user: client });
    createMission.mockResolvedValue({ mission: { id: 91 }, estimate: quote.estimate });

    render(<TaxiRideRequestForm />);
    await enterRouteAndEstimate();

    expect(screen.queryByText("Comment vous joindre ?")).not.toBeInTheDocument();
    expect(screen.getByText("Compte Awa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Commander cette moto" }));

    await waitFor(() => expect(createMission).toHaveBeenCalledTimes(1));
    await screen.findByText(/Course confirm/);
    expect(createMission).toHaveBeenCalledWith(
      expect.objectContaining({
        executionType: "provider",
        tradeCategoryId: 8,
        requestedVehicleType: "motorcycle",
      })
    );
    expect(submitMissionRequest).not.toHaveBeenCalled();
  });

  test("un visiteur choisit une voiture puis s'identifie seulement après le devis", async () => {
    submitMissionRequest.mockResolvedValue({
      service: { id: 92, missionStatus: "CREATED" },
      estimate: quote.estimate,
      token: "token",
      user: { id: 15, role: "client" },
    });

    render(<TaxiRideRequestForm />);
    await screen.findByText("Quel véhicule souhaitez-vous ?");
    await userEvent.click(screen.getByRole("button", { name: /Voiture/ }));
    expect(screen.queryByText("Comment vous joindre ?")).not.toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Adresse de départ"), "Sébénikoro");
    await userEvent.type(screen.getByPlaceholderText("Adresse d'arrivée"), "ACI 2000");
    await userEvent.click(screen.getByRole("button", { name: "Voir le trajet et le prix" }));

    expect(await screen.findByText("Comment vous joindre ?")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Téléphone" }), "+22370000000");
    await userEvent.type(screen.getByLabelText(/PIN Teranga/), "1234");
    await userEvent.click(screen.getByRole("button", { name: "Commander cette voiture" }));

    await waitFor(() => expect(submitMissionRequest).toHaveBeenCalledTimes(1));
    await screen.findByText(/Course confirm/);
    expect(submitMissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ requestedVehicleType: "car", requestKind: "trade_category" })
    );
    expect(persistSession).toHaveBeenCalledTimes(1);
  });
});
