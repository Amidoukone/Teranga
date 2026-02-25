function setupApiModule() {
  jest.resetModules();
  localStorage.clear();
  document.cookie = 'teranga_csrf=; Max-Age=0; path=/';
  delete process.env.REACT_APP_API_BASE_URL;
  delete process.env.REACT_APP_API_URL;
  delete process.env.REACT_APP_FILE_BASE_URL;

  const interceptorState = {
    request: [],
    response: [],
  };

  const apiInstance = {
    defaults: { baseURL: '/api' },
    interceptors: {
      request: {
        use: jest.fn((onFulfilled, onRejected) => {
          interceptorState.request.push({ onFulfilled, onRejected });
          return interceptorState.request.length - 1;
        }),
      },
      response: {
        use: jest.fn((onFulfilled, onRejected) => {
          interceptorState.response.push({ onFulfilled, onRejected });
          return interceptorState.response.length - 1;
        }),
      },
    },
    request: jest.fn(),
    post: jest.fn(),
  };

  const axiosMock = {
    create: jest.fn(() => apiInstance),
  };

  jest.doMock('axios', () => ({
    __esModule: true,
    default: axiosMock,
    create: axiosMock.create,
  }));

  // eslint-disable-next-line global-require
  const apiModule = require('./api');

  return {
    apiModule,
    apiInstance,
    requestInterceptor: interceptorState.request[0]?.onFulfilled,
    responseErrorInterceptor: interceptorState.response[0]?.onRejected,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  document.cookie = 'teranga_csrf=; Max-Age=0; path=/';
  delete process.env.REACT_APP_AUTH_STORAGE;
  delete process.env.REACT_APP_COOKIE_BEARER_FALLBACK;
  delete process.env.REACT_APP_API_BASE_URL;
  delete process.env.REACT_APP_API_URL;
  delete process.env.REACT_APP_FILE_BASE_URL;
});

test('skipAuthHeader keeps CSRF injection for refresh calls', async () => {
  const { requestInterceptor } = setupApiModule();
  localStorage.setItem('teranga_token', 'stale-access');
  localStorage.setItem('teranga_csrf_token', 'csrf-from-storage');

  const cfg = await requestInterceptor({
    method: 'post',
    url: '/auth/refresh',
    skipAuthHeader: true,
    headers: {},
  });

  expect(cfg.headers.Authorization).toBeUndefined();
  expect(cfg.headers.authorization).toBeUndefined();
  expect(cfg.headers['X-CSRF-Token']).toBe('csrf-from-storage');
});

test('401 on protected route refreshes once then retries original request', async () => {
  const { responseErrorInterceptor, apiInstance } = setupApiModule();
  localStorage.setItem('teranga_token', 'old-access');
  localStorage.setItem('token', 'old-access');
  localStorage.setItem('teranga_user', JSON.stringify({ id: 1 }));

  apiInstance.post.mockResolvedValue({
    data: {
      token: 'new-access',
      csrfToken: 'new-csrf',
    },
  });
  apiInstance.request.mockResolvedValue({ data: { ok: true } });

  const cfg = {
    url: '/orders',
    method: 'get',
    headers: { Authorization: 'Bearer old-access' },
  };
  const error = {
    response: { status: 401, data: { error: 'expired' } },
    config: cfg,
  };

  const result = await responseErrorInterceptor(error);

  expect(apiInstance.post).toHaveBeenCalledWith(
    '/auth/refresh',
    {},
    expect.objectContaining({
      skipAuthRedirect: true,
      silentAuth: true,
      skipAuthRefresh: true,
      skipAuthHeader: true,
    })
  );
  expect(cfg.__isRetryAfterRefresh).toBe(true);
  expect(cfg.headers.Authorization).toBeUndefined();
  expect(apiInstance.request).toHaveBeenCalledWith(cfg);
  expect(localStorage.getItem('teranga_token')).toBe('new-access');
  expect(localStorage.getItem('token')).toBe('new-access');
  expect(localStorage.getItem('teranga_csrf_token')).toBe('new-csrf');
  expect(result).toEqual({ data: { ok: true } });
});

test('401 on login endpoint does not trigger auto-refresh', async () => {
  const { responseErrorInterceptor, apiInstance } = setupApiModule();
  localStorage.setItem('teranga_token', 'any-token');

  const error = {
    response: { status: 401, data: { error: 'invalid credentials' } },
    config: {
      url: '/auth/login',
      method: 'post',
      silentAuth: true,
      skipAuthRedirect: true,
    },
  };

  await expect(responseErrorInterceptor(error)).rejects.toBe(error);
  expect(apiInstance.post).not.toHaveBeenCalled();
  expect(apiInstance.request).not.toHaveBeenCalled();
});

test('concurrent 401 responses share a single refresh request', async () => {
  const { responseErrorInterceptor, apiInstance } = setupApiModule();
  localStorage.setItem('teranga_token', 'old-access');

  const refresh = deferred();
  apiInstance.post.mockReturnValue(refresh.promise);
  apiInstance.request.mockImplementation((cfg) =>
    Promise.resolve({ data: { url: cfg.url, retried: true } })
  );

  const errorA = {
    response: { status: 401 },
    config: { url: '/orders', method: 'get', headers: {} },
  };
  const errorB = {
    response: { status: 401 },
    config: { url: '/projects', method: 'get', headers: {} },
  };

  const promiseA = responseErrorInterceptor(errorA);
  const promiseB = responseErrorInterceptor(errorB);

  expect(apiInstance.post).toHaveBeenCalledTimes(1);

  refresh.resolve({ data: { token: 'new-access', csrfToken: 'new-csrf' } });

  const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

  expect(apiInstance.post).toHaveBeenCalledTimes(1);
  expect(apiInstance.request).toHaveBeenCalledTimes(2);
  expect(resultA.data.retried).toBe(true);
  expect(resultB.data.retried).toBe(true);
  expect(localStorage.getItem('teranga_token')).toBe('new-access');
});

test('cookie-only strict skips bearer injection and does not persist refreshed JWT', async () => {
  process.env.REACT_APP_AUTH_STORAGE = 'cookie';
  process.env.REACT_APP_COOKIE_BEARER_FALLBACK = 'false';
  const { requestInterceptor, responseErrorInterceptor, apiInstance } = setupApiModule();
  localStorage.setItem('teranga_token', 'stale-access');
  localStorage.setItem('token', 'stale-access');
  localStorage.setItem('teranga_csrf_token', 'csrf-seed');

  const requestCfg = await requestInterceptor({
    method: 'get',
    url: '/orders',
    headers: {},
  });
  expect(requestCfg.headers.Authorization).toBeUndefined();

  apiInstance.post.mockResolvedValue({
    data: { token: 'new-access', csrfToken: 'new-csrf' },
  });
  apiInstance.request.mockResolvedValue({ data: { ok: true } });

  await responseErrorInterceptor({
    response: { status: 401 },
    config: { url: '/orders', method: 'get', headers: { Authorization: 'Bearer stale-access' } },
  });

  expect(localStorage.getItem('teranga_token')).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(localStorage.getItem('teranga_csrf_token')).toBe('new-csrf');
});
