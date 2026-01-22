export function normalizeRole(rawRole) {
  if (!rawRole) return 'client';
  const r = String(rawRole).toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('agent')) return 'agent';
  return 'client';
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}

export function isMasterUser(user) {
  return (
    normalizeRole(user?.role) === 'admin' &&
    (Boolean(user?.countryId) || Boolean(user?.regionId))
  );
}

export function isGlobalAdminUser(user) {
  return (
    normalizeRole(user?.role) === 'admin' &&
    !Boolean(user?.countryId) &&
    !Boolean(user?.regionId)
  );
}

export function prettyRoleLabel(userOrRole) {
  if (typeof userOrRole === 'string') {
    const r = normalizeRole(userOrRole);
    if (r === 'admin') return 'ADMINISTRATEUR';
    if (r === 'agent') return 'AGENT';
    return 'CLIENT';
  }

  const user = userOrRole;

  if (isMasterUser(user)) return 'MASTER';
  if (isAdminRole(user?.role)) return 'ADMINISTRATEUR';
  if (normalizeRole(user?.role) === 'agent') return 'AGENT';
  return 'CLIENT';
}
