import { territoryContact } from './territoryContact';
test('Côte d’Ivoire never inherits Mali assistance', () => {
  const country = { id: 2, isoCode: 'CI', name: 'Côte d’Ivoire', contactPhone: '+2250700000000' };
  expect(territoryContact({ country, region: { countryId: 1, contactPhone: '+22370000000' } }).phone).toBe(country.contactPhone);
  expect(territoryContact({ country: { ...country, contactPhone: null } }).phone).toBeNull();
  expect(territoryContact({ country, region: { countryId: 2, contactPhone: '+2250100000000' } }).phone).toBe('+2250100000000');
});
test('existing Mali assistance remains available when its legacy configuration is empty', () => {
  expect(territoryContact({ country: { id: 1, isoCode: 'ML' } }).phone).toBe('+223 70453345');
  expect(territoryContact({}).phone).toBeNull();
});
