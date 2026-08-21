import { render, screen } from "@testing-library/react";

import MobilityDispatchPanel from "./MobilityDispatchPanel";
import { getMobilityDispatchCandidates } from "../../services/missions";

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
});
