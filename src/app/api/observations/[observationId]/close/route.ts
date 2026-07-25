import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { closeObservation } from '@/server/observations/observation.service';
import { apiErrorResponse } from '@/server/shared/apiError';
import { z } from 'zod';

const closeSchema = z.object({
  serviceRecordId: z.string().uuid().nullable().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ observationId: string }> },
) {
  try {
    const userId = await getSessionUserId();
    const { observationId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = closeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Некорректная запись обслуживания' } },
        { status: 400 },
      );
    }

    const observation = await closeObservation(
      observationId,
      userId,
      parsed.data.serviceRecordId,
    );
    return NextResponse.json({ observation });
  } catch (error) {
    return apiErrorResponse(error, 'Ошибка сервера при закрытии наблюдения');
  }
}
