const { expect } = require('@playwright/test');

const API_BASE_URL =
  process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5001/api';

const E2E_CLIENT_EMAIL =
  process.env.E2E_CLIENT_EMAIL || 'e2e.real.client@example.com';
const E2E_CLIENT_PASSWORD =
  process.env.E2E_CLIENT_PASSWORD || process.env.E2E_TEST_PASSWORD || 'Password123!';

function buildRegisterPayload() {
  const ts = Date.now();
  return {
    firstName: 'E2E',
    lastName: `Real${ts}`,
    email: `e2e.real.${ts}@example.com`,
    phone: '+22370000001',
    country: 'ML',
    password: E2E_CLIENT_PASSWORD,
  };
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
  E2E_CLIENT_EMAIL,
  E2E_CLIENT_PASSWORD,
  buildRegisterPayload,
  blockExternalTracking,
  loginAsSeededClient,
  seedAuthenticatedSession,
};
