import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { maintenancePlanSchema } from '@/lib/validation';
import { calculatePlanStatus } from '@/lib/statusEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // Verify vehicle ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Автомобиль не найден' } },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'У вас нет доступа к этому автомобилю' } },
        { status: 403 }
      );
    }

    const plans = await prisma.maintenancePlan.findMany({
      where: { vehicleId, archivedAt: null },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch active observations linked to plans
    const activeObservations = await prisma.observation.findMany({
      where: { vehicleId, state: { not: 'closed' } },
      select: { id: true, maintenancePlanId: true, priority: true, state: true },
    });

    const obsMap: Record<string, typeof activeObservations> = {};
    for (const obs of activeObservations) {
      if (obs.maintenancePlanId) {
        if (!obsMap[obs.maintenancePlanId]) obsMap[obs.maintenancePlanId] = [];
        obsMap[obs.maintenancePlanId].push(obs);
      }
    }

    const now = new Date();
    const plansWithStatus = plans.map((plan) => {
      const statusResult = calculatePlanStatus(
        {
          id: plan.id,
          kind: plan.kind,
          priority: plan.priority,
          scheduleMode: plan.scheduleMode,
          intervalDays: plan.intervalDays,
          intervalMileage: plan.intervalMileage,
          lastCompletedAt: plan.lastCompletedAt,
          lastCompletedMileage: plan.lastCompletedMileage,
          manualDueAt: plan.manualDueAt,
          manualDueMileage: plan.manualDueMileage,
          soonDaysThreshold: plan.soonDaysThreshold,
          soonMileageThreshold: plan.soonMileageThreshold,
          watchDaysThreshold: plan.watchDaysThreshold,
          watchMileageThreshold: plan.watchMileageThreshold,
          manualStatus: plan.manualStatus,
          disabledAt: plan.disabledAt,
          archivedAt: plan.archivedAt,
          observations: (obsMap[plan.id] || []).map((o) => ({
            id: o.id,
            priority: o.priority,
            state: o.state,
          })),
        },
        vehicle,
        now
      );
      return { ...plan, ...statusResult };
    });

    return NextResponse.json({ plans: plansWithStatus });
  } catch (error) {
    console.error('Error fetching maintenance plans:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Внутренняя ошибка сервера' } },
      { status: 500 }
    );
  }
}


export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;
    const body = await request.json();

    // 1. Fetch vehicle and check ownership
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Автомобиль не найден',
          },
        },
        { status: 404 }
      );
    }

    if (vehicle.userId !== userId) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'У вас нет доступа к этому автомобилю',
          },
        },
        { status: 403 }
      );
    }

    // 2. Validate plan data
    const parsed = maintenancePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Ошибка валидации плана обслуживания',
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const planData = parsed.data;

    // Verify category exists
    const category = await prisma.maintenanceCategory.findUnique({
      where: { id: planData.categoryId },
    });

    if (!category) {
      return NextResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Указанная категория обслуживания не найдена',
          },
        },
        { status: 404 }
      );
    }

    // 3. Create Maintenance Plan
    const plan = await prisma.maintenancePlan.create({
      data: {
        vehicleId,
        ...planData,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance plan:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Произошла внутренняя ошибка сервера при создании плана ТО',
        },
      },
      { status: 500 }
    );
  }
}
