import { NextRequest, NextResponse } from 'next/server';
import { checkAndGenerateNotifications } from '@/lib/notificationEngine';
import { prisma } from '@/lib/prisma';
import { webPush } from '@/lib/webPush';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Send push notifications for pending notifications that are now due.
 */
async function sendPendingPushNotifications(): Promise<number> {
  const now = new Date();

  const pendingNotifications = await prisma.notification.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
    },
    include: {
      reminderRule: true,
      user: true,
    },
  });

  let sentCount = 0;

  for (const notification of pendingNotifications) {
    // Mark as sent
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'sent',
        sentAt: now,
      },
    });

    sentCount++;

    // If push-enabled, send the push
    if (
      notification.reminderRule &&
      (notification.reminderRule.channel === 'push' || notification.reminderRule.channel === 'in_app')
    ) {
      try {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId: notification.userId },
        });

        if (subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: notification.title,
            body: notification.body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            data: {
              url: '/dashboard',
              notificationId: notification.id,
              vehicleId: notification.vehicleId,
            },
          });

          const results = await Promise.allSettled(
            subscriptions.map((sub) =>
              webPush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              )
            )
          );

          // Clean up invalid subscriptions
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'rejected') {
              const err = result.reason;
              if (
                err &&
                typeof err === 'object' &&
                'statusCode' in err &&
                (err.statusCode === 410 || err.statusCode === 404)
              ) {
                try {
                  await prisma.pushSubscription.delete({
                    where: { endpoint: subscriptions[i].endpoint },
                  });
                } catch {
                  // already deleted
                }
              }
            }
          }
        }
      } catch (pushError) {
        console.error(`[Push cron] Failed to send push for notification ${notification.id}:`, pushError);
      }
    }
  }

  return sentCount;
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
    const pendingSent = await sendPendingPushNotifications();

    return NextResponse.json({
      ok: true,
      createdCount: generationResult.createdCount,
      pendingSentCount: pendingSent,
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
