import { NextRequest, NextResponse } from 'next/server';
import { checkAndGenerateNotifications } from '@/lib/notificationEngine';

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
    const result = await checkAndGenerateNotifications();

    return NextResponse.json({
      ok: true,
      createdCount: result.createdCount,
      elapsedMs: Date.now() - startedAt,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron notifications job failed:', error);
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
