import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const vehicles = await prisma.vehicle.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при получении списка автомобилей',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await request.json();

    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка валидации данных автомобиля',
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { currentMileage, ...rest } = parsed.data;

    // Use transaction to create vehicle and initial odometer reading
    const vehicle = await prisma.$transaction(async (tx) => {
      const createdVehicle = await tx.vehicle.create({
        data: {
          userId,
          ...rest,
          currentMileage,
        },
      });

      if (currentMileage > 0) {
        await tx.odometerReading.create({
          data: {
            vehicleId: createdVehicle.id,
            mileage: currentMileage,
            recordedAt: new Date(),
            source: 'manual',
            comment: 'Начальный пробег при создании карточки автомобиля',
          },
        });
      }

      return createdVehicle;
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при создании автомобиля',
        },
      },
      { status: 500 }
    );
  }
}
