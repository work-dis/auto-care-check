import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const sourceUrl = new URL(
  process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/autopulse_test?schema=public',
);
if (!process.env.TEST_DATABASE_URL) sourceUrl.pathname = '/autopulse_test';
const testDatabaseUrl = sourceUrl.toString();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDatabaseUrl,
      JWT_SECRET: process.env.JWT_SECRET || 'e2e-secret-with-at-least-32-characters',
      CRON_SECRET: process.env.CRON_SECRET || 'e2e-cron-secret-with-at-least-32-characters',
    },
  },
});
