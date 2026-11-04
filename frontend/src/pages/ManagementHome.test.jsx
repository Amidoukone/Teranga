import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManagementHome from './ManagementHome';
import { getFinancialSummary } from '../services/transactions';
import { getDashboardSummary } from '../services/dashboard';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
let mockUser = { id: 1, role: 'admin', countryId: 1 };
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => ({ user: mockUser, countryId: 1, regionId: null }) }));
jest.mock('../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String }) }));
jest.mock('../services/dashboard', () => ({ getDashboardSummary: jest.fn() }));
jest.mock('../services/transactions', () => ({ getFinancialSummary: jest.fn() }));

test('management opens operations first and keeps currencies separate', async () => {
  getFinancialSummary.mockClear(); getDashboardSummary.mockClear();
  getFinancialSummary.mockResolvedValue({ byCurrency: [{ currency: 'GHS', revenues: 100, balance: 80 }, { currency: 'GNF', revenues: 900, balance: 700 }] });
  render(<ManagementHome />);
  expect(screen.getByRole('link', { name: 'workspace.openOperations' })).toHaveAttribute('href', '/operations');
  expect(getFinancialSummary).not.toHaveBeenCalled(); expect(getDashboardSummary).not.toHaveBeenCalled();
  userEvent.click(await screen.findByText('workspace.finance'));
  expect(await screen.findByText('80 GHS')).toBeVisible();
  expect(screen.getByText('700 GNF')).toBeVisible();
  expect(screen.queryByText(/XOF/)).not.toBeInTheDocument();
  expect(screen.queryByText('780')).not.toBeInTheDocument();
});

test('unavailable figures do not block the operations queue and transport tools', async () => {
  getDashboardSummary.mockRejectedValueOnce(Error('Offline'));
  render(<ManagementHome />);
  fireEvent.click(screen.getByText('workspace.insights'));
  expect(await screen.findByRole('alert')).toHaveTextContent('workspace.overviewError');
  expect(screen.getByRole('link', { name: 'workspace.openOperations' })).toBeVisible();
  expect(screen.getByRole('link', { name: /nav.taxiOperations/ })).toHaveAttribute('href', '/admin/taxi-dispatch');
});

test('management owns the six tool groups and respects the scoped administrator restrictions', () => {
  render(<ManagementHome />);
  ['operations','network','catalog','quality','finance','configuration'].forEach(group => fireEvent.click(screen.getByText(`nav.sections.${group}`)));
  ['operations','network','catalog','quality','finance','configuration'].forEach((group) => expect(screen.getByRole('navigation', { name: `nav.sections.${group}` })).toBeInTheDocument());
  expect(screen.getByRole('link', { name: 'nav.interventions' })).toHaveAttribute('href', '/tasks');
  expect(screen.queryByRole('link', { name: 'nav.master' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'nav.metrics' })).not.toBeInTheDocument();
});

test('global administration tools remain available in Management', () => {
  mockUser = { id: 2, role: 'admin' };
  render(<ManagementHome />); fireEvent.click(screen.getByText('nav.sections.quality')); fireEvent.click(screen.getByText('nav.sections.configuration'));
  expect(screen.getByRole('link', { name: 'nav.master' })).toHaveAttribute('href', '/admin/onboarding');
  expect(screen.getByRole('link', { name: 'nav.metrics' })).toHaveAttribute('href', '/admin/metrics');
  mockUser = { id: 1, role: 'admin', countryId: 1 };
});
