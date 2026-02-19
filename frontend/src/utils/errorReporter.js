import { API_BASE_URL } from '../services/api';

const isProd = (process.env.NODE_ENV || 'development') === 'production';
const isEnabled =
  String(process.env.REACT_APP_ENABLE_FRONTEND_ERROR_REPORTING || '').toLowerCase() !==
  'false';
const endpoint = `${API_BASE_URL}/observability/frontend-errors`;
const observabilityToken = (process.env.REACT_APP_OBSERVABILITY_TOKEN || '').trim();

const sentSignatures = new Map();
const MAX_SIGNATURES = 100;
const DEDUPE_WINDOW_MS = 30 * 1000;

function trim(value, max = 2000) {
  return String(value || '').slice(0, max);
}

function createSignature(payload) {
  return [payload.name, payload.message, payload.path].join('|');
}

function shouldSend(payload) {
  if (!isProd || !isEnabled) return false;

  const now = Date.now();
  const signature = createSignature(payload);
  const lastSentAt = sentSignatures.get(signature) || 0;
  if (now - lastSentAt < DEDUPE_WINDOW_MS) {
    return false;
  }

  sentSignatures.set(signature, now);
  if (sentSignatures.size > MAX_SIGNATURES) {
    const first = sentSignatures.keys().next();
    if (!first.done) sentSignatures.delete(first.value);
  }

  return true;
}

function sendWithFetch(payload) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (observabilityToken) {
    headers['X-Observability-Token'] = observabilityToken;
  }

  return fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'include',
  }).catch(() => undefined);
}

function sendWithBeacon(payload) {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  const body = JSON.stringify(payload);
  const blob = new Blob([body], { type: 'application/json' });
  return navigator.sendBeacon(endpoint, blob);
}

function buildPayload(errorLike, extra = {}) {
  return {
    name: trim(errorLike?.name || extra.name, 120),
    message: trim(errorLike?.message || extra.message, 1000),
    stack: trim(errorLike?.stack, 4000),
    componentStack: trim(extra.componentStack, 4000),
    path: trim(window?.location?.pathname || '', 500),
    userAgent: trim(window?.navigator?.userAgent || '', 500),
    language: trim(window?.navigator?.language || '', 32),
    release: trim(process.env.REACT_APP_RELEASE || '', 120),
  };
}

export function reportFrontendError(errorLike, extra = {}) {
  if (typeof window === 'undefined') return;
  const payload = buildPayload(errorLike, extra);
  if (!payload.message) return;
  if (!shouldSend(payload)) return;

  if (!observabilityToken && sendWithBeacon(payload)) {
    return;
  }

  sendWithFetch(payload);
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const err = event?.error || { message: event?.message || 'Unknown error' };
    reportFrontendError(err);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    if (reason instanceof Error) {
      reportFrontendError(reason, { name: 'UnhandledPromiseRejection' });
      return;
    }

    reportFrontendError(
      { message: trim(typeof reason === 'string' ? reason : 'Unhandled promise rejection') },
      { name: 'UnhandledPromiseRejection' }
    );
  });
}
