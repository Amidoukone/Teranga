const setupModule = (storageMode) => {
  jest.resetModules();
  localStorage.clear();

  if (storageMode === undefined) {
    delete process.env.REACT_APP_AUTH_STORAGE;
  } else {
    process.env.REACT_APP_AUTH_STORAGE = storageMode;
  }

  const apiMock = {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
  };

  const i18nMock = {
    setLanguage: jest.fn(),
    normalizeLanguage: jest.fn(() => 'fr'),
  };

  jest.doMock('./api', () => ({
    __esModule: true,
    default: apiMock,
  }));
  jest.doMock('../i18n', () => i18nMock);

  // eslint-disable-next-line global-require
  const auth = require('./auth');
  return { auth, apiMock, i18nMock };
};

afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.cookie = 'teranga_csrf=; Max-Age=0; path=/';
  delete process.env.REACT_APP_AUTH_STORAGE;
  delete process.env.REACT_APP_COOKIE_BEARER_FALLBACK;
});

test('login persists token when default storage mode is localstorage', async () => {
  const { auth, apiMock } = setupModule();
  apiMock.post.mockResolvedValue({
    data: {
      token: 'jwt-token',
      user: { id: 7, language: 'fr' },
    },
  });

  const result = await auth.login({ email: 'a@b.com', password: 'x' });

  expect(result.token).toBe('jwt-token');
  expect(localStorage.getItem('teranga_token')).toBe('jwt-token');
  expect(localStorage.getItem('token')).toBe('jwt-token');
  expect(localStorage.getItem('teranga_user')).toContain('"id":7');
});

test('login persists token in localstorage mode for backward compatibility', async () => {
  const { auth, apiMock } = setupModule('localstorage');
  apiMock.post.mockResolvedValue({
    data: {
      token: 'jwt-token',
      user: { id: 8, language: 'fr' },
    },
  });

  await auth.login({ email: 'a@b.com', password: 'x' });

  expect(localStorage.getItem('teranga_token')).toBe('jwt-token');
  expect(localStorage.getItem('token')).toBe('jwt-token');
});

test('me returns null when no local token and no csrf cookie in localstorage mode', async () => {
  const { auth } = setupModule('localstorage');
  localStorage.setItem('teranga_user', JSON.stringify({ id: 11 }));

  const result = await auth.me();

  expect(result).toEqual({ user: null });
  expect(localStorage.getItem('teranga_user')).toBeNull();
});

test('me in cookie mode caches backend user response', async () => {
  const { auth, apiMock, i18nMock } = setupModule('cookie');
  apiMock.get.mockResolvedValue({
    data: {
      user: { id: 15, language: 'fr' },
      csrfToken: 'csrf-from-me',
    },
  });

  const result = await auth.me();

  expect(apiMock.get).toHaveBeenCalledWith('/auth/me', {
    skipAuthRedirect: true,
    silentAuth: true,
  });
  expect(result.user.id).toBe(15);
  expect(localStorage.getItem('teranga_user')).toContain('"id":15');
  expect(localStorage.getItem('teranga_csrf_token')).toBe('csrf-from-me');
  expect(i18nMock.setLanguage).toHaveBeenCalledWith('fr');
});

test('me reuses fresh cached user without extra network call', async () => {
  const { auth, apiMock, i18nMock } = setupModule('localstorage');
  localStorage.setItem('teranga_token', 'jwt-token');
  localStorage.setItem('token', 'jwt-token');
  localStorage.setItem('teranga_user', JSON.stringify({ id: 22, language: 'fr' }));
  localStorage.setItem('teranga_user_synced_at', String(Date.now()));

  const result = await auth.me();

  expect(result).toEqual({
    user: { id: 22, language: 'fr' },
    cached: true,
  });
  expect(apiMock.get).not.toHaveBeenCalled();
  expect(i18nMock.setLanguage).toHaveBeenCalledWith('fr');
});

