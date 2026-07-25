import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyTelegramLoginWidget } from '@/integrations/telegram/loginWidget';

function signedPayload(
  data: Record<string, string>,
  token = '123456:test-token',
) {
  const params = new URLSearchParams(data);
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = crypto.createHash('sha256').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return { payload: params.toString(), token };
}

describe('Telegram Login Widget verification', () => {
  const now = new Date('2026-07-24T12:00:00Z');
  const authDate = String(Math.floor(now.getTime() / 1000) - 60);

  it('accepts a valid fresh Login Widget payload', () => {
    const signed = signedPayload({ id: '42', first_name: 'Miko', auth_date: authDate });
    expect(verifyTelegramLoginWidget(signed.payload, signed.token, { now })).toMatchObject({
      id: '42',
      first_name: 'Miko',
    });
  });

  it('rejects a tampered payload', () => {
    const signed = signedPayload({ id: '42', first_name: 'Miko', auth_date: authDate });
    expect(
      verifyTelegramLoginWidget(signed.payload.replace('Miko', 'Mallory'), signed.token, { now }),
    ).toBeNull();
  });

  it('rejects an expired payload', () => {
    const signed = signedPayload({
      id: '42',
      auth_date: String(Math.floor(now.getTime() / 1000) - 3600),
    });
    expect(verifyTelegramLoginWidget(signed.payload, signed.token, { now })).toBeNull();
  });
});
