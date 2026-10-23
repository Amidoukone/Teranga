import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinanceDashboardPage from './FinanceDashboardPage';
import { getAllTransactions } from '../services/transactions';
import { me } from '../services/auth';
import { GEO_SELECTION_CHANGED_EVENT } from '../services/geo';

const mockTranslate = (key, values) => values?.currency && values?.amount !== undefined
  ? `${key}: ${values.amount} ${values.currency}` : key;

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../services/transactions', () => ({ getAllTransactions: jest.fn() }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ locale: 'en-GB', formatDate: String }) }));
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  PieChart: ({ children }) => <div>{children}</div>,
  Pie: () => null, Tooltip: () => null, Cell: () => null, Legend: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  me.mockResolvedValue({ user: { id: 1, role: 'admin' } });
});

test('the dashboard switches the whole balance to one currency and treats adjustments consistently', async () => {
  getAllTransactions.mockResolvedValue([
    { id: 1, type: 'revenue', amount: 100, currency: 'GHS' },
    { id: 2, type: 'expense', amount: 30, currency: 'GHS' },
    { id: 3, type: 'commission', amount: 5, currency: 'GHS' },
    { id: 4, type: 'adjustment', amount: 8, currency: 'GHS' },
    { id: 5, type: 'revenue', amount: 90000, currency: 'GNF' },
  ]);
  render(<FinanceDashboardPage />);
  expect(await screen.findByText('financeDashboardPage.balance: 73.00 GHS')).toBeInTheDocument();
  const selector = screen.getByRole('combobox', { name: 'financeDashboardPage.currencyLabel' });
  await userEvent.selectOptions(selector, 'GNF');
  expect(screen.getByText('financeDashboardPage.balance: 90,000.00 GNF')).toBeInTheDocument();
  expect(screen.queryByText('financeDashboardPage.balance: 73.00 GHS')).not.toBeInTheDocument();
  expect(screen.queryByText(/XOF/)).not.toBeInTheDocument();
});

test('a failed data load is visible instead of silently showing a valid empty statement', async () => {
  getAllTransactions.mockRejectedValue(new Error('Offline'));
  render(<FinanceDashboardPage />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('financeDashboardPage.transactionsFailed'));
});

test('a delayed response from the previous country cannot overwrite the current statement', async () => {
  let finishPrevious;
  getAllTransactions.mockImplementationOnce(() => new Promise((resolve) => { finishPrevious = resolve; }));
  getAllTransactions.mockResolvedValueOnce([{ id: 2, type: 'revenue', currency: 'GNF', amount: 500 }]);
  render(<FinanceDashboardPage />);
  await waitFor(() => expect(getAllTransactions).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new CustomEvent(GEO_SELECTION_CHANGED_EVENT)));
  expect(await screen.findByText('financeDashboardPage.balance: 500.00 GNF')).toBeInTheDocument();
  await act(async () => finishPrevious([{ id: 1, type: 'revenue', currency: 'GHS', amount: 999 }]));
  expect(screen.getByText('financeDashboardPage.balance: 500.00 GNF')).toBeInTheDocument();
  expect(screen.queryByText(/999.00 GHS/)).not.toBeInTheDocument();
});
