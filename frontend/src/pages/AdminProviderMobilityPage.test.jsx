import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminProviderMobilityPage from "./AdminProviderMobilityPage";
import {
  createProviderVehicle,
  getProvider,
  listProviderVehicles,
  updateProviderDriverCompliance,
  updateProviderMobilityAvailability,
  uploadProviderMobilityMedia,
} from "../services/providers";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useParams: () => ({ id: "42" }),
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => {
  const t = (key, options = {}) =>
    key === "adminProviderMobility.vehicle.optionalField"
      ? `${options.label} optional`
      : key;
  return { useTranslation: () => ({ t }) };
});

jest.mock("../services/api", () => ({
  getFileUrl: (value) => value,
}));

jest.mock("../services/providers", () => ({
  createProviderVehicle: jest.fn(),
  getProvider: jest.fn(),
  listProviderVehicles: jest.fn(),
  updateProviderDriverCompliance: jest.fn(),
  updateProviderMobilityAvailability: jest.fn(),
  updateProviderVehicle: jest.fn(),
  uploadProviderMobilityMedia: jest.fn(),
}));

jest.mock("../utils/notify", () => ({
  notify: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getProvider.mockResolvedValue({
    provider: { id: 42, displayFirstName: "Awa" },
    compliance: { driverEligible: false, driverIssues: [], vehicles: [] },
  });
  listProviderVehicles.mockResolvedValue([]);
});

test("replaces every mobility URL field with a gallery or file picker", async () => {
  render(<AdminProviderMobilityPage />);
  await screen.findByText("adminProviderMobility.driver.title");
  await waitFor(() => expect(getProvider).toHaveBeenCalledWith("42"));

  const driverFileInputs = screen.getAllByLabelText("adminProviderMobility.media.choose");
  expect(driverFileInputs).toHaveLength(3);
  driverFileInputs.forEach((input) => {
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", expect.stringContaining("image/heic"));
  });

  await userEvent.click(
    screen.getByRole("button", { name: /adminProviderMobility.guide.vehicle/ })
  );
  const vehicleFileInputs = screen.getAllByLabelText("adminProviderMobility.media.choose");
  expect(vehicleFileInputs).toHaveLength(4);
  vehicleFileInputs.forEach((input) => {
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", expect.stringContaining("image/heic"));
  });
});

test("envoie une photo choisie dans la galerie puis enregistre sa référence automatiquement", async () => {
  uploadProviderMobilityMedia.mockResolvedValue({
    kind: "profilePhoto",
    url: "/uploads/mobility/chauffeur-awa.jpg",
  });
  updateProviderDriverCompliance.mockResolvedValue({
    provider: {
      id: 42,
      displayFirstName: "Awa",
      profilePhotoUrl: "/uploads/mobility/chauffeur-awa.jpg",
    },
    compliance: { driverEligible: false, driverIssues: [], vehicles: [] },
  });

  render(<AdminProviderMobilityPage />);
  await screen.findByText("adminProviderMobility.driver.title");

  const longFileName = `${"photo-chauffeur-teranga-".repeat(8)}awa.jpg`;
  const photo = new File(["photo"], longFileName, { type: "image/jpeg" });
  await userEvent.upload(
    screen.getAllByLabelText("adminProviderMobility.media.choose")[0],
    photo
  );

  await waitFor(() =>
    expect(uploadProviderMobilityMedia).toHaveBeenCalledWith(
      "42",
      "profilePhoto",
      photo,
      expect.any(Function)
    )
  );
  const displayedFileName = await screen.findByText(longFileName);
  expect(displayedFileName).toHaveClass("truncate", "max-w-full");
  expect(displayedFileName).toHaveAttribute("title", longFileName);

  await userEvent.click(
    screen.getByRole("button", { name: "adminProviderMobility.driver.save" })
  );
  await waitFor(() =>
    expect(updateProviderDriverCompliance).toHaveBeenCalledWith(
      "42",
      expect.objectContaining({
        profilePhotoUrl: "/uploads/mobility/chauffeur-awa.jpg",
      })
    )
  );
});

test("enregistre une moto minimale sans bloquer sur les champs facultatifs", async () => {
  createProviderVehicle.mockResolvedValue({ id: 88, vehicleType: "motorcycle" });

  render(<AdminProviderMobilityPage />);
  await screen.findByText("adminProviderMobility.driver.title");
  await userEvent.click(
    screen.getByRole("button", { name: /adminProviderMobility.guide.vehicle/ })
  );

  expect(
    screen.getByRole("heading", {
      name: "adminProviderMobility.vehicle.createMotorcycleTitle",
    })
  ).toBeInTheDocument();
  expect(
    screen.queryByText("adminProviderMobility.vehicle.airConditioning")
  ).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("button", { name: "adminProviderMobility.vehicle.save" })
  );

  await waitFor(() =>
    expect(createProviderVehicle).toHaveBeenCalledWith(
      "42",
      expect.objectContaining({
        vehicleType: "motorcycle",
        brand: null,
        model: null,
        color: null,
        plateNumber: null,
        capacity: 1,
        status: "pending",
      })
    )
  );
});

