import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';

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

    return NextResponse.json({ vehicle });
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

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ vehicle: updatedVehicle });
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

    // 2. Soft delete / Archive
    const archivedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
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
