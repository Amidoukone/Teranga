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
  DISPUTED: 'resolve',
  RESOLVED_REFUND: 'done',
  RESOLVED_REDO: 'done',
  RESOLVED_CLOSED: 'done',
};

const CLIENT_NEXT_ACTIONS = {
  CREATED: 'received',
  SEARCHING_EXECUTOR: 'searching',
  ASSIGNED: 'assigned',
  EN_ROUTE: 'onTheWay',
  ON_SITE: 'onSite',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'validate',
  VALIDATED: 'confirmed',
  CLOSED: 'done',
  CANCELLED_BY_CLIENT: 'cancelled',
  NO_EXECUTOR_FOUND: 'assistance',
  DISPUTED: 'resolve',
  RESOLVED_REFUND: 'resolved',
  RESOLVED_REDO: 'resolved',
  RESOLVED_CLOSED: 'resolved',
};

export function getRequestNextAction(request = {}, actor = 'operations') {
  const status = String(request.missionStatus || request.status || '').toUpperCase();
  if (actor === 'client') {
    if (status === 'CREATED' && (request.agentId || request.agent)) return 'assigned';
    return CLIENT_NEXT_ACTIONS[status] || 'follow';
  }
  // Les services classiques restent « created » une fois affectés à un agent.
  if (status === 'CREATED' && (request.agentId || request.agent)) return 'execute';
  return NEXT_ACTIONS[status] || 'follow';
}

export function getRequestKind(request = {}) {
  const slug = request.tradeCategory?.slug;
  if (slug === 'mobilite') return 'taxi';
  if (slug === 'livraison') return 'delivery';
  return 'service';
}

export function getRequestDetailPath(request = {}, categorySlug, actor = 'client') {
  const slug = request.tradeCategory?.slug || categorySlug;
  if (request.missionStatus) {
    if (actor === 'admin') {
      if (slug === 'mobilite' || (request.requestedVehicleType && slug !== 'livraison')) return `/admin/taxi-dispatch?missionId=${request.id}`;
      if (slug === 'livraison') return '/admin/livraisons';
      return '/admin/services';
    }
    if (slug === 'mobilite') return `/courses/${request.id}`;
    if (slug === 'livraison') return `/livraisons/${request.id}`;
    return `/missions/${request.id}/track`;
  }
  return `/services/${request.id}`;
}

export function getRequestProofState(request = {}) {
  const proof = request.proofFile || request.proof || request.evidence;
  return proof ? 'provided' : 'missing';
}

export const REQUEST_NEXT_ACTION_KEYS = Object.keys(NEXT_ACTIONS);

export function getRequestPhase(request = {}) {
  const status = String(request.missionStatus || request.status || '').toUpperCase();
  if (['CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND', 'DISPUTED', 'RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'].includes(status)) return null;
  if (['VALIDATED', 'CLOSED'].includes(status)) return 4;
  if (status === 'COMPLETED') return 3;
  if (['EN_ROUTE', 'ON_SITE', 'IN_PROGRESS'].includes(status)) return 2;
  if (status === 'ASSIGNED' || (status === 'CREATED' && (request.agentId || request.agent))) return 1;
  return 0;
}

export function isRequestHistory(request = {}) {
  const status = String(request.missionStatus || request.status || '').toUpperCase();
  return ['VALIDATED', 'CLOSED', 'CANCELLED_BY_CLIENT', 'NO_EXECUTOR_FOUND', 'RESOLVED_REFUND', 'RESOLVED_REDO', 'RESOLVED_CLOSED'].includes(status);
}

export function needsClientAction(request = {}) {
  return String(request.missionStatus || request.status || '').toUpperCase() === 'COMPLETED';
}

export function getBookingPath(slug) {
  if (slug === 'mobilite') return '/taxi';
  if (slug === 'livraison') return '/livraison';
  return '/demandes/nouvelle';
}
