import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProjectsWorkspace from './ProjectsWorkspace';
import ProjectEditor, { canModifyProject } from './ProjectEditor';
import { me } from '../../services/auth';
import { getProjects, createProject, updateProject } from '../../services/projects';
import api from '../../services/api';
import { updateCoordination } from '../../services/operations';

const mockNavigate = jest.fn(), mockGeo = { user: { id: 7, role: 'client' }, countryId: 1, regionId: null };
let mockQuery = '';
const t = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
jest.mock('../../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDateTime: String }) }));
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../../services/auth', () => ({ me: jest.fn() }));
jest.mock('../../services/projects', () => ({ getProjects: jest.fn(), createProject: jest.fn(), updateProject: jest.fn() }));
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../services/operations', () => ({ updateCoordination: jest.fn(async () => ({})) }));
jest.mock('../mission-creation/LocationAutocompleteInput', () => ({ value, onChange }) => <input value={value} onChange={(event) => onChange(event.target.value)} />);
jest.mock('../mission-creation/MissionLocationMap', () => () => <p>Map</p>);
jest.mock('react-router-dom', () => ({
  Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>, useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/projects', search: mockQuery ? `?${mockQuery}` : '' }),
  useSearchParams: () => { const React = require('react'); return React.useState(() => new URLSearchParams(mockQuery)); },
}), { virtual: true });
const project = (id, title) => ({ id, title, clientId: 7, status: 'created', type: 'autre', createdAt: '2026-10-01T12:00:00Z', budget: null, currency: 'XOF' });
beforeEach(() => { jest.clearAllMocks(); mockQuery = ''; mockGeo.countryId = 1; mockGeo.user = { id: 7, role: 'client' }; me.mockImplementation(async () => ({ user: mockGeo.user })); getProjects.mockResolvedValue([project(3, 'Projet familial')]); api.get.mockResolvedValue({ data: { users: [] } }); createProject.mockResolvedValue(project(4, 'Nouveau')); updateProject.mockResolvedValue(project(3, 'Modifié')); });

test('the list offers one dossier action, no financial form, and no eager user or map reads', async () => {
  render(<ProjectsWorkspace />);
  const card = await screen.findByRole('article', { name: 'Projet familial' });
  expect(within(card).getAllByRole('link')).toHaveLength(1);
  expect(screen.queryByRole('form', { name: 'projectSimple.new' })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(getProjects).toHaveBeenCalledWith({ countryId: null, regionId: null });
});

test('search and pagination cover the full existing server response', async () => {
  getProjects.mockResolvedValue(Array.from({ length: 25 }, (_, index) => project(index + 1, `Projet ${index + 1}`)));
  mockQuery = 'q=Projet&page=2'; render(<ProjectsWorkspace />);
  expect(await screen.findAllByRole('article')).toHaveLength(5);
  fireEvent.change(screen.getByLabelText('projectSimple.search'), { target: { value: 'Projet 25' } });
  fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.find' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(getProjects).toHaveBeenCalledTimes(1);
});

test('a temporary failure retains list and draft while revocation removes them', async () => {
  render(<ProjectsWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: 'projectSimple.new' }));
  fireEvent.change(screen.getByLabelText('projects.form.titleLabel'), { target: { value: 'Mon brouillon' } });
  getProjects.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.refresh' }));
  await screen.findByRole('alert'); expect(screen.getByLabelText('projects.form.titleLabel')).toHaveValue('Mon brouillon');
  expect(screen.getByRole('article')).toBeInTheDocument();
  getProjects.mockRejectedValueOnce({ response: { status: 403 } }); fireEvent.click(screen.getByRole('button', { name: 'financialWorkspace.retry' }));
  await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
  expect(screen.queryByRole('form', { name: 'projectSimple.new' })).not.toBeInTheDocument();
});

