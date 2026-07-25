import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function loadDotEnv() {
  if (!fs.existsSync('.env')) return;

  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to derive the local test database connection.');
  process.exit(1);
}

const source = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(source.hostname)) {
  console.error('Refusing to create a test database on a non-local PostgreSQL server.');
  process.exit(1);
}

const testDatabaseName = 'autopulse_test';
const adminDatabaseName = 'postgres';
const commonArgs = [
  '--host', source.hostname,
  '--port', source.port || '5432',
  '--username', decodeURIComponent(source.username || 'postgres'),
];
const postgresEnv = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(source.password || ''),
};

const exists = spawnSync(
  'psql',
  [...commonArgs, '--dbname', adminDatabaseName, '--tuples-only', '--no-align', '--command',
    `SELECT 1 FROM pg_database WHERE datname = '${testDatabaseName}'`],
  { env: postgresEnv, encoding: 'utf8' },
);

if (exists.status !== 0) {
  process.stderr.write(exists.stderr);
  process.exit(exists.status ?? 1);
}

if (exists.stdout.trim() !== '1') {
  const created = spawnSync('createdb', [...commonArgs, testDatabaseName], {
    env: postgresEnv,
    encoding: 'utf8',
  });
  if (created.status !== 0) {
    process.stderr.write(created.stderr);
    process.exit(created.status ?? 1);
  }
  console.log(`Created local test database "${testDatabaseName}".`);
}

source.pathname = `/${testDatabaseName}`;
const testDatabaseUrl = source.toString();
const migrated = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  env: {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    DIRECT_URL: testDatabaseUrl,
  },
  encoding: 'utf8',
  stdio: 'inherit',
});

if (migrated.status !== 0) process.exit(migrated.status ?? 1);

console.log(`Test database is ready. Export DATABASE_URL=${source.protocol}//<credentials>@${source.host}/${testDatabaseName}`);
