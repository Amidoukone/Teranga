import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ServicesPage from './ServicesPage';
import { getClientRequests } from '../services/clientRequests';
let mockSearch = '', mockUser;
const mockTranslate = (key) => key;
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    Link: ({ children, to, state, ...props }) => <a href={to} data-from={state?.from} {...props}>{children}</a>,
    useLocation: () => ({ pathname: '/demandes', search: mockSearch ? `?${mockSearch.replace(/^\?/, '')}` : '' }),
    useSearchParams: () => {
      const [params, setParams] = React.useState(() => new URLSearchParams(mockSearch));
      const update = React.useCallback((value) => setParams((previous) => {
        const next = typeof value === 'function' ? value(previous) : value;
        mockSearch = next.toString(); return new URLSearchParams(next);
      }), []);
      return [params, update];
    },
  };
}, { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser, countryId: 1 }) }));
jest.mock('../services/clientRequests', () => ({ getClientRequests: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDate: String }) }));
const items = [
  { kind: 'service', id: 1, title: 'Démarche', status: 'created' },
  { kind: 'service', id: 2, title: 'Course', status: 'created', missionStatus: 'CREATED', tradeCategory: { slug: 'mobilite' } },
  { kind: 'service', id: 3, title: 'Colis', status: 'created', missionStatus: 'IN_PROGRESS', tradeCategory: { slug: 'livraison' } },
  { kind: 'service', id: 4, title: 'Résultat remis', status: 'completed' },
  { kind: 'service', id: 5, title: 'Archive', status: 'validated' },
];
function result(params) {
  const selected = items.filter((row) => params.view === 'review' ? row.status === 'completed' : params.view === 'history' ? row.status === 'validated' : params.view === 'active' ? row.status !== 'validated' : true)
    .filter((row) => params.kind === 'taxi' ? row.id === 2 : params.kind === 'delivery' ? row.id === 3 : true)
    .filter((row) => !params.q || row.title.includes(params.q));
  return { items: selected, pagination: { total: selected.length } };
}
beforeEach(() => { jest.resetAllMocks(); mockSearch = ''; mockUser = { id: 7, role: 'client' }; getClientRequests.mockImplementation(async (params) => result(params)); });

