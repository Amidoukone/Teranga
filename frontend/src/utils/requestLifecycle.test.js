import { getRequestNextAction, getRequestProofState, getRequestDetailPath } from './requestLifecycle';

test('maps operational statuses to a simple next action', () => {
  expect(getRequestNextAction({ missionStatus: 'IN_PROGRESS' })).toBe('proof');
  expect(getRequestNextAction({ status: 'completed' })).toBe('validate');
  expect(getRequestNextAction({ status: 'unknown' })).toBe('follow');
});

test('clients are asked only for their own next action', () => {
  expect(getRequestNextAction({ missionStatus: 'IN_PROGRESS' }, 'client')).toBe('inProgress');
  expect(getRequestNextAction({ status: 'completed' }, 'client')).toBe('validate');
  expect(getRequestNextAction({ status: 'created', agentId: 7 }, 'client')).toBe('assigned');
  expect(getRequestNextAction({ missionStatus: 'DISPUTED' }, 'client')).toBe('resolve');
  expect(getRequestNextAction({ missionStatus: 'CANCELLED_BY_CLIENT' }, 'client')).toBe('cancelled');
  expect(getRequestNextAction({ missionStatus: 'RESOLVED_REDO' }, 'client')).toBe('resolved');
});

test.each([
  [{ id: 1, status: 'created' }, undefined, '/services/1'],
  [{ id: 2, missionStatus: 'CREATED' }, undefined, '/missions/2/track'],
  [{ id: 3, missionStatus: 'CREATED', tradeCategory: { slug: 'mobilite' } }, undefined, '/courses/3'],
  [{ id: 4, missionStatus: 'CREATED' }, 'livraison', '/livraisons/4'],
])('opens the created request directly', (request, slug, expected) => {
  expect(getRequestDetailPath(request, slug)).toBe(expected);
});

test('detects whether a request has a proof attached', () => {
  expect(getRequestProofState({ proofFile: { url: '/uploads/proof.jpg' } })).toBe('provided');
  expect(getRequestProofState({})).toBe('missing');
});

test('operations use management pages instead of tracking pages restricted to clients and executors', () => {
  expect(getRequestDetailPath({ id: 1, missionStatus: 'CREATED' }, undefined, 'admin')).toBe('/admin/services');
  expect(getRequestDetailPath({ id: 2, missionStatus: 'CREATED', tradeCategory: { slug: 'mobilite' } }, undefined, 'admin')).toBe('/admin/taxi-dispatch?missionId=2');
  expect(getRequestDetailPath({ id: 3, missionStatus: 'CREATED', tradeCategory: { slug: 'livraison' } }, undefined, 'admin')).toBe('/admin/livraisons');
});