test('old territory replies do not replace the new territory list', async () => {
  let oldReply; getProjects.mockImplementationOnce(() => new Promise((resolve) => { oldReply = resolve; }));
  const { rerender } = render(<ProjectsWorkspace />); await waitFor(() => expect(getProjects).toHaveBeenCalled());
  mockGeo.countryId = 2; getProjects.mockResolvedValue([project(5, 'Projet actuel')]); rerender(<ProjectsWorkspace />);
  await screen.findByRole('article', { name: 'Projet actuel' }); await act(async () => oldReply([project(3, 'Ancien projet')]));
  expect(screen.queryByRole('article', { name: 'Ancien projet' })).not.toBeInTheDocument();
});

test('creation uses only the described project and blocks duplicate submits', async () => {
  let finish; createProject.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<ProjectsWorkspace />); fireEvent.click(await screen.findByRole('button', { name: 'projectSimple.new' }));
  fireEvent.change(screen.getByLabelText('projects.form.titleLabel'), { target: { value: '  Rénover la maison  ' } });
  const form = screen.getByRole('form', { name: 'projectSimple.new' }); fireEvent.submit(form); fireEvent.submit(form);
  expect(createProject).toHaveBeenCalledTimes(1); expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rénover la maison', budget: null }));
  expect(createProject.mock.calls[0][0]).not.toHaveProperty('status'); expect(createProject.mock.calls[0][0]).not.toHaveProperty('clientId');
  await act(async () => finish(project(4, 'Rénover la maison')));
  expect(mockNavigate).toHaveBeenCalledWith('/projects/4', { state: { from: '/projects' } });
});

test('editing a coordinated project preserves its work status and assignment when they are not edited', async () => {
  const onSaved = jest.fn();
  render(<ProjectEditor project={{ ...project(3, 'Projet familial'), agentId: 9, coordination: {}, status: 'in_progress', budget: 2500, currency: 'GHS' }} user={{ id: 1, role: 'admin' }} onCancel={jest.fn()} onSaved={onSaved} />);
  fireEvent.change(screen.getByLabelText('projects.form.titleLabel'), { target: { value: 'Projet renommé' } });
  fireEvent.submit(screen.getByRole('form'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const body = updateProject.mock.calls[0][1]; expect(body).not.toHaveProperty('status'); expect(body).not.toHaveProperty('agentId'); expect(body.currency).toBe('GHS');
});

test('the client modification window also checks ownership', () => {
  const item = { ...project(3, 'Projet'), createdAt: new Date().toISOString() };
  expect(canModifyProject(item, { id: 7, role: 'client' })).toBe(true);
  expect(canModifyProject(item, { id: 8, role: 'client' })).toBe(false);
  expect(canModifyProject({ ...item, createdAt: '2020-01-01' }, { id: 7, role: 'client' })).toBe(false);
});

test('a coordinated assignment uses the operational contract instead of updating only the project agent field', async () => {
  api.get.mockResolvedValue({ data: { users: [{ id: 9, firstName: 'Awa', email: 'awa@example.test' }] } });
  const onSaved = jest.fn();
  render(<ProjectEditor project={{ ...project(3, 'Projet familial'), coordination: { executorUserId: null } }} user={{ id: 1, role: 'admin' }} onCancel={jest.fn()} onSaved={onSaved} />);
  await screen.findByRole('option', { name: 'Awa · awa@example.test' });
  fireEvent.change(screen.getByRole('combobox', { name: 'projects.form.agentLabel' }), { target: { value: '9' } });
  fireEvent.submit(screen.getByRole('form'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(updateProject.mock.calls[0][1]).not.toHaveProperty('agentId');
  expect(updateCoordination).toHaveBeenCalledWith(3, { executorUserId: 9, mode: 'manual' }, 'project');
});

test('creation offers regional currencies beyond the legacy currency label list', async () => {
  const onSaved = jest.fn();
  render(<ProjectEditor user={{ id: 7, role: 'client' }} onCancel={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByRole('option', { name: 'currency.GHS', hidden: true })).toHaveValue('GHS');
  fireEvent.change(screen.getByLabelText('projects.form.titleLabel'), { target: { value: 'Projet au Ghana' } });
  fireEvent.change(screen.getByLabelText('financialWorkspace.currency'), { target: { value: 'GHS' } });
  fireEvent.submit(screen.getByRole('form'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GHS' }));
});
