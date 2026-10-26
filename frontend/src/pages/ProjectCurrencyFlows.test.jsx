import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDetailPage from './ProjectDetailPage';
import { getProjectById, getProjectPhases, getProjectDocuments } from '../services/projects';
import { getAllTransactions } from '../services/transactions';
import { me } from '../services/auth';

const mockTranslate = (key) => key;
const mockNavigate = jest.fn();

jest.mock('../features/mission-tracking/WorkProgressPanel', () => () => null);
jest.mock('react-router-dom', () => ({ Link: ({ to, children }) => <a href={to}>{children}</a>, useLocation: () => ({}), useNavigate: () => mockNavigate, useParams: () => ({ id: '14' }) }), { virtual: true });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: { id: 1, role: 'admin' } }) }));
jest.mock('../features/service-workspace/ProjectTasksPanel', () => () => null);
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDate: String, formatDateTime: String }) }));
jest.mock('../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/projects', () => ({ getProjectById: jest.fn(), getProjectPhases: jest.fn(), getProjectDocuments: jest.fn() }));
jest.mock('../services/transactions', () => ({ getAllTransactions: jest.fn(), createTransaction: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));

test('a project displays separate currency balances and opens the common financial workspace', async () => {
  me.mockResolvedValue({ user: { id: 1, role: 'admin' } });
  getProjectById.mockResolvedValue({ id: 14, title: 'Projet Accra', countryId: 2, currency: 'GHS', budget: 500, type: 'autre', status: 'created' });
  getProjectPhases.mockResolvedValue([]);
  getProjectDocuments.mockResolvedValue([]);
  getAllTransactions.mockResolvedValue([
    { id: 1, type: 'revenue', amount: 100, currency: 'GHS' },
    { id: 2, type: 'expense', amount: 2000, currency: 'GNF' },
  ]);
  render(<ProjectDetailPage />);
  await userEvent.click(await screen.findByText('dossier.finance', { selector: 'summary' }));
  expect(getAllTransactions).toHaveBeenCalledWith({ projectId: '14', countryId: 2, regionId: null });
  expect(within(screen.getByRole('group', { name: 'GHS' })).getAllByText('100 GHS')).toHaveLength(2);
  expect(within(screen.getByRole('group', { name: 'GNF' })).getByText('-2000 GNF')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'financialWorkspace.title' })).toHaveAttribute('href', '/projects/14/transactions');
});
