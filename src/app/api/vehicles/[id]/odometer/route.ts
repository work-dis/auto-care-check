import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { odometerSchema } from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // Verify ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Автомобиль не найден',
          },
        },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'У вас нет доступа к этому автомобилю',
          },
        },
        { status: 403 }
      );
    }

    const readings = await prisma.odometerReading.findMany({
      where: { vehicleId },
      orderBy: { recordedAt: 'desc' },
    });

    return NextResponse.json({ readings });
  } catch (error) {
    console.error('Error fetching odometer readings:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при получении истории пробега',
        },
      },
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

    // 1. Fetch vehicle and check ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Автомобиль не найден',
          },
        },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'У вас нет доступа к этому автомобилю',
          },
        },
        { status: 403 }
      );
    }

    // 2. Validate request
    const parsed = odometerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка валидации пробега',
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { mileage, source, comment, recordedAt } = parsed.data;

    // 3. Business logic rule: Decrease in mileage requires source=correction and a comment
    if (mileage < vehicle.currentMileage) {
      if (source !== 'correction' || !comment || comment.trim() === '') {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Уменьшение пробега допускается только как "корректировка" с обязательным указанием причины.',
              fieldErrors: {
                mileage: 'Для уменьшения пробега выберите тип "Корректировка" и укажите причину в комментарии',
              },
            },
          },
          { status: 400 }
        );
      }
    }

    // 4. Update mileage and create reading inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      const reading = await tx.odometerReading.create({
        data: {
          vehicleId,
          mileage,
          recordedAt,
          source,
          comment,
        },
      });

      // Update the currentMileage field on the vehicle
      const updatedVehicle = await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          currentMileage: mileage,
        },
      });

      return { reading, vehicle: updatedVehicle };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error adding odometer reading:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при обновлении пробега',
        },
      },
      { status: 500 }
    );
  }
}
