export function evidenceUrl(value) {
  if (!value || typeof value !== 'string') return null;
  try {
    const base = window.__TERANGA_FILE_BASE_URL || window.__TERANGA_API_BASE_URL || process.env.REACT_APP_API_URL || window.location.origin;
    const url = new URL(value, new URL(base, window.location.origin));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch (_error) { return null; }
}
