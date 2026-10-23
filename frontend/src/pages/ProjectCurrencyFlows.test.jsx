import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDetailPage from './ProjectDetailPage';
import { getProjectById, getProjectPhases, getProjectDocuments } from '../services/projects';
import { getAllTransactions, createTransaction } from '../services/transactions';
import { me } from '../services/auth';

const mockTranslate = (key) => key;
const mockNavigate = jest.fn();

jest.mock('../features/mission-tracking/WorkProgressPanel', () => () => null);
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useParams: () => ({ id: '14' }) }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDate: String, formatDateTime: String }) }));
jest.mock('../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/projects', () => ({ getProjectById: jest.fn(), getProjectPhases: jest.fn(), getProjectDocuments: jest.fn() }));
jest.mock('../services/transactions', () => ({ getAllTransactions: jest.fn(), createTransaction: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));

test('a project displays separate currency balances and records new expenses in its own currency by default', async () => {
  me.mockResolvedValue({ user: { id: 1, role: 'admin' } });
  getProjectById.mockResolvedValue({ id: 14, title: 'Projet Accra', countryId: 2, currency: 'GHS', budget: 500, type: 'autre', status: 'created' });
  getProjectPhases.mockResolvedValue([]);
  getProjectDocuments.mockResolvedValue([]);
  getAllTransactions.mockResolvedValue([
    { id: 1, type: 'revenue', amount: 100, currency: 'GHS' },
    { id: 2, type: 'expense', amount: 2000, currency: 'GNF' },
  ]);
  createTransaction.mockResolvedValue({ id: 3 });
  render(<ProjectDetailPage />);
  const automatic = await screen.findByRole('option', { name: 'common.currencyFromOperation (GHS)' });
  expect(automatic.selected).toBe(true);
  expect(getAllTransactions).toHaveBeenCalledWith({ projectId: '14', countryId: 2, regionId: null });
  expect(within(screen.getByRole('group', { name: 'GHS' })).getAllByText('100 GHS')).toHaveLength(2);
  expect(within(screen.getByRole('group', { name: 'GNF' })).getByText('-2000 GNF')).toBeInTheDocument();
  await userEvent.type(screen.getByPlaceholderText('projects.transaction.amountPlaceholder'), '20');
  await userEvent.click(screen.getByRole('button', { name: 'projects.transaction.save' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ projectId: 14, amount: 20, currency: undefined })));
});
