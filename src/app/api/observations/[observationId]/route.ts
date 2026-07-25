import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { observationSchema } from '@/lib/validation';
import { apiErrorResponse } from '@/server/shared/apiError';
import { updateObservation } from '@/server/observations/observation.service';
import { hasVehicleAccess } from '@/server/vehicles/access';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ observationId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { observationId } = await params;
    const body = await request.json();

    const partialSchema = observationSchema.partial();
    const validation = partialSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Неверные параметры обновления', fieldErrors } },
        { status: 400 }
      );
    }

    const updated = await updateObservation(observationId, userId, validation.data);
    return NextResponse.json({ observation: updated });
  } catch (error) {
    return apiErrorResponse(error, 'Ошибка сервера при обновлении наблюдения');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ observationId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { observationId } = await params;

    // 1. Fetch observation and check ownership
    const observation = await prisma.observation.findUnique({
      where: { id: observationId },
      include: { vehicle: true },
    });

    if (!observation) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Наблюдение не найдено' } },
        { status: 404 }
      );
    }

    if (!(await hasVehicleAccess(observation.vehicleId, observation.vehicle.userId, userId, 'editor'))) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    await prisma.observation.delete({
      where: { id: observationId },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'Observation',
        entityId: observationId,
        action: 'DELETE',
        beforeJson: JSON.stringify(observation),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting observation:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при удалении наблюдения' } },
      { status: 500 }
    );
  }
}
