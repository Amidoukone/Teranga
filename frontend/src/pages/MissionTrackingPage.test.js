import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import MissionTrackingPage from "./MissionTrackingPage";
import { acceptMission, declineMission, getMissionTrack, pingMissionLocation, updateMissionStatus, verifyMissionStartCode } from "../services/missions";
const mockNavigate = jest.fn();
let mockFrom;
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));
jest.mock('../features/service-workspace/ServiceStepsPanel', () => () => null);
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDateTime: String }) }));

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
    useLocation: () => ({ pathname: "/courses/81", state: { from: mockFrom } }),
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "81" }),
  }),
  { virtual: true }
);

jest.mock("react-i18next", () => {
  const t = (key, options = {}) => {
      const labels = {
        "missionTracking.kicker": "Suivi de course",
        "missionTracking.refresh": "Actualiser",
        "missionTracking.startCode.clientTitle": "Votre code de départ",
        "missionTracking.startCode.clientHint": "Donnez-le au chauffeur à son arrivée",
        "missionTracking.cancelCta": "Annuler la mission",
        "taxiRides.rideReference": "Course #81",
        "taxiRides.liveStatus.ON_SITE.title": "Votre chauffeur est arrivé",
        "taxiRides.liveStatus.ON_SITE.hint": "Rejoignez le point de départ",
        "deliveryOrders.deliveryReference": "Livraison #81",
        "deliveryOrders.liveStatus.IN_PROGRESS.title": "Votre colis est en chemin",
        "deliveryOrders.liveStatus.IN_PROGRESS.hint": "Le livreur se dirige vers la destination",
      };
      return labels[key] || options.defaultValue || key;
  };
  return { useTranslation: () => ({ t }) };
});

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
  mockFrom = undefined;
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: undefined,
  });
});

test('refusing an offer returns to its filtered list without reloading the revoked dossier', async () => {
  mockFrom = '/prestataire/interventions?vue=offres&type=taxi&q=gare';
  getMissionTrack.mockResolvedValue({ title: 'Course proposée', missionStatus: 'ASSIGNED', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'mobilite', acceptanceDeadlineAt: '2099-01-01T12:00:00Z' });
  let finish;
  declineMission.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MissionTrackingPage />);
  const button = await screen.findByRole('button', { name: 'taxiRides.decline' });
  fireEvent.click(button); fireEvent.click(button);
  expect(declineMission).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
  expect(mockNavigate).toHaveBeenCalledWith(mockFrom, { replace: true });
  expect(getMissionTrack).toHaveBeenCalledTimes(1);
});

test('an expired offer cannot be answered from a bookmarked tracking page', async () => {
  getMissionTrack.mockResolvedValue({ title: 'Course expirée', missionStatus: 'ASSIGNED', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'mobilite', acceptanceDeadlineAt: '2020-01-01T12:00:00Z' });
  render(<MissionTrackingPage />);
  expect(await screen.findByRole('button', { name: 'taxiRides.accept' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'taxiRides.decline' })).toBeDisabled();
  expect(screen.getByText('transportWorkspace.offerExpired')).toBeInTheDocument();
});

