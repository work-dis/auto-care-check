import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Proxy authorization contract', () => {
  const previousSecret = process.env.CRON_SECRET;

  afterEach(() => {
    process.env.CRON_SECRET = previousSecret;
  });

  it('rejects anonymous private API calls', () => {
    const response = proxy(new NextRequest('http://localhost/api/vehicles'));
    expect(response.status).toBe(401);
  });

  it('accepts the cron bearer secret', () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    const response = proxy(
      new NextRequest('http://localhost/api/cron/notifications', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    );
    expect(response.status).toBe(200);
  });

  it('rejects an invalid cron bearer secret', () => {
    process.env.CRON_SECRET = 'test-cron-secret';
    const response = proxy(
      new NextRequest('http://localhost/api/cron/notifications', {
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(response.status).toBe(401);
  });
});
