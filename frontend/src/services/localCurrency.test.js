import api from './api';
import { createService } from './services';
import { createTask } from './tasks';
import { createProject, updateProject } from './projects';
import { setGeoSelection } from './geo';

jest.mock('./api', () => ({ post: jest.fn(), put: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  api.post.mockResolvedValue({ data: { service: {}, task: {}, project: {} } });
  api.put.mockResolvedValue({ data: { project: {} } });
});

afterEach(() => localStorage.clear());

test.each([createService, createTask, createProject])('creation leaves an omitted currency to the server and preserves an explicit local currency', async (create) => {
  await create({ title: 'Demande locale' });
  expect(api.post.mock.calls[0][1].currency).toBeUndefined();
  await create({ title: 'Demande locale', currency: ' ghs ' });
  expect(api.post.mock.calls[1][1].currency).toBe('GHS');
  await create({ title: 'Demande locale', currency: ' ' });
  expect(api.post.mock.calls[2][1].currency).toBeUndefined();
});

test('project creation sends the chosen destination instead of the stored country', async () => {
  setGeoSelection({ countryId: 1, regionId: 10 });
  await createProject({ title: 'Projet Ghana', countryId: 2 });
  expect(api.post.mock.calls[0][1]).toEqual(expect.objectContaining({ countryId: 2 }));
  expect(api.post.mock.calls[0][1].regionId).toBeUndefined();

  await createProject({ title: 'Projet Ghana', country_id: 2, region_id: 20 });
  expect(api.post.mock.calls[1][1]).toEqual(expect.objectContaining({ country_id: 2, region_id: 20 }));
  expect(api.post.mock.calls[1][1].countryId).toBeUndefined();
});

test('a project edit does not replace its currency with XOF when the field is empty', async () => {
  await updateProject(8, { title: 'Projet actualisé', currency: '' });
  expect(api.put.mock.calls[0][1]).toEqual({ title: 'Projet actualisé' });
  await updateProject(8, { currency: ' gnf ' });
  expect(api.put.mock.calls[1][1]).toEqual({ currency: 'GNF' });
});