test('login in cookie mode strict does not persist JWT in localStorage', async () => {
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK = 'false';
  const { auth, apiMock } = setupModule('cookie');
  apiMock.post.mockResolvedValue({
    data: {
      token: 'jwt-token',
      refreshToken: 'refresh-123',
      csrfToken: 'csrf-123',
      user: { id: 16, language: 'fr' },
    },
  });
  apiMock.get.mockResolvedValue({
    data: {
      user: { id: 16, language: 'fr' },
      csrfToken: 'csrf-123',
    },
  });

  const result = await auth.login({ email: 'a@b.com', password: 'x' });

  expect(result.token).toBe('jwt-token');
  expect(apiMock.post).toHaveBeenCalledWith(
    '/auth/login',
    { email: 'a@b.com', password: 'x' },
    expect.objectContaining({
      headers: expect.objectContaining({
        'X-Teranga-Session-Fallback': 'bearer',
      }),
    })
  );
  expect(localStorage.getItem('teranga_token')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('teranga_refresh_token')).toBeNull();
  expect(localStorage.getItem('teranga_csrf_token')).toBe('csrf-123');
  expect(localStorage.getItem('teranga_cookie_bearer_fallback_active')).toBeNull();
  expect(auth.getAuthHeader()).toEqual({});
});

test('login in cookie mode strict falls back to stored bearer when cookie session check fails', async () => {
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK = 'false';
  const { auth, apiMock } = setupModule('cookie');
  apiMock.post.mockResolvedValue({
    data: {
      token: 'jwt-token',
      refreshToken: 'refresh-999',
      csrfToken: 'csrf-999',
      user: { id: 17, language: 'fr' },
    },
  });
  apiMock.get.mockRejectedValue({
    response: { status: 401, data: { error: 'Token manquant' } },
    message: 'Unauthorized',
  });

  const result = await auth.login({ email: 'a@b.com', password: 'x' });

  expect(result.token).toBe('jwt-token');
  expect(localStorage.getItem('teranga_token')).toBe('jwt-token');
  expect(localStorage.getItem('token')).toBe('jwt-token');
  expect(localStorage.getItem('teranga_refresh_token')).toBe('refresh-999');
  expect(localStorage.getItem('teranga_cookie_bearer_fallback_active')).toBe('1');
  expect(auth.getAuthHeader()).toEqual({ Authorization: 'Bearer jwt-token' });
});

test('me in cookie mode can recover session from stored refresh token when cookies are missing', async () => {
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK = 'false';
  const { auth, apiMock } = setupModule('cookie');
  localStorage.setItem('teranga_refresh_token', 'refresh-seed');
  localStorage.setItem('teranga_cookie_bearer_fallback_active', '1');

  apiMock.get
    .mockRejectedValueOnce({
      response: { status: 401, data: { error: 'Token manquant' } },
      message: 'Unauthorized',
    })
    .mockResolvedValueOnce({
      data: {
        user: { id: 18, language: 'fr' },
        csrfToken: 'csrf-fresh',
      },
    });
  apiMock.post.mockResolvedValue({
    data: {
      token: 'fresh-access',
      refreshToken: 'fresh-refresh',
      csrfToken: 'csrf-fresh',
    },
  });

  const result = await auth.me();

  expect(apiMock.post).toHaveBeenCalledWith(
    '/auth/refresh',
    { refreshToken: 'refresh-seed' },
    expect.objectContaining({
      skipAuthRedirect: true,
      silentAuth: true,
      skipAuthRefresh: true,
      skipAuthHeader: true,
    })
  );
  expect(result.user.id).toBe(18);
  expect(localStorage.getItem('teranga_token')).toBe('fresh-access');
  expect(localStorage.getItem('teranga_refresh_token')).toBe('fresh-refresh');
  expect(localStorage.getItem('teranga_csrf_token')).toBe('csrf-fresh');
});

test('logout calls backend endpoint and clears local session', async () => {
  const { auth, apiMock } = setupModule('cookie');
  localStorage.setItem('teranga_token', 'jwt-token');
  localStorage.setItem('token', 'jwt-token');
  localStorage.setItem('teranga_refresh_token', 'refresh-token');
  localStorage.setItem('teranga_user', JSON.stringify({ id: 1 }));
  apiMock.post.mockResolvedValue({ data: { message: 'ok' } });

  await auth.logout();

  expect(apiMock.post).toHaveBeenCalledWith(
    '/auth/logout',
    { refreshToken: 'refresh-token' },
    expect.any(Object)
  );
  expect(localStorage.getItem('teranga_token')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('teranga_refresh_token')).toBeNull();
  expect(localStorage.getItem('teranga_user')).toBeNull();
});
