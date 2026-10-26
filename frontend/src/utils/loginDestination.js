export function loginDestination(from) {
  const target = typeof from === 'string' ? from : from?.pathname
    ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '';
  if (!target.startsWith('/') || target.startsWith('//') || /[\\\r\n]/.test(target)) return '/operations';
  try {
    const parsed = new URL(target, 'https://teranga.local');
    if (parsed.origin !== 'https://teranga.local' || /^\/(?:login|register|dashboard|forgot-password|reset-password)(?:\/|$)/.test(parsed.pathname)) return '/operations';
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return '/operations'; }
}
