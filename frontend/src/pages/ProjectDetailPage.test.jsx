import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectDetailPage from './ProjectDetailPage';
import { getProjectById, getProjectPhases, getProjectDocuments, saveProjectPhase } from '../services/projects';
import { getAllTransactions } from '../services/transactions';
import { me } from '../services/auth';
import { getWorkProgress, advanceAssignment } from '../services/operations';
jest.mock('../features/projects/ProjectManagement', () => () => null);
jest.mock('../features/finance/FinancialWorkspace', () => () => <p>Embedded payments</p>);

const mockGeo = { user: { id: 7, role: 'client' }, countryId: 1 };
const mockNavigate = jest.fn();
let mockId = '14';
const mockLocation = { state: { from: '/operations?vue=a-faire&q=chantier' } };
const t = (key, options) => options?.defaultValue || key;
jest.mock('react-router-dom', () => ({ Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>, useParams: () => ({ id: mockId }), useLocation: () => mockLocation, useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../i18n', () => ({ t: (key, options) => options?.defaultValue || key }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDate: String, formatDateTime: String }) }));
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/projects', () => ({ getProjectById: jest.fn(), getProjectPhases: jest.fn(), getProjectDocuments: jest.fn(), saveProjectPhase: jest.fn() }));
jest.mock('../services/transactions', () => ({ getAllTransactions: jest.fn(), createTransaction: jest.fn() }));
jest.mock('../services/operations', () => ({ getWorkProgress: jest.fn(), advanceAssignment: jest.fn() }));
jest.mock('../features/service-workspace/ProjectTasksPanel', () => () => <section id="project-tasks" />);
jest.mock('../utils/notify', () => ({ notify: jest.fn() }));
const project = () => ({ id: Number(mockId), title: 'Maison familiale', status: 'completed', clientId: 7, agentId: 9, agent: { id: 9, firstName: 'Awa' }, currency: 'GNF', countryId: 1, coordination: { policy: { completionReport: { summary: 'Le chantier est terminé et vérifié.', reporterId: 9 } } } });
beforeEach(() => {
  jest.clearAllMocks(); mockId = '14'; mockGeo.user = { id: 7, role: 'client' };
  me.mockImplementation(async () => ({ user: mockGeo.user }));
  getProjectById.mockImplementation(async () => project());
  getProjectPhases.mockResolvedValue([]); getProjectDocuments.mockResolvedValue([{ id: 1, title: 'Rapport de chantier', kind: 'report', filePath: '/uploads/report.pdf' }]);
  getAllTransactions.mockResolvedValue([]); saveProjectPhase.mockResolvedValue({}); advanceAssignment.mockResolvedValue({});
  getWorkProgress.mockImplementation(async () => ({ item: { ...project(), entityType: 'project' }, canAdvance: false, canValidate: true }));
});

test('places the result before client confirmation and returns to the searched queue', async () => {
  render(<ProjectDetailPage />);
  await screen.findByRole('heading', { name: 'Maison familiale' });
  const confirm = await screen.findByRole('button', { name: 'agentCoordination.actions.validated' });
  const report = screen.getByText('Rapport de chantier', { exact: true });
  expect(report.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('link', { name: 'roleViews.backHome' })).toHaveAttribute('href', mockLocation.state.from);
  fireEvent.click(confirm);
  await waitFor(() => expect(advanceAssignment).toHaveBeenCalledWith('project', 14, { status: 'validated' }));
});

test('an assigned agent sees the phases but receives no phase editing right', async () => {
  mockGeo.user = { id: 9, role: 'agent' };
  getProjectPhases.mockResolvedValue([{ id: 21, title: 'Inspection', status: 'active' }]);
  getWorkProgress.mockResolvedValue({ item: { ...project(), status: 'in_progress', entityType: 'project' }, canAdvance: true, canValidate: false, readiness: { openPhases: 1, openTasks: 0, hasProof: false } });
  render(<ProjectDetailPage />); await screen.findByRole('heading', { name: 'Inspection' });
  expect(screen.queryByRole('combobox', { name: /dossier.phaseStatus/ })).not.toBeInTheDocument();
  expect(screen.getByText('dossier.phaseManaged')).toBeInTheDocument();
  expect(await screen.findByLabelText('dossier.readiness')).toHaveTextContent('dossier.openPhases');
});

test('a manager updates a phase through its existing endpoint and finance stays secondary', async () => {
  mockGeo.user = { id: 3, role: 'admin' };
  getProjectPhases.mockResolvedValue([{ id: 21, title: 'Inspection', status: 'active' }]);
  render(<ProjectDetailPage />);
  fireEvent.change(await screen.findByRole('combobox', { name: 'dossier.phaseStatus' }), { target: { value: 'completed' } });
  await waitFor(() => expect(saveProjectPhase).toHaveBeenCalledWith({ id: 21, status: 'completed' }));
  expect(screen.getByRole('group', { name: 'GNF', hidden: true })).not.toBeVisible();
});

test('a failure of finance does not remove the project or invent a zero balance', async () => {
  getAllTransactions.mockRejectedValue(new Error('finance offline'));
  render(<ProjectDetailPage />); await screen.findByRole('heading', { name: 'Maison familiale' });
  fireEvent.click(screen.getByRole('link', { name: 'dossier.finance' }));
  expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  expect(screen.queryByRole('group', { name: 'GNF' })).not.toBeInTheDocument();
  expect(screen.getByText('Rapport de chantier', { exact: true })).toBeInTheDocument();
});

test('the customer cannot confirm while the result documents are unavailable', async () => {
  getProjectDocuments.mockRejectedValue(new Error('proofs offline'));
  render(<ProjectDetailPage />);
  expect(await screen.findByRole('button', { name: 'agentCoordination.actions.validated' })).toBeDisabled();
  expect(screen.getByText('dossier.reviewUnavailable')).toBeInTheDocument();
});

test('changing the project ignores the old response and its result', async () => {
  let finishOld;
  getProjectById.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }));
  const view = render(<ProjectDetailPage />);
  await waitFor(() => expect(getProjectById).toHaveBeenCalled());
  mockId = '15'; getProjectById.mockResolvedValue({ ...project(), title: 'Projet actuel' });
  view.rerender(<ProjectDetailPage />); await screen.findByRole('heading', { name: 'Projet actuel' });
  await act(async () => finishOld({ ...project(), id: 14, title: 'Ancien projet' }));
  expect(screen.queryByRole('heading', { name: 'Ancien projet' })).not.toBeInTheDocument();
});
