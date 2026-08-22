import { render, screen } from '@testing-library/react';

import AdminPhoneOrderPage from './AdminPhoneOrderPage';
import { getTradeCategories } from '../services/missionRequests';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/admin/phone-orders' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}), { virtual: true });
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../contexts/GeoContext', () => ({
  useGeo: () => ({ countryId: 1, countries: [], canSelect: false, setCountry: jest.fn(), loading: false }),
}));
jest.mock('../services/missionRequests', () => ({ getTradeCategories: jest.fn() }));
jest.mock('../services/missions', () => ({ createPhoneOrder: jest.fn(), getTaxiDispatchQueue: jest.fn() }));
jest.mock('../features/mission-creation/CategoryPicker', () => ({ tradeCategories }) => (
  <div>{tradeCategories.map((item) => <span key={item.slug}>{item.slug}</span>)}</div>
));
jest.mock('../features/mission-creation/LocationAutocompleteInput', () => () => null);
jest.mock('../features/mission-creation/MissionLocationMap', () => () => null);
jest.mock('../features/mobility/MobilityDispatchPanel', () => () => null);

test('la commande Services par appel masque Taxi et Livraison', async () => {
  getTradeCategories.mockResolvedValue([
    { id: 1, slug: 'mobilite', name: 'MobilitÃ©' },
    { id: 2, slug: 'livraison', name: 'Livraison' },
    { id: 3, slug: 'plomberie', name: 'Plomberie' },
  ]);

  render(<AdminPhoneOrderPage />);

  expect(await screen.findByRole('heading', { name: 'servicePhoneOrder.title' })).toBeInTheDocument();
  expect(await screen.findByText('plomberie')).toBeInTheDocument();
  expect(screen.queryByText('mobilite')).not.toBeInTheDocument();
  expect(screen.queryByText('livraison')).not.toBeInTheDocument();
});
