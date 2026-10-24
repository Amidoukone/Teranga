import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceStepsPanel from './ServiceStepsPanel';
import { getServiceSteps, createTask, updateTaskStatus, assignTaskAgent } from '../../services/tasks';
import { deleteEvidence, getEvidences, uploadEvidences } from '../../services/evidences';
import { getAssignableAgents } from '../../services/operations';
import { confirmAction } from '../../utils/confirm';

const mockGeo = { user: { id: 7 }, countryId: 1, regionId: 2 };
const mockLocation = { pathname: '/services/14', search: '', state: null };
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatDate: String, formatNumber: String }) }));
jest.mock('react-i18next', () => { const t = (key, values = {}) => key === 'serviceSteps.view' ? `Ouvrir ${values.name}` : key; return { useTranslation: () => ({ t }) }; });
jest.mock('react-router-dom', () => ({ useLocation: () => mockLocation, Link: ({ children, to, state, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../../services/tasks', () => ({ getServiceSteps: jest.fn(), createTask: jest.fn(), updateTaskStatus: jest.fn(), assignTaskAgent: jest.fn() }));
jest.mock('../../services/evidences', () => ({ getEvidences: jest.fn(), uploadEvidences: jest.fn(), deleteEvidence: jest.fn() }));
jest.mock('../../services/operations', () => ({ getAssignableAgents: jest.fn() }));
jest.mock('../../utils/labels', () => ({ CURRENCY_LABELS: { XOF: 'XOF' }, TASK_TYPES: { other: 'Autre' }, TASK_PRIORITIES: { normal: 'Normale' } }));
jest.mock('../../utils/confirm', () => ({ confirmAction: jest.fn().mockResolvedValue(true) }));
const step = (changes = {}) => ({ id: 11, serviceId: 14, title: 'Vérifier le robinet', type: 'repair', status: 'created', priority: 'normal', assignedTo: 7, capabilities: { canStart: true, canAccessEvidence: true }, ...changes });
const payload = (tasks = [], changes = {}) => ({ tasks, pagination: { total: tasks.length }, viewer: { id: 7, role: 'agent' }, canCreate: false, serviceContext: { id: 14, countryId: 1, regionId: 2, currency: 'XOF' }, ...changes });
const show = () => render(<ServiceStepsPanel serviceId={14} standalone />);
beforeEach(() => {
  jest.clearAllMocks(); window.location.hash = ''; mockGeo.user = { id: 7 }; mockGeo.countryId = 1;
  mockLocation.search = '';
  getServiceSteps.mockResolvedValue(payload()); getEvidences.mockResolvedValue([]);
  confirmAction.mockResolvedValue(true);
  getAssignableAgents.mockResolvedValue([{ id: 9, firstName: 'Moussa', countryId: 1, regionId: 2 }]);
  createTask.mockResolvedValue({ id: 12 }); updateTaskStatus.mockResolvedValue({}); assignTaskAgent.mockResolvedValue({});
});

test('a simple service does not require a step or load any evidence', async () => {
  render(<ServiceStepsPanel serviceId={14} />); await waitFor(() => expect(getServiceSteps).toHaveBeenCalledWith(14, { page: 1, limit: 20 }));
  await waitFor(() => expect(screen.queryByLabelText('serviceSteps.title')).not.toBeInTheDocument());
  expect(createTask).not.toHaveBeenCalled(); expect(getEvidences).not.toHaveBeenCalled();
});

test('a client creates an optional step inside the case without inheriting its agent', async () => {
  getServiceSteps.mockResolvedValue(payload([], { canCreate: true, viewer: { id: 4, role: 'client' } }));
  show(); userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.add' }));
  userEvent.type(screen.getByLabelText('serviceSteps.name'), 'Contrôler le compteur');
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.create' }));
  await waitFor(() => expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ serviceId: 14, title: 'Contrôler le compteur', currency: '' })));
  expect(createTask.mock.calls[0][0]).not.toHaveProperty('assignedTo');
  expect(getAssignableAgents).not.toHaveBeenCalled();
});

test('server capabilities prevent a supervising agent from advancing another agent’s step', async () => {
  getServiceSteps.mockResolvedValue(payload([step({ assignedTo: 9, capabilities: { canAccessEvidence: true } })]));
  show(); await screen.findByRole('heading', { name: 'Vérifier le robinet' });
  expect(screen.queryByRole('button', { name: 'serviceSteps.start' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'serviceSteps.validate' })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.proofs' }));
  await waitFor(() => expect(getEvidences).toHaveBeenCalledWith(11));
});

test('an administrator reviews the step without confirming the service', async () => {
  getServiceSteps.mockResolvedValue(payload([step({ status: 'completed', capabilities: { canValidate: true } })], { viewer: { id: 3, role: 'admin' } }));
  show(); userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.validate' }));
  await waitFor(() => expect(updateTaskStatus).toHaveBeenCalledWith(11, 'validated'));
  expect(screen.getByText('serviceSteps.completedHint')).toBeInTheDocument();
});

test('a slow status write freezes the case controls and prevents duplicate submissions', async () => {
  let resolve; updateTaskStatus.mockImplementation(() => new Promise((done) => { resolve = done; }));
  getServiceSteps.mockResolvedValue(payload([step()])); show();
  const button = await screen.findByRole('button', { name: 'serviceSteps.start' });
  userEvent.click(button); userEvent.click(button);
  expect(updateTaskStatus).toHaveBeenCalledTimes(1); expect(button).toBeDisabled();
  await act(async () => resolve({})); await waitFor(() => expect(button).not.toBeDisabled());
});

test('step evidence stays in the case and its draft survives refresh and closing the panel', async () => {
  getServiceSteps.mockResolvedValue(payload([step()])); show();
  userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.proofs' }));
  await screen.findByText('serviceSteps.noProof');
  userEvent.type(screen.getByLabelText('serviceSteps.notes'), 'Photo avant intervention');
  const file = new File(['proof'], 'avant.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('serviceSteps.files'), { target: { files: [file] } });
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.refresh' }));
  await waitFor(() => expect(getServiceSteps).toHaveBeenCalledTimes(2));
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.proofs' }));
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.proofs' }));
  expect(screen.getByLabelText('serviceSteps.notes')).toHaveValue('Photo avant intervention');
  getEvidences.mockResolvedValue([{ id: 31, originalName: 'avant.pdf', filePath: 'https://example.com/avant.pdf' }]);
  uploadEvidences.mockResolvedValue({ evidences: [{ id: 31 }] });
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.upload' }));
  await waitFor(() => expect(uploadEvidences).toHaveBeenCalledWith(11, [file], 'Photo avant intervention', { withMetadata: true }));
  expect(await screen.findByRole('link', { name: 'Ouvrir avant.pdf' })).toHaveAttribute('href', 'https://example.com/avant.pdf');
});

test('partial uploads keep only the files reported missing and explain the outcome', async () => {
  getServiceSteps.mockResolvedValue(payload([step()])); show(); userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.proofs' })); await screen.findByText('serviceSteps.noProof');
  const first = new File(['1'], 'one.pdf'), second = new File(['2'], 'two.pdf');
  fireEvent.change(screen.getByLabelText('serviceSteps.files'), { target: { files: [first, second] } });
  uploadEvidences.mockResolvedValue({ evidences: [{ id: 31 }], warnings: { failedFiles: [{ name: 'two.pdf' }] } });
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.upload' }));
  await screen.findByText('serviceSteps.partialUpload');
  expect(screen.getByText('two.pdf')).toBeInTheDocument();
  expect(screen.queryByText('one.pdf · two.pdf')).not.toBeInTheDocument();
});

test('assignment choices load only when requested and retain the current agent', async () => {
  getServiceSteps.mockResolvedValue(payload([step({ assignedTo: 99, capabilities: { canAssign: true } })], { viewer: { id: 3, role: 'admin' } }));
  show(); await screen.findByRole('heading', { name: 'Vérifier le robinet' }); expect(getAssignableAgents).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.assign' }));
  const select = await screen.findByLabelText('serviceSteps.assignee'); await waitFor(() => expect(select).not.toBeDisabled()); expect(select).toHaveValue('99');
  userEvent.selectOptions(select, '9');
  userEvent.click(screen.getAllByRole('button', { name: 'serviceSteps.assign' })[1]);
  await waitFor(() => expect(assignTaskAgent).toHaveBeenCalledWith(11, 9));
});

test('pagination requests all steps instead of silently filtering the first page', async () => {
  getServiceSteps.mockResolvedValue(payload([step()], { pagination: { total: 25 } })); show();
  userEvent.click(await screen.findByRole('button', { name: 'Page 2' }));
  await waitFor(() => expect(getServiceSteps).toHaveBeenCalledWith(14, { page: 2, limit: 20 }));
});

test('an observed assignment change blocks an edited selection until the current assignee is reviewed', async () => {
  const initial = step({ assignedTo: 99, capabilities: { canAssign: true } });
  getServiceSteps.mockResolvedValue(payload([initial], { viewer: { id: 3, role: 'admin' } })); show();
  userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.assign' }));
  const select = await screen.findByLabelText('serviceSteps.assignee'); await waitFor(() => expect(select).not.toBeDisabled()); userEvent.selectOptions(select, '9');
  getServiceSteps.mockResolvedValue(payload([{ ...initial, assignedTo: 88 }], { viewer: { id: 3, role: 'admin' } }));
  userEvent.click(screen.getByRole('button', { name: 'serviceSteps.refresh' }));
  await screen.findByText('serviceSteps.assignmentChanged');
  expect(screen.getAllByRole('button', { name: 'serviceSteps.assign' })[1]).toBeDisabled();
  expect(assignTaskAgent).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'coordinationWorkspace.reviewAssignment' })); expect(select).toHaveValue('88');
});

test('the legacy entry still shows an authorized step without linking to a forbidden parent service', async () => {
  getServiceSteps.mockResolvedValue(payload([step()], { serviceContext: null })); show();
  await screen.findByRole('heading', { name: 'Vérifier le robinet' });
  expect(screen.queryByRole('link', { name: 'serviceSteps.back' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'serviceSteps.start' })).toBeInTheDocument();
});

test('a failed refresh preserves the step; a forbidden refresh clears it and its forms', async () => {
  getServiceSteps.mockResolvedValue(payload([step()])); show(); await screen.findByRole('heading', { name: 'Vérifier le robinet' });
  getServiceSteps.mockRejectedValueOnce(new Error('Offline')); userEvent.click(screen.getByRole('button', { name: 'serviceSteps.refresh' }));
  await screen.findByText('serviceSteps.failed'); expect(screen.getByRole('heading', { name: 'Vérifier le robinet' })).toBeInTheDocument();
  getServiceSteps.mockRejectedValueOnce({ response: { status: 403 } }); userEvent.click(screen.getByRole('button', { name: 'serviceSteps.refresh' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Vérifier le robinet' })).not.toBeInTheDocument());
});

test('a late response cannot replace the newly opened service', async () => {
  let resolve; getServiceSteps.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const view = show(); await waitFor(() => expect(getServiceSteps).toHaveBeenCalled());
  getServiceSteps.mockResolvedValue(payload([step({ id: 12, title: 'Nouveau dossier' })])); view.rerender(<ServiceStepsPanel serviceId={15} standalone />);
  await screen.findByRole('heading', { name: 'Nouveau dossier' }); await act(async () => resolve(payload([step()])));
  expect(screen.queryByRole('heading', { name: 'Vérifier le robinet' })).not.toBeInTheDocument();
});

test('a forbidden evidence refresh hides files and the upload form', async () => {
  getServiceSteps.mockResolvedValue(payload([step()])); getEvidences.mockRejectedValue({ response: { status: 403 } }); show();
  userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.proofs' }));
  const evidence = await screen.findByRole('region', { name: 'serviceSteps.proofs' });
  await within(evidence).findByRole('alert'); expect(within(evidence).queryByLabelText('serviceSteps.files')).not.toBeInTheDocument();
});

test('a denied deletion does not revoke the continuing right to consult the step evidence', async () => {
  getServiceSteps.mockResolvedValue(payload([step()]));
  getEvidences.mockResolvedValue([{ id: 31, uploaderId: 7, createdAt: new Date().toISOString(), originalName: 'preuve.pdf', filePath: 'https://example.com/preuve.pdf' }]);
  deleteEvidence.mockRejectedValue({ response: { status: 403, data: { error: 'La suppression est expirée' } } });
  show(); userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.proofs' }));
  userEvent.click(await screen.findByRole('button', { name: 'serviceSteps.remove' }));
  await screen.findByText('La suppression est expirée');
  expect(screen.getByRole('link', { name: 'Ouvrir preuve.pdf' })).toBeInTheDocument();
  expect(screen.getByLabelText('serviceSteps.files')).toBeInTheDocument();
});

test('a link from an evidence update requests the exact step and opens its files directly', async () => {
  mockLocation.search = '?etape=11&pieces=1';
  getServiceSteps.mockResolvedValue(payload([step()])); getEvidences.mockResolvedValue([{ id: 31, originalName: 'preuve.pdf', filePath: 'https://example.com/preuve.pdf' }]);
  render(<ServiceStepsPanel serviceId={14} />);
  expect(await screen.findByRole('link', { name: 'Ouvrir preuve.pdf' })).toBeInTheDocument();
  expect(getServiceSteps).toHaveBeenCalledWith(14, { page: 1, limit: 20, taskId: 11 });
  expect(screen.getByRole('link', { name: 'serviceSteps.allSteps' })).toHaveAttribute('href', '/services/14#steps');
});

test('a missing focused step remains explicit instead of presenting another step or an empty hidden panel', async () => {
  mockLocation.search = '?etape=999'; getServiceSteps.mockResolvedValue(payload()); render(<ServiceStepsPanel serviceId={14} />);
  expect(await screen.findByText('serviceSteps.focusMissing')).toBeInTheDocument();
});