test('a reassigned offer reports the server reason and refreshes instead of pretending success', async () => {
  const offer = { title: 'Course proposée', missionStatus: 'ASSIGNED', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'mobilite', acceptanceDeadlineAt: '2099-01-01T12:00:00Z' };
  getMissionTrack.mockResolvedValueOnce(offer).mockResolvedValue({ ...offer, acceptanceDeadlineAt: null });
  acceptMission.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Cette offre a déjà reçu une réponse.' } } });
  render(<MissionTrackingPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'taxiRides.accept' }));
  expect(await screen.findByText('Cette offre a déjà reçu une réponse.')).toBeInTheDocument();
  await waitFor(() => expect(getMissionTrack).toHaveBeenCalledTimes(2));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('delivery records the optional declared cash once without creating a payment', async () => {
  const delivery = { title: 'Livraison', missionStatus: 'IN_PROGRESS', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'livraison', currency: 'XOF' };
  getMissionTrack.mockResolvedValueOnce(delivery).mockResolvedValue({ ...delivery, missionStatus: 'COMPLETED', collectedAmount: 0 });
  updateMissionStatus.mockResolvedValueOnce({});
  render(<MissionTrackingPage />);
  const amount = await screen.findByLabelText('transportWorkspace.collectedLabel');
  expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  fireEvent.change(amount, { target: { value: '0' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'deliveryOrders.executorCta.COMPLETED' })[0]);
  await waitFor(() => expect(updateMissionStatus).toHaveBeenCalledWith('81', 'COMPLETED', { collectedAmount: 0 }));
  await screen.findByText('transportWorkspace.collectedSaved');
  expect(screen.queryByRole('button', { name: 'missionTracking.showMap' })).not.toBeInTheDocument();
  expect(screen.queryByText('missionTracking.noPositionYet')).not.toBeInTheDocument();
});

test('one departure-code submission starts the ride even with repeated clicks', async () => {
  getMissionTrack.mockResolvedValue({ title: 'Course', missionStatus: 'ON_SITE', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'mobilite' });
  let finish;
  verifyMissionStartCode.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MissionTrackingPage />);
  fireEvent.change(await screen.findByLabelText('missionTracking.startCode.driverTitle', { selector: '#mission-start-code' }), { target: { value: '1234' } });
  const buttons = screen.getAllByRole('button', { name: 'missionTracking.startCode.verifyCta' });
  fireEvent.click(buttons[0]); fireEvent.click(buttons[1]);
  expect(verifyMissionStartCode).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
});

