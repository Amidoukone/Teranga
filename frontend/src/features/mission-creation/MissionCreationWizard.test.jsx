import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MissionCreationWizard from "./MissionCreationWizard";
import { getTradeCategories } from "../../services/missionRequests";
import { getLocalServiceCatalog } from "../../services/serviceCatalog";
import { getMasterCountries } from "../../services/franchises";
import { getRegions } from "../../services/regions";
import { listSavedLocations } from "../../services/savedLocations";
import { me } from "../../services/auth";
import { estimateMission, createMission } from "../../services/missions";

jest.mock("react-router-dom", () => ({ Link: ({ children, to }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock("react-i18next", () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});
jest.mock("../../services/missionRequests", () => ({ getTradeCategories: jest.fn() }));
jest.mock("../../services/serviceCatalog", () => ({
  getLocalServiceCatalog: jest.fn(),
  filterLocalServiceChoices: (categories, response) => ({
    tradeCategories: categories.filter((item) => response.catalog.some((offer) =>
      Number(offer.definition.legacyTradeCategoryId) === Number(item.id))),
    classicTypes: [],
  }),
}));
jest.mock("../../services/franchises", () => ({ getMasterCountries: jest.fn() }));
jest.mock("../../services/regions", () => ({ getRegions: jest.fn() }));
jest.mock("../../services/savedLocations", () => ({ listSavedLocations: jest.fn(), createSavedLocation: jest.fn() }));
jest.mock("../../services/auth", () => ({ me: jest.fn() }));
jest.mock("../../services/missions", () => ({
  estimateMission: jest.fn(), createMission: jest.fn(), uploadMissionAttachments: jest.fn(),
}));
jest.mock("./steps/LocationStep", () => ({
  address, pickupAddress, onSelectSavedLocation, onMapPositionChange,
  onPickupPlaceSelected, onPickupMapPositionChange,
}) => (
  <div>
    <span data-testid="destination-address">{address}</span>
    <span data-testid="pickup-address">{pickupAddress}</span>
    <button type="button" onClick={() => onSelectSavedLocation({
      id: 4, address: "Ancien lieu Mali", latitude: 12.63, longitude: -8.00,
    })}>Choisir un lieu enregistré</button>
    <button type="button" onClick={() => onMapPositionChange({ latitude: 5.36, longitude: -4.00 })}>
      Déplacer la destination
    </button>
    <button type="button" onClick={() => onPickupPlaceSelected({
      address: "Ancien départ", latitude: 12.63, longitude: -8.00,
    })}>Choisir un départ</button>
    <button type="button" onClick={() => onPickupMapPositionChange({ latitude: 5.35, longitude: -4.01 })}>
      Déplacer le départ
    </button>
  </div>
));
jest.mock("./steps/DescriptionStep", () => ({ title, onTitleChange }) => (
  <input aria-label="Titre de la mission" value={title} onChange={(event) => onTitleChange(event.target.value)} />
));
jest.mock("./steps/ConfirmStep", () => ({ summary }) => (
  <div>{summary.countryName} · {summary.regionName}</div>
));

beforeEach(() => jest.clearAllMocks());

test("un client du Mali choisit la Côte d’Ivoire et envoie le pays et la région au devis et à la création", async () => {
  getMasterCountries.mockResolvedValue([
    { id: 1, name: "Mali" },
    { id: 2, name: "Côte d’Ivoire" },
  ]);
  getRegions.mockImplementation(async ({ countryId }) => String(countryId) === "2"
    ? [{ id: 20, name: "Abidjan" }]
    : [{ id: 10, name: "Bamako" }]);
  me.mockResolvedValue({ user: { id: 5, countryId: 1, regionId: 10 } });
  listSavedLocations.mockResolvedValue([]);
  getTradeCategories.mockImplementation(async ({ countryId }) => String(countryId) === "2"
    ? [
      { id: 11, name: "Plomberie CI", slug: "plomberie", countryId: 2 },
      { id: 12, name: "Service Abidjan", slug: "menage", countryId: 2, regionId: 20 },
    ]
    : [{ id: 10, name: "Plomberie ML", slug: "plomberie", countryId: 1 }]);
  getLocalServiceCatalog.mockImplementation(async ({ countryId, regionId }) => ({
    configured: true,
    catalog: [
      { definition: { legacyTradeCategoryId: String(countryId) === "2" ? 11 : 10 } },
      ...(String(countryId) === "2" && String(regionId) === "20"
        ? [{ definition: { legacyTradeCategoryId: 12 } }]
        : []),
    ],
  }));
  estimateMission.mockResolvedValue({ basePrice: 5000, currency: "XOF" });
  createMission.mockResolvedValue({ mission: { id: 99 } });

  render(<MissionCreationWizard />);
  await screen.findByRole("combobox", { name: "missionCreation.category.countryLabel" });
  await userEvent.click(await screen.findByRole("button", { name: "Plomberie ML" }));
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  await userEvent.click(screen.getByRole("button", { name: "Choisir un lieu enregistré" }));
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.back" }));
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "missionCreation.category.countryLabel" }), "2"
  );
  expect(screen.queryByRole("button", { name: "Plomberie ML" })).not.toBeInTheDocument();
  await screen.findByRole("button", { name: "Plomberie CI" });
  expect(screen.queryByRole("button", { name: "Service Abidjan" })).not.toBeInTheDocument();
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "missionCreation.category.regionLabel" }),
    "20"
  );
  await userEvent.click(await screen.findByRole("button", { name: "Service Abidjan" }));
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  expect(screen.getByTestId("destination-address")).toBeEmptyDOMElement();
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Titre de la mission" }), "Réparer la fuite");
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));

  await waitFor(() => expect(estimateMission).toHaveBeenCalledWith(expect.objectContaining({
    countryId: 2, regionId: 20, tradeCategoryId: 12,
  })));
  expect(await screen.findByText("Côte d’Ivoire · Abidjan")).toBeInTheDocument();
  await userEvent.click(await screen.findByRole("button", { name: "missionCreation.wizard.confirm" }));
  await waitFor(() => expect(createMission).toHaveBeenCalledWith(expect.objectContaining({
    countryId: 2, regionId: 20, tradeCategoryId: 12,
  })));
  expect(createMission.mock.calls[0][0]).not.toHaveProperty("savedLocationId");
});

