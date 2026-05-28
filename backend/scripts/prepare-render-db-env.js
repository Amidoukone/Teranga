'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const readlineCursor = require('readline');
const { spawnSync } = require('child_process');
const { stdin: input, stdout: output } = require('process');

const DEFAULTS = {
  host: 'teranga-mysql-prod-do-user-37904030-0.e.db.ondigitalocean.com',
  port: '25060',
  database: 'teranga',
  user: 'teranga_app',
  caPath: path.resolve(__dirname, '..', '..', 'backups', 'do-ca.crt'),
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--host') {
      args.host = argv[i + 1] || args.host;
      i += 1;
    } else if (arg === '--port') {
      args.port = argv[i + 1] || args.port;
      i += 1;
    } else if (arg === '--database') {
      args.database = argv[i + 1] || args.database;
      i += 1;
    } else if (arg === '--user') {
      args.user = argv[i + 1] || args.user;
      i += 1;
    } else if (arg === '--ca-path') {
      args.caPath = path.resolve(argv[i + 1] || args.caPath);
      i += 1;
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

function caValue(caPath) {
  if (!fs.existsSync(caPath) || !fs.statSync(caPath).isFile()) {
    throw new Error(`CA certificate file not found: ${caPath}`);
  }

  return fs.readFileSync(caPath, 'utf8').trim().replace(/\r?\n/g, '\\n');
}

function copyToClipboard(value) {
  const command = process.platform === 'win32' ? 'clip.exe' : null;
  if (!command) return false;

  const result = spawnSync(command, {
    input: value,
    encoding: 'utf8',
  });

  return result.status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input, output });

  try {
    const password = await askHidden(rl, 'teranga_app password: ');
    if (!password) throw new Error('Password is required');

    const databaseUrl = `mysql://${encodeURIComponent(args.user)}:${encodeURIComponent(
      password
    )}@${args.host}:${args.port}/${args.database}`;
    const dbSslCa = caValue(args.caPath);

    console.log('\nRender database variables');
    console.log('DATABASE_URL:', databaseUrl.replace(password, '<PASSWORD>'));
    console.log('DB_SSL: true');
    console.log('DB_SSL_REJECT_UNAUTHORIZED: true');
    console.log('DB_SSL_CA:', `<${dbSslCa.length} chars, from ${args.caPath}>`);

    if (copyToClipboard(databaseUrl)) {
      console.log('\nDATABASE_URL copied to clipboard.');
      console.log('Paste it in Render, then press Enter here to copy DB_SSL_CA.');
      await rl.question('');
    } else {
      console.log('\nClipboard copy is unavailable on this platform.');
    }

    if (copyToClipboard(dbSslCa)) {
      console.log('DB_SSL_CA copied to clipboard.');
    }

    console.log('\nDo not store or paste these secret values in chat.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('[render-env] failed:', err.message);
  process.exit(1);
});
