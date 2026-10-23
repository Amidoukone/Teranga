import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GeoProvider, useGeo } from './GeoContext';
import { getCountries } from '../services/countries';
import { getRegions } from '../services/regions';
import { getGeoSelection, setGeoSelection } from '../services/geo';

jest.mock('../services/countries', () => ({ getCountries: jest.fn() }));
jest.mock('../services/regions', () => ({ getRegions: jest.fn() }));
jest.mock('../services/auth', () => ({ getLocalUser: () => ({ id: 1, role: 'admin', countryId: null, regionId: null }), getToken: () => 'test-token', hasSessionHint: () => true }));
jest.mock('../utils/role', () => ({ normalizeRole: (role) => role }));
let storedDuringSelection;
function Controls() {
  const geo = useGeo();
  return <>
    <button onClick={() => { geo.setCountry(1); }}>Mali</button>
    <button onClick={() => { geo.setCountry(2); storedDuringSelection = getGeoSelection(); }}>Côte d’Ivoire</button>
    <button onClick={() => geo.setRegion(10)}>Ancienne région</button>
    <button onClick={() => geo.setRegion(20)}>Abidjan</button>
    <output data-testid="scope">{JSON.stringify({ countryId: geo.countryId, regionId: geo.regionId, regions: geo.regions })}</output>
  </>;
}
beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks();
  getCountries.mockResolvedValue([{ id: 1, name: 'Mali' }, { id: 2, name: 'Côte d’Ivoire' }]);
});
test('changing countries clears the old region before requests and ignores a late Mali response', async () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  let resolveMali;
  getRegions.mockImplementation(({ countryId }) => Number(countryId) === 1 ? new Promise((resolve) => { resolveMali = resolve; })
    : Promise.resolve([{ id: 20, countryId: 2, name: 'Abidjan' }, { id: 10, countryId: 1, name: 'Wrong server row' }]));
  render(<GeoProvider><Controls /></GeoProvider>);
  await waitFor(() => expect(getRegions).toHaveBeenCalledWith({ countryId: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Côte d’Ivoire' }));
  expect(storedDuringSelection).toEqual({ countryId: 2, regionId: null });
  await waitFor(() => expect(screen.getByTestId('scope')).toHaveTextContent('Abidjan'));
  await act(async () => resolveMali([{ id: 10, countryId: 1, name: 'Bamako' }]));
  expect(screen.getByTestId('scope')).not.toHaveTextContent('Bamako');
  expect(screen.getByTestId('scope')).not.toHaveTextContent('Wrong server row');
  fireEvent.click(screen.getByRole('button', { name: 'Ancienne région' }));
  expect(getGeoSelection()).toEqual({ countryId: 2, regionId: null });
  fireEvent.click(screen.getByRole('button', { name: 'Abidjan' }));
  expect(getGeoSelection()).toEqual({ countryId: 2, regionId: 20 });
});
