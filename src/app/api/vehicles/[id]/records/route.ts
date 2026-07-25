import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { serviceRecordSchema } from '@/lib/validation';
import { apiErrorResponse } from '@/server/shared/apiError';
import { createConfirmedServiceRecord } from '@/server/service-records/service-record.service';
import { hasVehicleAccess } from '@/server/vehicles/access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;
    const body = await request.json();

    // 1. Fetch vehicle and verify ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
        { status: 404 }
      );
    }

    if (!(await hasVehicleAccess(vehicle.id, vehicle.userId, userId, 'editor'))) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Validate input
    const parsed = serviceRecordSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Неверные данные формы', details: fieldErrors } },
        { status: 400 }
      );
    }

    const resultRecord = await createConfirmedServiceRecord(vehicle, userId, parsed.data);

    return NextResponse.json({ serviceRecord: resultRecord }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, 'Ошибка сервера при сохранении выполненной работы');
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // 1. Verify vehicle and ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
        { status: 404 }
      );
    }

    if (!(await hasVehicleAccess(vehicle.id, vehicle.userId, userId))) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Fetch service records ordered by date desc
    const records = await prisma.serviceRecord.findMany({
      where: { vehicleId },
      include: {
        planItems: true,
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    return NextResponse.json({ serviceRecords: records });
  } catch (error) {
    console.error('Error fetching service records:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении истории обслуживания' } },
      { status: 500 }
    );
  }
}
