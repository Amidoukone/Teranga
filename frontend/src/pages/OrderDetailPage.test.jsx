import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderDetailPage from './OrderDetailPage';
import { getOrderById, updateOrder, addOrderItem } from '../services/orders';
import { getOrderEvidences } from '../services/evidences';
import { getProducts } from '../services/products';
import { getWorkProgress } from '../services/operations';
import { me } from '../services/auth';
jest.mock('../features/finance/FinancialWorkspace', () => () => <p>Embedded payments</p>);

let mockId = '14';
const mockGeo = { user: { id: 7, role: 'client' }, countryId: 1 };
const mockNavigate = jest.fn();
const t = (key, options) => options?.defaultValue || key;
jest.mock('react-router-dom', () => ({ Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>, useLocation: () => ({ state: { from: '/operations?vue=a-suivre' } }), useParams: () => ({ id: mockId }), useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../i18n', () => ({ t: (key, options) => options?.defaultValue || key }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDateTime: String }) }));
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../services/orders', () => ({ getOrderById: jest.fn(), updateOrder: jest.fn(), addOrderItem: jest.fn(), deleteOrderItem: jest.fn() }));
jest.mock('../services/evidences', () => ({ getOrderEvidences: jest.fn(), uploadOrderEvidences: jest.fn(), deleteOrderEvidence: jest.fn() }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/products', () => ({ getProducts: jest.fn() }));
jest.mock('../services/countries', () => ({ getCountries: jest.fn(async () => []) }));
jest.mock('../services/regions', () => ({ getRegions: jest.fn(async () => []) }));
jest.mock('../services/operations', () => ({ getWorkProgress: jest.fn(), advanceAssignment: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));
const order = () => ({ id: Number(mockId), code: 'CMD-14', status: 'shipped', orderStatus: 'shipped', paymentStatus: 'unpaid', currency: 'GNF', totalAmount: 45000, customer: { firstName: 'Mariam' }, items: [{ id: 1, product: { name: 'Documents à remettre' }, quantity: 1, unitPrice: 45000 }], coordination: { executorUserId: 9 } });
beforeEach(() => {
  jest.clearAllMocks(); mockId = '14'; mockGeo.user = { id: 7, role: 'client' };
  me.mockImplementation(async () => ({ user: mockGeo.user })); getOrderById.mockImplementation(async () => order());
  getOrderEvidences.mockResolvedValue([]); getProducts.mockResolvedValue([]); updateOrder.mockResolvedValue({});
  getWorkProgress.mockImplementation(async () => ({ item: { ...order(), entityType: 'order' }, canAdvance: mockGeo.user.role === 'admin', canValidate: false }));
});

test('the order keeps its work and payment separate and exposes no client delivery confirmation', async () => {
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  expect(screen.getByText('Documents à remettre')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'agentCoordination.actions.delivered' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'agentCoordination.actions.validated' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'dossier.finance' }));
  expect(screen.getByText('dossier.paymentHint')).toBeVisible();
  expect(screen.getByText('45000 GNF', { selector: 'p' })).toBeVisible();
  expect(getProducts).not.toHaveBeenCalled();
});

test('confirming an order payment changes only its payment status and ignores double submissions', async () => {
  mockGeo.user = { id: 3, role: 'admin', countryId: 1 };
  let finish;
  updateOrder.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  fireEvent.click(screen.getByRole('link', { name: 'dossier.finance' }));
  fireEvent.click(screen.getByText('financialWorkspace.paymentReview', { selector: 'summary' }));
  const button = screen.getByRole('button', { name: 'orderDetail.actions.markPaid' });
  fireEvent.click(button); fireEvent.click(button);
  expect(updateOrder).toHaveBeenCalledTimes(1);
  expect(updateOrder).toHaveBeenCalledWith('14', { paymentStatus: 'paid' });
  await act(async () => finish({}));
});

test('the evidence lightbox closes rather than crashing when the list shrinks under it', async () => {
  getOrderEvidences.mockResolvedValue([
    { id: 1, originalName: 'photo-1.jpg', filePath: '/uploads/photo-1.jpg', mimeType: 'image/jpeg' },
    { id: 2, originalName: 'photo-2.jpg', filePath: '/uploads/photo-2.jpg', mimeType: 'image/jpeg' },
  ]);
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  const previews = await screen.findAllByTitle('orderDetail.labels.preview');
  fireEvent.click(previews[1]);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('2 / 2')).toBeInTheDocument();

  // Suppression concurrente d'une preuve pendant que la visionneuse affiche la seconde image.
  getOrderEvidences.mockResolvedValue([
    { id: 1, originalName: 'photo-1.jpg', filePath: '/uploads/photo-1.jpg', mimeType: 'image/jpeg' },
  ]);
  fireEvent.online(window);

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('adding an order item ignores a double submission', async () => {
  mockGeo.user = { id: 3, role: 'admin', countryId: 1 };
  getProducts.mockResolvedValue([{ id: 5, name: 'Casque', price: 1000, currency: 'GNF' }]);
  let finish;
  addOrderItem.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  fireEvent.click(screen.getByText('orderDetail.items.addTitle', { selector: 'summary' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
  const button = screen.getByRole('button', { name: 'orderDetail.items.addButton' });
  fireEvent.click(button); fireEvent.click(button);
  expect(addOrderItem).toHaveBeenCalledTimes(1);
  await act(async () => finish({}));
});

test('a catalogue failure does not prevent a manager from reading the order or preparing its handover', async () => {
  mockGeo.user = { id: 3, role: 'admin', countryId: 1 };
  getProducts.mockRejectedValue(new Error('catalog offline'));
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  expect(await screen.findByRole('button', { name: 'agentCoordination.actions.delivered' })).toBeInTheDocument();
  expect(screen.getByText('dossier.loadError')).toBeInTheDocument();
});

test('refresh preserves the supporting-document draft and an interruption retains the same order', async () => {
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  fireEvent.click(screen.getByText('dossier.addDocument', { selector: 'summary' }));
  fireEvent.change(screen.getByPlaceholderText('orderDetail.evidences.notesPlaceholder'), { target: { value: 'Justificatif en préparation' } });
  getOrderById.mockRejectedValueOnce(new Error('offline')); fireEvent.online(window);
  await screen.findByRole('alert');
  expect(screen.getByRole('heading', { name: 'CMD-14' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('orderDetail.evidences.notesPlaceholder')).toHaveValue('Justificatif en préparation');
});

test('revoked order access removes its content and its action controls', async () => {
  render(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-14' });
  getOrderById.mockRejectedValueOnce({ response: { status: 403 } }); fireEvent.online(window);
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'CMD-14' })).not.toBeInTheDocument());
  expect(screen.queryByText('Documents à remettre')).not.toBeInTheDocument();
});

test('changing orders ignores a delayed response from the previous order', async () => {
  let finishOld;
  getOrderById.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
  const view = render(<OrderDetailPage />); await waitFor(() => expect(getOrderById).toHaveBeenCalled());
  mockId = '15'; getOrderById.mockResolvedValue({ ...order(), code: 'CMD-ACTUELLE' });
  view.rerender(<OrderDetailPage />); await screen.findByRole('heading', { name: 'CMD-ACTUELLE' });
  await act(async () => finishOld({ ...order(), id: 14, code: 'CMD-ANCIENNE' }));
  expect(screen.queryByRole('heading', { name: 'CMD-ANCIENNE' })).not.toBeInTheDocument();
});
