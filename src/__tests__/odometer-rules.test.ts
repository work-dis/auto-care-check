import { describe, expect, it } from 'vitest';
import { assertServiceMileage, assertValidOdometerChange } from '@/domain/odometer/rules';
import { ApiError } from '@/server/shared/apiError';

describe('Odometer domain rules', () => {
  it('allows increasing mileage', () => {
    expect(() =>
      assertValidOdometerChange({
        currentMileage: 10_000,
        mileage: 11_000,
        source: 'manual',
      }),
    ).not.toThrow();
  });

  it('requires correction reason for decreasing mileage', () => {
    expect(() =>
      assertValidOdometerChange({
        currentMileage: 10_000,
        mileage: 9_000,
        source: 'manual',
      }),
    ).toThrow(ApiError);
  });

  it('rejects a service record below current mileage', () => {
    expect(() => assertServiceMileage(10_000, 9_000)).toThrow(ApiError);
  });
});
