import { render, screen } from '@testing-library/react';
import ClientHome from './ClientHome';
import { getMyServices } from '../services/services';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));

test('the client sees requests awaiting review before active work, without financial modules', async () => {
  getMyServices.mockResolvedValue({ items: [
    { id: 1, title: 'Travail à confirmer', status: 'completed' },
    { id: 2, title: 'Service en cours', missionStatus: 'IN_PROGRESS' },
    { id: 3, title: 'Ancien service', status: 'validated' },
  ], pagination: { total: 3 } });
  render(<ClientHome user={{ id: 7, firstName: 'Awa' }} />);
  expect(await screen.findByRole('link', { name: 'clientHome.review' })).toHaveAttribute('href', '/services/1');
  expect(screen.getByText('Service en cours')).toBeInTheDocument();
  expect(screen.queryByText('Ancien service')).not.toBeInTheDocument();
  expect(screen.queryByText('dashboard.finance.title')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'homePage.simpleHero.otherRequest' })).toHaveAttribute('href', '/demandes/nouvelle');
});
