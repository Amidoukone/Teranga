import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminPhoneOrderPage from "./AdminPhoneOrderPage";
import { getTradeCategories } from "../services/missionRequests";
import { createPhoneOrder } from "../services/missions";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useLocation: () => ({ pathname: "/admin/phone-orders" }),
    useSearchParams: () => [new URLSearchParams("category=livraison"), jest.fn()],
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock("../contexts/GeoContext", () => ({
  useGeo: () => ({
    countryId: 1,
    countries: [],
    canSelect: false,
    setCountry: jest.fn(),
    loading: false,
  }),
}));

jest.mock("../services/missionRequests", () => ({
  getTradeCategories: jest.fn(),
}));

jest.mock("../services/missions", () => ({
  createPhoneOrder: jest.fn(),
  getTaxiDispatchQueue: jest.fn(),
}));

jest.mock("../features/mission-creation/CategoryPicker", () => () => (
  <div>category-picker</div>
));
jest.mock("../features/mission-creation/LocationAutocompleteInput", () => (props) => (
  <input
    aria-label={props.placeholder}
    value={props.value}
    onChange={(event) => props.onChange(event.target.value)}
  />
));
jest.mock("../features/mission-creation/MissionLocationMap", () => () => (
  <div>location-map</div>
));
jest.mock("../features/mobility/MobilityDispatchPanel", () => () => null);

describe("AdminPhoneOrderPage Delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTradeCategories.mockResolvedValue([
      { id: 4, slug: "livraison", name: "Livraison" },
    ]);
    createPhoneOrder.mockResolvedValue({ mission: { id: 91 } });
  });

  test("préselectionne la livraison et ne demande que le téléphone et les deux lieux", async () => {
    render(<AdminPhoneOrderPage />);

    expect(await screen.findByText("deliveryOrders.phoneOrderTitle")).toBeInTheDocument();
    expect(screen.queryByText("category-picker")).not.toBeInTheDocument();
    expect(screen.queryByText("location-map")).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByPlaceholderText("adminPhoneOrder.phonePlaceholder"),
      "+22370000091"
    );
    await userEvent.type(
      screen.getByLabelText("missionCreation.location.pickupAddressPlaceholder"),
      "Sogoniko"
    );
    await userEvent.type(
      screen.getByLabelText("missionCreation.location.addressPlaceholder"),
      "Hamdallaye"
    );
    await userEvent.click(
      screen.getByRole("button", { name: "adminPhoneOrder.submitCta" })
    );

    await waitFor(() => expect(createPhoneOrder).toHaveBeenCalledTimes(1));
    expect(createPhoneOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+22370000091",
        requestKind: "trade_category",
        tradeCategoryId: 4,
        title: "deliveryOrders.phoneOrderDefaultTitle",
        pickupAddress: "Sogoniko",
        address: "Hamdallaye",
      })
    );
    expect(await screen.findByRole("link", { name: "adminPhoneOrder.success.assignCta" }))
      .toHaveAttribute("href", "/admin/livraisons");
  });
});
