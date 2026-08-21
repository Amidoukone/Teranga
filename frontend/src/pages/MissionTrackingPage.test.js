import React from "react";
import { render, screen } from "@testing-library/react";

import MissionTrackingPage from "./MissionTrackingPage";
import { getMissionTrack } from "../services/missions";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useParams: () => ({ id: "81" }),
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options = {}) => {
      const labels = {
        "missionTracking.kicker": "Suivi de course",
        "missionTracking.refresh": "Actualiser",
        "missionTracking.startCode.clientTitle": "Votre code de départ",
        "missionTracking.startCode.clientHint": "Donnez-le au chauffeur à son arrivée",
        "missionTracking.cancelCta": "Annuler la mission",
      };
      return labels[key] || options.defaultValue || key;
    },
  }),
}));

jest.mock("../services/missions", () => ({
  acceptMission: jest.fn(),
  createMissionDispute: jest.fn(),
  createMissionRating: jest.fn(),
  createMissionShare: jest.fn(),
  declineMission: jest.fn(),
  getMissionTrack: jest.fn(),
  requestMissionLogistics: jest.fn(),
  updateMissionStatus: jest.fn(),
  verifyMissionStartCode: jest.fn(),
}));

jest.mock("../features/mission-tracking/MissionTrackingMap", () => () => (
  <div data-testid="mission-map" />
));

test("affiche le code de départ au client dès la création de la course", async () => {
  getMissionTrack.mockResolvedValue({
    title: "Course Teranga en moto",
    missionStatus: "CREATED",
    viewerRole: "client",
    isExecutor: false,
    tradeCategorySlug: "mobilite",
    startCode: "4821",
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  expect(await screen.findByRole("heading", { name: "Course Teranga en moto" })).toBeInTheDocument();
  expect(screen.getByText("Votre code de départ")).toBeInTheDocument();
  expect(screen.getByText("4821")).toBeInTheDocument();
  expect(screen.getByText("Donnez-le au chauffeur à son arrivée")).toBeInTheDocument();
});
