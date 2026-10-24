import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientHome from './ClientHome';
import { getMyServices } from '../services/services';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../services/services', () => ({ getMyServices: jest.fn() }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatDate: String }) }));
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ countryId: 1, regionId: null }) }));
beforeEach(() => jest.resetAllMocks());

test('the client sees requests awaiting review before active work, without financial modules', async () => {
  getMyServices.mockImplementation(async ({ view }) => ({ items: (view === 'review' ? [
    { id: 1, title: 'Travail à confirmer', status: 'completed' },
  ] : [
    { id: 2, title: 'Service en cours', missionStatus: 'IN_PROGRESS' },
  ]), pagination: { total: 1 } }));
  render(<ClientHome user={{ id: 7, firstName: 'Awa' }} />);
  expect(await screen.findByRole('link', { name: 'clientHome.review' })).toHaveAttribute('href', '/services/1');
  expect(screen.getByText('Service en cours')).toBeInTheDocument();
  expect(screen.queryByText('Ancien service')).not.toBeInTheDocument();
  expect(screen.queryByText('dashboard.finance.title')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'homePage.simpleHero.otherRequest' })).toHaveAttribute('href', '/demandes/nouvelle');
});

test('the review priority uses a filtered total and links to every pending result', async () => {
  getMyServices.mockImplementation(async ({ view }) => view === 'review' ? { items: [{ id: 4, title: 'Ancien résultat', status: 'completed' }], pagination: { total: 8 } } : { items: [], pagination: { total: 0 } });
  render(<ClientHome user={{ id: 7 }} />);
  const review = await screen.findByRole('link', { name: 'clientHome.reviewPriority' });
  expect(review).toHaveClass('btn-primary'); expect(review).toHaveAttribute('href', '#client-review');
  expect(screen.getByRole('link', { name: 'homePage.simpleHero.otherRequest' })).toHaveClass('btn-secondary');
  expect(screen.getByRole('link', { name: 'clientHome.allReview' })).toHaveAttribute('href', '/demandes?vue=a-verifier');
  expect(getMyServices).toHaveBeenCalledWith({ view: 'review', limit: 3, sort: 'createdAt' }, { withPagination: true });
});

test('a failed review request does not mask ongoing work and can be retried', async () => {
  let offline = true;
  getMyServices.mockImplementation(async ({ view }) => {
    if (view === 'review' && offline) throw Error('Offline');
    return { items: view === 'ongoing' ? [{ id: 2, title: 'Toujours accessible', status: 'in_progress' }] : [], pagination: { total: view === 'ongoing' ? 1 : 0 } };
  });
  render(<ClientHome user={{ id: 7 }} />);
  expect(await screen.findByText('Toujours accessible')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('clientHome.reviewError');
  offline = false; fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.retry' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('late results from another account are ignored', async () => {
  const pending = [];
  getMyServices.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const view = render(<ClientHome user={{ id: 7 }} />);
  getMyServices.mockResolvedValue({ items: [], pagination: { total: 0 } });
  view.rerender(<ClientHome user={{ id: 8 }} />);
  await act(async () => { pending.forEach((resolve) => resolve({ items: [{ id: 99, title: 'Ancien compte privé', status: 'completed' }], pagination: { total: 1 } })); });
  expect(screen.queryByText('Ancien compte privé')).not.toBeInTheDocument();
});
