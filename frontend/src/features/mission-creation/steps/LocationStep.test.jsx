import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LocationStep from './LocationStep';
import { reverseGeocodeLocation } from '../../../services/missions';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key) => key }) }));
jest.mock('../../../services/missions', () => ({ reverseGeocodeLocation: jest.fn() }));
jest.mock('../MissionLocationMap', () => () => <div data-testid="location-map" />);
jest.mock('../LocationAutocompleteInput', () => (props) => <input id={props.id} value={props.value || ''} onChange={(event) => props.onChange(event.target.value)} />);

test('maps stay unloaded until requested and selecting a map is optional', async () => {
  render(<LocationStep address="" pickupAddress="" requiresPickup onAddressChange={jest.fn()} onPickupAddressChange={jest.fn()} />);
  expect(screen.queryByTestId('location-map')).not.toBeInTheDocument();
  expect(screen.getByLabelText('missionCreation.location.pickupAddressLabel')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'missionCreation.location.showMap' })[0]);
  expect(await screen.findByTestId('location-map')).toBeInTheDocument();
});

test('GPS coordinates survive a failed reverse geocoding request', async () => {
  reverseGeocodeLocation.mockRejectedValueOnce(new Error('Network unavailable'));
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: (success) => success({ coords: { latitude: 12.63, longitude: -8 } }),
  } });
  const onCurrentLocationResolved = jest.fn();
  render(<LocationStep address="" onAddressChange={jest.fn()} onCurrentLocationResolved={onCurrentLocationResolved} />);
  fireEvent.click(screen.getByRole('button', { name: 'missionCreation.location.useCurrentLocation' }));
  await waitFor(() => expect(onCurrentLocationResolved).toHaveBeenCalledWith({ latitude: 12.63, longitude: -8, address: null }));
  expect(screen.getByRole('button', { name: 'missionCreation.location.useCurrentLocation' })).toBeEnabled();
});
