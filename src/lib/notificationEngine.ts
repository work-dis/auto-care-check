import { prisma } from './prisma';
import { calculatePlanStatus } from './statusEngine';

export function calculateScheduledTime(
  now: Date,
  defaultReminderTime: string,
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): Date {
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
  };

  if (quietHoursStart && quietHoursEnd) {
    const start = parseTime(quietHoursStart);
    const end = parseTime(quietHoursEnd);

    const localHours = now.getHours();
    const localMinutes = now.getMinutes();

    const nowMinutesTotal = localHours * 60 + localMinutes;
    const startMinutesTotal = start.hours * 60 + start.minutes;
    const endMinutesTotal = end.hours * 60 + end.minutes;

    let isQuiet = false;
    if (startMinutesTotal < endMinutesTotal) {
      isQuiet = nowMinutesTotal >= startMinutesTotal && nowMinutesTotal <= endMinutesTotal;
    } else {
      isQuiet = nowMinutesTotal >= startMinutesTotal || nowMinutesTotal <= endMinutesTotal;
    }

    if (isQuiet) {
      const scheduled = new Date(now);
      scheduled.setHours(end.hours, end.minutes, 0, 0);
      if (scheduled.getTime() <= now.getTime()) {
        scheduled.setDate(scheduled.getDate() + 1);
      }
      return scheduled;
    }
  }

  return now;
}

export async function checkAndGenerateNotifications() {
  const now = new Date();

  // 1. Fetch active rules
  const activeRules = await prisma.reminderRule.findMany({
    where: { isEnabled: true },
    include: {
      vehicle: {
        include: {
          user: true,
        },
      },
      maintenancePlan: {
        include: {
          category: true,
        },
      },
    },
  });

  let createdCount = 0;

  for (const rule of activeRules) {
    if (!rule.vehicle || !rule.vehicle.user) continue;

    const user = rule.vehicle.user;
    const vehicle = rule.vehicle;

    const plan = rule.maintenancePlan;
    if (!plan || plan.archivedAt) continue;

    // Calculate plan status using statusEngine
    const statusResult = calculatePlanStatus(plan, vehicle, now);
    const { remainingDays, remainingMileage, nextDueAt } = statusResult;

    let triggered = false;
    let severity = 'normal';
    let title = '';
    let body = '';
    let triggerOccurrence = 'default';

    const triggerValueNum = rule.triggerValue ? Number(rule.triggerValue) : 0;

    switch (rule.triggerType) {
      case 'days_before':
        if (remainingDays !== null && remainingDays >= 0 && remainingDays <= triggerValueNum) {
          triggered = true;
          severity = remainingDays <= 3 ? 'critical' : 'warning';
          title = `Приближается срок ТО: ${plan.title}`;
          body = `Осталось ${remainingDays} дн. до выполнения работы по плану "${plan.title}" для автомобиля ${vehicle.displayName}.`;
          triggerOccurrence = `days-${rule.triggerValue}`;
        }
        break;

      case 'mileage_before':
        if (remainingMileage !== null && remainingMileage >= 0 && remainingMileage <= triggerValueNum) {
          triggered = true;
          severity = remainingMileage <= 200 ? 'critical' : 'warning';
          title = `Приближается срок ТО: ${plan.title}`;
          body = `Осталось ${remainingMileage.toLocaleString()} км до выполнения работы по плану "${plan.title}" для автомобиля ${vehicle.displayName}.`;
          triggerOccurrence = `mileage-${rule.triggerValue}`;
        }
        break;

      case 'due_date':
        if (remainingDays !== null && remainingDays <= 0) {
          triggered = true;
          severity = 'critical';
          title = `Срок ТО наступил: ${plan.title}`;
          body = `Срок выполнения работы по плану "${plan.title}" наступил ${nextDueAt ? new Date(nextDueAt).toLocaleDateString('ru-RU') : ''}.`;
          triggerOccurrence = 'due-date';
        }
        break;

      case 'due_mileage':
        if (remainingMileage !== null && remainingMileage <= 0) {
          triggered = true;
          severity = 'critical';
          title = `Лимит пробега достигнут: ${plan.title}`;
          body = `Лимит пробега по плану "${plan.title}" превышен на ${Math.abs(remainingMileage).toLocaleString()} км.`;
          triggerOccurrence = 'due-mileage';
        }
        break;

      case 'overdue_repeat':
        // Check if plan is overdue
        const isOverdue = (remainingDays !== null && remainingDays < 0) || (remainingMileage !== null && remainingMileage < 0);
        if (isOverdue && triggerValueNum > 0) {
          // Check if we should repeat (find last notification sent for this rule)
          const lastNotification = await prisma.notification.findFirst({
            where: {
              reminderRuleId: rule.id,
              status: 'sent',
            },
            orderBy: { createdAt: 'desc' },
          });

          const serviceCycleIdentity = `${plan.lastCompletedAt?.toISOString() || 'init'}-${plan.lastCompletedMileage || 0}`;

          let shouldRepeat = false;
          if (!lastNotification) {
            shouldRepeat = true;
          } else {
            // Check time difference in days
            const diffTime = now.getTime() - lastNotification.createdAt.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            if (diffDays >= triggerValueNum) {
              shouldRepeat = true;
            }
          }

          if (shouldRepeat) {
            triggered = true;
            severity = 'critical';
            title = `Внимание: Просрочено ТО ${plan.title}`;
            body = `Напоминаем: обслуживание по плану "${plan.title}" просрочено! Пожалуйста, выполните работу.`;
            // Unique occurrence identifier based on number of elapsed intervals to prevent deduplication of repeating instances
            const intervalsElapsed = lastNotification 
              ? Math.floor((now.getTime() - lastNotification.createdAt.getTime()) / (triggerValueNum * 24 * 60 * 60 * 1000))
              : 0;
            triggerOccurrence = `repeat-${intervalsElapsed}-${serviceCycleIdentity}`;
          }
        }
        break;

      case 'exact_datetime':
        if (rule.scheduledAt && rule.scheduledAt <= now) {
          triggered = true;
          severity = 'normal';
          title = `Напоминание: ${plan.title}`;
          body = `Запланированное напоминание для работы "${plan.title}" наступило.`;
          triggerOccurrence = `exact-${rule.scheduledAt.toISOString()}`;
        }
        break;

      default:
        break;
    }

    if (triggered) {
      const serviceCycleIdentity = `${plan.lastCompletedAt?.toISOString() || 'init'}-${plan.lastCompletedMileage || 0}`;
      // dedupeKey = reminderRuleId + planId + serviceCycleIdentity + triggerOccurrence
      const dedupeKey = `${rule.id}-${plan.id}-${serviceCycleIdentity}-${triggerOccurrence}`;

      // Calculate scheduledFor time based on user quiet hours
      const scheduledFor = calculateScheduledTime(
        now,
        user.defaultReminderTime,
        user.quietHoursStart,
        user.quietHoursEnd
      );

      try {
        await prisma.notification.create({
          data: {
            userId: user.id,
            vehicleId: vehicle.id,
            reminderRuleId: rule.id,
            maintenancePlanId: plan.id,
            title,
            body,
            severity,
            status: scheduledFor.getTime() <= now.getTime() ? 'sent' : 'pending',
            scheduledFor,
            sentAt: scheduledFor.getTime() <= now.getTime() ? now : null,
            dedupeKey,
          },
        });
        createdCount++;
      } catch (e: unknown) {
        // Unique constraint error means notification is already created (deduplicated)
        if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code !== 'P2002') {
          console.error(`Failed to create notification for rule ${rule.id}:`, e);
        }
      }
    }
  }

  return { createdCount };
}
