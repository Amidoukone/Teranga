const DEFAULT_TOKEN = 'e2e-token';
const DEFAULT_PASSWORD = 'Password123!';

function nowIso() {
  return new Date().toISOString();
}

function createE2EUser(overrides = {}) {
  return {
    id: 101,
    firstName: 'E2E',
    lastName: 'Client',
    email: 'e2e.client@teranga.test',
    phone: '+22370000000',
    role: 'client',
    country: 'ML',
    countryId: 1,
    regionId: 1,
    language: 'fr',
    ...overrides,
  };
}

function createInitialState(user, overrides = {}) {
  const createdAt = nowIso();
  const service = {
    id: 501,
    title: 'Service E2E - Entretien Villa',
    description: 'Service mocke pour test E2E.',
    type: 'other',
    status: 'pending',
    budget: 25000,
    clientId: user.id,
    propertyId: 301,
    createdAt,
    updatedAt: createdAt,
    property: {
      id: 301,
      title: 'Villa E2E Bamako',
      address: 'Sebenicoro',
    },
  };

  const task = {
    id: 601,
    serviceId: service.id,
    title: 'Tache E2E - Controle documents',
    description: 'Controle des pieces du dossier',
    type: 'other',
    priority: 'normal',
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    service,
    assignee: null,
  };

  const notification = {
    id: 701,
    userId: user.id,
    entityType: 'service',
    entityId: service.id,
    action: 'created',
    status: 'unread',
    progress: 'new',
    createdAt,
    updatedAt: createdAt,
    metadata: {
      title: 'Notification E2E Service',
    },
  };

  const order = {
    id: 801,
    code: 'CMD-E2E-001',
    userId: user.id,
    orderStatus: 'created',
    paymentStatus: 'unpaid',
    totalAmount: 12000,
    currency: 'XOF',
    customerNote: 'Commande E2E initiale',
    createdAt,
    updatedAt: createdAt,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    items: [],
  };

  return {
    auth: {
      password: DEFAULT_PASSWORD,
    },
    session: {
      active: false,
      token: DEFAULT_TOKEN,
    },
    masterCountries: [{ id: 1, isoCode: 'ML', name: 'Mali' }],
    services: [service],
    properties: [service.property],
    tasks: [task],
    notifications: [notification],
    products: [
      {
        id: 901,
        name: 'Produit E2E',
        price: 12000,
        stock: 100,
        currency: 'XOF',
      },
    ],
    orders: [order],
    transactions: [],
    ...overrides,
  };
}

function extractApiPath(urlString) {
  const url = new URL(urlString);
  const stripped = url.pathname.replace(/^\/api(?:\/v1)?/, '');
  return stripped || '/';
}

function parseRequestBody(request) {
  const raw = request.postData();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return {};
  }
}

function parsePagination(urlString) {
  const url = new URL(urlString);
  const pageRaw = Number.parseInt(url.searchParams.get('page') || '1', 10);
  const limitRaw = Number.parseInt(url.searchParams.get('limit') || '50', 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
  return { page, limit };
}

function paginate(items, urlString) {
  const { page, limit } = parsePagination(urlString);
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);
  return {
    items: slice,
    pagination: {
      page,
      limit,
      total: items.length,
    },
  };
}

async function fulfillJson(route, status, payload) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function isAuthenticatedRequest(request, state) {
  const authHeader = String(request.headers().authorization || '').toLowerCase();
  return state.session.active || authHeader.startsWith('bearer ');
}

