import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentCoordinationPanel from './AgentCoordinationPanel';
import WorkProgressPanel from './WorkProgressPanel';
import { advanceAssignment, getAgentAssignments, getAgentCapacity, getWorkProgress, updateAgentCapacity } from '../../services/operations';
const mockTranslate = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../../services/operations', () => ({ advanceAssignment: jest.fn(), getAgentAssignments: jest.fn(), getAgentCapacity: jest.fn(), getWorkProgress: jest.fn(), updateAgentCapacity: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  getAgentCapacity.mockResolvedValue({ capacity: { available: false, maxConcurrent: 1 }, activeAssignments: 1 });
  getAgentAssignments.mockResolvedValue([]); updateAgentCapacity.mockResolvedValue({}); advanceAssignment.mockResolvedValue({});
});

test('the agent enables assignment in one action and capacity changes never renew availability', async () => {
  render(<AgentCoordinationPanel />);
  userEvent.click(await screen.findByRole('button', { name: 'fieldWorkspace.goAvailable' }));
  await waitFor(() => expect(updateAgentCapacity).toHaveBeenCalledWith({ available: true, availableMinutes: 60 }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'fieldWorkspace.goAvailable' })).toBeEnabled());
  userEvent.click(screen.getByText('fieldWorkspace.settings'));
  fireEvent.change(screen.getByLabelText('agentCoordination.capacity'), { target: { value: '2' } });
  userEvent.click(screen.getByRole('button', { name: 'operations.save' }));
  await waitFor(() => expect(updateAgentCapacity).toHaveBeenCalledWith({ maxConcurrent: 2 }));
});

test('expired availability requires a new explicit declaration', async () => {
  getAgentCapacity.mockResolvedValue({ capacity: { available: false, availableUntil: '2026-10-23T10:00:00Z', availabilityExpired: true, maxConcurrent: 1 }, activeAssignments: 0 });
  render(<AgentCoordinationPanel />);
  expect(await screen.findByText('agentCoordination.expired')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'fieldWorkspace.goAvailable' })).toBeEnabled();
  expect(updateAgentCapacity).not.toHaveBeenCalled();
  userEvent.selectOptions(screen.getByLabelText('fieldWorkspace.duration'), '30');
  userEvent.click(screen.getByRole('button', { name: 'fieldWorkspace.goAvailable' }));
  await waitFor(() => expect(updateAgentCapacity).toHaveBeenCalledWith({ available: true, availableMinutes: 30 }));
});

test('an assigned order requires a summary and exposes a missing proof response', async () => {
  getAgentAssignments.mockResolvedValue([{ id: 4, code: 'CMD-4', entityType: 'order', status: 'shipped', coordination: {} }]);
  advanceAssignment.mockRejectedValue({ response: { data: { error: 'Justificatif requis' } } });
  render(<AgentCoordinationPanel />);
  fireEvent.change(await screen.findByLabelText('completion.summary'), { target: { value: 'La commande est livrée au destinataire.' } });
  userEvent.click(screen.getByRole('button', { name: 'agentCoordination.actions.delivered' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Justificatif requis');
  expect(advanceAssignment).toHaveBeenCalledWith('order', 4, { status: 'delivered', summary: 'La commande est livrée au destinataire.' });
});

test('the customer can validate a completed project from its detail page', async () => {
  getWorkProgress.mockResolvedValue({ item: { id: 7, title: 'Projet remis', entityType: 'project', status: 'completed', coordination: { policy: { completionReport: { summary: 'Travaux remis avec justificatif.' } } } }, canAdvance: false, canValidate: true });
  const onSaved = jest.fn();
  render(<WorkProgressPanel entityType="project" entityId={7} status="completed" onSaved={onSaved} />);
  userEvent.click(await screen.findByRole('button', { name: 'agentCoordination.actions.validated' }));
  await waitFor(() => expect(advanceAssignment).toHaveBeenCalledWith('project', 7, { status: 'validated' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(screen.getByText('Travaux remis avec justificatif.')).toBeInTheDocument();
});