test('the submitted report is displayed before the single client confirmation action', async () => {
  getMissionTrack.mockResolvedValue({ id: 81, title: 'Résultat livré', missionStatus: 'COMPLETED', viewerRole: 'client', isExecutor: false, tradeCategorySlug: 'plomberie', completion: { report: { summary: 'Travaux remis avec leurs justificatifs', attachments: [{ id: 1, originalName: 'resultat.pdf', filePath: '/uploads/resultat.pdf' }] } } });
  render(<MissionTrackingPage />);
  const proof = await screen.findByRole('link', { name: 'resultat.pdf' });
  const button = screen.getByRole('button', { name: 'serviceTracking.actions.validate' });
  expect(proof.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('button', { name: 'missionTracking.reportProblemCta' })).toBeInTheDocument();
  updateMissionStatus.mockRejectedValueOnce({ response: { data: { error: 'La demande a changé, actualisez son état.' } } });
  fireEvent.click(button);
  const error = await screen.findByText('La demande a changé, actualisez son état.');
  expect(error.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  expect(screen.getByRole('link', { name: 'resultat.pdf' })).toBeInTheDocument();
});

test('a finished nontransport mission opens a new service request', async () => {
  getMissionTrack.mockResolvedValue({ id: 81, title: 'Travail confirmé', missionStatus: 'CLOSED', viewerRole: 'client', isExecutor: false, tradeCategorySlug: 'plomberie' });
  render(<MissionTrackingPage />);
  expect(await screen.findByRole('link', { name: 'serviceMission.terminal.newRequest' })).toHaveAttribute('href', '/demandes/nouvelle');
  expect(screen.getAllByText('serviceMission.terminal.CLOSED.title')).toHaveLength(1);
});

test('an offline refresh preserves the executor report draft and a successful refresh resumes tracking', async () => {
  const track = { id: 81, title: 'Prestation', missionStatus: 'IN_PROGRESS', viewerRole: 'provider', isExecutor: true, tradeCategorySlug: 'plomberie', completion: { required: true, requiredEvidenceTypes: ['photo'] } };
  getMissionTrack.mockResolvedValue(track);
  render(<MissionTrackingPage />);
  const summary = await screen.findByLabelText('completion.summary');
  fireEvent.change(summary, { target: { value: 'Le travail a été réalisé sur place, justificatif à déposer.' } });
  getMissionTrack.mockRejectedValueOnce(new Error('Offline'));
  fireEvent.focus(window);
  expect(await screen.findByText('completion.connectionInterrupted')).toBeInTheDocument();
  expect(screen.getByLabelText('completion.summary')).toHaveValue('Le travail a été réalisé sur place, justificatif à déposer.');
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByText('completion.connectionInterrupted')).not.toBeInTheDocument());
  expect(screen.getByLabelText('completion.summary')).toHaveValue('Le travail a été réalisé sur place, justificatif à déposer.');
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
  expect(screen.queryByText("missionTracking.noPositionYet")).not.toBeInTheDocument();
  expect(screen.getByText("missionTracking.transportNetworkNote")).toBeInTheDocument();
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
  expect(screen.getByRole("listitem", { name: "requestProgress.execution" })).toHaveAttribute(
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

test("annonce clairement au client que son colis est en chemin", async () => {
  getMissionTrack.mockResolvedValue({
    title: "Livraison de colis",
    missionStatus: "IN_PROGRESS",
    viewerRole: "client",
    isExecutor: false,
    tradeCategorySlug: "livraison",
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  expect(await screen.findByRole("heading", { name: "Livraison #81" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Votre colis est en chemin");
  expect(screen.getByRole("status")).toHaveTextContent(
    "Le livreur se dirige vers la destination"
  );
  expect(
    screen.getByRole("listitem", { name: "requestProgress.execution" })
  ).toHaveAttribute("aria-current", "step");
});

test("partage la position du livreur pendant l'acheminement du colis", async () => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: (success) =>
        success({
          coords: {
            latitude: 12.61,
            longitude: -7.99,
            accuracy: 30,
            heading: 90,
          },
        }),
    },
  });
  pingMissionLocation.mockResolvedValue({ id: 10 });
  getMissionTrack.mockResolvedValue({
    title: "Livraison de colis",
    missionStatus: "IN_PROGRESS",
    viewerRole: "provider",
    isExecutor: true,
    tradeCategorySlug: "livraison",
    acceptanceDeadlineAt: null,
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  await waitFor(() =>
    expect(pingMissionLocation).toHaveBeenCalledWith("81", {
      latitude: 12.61,
      longitude: -7.99,
      accuracyMeters: 30,
      headingDegrees: 90,
    })
  );
  expect(
    screen.getAllByRole("button", { name: "deliveryOrders.executorCta.COMPLETED" })
      .length
  ).toBeGreaterThanOrEqual(1);
});

test("montre clairement au client qu'un service est en cours", async () => {
  getMissionTrack.mockResolvedValue({
    title: "Reparation plomberie",
    missionStatus: "IN_PROGRESS",
    viewerRole: "client",
    isExecutor: false,
    tradeCategorySlug: "plomberie",
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  expect(await screen.findByRole("status")).toHaveTextContent(
    "serviceMission.liveStatus.IN_PROGRESS.title"
  );
  expect(
    screen.getByRole("listitem", { name: "requestProgress.execution" })
  ).toHaveAttribute("aria-current", "step");
});

test("donne au prestataire une action principale pour un service", async () => {
  getMissionTrack.mockResolvedValue({
    title: "Reparation plomberie",
    missionStatus: "ASSIGNED",
    viewerRole: "provider",
    isExecutor: true,
    tradeCategorySlug: "plomberie",
    acceptanceDeadlineAt: null,
    realtimeTrackingRequired: false,
  });

  render(<MissionTrackingPage />);

  expect(
    (await screen.findAllByRole("button", { name: "serviceMission.executorCta.EN_ROUTE" })).length
  ).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole("link", { name: /providerWorkspace.back/ })).toHaveAttribute(
    "href",
    "/prestataire/interventions"
  );
});
