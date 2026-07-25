import { prisma } from '@/lib/prisma';
import { buildReminderHtml, isEmailConfigured, sendEmail } from '@/lib/email';
import { webPush } from '@/lib/webPush';

const MAX_ATTEMPTS = 3;
const PROCESSING_LEASE_MS = 10 * 60 * 1000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 1000) : 'Unknown delivery error';
}

async function sendPush(notification: {
  id: string;
  userId: string;
  vehicleId: string;
  title: string;
  body: string;
}) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: notification.userId },
  });
  if (subscriptions.length === 0) throw new Error('No active push subscriptions');

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
    subscriptions.map((subscription) =>
      webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
      ),
    ),
  );

  let successful = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result.status === 'fulfilled') {
      successful += 1;
      continue;
    }
    const reason = result.reason;
    if (
      reason &&
      typeof reason === 'object' &&
      'statusCode' in reason &&
      (reason.statusCode === 404 || reason.statusCode === 410)
    ) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: subscriptions[index].endpoint },
      });
    }
  }
  if (successful === 0) throw new Error('Push delivery failed for every subscription');
}

async function deliver(notification: {
  id: string;
  userId: string;
  vehicleId: string;
  title: string;
  body: string;
  severity: string;
  reminderRule: { channel: string } | null;
  user: { email: string | null };
  vehicle: { displayName: string };
  maintenancePlan: { title: string } | null;
}) {
  const channel = notification.reminderRule?.channel || 'in_app';
  if (channel === 'in_app') return;
  if (channel === 'push') return sendPush(notification);
  if (channel === 'email') {
    if (!isEmailConfigured() || !notification.user.email) {
      throw new Error('Email delivery is not configured for this user');
    }
    const sent = await sendEmail({
      to: notification.user.email,
      subject: `AutoPulse — ${notification.title}`,
      text: notification.body,
      html: buildReminderHtml({
        title: notification.title,
        body: notification.body,
        vehicleName: notification.vehicle.displayName,
        planName: notification.maintenancePlan?.title || 'Обслуживание',
        severity: notification.severity,
      }),
    });
    if (!sent) throw new Error('SMTP delivery failed');
    return;
  }
  throw new Error(`Unsupported notification channel: ${channel}`);
}

export async function deliverDueNotifications(now = new Date()) {
  await prisma.notification.updateMany({
    where: {
      status: 'processing',
      processingAt: { lt: new Date(now.getTime() - PROCESSING_LEASE_MS) },
      deliveryAttempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: 'pending',
      processingAt: null,
      lastError: 'Предыдущая попытка доставки была прервана и возвращена в очередь',
    },
  });

  await prisma.notification.updateMany({
    where: {
      status: 'processing',
      processingAt: { lt: new Date(now.getTime() - PROCESSING_LEASE_MS) },
      deliveryAttempts: { gte: MAX_ATTEMPTS },
    },
    data: {
      status: 'failed',
      processingAt: null,
      lastError: 'Превышено число попыток после прерванной доставки',
    },
  });

  const due = await prisma.notification.findMany({
    where: { status: 'pending', scheduledFor: { lte: now } },
    include: {
      reminderRule: { select: { channel: true } },
      user: { select: { email: true } },
      vehicle: { select: { displayName: true } },
      maintenancePlan: { select: { title: true } },
    },
    take: 100,
    orderBy: { scheduledFor: 'asc' },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (const notification of due) {
    const claimed = await prisma.notification.updateMany({
      where: { id: notification.id, status: 'pending' },
      data: {
        status: 'processing',
        processingAt: now,
        deliveryAttempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) continue;

    try {
      await deliver(notification);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'sent', sentAt: new Date(), processingAt: null, lastError: null },
      });
      sentCount += 1;
    } catch (error) {
      const nextAttempt = notification.deliveryAttempts + 1;
      const retry = nextAttempt < MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: retry ? 'pending' : 'failed',
          processingAt: null,
          lastError: errorMessage(error),
          scheduledFor: retry
            ? new Date(now.getTime() + 5 * 60 * 1000 * 2 ** (nextAttempt - 1))
            : notification.scheduledFor,
        },
      });
      failedCount += 1;
    }
  }

  return { sentCount, failedCount };
}
