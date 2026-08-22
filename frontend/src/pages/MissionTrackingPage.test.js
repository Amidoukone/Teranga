import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import MissionTrackingPage from "./MissionTrackingPage";
import { getMissionTrack, pingMissionLocation } from "../services/missions";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useLocation: () => ({ pathname: "/courses/81" }),
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
        "taxiRides.rideReference": "Course #81",
        "taxiRides.liveStatus.ON_SITE.title": "Votre chauffeur est arrivé",
        "taxiRides.liveStatus.ON_SITE.hint": "Rejoignez le point de départ",
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
  pingMissionLocation: jest.fn(),
  requestMissionLogistics: jest.fn(),
  updateMissionStatus: jest.fn(),
  verifyMissionStartCode: jest.fn(),
}));

jest.mock("../features/mission-tracking/MissionTrackingMap", () => () => (
  <div data-testid="mission-map" />
));

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
});

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

  expect(await screen.findByRole("heading", { name: "Course #81" })).toBeInTheDocument();
  expect(screen.getByText("Votre code de départ")).toBeInTheDocument();
  expect(screen.getByText("4821")).toBeInTheDocument();
  expect(screen.getByText("Donnez-le au chauffeur à son arrivée")).toBeInTheDocument();
});

test("annonce clairement au client que son chauffeur est arrivé", async () => {
  getMissionTrack.mockResolvedValue({
    title: "Course Teranga en moto",
    missionStatus: "ON_SITE",
    viewerRole: "client",
    isExecutor: false,
    tradeCategorySlug: "mobilite",
    startCode: "4821",
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Votre chauffeur est arrivé"
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Rejoignez le point de départ"
  );
  expect(screen.getByRole("listitem", { name: "taxiRides.progress.arrived" })).toHaveAttribute(
    "aria-current",
    "step"
  );
});

test("partage une position économique quand le chauffeur est en route", async () => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success) =>
        success({
          coords: {
            latitude: 12.6392,
            longitude: -8.0029,
            accuracy: 25,
            heading: null,
          },
        }),
    },
  });
  pingMissionLocation.mockResolvedValue({ id: 9 });
  getMissionTrack.mockResolvedValue({
    title: "Course Teranga en moto",
    missionStatus: "EN_ROUTE",
    viewerRole: "provider",
    isExecutor: true,
    tradeCategorySlug: "mobilite",
    acceptanceDeadlineAt: null,
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  await waitFor(() =>
    expect(pingMissionLocation).toHaveBeenCalledWith("81", {
      latitude: 12.6392,
      longitude: -8.0029,
      accuracyMeters: 25,
      headingDegrees: null,
    })
  );
  expect(
    screen.getAllByRole("button", { name: "missionTracking.executorCta.ON_SITE" })
      .length
  ).toBeGreaterThanOrEqual(1);
});
