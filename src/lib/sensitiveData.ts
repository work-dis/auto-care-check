import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';

function encryptionKey() {
  const configured = process.env.DATA_ENCRYPTION_KEY;
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('DATA_ENCRYPTION_KEY is required in production');
  }
  const source = configured || process.env.JWT_SECRET || 'autopulse-local-encryption-key';
  return createHash('sha256').update(source).digest();
}

export function encryptSensitiveValue(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith(PREFIX)) return normalized || null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSensitiveValue(value: string | null | undefined) {
  if (!value || !value.startsWith(PREFIX)) return value || null;
  try {
    const [ivValue, tagValue, encryptedValue] = value.slice(PREFIX.length).split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export function decryptVehicleFields<
  T extends {
    plateNumberEncryptedOrMasked: string | null;
    vinEncryptedOrMasked: string | null;
  },
>(vehicle: T): T {
  return {
    ...vehicle,
    plateNumberEncryptedOrMasked: decryptSensitiveValue(vehicle.plateNumberEncryptedOrMasked),
    vinEncryptedOrMasked: decryptSensitiveValue(vehicle.vinEncryptedOrMasked),
  };
}
