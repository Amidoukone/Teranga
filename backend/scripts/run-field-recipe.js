'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const result = spawnSync(process.execPath, [path.resolve(__dirname, 'run-tests.js'), '--runInBand', '--silent', 'tests/integration/mission-coordination.test.js', 'tests/integration/coordination-workflows.test.js', 'tests/integration/local-currency-flows.test.js', 'tests/unit/missionCoordination.policy.test.js', 'tests/unit/fieldReadiness.service.test.js', 'tests/unit/servicePaymentState.service.test.js'], {
  stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', REQUIRE_INTEGRATION_DB: 'true' },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