function computeNotificationSummary(notifications) {
  const unread = notifications.filter((n) => n.status !== 'read').length;
  const byProgress = notifications.reduce((acc, n) => {
    const key = n.progress || 'new';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return { unread, byProgress };
}

async function installApiMocks(page, options = {}) {
  const user = createE2EUser(options.user || {});
  const state = createInitialState(user, options.state || {});

  await page.route('https://www.googletagmanager.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://www.google-analytics.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const path = extractApiPath(request.url());

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (method === 'GET' && path === '/franchises/masters') {
      await fulfillJson(route, 200, { countries: state.masterCountries });
      return;
    }

    if (method === 'POST' && path === '/auth/register') {
      const body = parseRequestBody(request);
      user.firstName = body.firstName || user.firstName;
      user.lastName = body.lastName || user.lastName;
      user.email = body.email || user.email;
      user.phone = body.phone || user.phone;
      user.country = body.country || user.country;
      state.auth.password = body.password || state.auth.password;
      await fulfillJson(route, 201, {
        message: 'Compte cree avec succes',
        user,
      });
      return;
    }

    if (method === 'POST' && path === '/auth/login') {
      const body = parseRequestBody(request);
      const identifier = body.identifier || body.email || body.phone || '';
      if (identifier && identifier !== user.email && identifier !== user.phone) {
        await fulfillJson(route, 401, { error: 'Identifiants invalides' });
        return;
      }
      if (body.password !== state.auth.password) {
        await fulfillJson(route, 401, { error: 'Identifiants invalides' });
        return;
      }
      state.session.active = true;
      await fulfillJson(route, 200, {
        token: state.session.token,
        user,
      });
      return;
    }

    if (method === 'POST' && path === '/auth/change-password') {
      if (!isAuthenticatedRequest(request, state)) {
        await fulfillJson(route, 401, { error: 'Non authentifie' });
        return;
      }

      const body = parseRequestBody(request);
      if (body.currentPassword !== state.auth.password) {
        await fulfillJson(route, 400, {
          error: 'Mot de passe actuel incorrect',
        });
        return;
      }

      state.auth.password = body.newPassword || state.auth.password;
      await fulfillJson(route, 200, {
        message: 'Mot de passe mis a jour',
      });
      return;
    }

    if (method === 'POST' && path === '/auth/logout') {
      state.session.active = false;
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (method === 'GET' && path === '/auth/me') {
      if (!isAuthenticatedRequest(request, state)) {
        await fulfillJson(route, 401, { error: 'Non authentifie' });
        return;
      }
      await fulfillJson(route, 200, { user });
      return;
    }

    if (method === 'GET' && path === '/dashboard/summary') {
      await fulfillJson(route, 200, {
        services: { total: state.services.length },
        tasks: { total: state.tasks.length },
        orders: { total: state.orders.length },
        transactions: { total: state.transactions.length },
      });
      return;
    }

    if (method === 'GET' && path === '/services/me') {
      const paged = paginate(state.services, request.url());
      await fulfillJson(route, 200, {
        services: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'GET' && path === '/services') {
      const paged = paginate(state.services, request.url());
      await fulfillJson(route, 200, {
        services: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'POST' && path === '/services') {
      const body = parseRequestBody(request);
      const created = {
        id: 500 + state.services.length + 1,
        title: body.title || `Service E2E ${state.services.length + 1}`,
        description: body.description || '',
        type: body.type || 'other',
        status: 'pending',
        clientId: user.id,
        propertyId: body.propertyId || state.properties[0]?.id || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.services.unshift(created);
      await fulfillJson(route, 201, { service: created });
      return;
    }

    if (method === 'GET' && path === '/properties') {
      await fulfillJson(route, 200, { properties: state.properties });
      return;
    }

    if (method === 'GET' && path === '/tasks') {
      await fulfillJson(route, 200, { tasks: state.tasks });
      return;
    }

    if (method === 'POST' && path === '/tasks') {
      const body = parseRequestBody(request);
      const created = {
        id: 600 + state.tasks.length + 1,
        title: body.title || `Tache E2E ${state.tasks.length + 1}`,
        description: body.description || '',
        type: body.type || 'other',
        priority: body.priority || 'normal',
        status: 'pending',
        serviceId: Number(body.serviceId) || state.services[0]?.id || null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.tasks.unshift(created);
      await fulfillJson(route, 201, { task: created });
      return;
    }

    if (method === 'PUT' && /^\/tasks\/\d+\/status$/.test(path)) {
      const body = parseRequestBody(request);
      const id = Number(path.split('/')[2]);
      const task = state.tasks.find((t) => Number(t.id) === id);
      if (!task) {
        await fulfillJson(route, 404, { error: 'Tache introuvable' });
        return;
      }
      task.status = body.status || task.status;
      task.updatedAt = nowIso();
      await fulfillJson(route, 200, { task });
      return;
    }

    if (method === 'PUT' && /^\/tasks\/\d+\/assign$/.test(path)) {
      const body = parseRequestBody(request);
      const id = Number(path.split('/')[2]);
      const task = state.tasks.find((t) => Number(t.id) === id);
      if (!task) {
        await fulfillJson(route, 404, { error: 'Tache introuvable' });
        return;
      }
      task.assignedTo = body.agentId || null;
      task.updatedAt = nowIso();
      await fulfillJson(route, 200, { task });
      return;
    }

    if (method === 'GET' && path === '/notifications/summary') {
      await fulfillJson(route, 200, computeNotificationSummary(state.notifications));
      return;
    }

    if (method === 'PATCH' && path === '/notifications/read-all') {
      state.notifications = state.notifications.map((item) => ({
        ...item,
        status: 'read',
      }));
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (method === 'PATCH' && /^\/notifications\/\d+\/read$/.test(path)) {
      const id = Number(path.split('/')[2]);
      state.notifications = state.notifications.map((item) =>
        Number(item.id) === id ? { ...item, status: 'read' } : item
      );
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (method === 'DELETE' && /^\/notifications\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2]);
      state.notifications = state.notifications.filter(
        (item) => Number(item.id) !== id
      );
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (method === 'DELETE' && path === '/notifications/cleanup') {
      const beforeLength = state.notifications.length;
      state.notifications = state.notifications.filter(
        (item) => item.status !== 'read'
      );
      await fulfillJson(route, 200, {
        deleted: beforeLength - state.notifications.length,
      });
      return;
    }

    if (method === 'GET' && path === '/notifications') {
      const paged = paginate(state.notifications, request.url());
      await fulfillJson(route, 200, {
        notifications: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'GET' && path === '/orders') {
      const paged = paginate(state.orders, request.url());
      await fulfillJson(route, 200, {
        items: paged.items,
        orders: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'GET' && /^\/orders\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2]);
      const order = state.orders.find((item) => Number(item.id) === id);
      if (!order) {
        await fulfillJson(route, 404, { error: 'Commande introuvable' });
        return;
      }
      await fulfillJson(route, 200, { order });
      return;
    }

    if (method === 'POST' && path === '/orders') {
      const body = parseRequestBody(request);
      const id = 800 + state.orders.length + 1;
      const created = {
        id,
        code: `CMD-E2E-${String(id).padStart(3, '0')}`,
        userId: user.id,
        orderStatus: 'created',
        paymentStatus: 'unpaid',
        totalAmount: 0,
        currency: 'XOF',
        customerNote: body.customerNote || '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.orders.unshift(created);
      await fulfillJson(route, 201, { order: created });
      return;
    }

    if (method === 'GET' && path === '/products') {
      const paged = paginate(state.products, request.url());
      await fulfillJson(route, 200, {
        items: paged.items,
        products: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'GET' && path === '/transactions') {
      const paged = paginate(state.transactions, request.url());
      await fulfillJson(route, 200, {
        items: paged.items,
        transactions: paged.items,
        pagination: paged.pagination,
      });
      return;
    }

    if (method === 'GET' && path === '/countries') {
      await fulfillJson(route, 200, { items: [], countries: [] });
      return;
    }

    if (method === 'GET' && path === '/regions') {
      await fulfillJson(route, 200, { items: [], regions: [] });
      return;
    }

    await fulfillJson(route, 200, { ok: true });
  });

  return { user, token: state.session.token, state };
}

async function seedAuthenticatedSession(page, user, token = DEFAULT_TOKEN) {
  await page.addInitScript(
    ({ userPayload, tokenValue }) => {
      localStorage.setItem('teranga_token', tokenValue);
      localStorage.setItem('token', tokenValue);
      localStorage.setItem('teranga_user', JSON.stringify(userPayload));
    },
    { userPayload: user, tokenValue: token }
  );
}

module.exports = {
  DEFAULT_TOKEN,
  DEFAULT_PASSWORD,
  createE2EUser,
  installApiMocks,
  seedAuthenticatedSession,
};
