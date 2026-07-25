import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  jsonRequest,
  requestWorkspaceApi,
  WorkspaceApiError,
} from '@/features/vehicle-workspace/api/client';

describe('vehicle workspace API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a successful JSON payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ vehicle: { id: 'vehicle-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    await expect(requestWorkspaceApi('/api/vehicles/vehicle-1')).resolves.toEqual({
      vehicle: { id: 'vehicle-1' },
    });
  });

  it('preserves server field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'Ошибка валидации',
              fieldErrors: { mileage: 'Некорректный пробег' },
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const error = await requestWorkspaceApi('/api/odometer').catch((requestError) => requestError);
    expect(error).toBeInstanceOf(WorkspaceApiError);
    expect(error).toMatchObject({
      message: 'Ошибка валидации',
      fieldErrors: { mileage: 'Некорректный пробег' },
    });
  });

  it('builds JSON mutation requests consistently', () => {
    expect(jsonRequest('POST', { title: 'Замена масла' })).toEqual({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Замена масла' }),
    });
  });
});
