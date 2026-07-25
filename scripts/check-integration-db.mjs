import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = normalizedValue;
    }
  }
}

loadDotEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Create .env or export DATABASE_URL before running integration tests.');
  process.exit(1);
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error('DATABASE_URL is invalid. Expected a PostgreSQL connection string.');
  process.exit(1);
}

const host = parsedUrl.hostname || 'localhost';
const port = parsedUrl.port ? Number(parsedUrl.port) : 5432;

const socket = net.createConnection({ host, port });

socket.setTimeout(1500);

socket.once('connect', () => {
  socket.end();
});

socket.once('end', () => {
  const psqlUrl = new URL(databaseUrl);
  psqlUrl.search = '';
  const check = spawnSync(
    'psql',
    [psqlUrl.toString(), '--no-psqlrc', '--tuples-only', '--no-align', '--command', 'SELECT 1'],
    { encoding: 'utf8' },
  );
  if (check.status !== 0) {
    console.error('PostgreSQL is reachable, but DATABASE_URL cannot open the selected database.');
    console.error('Run `npm run test:prepare` and use the generated local test database URL.');
    process.exit(1);
  }
  process.exit(0);
});

socket.once('timeout', () => {
  socket.destroy();
  console.error(`Integration tests require PostgreSQL at ${host}:${port}. Start it first, for example: docker compose up -d postgres`);
  process.exit(1);
});

socket.once('error', () => {
  console.error(`Integration tests require PostgreSQL at ${host}:${port}. Start it first, for example: docker compose up -d postgres`);
  process.exit(1);
});
