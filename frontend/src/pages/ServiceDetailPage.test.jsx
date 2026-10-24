import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ServiceDetailPage from './ServiceDetailPage';
import { me } from '../services/auth';
import { completeService, getServiceById, validateService } from '../services/services';

const mockNavigate = jest.fn();
let mockFrom, mockId = '14';
jest.mock('../features/service-workspace/ServiceStepsPanel', () => ({ serviceId }) => <section aria-label="service-steps" data-service-id={serviceId} />);

jest.mock('../features/mission-tracking/MissionCompletionPanel', () => ({ completion }) => completion?.report ? <section id="completion-report"><p>{completion.report.summary}</p>{completion.report.attachments?.map((file) => <a key={file.id || file.kind} href={file.filePath}>{file.originalName}</a>)}</section> : null);
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: mockId }),
  useLocation: () => ({ pathname: `/services/${mockId}`, state: mockFrom ? { from: mockFrom } : undefined }),
}), { virtual: true });

jest.mock('react-i18next', () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/services', () => ({
  completeService: jest.fn(),
  getServiceById: jest.fn(),
  startService: jest.fn(),
  validateService: jest.fn(),
}));
jest.mock('../utils/role', () => ({ normalizeRole: (role) => role }));
jest.mock('../i18n/useLocale', () => ({
  useLocale: () => ({ formatDate: (value) => value, formatNumber: (value) => String(value) }),
}));

describe('ServiceDetailPage simplifiée', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = undefined; mockId = '14';
    me.mockResolvedValue({ user: { id: 4, role: 'client' } });
    getServiceById.mockResolvedValue({
      id: 14,
      title: 'Démarche administrative',
      type: 'administrative',
      status: 'completed',
      agent: { firstName: 'Moussa', phone: '+22370000000' },
    });
    validateService.mockResolvedValue({ id: 14, status: 'validated' });
  });

  test('permet au client de confirmer un service terminé en une action', async () => {
    render(<ServiceDetailPage />);

    const buttons = await screen.findAllByRole('button', { name: /serviceTracking.actions.validate/ });
    await userEvent.click(buttons[0]);
    await waitFor(() => expect(validateService).toHaveBeenCalledWith('14'));
    expect(await screen.findByText('serviceTracking.success.validate')).toBeInTheDocument();
  });

  test('guide vers le compte rendu avant de proposer une finalisation sans justificatif', async () => {
    me.mockResolvedValue({ user: { id: 7, role: 'agent' } });
    getServiceById.mockResolvedValue({ id: 14, title: 'Document', status: 'in_progress', completion: { required: true, requiredEvidenceTypes: ['photo'], report: { summary: 'Document remis', attachments: [] } } });
    const { unmount } = render(<ServiceDetailPage />);
    userEvent.click((await screen.findAllByRole('button', { name: 'completion.prepare' }))[0]);
    expect(completeService).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'serviceTracking.actions.complete' })).not.toBeInTheDocument();
    unmount();
    getServiceById.mockResolvedValue({ id: 14, title: 'Document', status: 'in_progress', completion: { required: true, requiredEvidenceTypes: ['photo'], report: { summary: 'Document remis', attachments: [{ kind: 'photo' }] } } });
    render(<ServiceDetailPage />);
    expect((await screen.findAllByRole('button', { name: 'serviceTracking.actions.complete' })).length).toBeGreaterThan(0);
  });

  test('a failed background refresh retains the detail until access is actually revoked', async () => {
    render(<ServiceDetailPage />);
    await screen.findByRole('heading', { name: 'Démarche administrative' });
    getServiceById.mockRejectedValueOnce(new Error('Offline'));
    fireEvent.focus(window);
    expect(await screen.findByText('completion.connectionInterrupted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Démarche administrative' })).toBeInTheDocument();
    getServiceById.mockRejectedValueOnce({ response: { status: 403 } });
    fireEvent.focus(window);
    expect(await screen.findByText('serviceDetailPage.errors.forbidden')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Démarche administrative' })).not.toBeInTheDocument();
  });

  test('the report and proof precede a single confirmation action and the return link retains filters', async () => {
    mockFrom = '/demandes?vue=a-verifier&type=service&page=2';
    getServiceById.mockResolvedValue({ id: 14, title: 'Résultat remis', status: 'completed', completion: { report: { summary: 'Compte rendu remis au bénéficiaire', attachments: [{ id: 1, originalName: 'preuve.pdf', filePath: '/uploads/preuve.pdf' }] } } });
    render(<ServiceDetailPage />);
    const proof = await screen.findByRole('link', { name: 'preuve.pdf' });
    const button = screen.getByRole('button', { name: 'serviceTracking.actions.validate' });
    expect(proof.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'serviceDetailPage.backToServices' })).toHaveAttribute('href', mockFrom);
    expect(validateService).not.toHaveBeenCalled();
  });

  test('opening a different case immediately removes the previously loaded case', async () => {
    const view = render(<ServiceDetailPage />);
    await screen.findByRole('heading', { name: 'Démarche administrative' });
    mockId = '15'; getServiceById.mockImplementation(() => new Promise(() => {}));
    view.rerender(<ServiceDetailPage />);
    expect(screen.queryByRole('heading', { name: 'Démarche administrative' })).not.toBeInTheDocument();
    await waitFor(() => expect(getServiceById).toHaveBeenCalledWith('15'));
  });

  test('an administrator following a mission uses the management route', async () => {
    me.mockResolvedValue({ user: { id: 3, role: 'admin' } });
    getServiceById.mockResolvedValue({ id: 14, missionStatus: 'ASSIGNED', tradeCategory: { slug: 'mobilite' } });
    render(<ServiceDetailPage />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/taxi-dispatch?missionId=14', expect.objectContaining({ replace: true })));
  });

  test('an optional legacy handover does not claim that a completion report was already recorded', async () => {
    me.mockResolvedValue({ user: { id: 7, role: 'agent' } });
    getServiceById.mockResolvedValue({ id: 14, title: 'Service historique', status: 'in_progress', completion: null });
    render(<ServiceDetailPage />);
    await screen.findByRole('button', { name: 'serviceTracking.actions.complete' });
    expect(screen.getByText('serviceSteps.handoverHint')).toBeInTheDocument();
    expect(screen.queryByText('requestWorkspace.readyHint')).not.toBeInTheDocument();
  });
});
