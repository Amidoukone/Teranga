import { render, screen, waitFor } from "@testing-library/react";

import DeliveryOrdersPage from "./DeliveryOrdersPage";
import { getMyDeliveries } from "../services/missions";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }),
  { virtual: true }
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

describe("DeliveryOrdersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("présente les livraisons actives hors de la page Services", async () => {
    getMyDeliveries.mockResolvedValue({
      deliveries: [
        {
          id: 52,
          missionStatus: "IN_PROGRESS",
          pickupAddress: "Sogoniko",
          address: "Hamdallaye ACI",
          createdAt: "2026-08-22T08:00:00.000Z",
        },
      ],
    });

    render(<DeliveryOrdersPage />);

    expect(await screen.findByText("Sogoniko")).toBeInTheDocument();
    expect(screen.getByText("Hamdallaye ACI")).toBeInTheDocument();
    expect(screen.getByText("deliveryOrders.status.IN_PROGRESS")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /deliveryOrders.follow/ })).toHaveAttribute(
      "href",
      "/livraisons/52"
    );
    await waitFor(() => expect(getMyDeliveries).toHaveBeenCalledWith({ limit: 100 }));
  });
});
