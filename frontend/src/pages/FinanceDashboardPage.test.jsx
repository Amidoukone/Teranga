import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinanceDashboardPage from './FinanceDashboardPage';
import { getAllTransactions } from '../services/transactions';
import { me } from '../services/auth';
import { GEO_SELECTION_CHANGED_EVENT } from '../services/geo';

const mockTranslate = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../services/transactions', () => ({ getAllTransactions: jest.fn() }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));
beforeEach(() => { jest.clearAllMocks(); me.mockResolvedValue({ user: { id: 1, role: 'admin' } }); });

test('the statement keeps currencies separate and identifies which statuses contribute to its balance', async () => {
  getAllTransactions.mockResolvedValue([
    { id: 1, type: 'revenue', amount: 100, currency: 'GHS', status: 'completed' },
    { id: 2, type: 'expense', amount: 30, currency: 'GHS', status: 'completed' },
    { id: 3, type: 'commission', amount: 5, currency: 'GHS', status: 'completed' },
    { id: 4, type: 'adjustment', amount: 8, currency: 'GHS', status: 'completed' },
    { id: 5, type: 'revenue', amount: 90000, currency: 'GNF', status: 'completed' },
    { id: 6, type: 'revenue', amount: 10, currency: 'GHS', status: 'pending' },
  ]);
  render(<FinanceDashboardPage />);
  expect(await screen.findByText('83 GHS')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'financialWorkspace.status' }), 'completed');
  expect(screen.getByText('73 GHS')).toBeInTheDocument();
  expect(screen.queryByText('83 GHS')).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'financialWorkspace.currency' }), 'GNF');
  expect(screen.getAllByText('90000 GNF')).toHaveLength(2);
  expect(screen.queryByText('73 GHS')).not.toBeInTheDocument();
  expect(screen.queryByText(/XOF/)).not.toBeInTheDocument();
});

test('a failed load is an error rather than a valid empty statement', async () => {
  getAllTransactions.mockRejectedValue(new Error('Offline'));
  render(<FinanceDashboardPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('financialWorkspace.failed');
  expect(screen.queryByText('financialWorkspace.noTotals')).not.toBeInTheDocument();
});

test('a delayed response from the previous country cannot overwrite the current statement', async () => {
  let finishPrevious;
  getAllTransactions.mockImplementationOnce(() => new Promise((resolve) => { finishPrevious = resolve; })).mockResolvedValueOnce([{ id: 2, type: 'revenue', currency: 'GNF', amount: 500 }]);
  render(<FinanceDashboardPage />);
  await waitFor(() => expect(getAllTransactions).toHaveBeenCalledTimes(1));
  act(() => window.dispatchEvent(new CustomEvent(GEO_SELECTION_CHANGED_EVENT)));
  await waitFor(() => expect(screen.getAllByText('500 GNF')).toHaveLength(2));
  await act(async () => finishPrevious([{ id: 1, type: 'revenue', currency: 'GHS', amount: 999 }]));
  expect(screen.queryByText(/999 GHS/)).not.toBeInTheDocument();
});

test('a provider cannot request a financial statement through its component', async () => {
  me.mockResolvedValue({ user: { id: 1, role: 'provider' } });
  render(<FinanceDashboardPage />);
  await screen.findByRole('alert');
  expect(getAllTransactions).not.toHaveBeenCalled();
});

test('a requested currency without entries never silently falls back to another currency', async () => {
  getAllTransactions.mockResolvedValue([{ id: 1, type: 'revenue', amount: 100, currency: 'GHS', status: 'completed' }]);
  render(<FinanceDashboardPage filters={{ currency: 'GNF' }} />);
  await screen.findByText('financialWorkspace.noTotals');
  expect(screen.queryByText('100 GHS')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'financialWorkspace.currency' })).toHaveValue('GNF');
});
