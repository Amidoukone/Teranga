import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MobilityDispatchPanel from "./MobilityDispatchPanel";
import {
  getMobilityDispatchCandidates,
  updateMissionAssignment,
} from "../../services/missions";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock("./DispatchCandidatesMap", () => () => <div data-testid="dispatch-map" />);
jest.mock("../../services/missions", () => ({
  getMobilityDispatchCandidates: jest.fn(),
  overrideMissionStart: jest.fn(),
  updateMissionAssignment: jest.fn(),
}));

describe("MobilityDispatchPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("reste lisible quand un chauffeur n'a pas de position GPS", async () => {
    getMobilityDispatchCandidates.mockResolvedValue({
      mission: {
        id: 42,
        missionStatus: "SEARCHING_EXECUTOR",
        pickupAddress: "Sébénikoro",
        destinationAddress: "ACI 2000",
      },
      candidates: [
        {
          provider: { id: 7, displayFirstName: "Awa" },
          vehicle: {
            id: 12,
            vehicleType: "motorcycle",
            brand: "TVS",
            model: "Neo",
            plateNumber: "MOTO-12",
          },
          location: null,
          approachDurationSeconds: null,
          approachDistanceMeters: null,
          distanceSource: "unavailable",
          rankingScore: 35,
          reliabilityScore: 90,
        },
      ],
    });

    render(<MobilityDispatchPanel missionId={42} />);

    expect(await screen.findByText("Awa")).toBeInTheDocument();
    expect(screen.getByText("mobilityDispatch.positionUnavailable")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("1 min")).not.toBeInTheDocument();
    expect(screen.queryByText("0.0 km")).not.toBeInTheDocument();
  });

  test("affecte un chauffeur en une action puis rafraîchit la file", async () => {
    const response = {
      mission: {
        id: 42,
        missionStatus: "SEARCHING_EXECUTOR",
        pickupAddress: "Sébénikoro",
        destinationAddress: "ACI 2000",
        providerId: null,
      },
      candidates: [
        {
          provider: { id: 7, displayFirstName: "Awa" },
          vehicle: {
            id: 12,
            vehicleType: "motorcycle",
            brand: "TVS",
            model: "Neo",
            plateNumber: "MOTO-12",
          },
          location: null,
          approachDurationSeconds: null,
          approachDistanceMeters: null,
          distanceSource: "unavailable",
          rankingScore: 35,
          reliabilityScore: 90,
        },
      ],
    };
    getMobilityDispatchCandidates
      .mockResolvedValueOnce(response)
      .mockResolvedValue({
        ...response,
        mission: { ...response.mission, providerId: 7 },
      });
    updateMissionAssignment.mockResolvedValue({});
    const onAssignmentChange = jest.fn().mockResolvedValue(undefined);

    render(
      <MobilityDispatchPanel
        missionId={42}
        onAssignmentChange={onAssignmentChange}
      />
    );

    await userEvent.click(await screen.findByRole("button", { name: "mobilityDispatch.assign" }));

    await waitFor(() => {
      expect(updateMissionAssignment).toHaveBeenCalledWith(42, {
        providerId: 7,
        vehicleId: 12,
      });
    });
    await waitFor(() => expect(onAssignmentChange).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("mobilityDispatch.assignedTo")).toBeInTheDocument();
  });
});
