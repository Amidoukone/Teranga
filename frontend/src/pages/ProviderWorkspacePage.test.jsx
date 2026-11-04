import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderWorkspacePage from './ProviderWorkspacePage';
import { acceptMission, declineMission, getMyMissions } from '../services/missions';

let mockSearch = '', mockUser;
const mockNavigate = jest.fn(), mockTranslate = key => key;
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    Link: ({ children, to, state, ...props }) => <a href={to} data-from={state?.from} {...props}>{children}</a>,
    Navigate: () => null,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/prestataire/interventions', search: mockSearch ? `?${mockSearch}` : '' }),
    useSearchParams: () => {
      const [params, setParams] = React.useState(() => new URLSearchParams(mockSearch));
      const update = React.useCallback(value => setParams(previous => {
        const next = typeof value === 'function' ? value(previous) : value;
        mockSearch = next.toString(); return new URLSearchParams(next);
      }), []);
      return [params, update];
    },
  };
}, { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser }) }));
jest.mock('../services/missions', () => ({ getMyMissions: jest.fn(), acceptMission: jest.fn(), declineMission: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDateTime: String }) }));
const service = { id: 1, title: 'Réparation', missionStatus: 'IN_PROGRESS' };
const taxi = { id: 2, title: 'Course', missionStatus: 'ASSIGNED', acceptanceDeadlineAt: '2099-01-01T12:00:00Z', tradeCategory: { slug: 'mobilite' } };
const delivery = { id: 3, title: 'Colis remis', missionStatus: 'COMPLETED', tradeCategory: { slug: 'livraison' } };
const result = items => ({ missions: items, pagination: { total: items.length } });
beforeEach(() => { jest.resetAllMocks(); mockSearch = ''; mockUser = { id: 7, role: 'provider' }; getMyMissions.mockResolvedValue(result([service, taxi, delivery])); });

test('one list links to each specialized dossier and keeps a submitted result awaiting confirmation', async () => {
  render(<ProviderWorkspacePage />);
  await screen.findByText('Réparation');
  expect(screen.getByRole('link', { name: 'workspace.continueWork' })).toHaveAttribute('href', '/missions/1/track');
  expect(screen.getByRole('link', { name: 'serviceAgent.details' })).toHaveAttribute('href', '/courses/2');
  expect(screen.getByRole('link', { name: 'providerWorkspace.report' })).toHaveAttribute('href', '/livraisons/3');
  expect(screen.getByText('providerWorkspace.next.waitingClient')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'fieldWorkspace.goAvailable' })).not.toBeInTheDocument();
});

test('filters and history reach the server before pagination and survive opening a dossier', async () => {
  mockSearch = 'vue=historique&type=delivery&q=archive&page=2';
  getMyMissions.mockResolvedValue({ missions: [{ ...delivery, missionStatus: 'VALIDATED' }], pagination: { total: 21 } });
  render(<ProviderWorkspacePage />);
  const link = await screen.findByRole('link', { name: 'providerWorkspace.report' });
  expect(link).toHaveAttribute('data-from', '/prestataire/interventions?vue=historique&type=delivery&q=archive&page=2');
  expect(getMyMissions).toHaveBeenLastCalledWith({ view: 'history', kind: 'delivery', q: 'archive', page: 2, limit: 20 }, expect.objectContaining({ signal: expect.anything() }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'taxi' } });
  await waitFor(() => expect(getMyMissions).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'taxi', page: 1 }), expect.anything()));
});

test('accepting an offer once opens the correct dossier with its filtered return', async () => {
  mockSearch = 'vue=offres&type=taxi';
  let finish;
  acceptMission.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<ProviderWorkspacePage />);
  const button = await screen.findByRole('button', { name: 'providerWorkspace.accept' });
  fireEvent.click(button); fireEvent.click(button);
  expect(acceptMission).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
  expect(mockNavigate).toHaveBeenCalledWith('/courses/2', { state: { from: '/prestataire/interventions?vue=offres&type=taxi' } });
});

test('an expired offer cannot be accepted or refused', async () => {
  getMyMissions.mockResolvedValue(result([{ ...taxi, acceptanceDeadlineAt: '2020-01-01T12:00:00Z' }]));
  render(<ProviderWorkspacePage />);
  expect(await screen.findByRole('button', { name: 'providerWorkspace.accept' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'providerWorkspace.decline' })).toBeDisabled();
  expect(screen.getByText('providerWorkspace.next.expired')).toBeInTheDocument();
});

test('refusal removes the offer on refresh and a conflict displays an explicit response', async () => {
  getMyMissions.mockResolvedValueOnce(result([taxi])).mockResolvedValue(result([]));
  declineMission.mockResolvedValue({});
  render(<ProviderWorkspacePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'providerWorkspace.decline' }));
  await waitFor(() => expect(screen.queryByText('Course')).not.toBeInTheDocument());
  expect(declineMission).toHaveBeenCalledWith(2);
  getMyMissions.mockResolvedValue(result([taxi]));
  fireEvent.click(screen.getByRole('button', { name: 'operations.refresh' }));
  acceptMission.mockRejectedValue({ response: { status: 409, data: { error: 'Offre réaffectée' } } });
  fireEvent.click(await screen.findByRole('button', { name: 'providerWorkspace.accept' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Offre réaffectée');
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('network failure retains the current list but revoked access clears it', async () => {
  render(<ProviderWorkspacePage />); await screen.findByText('Réparation');
  getMyMissions.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'operations.refresh' }));
  await screen.findByRole('alert'); expect(screen.getByText('Réparation')).toBeInTheDocument();
  getMyMissions.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'operations.refresh' }));
  await waitFor(() => expect(screen.queryByText('Réparation')).not.toBeInTheDocument());
});

test('late account responses and accepted offers cannot replace the new account or navigate', async () => {
  let finishOld, finishAccept;
  getMyMissions.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  const view = render(<ProviderWorkspacePage />);
  mockUser = { id: 8, role: 'provider' }; view.rerender(<ProviderWorkspacePage />);
  await screen.findByText('Course');
  await act(async () => finishOld(result([{ ...service, title: 'Ancien compte' }])));
  expect(screen.queryByText('Ancien compte')).not.toBeInTheDocument();
  acceptMission.mockImplementationOnce(() => new Promise(resolve => { finishAccept = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'providerWorkspace.accept' }));
  mockUser = { id: 9, role: 'provider' }; view.rerender(<ProviderWorkspacePage />);
  await act(async () => finishAccept({}));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('an emptied final page returns to the last available page', async () => {
  mockSearch = 'page=9';
  getMyMissions.mockImplementation(async params => ({ missions: params.page === 2 ? [service] : [], pagination: { total: 21 } }));
  render(<ProviderWorkspacePage />);
  await screen.findByText('Réparation');
  expect(getMyMissions).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything());
});
