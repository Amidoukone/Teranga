import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LocationAutocompleteInput from './LocationAutocompleteInput';
import { loadGoogleMaps } from './googleMapsLoader';

jest.mock('./googleMapsLoader', () => ({ loadGoogleMaps: jest.fn() }));

test('typing remains available when suggestions fail and the SDK loads only on focus', async () => {
  loadGoogleMaps.mockRejectedValueOnce(new Error('Offline'));
  const onChange = jest.fn();
  render(<><label htmlFor="address">Lieu</label><LocationAutocompleteInput id="address" value="" onChange={onChange} aria-describedby="address-help" /><p id="address-help">Quartier ou repère</p></>);
  const input = screen.getByRole('textbox', { name: 'Lieu' });
  expect(loadGoogleMaps).not.toHaveBeenCalled();
  expect(input).toHaveAttribute('aria-describedby', 'address-help');
  fireEvent.focus(input);
  await waitFor(() => expect(loadGoogleMaps).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: 'Sébénikoro, près du marché' } });
  expect(onChange).toHaveBeenCalledWith('Sébénikoro, près du marché');
});
