import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUnauthorizedError, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { endpoint, p256dh, auth, userAgent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: endpoint, p256dh, auth' } },
        { status: 400 }
      );
    }

    // Upsert by endpoint
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json({ ok: true, subscription: { id: subscription.id } });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      );
    }

    console.error('Error subscribing to push:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при подписке на push-уведомления' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required field: endpoint' } },
        { status: 400 }
      );
    }

    // Only delete if it belongs to the current user
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (!existing) {
      return NextResponse.json({ ok: true });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Subscription belongs to another user' } },
        { status: 403 }
      );
    }

    await prisma.pushSubscription.delete({
      where: { endpoint },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Требуется авторизация' } },
        { status: 401 }
      );
    }

    console.error('Error unsubscribing from push:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при отписке от push-уведомлений' } },
      { status: 500 }
    );
  }
}
