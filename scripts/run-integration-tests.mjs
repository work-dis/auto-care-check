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

const configuredUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!configuredUrl) {
  console.error('TEST_DATABASE_URL or DATABASE_URL is required.');
  process.exit(1);
}

const testUrl = new URL(configuredUrl);
if (!process.env.TEST_DATABASE_URL) {
  if (!['localhost', '127.0.0.1'].includes(testUrl.hostname)) {
    console.error('Refusing to derive integration DB from a non-local DATABASE_URL. Set TEST_DATABASE_URL explicitly.');
    process.exit(1);
  }
  testUrl.pathname = '/autopulse_test';
}

const databaseUrl = testUrl.toString();
const preflight = spawnSync('node', ['scripts/check-integration-db.mjs'], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  stdio: 'inherit',
});
if (preflight.status !== 0) process.exit(preflight.status ?? 1);

const testFiles = [
  'src/__tests__/observations.test.ts',
  'src/__tests__/odometer-logic.test.ts',
  'src/__tests__/ownership.test.ts',
  'src/__tests__/reminders.test.ts',
  'src/__tests__/service-record.test.ts',
  'src/__tests__/observation-security.test.ts',
];
const tests = spawnSync('npx', ['vitest', 'run', ...testFiles], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  stdio: 'inherit',
});
process.exit(tests.status ?? 1);
