'use strict';

const readline = require('readline/promises');
const readlineCursor = require('readline');
const { stdin: input, stdout: output } = require('process');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_URL =
  'mysql://teranga_app:<PASSWORD>@teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com:25060/teranga';

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    caPath: '..\\backups\\do-ca.crt',
    passthrough: [],
    latestRehearsal: false,
    latestFinal: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') {
      args.url = argv[i + 1] || args.url;
      i += 1;
    } else if (arg === '--ca-path') {
      args.caPath = argv[i + 1] || args.caPath;
      i += 1;
    } else if (arg === '--latest-rehearsal') {
      args.latestRehearsal = true;
    } else if (arg === '--latest-final') {
      args.latestFinal = true;
    } else {
      args.passthrough.push(arg);
    }
  }

  return args;
}

function latestDumpArgs(prefix) {
  const backupsDir = path.resolve(__dirname, '..', '..', 'backups');
  const candidates = fs
    .readdirSync(backupsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && entry.name.startsWith(prefix)
    )
    .map((entry) => path.join(backupsDir, entry.name))
    .sort((a, b) => b.localeCompare(a));

  if (candidates.length === 0) {
    throw new Error(`No ${prefix}* dump found in ${backupsDir}`);
  }

  return ['--dir', candidates[0], '--yes', '--reset'];
}

async function askHidden(rl, question) {
  const stdin = process.stdin;
  const onData = (char) => {
    const charString = char.toString();
    if (charString === '\n' || charString === '\r' || charString === '\u0004') {
      return;
    }
    readlineCursor.moveCursor(output, -charString.length, 0);
    output.write('*'.repeat(charString.length));
  };

  stdin.on('data', onData);
  try {
    return await rl.question(question);
  } finally {
    stdin.off('data', onData);
    output.write('\n');
  }
}

function injectPassword(urlValue, password) {
  if (!urlValue.includes('<PASSWORD>')) return urlValue;
  return urlValue.replace('<PASSWORD>', encodeURIComponent(password));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input, output });

  try {
    const password = await askHidden(rl, 'Database password: ');
    if (!password) throw new Error('Database password is required');

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: injectPassword(args.url, password),
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'true',
      DB_SSL_CA_PATH: args.caPath,
    };
    const passthrough = args.latestRehearsal
      ? latestDumpArgs('planetscale-rehearsal-')
      : args.latestFinal
      ? latestDumpArgs('planetscale-final-')
      : args.passthrough;

    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, 'import-sql-dump.js'), ...passthrough],
      {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        env,
      }
    );

    if (result.error) {
      throw result.error;
    }
    process.exit(result.status == null ? 1 : result.status);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[db:import-url] failed:', err.message);
  process.exit(1);
});
