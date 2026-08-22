import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminPhoneOrderPage from "./AdminPhoneOrderPage";
import { getTradeCategories } from "../services/missionRequests";
import { getTaxiDispatchQueue } from "../services/missions";

const mockSetSearchParams = jest.fn();

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: "/admin/taxi-dispatch" }),
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}), { virtual: true });

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

jest.mock("../features/mission-creation/CategoryPicker", () => () => null);
jest.mock("../features/mission-creation/LocationAutocompleteInput", () => (props) => (
  <input aria-label={props.placeholder} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
));
jest.mock("../features/mission-creation/MissionLocationMap", () => () => null);
jest.mock("../features/mobility/MobilityDispatchPanel", () => () => <div>dispatch-panel</div>);

describe("AdminPhoneOrderPage Taxi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTradeCategories.mockResolvedValue([{ id: 3, slug: "mobilite", name: "Mobilité" }]);
    getTaxiDispatchQueue.mockResolvedValue({
      rides: [
        {
          id: 81,
          providerId: null,
          requestedVehicleType: "motorcycle",
          missionStatus: "SEARCHING_EXECUTOR",
          pickupAddress: "Sébénikoro",
          address: "ACI 2000",
          client: { firstName: "Awa", phone: "+22370000000" },
        },
        {
          id: 82,
          providerId: 9,
          requestedVehicleType: "car",
          missionStatus: "ASSIGNED",
          pickupAddress: "Hamdallaye",
          address: "Badalabougou",
          client: { firstName: "Moussa", phone: "+22371000000" },
        },
      ],
    });
  });

  test("montre la file et ouvre directement la course à affecter", async () => {
    render(<AdminPhoneOrderPage />);

    expect(await screen.findByText("adminPhoneOrder.queueUnassigned")).toBeInTheDocument();
    expect(screen.getByText("adminPhoneOrder.queueAssigned")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "adminPhoneOrder.assignRide" }));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ missionId: "81" });
  });

  test("sépare la saisie par appel de la file des courses", async () => {
    render(<AdminPhoneOrderPage />);

    await screen.findByText("adminPhoneOrder.queueTitle");
    await userEvent.click(
      screen.getByRole("button", { name: "adminPhoneOrder.phoneOrderCta" })
    );

    expect(screen.queryByText("adminPhoneOrder.queueTitle")).not.toBeInTheDocument();
    expect(screen.getByText("adminPhoneOrder.newTaxiOrder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "adminPhoneOrder.backToQueue" })).toBeInTheDocument();
    await waitFor(() => expect(getTaxiDispatchQueue).toHaveBeenCalledTimes(1));
  });
});
