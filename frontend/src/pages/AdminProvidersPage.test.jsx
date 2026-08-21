import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminProvidersPage from './AdminProvidersPage';
import { me } from '../services/auth';
import { listProviders, updateProviderStatus } from '../services/providers';
import { listTradeCategoriesAdmin } from '../services/tradeCategories';
import { notify } from '../utils/notify';

const mockNavigate = jest.fn();

jest.mock(
  'react-router-dom',
  () => ({
    Link: ({ children, to }) => <a href={to}>{children}</a>,
    useNavigate: () => mockNavigate,
  }),
  { virtual: true }
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('../utils/role', () => ({
  normalizeRole: (role) => role,
  isMasterUser: () => false,
}));
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../services/users', () => ({ createUser: jest.fn() }));
jest.mock('../services/providers', () => ({
  listProviders: jest.fn(),
  createProvider: jest.fn(),
  updateProviderStatus: jest.fn(),
}));
jest.mock('../services/tradeCategories', () => ({
  listTradeCategoriesAdmin: jest.fn(),
}));
jest.mock('../utils/notify', () => ({
  notify: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  me.mockResolvedValue({ user: { id: 1, role: 'admin' } });
  listTradeCategoriesAdmin.mockResolvedValue([
    { id: 7, slug: 'mobilite', name: 'Mobilite', isActive: true },
  ]);
  listProviders.mockResolvedValue([
    {
      id: 42,
      type: 'independent',
      displayFirstName: 'Awa',
      status: 'probation',
      availabilityStatus: 'offline',
      tradeCategories: [{ id: 7, slug: 'mobilite', name: 'Mobilite' }],
      mobilityCompliance: {
        driverEligible: false,
        hasEligibleVehicle: false,
      },
      user: { email: 'awa@example.test' },
    },
  ]);
});

test('active le compte chauffeur et explique que les courses restent bloquees', async () => {
  updateProviderStatus.mockResolvedValue({
    provider: { id: 42, status: 'active', availabilityStatus: 'offline' },
    mobilityActivation: {
      accountActive: true,
      dispatchReady: false,
      compliance: { driverEligible: false, hasEligibleVehicle: false },
    },
  });

  render(<AdminProvidersPage />);

  expect(
    await screen.findByText('adminProvidersPage.mobilityState.pending')
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'adminProvidersPage.actions.toActive' })
  );

  await waitFor(() =>
    expect(updateProviderStatus).toHaveBeenCalledWith(42, 'active')
  );
  expect(notify.success).toHaveBeenCalledWith(
    'adminProvidersPage.alerts.accountActivatedPendingCompliance'
  );
});
