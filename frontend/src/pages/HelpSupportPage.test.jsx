import { render, screen } from '@testing-library/react';
import HelpSupportPage from './HelpSupportPage';
import { getServiceById } from '../services/services';
import { getMissionTrack } from '../services/missions';
const mockUser = { id: 7, role: 'client', countryId: 1 };
let mockSearch = 'demande=12';
let mockLocation = { state: null };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, state, ...props }) => <a href={to} data-return-from={state?.from} {...props}>{children}</a>, useLocation: () => mockLocation, useSearchParams: () => [new URLSearchParams(mockSearch)] }), { virtual: true });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser }) }));
jest.mock('../hooks/useTerritorySupport', () => () => ({ phone: '+22370000000' }));
jest.mock('../components/SetSeo', () => () => null);
jest.mock('../services/services', () => ({ getServiceById: jest.fn() }));
jest.mock('../services/missions', () => ({ getMissionTrack: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); mockUser.role = 'client'; mockSearch = 'demande=12'; mockLocation = { state: null }; });

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
  expect(screen.getByRole('link', { name: 'roleViews.agentServices' })).toHaveAttribute('href', '/agent/services');
  await screen.findByText('requestHelp.missing');
});

test('provider assistance uses the mission territory and returns to interventions', async () => {
  mockUser.role = 'provider';
  getMissionTrack.mockResolvedValue({ title: 'Travail confié', assistancePhone: '+2250700000000' });
  render(<HelpSupportPage />);
  expect(await screen.findByRole('link', { name: 'requestHelp.call' })).toHaveAttribute('href', 'tel:+2250700000000');
  expect(screen.getByRole('link', { name: 'providerWorkspace.title' })).toHaveAttribute('href', '/prestataire/interventions');
  expect(getServiceById).not.toHaveBeenCalled();
});

test('mission assistance preserves the exact dossier and its filtered list return', async () => {
  mockSearch = 'demande=12&suivi=mission';
  mockLocation = { state: { dossierFrom: '/livraisons/12?section=suivi#report', dossierState: { from: '/demandes?type=delivery&q=colis&page=2' } } };
  getMissionTrack.mockResolvedValue({ title: 'Colis à remettre', assistancePhone: '+22370000001' });
  render(<HelpSupportPage />);
  await screen.findByRole('link', { name: 'requestHelp.call' });
  const back = screen.getByRole('link', { name: 'roleViews.backDossier' });
  expect(back).toHaveAttribute('href', '/livraisons/12?section=suivi#report');
  expect(back).toHaveAttribute('data-return-from', '/demandes?type=delivery&q=colis&page=2');
  expect(getMissionTrack).toHaveBeenCalledWith('12', { skipEta: 1 });
  expect(getServiceById).not.toHaveBeenCalled();
});

test.each(['https://example.com/services/12', '//example.com/services/12', '/services/99', '/admin/users', '/services/12\\evil'])('assistance rejects an unrelated or external dossier return: %s', async value => {
  mockLocation = { state: { dossierFrom: value } };
  getServiceById.mockResolvedValue({ id: 12, assistancePhone: null });
  render(<HelpSupportPage />);
  await screen.findByText('requestHelp.missing');
  expect(screen.queryByRole('link', { name: 'roleViews.backDossier' })).not.toBeInTheDocument();
});
