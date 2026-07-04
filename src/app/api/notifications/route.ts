import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const cursor = searchParams.get('cursor');
    const readFilter = searchParams.get('read'); // 'all' | 'unread' | 'read'
    const tab = searchParams.get('tab'); // 'active' (default) | 'history' | 'all'

    // Build where clause
    const where: Prisma.NotificationWhereInput = { userId };

    if (tab === 'history' || tab === 'all') {
      // History: include stale/cancelled; all: include everything
      if (tab === 'history') {
        where.status = { in: ['sent', 'pending', 'stale', 'cancelled'] };
      }
    } else {
      // Active (default): sent or pending with scheduledFor <= now
      where.OR = [
        { status: 'sent' },
        {
          status: 'pending',
          scheduledFor: { lte: new Date() },
        },
      ];
    }

    // Read filter
    if (readFilter === 'unread') {
      where.readAt = null;
    } else if (readFilter === 'read') {
      where.readAt = { not: null };
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    return NextResponse.json({
      notifications,
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении уведомлений' } },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const userId = await getSessionUserId();

    // Mark all as read
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        OR: [
          { status: 'sent' },
          {
            status: 'pending',
            scheduledFor: {
              lte: new Date(),
            },
          },
        ],
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при обновлении уведомлений' } },
      { status: 500 }
    );
  }
}
