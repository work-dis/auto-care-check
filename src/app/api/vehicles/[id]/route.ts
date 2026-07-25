import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';
import { hasVehicleAccess } from '@/server/vehicles/access';
import { decryptVehicleFields, encryptSensitiveValue } from '@/lib/sensitiveData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
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

    if (!(await hasVehicleAccess(vehicle.id, vehicle.userId, userId))) {
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

    return NextResponse.json({ vehicle: decryptVehicleFields(vehicle) });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при получении данных автомобиля',
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const body = await request.json();

    // 1. Fetch vehicle and check ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
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

    if (!(await hasVehicleAccess(vehicle.id, vehicle.userId, userId, 'editor'))) {
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

    // 2. Validate update data (partial schema)
    const partialSchema = vehicleSchema.partial();
    const parsed = partialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка валидации при обновлении автомобиля',
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updateData = { ...parsed.data };
    delete updateData.currentMileage;
    delete updateData.mileageUnit;
    if (updateData.plateNumberEncryptedOrMasked !== undefined) {
      updateData.plateNumberEncryptedOrMasked = encryptSensitiveValue(
        updateData.plateNumberEncryptedOrMasked,
      );
    }
    if (updateData.vinEncryptedOrMasked !== undefined) {
      updateData.vinEncryptedOrMasked = encryptSensitiveValue(updateData.vinEncryptedOrMasked);
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ vehicle: decryptVehicleFields(updatedVehicle) });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при обновлении данных автомобиля',
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;

    // 1. Fetch vehicle and check ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
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

    if (!(await hasVehicleAccess(vehicle.id, vehicle.userId, userId, 'owner'))) {
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

    // 2. Soft delete / Archive
    const archivedVehicle = await prisma.$transaction(async (tx) => {
      const archived = await tx.vehicle.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          isPrimary: false,
        },
      });
      if (vehicle.isPrimary) {
        const replacement = await tx.vehicle.findFirst({
          where: { userId, archivedAt: null, id: { not: id } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (replacement) {
          await tx.vehicle.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }
      }
      return archived;
    });

    return NextResponse.json({
      message: 'Автомобиль успешно архивирован',
      vehicle: archivedVehicle,
    });
  } catch (error) {
    console.error('Error archiving vehicle:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при архивации автомобиля',
        },
      },
      { status: 500 }
    );
  }
}
