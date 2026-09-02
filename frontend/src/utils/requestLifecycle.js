const NEXT_ACTIONS = {
  CREATED: 'qualify',
  SEARCHING_EXECUTOR: 'assign',
  ASSIGNED: 'execute',
  EN_ROUTE: 'execute',
  ON_SITE: 'execute',
  IN_PROGRESS: 'proof',
  COMPLETED: 'validate',
  VALIDATED: 'close',
  CLOSED: 'done',
  CANCELLED_BY_CLIENT: 'done',
  NO_EXECUTOR_FOUND: 'retry',
};

export function getRequestNextAction(request = {}) {
  const status = String(request.missionStatus || request.status || '').toUpperCase();
  return NEXT_ACTIONS[status] || 'follow';
}

export function getRequestProofState(request = {}) {
  const proof = request.proofFile || request.proof || request.evidence;
  return proof ? 'provided' : 'missing';
}

export const REQUEST_NEXT_ACTION_KEYS = Object.keys(NEXT_ACTIONS);
