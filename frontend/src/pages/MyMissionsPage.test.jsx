import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MyMissionsPage from "./MyMissionsPage";
import { me } from "../services/auth";
import {
  acceptMission,
  declineMission,
  getMyMissions,
} from "../services/missions";
import {
  getMyDispatchPresence,
  getMyProvider,
  updateMyAvailability,
  updateMyLiveLocation,
} from "../services/providers";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useNavigate: () => mockNavigate,
  }),
  { virtual: true },
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock("../services/auth", () => ({ me: jest.fn() }));
jest.mock("../services/missions", () => ({
  acceptMission: jest.fn(),
  declineMission: jest.fn(),
  getMyMissions: jest.fn(),
}));
jest.mock("../utils/role", () => ({ normalizeRole: (role) => role }));
jest.mock("../services/providers", () => ({
  getMyDispatchPresence: jest.fn(),
  getMyProvider: jest.fn(),
  updateMyAvailability: jest.fn(),
  updateMyLiveLocation: jest.fn(),
}));

describe("MyMissionsPage - disponibilité réseau faible", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    me.mockResolvedValue({ user: { id: 7, role: "provider" } });
    getMyProvider.mockResolvedValue({ id: 4, availabilityStatus: "offline" });
    getMyDispatchPresence.mockResolvedValue({
      eligibleVehicles: [
        { id: 12, brand: "TVS", model: "Neo", plateNumber: "MOTO-12" },
      ],
      liveLocation: null,
    });
    getMyMissions.mockResolvedValue({ missions: [] });
    updateMyAvailability.mockResolvedValue({
      id: 4,
      availabilityStatus: "available",
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (_success, error) => error({ code: 1 }),
      },
    });
  });

  test("un refus GPS ne bloque pas le passage disponible", async () => {
    render(<MyMissionsPage />);

    await userEvent.click(
      await screen.findByRole("button", {
        name: "myMissionsPage.availability.available",
      }),
    );

    await waitFor(() =>
      expect(updateMyAvailability).toHaveBeenCalledWith("available", 12),
    );
    expect(updateMyLiveLocation).not.toHaveBeenCalled();
    expect(
      screen.queryByText("myMissionsPage.errors.geolocationError"),
    ).not.toBeInTheDocument();
  });

  test("le chauffeur accepte une course en une action depuis sa liste", async () => {
    acceptMission.mockResolvedValue({ id: 31 });
    declineMission.mockResolvedValue({ id: 31 });
    getMyMissions.mockResolvedValue({
      missions: [
        {
          id: 31,
          title: "Course Teranga Taxi",
          missionStatus: "ASSIGNED",
          acceptanceDeadlineAt: "2030-01-01T12:00:00.000Z",
          requestedVehicleType: "motorcycle",
          pickupAddress: "Badalabougou",
          address: "Hippodrome",
          tradeCategory: { name: "Mobilité", slug: "mobilite" },
          client: { firstName: "Awa", phone: "+22370000000" },
        },
      ],
    });

    render(<MyMissionsPage mobilityOnly />);

    await userEvent.click(
      await screen.findByRole("button", { name: "taxiRides.accept" }),
    );

    await waitFor(() => expect(acceptMission).toHaveBeenCalledWith(31));
    expect(mockNavigate).toHaveBeenCalledWith("/courses/31");
    expect(getMyMissions).toHaveBeenCalledWith({
      tradeCategorySlug: "mobilite",
      limit: 100,
    });
  });
});
