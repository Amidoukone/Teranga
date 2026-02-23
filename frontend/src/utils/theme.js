export const THEME_STORAGE_KEY = 'teranga_theme';

const VALID_THEMES = new Set(['light', 'dark', 'system']);
let systemListenerAttached = false;

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // noop
  }
}

export function normalizeTheme(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!VALID_THEMES.has(raw)) return 'system';
  return raw;
}

export function getStoredTheme() {
  if (typeof window === 'undefined') return 'system';
  return normalizeTheme(safeGet(THEME_STORAGE_KEY) || 'system');
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference) {
  const normalized = normalizeTheme(preference);
  return normalized === 'system' ? getSystemTheme() : normalized;
}

export function applyTheme(preference) {
  if (typeof document === 'undefined') return 'light';

  const normalized = normalizeTheme(preference);
  const resolved = resolveTheme(normalized);
  const root = document.documentElement;

  root.setAttribute('data-theme', resolved);
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('teranga_theme_changed', {
        detail: {
          preference: normalized,
          resolved,
        },
      })
    );
  }

  return resolved;
}

export function setThemePreference(nextPreference) {
  const normalized = normalizeTheme(nextPreference);
  if (typeof window !== 'undefined') {
    safeSet(THEME_STORAGE_KEY, normalized);
  }
  const resolved = applyTheme(normalized);
  return { preference: normalized, resolved };
}

function attachSystemListener() {
  if (systemListenerAttached) return;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const currentPreference = getStoredTheme();
    if (currentPreference === 'system') {
      applyTheme('system');
    }
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onChange);
  } else if (typeof media.addListener === 'function') {
    media.addListener(onChange);
  }
  systemListenerAttached = true;
}

export function initTheme() {
  const preference = getStoredTheme();
  const resolved = applyTheme(preference);
  attachSystemListener();
  return { preference, resolved };
}
