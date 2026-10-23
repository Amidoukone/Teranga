import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceTransactionsPage from './ServiceTransactionsPage';
import ServiceTasksPage from './ServiceTasksPage';
import { me } from '../services/auth';
import { getServiceById } from '../services/services';
import { createTransaction, getTransactions } from '../services/transactions';
import api from '../services/api';

const mockTranslate = (key) => key;
const mockHeaders = {};
const mockLocation = { pathname: '/services/14/transactions', search: '', state: null };

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useParams: () => ({ id: '14' }),
  useNavigate: () => jest.fn(),
  useLocation: () => mockLocation,
}), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../i18n', () => ({ t: (key, options) => options?.defaultValue || key }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDateTime: (value) => value, formatNumber: String }) }));
jest.mock('../services/auth', () => ({ me: jest.fn(), getAuthHeader: () => mockHeaders }));
jest.mock('../services/services', () => ({ getServiceById: jest.fn() }));
jest.mock('../services/transactions', () => ({ createTransaction: jest.fn(), getTransactions: jest.fn() }));
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  me.mockResolvedValue({ user: { id: 4, role: 'admin' } });
  getServiceById.mockResolvedValue({ id: 14, title: 'Service Accra', type: 'errand', currency: 'GHS' });
  getTransactions.mockResolvedValue([]);
  createTransaction.mockResolvedValue({ id: 8 });
  api.get.mockResolvedValue({ data: { tasks: [] } });
  api.post.mockResolvedValue({ data: { task: { id: 8 } } });
});

test('service transactions display the local currency and keep it as the default after submission', async () => {
  render(<ServiceTransactionsPage />);
  const inherited = await screen.findByRole('option', { name: 'common.currencyFromService (GHS)' });
  expect(inherited.selected).toBe(true);
  await userEvent.type(screen.getByPlaceholderText('serviceTransactions.form.amountPlaceholder'), '500');
  await userEvent.click(screen.getByRole('button', { name: 'serviceTransactions.form.submit' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 14, amount: 500, currency: undefined })));
  expect(screen.getByRole('option', { name: 'common.currencyFromService (GHS)' }).selected).toBe(true);
});

test('a service transaction can explicitly select a country currency absent from the historical labels', async () => {
  render(<ServiceTransactionsPage />);
  await screen.findByRole('option', { name: 'common.currencyFromService (GHS)' });
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'serviceTransactions.form.currencyLabel' }), 'GHS');
  await userEvent.type(screen.getByPlaceholderText('serviceTransactions.form.amountPlaceholder'), '500');
  await userEvent.click(screen.getByRole('button', { name: 'serviceTransactions.form.submit' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GHS' })));
});

test('tasks use the service currency without fetching all services or substituting XOF', async () => {
  render(<ServiceTasksPage />);
  const inherited = await screen.findByRole('option', { name: 'common.currencyFromService (GHS)', hidden: true });
  expect(inherited.selected).toBe(true);
  expect(getServiceById).toHaveBeenCalledWith(14);
  expect(api.get).not.toHaveBeenCalledWith('/services/me', expect.anything());
  const submit = screen.getByRole('button', { name: 'tasksPage.form.submit' });
  await userEvent.click(submit);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/tasks', expect.objectContaining({ serviceId: 14, currency: undefined }), expect.anything()));
  expect(screen.getByRole('option', { name: 'common.currencyFromService (GHS)', hidden: true }).selected).toBe(true);
});
