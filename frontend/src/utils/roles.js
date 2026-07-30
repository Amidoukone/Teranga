import i18n from '../i18n';

const ROLE_FALLBACKS = {
  admin: 'ADMINISTRATEUR',
  agent: 'AGENT',
  client: 'CLIENT',
  master: 'MASTER',
};

function translateRole(key) {
  const fallback = ROLE_FALLBACKS[key] || key;
  try {
    if (i18n?.t) {
      const translated = i18n.t(`roles.${key}`, { defaultValue: fallback });
      return translated ?? fallback;
    }
  } catch {
    // noop
  }
  return fallback;
}

export function normalizeRole(rawRole) {
  if (!rawRole) return 'client';
  const r = String(rawRole).toLowerCase();
  if (r.includes('admin')) return 'admin';
  if (r.includes('agent')) return 'agent';
  if (r.includes('category_manager')) return 'category_manager';
  if (r.includes('provider')) return 'provider';
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
    const raw = String(userOrRole).toLowerCase();
    if (raw.includes('master')) return translateRole('master');
    const r = normalizeRole(userOrRole);
    if (r === 'admin') return translateRole('admin');
    if (r === 'agent') return translateRole('agent');
    return translateRole('client');
  }

  const user = userOrRole;

  if (isMasterUser(user)) return translateRole('master');
  if (isAdminRole(user?.role)) return translateRole('admin');
  if (normalizeRole(user?.role) === 'agent') return translateRole('agent');
  return translateRole('client');
}
