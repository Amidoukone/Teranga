import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AdminServicesPage from './AdminServicesPage';
import api from '../services/api';
import { me } from '../services/auth';
import { listProviders } from '../services/providers';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/providers', () => ({ listProviders: jest.fn() }));
jest.mock('../services/missions', () => ({ updateMissionAssignment: jest.fn() }));
jest.mock('../services/services', () => ({ updateService: jest.fn() }));
jest.mock('../utils/notify', () => ({ notify: Object.assign(jest.fn(), { success: jest.fn() }) }));
jest.mock('../utils/role', () => ({ normalizeRole: (role) => role, isMasterUser: () => false }));

describe('AdminServicesPage simplifiée', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    me.mockResolvedValue({ user: { id: 1, role: 'admin' } });
    listProviders.mockResolvedValue([]);
    api.get.mockImplementation((url) => {
      if (url === '/users?role=agent') {
        return Promise.resolve({ data: { users: [{ id: 7, firstName: 'Moussa', email: 'moussa@example.com' }] } });
      }
      if (url.startsWith('/services?')) {
        return Promise.resolve({
          data: {
            services: [{
              id: 21,
              title: 'Retirer un document',
              type: 'administrative',
              typeLabel: 'Démarche administrative',
              status: 'created',
              executionType: 'agent',
              agentId: null,
              countryId: null,
              regionId: null,
              client: { firstName: 'Awa', email: 'awa@example.com' },
            }],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });
    api.post.mockResolvedValue({ data: {} });
  });

  test('place les demandes sans intervenant en priorité et les affecte directement', async () => {
    render(<AdminServicesPage />);

    expect(await screen.findByText('serviceAdmin.priorityTitle')).toBeInTheDocument();
    const assignment = screen.getByRole('combobox', { name: 'serviceAdmin.assignWorker' });
    fireEvent.change(assignment, { target: { value: '7' } });

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/services/assign', {
      serviceId: 21,
      agentId: '7',
    }));
    expect(api.get.mock.calls.some(([url]) => url.includes('excludeTradeCategorySlug=mobilite%2Clivraison'))).toBe(true);
  });
});
