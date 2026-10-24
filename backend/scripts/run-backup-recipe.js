'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, [path.resolve(__dirname, 'run-tests.js'), '--silent', 'tests/unit/deploymentChecks.test.js', 'tests/unit/releaseReadiness.test.js', 'tests/integration/backup-restore.test.js'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', REQUIRE_INTEGRATION_DB: 'true' },
});
if (result.error) console.error('Impossible de lancer la recette de restauration');
process.exitCode = result.status ?? 1;
