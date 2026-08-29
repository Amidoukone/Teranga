import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AgentServicesPage from './AgentServicesPage';
import { getAgentServices, startService } from '../services/services';

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
    getAgentServices.mockResolvedValue([
      {
        id: 9,
        title: 'Récupérer un document',
        type: 'administrative',
        status: 'created',
        client: { firstName: 'Awa', phone: '+22370000000' },
      },
    ]);
    startService.mockResolvedValue({ id: 9, status: 'in_progress' });
  });

  test('démarre le service avec le bouton principal', async () => {
    render(<AgentServicesPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'serviceTracking.actions.start' }));
    await waitFor(() => expect(startService).toHaveBeenCalledWith(9));
  });
});
