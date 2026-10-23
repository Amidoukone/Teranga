import { protectCreation, settleCreation } from './creationRequests';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
const config = (data, url = '/v1/orders') => ({ method: 'post', url, data, headers: {} });

test('a lost response keeps the same key and confirmed success allows a new request', async () => {
  const first = await protectCreation(config({ note: 'retry-on-network-loss', items: [] }));
  settleCreation(first, 503);
  const retry = await protectCreation(config({ items: [], note: 'retry-on-network-loss' }));
  expect(retry.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  settleCreation(retry, 200);
  const next = await protectCreation(config({ items: [], note: 'retry-on-network-loss' }));
  expect(next.headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
});

test('pending conflicts keep the reservation while a validation failure permits a corrected request', async () => {
  const first = await protectCreation(config({ note: 'pending-reservation' }));
  settleCreation(first, 409);
  const retry = await protectCreation(config({ note: 'pending-reservation' }));
  expect(retry.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  settleCreation(retry, 400);
  expect((await protectCreation(config({ note: 'pending-reservation' }))).headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
});

test('keys are isolated by account, payload and route and an explicit key survives auth retries', async () => {
  localStorage.setItem('teranga_user', JSON.stringify({ id: 1 }));
  const first = await protectCreation(config({ title: 'Account-scoped request' }, '/v1/services'));
  localStorage.setItem('teranga_user', JSON.stringify({ id: 2 }));
  const second = await protectCreation(config({ title: 'Account-scoped request' }, '/v1/services'));
  expect(second.headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
  expect((await protectCreation(first)).headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  const auth = config({ pin: '123456', phone: '+233700000000' }, '/auth/login');
  expect((await protectCreation(auth)).headers['Idempotency-Key']).toBeUndefined();
  expect(JSON.stringify(sessionStorage)).not.toContain('123456');
});