test("déplacer les repères efface les adresses périmées et le lieu enregistré", async () => {
  getMasterCountries.mockResolvedValue([{ id: 2, name: "Côte d’Ivoire" }]);
  getRegions.mockResolvedValue([]);
  me.mockResolvedValue({ user: { id: 5, countryId: 2 } });
  listSavedLocations.mockResolvedValue([]);
  getTradeCategories.mockResolvedValue([{ id: 11, name: "Livraison", slug: "livraison", countryId: 2 }]);
  getLocalServiceCatalog.mockResolvedValue({
    configured: true, catalog: [{ definition: { legacyTradeCategoryId: 11 } }],
  });
  estimateMission.mockResolvedValue({ basePrice: 5000, currency: "XOF" });
  createMission.mockResolvedValue({ mission: { id: 100 } });

  render(<MissionCreationWizard />);
  await userEvent.click(await screen.findByRole("button", { name: "Livraison" }));
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  await userEvent.click(screen.getByRole("button", { name: "Choisir un lieu enregistré" }));
  await userEvent.click(screen.getByRole("button", { name: "Choisir un départ" }));
  expect(screen.getByTestId("destination-address")).toHaveTextContent("Ancien lieu Mali");
  expect(screen.getByTestId("pickup-address")).toHaveTextContent("Ancien départ");
  await userEvent.click(screen.getByRole("button", { name: "Déplacer la destination" }));
  await userEvent.click(screen.getByRole("button", { name: "Déplacer le départ" }));
  expect(screen.getByTestId("destination-address")).toBeEmptyDOMElement();
  expect(screen.getByTestId("pickup-address")).toBeEmptyDOMElement();

  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Titre de la mission" }), "Livrer un colis");
  await userEvent.click(screen.getByRole("button", { name: "missionCreation.wizard.next" }));
  await waitFor(() => expect(estimateMission).toHaveBeenCalledWith(expect.objectContaining({
    countryId: 2, latitude: 5.36, longitude: -4.00,
    pickupLatitude: 5.35, pickupLongitude: -4.01,
  })));
  expect(estimateMission.mock.calls[0][0].address).toBeUndefined();
  await userEvent.click(await screen.findByRole("button", { name: "missionCreation.wizard.confirm" }));
  await waitFor(() => expect(createMission).toHaveBeenCalledTimes(1));
  const payload = createMission.mock.calls[0][0];
  expect(payload).toEqual(expect.objectContaining({
    countryId: 2, latitude: 5.36, longitude: -4.00,
    pickupLatitude: 5.35, pickupLongitude: -4.01,
  }));
  expect(payload).not.toHaveProperty("savedLocationId");
  expect(payload).not.toHaveProperty("address");
  expect(payload).not.toHaveProperty("pickupAddress");
});
