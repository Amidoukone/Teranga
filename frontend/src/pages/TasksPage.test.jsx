import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TasksPage from './TasksPage';
import api from '../services/api';
import { me } from '../services/auth';
import { getMyServices } from '../services/services';

let mockSearch = '';
const mockNavigate = jest.fn();
const mockGeo = { user: { id: 7, role: 'agent' }, countryId: 1 };
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/tasks', search: mockSearch }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => {
    const React = require('react');
    const [query, setQuery] = React.useState(mockSearch);
    const update = React.useCallback((next) => { mockSearch = `?${next.toString()}`; setQuery(mockSearch); }, []);
    return [React.useMemo(() => new URLSearchParams(query), [query]), update];
  },
}), { virtual: true });
jest.mock('react-i18next', () => { const t = (key) => key; return { initReactI18next: { type: '3rdParty', init: () => {} }, useTranslation: () => ({ t }) }; });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/auth', () => ({ me: jest.fn(), getAuthHeader: () => ({}) }));
jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));
const result = (title, total = 1, id = 29) => ({ data: { tasks: [{ id, title, status: 'validated' }], pagination: { total } } });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); mockSearch = ''; mockGeo.user = { id: 7, role: 'agent' }; mockGeo.countryId = 1;
  me.mockImplementation(async () => ({ user: mockGeo.user }));
  getMyServices.mockResolvedValue([{ id: 14, title: 'Service familial', currency: 'GNF' }]);
  api.get.mockResolvedValue(result('Intervention historique', 21));
});

test('loads the archive on the server, preserves the property filter through pagination and opens its workspace', async () => {
  mockSearch = '?propertyId=8&status=validated';
  render(<TasksPage />);
  await screen.findByRole('heading', { name: 'Intervention historique' });
  expect(api.get).toHaveBeenCalledWith('/tasks', expect.objectContaining({ params: expect.objectContaining({ propertyId: '8', status: 'validated', page: 1, limit: 20 }) }));
  fireEvent.click(screen.getByRole('button', { name: 'pagination.next' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/tasks', expect.objectContaining({ params: expect.objectContaining({ propertyId: '8', status: 'validated', page: 2 }) })));
  await screen.findByRole('heading', { name: 'Intervention historique' });
  fireEvent.click(screen.getByRole('button', { name: 'nav.openIntervention' }));
  expect(mockNavigate).toHaveBeenCalledWith('/tasks/29', { state: { from: '/tasks?propertyId=8&status=validated&page=2' } });
  expect(screen.queryByRole('button', { name: 'tasksPage.buttons.newTask' })).not.toBeInTheDocument();
});

test('ignores a response from an old search and searches outside the loaded page', async () => {
  let resolveOld;
  api.get.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  render(<TasksPage />);
  api.get.mockResolvedValueOnce(result('Résultat ciblé', 1));
  fireEvent.change(screen.getByRole('textbox', { name: 'tasksPage.filters.searchPlaceholder' }), { target: { value: 'compteur' } });
  await screen.findByRole('heading', { name: 'Résultat ciblé' });
  await act(async () => resolveOld(result('Ancien résultat', 50)));
  expect(screen.queryByRole('heading', { name: 'Ancien résultat' })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/tasks', expect.objectContaining({ params: expect.objectContaining({ q: 'compteur', page: 1 }) }));
});

test('retains the current page during an interruption and clears it when permissions are revoked', async () => {
  render(<TasksPage />); await screen.findByRole('heading', { name: 'Intervention historique' });
  api.get.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'tasksPage.buttons.refresh' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'Intervention historique' })).toBeInTheDocument();
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.retry' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Intervention historique' })).not.toBeInTheDocument());
  expect(screen.queryByText('tasksPage.emptyTitle')).not.toBeInTheDocument();
});

test('changing accounts discards the previous archive and ignores its in-flight response', async () => {
  let finishOld;
  api.get.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
  const view = render(<TasksPage />);
  mockGeo.user = { id: 9, role: 'agent' }; api.get.mockResolvedValue(result('Nouveau compte'));
  view.rerender(<TasksPage />); await screen.findByRole('heading', { name: 'Nouveau compte' });
  await act(async () => finishOld(result('Compte précédent')));
  expect(screen.queryByRole('heading', { name: 'Compte précédent' })).not.toBeInTheDocument();
});

test.each(['client', 'agent'])('the %s archive does not inherit an administrative territory selection', async (role) => {
  mockGeo.user = { id: 7, role }; mockGeo.countryId = 99;
  render(<TasksPage />); await screen.findByRole('heading', { name: 'Intervention historique' });
  expect(api.get.mock.calls[0][1].params).not.toHaveProperty('countryId');
  expect(api.get.mock.calls[0][1].params).not.toHaveProperty('regionId');
});

test('the administrative archive follows its selected territory and discards the previous results', async () => {
  mockGeo.user = { id: 7, role: 'admin' };
  api.get.mockImplementation(async (path) => path === '/tasks' ? result('Premier territoire') : ({ data: {} }));
  const view = render(<TasksPage />); await screen.findByRole('heading', { name: 'Premier territoire' });
  mockGeo.countryId = 2;
  api.get.mockImplementation(async (path) => path === '/tasks' ? result('Second territoire') : ({ data: {} }));
  view.rerender(<TasksPage />); await screen.findByRole('heading', { name: 'Second territoire' });
  expect(screen.queryByRole('heading', { name: 'Premier territoire' })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/tasks', expect.objectContaining({ params: expect.objectContaining({ countryId: 2 }) }));
});

test('a refresh preserves the creation draft and ordinary reading never opens the form', async () => {
  mockGeo.user = { id: 7, role: 'client' };
  render(<TasksPage />); await screen.findByRole('heading', { name: 'Intervention historique' });
  expect(screen.queryByPlaceholderText('tasksPage.form.titlePlaceholder')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'tasksPage.buttons.newTask' }));
  fireEvent.change(screen.getByPlaceholderText('tasksPage.form.titlePlaceholder'), { target: { value: 'Brouillon de visite' } });
  fireEvent.click(screen.getByRole('button', { name: 'tasksPage.buttons.refresh' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  expect(screen.getByPlaceholderText('tasksPage.form.titlePlaceholder')).toHaveValue('Brouillon de visite');
  expect(getMyServices).toHaveBeenCalledTimes(1);
});
