import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminProviderMobilityPage from "./AdminProviderMobilityPage";
import { getProvider, listProviderVehicles } from "../services/providers";

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

test("replaces every mobility URL field with a gallery or file picker", async () => {
  getProvider.mockResolvedValue({
    provider: { id: 42, displayFirstName: "Awa" },
    compliance: { driverEligible: false, driverIssues: [], vehicles: [] },
  });
  listProviderVehicles.mockResolvedValue([]);

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
