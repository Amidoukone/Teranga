import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ServiceDetailPage from './ServiceDetailPage';
import { me } from '../services/auth';
import { getServiceById, validateService } from '../services/services';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '14' }),
}), { virtual: true });

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

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
    expect(screen.getByText('serviceTracking.success.validate')).toBeInTheDocument();
  });
});
