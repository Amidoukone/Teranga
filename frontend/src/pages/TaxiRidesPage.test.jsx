import { render, screen, waitFor } from "@testing-library/react";

import TaxiRidesPage from "./TaxiRidesPage";
import { getMyTaxiRides } from "../services/missions";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true },
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: "fr" },
  }),
}));

jest.mock("../services/missions", () => ({
  getMyDeliveries: jest.fn(),
  getMyTaxiRides: jest.fn(),
}));

describe("TaxiRidesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("présente les courses actives hors de la page Services", async () => {
    getMyTaxiRides.mockResolvedValue({
      rides: [
        {
          id: 44,
          missionStatus: "EN_ROUTE",
          requestedVehicleType: "car",
          pickupAddress: "ACI 2000",
          address: "Aéroport de Bamako",
          createdAt: "2026-08-22T08:00:00.000Z",
        },
      ],
    });

    render(<TaxiRidesPage />);

    expect(await screen.findByText("ACI 2000")).toBeInTheDocument();
    expect(screen.getByText("Aéroport de Bamako")).toBeInTheDocument();
    expect(
      screen.getByText("taxiRides.status.EN_ROUTE"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /taxiRides.follow/ }),
    ).toHaveAttribute("href", "/courses/44");
    await waitFor(() =>
      expect(getMyTaxiRides).toHaveBeenCalledWith({ limit: 100 }),
    );
  });
});