test("affiche un vehicule minimal comme enregistre et non comme incomplet", async () => {
  getProvider.mockResolvedValue({
    provider: { id: 42, displayFirstName: "Awa" },
    compliance: {
      driverEligible: false,
      driverIssues: [],
      hasEligibleVehicle: false,
      vehicles: [
        {
          id: 88,
          vehicleType: "motorcycle",
          status: "pending",
          eligible: false,
          issues: ["identification du vehicule incomplete"],
        },
      ],
    },
  });
  listProviderVehicles.mockResolvedValue([
    {
      id: 88,
      vehicleType: "motorcycle",
      status: "pending",
      brand: null,
      model: null,
      color: null,
      plateNumber: null,
    },
  ]);

  render(<AdminProviderMobilityPage />);
  await screen.findByText("adminProviderMobility.driver.title");
  await userEvent.click(
    screen.getByRole("button", { name: /adminProviderMobility.guide.vehicle/ })
  );

  const vehicleCard = screen.getByRole("article");
  expect(
    within(vehicleCard).getByText("adminProviderMobility.vehicle.states.registered")
  ).toBeInTheDocument();
  expect(
    within(vehicleCard).getByText("adminProviderMobility.vehicle.optionalDetailsMissing")
  ).toBeInTheDocument();
  expect(
    within(vehicleCard).queryByText("adminProviderMobility.summary.incomplete")
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("adminProviderMobility.summary.awaitingActivation")
  ).toBeInTheDocument();
});

test("affiche des champs adaptés lorsque l admin choisit une voiture", async () => {
  render(<AdminProviderMobilityPage />);
  await screen.findByText("adminProviderMobility.driver.title");
  await userEvent.click(
    screen.getByRole("button", { name: /adminProviderMobility.guide.vehicle/ })
  );

  await userEvent.click(
    screen.getByRole("button", {
      name: /adminProviderMobility.vehicle.car adminProviderMobility.vehicle.carHint/,
    })
  );

  expect(
    screen.getByRole("heading", {
      name: "adminProviderMobility.vehicle.createCarTitle",
    })
  ).toBeInTheDocument();
  expect(
    screen.getByText("adminProviderMobility.vehicle.airConditioning")
  ).toBeInTheDocument();
  expect(
    screen.queryByText("adminProviderMobility.vehicle.helmet")
  ).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("adminProviderMobility.vehicle.carCapacity optional")
  ).toHaveAttribute("max", "12");
});

test("permet a l admin d autoriser un chauffeur conforme sans GPS", async () => {
  getProvider.mockResolvedValue({
    provider: {
      id: 42,
      displayFirstName: "Awa",
      status: "active",
      availabilityStatus: "offline",
    },
    compliance: {
      driverEligible: true,
      driverIssues: [],
      hasEligibleVehicle: false,
      vehicles: [
        {
          id: 88,
          vehicleType: "motorcycle",
          status: "pending",
          eligible: false,
          canBeActivated: true,
          activationIssues: [],
        },
      ],
    },
  });
  listProviderVehicles.mockResolvedValue([
    {
      id: 88,
      vehicleType: "motorcycle",
      status: "pending",
      hasPassengerHelmet: true,
    },
  ]);
  updateProviderMobilityAvailability.mockResolvedValue({
    provider: { id: 42, availabilityStatus: "available" },
  });

  render(<AdminProviderMobilityPage />);

  await userEvent.click(
    await screen.findByRole("button", {
      name: "adminProviderMobility.operations.enable",
    })
  );

  await waitFor(() =>
    expect(updateProviderMobilityAvailability).toHaveBeenCalledWith(
      "42",
      "available",
      "88"
    )
  );
});
