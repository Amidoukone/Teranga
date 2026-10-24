import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OperationsCenterPage from './OperationsCenterPage';
import { getOperationUpdates, removeOperationUpdate, cleanupOperationUpdates } from '../services/operationUpdates';
import { getNotificationSummary, markAllNotificationsRead, markNotificationRead } from '../services/notifications';
import { confirmAction } from '../utils/confirm';
import { notify } from '../utils/notify';

const mockNavigate = jest.fn();
const mockTranslate = (key, options) => options?.defaultValue && key.includes('.missing') ? options.defaultValue : key;
let mockUser, mockSearch, mockItems;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate, i18n: { language: 'fr' } }) }));
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/operations', search: mockSearch }),
    useSearchParams: () => {
      const [params, setParams] = React.useState(() => new URLSearchParams(mockSearch));
      return [params, (value) => setParams(new URLSearchParams(value))];
    },
  };
}, { virtual: true });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser }) }));
jest.mock('../services/auth', () => ({ getLocalUser: () => mockUser }));
jest.mock('../utils/roles', () => ({ normalizeRole: (role) => role }));
jest.mock('../utils/labels', () => ({ formatStatus: (status) => status }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDate: (date) => date }) }));
jest.mock('../services/operationUpdates', () => ({ getOperationUpdates: jest.fn(), removeOperationUpdate: jest.fn(), cleanupOperationUpdates: jest.fn() }));
jest.mock('../services/notifications', () => ({ getNotificationSummary: jest.fn(), markAllNotificationsRead: jest.fn(), markNotificationRead: jest.fn() }));
jest.mock('../utils/confirm', () => ({ confirmAction: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));
jest.mock('./OperationsPage', () => function Coordination({ embedded, initialEntityType, focusedId }) {
  const React = require('react');
  const [draft, setDraft] = React.useState('');
  return <div data-testid="coordination" data-embedded={embedded} data-type={initialEntityType} data-focus={focusedId}>Coordination<input aria-label="Assignment draft" value={draft} onChange={(event) => setDraft(event.target.value)} /></div>;
});
jest.mock('../features/mission-tracking/WorkspaceQueue', () => function WorkQueue({ view }) {
  return <div data-testid="workqueue" data-view={view}>File de dossiers</div>;
});

const information = (extra = {}) => ({ key: 'notification:3', id: 3, source: 'notification', notificationId: 3, activityId: 9, version: 'a'.repeat(64),
  entityType: 'service', entityId: 12, title: 'Le compte rendu est disponible', message: 'Vérifiez le résultat de la prestation.',
  status: 'unread', progress: 'done', occurredAt: '2026-10-24T10:00:00.000Z', metadata: { serviceId: 12 }, ...extra });
const result = (params = {}) => {
  const items = mockItems.filter((item) => params.status !== 'unread' || item.status === 'unread');
  return { items, pagination: { page: params.page || 1, limit: 15, total: items.length }, summary: { unread: mockItems.filter((item) => item.notificationId && item.status === 'unread').length } };
};
beforeEach(() => {
  jest.clearAllMocks(); mockSearch = '?vue=a-lire'; mockUser = { id: 1, role: 'client' }; mockItems = [information()];
  getNotificationSummary.mockResolvedValue({ unread: 1 });
  getOperationUpdates.mockImplementation(async (params) => result(params));
  markNotificationRead.mockImplementation(async (id) => { mockItems = mockItems.map((item) => item.notificationId === id ? { ...item, status: 'read' } : item); });
  markAllNotificationsRead.mockImplementation(async () => { mockItems = mockItems.map((item) => ({ ...item, status: 'read' })); });
  removeOperationUpdate.mockImplementation(async (removed) => { mockItems = mockItems.filter((item) => item.key !== removed.key); });
  cleanupOperationUpdates.mockResolvedValue({ deleted: 0 }); confirmAction.mockResolvedValue(true);
});

test('one centre shows unread updates from every stage without marking them read on entry', async () => {
  render(<OperationsCenterPage />);
  expect(await screen.findByText('Le compte rendu est disponible')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'operations.title' })).toBeInTheDocument();
  expect(getOperationUpdates).toHaveBeenCalledWith(expect.objectContaining({ status: 'unread' }), expect.anything());
  expect(getOperationUpdates.mock.calls[0][0]).not.toHaveProperty('progress');
  expect(markAllNotificationsRead).not.toHaveBeenCalled(); expect(markNotificationRead).not.toHaveBeenCalled();
  expect(screen.queryByTestId('coordination')).not.toBeInTheDocument();
});

test.each(['client', 'agent', 'provider', 'category_manager'])('%s cannot reveal the administration board through a forged view parameter', async (role) => {
  mockUser = { id: 1, role }; mockSearch = '?vue=coordonner';
  render(<OperationsCenterPage />);
  expect(await screen.findByTestId('workqueue')).toBeVisible();
  expect(screen.queryByTestId('coordination')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'operationsCenter.coordination' })).not.toBeInTheDocument();
});

