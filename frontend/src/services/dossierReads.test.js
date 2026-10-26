import api from './api';
import { getProjectDocuments } from './projects';
import { getOrderEvidences } from './evidences';
jest.mock('./api', () => ({ get: jest.fn() }));
jest.mock('./auth', () => ({ getAuthHeader: () => ({}) }));
jest.mock('../utils/labels', () => ({ applyLabels: (item) => item }));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.setItem('teranga_geo_scope', JSON.stringify({ countryId: 99, regionId: 999 }));
});
afterEach(() => localStorage.clear());
test('project documents use the authorized project territory rather than a previous selection', async () => {
  api.get.mockResolvedValue({ data: { documents: [] } });
  await getProjectDocuments(14, { countryId: 1, regionId: null });
  expect(api.get).toHaveBeenCalledWith('/project-documents', { params: { projectId: 14, countryId: 1, regionId: null } });
});
test('order evidence can clear an unrelated inherited region without changing its order identity', async () => {
  api.get.mockResolvedValue({ data: { evidences: [] } });
  await getOrderEvidences(14, { countryId: 1, regionId: null });
  expect(api.get).toHaveBeenCalledWith('/orders/14/evidences', expect.objectContaining({ params: { countryId: 1, regionId: null } }));
});
