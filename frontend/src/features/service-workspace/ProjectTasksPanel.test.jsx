import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectTasksPanel from './ProjectTasksPanel';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('react-i18next', () => { const t = (key) => key; return { useTranslation: () => ({ t }) }; });
jest.mock('react-router-dom', () => ({ Link: ({ to, state, children, ...props }) => <a href={to} {...props}>{children}</a>, useLocation: () => ({ pathname: '/projects/14', search: '' }) }), { virtual: true });
beforeEach(() => { jest.clearAllMocks(); });
test('project steps are optional and an empty project does not display an artificial task list', async () => {
  api.get.mockResolvedValue({ data: { tasks: [], pagination: { total: 0 } } });
  render(<ProjectTasksPanel projectId={14} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/tasks', { params: { projectId: 14, workspace: true, page: 1, limit: 20 } }));
  expect(screen.queryByText('dossier.projectTasks')).not.toBeInTheDocument();
});
test('project steps paginate on the server and open the limited task workspace', async () => {
  api.get.mockResolvedValueOnce({ data: { tasks: [{ id: 29, projectId: 14, title: 'Inspection', status: 'created' }], pagination: { total: 21 } } });
  render(<ProjectTasksPanel projectId={14} />);
  fireEvent.click(await screen.findByText(/dossier.projectTasks \(/, { selector: 'summary' }));
  expect(screen.getByRole('link', { name: 'dossier.openStep' })).toHaveAttribute('href', '/tasks/29');
  api.get.mockResolvedValueOnce({ data: { tasks: [{ id: 30, projectId: 14, title: 'Relevé', status: 'validated' }], pagination: { total: 21 } } });
  fireEvent.click(screen.getByRole('button', { name: 'pagination.next' }));
  await screen.findByRole('heading', { name: 'Relevé' });
  expect(api.get).toHaveBeenLastCalledWith('/tasks', { params: { projectId: 14, workspace: true, page: 2, limit: 20 } });
});
test('a failed task read is displayed as an error instead of an empty project', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  render(<ProjectTasksPanel projectId={14} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('dossier.loadError');
});

test('an incompatible server response cannot show another project steps inside this case', async () => {
  api.get.mockResolvedValue({ data: { tasks: [{ id: 29, projectId: 15, title: 'Autre projet' }], pagination: { total: 1 } } });
  render(<ProjectTasksPanel projectId={14} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: 'Autre projet' })).not.toBeInTheDocument();
});
