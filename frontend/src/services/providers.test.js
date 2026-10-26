import api from './api';
import { getMyProvider } from './providers';

jest.mock('./api', () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('strict provider reads preserve an unavailable API error', async () => {
  const failure = { response: { status: 503 } };
  api.get.mockRejectedValue(failure);
  await expect(getMyProvider({ strict: true })).rejects.toBe(failure);
});

test('an absent provider profile remains distinct from an API failure', async () => {
  api.get.mockRejectedValue({ response: { status: 404 } });
  await expect(getMyProvider({ strict: true })).resolves.toBeNull();
});

test('existing optional profile reads keep their compatible fallback', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  await expect(getMyProvider()).resolves.toBeNull();
});
