import { NextRequest, NextResponse } from 'next/server';
import { checkAndGenerateNotifications } from '@/lib/notificationEngine';
import { deliverDueNotifications } from '@/server/notifications/delivery.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid cron authorization',
        },
      },
      { status: 401 }
    );
  }

  try {
    const startedAt = Date.now();

    // 1. Check and generate new notifications from rules
    const generationResult = await checkAndGenerateNotifications();

    // 2. Send any pending notifications that are now due
    const deliveryResult = await deliverDueNotifications();
    logger.info('notification_cron_completed', {
      createdCount: generationResult.createdCount,
      sentCount: deliveryResult.sentCount,
      failedCount: deliveryResult.failedCount,
      elapsedMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      createdCount: generationResult.createdCount,
      sentCount: deliveryResult.sentCount,
      failedCount: deliveryResult.failedCount,
      elapsedMs: Date.now() - startedAt,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('notification_cron_failed', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        error: {
          code: 'CRON_JOB_FAILED',
          message: 'Не удалось выполнить cron-задачу уведомлений',
        },
      },
      { status: 500 }
    );
  }
}
