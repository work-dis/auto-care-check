import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';
import { decryptVehicleFields, encryptSensitiveValue } from '@/lib/sensitiveData';

export async function GET() {
  try {
    const userId = await getSessionUserId();
    const vehicles = await prisma.vehicle.findMany({
      where: {
        archivedAt: null,
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ vehicles: vehicles.map(decryptVehicleFields) });
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

    const { currentMileage, plateNumberEncryptedOrMasked, vinEncryptedOrMasked, ...rest } = parsed.data;

    // Use transaction to create vehicle and initial odometer reading
    const vehicle = await prisma.$transaction(async (tx) => {
      const activeVehicleCount = await tx.vehicle.count({
        where: { userId, archivedAt: null },
      });
      const createdVehicle = await tx.vehicle.create({
        data: {
          userId,
          ...rest,
          plateNumberEncryptedOrMasked: encryptSensitiveValue(plateNumberEncryptedOrMasked),
          vinEncryptedOrMasked: encryptSensitiveValue(vinEncryptedOrMasked),
          currentMileage,
          isPrimary: activeVehicleCount === 0,
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

    return NextResponse.json({ vehicle: decryptVehicleFields(vehicle) }, { status: 201 });
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
