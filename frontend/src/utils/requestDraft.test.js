import { readRequestDraft, saveRequestDraft, clearRequestDraft } from './requestDraft';

beforeEach(() => sessionStorage.clear());

test('drafts restore the need and location without saving identity, PIN or files', () => {
  saveRequestDraft('mission', 7, { title: 'Réparer une fuite', countryId: '1', address: 'Près du marché', phone: '+22370000000', pin: 'secret', photo: { name: 'photo.jpg' }, coordinates: { latitude: 12, longitude: -8 } });
  const draft = readRequestDraft('mission', 7);
  expect(draft).toMatchObject({ title: 'Réparer une fuite', address: 'Près du marché', coordinates: { latitude: 12, longitude: -8 } });
  expect(JSON.stringify(draft)).not.toMatch(/phone|secret|photo/);
  expect(readRequestDraft('mission', 8)).toEqual({});
  clearRequestDraft('mission', 7);
  expect(readRequestDraft('mission', 7)).toEqual({});
});

test('expired, corrupt and invalid locations never become a resumed request', () => {
  sessionStorage.setItem('teranga-request-draft:v1:mission:7', JSON.stringify({ savedAt: Date.now() - 25 * 60 * 60 * 1000, data: { title: 'Ancien besoin' } }));
  expect(readRequestDraft('mission', 7)).toEqual({});
  saveRequestDraft('mission', 7, { title: 'Nouveau besoin', coordinates: { latitude: 999, longitude: -8 } });
  expect(readRequestDraft('mission', 7).coordinates).toBeUndefined();
});
