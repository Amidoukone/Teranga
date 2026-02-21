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
    },
  });

  const result = await auth.me();

  expect(apiMock.get).toHaveBeenCalledWith('/auth/me');
  expect(result.user.id).toBe(15);
  expect(localStorage.getItem('teranga_user')).toContain('"id":15');
  expect(i18nMock.setLanguage).toHaveBeenCalledWith('fr');
});

test('logout calls backend endpoint and clears local session', async () => {
  const { auth, apiMock } = setupModule('cookie');
  localStorage.setItem('teranga_token', 'jwt-token');
  localStorage.setItem('token', 'jwt-token');
  localStorage.setItem('teranga_user', JSON.stringify({ id: 1 }));
  apiMock.post.mockResolvedValue({ data: { message: 'ok' } });

  await auth.logout();

  expect(apiMock.post).toHaveBeenCalledWith('/auth/logout', {}, expect.any(Object));
  expect(localStorage.getItem('teranga_token')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('teranga_user')).toBeNull();
});
