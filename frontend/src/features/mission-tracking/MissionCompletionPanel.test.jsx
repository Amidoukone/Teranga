import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MissionCompletionPanel from './MissionCompletionPanel';
import { submitMissionCompletion } from '../../services/missions';
const mockTranslate = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../../services/missions', () => ({ submitMissionCompletion: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); window.__TERANGA_FILE_BASE_URL = 'https://api.example.com'; });
afterEach(() => { delete window.__TERANGA_FILE_BASE_URL; });
test('a failed report submission keeps its draft and reuses its submission reference on retry', async () => {
  submitMissionCompletion.mockRejectedValueOnce({ response: { data: { error: 'Connexion interrompue' } } });
  submitMissionCompletion.mockResolvedValueOnce({});
  render(<MissionCompletionPanel missionId={4} completion={{ required: true, requiredEvidenceTypes: ['document'] }} canSubmit onSaved={jest.fn()} />);
  userEvent.type(screen.getByLabelText('completion.summary'), 'Le travail a été réalisé et les résultats vérifiés avec le bénéficiaire.');
  userEvent.click(screen.getByRole('button', { name: 'completion.save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connexion interrompue');
  const firstKey = submitMissionCompletion.mock.calls[0][1].requestKey;
  userEvent.click(screen.getByRole('button', { name: 'completion.save' }));
  await waitFor(() => expect(submitMissionCompletion).toHaveBeenCalledTimes(2));
  expect(submitMissionCompletion.mock.calls[1][1].requestKey).toBe(firstKey);
  expect(await screen.findByRole('status')).toHaveTextContent('completion.saved');
});
test('the customer can review the submitted report and supporting document', () => {
  render(<MissionCompletionPanel missionId={4} completion={{ report: { summary: 'Résultat de la prestation', attachments: [{ id: 1, originalName: 'rapport.pdf', filePath: '/uploads/mission-completions/report.pdf' }] } }} canSubmit={false} />);
  expect(screen.getByText('Résultat de la prestation')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'rapport.pdf' })).toHaveAttribute('href', 'https://api.example.com/uploads/mission-completions/report.pdf');
  expect(screen.queryByRole('button', { name: 'completion.save' })).not.toBeInTheDocument();
});

test('a delayed upload freezes its content and prevents duplicate submissions', async () => {
  let resolveSave;
  submitMissionCompletion.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
  render(<MissionCompletionPanel missionId={4} completion={{ required: true }} canSubmit />);
  userEvent.type(screen.getByLabelText('completion.summary'), 'Les documents sont remis au bénéficiaire.');
  userEvent.click(screen.getByRole('button', { name: 'completion.save' }));
  expect(screen.getByLabelText('completion.summary')).toBeDisabled();
  expect(screen.getByLabelText('completion.files')).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: 'operations.saving' }));
  expect(submitMissionCompletion).toHaveBeenCalledTimes(1);
  await act(async () => resolveSave({}));
  expect(screen.getByLabelText('completion.summary')).toBeEnabled();
});
