import { render, screen } from '@testing-library/react';
import HelpSupportPage from './HelpSupportPage';
import { getServiceById } from '../services/services';
const mockUser = { id: 7, role: 'client', countryId: 1 };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>, useSearchParams: () => [new URLSearchParams('demande=12')] }), { virtual: true });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser }) }));
jest.mock('../hooks/useTerritorySupport', () => () => ({ phone: '+22370000000' }));
jest.mock('../components/SetSeo', () => () => null);
jest.mock('../services/services', () => ({ getServiceById: jest.fn() }));
jest.mock('../services/missions', () => ({ getMissionTrack: jest.fn() }));

beforeEach(() => { mockUser.role = 'client'; });

test('help for a request in another country uses that request contact', async () => {
  getServiceById.mockResolvedValue({ id: 12, title: 'Service à Abidjan', assistancePhone: '+2250700000000' });
  render(<HelpSupportPage />);
  expect(await screen.findByRole('link', { name: 'requestHelp.call' })).toHaveAttribute('href', 'tel:+2250700000000');
});

test('an inaccessible request never inherits the account country phone', async () => {
  getServiceById.mockRejectedValue(new Error('Forbidden'));
  render(<HelpSupportPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('requestHelp.loadError');
  expect(screen.queryByRole('link', { name: 'requestHelp.call' })).not.toBeInTheDocument();
});

test('the agent can return to assigned work without opening the client-only list', async () => {
  mockUser.role = 'agent';
  getServiceById.mockResolvedValue({ id: 12, assistancePhone: null });
  render(<HelpSupportPage />);
  expect(screen.getByRole('link', { name: 'requestHelp.findRequest' })).toHaveAttribute('href', '/agent/services');
  await screen.findByText('requestHelp.missing');
});
