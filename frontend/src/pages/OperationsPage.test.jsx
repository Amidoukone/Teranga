import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OperationsPage from './OperationsPage';
import { getAssignableAgents, getFieldReadiness, getOperatingCatalog, getOperations, updateCoordination, updateOperatingOffer } from '../services/operations';
let mockScope = { countryId: 1, regionId: null };
const mockTranslate = (key) => key;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockTranslate, i18n: { language: 'fr' } }) }));
jest.mock('react-router-dom', () => ({ Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }), { virtual: true });
jest.mock('../contexts/GeoContext', () => ({ useGeo: () => mockScope }));
jest.mock('../services/auth', () => ({ getLocalUser: () => ({ id: 10, role: 'admin' }) }));
jest.mock('../services/operations', () => ({ getAssignableAgents: jest.fn(), getFieldReadiness: jest.fn(), getOperatingCatalog: jest.fn(), getOperations: jest.fn(), updateCoordination: jest.fn(), updateOperatingOffer: jest.fn() }));
const view = () => <OperationsPage />;
beforeEach(() => {
  jest.resetAllMocks(); mockScope = { countryId: 1, regionId: null };
  getOperations.mockResolvedValue({ items: [], pagination: { total: 0 } });
  getOperatingCatalog.mockResolvedValue([]);
  getAssignableAgents.mockResolvedValue([]);
  getFieldReadiness.mockResolvedValue({ ready: false, issues: [{ code: 'ASSISTANCE_MISSING', message: 'Assistance à renseigner' }] });
  updateCoordination.mockResolvedValue({}); updateOperatingOffer.mockResolvedValue({});
});

test('switching to orders uses the typed coordination API even when identifiers overlap', async () => {
  getOperations.mockImplementation(({ entityType }) => Promise.resolve({ items: [{ id: 3, title: entityType === 'order' ? 'Commande locale' : 'Service local', status: 'created' }], pagination: { total: 1 } }));
  render(view());
  await screen.findByText(/Service local/);
  fireEvent.change(screen.getByLabelText('operations.entityType'), { target: { value: 'order' } });
  await screen.findByText(/Commande locale/);
  userEvent.click(screen.getByRole('button', { name: 'operations.takeOwnership' }));
  await waitFor(() => expect(updateCoordination).toHaveBeenCalledWith(3, { mode: 'manual', ownerUserId: 10 }, 'order'));
});

test('changing only a deadline preserves an active automatic search', async () => {
  getOperations.mockResolvedValue({ items: [{ id: 8, title: 'Commande en recherche', status: 'created', coordination: { mode: 'automatic', state: 'waiting', executorUserId: null, policy: { stageMinutes: 60 } } }], pagination: { total: 1 } });
  render(view());
  fireEvent.change(await screen.findByLabelText('operations.entityType'), { target: { value: 'order' } });
  fireEvent.change(await screen.findByLabelText('operations.sla'), { target: { value: '120' } });
  userEvent.click(screen.getByRole('button', { name: 'operations.save' }));
  await waitFor(() => expect(updateCoordination).toHaveBeenCalledWith(8, { policy: { stageMinutes: 120 } }, 'order'));
});
test('the queue displays preparation blockers and lets the operator take responsibility', async () => {
  getOperations.mockResolvedValue({ items: [{ id: 3, title: 'Vérifier une livraison', executionType: 'provider', missionStatus: 'CREATED' }], pagination: { total: 1 } });
  render(view());
  expect(await screen.findByText('Assistance à renseigner')).toBeInTheDocument();
  userEvent.click(await screen.findByRole('button', { name: 'operations.takeOwnership' }));
  await waitFor(() => expect(updateCoordination).toHaveBeenCalledWith(3, { mode: 'manual', ownerUserId: 10 }));
});

