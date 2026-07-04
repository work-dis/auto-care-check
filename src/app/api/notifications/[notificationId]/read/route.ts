import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { notificationId } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Уведомление не найдено' } },
        { status: 404 }
      );
    }

    if (notification.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error('Error marking notification read:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при прочтении уведомления' } },
      { status: 500 }
    );
  }
}
