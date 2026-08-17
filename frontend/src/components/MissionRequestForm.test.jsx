import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MissionRequestForm from "./MissionRequestForm";
import { submitMissionRequest, getTradeCategories } from "../services/missionRequests";
import { getMasterCountries } from "../services/franchises";
import { persistSession } from "../services/auth";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const map = {
        "homePage.missionRequest.chooseNeed": "Choisissez votre besoin",
        "homePage.missionRequest.fields.title": "Votre besoin en une phrase",
        "homePage.missionRequest.fields.titlePlaceholder": "Ex : Fuite d'eau",
        "homePage.missionRequest.fields.address": "Où doit avoir lieu la mission ?",
        "homePage.missionRequest.fields.addressPlaceholder": "Quartier, ville",
        "homePage.missionRequest.fields.addressHint": "Peut être ailleurs",
        "homePage.missionRequest.fields.description": "Détails",
        "homePage.missionRequest.fields.descriptionPlaceholder": "Décrivez",
        "homePage.missionRequest.identity.title": "Vos coordonnées",
        "homePage.missionRequest.identity.hint": "Pour le suivi",
        "homePage.missionRequest.identity.countryHint": "Pour votre compte",
        "homePage.missionRequest.fields.phone": "Téléphone",
        "homePage.missionRequest.fields.phonePlaceholder": "+223...",
        "homePage.missionRequest.fields.pin": "Code",
        "homePage.missionRequest.fields.pinPlaceholder": "Code",
        "homePage.missionRequest.fields.pinHint": "Notez-le",
        "homePage.missionRequest.fields.firstName": "Prénom",
        "homePage.missionRequest.fields.firstNamePlaceholder": "Prénom",
        "homePage.missionRequest.fields.country": "Pays",
        "homePage.missionRequest.fields.countryPlaceholder": "Choisir",
        "homePage.missionRequest.submit": "Envoyer ma demande",
        "homePage.missionRequest.submitting": "Envoi en cours…",
        "homePage.missionRequest.loadingOptions": "Chargement…",
        "homePage.missionRequest.successNewAccount": "Compte créé",
        "homePage.missionRequest.successExisting": "Compte existant",
        "homePage.missionRequest.successTitle": "Demande reçue",
        "homePage.missionRequest.successReference": `Référence #${opts?.id}`,
        "homePage.missionRequest.trackCta": "Suivre",
        "homePage.missionRequest.newRequestCta": "Nouvelle demande",
        "missionCreation.location.departureTitle": "Point de départ",
        "missionCreation.location.destinationTitle": "Destination",
        "missionCreation.location.pickupTitle": "Point de retrait",
        "missionCreation.location.dropoffTitle": "Point de dépose",
        "missionCreation.location.pickupAddressPlaceholder": "Adresse de départ",
        "services.type.errand": "Course",
        "services.type.administrative": "Démarche",
        "services.type.payment": "Paiement",
        "services.type.money_transfer": "Transfert",
        "services.type.other": "Autre",
      };
      return map[key] || key;
    },
  }),
}));

jest.mock("../services/missionRequests", () => ({
  submitMissionRequest: jest.fn(),
  getTradeCategories: jest.fn(),
}));

jest.mock("../services/franchises", () => ({
  getMasterCountries: jest.fn(),
}));

jest.mock("../services/auth", () => ({
  persistSession: jest.fn(),
}));

describe("MissionRequestForm (révélation progressive)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTradeCategories.mockResolvedValue([]);
    getMasterCountries.mockResolvedValue([{ id: 5, name: "Ghana" }]);
  });

  test("ne montre les coordonnées qu'après avoir choisi une catégorie et saisi un titre", async () => {
    render(<MissionRequestForm />);

    const courseButton = await screen.findByRole("button", { name: "Course" });

    expect(screen.queryByText("Votre besoin en une phrase")).not.toBeInTheDocument();
    expect(screen.queryByText("Vos coordonnées")).not.toBeInTheDocument();

    await userEvent.click(courseButton);

    expect(await screen.findByText("Votre besoin en une phrase")).toBeInTheDocument();
    expect(screen.queryByText("Vos coordonnées")).not.toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("Ex : Fuite d'eau");
    await userEvent.type(titleInput, "Course urgente");

    expect(await screen.findByText("Vos coordonnées")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer ma demande" })).toBeInTheDocument();
  });

  test("soumet la demande avec le payload attendu", async () => {
    submitMissionRequest.mockResolvedValue({
      isNewAccount: true,
      service: { id: 42 },
      user: { id: 1 },
    });
    persistSession.mockResolvedValue(undefined);

    render(<MissionRequestForm />);
    await waitFor(() => expect(getMasterCountries).toHaveBeenCalled());

    await userEvent.click(screen.getByRole("button", { name: "Course" }));
    await userEvent.type(screen.getByPlaceholderText("Ex : Fuite d'eau"), "Course urgente");

    await screen.findByText("Vos coordonnées");
    await userEvent.type(screen.getByPlaceholderText("+223..."), "+233555000111");
    await userEvent.type(screen.getAllByPlaceholderText("Code")[0], "1234");

    await userEvent.click(screen.getByRole("button", { name: "Envoyer ma demande" }));

    await waitFor(() => expect(submitMissionRequest).toHaveBeenCalledTimes(1));
    expect(submitMissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+233555000111",
        pin: "1234",
        title: "Course urgente",
        requestKind: "classic",
        serviceType: "errand",
        countryId: 5,
      })
    );
    expect(await screen.findByText("Demande reçue")).toBeInTheDocument();
  });

  test("préselectionne Taxi et soumet départ et destination sans compte préalable", async () => {
    getTradeCategories.mockResolvedValue([{ id: 8, name: "Mobilité", slug: "mobilite" }]);
    submitMissionRequest.mockResolvedValue({
      isNewAccount: true,
      service: { id: 84, missionStatus: "CREATED" },
      user: { id: 2 },
    });
    persistSession.mockResolvedValue(undefined);

    render(
      <MissionRequestForm
        initialTradeCategorySlug="mobilite"
        initialTitle="Course Teranga Taxi"
      />
    );

    expect(await screen.findByText("Point de départ")).toBeInTheDocument();
    expect(screen.getByText("Destination")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("Adresse de départ"), "Sébénikoro, Bamako");
    await userEvent.type(screen.getByPlaceholderText("Quartier, ville"), "ACI 2000, Bamako");
    await userEvent.type(screen.getByPlaceholderText("+223..."), "+22370000084");
    await userEvent.type(screen.getAllByPlaceholderText("Code")[0], "1234");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer ma demande" }));

    await waitFor(() => expect(submitMissionRequest).toHaveBeenCalledTimes(1));
    expect(submitMissionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestKind: "trade_category",
        tradeCategoryId: 8,
        title: "Course Teranga Taxi",
        pickupAddress: "Sébénikoro, Bamako",
        address: "ACI 2000, Bamako",
      })
    );
    expect(await screen.findByText("Demande reçue")).toBeInTheDocument();
  });
});