test('one compact list opens the correct tracking route for every family and prioritises review actions', async () => {
  render(<ServicesPage />);
  await screen.findByText('Démarche');
  expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'unifiedRequests.service' })).toHaveAttribute('href', '/demandes/nouvelle');
  expect(screen.getByRole('link', { name: 'clientHome.review' })).toHaveAttribute('href', '/services/4');
  expect(screen.getAllByRole('link', { name: 'serviceOrders.follow' }).map((link) => link.getAttribute('href'))).toEqual(['/services/1', '/courses/2', '/livraisons/3']);
  expect(getClientRequests).toHaveBeenCalledWith(expect.objectContaining({ view: 'active', limit: 20 }), expect.objectContaining({ signal: expect.anything() }));
});
test('family filters are requested from the server and clear the previous page', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'taxi' } });
  await screen.findByText('Course');
  expect(screen.queryByText('Démarche')).not.toBeInTheDocument();
  expect(getClientRequests).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'taxi', page: 1 }), expect.anything());
});
test('review links preserve list parameters when opening a case, and finished cases have their own view', async () => {
  mockSearch = 'vue=a-verifier&type=service';
  render(<ServicesPage />);
  expect(await screen.findByRole('link', { name: 'clientHome.review' })).toHaveAttribute('data-from', '/demandes?vue=a-verifier&type=service');
  fireEvent.click(screen.getByRole('button', { name: 'requestWorkspace.viewsLabel.historique' }));
  expect(await screen.findByRole('link', { name: 'serviceOrders.view' })).toHaveAttribute('href', '/services/5');
  expect(getClientRequests).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'history' }), expect.anything());
});
test('search waits for submission and supports clearing the selected filters', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  const initial = getClientRequests.mock.calls.length;
  fireEvent.change(screen.getByRole('textbox', { name: 'requestWorkspace.search' }), { target: { value: 'Colis' } });
  expect(getClientRequests).toHaveBeenCalledTimes(initial);
  fireEvent.click(screen.getByRole('button', { name: 'requestWorkspace.find' }));
  await screen.findByText('Colis');
  expect(screen.queryByText('Démarche')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.clearFilters' }));
  expect(await screen.findByText('Démarche')).toBeInTheDocument();
});
test('an outdated final page returns to the last available page', async () => {
  mockSearch = 'page=9';
  getClientRequests.mockImplementation(async (params) => ({ items: params.page === 2 ? [items[0]] : [], pagination: { total: 21 } }));
  render(<ServicesPage />);
  expect(await screen.findByText('Démarche')).toBeInTheDocument();
  expect(getClientRequests).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything());
});
test('offline refresh keeps loaded information while revoked access clears it', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  getClientRequests.mockRejectedValueOnce(Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.refresh' }));
  await screen.findByRole('alert'); expect(screen.getByText('Démarche')).toBeInTheDocument();
  getClientRequests.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.refresh' }));
  await waitFor(() => expect(screen.queryByText('Démarche')).not.toBeInTheDocument());
});
test('late responses from the previous account are ignored', async () => {
  let resolveOld;
  getClientRequests.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<ServicesPage />);
  mockUser = { id: 8, role: 'client' }; getClientRequests.mockResolvedValue({ items: [], pagination: { total: 0 } });
  view.rerender(<ServicesPage />);
  await act(async () => resolveOld({ items: [{ kind: 'service', id: 99, title: 'Ancien compte privé' }], pagination: { total: 1 } }));
  expect(screen.queryByText('Ancien compte privé')).not.toBeInTheDocument();
});

test('projects and orders share the list without id collisions, payment confusion or extra navigation', async () => {
  mockSearch = 'vue=toutes&page=2';
  getClientRequests.mockResolvedValue({ items: [
    { kind: 'service', id: 1, title: 'Service partagé', status: 'created' },
    { kind: 'project', id: 1, title: 'Projet partagé', status: 'completed', review: true },
    { kind: 'order', id: 1, title: 'CMD-1', summary: 'Commande de fournitures', status: 'shipped', paymentStatus: 'paid', review: false },
  ], pagination: { total: 23 } });
  render(<ServicesPage />);
  await screen.findByText('Projet partagé');
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'clientHome.review' })).toHaveAttribute('href', '/projects/1');
  const order = screen.getAllByRole('link', { name: 'serviceOrders.follow' }).find(link => link.getAttribute('href') === '/orders/1');
  expect(order).toHaveAttribute('data-from', '/demandes?vue=toutes&page=2');
  expect(screen.getByText('orders.list.paymentStatusLabel orders.payment.paid')).toBeInTheDocument();
  expect(screen.getByText('Commande de fournitures')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'projectSimple.new' })).toHaveAttribute('href', '/projects?nouveau=1');
  expect(screen.getByRole('link', { name: 'orders.buttons.newOrder' })).toHaveAttribute('href', '/orders?nouveau=1');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'project' } });
  await waitFor(() => expect(getClientRequests).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'project', page: 1 }), expect.anything()));
});

test('a late search response cannot replace a more recent family selection', async () => {
  let resolveOld;
  getClientRequests.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  render(<ServicesPage />);
  getClientRequests.mockResolvedValue({ items: [{ kind: 'order', id: 9, title: 'Dernière commande', status: 'created' }], pagination: { total: 1 } });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'order' } });
  await screen.findByText('Dernière commande');
  await act(async () => resolveOld({ items: [{ kind: 'service', id: 8, title: 'Ancienne sélection', status: 'created' }], pagination: { total: 1 } }));
  expect(screen.queryByText('Ancienne sélection')).not.toBeInTheDocument();
  expect(screen.getByText('Dernière commande')).toBeInTheDocument();
});