test('readiness distinguishes technical configuration from automatic offering coverage', async () => {
  getFieldReadiness.mockResolvedValue({ ready: true, activeOffers: 7, automation: { enabledOffers: 2, manualOffers: 5, availableAgents: 1 }, issues: [] });
  render(view());
  expect(await screen.findByText('operations.configurationReady')).toBeInTheDocument();
  expect(screen.getByText('operations.automationCoverage')).toBeInTheDocument();
});
test('a late response from the old territory cannot replace the new queue', async () => {
  let resolveOld;
  getOperations.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const { rerender } = render(view());
  await waitFor(() => expect(getOperations).toHaveBeenCalledTimes(1));
  mockScope = { countryId: 2, regionId: null };
  getOperations.mockResolvedValue({ items: [{ id: 2, title: 'Demande du second pays' }], pagination: { total: 1 } });
  rerender(view());
  expect(await screen.findByText(/Demande du second pays/)).toBeInTheDocument();
  await act(async () => resolveOld({ items: [{ id: 1, title: 'Ancienne demande' }], pagination: { total: 1 } }));
  expect(screen.queryByText(/Ancienne demande/)).not.toBeInTheDocument();
});
test('an operator can configure the local outcome, deadline, evidence and automatic search', async () => {
  getOperatingCatalog.mockResolvedValue([{ id: 7, definition: { name: 'Vérification', legacyTradeCategoryId: 3 }, territory: { name: 'Zone pilote' }, offering: { slaMinutes: 60, providerRules: { serviceOutcome: 'Compte rendu détaillé pour le client', coordination: { enabled: false } } } }]);
  render(view());
  const enabled = await screen.findByRole('checkbox', { name: 'operations.enableAutomatic' });
  userEvent.click(enabled);
  fireEvent.change(screen.getByLabelText('operations.sla'), { target: { value: '90' } });
  userEvent.click(screen.getByRole('checkbox', { name: 'operations.evidence.document' }));
  userEvent.click(screen.getByRole('button', { name: 'operations.save' }));
  await waitFor(() => expect(updateOperatingOffer).toHaveBeenCalledWith(7, expect.objectContaining({ slaMinutes: 90, providerRules: expect.objectContaining({ requiredEvidenceTypes: ['document'], coordination: expect.objectContaining({ enabled: true }) }) })));
});

test('an incomplete offering can be suspended without submitting blank required settings', async () => {
  getOperatingCatalog.mockResolvedValue([{ id: 1, definition: { name: 'Electricity', legacyTradeCategoryId: 3 }, territory: { name: 'Mali' }, offering: { isActive: true, slaMinutes: null, providerRules: null } }]);
  render(view());
  userEvent.click(await screen.findByRole('button', { name: 'operations.suspendOffer' }));
  await waitFor(() => expect(updateOperatingOffer).toHaveBeenCalledWith(1, { isActive: false }));
  expect(await screen.findByText('operations.offerSuspended')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'operations.reopenOffer' })).toBeInTheDocument();
  expect(screen.getByLabelText('operations.outcome')).toHaveValue('');
});

test('reopening a suspended offering preserves its execution settings', async () => {
  getOperatingCatalog.mockResolvedValue([{ id: 1, definition: { name: 'Electricity', legacyTradeCategoryId: 3 }, territory: { name: 'Mali' }, offering: { isActive: false, slaMinutes: 120, providerRules: { serviceOutcome: 'Intervention and report agreed with the client' } } }]);
  render(view());
  userEvent.click(await screen.findByRole('button', { name: 'operations.reopenOffer' }));
  await waitFor(() => expect(updateOperatingOffer).toHaveBeenCalledWith(1, { isActive: true }));
  expect(await screen.findByText('operations.offerReopened')).toBeInTheDocument();
  expect(screen.getByLabelText('operations.sla')).toHaveValue(120);
});

test('a failed suspension preserves the current availability and displays the error', async () => {
  getOperatingCatalog.mockResolvedValue([{ id: 1, definition: { name: 'Electricity' }, territory: { name: 'Mali' }, offering: { isActive: true } }]);
  updateOperatingOffer.mockRejectedValue({ response: { data: { error: 'Offer outside your territory' } } });
  render(view());
  userEvent.click(await screen.findByRole('button', { name: 'operations.suspendOffer' }));
  expect(await screen.findByText('Offer outside your territory')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'operations.suspendOffer' })).toBeEnabled();
});
