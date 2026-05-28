'use strict';

const readline = require('readline/promises');
const readlineCursor = require('readline');
const { stdin: input, stdout: output } = require('process');
const { spawnSync } = require('child_process');
const path = require('path');

const DEFAULT_URL =
  'mysql://teranga_app:<PASSWORD>@teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com:25060/teranga';

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    caPath: '..\\backups\\do-ca.crt',
    extraArgs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') {
      args.url = argv[i + 1] || args.url;
      i += 1;
    } else if (arg === '--ca-path') {
      args.caPath = argv[i + 1] || args.caPath;
      i += 1;
    } else {
      args.extraArgs.push(arg);
    }
  }

  return args;
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

    const result = spawnSync(
      process.execPath,
      [path.resolve(__dirname, 'check-database.js'), ...args.extraArgs],
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
  console.error('[db:check-url] failed:', err.message);
  process.exit(1);
});
