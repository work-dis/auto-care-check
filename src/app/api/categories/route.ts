import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('vehicleId');

    // If vehicleId is provided, check if it belongs to the user
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });

      if (!vehicle || vehicle.userId !== userId) {
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
    }

    // Fetch system categories and vehicle-specific categories
    const categories = await prisma.maintenanceCategory.findMany({
      where: {
        archivedAt: null,
        OR: [
          { isSystem: true },
          ...(vehicleId ? [{ vehicleId }] : []),
        ],
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при получении категорий',
        },
      },
      { status: 500 }
    );
  }
}
