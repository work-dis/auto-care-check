import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { observationSchema } from '@/lib/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ observationId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { observationId } = await params;
    const body = await request.json();

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

    if (observation.vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Validate input (partial)
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

    // 3. Compute fields (closedAt)
    const dataToUpdate: Partial<typeof validation.data> & { closedAt?: Date | null } = { ...validation.data };
    if (validation.data.state) {
      if (validation.data.state === 'closed') {
        dataToUpdate.closedAt = new Date();
      } else {
        dataToUpdate.closedAt = null;
      }
    }

    // 4. Update
    const updated = await prisma.observation.update({
      where: { id: observationId },
      data: dataToUpdate,
      include: {
        maintenancePlan: true,
        serviceRecord: true,
      },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'Observation',
        entityId: observationId,
        action: 'UPDATE',
        beforeJson: JSON.stringify(observation),
        afterJson: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ observation: updated });
  } catch (error) {
    console.error('Error updating observation:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при обновлении наблюдения' } },
      { status: 500 }
    );
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

    if (observation.vehicle.userId !== userId) {
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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ observationId: string }> }
) {
  // POST /observations/:observationId/close
  try {
    const userId = await getSessionUserId();
    const { observationId } = await params;
    const body = await request.json().catch(() => ({}));

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

    if (observation.vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    const updated = await prisma.observation.update({
      where: { id: observationId },
      data: {
        state: 'closed',
        closedAt: new Date(),
        serviceRecordId: body.serviceRecordId || null,
      },
      include: {
        maintenancePlan: true,
        serviceRecord: true,
      },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'Observation',
        entityId: observationId,
        action: 'CLOSE',
        beforeJson: JSON.stringify(observation),
        afterJson: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ observation: updated });
  } catch (error) {
    console.error('Error closing observation:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при закрытии наблюдения' } },
      { status: 500 }
    );
  }
}