test('admins keep coordination with a single page title and can switch to the shared updates', async () => {
  mockUser = { id: 4, role: 'admin' }; mockSearch = '';
  render(<OperationsCenterPage />);
  expect(screen.getByTestId('workqueue')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name:'workspaceQueue.coordinationTools' }));
  expect(screen.getByTestId('coordination')).toHaveAttribute('data-embedded', 'true');
  expect(screen.getAllByRole('heading', { name: 'operations.title' })).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Assignment draft'), { target: { value: 'Awa' } });
  fireEvent.click(screen.getByRole('button', { name: /workspaceQueue.information/ }));
  await screen.findByText('Le compte rendu est disponible');
  expect(screen.getByTestId('coordination')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'workspaceQueue.coordinationTools' }));
  expect(await screen.findByRole('button', { name: 'workspaceQueue.information (1)' })).toBeInTheDocument();
  expect(screen.getByLabelText('Assignment draft')).toHaveValue('Awa');
});

test('a coordination information can focus the exact typed request without changing permissions', async () => {
  mockUser = { id: 4, role: 'admin' }; mockSearch = '?vue=coordonner&type=order&demande=82';
  render(<OperationsCenterPage />);
  expect(screen.getByTestId('coordination')).toHaveAttribute('data-type', 'order');
  expect(screen.getByTestId('coordination')).toHaveAttribute('data-focus', '82');
  expect(await screen.findByRole('button', { name: 'workspaceQueue.information (1)' })).toBeInTheDocument();
});

test.each(['client','agent','provider','admin'])('%s starts in the same three-view work centre', (role) => {
  mockSearch = ''; mockUser = {id:9,role}; render(<OperationsCenterPage />);
  expect(screen.getByTestId('workqueue')).toHaveAttribute('data-view','action');
  expect(screen.getByRole('button',{name:'workspaceQueue.action'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('button',{name:'workspaceQueue.following'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'workspaceQueue.information'})).toBeInTheDocument();
  expect(getOperationUpdates).not.toHaveBeenCalled();
});

test('opening a case remains possible when reading cannot be saved', async () => {
  markNotificationRead.mockRejectedValueOnce(new Error('Offline'));
  render(<OperationsCenterPage />); await screen.findByText('Le compte rendu est disponible');
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.open.service' }));
  expect(mockNavigate).toHaveBeenCalledWith('/services/12', expect.anything());
  expect(markNotificationRead).toHaveBeenCalledWith(3, 'a'.repeat(64));
  await waitFor(() => expect(notify).toHaveBeenCalledWith('operationsCenter.readFailed', { type: 'info' }));
});

test('marking one update read changes only the reading state and keeps it in history', async () => {
  render(<OperationsCenterPage />); await screen.findByText('Le compte rendu est disponible');
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.markRead' }));
  await screen.findByText('operationsCenter.upToDate');
  expect(markNotificationRead).toHaveBeenCalledTimes(1); expect(mockNavigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.history' }));
  expect(await screen.findByText('Le compte rendu est disponible')).toBeInTheDocument();
});

test('a refresh failure retains loaded updates while revoked access clears them', async () => {
  render(<OperationsCenterPage />); await screen.findByText('Le compte rendu est disponible');
  getOperationUpdates.mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'operations.refresh' }));
  await screen.findByText('operationsCenter.loadFailed'); expect(screen.getByText('Le compte rendu est disponible')).toBeInTheDocument();
  getOperationUpdates.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'operations.refresh' }));
  await screen.findByText('operationsCenter.accessChanged'); expect(screen.queryByText('Le compte rendu est disponible')).not.toBeInTheDocument();
});

test('a late response from the previous account never replaces the current account feed', async () => {
  let resolveOld;
  getOperationUpdates.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<OperationsCenterPage />);
  await waitFor(() => expect(getOperationUpdates).toHaveBeenCalledTimes(1));
  mockUser = { id: 2, role: 'client' }; mockItems = [information({ title: 'Information du second compte' })];
  view.rerender(<OperationsCenterPage />); await screen.findByText('Information du second compte');
  await act(async () => resolveOld({ items: [information({ title: 'Ancien compte privé' })], pagination: { total: 1 }, summary: { unread: 1 } }));
  expect(screen.queryByText('Ancien compte privé')).not.toBeInTheDocument();
  expect(screen.getByText('Information du second compte')).toBeInTheDocument();
});

test('removal is confirmed and sent with the current version of the unified entry', async () => {
  render(<OperationsCenterPage />); await screen.findByText('Le compte rendu est disponible');
  const card = screen.getByRole('article', { name: 'Le compte rendu est disponible' });
  fireEvent.click(within(card).getByText('operationsCenter.more'));
  fireEvent.click(within(card).getByRole('button', { name: 'operationsCenter.remove' }));
  await waitFor(() => expect(removeOperationUpdate).toHaveBeenCalledWith(expect.objectContaining({ key: 'notification:3', version: 'a'.repeat(64) })));
  expect(confirmAction).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
  await screen.findByText('operationsCenter.upToDate');
});

test('global reading and cleanup are secondary explicit actions', async () => {
  render(<OperationsCenterPage />); await screen.findByText('Le compte rendu est disponible');
  expect(markAllNotificationsRead).not.toHaveBeenCalled(); expect(cleanupOperationUpdates).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('operationsCenter.manageReading'));
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.markAllRead' }));
  await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
  await screen.findByText('operationsCenter.upToDate');
});
