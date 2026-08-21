const { expect } = require('@playwright/test');

const API_BASE_URL =
  process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5001/api';

const E2E_CLIENT_EMAIL =
  process.env.E2E_CLIENT_EMAIL || 'e2e.real.client@example.com';
const E2E_ADMIN_EMAIL =
  process.env.E2E_ADMIN_EMAIL || 'e2e.real.admin@example.com';
const E2E_CLIENT_PASSWORD =
  process.env.E2E_CLIENT_PASSWORD || process.env.E2E_TEST_PASSWORD || 'Password123!';

function buildRegisterPayload() {
  const ts = Date.now();
  const alphaSuffix = String(ts)
    .split('')
    .map((digit) => String.fromCharCode(65 + (Number(digit) % 26)))
    .join('');
  return {
    firstName: 'Ete',
    lastName: `Real${alphaSuffix}`,
    email: `e2e.real.${ts}@example.com`,
    phone: `+2237${String(ts).slice(-7)}`,
    country: 'ML',
    password: E2E_CLIENT_PASSWORD,
  };
}

async function getMasterCountries(request) {
  const response = await request.get(`${API_BASE_URL}/franchises/masters`);
  const body = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `API master countries failed: ${JSON.stringify(body)}`
  ).toBeTruthy();
  return Array.isArray(body?.countries) ? body.countries : [];
}

async function registerDisposableClient(request, overrides = {}) {
  const countries = await getMasterCountries(request);
  expect(
    countries.length > 0,
    'No active master country is available for integration auth tests.'
  ).toBeTruthy();

  const preferredIso = String(overrides?.preferredCountryIso || 'ML')
    .trim()
    .toUpperCase();
  const targetCountry =
    countries.find(
      (country) =>
        String(country?.isoCode || '').trim().toUpperCase() === preferredIso
    ) || countries[0];

  const payload = {
    ...buildRegisterPayload(),
    language: 'fr',
    ...overrides,
    countryId: overrides?.countryId ?? targetCountry?.id,
  };

  delete payload.country;
  delete payload.preferredCountryIso;

  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: payload,
  });
  const body = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `API register failed: ${JSON.stringify(body)}`
  ).toBeTruthy();

  return {
    payload,
    body,
    country: targetCountry,
  };
}

async function seedUiPreferences(page, language = 'fr') {
  await page.addInitScript(({ lang }) => {
    localStorage.setItem('teranga_lang', lang);
    localStorage.setItem('teranga_analytics_consent', 'denied');
  }, { lang: language });
}

async function blockExternalTracking(page) {
  await page.route('https://www.googletagmanager.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://www.google-analytics.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}

async function loginAsSeededClient(request) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      email: E2E_CLIENT_EMAIL,
      password: E2E_CLIENT_PASSWORD,
    },
  });

  const body = await response.json().catch(() => ({}));
  expect(response.ok(), `API login failed: ${JSON.stringify(body)}`).toBeTruthy();

  return {
    token: body.token,
    user: body.user,
  };
}

async function loginAsSeededAdmin(request) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      email: E2E_ADMIN_EMAIL,
      password: E2E_CLIENT_PASSWORD,
    },
  });

  const body = await response.json().catch(() => ({}));
  expect(
    response.ok(),
    `API admin login failed: ${JSON.stringify(body)}`
  ).toBeTruthy();

  return {
    token: body.token,
    user: body.user,
  };
}

async function seedAuthenticatedSession(page, user, token) {
  await page.addInitScript(
    ({ userPayload, tokenValue }) => {
      localStorage.setItem('teranga_token', tokenValue);
      localStorage.setItem('token', tokenValue);
      localStorage.setItem('teranga_user', JSON.stringify(userPayload));
      localStorage.setItem('teranga_lang', 'fr');
      localStorage.setItem('teranga_analytics_consent', 'denied');
      localStorage.setItem('teranga_services_showForm', '1');
      localStorage.setItem('teranga_tasks_showForm', '1');
      localStorage.setItem('teranga_orders_showForm', '1');
    },
    {
      userPayload: user,
      tokenValue: token,
    }
  );
}

module.exports = {
  API_BASE_URL,
  E2E_ADMIN_EMAIL,
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  buildRegisterPayload,
  blockExternalTracking,
  getMasterCountries,
  loginAsSeededAdmin,
  loginAsSeededClient,
  registerDisposableClient,
  seedUiPreferences,
  seedAuthenticatedSession,
};
