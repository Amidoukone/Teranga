import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderAvailabilityPanel from './ProviderAvailabilityPanel';
import { getMyProvider, getMyDispatchPresence, updateMyAvailability, updateMyLiveLocation } from '../../services/providers';
jest.mock('react-i18next', () => { const t = (key) => key; return { useTranslation: () => ({ t }) }; });
jest.mock('../../services/providers', () => ({ getMyProvider: jest.fn(), getMyDispatchPresence: jest.fn(), updateMyAvailability: jest.fn(), updateMyLiveLocation: jest.fn() }));
beforeEach(() => {
  jest.resetAllMocks();
  getMyProvider.mockResolvedValue({ id: 4, availabilityStatus: 'offline' });
  getMyDispatchPresence.mockResolvedValue({ eligibleVehicles: [{ id: 12, plateNumber: 'MOTO-12' }, { id: 13, plateNumber: 'MOTO-13' }] });
  updateMyAvailability.mockResolvedValue({ id: 4, availabilityStatus: 'available' });
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_done, reject) => reject(new Error('denied')) } });
});
test('a profile outage is explicit and never invents an offline availability', async () => {
  getMyProvider.mockRejectedValueOnce(new Error('offline'));
  render(<ProviderAvailabilityPanel />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'fieldWorkspace.goAvailable' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'serviceOrders.retry' }));
  await screen.findByRole('button', { name: 'fieldWorkspace.goAvailable' });
  expect(getMyProvider).toHaveBeenCalledWith({ strict: true });
});
test('missing dispatch presence blocks starting availability but a provider can still go offline', async () => {
  getMyProvider.mockResolvedValue({ id: 4, availabilityStatus: 'available' });
  getMyDispatchPresence.mockRejectedValue(new Error('presence unavailable'));
  render(<ProviderAvailabilityPanel />); await screen.findByRole('alert');
  const offline = screen.getByRole('button', { name: 'fieldWorkspace.goOffline' });
  expect(offline).toBeEnabled(); fireEvent.click(offline);
  await waitFor(() => expect(updateMyAvailability).toHaveBeenCalledWith('offline', null));
});
test('a vehicle choice survives refreshing the same account and GPS denial does not block availability', async () => {
  render(<ProviderAvailabilityPanel />);
  fireEvent.change(await screen.findByRole('combobox', { name: 'myMissionsPage.availability.activeVehicle' }), { target: { value: '13' } });
  fireEvent.online(window); await waitFor(() => expect(getMyDispatchPresence).toHaveBeenCalledTimes(2));
  expect(screen.getByRole('combobox')).toHaveValue('13');
  fireEvent.click(screen.getByRole('button', { name: 'fieldWorkspace.goAvailable' }));
  await waitFor(() => expect(updateMyAvailability).toHaveBeenCalledWith('available', '13'));
  expect(updateMyLiveLocation).not.toHaveBeenCalled();
});
test('a busy provider has no availability override button', async () => {
  getMyProvider.mockResolvedValue({ id: 4, availabilityStatus: 'busy' });
  render(<ProviderAvailabilityPanel />);
  expect(await screen.findByRole('button', { name: 'fieldWorkspace.busy' })).toBeDisabled();
  expect(updateMyAvailability).not.toHaveBeenCalled();
});
test('an old GPS response cannot write availability after the account has been left', async () => {
  let finishGps;
  navigator.geolocation.getCurrentPosition = (resolve) => { finishGps = resolve; };
  const view = render(<ProviderAvailabilityPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'fieldWorkspace.goAvailable' }));
  await waitFor(() => expect(finishGps).toBeDefined()); view.unmount();
  await act(async () => finishGps({ coords: { latitude: 12, longitude: -8 } }));
  expect(updateMyAvailability).not.toHaveBeenCalled(); expect(updateMyLiveLocation).not.toHaveBeenCalled();
});
test('a revoked profile clears previously visible availability controls', async () => {
  render(<ProviderAvailabilityPanel />); await screen.findByRole('button', { name: 'fieldWorkspace.goAvailable' });
  getMyProvider.mockRejectedValueOnce({ response: { status: 403 } }); fireEvent.online(window);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'fieldWorkspace.goAvailable' })).not.toBeInTheDocument();
});

test('a GPS response arriving after switching to information cannot declare availability', async () => {
  let finishGps;
  navigator.geolocation.getCurrentPosition = resolve => { finishGps = resolve; };
  const view = render(<ProviderAvailabilityPanel />);
  fireEvent.click(await screen.findByRole('button', { name: 'fieldWorkspace.goAvailable' }));
  await waitFor(() => expect(finishGps).toBeDefined());
  view.rerender(<ProviderAvailabilityPanel active={false} />);
  await act(async () => finishGps({ coords: { latitude: 12, longitude: -8 } }));
  expect(updateMyAvailability).not.toHaveBeenCalled(); expect(updateMyLiveLocation).not.toHaveBeenCalled();
});
