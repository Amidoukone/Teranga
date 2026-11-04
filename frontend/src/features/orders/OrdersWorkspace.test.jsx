import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrdersWorkspace from './OrdersWorkspace';
import { me } from '../../services/auth';
import { getOrders, createOrder } from '../../services/orders';
import { getProducts } from '../../services/products';

const mockNavigate = jest.fn(), mockGeo = { user: { id: 7, role: 'client' }, countryId: 1, regionId: null };
let mockParams = '';
const t = (key, options) => options?.defaultValue || key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../../i18n', () => ({ t: (key, options) => options?.defaultValue || key }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDateTime: String }) }));
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate, useLocation: () => ({ pathname: '/orders', search: mockParams ? `?${mockParams}` : '' }),
  useSearchParams: () => { const React = require('react'); return React.useState(() => new URLSearchParams(mockParams)); },
}), { virtual: true });
jest.mock('../../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../../services/auth', () => ({ me: jest.fn() }));
jest.mock('../../services/orders', () => ({ getOrders: jest.fn(), createOrder: jest.fn(), deleteOrder: jest.fn() }));
jest.mock('../../services/products', () => ({ getProducts: jest.fn() }));
const order = (id, code) => ({ id, code, orderStatus: 'shipped', paymentStatus: 'unpaid', totalAmount: 2500, currency: 'GHS' });
const result = (items = [], total = items.length) => ({ items, pagination: { total } });
beforeEach(() => {
  jest.clearAllMocks(); mockParams = ''; mockGeo.user = { id: 7, role: 'client' }; mockGeo.countryId = 1;
  me.mockImplementation(async () => ({ user: mockGeo.user }));
  getOrders.mockResolvedValue(result([order(14, 'CMD-14')]));
  getProducts.mockResolvedValue([{ id: 3, name: 'Kit', price: 25, currency: 'GHS' }]);
  createOrder.mockResolvedValue({ id: 15 });
});

test('orders open as a list with one dossier action and no eager catalogue request', async () => {
  render(<OrdersWorkspace />);
  await screen.findByRole('article', { name: 'CMD-14' });
  expect(getProducts).not.toHaveBeenCalled();
  expect(screen.queryByRole('form', { name: 'orders.form.title' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'orders.buttons.openOrder' })).toHaveAttribute('href', '/orders/14');
  expect(screen.queryByRole('link', { name: 'orders.buttons.viewTransactions' })).not.toBeInTheDocument();
});

test('a client creates a catalogue order without submitting an ineffective price override or duplicates', async () => {
  let finish;
  createOrder.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<OrdersWorkspace />);
  userEvent.click(await screen.findByRole('button', { name: 'orders.buttons.newOrder' }));
  await screen.findByRole('option', { name: 'Kit · 25 GHS' });
  userEvent.selectOptions(screen.getByRole('combobox', { name: 'orders.form.productLabel' }), '3');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'orders.form.quantityLabel' }), { target: { value: '2' } });
  expect(screen.queryByLabelText('orders.form.unitPriceLabel')).not.toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'orders.form.submit' });
  userEvent.click(submit); userEvent.click(submit);
  await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
  expect(createOrder).toHaveBeenCalledWith({ customerNote: '', items: [{ productId: 3, quantity: 2 }] });
  await act(async () => finish({ id: 15 }));
  expect(mockNavigate).toHaveBeenCalledWith('/orders/15', { state: { from: '/orders' } });
});

test('a catalogue outage still permits a described order and an empty order is not silently submitted', async () => {
  getProducts.mockRejectedValue(new Error('offline'));
  render(<OrdersWorkspace />);
  userEvent.click(await screen.findByRole('button', { name: 'orders.buttons.newOrder' }));
  await screen.findByRole('alert');
  userEvent.click(screen.getByRole('button', { name: 'orders.form.submit' }));
  expect(createOrder).not.toHaveBeenCalled();
  userEvent.type(screen.getByRole('textbox', { name: 'orders.form.customerNoteLabel' }), 'Acheter les fournitures du dossier');
  userEvent.click(screen.getByRole('button', { name: 'orders.form.submit' }));
  await waitFor(() => expect(createOrder).toHaveBeenCalledWith({ customerNote: 'Acheter les fournitures du dossier' }));
});

test('search and pagination run at the server and personal lists clear inherited territory filters', async () => {
  getOrders.mockResolvedValueOnce(result([order(14,'CMD-14')], 41)).mockResolvedValue(result([order(35,'CMD-35')], 41));
  render(<OrdersWorkspace />); await screen.findByText('CMD-14');
  userEvent.click(screen.getByRole('button', { name: 'pagination.next' }));
  await screen.findByText('CMD-35');
  expect(getOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, countryId: null, regionId: null }), { withPagination: true });
  userEvent.type(screen.getByRole('textbox', { name: 'orders.filters.searchLabel' }), 'fournitures');
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.find' }));
  await waitFor(() => expect(getOrders).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: 'fournitures' }), { withPagination: true }));
});

test('an interruption retains the list and draft; revoked access removes the list and form', async () => {
  render(<OrdersWorkspace />); await screen.findByText('CMD-14');
  userEvent.click(screen.getByRole('button', { name: 'orders.buttons.newOrder' }));
  userEvent.type(screen.getByRole('textbox', { name: 'orders.form.customerNoteLabel' }), 'Commande en préparation');
  getOrders.mockRejectedValueOnce(new Error('offline'));
  fireEvent.online(window); await screen.findByRole('alert');
  expect(screen.getByText('CMD-14')).toBeInTheDocument();
  expect(screen.getByLabelText('orders.form.customerNoteLabel')).toHaveValue('Commande en préparation');
  getOrders.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.online(window);
  await waitFor(() => expect(screen.queryByText('CMD-14')).not.toBeInTheDocument());
  expect(screen.queryByRole('form', { name: 'orders.form.title' })).not.toBeInTheDocument();
});

test('a delayed old territory response cannot replace the current list', async () => {
  let finish;
  getOrders.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(result([order(15,'CMD-ACTUELLE')]));
  const view = render(<OrdersWorkspace />); await waitFor(() => expect(getOrders).toHaveBeenCalled());
  mockGeo.countryId = 2; view.rerender(<OrdersWorkspace />); await screen.findByText('CMD-ACTUELLE');
  await act(async () => finish(result([order(14,'CMD-ANCIENNE')])));
  expect(screen.queryByText('CMD-ANCIENNE')).not.toBeInTheDocument();
});
