import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinancialWorkspace from './FinancialWorkspace';
import { me } from '../../services/auth';
import { getServiceById } from '../../services/services';
import { getOrderById } from '../../services/orders';
import { getProjectById } from '../../services/projects';
import api from '../../services/api';
import { createTransaction, getTransactionsWithMeta, updateTransaction } from '../../services/transactions';

const mockTranslate = (key) => key;
let mockId = '14', mockParams = '', mockGeo = { user: { id: 4, role: 'admin' }, countryId: 1 };
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate }) }));
jest.mock('../../i18n', () => ({ t: (key, values) => values?.defaultValue || key }));
jest.mock('../../i18n/useLocale', () => ({ useLocale: () => ({ formatNumber: String, formatDate: String }) }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, state, ...props }) => <a href={to} {...props}>{children}</a>, useParams: () => ({ id: mockId }), useLocation: () => ({ pathname: '/transactions', search: '' }),
  Navigate: ({ to }) => <a href={to}>Task financial scope</a>,
  useSearchParams: () => { const React = require('react'); return React.useState(() => new URLSearchParams(mockParams)); },
}), { virtual: true });
jest.mock('../../contexts/GeoContext', () => ({ useGeo: () => mockGeo }));
jest.mock('../../hooks/useDeleteConfirm', () => ({ useDeleteConfirm: () => ({ confirmDelete: jest.fn() }) }));
jest.mock('../../services/auth', () => ({ me: jest.fn() }));
jest.mock('../../services/services', () => ({ getServiceById: jest.fn() }));
jest.mock('../../services/orders', () => ({ getOrderById: jest.fn() }));
jest.mock('../../services/projects', () => ({ getProjectById: jest.fn() }));
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../services/transactions', () => ({ getTransactionsWithMeta: jest.fn(), createTransaction: jest.fn(), updateTransaction: jest.fn(), deleteTransaction: jest.fn() }));
jest.mock('../../pages/FinanceDashboardPage', () => () => <p>Statement only</p>);

const row = (id, description) => ({ id, description, amount: 25, currency: 'GHS', type: 'expense', status: 'completed' });
const page = (items = [], total = items.length) => ({ items, pagination: { total, limit: 20 } });
beforeEach(() => {
  jest.clearAllMocks(); mockId = '14'; mockParams = ''; mockGeo = { user: { id: 4, role: 'admin' }, countryId: 1 };
  me.mockResolvedValue({ user: mockGeo.user });
  getServiceById.mockResolvedValue({ id: 14, title: 'Service Accra', currency: 'GHS', countryId: 2 });
  getOrderById.mockResolvedValue({ id: 14, code: 'CMD-14', currency: 'GHS' });
  getProjectById.mockResolvedValue({ id: 14, title: 'Projet Accra', currency: 'GHS', agentId: 4 });
  getTransactionsWithMeta.mockResolvedValue(page()); createTransaction.mockResolvedValue({ id: 1 }); updateTransaction.mockResolvedValue({ id: 1 });
});

test('the journal uses server pagination and search without eagerly fetching service lists', async () => {
  getTransactionsWithMeta.mockResolvedValueOnce(page([row(1, 'Première page')], 41)).mockResolvedValueOnce(page([row(21, 'Deuxième page')], 41)).mockResolvedValue(page([row(25, 'Reçu retrouvé')], 1));
  render(<FinancialWorkspace />);
  await screen.findByText('Première page');
  userEvent.click(screen.getByRole('button', { name: 'pagination.next' }));
  await screen.findByText('Deuxième page');
  expect(getTransactionsWithMeta).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, limit: 20, includeCount: true }));
  userEvent.type(screen.getByRole('textbox', { name: 'financialWorkspace.search' }), 'Reçu');
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.find' }));
  await screen.findByText('Reçu retrouvé');
  expect(getTransactionsWithMeta).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: 'Reçu' }));
  expect(getServiceById).not.toHaveBeenCalled();
});

test.each(['service', 'order', 'project'])('%s context clears inherited geographic filters and keeps its currency', async (kind) => {
  render(<FinancialWorkspace kind={kind} />);
  userEvent.click(await screen.findByRole('button', { name: 'financialWorkspace.add' }));
  expect(getTransactionsWithMeta).toHaveBeenLastCalledWith(expect.objectContaining({ [`${kind}Id`]: 14, countryId: null, regionId: null }));
  expect(screen.getByRole('option', { name: 'financialWorkspace.inheritedCurrency (GHS)' }).selected).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'financialWorkspace.amount' }), { target: { value: '25,50' } });
  if (kind === 'service') userEvent.upload(screen.getByLabelText('financialWorkspace.proof'), new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }));
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.save' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ [`${kind}Id`]: 14, amount: '25.50', currency: undefined })));
  await screen.findByText('financialWorkspace.saved');
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.add' }));
  expect(screen.getByRole('option', { name: 'financialWorkspace.inheritedCurrency (GHS)' }).selected).toBe(true);
});

test('an inaccessible dossier exposes retry and does not expose a form or unrelated entries', async () => {
  getServiceById.mockRejectedValue({ response: { status: 403 } });
  render(<FinancialWorkspace kind="service" />);
  await screen.findByRole('alert');
  expect(getTransactionsWithMeta).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'financialWorkspace.add' })).not.toBeInTheDocument();
});

