import { prisma } from '@/lib/prisma';
import { calculatePlanStatus } from '@/domain/maintenance/statusEngine';

export function calculateScheduledTime(
  now: Date,
  timezone: string,
  reminderTime: string,
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): Date {
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return { hours: h, minutes: m };
  };

  const getLocalParts = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hours: value('hour'),
      minutes: value('minute'),
    };
  };

  const localDateTimeToUtc = (
    local: { year: number; month: number; day: number; hours: number; minutes: number },
  ) => {
    const desired = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hours,
      local.minutes,
    );
    let guess = desired;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const actual = getLocalParts(new Date(guess));
      const actualAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hours,
        actual.minutes,
      );
      const correction = desired - actualAsUtc;
      if (correction === 0) break;
      guess += correction;
    }
    return new Date(guess);
  };

  const shiftLocalDay = (
    local: { year: number; month: number; day: number },
    days: number,
  ) => {
    const shifted = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  };

  const localNow = getLocalParts(now);
  const target = parseTime(reminderTime);
  let scheduled = localDateTimeToUtc({ ...localNow, ...target });
  if (scheduled < now) scheduled = now;

  if (quietHoursStart && quietHoursEnd) {
    const start = parseTime(quietHoursStart);
    const end = parseTime(quietHoursEnd);
    const scheduledLocal = getLocalParts(scheduled);
    const scheduledMinutes = scheduledLocal.hours * 60 + scheduledLocal.minutes;
    const startMinutesTotal = start.hours * 60 + start.minutes;
    const endMinutesTotal = end.hours * 60 + end.minutes;
    const crossesMidnight = startMinutesTotal >= endMinutesTotal;
    const isQuiet = crossesMidnight
      ? scheduledMinutes >= startMinutesTotal || scheduledMinutes < endMinutesTotal
      : scheduledMinutes >= startMinutesTotal && scheduledMinutes < endMinutesTotal;

    if (isQuiet) {
      const addDay = crossesMidnight && scheduledMinutes >= startMinutesTotal ? 1 : 0;
      const endDate = shiftLocalDay(scheduledLocal, addDay);
      scheduled = localDateTimeToUtc({ ...endDate, ...end });
    }
  }

  return scheduled;
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
      observation: true,
    },
  });

  let createdCount = 0;

  for (const rule of activeRules) {
    if (!rule.vehicle || !rule.vehicle.user) continue;

    const user = rule.vehicle.user;
    const vehicle = rule.vehicle;

    const plan = rule.maintenancePlan;
    if (!plan) {
      const observation = rule.observation;
      if (
        observation &&
        observation.state !== 'closed' &&
        rule.triggerType === 'exact_datetime' &&
        rule.scheduledAt &&
        rule.scheduledAt <= now
      ) {
        try {
          await prisma.notification.create({
            data: {
              userId: user.id,
              vehicleId: vehicle.id,
              reminderRuleId: rule.id,
              title: `Нужно проверить: ${observation.title}`,
              body: observation.description || `Проверьте наблюдение для ${vehicle.displayName}.`,
              severity:
                observation.priority === 'critical'
                  ? 'critical'
                  : observation.priority === 'high'
                    ? 'warning'
                    : 'normal',
              status: 'pending',
              scheduledFor: calculateScheduledTime(
                now,
                user.timezone,
                '00:00',
                user.quietHoursStart,
                user.quietHoursEnd,
              ),
              dedupeKey: `observation-${observation.id}-${rule.id}-${rule.scheduledAt.toISOString()}`,
            },
          });
          createdCount += 1;
        } catch (error: unknown) {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code: string }).code !== 'P2002'
          ) {
            throw error;
          }
        }
      }
      continue;
    }
    if (plan.archivedAt) continue;

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
        user.timezone,
        rule.sendAtLocalTime || user.defaultReminderTime,
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
            status: 'pending',
            scheduledFor,
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

  const expiringDocuments = await prisma.vehicleDocument.findMany({
    where: {
      expiresAt: {
        not: null,
        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      vehicle: {
        include: { user: true },
      },
    },
  });

  for (const document of expiringDocuments) {
    if (!document.expiresAt) continue;
    const remainingDays = Math.ceil(
      (document.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    const occurrence = remainingDays < 0 ? 'overdue' : remainingDays <= 7 ? 'seven-days' : 'thirty-days';
    const title =
      remainingDays < 0
        ? `Истёк документ: ${document.title}`
        : `Истекает документ: ${document.title}`;
    const body =
      remainingDays < 0
        ? `Срок документа для ${document.vehicle.displayName} истёк ${document.expiresAt.toLocaleDateString('ru-RU')}.`
        : `До окончания срока документа для ${document.vehicle.displayName} осталось ${remainingDays} дн.`;
    try {
      await prisma.notification.create({
        data: {
          userId: document.vehicle.userId,
          vehicleId: document.vehicleId,
          title,
          body,
          severity: remainingDays <= 7 ? 'critical' : 'warning',
          status: 'pending',
          scheduledFor: calculateScheduledTime(
            now,
            document.vehicle.user.timezone,
            document.vehicle.user.defaultReminderTime,
            document.vehicle.user.quietHoursStart,
            document.vehicle.user.quietHoursEnd,
          ),
          dedupeKey: `document-${document.id}-${document.expiresAt.toISOString()}-${occurrence}`,
        },
      });
      createdCount += 1;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code !== 'P2002'
      ) {
        throw error;
      }
    }
  }

  return { createdCount };
}
