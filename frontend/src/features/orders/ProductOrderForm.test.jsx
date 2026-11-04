import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductOrderForm from './ProductOrderForm';
import { createOrder } from '../../services/orders';

const mockNavigate = jest.fn();
const t = (key, options) => options?.count != null ? `${key}:${options.count}` : key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));
jest.mock('../../services/orders', () => ({ createOrder: jest.fn() }));
jest.mock('../../services/api', () => ({ getFileUrl: (value) => value }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/products/3', search: '', state: { from: '/shop?q=Kit&page=2' } }),
}), { virtual: true });
const product = { id: 3, name: 'Kit', price: 25, currency: 'GHS', countryId: 2, regionId: 4, stock: 8 };
const user = { id: 7, role: 'client', countryId: 1, regionId: 9 };
const submit = () => fireEvent.submit(screen.getByRole('form'));
beforeEach(() => { jest.clearAllMocks(); createOrder.mockResolvedValue({ id: 15 }); });

test('catalogue prices and territory are inherited without sending a client price or overriding work/payment status', async () => {
  let finish;
  createOrder.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<ProductOrderForm product={product} user={user} />);
  fireEvent.change(screen.getByLabelText('orders.form.quantityLabel'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('shopFlow.note'), { target: { value: '  Pour la famille  ' } });
  expect(screen.getByText('shopFlow.total: 50 GHS')).toBeInTheDocument();
  submit(); submit();
  expect(createOrder).toHaveBeenCalledTimes(1);
  expect(createOrder).toHaveBeenCalledWith({ customerNote: 'Pour la famille', countryId: 2, regionId: 4, currency: 'GHS', items: [{ productId: 3, quantity: 2 }] });
  await act(async () => finish({ order: { id: 15 } }));
  expect(mockNavigate).toHaveBeenCalledWith('/orders/15', { state: { from: '/products/3', catalogueFrom: '/shop?q=Kit&page=2' } });
});

test.each(['0', '1.5', '9'])('quantity %s is rejected before creation', async (quantity) => {
  render(<ProductOrderForm product={product} user={user} />);
  fireEvent.change(screen.getByLabelText('orders.form.quantityLabel'), { target: { value: quantity } });
  submit();
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(createOrder).not.toHaveBeenCalled();
});

test('server failure retains instructions and quantity and allows retry', async () => {
  createOrder.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Stock actualisé : 1 article disponible' } } });
  render(<ProductOrderForm product={product} user={user} />);
  fireEvent.change(screen.getByLabelText('orders.form.quantityLabel'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('shopFlow.note'), { target: { value: 'À remettre au gardien' } });
  submit();
  expect(await screen.findByRole('alert')).toHaveTextContent('Stock actualisé');
  expect(screen.getByLabelText('orders.form.quantityLabel')).toHaveValue(2);
  expect(screen.getByLabelText('shopFlow.note')).toHaveValue('À remettre au gardien');
  fireEvent.change(screen.getByLabelText('orders.form.quantityLabel'), { target: { value: '1' } });
  submit();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
});

test('an article in a different country does not inherit the client region', async () => {
  render(<ProductOrderForm product={{ ...product, regionId: null }} user={user} />);
  submit();
  await waitFor(() => expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ countryId: 2, regionId: null })));
});

test('unavailable articles cannot be submitted, and agents have no purchase form', () => {
  const { rerender } = render(<ProductOrderForm product={{ ...product, stock: 0 }} user={user} />);
  submit(); expect(createOrder).not.toHaveBeenCalled();
  expect(screen.getByRole('button')).toBeDisabled();
  rerender(<ProductOrderForm product={product} user={{ ...user, role: 'agent' }} />);
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});