test('a read outage keeps loaded entries and the form draft; revocation removes both', async () => {
  getTransactionsWithMeta.mockResolvedValue(page([row(1, 'Écriture existante')]));
  render(<FinancialWorkspace kind="project" />);
  await screen.findByText('Écriture existante'); userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.add' }));
  userEvent.type(screen.getByRole('textbox', { name: 'financialWorkspace.amount' }), '75');
  getTransactionsWithMeta.mockRejectedValueOnce(new Error('offline'));
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.refresh' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Écriture existante')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'financialWorkspace.amount' })).toHaveValue('75');
  getTransactionsWithMeta.mockRejectedValueOnce({ response: { status: 403 } });
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.refresh' }));
  await waitFor(() => expect(screen.queryByText('Écriture existante')).not.toBeInTheDocument());
  expect(screen.queryByRole('textbox', { name: 'financialWorkspace.amount' })).not.toBeInTheDocument();
});

test('a previous dossier response cannot replace the current dossier', async () => {
  let finish;
  getTransactionsWithMeta.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValue(page([row(2, 'Dossier actuel')]));
  const view = render(<FinancialWorkspace kind="project" />);
  await waitFor(() => expect(getTransactionsWithMeta).toHaveBeenCalledTimes(1));
  mockId = '15'; view.rerender(<FinancialWorkspace kind="project" />);
  await screen.findByText('Dossier actuel');
  await act(async () => finish(page([row(1, 'Ancien dossier')])));
  expect(screen.queryByText('Ancien dossier')).not.toBeInTheDocument();
});

test('a client can record an order payment but cannot create a service expense', async () => {
  me.mockResolvedValue({ user: { id: 4, role: 'client' } });
  const view = render(<FinancialWorkspace kind="service" />);
  await waitFor(() => expect(getTransactionsWithMeta).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'financialWorkspace.add' })).not.toBeInTheDocument();
  view.unmount(); render(<FinancialWorkspace kind="order" />);
  expect(await screen.findByRole('button', { name: 'financialWorkspace.add' })).toBeInTheDocument();
});

test('a non-admin completing a receipt never submits protected financial fields', async () => {
  me.mockResolvedValue({ user: { id: 4, role: 'client' } });
  getTransactionsWithMeta.mockResolvedValue(page([row(1, 'Paiement du client')]));
  render(<FinancialWorkspace />);
  userEvent.click(await screen.findByRole('button', { name: 'financialWorkspace.attach' }));
  userEvent.type(screen.getByLabelText('financialWorkspace.method'), 'Espèces');
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.save' }));
  await waitFor(() => expect(updateTransaction).toHaveBeenCalledWith(1, { description: 'Paiement du client', paymentMethod: 'Espèces', proofFile: null }));
});

test('the bilan tab does not load journal pages', async () => {
  mockParams = 'vue=bilan';
  render(<FinancialWorkspace />);
  await screen.findByText('Statement only');
  expect(getTransactionsWithMeta).not.toHaveBeenCalled();
});

test('a signed adjustment preserves its negative amount', async () => {
  render(<FinancialWorkspace kind="project" />);
  userEvent.click(await screen.findByRole('button', { name: 'financialWorkspace.add' }));
  userEvent.selectOptions(within(screen.getByRole('form', { name: 'financialWorkspace.add' })).getByRole('combobox', { name: 'financialWorkspace.type' }), 'adjustment');
  fireEvent.change(screen.getByRole('textbox', { name: 'financialWorkspace.amount' }), { target: { value: '-25,50' } });
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.save' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'adjustment', amount: '-25.50' })));
});

test('a legacy finance link on an inaccessible service falls back only to its authorized step', async () => {
  mockParams = 'taskId=29';
  getServiceById.mockRejectedValue({ response: { status: 403 } });
  api.get.mockResolvedValue({ data: { task: { id: 29, serviceId: 14 } } });
  render(<FinancialWorkspace kind="service" />);
  expect(await screen.findByRole('link', { name: 'Task financial scope' })).toHaveAttribute('href', '/transactions?taskId=29');
  expect(getTransactionsWithMeta).not.toHaveBeenCalled();
});

test('the project form preserves its existing ability to record a signed amount', async () => {
  render(<FinancialWorkspace kind="project" />);
  userEvent.click(await screen.findByRole('button', { name: 'financialWorkspace.add' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'financialWorkspace.amount' }), { target: { value: '-10' } });
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.save' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense', projectId: 14, amount: '-10' })));
});

test('embedded payments use their own reference and filters without consuming dossier parameters', async () => {
  mockId = '99'; mockParams = 'q=phase&page=4&paiements_q=reçu&paiements_page=2';
  getTransactionsWithMeta.mockResolvedValue(page([row(21, 'Reçu du dossier')], 45));
  render(<FinancialWorkspace kind="order" reference="14" embedded />);
  await screen.findByText('Reçu du dossier');
  expect(getOrderById).toHaveBeenCalledWith('14');
  expect(getTransactionsWithMeta).toHaveBeenLastCalledWith(expect.objectContaining({ orderId: 14, q: 'reçu', page: 2 }));
  expect(screen.queryByRole('link', { name: 'financialWorkspace.backCase' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.recordPayment' }));
  userEvent.type(screen.getByRole('textbox', { name: 'financialWorkspace.amount' }), '7500');
  userEvent.click(screen.getByRole('button', { name: 'financialWorkspace.save' }));
  await waitFor(() => expect(createTransaction).toHaveBeenCalledWith(expect.objectContaining({ orderId: 14, amount: '7500' })));
});
