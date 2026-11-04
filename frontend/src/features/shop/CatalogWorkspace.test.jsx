import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CatalogWorkspace from './CatalogWorkspace';
import { getProducts } from '../../services/products';
import { me } from '../../services/auth';

const mockGeo = { user: { id: 7, role: 'client' }, isAuthenticated: true, countryId: 1, regionId: null };
const t = (key) => key;
let mockQuery = '';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../../services/auth', () => ({ me: jest.fn() }));
jest.mock('../../services/products', () => ({ getProducts: jest.fn() }));
jest.mock('../../services/categories', () => ({ getCategories: async () => [] }));
jest.mock('../../services/orders', () => ({ createOrder: jest.fn() }));
jest.mock('../../services/api', () => ({ getFileUrl: (value) => value }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/shop', search: '' }),
  useSearchParams: () => { const React = require('react'); return React.useState(() => new URLSearchParams(mockQuery)); },
}), { virtual: true });
const result = (name = 'Kit') => ({ items: [{ id: 3, name, price: 25, currency: 'GHS', stock: 8 }], pagination: { total: 30 } });
beforeEach(() => {
  jest.clearAllMocks(); mockQuery = ''; mockGeo.countryId = 1;
  getProducts.mockResolvedValue(result()); me.mockResolvedValue({ user: mockGeo.user });
});

test('server filters and pagination are restored while typing search does not replace the page or lose focus', async () => {
  mockQuery = 'q=Kit&page=2&limit=24&priceMin=10&sort=price_asc';
  render(<CatalogWorkspace />);
  await screen.findByRole('article', { name: 'Kit' });
  expect(getProducts).toHaveBeenLastCalledWith({ page: 2, limit: 24, q: 'Kit', priceMin: '10', sort: 'price_asc' }, { withPagination: true });
  const search = screen.getByLabelText('productCatalogPage.filters.searchLabel');
  search.focus(); fireEvent.change(search, { target: { value: 'Nouveau' } });
  expect(search).toHaveFocus(); expect(getProducts).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.find' }));
  await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Nouveau', page: 1 }), { withPagination: true }));
});

test('territory changes ignore old catalogue responses', async () => {
  let oldReply;
  getProducts.mockImplementationOnce(() => new Promise((resolve) => { oldReply = resolve; }));
  const { rerender } = render(<CatalogWorkspace />);
  mockGeo.countryId = 2; getProducts.mockResolvedValue(result('Autre territoire'));
  rerender(<CatalogWorkspace />);
  await screen.findByRole('article', { name: 'Autre territoire' });
  await act(async () => oldReply(result('Ancien territoire')));
  expect(screen.queryByRole('article', { name: 'Ancien territoire' })).not.toBeInTheDocument();
});

test('purchase drafts are removed when the active territory changes', async () => {
  const { rerender } = render(<CatalogWorkspace />);
  fireEvent.change(await screen.findByLabelText('shopFlow.note'), { target: { value: 'Ancien brouillon' } });
  mockGeo.countryId = 2; rerender(<CatalogWorkspace />);
  expect(await screen.findByLabelText('shopFlow.note')).toHaveValue('');
});

test('an outage retains a purchase draft, while revoked catalogue access clears it', async () => {
  render(<CatalogWorkspace />);
  await screen.findByRole('article', { name: 'Kit' });
  const note = await screen.findByLabelText('shopFlow.note');
  fireEvent.change(note, { target: { value: 'Pour lundi' } });
  getProducts.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.change(screen.getByLabelText('productCatalogPage.filters.searchLabel'), { target: { value: 'Kit' } });
  fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.find' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('shopFlow.note')).toHaveValue('Pour lundi');
  getProducts.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.retry' }));
  await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
});
