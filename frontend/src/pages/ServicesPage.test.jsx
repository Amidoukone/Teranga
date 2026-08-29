import { act, render, screen, waitFor } from '@testing-library/react';

import ServicesPage from './ServicesPage';
import { getMyServices } from '../services/services';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({
  useLocale: () => ({
    formatDate: (value) => value,
    formatNumber: (value) => String(value),
  }),
}));

describe('ServicesPage simplifiée', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMyServices.mockResolvedValue({
      items: [
        { id: 1, title: 'Démarche mairie', type: 'administrative', status: 'created' },
        {
          id: 2,
          title: 'Réparer la plomberie',
          type: 'other',
          status: 'in_progress',
          missionStatus: 'IN_PROGRESS',
          tradeCategory: { name: 'Plomberie', slug: 'plomberie' },
        },
        { id: 3, title: 'Paiement confirmé', type: 'payment', status: 'validated' },
      ],
    });
  });

  test('sépare les demandes actives de l historique et ouvre le bon suivi', async () => {
    render(<ServicesPage />);

    expect(await screen.findByText('Démarche mairie')).toBeInTheDocument();
    expect(screen.getByText('Réparer la plomberie')).toBeInTheDocument();
    expect(screen.getByText('Paiement confirmé')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'serviceOrders.newRequest' })).toHaveAttribute('href', '/services/new');
    const followLinks = screen.getAllByRole('link', { name: 'serviceOrders.follow' });
    expect(followLinks[0]).toHaveAttribute('href', '/services/1');
    expect(followLinks[1]).toHaveAttribute('href', '/missions/2/track');
    expect(screen.getByRole('link', { name: 'serviceOrders.view' })).toHaveAttribute('href', '/services/3');

    await waitFor(() => expect(getMyServices).toHaveBeenCalledWith(
      {
        limit: 100,
        sort: '-createdAt',
        excludeTradeCategorySlug: 'mobilite,livraison',
      },
      { withPagination: true }
    ));
  });

  test('actualise la liste au retour sur l écran', async () => {
    render(<ServicesPage />);
    await screen.findByText('Démarche mairie');
    const callsBeforeFocus = getMyServices.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(getMyServices.mock.calls.length).toBeGreaterThan(callsBeforeFocus));
  });
});
