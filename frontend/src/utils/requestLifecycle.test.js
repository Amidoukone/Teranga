import { getRequestNextAction, getRequestProofState } from './requestLifecycle';

test('maps operational statuses to a simple next action', () => {
  expect(getRequestNextAction({ missionStatus: 'IN_PROGRESS' })).toBe('proof');
  expect(getRequestNextAction({ status: 'completed' })).toBe('validate');
  expect(getRequestNextAction({ status: 'unknown' })).toBe('follow');
});

test('detects whether a request has a proof attached', () => {
  expect(getRequestProofState({ proofFile: { url: '/uploads/proof.jpg' } })).toBe('provided');
  expect(getRequestProofState({})).toBe('missing');
});
