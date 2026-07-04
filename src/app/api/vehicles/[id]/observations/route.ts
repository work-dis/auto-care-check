import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { observationSchema } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // Check ownership of the vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    const observations = await prisma.observation.findMany({
      where: { vehicleId },
      include: {
        maintenancePlan: true,
        serviceRecord: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ observations });
  } catch (error) {
    console.error('Error fetching observations:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении наблюдений' } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;
    const body = await request.json();

    // 1. Verify vehicle ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle || vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Validate payload
    const validation = observationSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Неверные параметры наблюдения', fieldErrors } },
        { status: 400 }
      );
    }

    const { title, description, priority, state, photoUrl, maintenancePlanId } = validation.data;

    // 3. Create observation
    const observation = await prisma.observation.create({
      data: {
        vehicleId,
        title,
        description,
        priority,
        state,
        photoUrl,
        maintenancePlanId,
      },
      include: {
        maintenancePlan: true,
      },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'Observation',
        entityId: observation.id,
        action: 'CREATE',
        afterJson: JSON.stringify(observation),
      },
    });

    return NextResponse.json({ observation });
  } catch (error) {
    console.error('Error creating observation:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при создании наблюдения' } },
      { status: 500 }
    );
  }
}
