import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import ServicesPage from './ServicesPage';
import { getMyServices } from '../services/services';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });

jest.mock('react-i18next', () => {
  const t = (key) => key;
  return { useTranslation: () => ({ t }) };
});

jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({
  useLocale: () => ({
    formatDate: (value) => value,
    formatNumber: (value) => String(value),
  }),
}));

describe('ServicesPage unified requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getMyServices.mockResolvedValue({
      items: [
        { id: 1, title: 'City hall errand', type: 'administrative', status: 'created' },
        {
          id: 2,
          title: 'Repair plumbing',
          type: 'other',
          status: 'in_progress',
          missionStatus: 'IN_PROGRESS',
          tradeCategory: { name: 'Plumbing', slug: 'plomberie' },
        },
        { id: 3, title: 'Confirmed payment', type: 'payment', status: 'validated' },
        {
          id: 4,
          title: 'Airport ride',
          status: 'created',
          missionStatus: 'CREATED',
          tradeCategory: { name: 'Mobility', slug: 'mobilite' },
        },
        {
          id: 5,
          title: 'Family parcel',
          status: 'created',
          missionStatus: 'SEARCHING_EXECUTOR',
          tradeCategory: { name: 'Delivery', slug: 'livraison' },
        },
      ],
    });
  });

  test('shows every request family and opens the correct tracking route', async () => {
    render(<ServicesPage />);

    expect(await screen.findByText('City hall errand')).toBeInTheDocument();
    expect(screen.getByText('Airport ride')).toBeInTheDocument();
    expect(screen.getByText('Family parcel')).toBeInTheDocument();

    expect(screen.getAllByRole('link', { name: 'serviceOrders.newRequest' })[0]).toHaveAttribute(
      'href',
      '/demandes/nouvelle'
    );
    expect(screen.getByRole('link', { name: 'serviceOrders.newTaxi' })).toHaveAttribute(
      'href',
      '/demandes/nouvelle?categorie=mobilite'
    );
    expect(screen.getByRole('link', { name: 'serviceOrders.newDelivery' })).toHaveAttribute(
      'href',
      '/demandes/nouvelle?categorie=livraison'
    );
    const followHrefs = screen
      .getAllByRole('link', { name: 'serviceOrders.follow' })
      .map((link) => link.getAttribute('href'));
    expect(followHrefs).toEqual(expect.arrayContaining([
      '/services/1',
      '/missions/2/track',
      '/courses/4',
      '/livraisons/5',
    ]));
    expect(screen.getByRole('link', { name: 'serviceOrders.view' })).toHaveAttribute('href', '/services/3');

    await waitFor(() => expect(getMyServices).toHaveBeenCalledWith(
      {
        limit: 100,
        sort: '-createdAt',
      },
      { withPagination: true }
    ));
  });

  test('filters request families without another API call', async () => {
    render(<ServicesPage />);
    await screen.findByText('Airport ride');

    const callsBeforeFilter = getMyServices.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.filters.taxi (1)' }));

    expect(screen.getByText('Airport ride')).toBeInTheDocument();
    expect(screen.queryByText('City hall errand')).not.toBeInTheDocument();
    expect(screen.queryByText('Family parcel')).not.toBeInTheDocument();
    expect(getMyServices).toHaveBeenCalledTimes(callsBeforeFilter);
  });

  test('refreshes the list when the screen regains focus', async () => {
    render(<ServicesPage />);
    await screen.findByText('City hall errand');
    const callsBeforeFocus = getMyServices.mock.calls.length;
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(getMyServices.mock.calls.length).toBeGreaterThan(callsBeforeFocus));
  });
});
