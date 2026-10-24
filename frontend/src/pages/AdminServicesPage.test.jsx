import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AdminServicesPage from './AdminServicesPage';
import api from '../services/api';
import { me } from '../services/auth';
import { listProviders } from '../services/providers';

const mockNavigate = jest.fn();
let mockSearch = '';
const mockTranslate = (key) => key;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate, useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()], Link: ({ to, children }) => <a href={to}>{children}</a> }), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
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
    mockSearch = '';
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

  test('a focused coordination link requests only that service', async () => {
    mockSearch = '?demande=21';
    render(<AdminServicesPage />);
    expect(await screen.findByText('coordinationWorkspace.focusedAssignment')).toBeInTheDocument();
    await waitFor(() => expect(api.get.mock.calls.some(([url]) => url.startsWith('/services?') && new URLSearchParams(url.split('?')[1]).get('id') === '21')).toBe(true));
    expect(screen.getByRole('link', { name: 'operations.title' })).toHaveAttribute('href', '/operations?vue=coordonner&type=service&demande=21');
  });

  test('ne propose que les chauffeurs pour une course taxi', async () => {
    listProviders.mockResolvedValue([
      {
        id: 12,
        displayFirstName: 'Awa',
        countryCode: 'ML',
        tradeCategories: [{ id: 4, slug: 'mobilite' }],
        mobilityCompliance: {
          driverEligible: true,
          vehicles: [{ id: 31, vehicleType: 'motorcycle', eligible: true }],
        },
        dispatchPresence: { isFresh: true, vehicleId: 31 },
      },
    ]);
    api.get.mockImplementation((url) => {
      if (url.startsWith('/services?')) {
        return Promise.resolve({
          data: {
            services: [
              {
                id: 44,
                title: 'Course moto',
                type: 'other',
                status: 'created',
                executionType: 'provider',
                providerId: null,
                agentId: null,
                countryId: null,
                regionId: null,
                tradeCategoryId: 4,
                tradeCategory: { id: 4, slug: 'mobilite', name: 'Mobilite' },
                missionStatus: 'CREATED',
                requestedVehicleType: 'motorcycle',
                client: { firstName: 'Awa', email: 'awa@example.com' },
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    render(<AdminServicesPage tradeCategorySlug="mobilite" />);

    expect(
      await screen.findByRole('option', {
        name: 'adminServicesPage.assign.driverPlaceholder',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('adminServicesPage.table.headers.driver')).toBeInTheDocument();
    expect(screen.queryByText('adminServicesPage.table.headers.agent')).not.toBeInTheDocument();
    expect(screen.queryByText('adminServicesPage.assign.supervisorPlaceholder')).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === '/users?role=agent')).toBe(false);
  });
});
