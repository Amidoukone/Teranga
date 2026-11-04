'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const frontend = path.resolve(__dirname, '../../frontend');
const result = spawnSync(process.execPath, [path.join(frontend, 'node_modules/react-scripts/scripts/build.js')], {
  cwd: frontend,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production', BUILD_PATH: 'build-recette', PUBLIC_URL: '/',
    REACT_APP_API_URL: '/api', REACT_APP_API_BASE_URL: '/api', REACT_APP_FILE_BASE_URL: '/',
    REACT_APP_AUTH_STORAGE: 'cookie', REACT_APP_COOKIE_BEARER_FALLBACK: 'false',
    REACT_APP_RELEASE: process.env.RENDER_GIT_COMMIT || 'recette-locale-non-commitee',
    // Never silently inherit keys or endpoints from frontend/.env.production.
    REACT_APP_GOOGLE_MAPS_BROWSER_KEY: process.env.RECETTE_GOOGLE_MAPS_BROWSER_KEY || '',
    REACT_APP_OBSERVABILITY_TOKEN: process.env.FRONTEND_ERROR_TOKEN || '',
  },
});
if (result.error) { console.error('Impossible de lancer la compilation de recette.'); process.exitCode = 1; }
else process.exitCode = result.status === null ? 1 : result.status;
