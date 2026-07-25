import { describe, expect, it } from 'vitest';
import { serviceRecordSchema } from '@/lib/validation';
import { calculateScheduledTime } from '@/server/notifications/generation.service';
import { decryptSensitiveValue, encryptSensitiveValue } from '@/lib/sensitiveData';

describe('Money and notification scheduling', () => {
  it.each(['USD', 'BYN', 'RUB', 'EUR'])('accepts supported currency %s', (currency) => {
    expect(
      serviceRecordSchema.safeParse({
        performedAt: '2026-07-25',
        mileage: 100,
        serviceName: 'Test',
        laborCost: 10,
        partsCost: 20,
        currency,
        planIds: [],
        observationIds: [],
      }).success,
    ).toBe(true);
  });

  it('rejects unsupported currencies', () => {
    const result = serviceRecordSchema.safeParse({
      performedAt: '2026-07-25',
      mileage: 100,
      serviceName: 'Test',
      laborCost: 10,
      partsCost: 20,
      currency: 'BTC',
      planIds: [],
      observationIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('schedules reminder using the user timezone', () => {
    const scheduled = calculateScheduledTime(
      new Date('2026-01-15T05:00:00.000Z'),
      'Europe/Moscow',
      '09:00',
      null,
      null,
    );
    expect(scheduled.toISOString()).toBe('2026-01-15T06:00:00.000Z');
  });

  it('respects daylight saving time', () => {
    const scheduled = calculateScheduledTime(
      new Date('2026-07-15T10:00:00.000Z'),
      'America/New_York',
      '09:00',
      null,
      null,
    );
    expect(scheduled.toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });

  it('moves a notification past quiet hours crossing midnight', () => {
    const scheduled = calculateScheduledTime(
      new Date('2026-01-15T20:00:00.000Z'),
      'Europe/Moscow',
      '23:00',
      '22:00',
      '07:00',
    );
    expect(scheduled.toISOString()).toBe('2026-01-16T04:00:00.000Z');
  });

  it('encrypts and decrypts sensitive vehicle fields', () => {
    const previousKey = process.env.DATA_ENCRYPTION_KEY;
    process.env.DATA_ENCRYPTION_KEY = 'unit-test-encryption-key';
    const encrypted = encryptSensitiveValue('WVWZZZ1JZXW000001');
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('WVWZZZ1JZXW000001');
    expect(decryptSensitiveValue(encrypted)).toBe('WVWZZZ1JZXW000001');
    if (previousKey === undefined) delete process.env.DATA_ENCRYPTION_KEY;
    else process.env.DATA_ENCRYPTION_KEY = previousKey;
  });
});
