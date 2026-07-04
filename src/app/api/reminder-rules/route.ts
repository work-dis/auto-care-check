import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { reminderRuleSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const searchParams = request.nextUrl.searchParams;
    const vehicleId = searchParams.get('vehicleId');
    const planId = searchParams.get('maintenancePlanId');

    if (vehicleId) {
      // Check vehicle ownership
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!vehicle || vehicle.userId !== userId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
          { status: 403 }
        );
      }

      const whereClause: { vehicleId: string; maintenancePlanId?: string } = { vehicleId };
      if (planId) {
        whereClause.maintenancePlanId = planId;
      }

      const rules = await prisma.reminderRule.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ reminderRules: rules });
    }

    // If no vehicleId, return all rules belonging to user's vehicles
    const rules = await prisma.reminderRule.findMany({
      where: {
        vehicle: {
          userId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reminderRules: rules });
  } catch (error) {
    console.error('Error fetching reminder rules:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при получении правил напоминаний' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await request.json();

    const validation = reminderRuleSchema.safeParse(body);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0] as string] = issue.message;
        }
      });
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Некорректные параметры правила', fieldErrors } },
        { status: 400 }
      );
    }

    const { maintenancePlanId, observationId, triggerType, triggerValue, sendAtLocalTime, isEnabled } = validation.data;

    // Check ownership of the target plan or observation
    let targetVehicleId: string | null = null;

    if (maintenancePlanId) {
      const plan = await prisma.maintenancePlan.findUnique({
        where: { id: maintenancePlanId },
        include: { vehicle: true },
      });
      if (!plan || plan.vehicle.userId !== userId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'У вас нет доступа к этому плану обслуживания' } },
          { status: 403 }
        );
      }
      targetVehicleId = plan.vehicleId;
    } else if (observationId) {
      const observation = await prisma.observation.findUnique({
        where: { id: observationId },
        include: { vehicle: true },
      });
      if (!observation || observation.vehicle.userId !== userId) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'У вас нет доступа к этому наблюдению' } },
          { status: 403 }
        );
      }
      targetVehicleId = observation.vehicleId;
    }

    if (!targetVehicleId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Правило должно быть привязано к плану обслуживания или наблюдению' } },
        { status: 400 }
      );
    }

    // Check for exact duplicates of rules to prevent noise (ТЗ сценарий 10: Запрет на создание дубликата одинакового уведомления/правила)
    const existingRule = await prisma.reminderRule.findFirst({
      where: {
        vehicleId: targetVehicleId,
        maintenancePlanId,
        observationId,
        triggerType,
        triggerValue: triggerValue || null,
      },
    });

    if (existingRule) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Такое правило напоминания уже существует для этого элемента' } },
        { status: 409 }
      );
    }

    const rule = await prisma.reminderRule.create({
      data: {
        vehicleId: targetVehicleId,
        maintenancePlanId,
        observationId,
        triggerType,
        triggerValue: triggerValue || null,
        sendAtLocalTime,
        isEnabled,
      },
    });

    // Write AuditEvent
    await prisma.auditEvent.create({
      data: {
        userId,
        entityType: 'ReminderRule',
        entityId: rule.id,
        action: 'CREATE',
        afterJson: JSON.stringify(rule),
      },
    });

    return NextResponse.json({ reminderRule: rule });
  } catch (error) {
    console.error('Error creating reminder rule:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при создании правила' } },
      { status: 500 }
    );
  }
}
