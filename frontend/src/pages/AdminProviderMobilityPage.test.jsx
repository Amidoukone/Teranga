import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminProviderMobilityPage from "./AdminProviderMobilityPage";
import {
  getProvider,
  listProviderVehicles,
  updateProviderDriverCompliance,
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
  const t = (key) => key;
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

  const photo = new File(["photo"], "chauffeur-awa.jpg", { type: "image/jpeg" });
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
  expect(await screen.findByText("chauffeur-awa.jpg")).toBeInTheDocument();

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
