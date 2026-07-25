import crypto from 'node:crypto';

const DEFAULT_MAX_AGE_SECONDS = 10 * 60;

export interface TelegramLoginData {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
}

export function verifyTelegramLoginWidget(
  initData: string,
  botToken: string,
  options: { now?: Date; maxAgeSeconds?: number } = {},
): TelegramLoginData | null {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) return null;

  const pairs = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expectedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest();
  const receivedHashBuffer = Buffer.from(receivedHash, 'hex');

  if (
    receivedHashBuffer.length !== expectedHash.length ||
    !crypto.timingSafeEqual(receivedHashBuffer, expectedHash)
  ) {
    return null;
  }

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (!Number.isFinite(authDate) || authDate > nowSeconds + 30 || nowSeconds - authDate > maxAgeSeconds) {
    return null;
  }

  const id = params.get('id');
  if (!id) return null;

  return {
    id,
    auth_date: String(authDate),
    first_name: params.get('first_name') || undefined,
    last_name: params.get('last_name') || undefined,
    username: params.get('username') || undefined,
    photo_url: params.get('photo_url') || undefined,
  };
}
