import { resolve } from 'node:path';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

const clientEnvKeys = [
  'REACT_APP_API_URL',
  'REACT_APP_API_BASE_URL',
  'REACT_APP_FILE_BASE_URL',
  'REACT_APP_AUTH_STORAGE',
  'REACT_APP_COOKIE_BEARER_FALLBACK',
  'REACT_APP_ENABLE_FRONTEND_ERROR_REPORTING',
  'REACT_APP_OBSERVABILITY_TOKEN',
  'REACT_APP_RELEASE',
  'REACT_APP_GOOGLE_MAPS_BROWSER_KEY',
  'REACT_APP_AUTH_ME_CACHE_TTL_MS',
  'REACT_APP_DRIVER_LOCATION_POLL_MS',
  'REACT_APP_MISSION_TRACK_POLL_MS',
  'REACT_APP_PROPERTY_UPLOAD_TIMEOUT_MS',
  'REACT_APP_NOTIFICATION_SUMMARY_POLL_MS',
  'REACT_APP_DRIVER_RIDES_POLL_MS',
  'REACT_APP_UPLOAD_BATCH_SIZE',
  'REACT_APP_TRANSPORT_LIST_POLL_MS',
  'REACT_APP_UPLOAD_TIMEOUT_MS',
  'REACT_APP_NOTIFICATIONS_SUMMARY_TTL_MS',
  'REACT_APP_PRODUCT_UPLOAD_TIMEOUT_MS',
  'REACT_APP_PROPERTY_ALLOW_CREATE_WITHOUT_MEDIA',
];

export default defineConfig(({ mode }) => {
  const frontendRoot = process.cwd();
  const env = loadEnv(mode, frontendRoot, 'REACT_APP_');
  const define = {
    'process.env.NODE_ENV': JSON.stringify(mode),
  };

  for (const key of clientEnvKeys) {
    define[`process.env.${key}`] = env[key] === undefined
      ? 'undefined'
      : JSON.stringify(env[key]);
  }

  const craJsxCompatibility = {
    name: 'cra-jsx-in-js-compatibility',
    enforce: 'pre',
    async transform(code, id) {
      const normalizedId = id.replaceAll('\\', '/');
      if (!normalizedId.includes('/src/') || !normalizedId.endsWith('.js')) return null;
      return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
    },
  };

  return {
    root: frontendRoot,
    envDir: frontendRoot,
    plugins: [craJsxCompatibility, react({ include: /\.[jt]sx?$/ })],
    base: '/',
    publicDir: resolve(frontendRoot, '.vite-public'),
    define,
    optimizeDeps: {
      entries: ['src/index.jsx'],
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number(process.env.PORT || 3000),
      strictPort: true,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
    build: {
      outDir: 'build-vite',
      emptyOutDir: true,
    },
  };
});
