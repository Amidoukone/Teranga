import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { me } from '../services/auth';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children }) => <a href="/help-support">{children}</a> }), { virtual: true });
jest.mock('../services/auth', () => ({ me: jest.fn() }));
jest.mock('../utils/role', () => ({ normalizeRole: (role) => role }));
jest.mock('./ClientHome', () => () => <div>Espace client</div>);
jest.mock('./AgentServicesPage', () => () => <div>Espace agent</div>);
jest.mock('./MyMissionsPage', () => () => <div>Espace prestataire</div>);
jest.mock('./ManagementHome', () => () => <div>Espace responsable</div>);

test.each([['client', 'client'], ['agent', 'agent'], ['provider', 'prestataire'], ['admin', 'responsable']])('the verified %s account opens its own workspace', async (role, label) => {
  me.mockResolvedValue({ user: { id: 1, role } });
  render(<DashboardPage />);
  expect(await screen.findByText(`Espace ${label}`)).toBeInTheDocument();
});
