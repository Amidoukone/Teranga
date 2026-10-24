import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ServicesPage from './ServicesPage';
import { getMyServices } from '../services/services';
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
jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDate: String }) }));
const items = [
  { id: 1, title: 'Démarche', status: 'created' },
  { id: 2, title: 'Course', status: 'created', missionStatus: 'CREATED', tradeCategory: { slug: 'mobilite' } },
  { id: 3, title: 'Colis', status: 'created', missionStatus: 'IN_PROGRESS', tradeCategory: { slug: 'livraison' } },
  { id: 4, title: 'Résultat remis', status: 'completed' },
  { id: 5, title: 'Archive', status: 'validated' },
];
function result(params) {
  const selected = items.filter((row) => params.view === 'review' ? row.status === 'completed' : params.view === 'history' ? row.status === 'validated' : params.view === 'active' ? row.status !== 'validated' : true)
    .filter((row) => params.kind === 'taxi' ? row.id === 2 : params.kind === 'delivery' ? row.id === 3 : true)
    .filter((row) => !params.q || row.title.includes(params.q));
  return { items: selected, pagination: { total: selected.length } };
}
beforeEach(() => { jest.resetAllMocks(); mockSearch = ''; mockUser = { id: 7 }; getMyServices.mockImplementation(async (params) => result(params)); });

test('one compact list opens the correct tracking route for every family and prioritises review actions', async () => {
  render(<ServicesPage />);
  await screen.findByText('Démarche');
  expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'serviceOrders.newRequest' })).toHaveAttribute('href', '/demandes/nouvelle');
  expect(screen.getByRole('link', { name: 'clientHome.review' })).toHaveAttribute('href', '/services/4');
  expect(screen.getAllByRole('link', { name: 'serviceOrders.follow' }).map((link) => link.getAttribute('href'))).toEqual(['/services/1', '/courses/2', '/livraisons/3']);
  expect(getMyServices).toHaveBeenCalledWith(expect.objectContaining({ view: 'active', limit: 20 }), expect.objectContaining({ withPagination: true }));
});
test('family filters are requested from the server and clear the previous page', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'taxi' } });
  await screen.findByText('Course');
  expect(screen.queryByText('Démarche')).not.toBeInTheDocument();
  expect(getMyServices).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'taxi', offset: 0 }), expect.anything());
});
test('review links preserve list parameters when opening a case, and finished cases have their own view', async () => {
  mockSearch = 'vue=a-verifier&type=service';
  render(<ServicesPage />);
  expect(await screen.findByRole('link', { name: 'clientHome.review' })).toHaveAttribute('data-from', '/demandes?vue=a-verifier&type=service');
  fireEvent.click(screen.getByRole('button', { name: 'requestWorkspace.viewsLabel.historique' }));
  expect(await screen.findByRole('link', { name: 'serviceOrders.view' })).toHaveAttribute('href', '/services/5');
  expect(getMyServices).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'history' }), expect.anything());
});
test('search waits for submission and supports clearing the selected filters', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  const initial = getMyServices.mock.calls.length;
  fireEvent.change(screen.getByRole('textbox', { name: 'requestWorkspace.search' }), { target: { value: 'Colis' } });
  expect(getMyServices).toHaveBeenCalledTimes(initial);
  fireEvent.click(screen.getByRole('button', { name: 'requestWorkspace.find' }));
  await screen.findByText('Colis');
  expect(screen.queryByText('Démarche')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'operationsCenter.clearFilters' }));
  expect(await screen.findByText('Démarche')).toBeInTheDocument();
});
test('an outdated final page returns to the last available page', async () => {
  mockSearch = 'page=9';
  getMyServices.mockImplementation(async (params) => ({ items: params.offset === 20 ? [items[0]] : [], pagination: { total: 21 } }));
  render(<ServicesPage />);
  expect(await screen.findByText('Démarche')).toBeInTheDocument();
  expect(getMyServices).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 }), expect.anything());
});
test('offline refresh keeps loaded information while revoked access clears it', async () => {
  render(<ServicesPage />); await screen.findByText('Démarche');
  getMyServices.mockRejectedValueOnce(Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.refresh' }));
  await screen.findByRole('alert'); expect(screen.getByText('Démarche')).toBeInTheDocument();
  getMyServices.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.refresh' }));
  await waitFor(() => expect(screen.queryByText('Démarche')).not.toBeInTheDocument());
});
test('late responses from the previous account are ignored', async () => {
  let resolveOld;
  getMyServices.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const view = render(<ServicesPage />);
  mockUser = { id: 8 }; getMyServices.mockResolvedValue({ items: [], pagination: { total: 0 } });
  view.rerender(<ServicesPage />);
  await act(async () => resolveOld({ items: [{ id: 99, title: 'Ancien compte privé' }], pagination: { total: 1 } }));
  expect(screen.queryByText('Ancien compte privé')).not.toBeInTheDocument();
});
