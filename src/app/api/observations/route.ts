import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state'); // optional filter

    const where: Record<string, unknown> = {
      vehicle: { userId },
    };

    if (state) {
      where.state = state;
    }

    const observations = await prisma.observation.findMany({
      where,
      include: {
        vehicle: { select: { id: true, displayName: true } },
        maintenancePlan: { select: { id: true, title: true } },
        serviceRecord: { select: { id: true, serviceName: true } },
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
