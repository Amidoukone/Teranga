import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AgentServicesPage from './AgentServicesPage';
import { getAgentServices, startService } from '../services/services';

jest.mock('../features/mission-tracking/AgentCoordinationPanel', () => () => null);
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../services/services', () => ({
  completeService: jest.fn(),
  getAgentServices: jest.fn(),
  startService: jest.fn(),
}));
jest.mock('../i18n/useLocale', () => ({
  useLocale: () => ({ formatDate: (value) => value, formatNumber: (value) => String(value) }),
}));

describe('AgentServicesPage simplifiée', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAgentServices.mockResolvedValue({ items: [
      {
        id: 9,
        title: 'Récupérer un document',
        type: 'administrative',
        status: 'created',
        client: { firstName: 'Awa', phone: '+22370000000' },
      },
    ], pagination: { total: 1 } });
    startService.mockResolvedValue({ id: 9, status: 'in_progress' });
  });

  test('démarre le service avec le bouton principal', async () => {
    render(<AgentServicesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'serviceTracking.actions.start' }));
    await waitFor(() => expect(startService).toHaveBeenCalledWith(9));
  });

  test('ouvre la remise au client et charge toutes les pages sans mélanger les archives', async () => {
    getAgentServices.mockResolvedValue({ items: [{ id: 9, title: 'Document à remettre', status: 'in_progress' }], pagination: { total: 26 } });
    render(<AgentServicesPage />);
    expect(await screen.findByRole('link', { name: 'completion.prepare' })).toHaveAttribute('href', '/services/9#completion-report');
    userEvent.click(screen.getByRole('button', { name: 'operations.next' }));
    await waitFor(() => expect(getAgentServices).toHaveBeenCalledWith({ view: 'active', offset: 25, limit: 25 }, { withPagination: true }));
    userEvent.click(screen.getByRole('button', { name: 'fieldWorkspace.showHistory' }));
    await waitFor(() => expect(getAgentServices).toHaveBeenCalledWith({ view: 'history', offset: 0, limit: 25 }, { withPagination: true }));
  });
});
