import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { calculatePlanStatus, calculateReadinessScore } from '@/lib/statusEngine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId();
    const { id: vehicleId } = await params;

    // 1. Fetch vehicle and verify ownership
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
        { error: { code: 'FORBIDDEN', message: 'Доступ запрещен' } },
        { status: 403 }
      );
    }

    // 2. Fetch plans
    const plans = await prisma.maintenancePlan.findMany({
      where: {
        vehicleId,
        archivedAt: null,
      },
      include: {
        category: true,
      },
    });

    // 3. Fetch active observations to map to plans
    const activeObservations = await prisma.observation.findMany({
      where: {
        vehicleId,
        state: { not: 'closed' },
      },
    });

    const observationsMap: Record<string, typeof activeObservations> = {};
    for (const obs of activeObservations) {
      if (obs.maintenancePlanId) {
        if (!observationsMap[obs.maintenancePlanId]) {
          observationsMap[obs.maintenancePlanId] = [];
        }
        observationsMap[obs.maintenancePlanId].push(obs);
      }
    }

    // 4. Calculate statuses for each plan
    const now = new Date();
    const plansWithStatus = plans.map((plan) => {
      const planObservations = observationsMap[plan.id] || [];
      const statusInput = {
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
        observations: planObservations.map((o) => ({
          id: o.id,
          priority: o.priority,
          state: o.state,
        })),
      };

      const statusResult = calculatePlanStatus(statusInput, vehicle, now);
      return {
        ...plan,
        ...statusResult,
      };
    });

    // 5. Calculate readiness score
    const scoreResult = calculateReadinessScore(
      plansWithStatus.map((p) => ({
        status: p.status,
        priority: p.priority,
      }))
    );

    // 6. Group items for dashboard
    const urgentItems = plansWithStatus.filter((p) => p.status === 'overdue');
    const upcomingItems = plansWithStatus.filter((p) => p.status === 'soon');
    const watchItems = plansWithStatus.filter((p) => p.status === 'watch');

    const plansSummary = {
      overdue: urgentItems.length,
      soon: upcomingItems.length,
      watch: watchItems.length,
      normal: plansWithStatus.filter((p) => p.status === 'normal').length,
      unknown: plansWithStatus.filter((p) => p.status === 'unknown').length,
    };

    // 7. Get expenses (last 30 days and YTD)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const serviceRecords = await prisma.serviceRecord.findMany({
      where: {
        vehicleId,
        state: { not: 'voided' },
      },
      select: {
        performedAt: true,
        totalCost: true,
        currency: true,
      },
    });

    let last30Days = 0;
    let yearToDate = 0;
    let currency = 'RUB';

    for (const record of serviceRecords) {
      const cost = Number(record.totalCost);
      const date = new Date(record.performedAt);

      if (date >= thirtyDaysAgo) {
        last30Days += cost;
      }
      if (date >= startOfYear) {
        yearToDate += cost;
      }
      if (record.currency) {
        currency = record.currency;
      }
    }

    // 8. Get latest service record
    const lastServiceRecord = await prisma.serviceRecord.findFirst({
      where: {
        vehicleId,
        state: 'confirmed',
      },
      orderBy: {
        performedAt: 'desc',
      },
    });

    // 9. Count open observations by priority
    const openObsCounts = {
      critical: activeObservations.filter((o) => o.priority === 'critical').length,
      high: activeObservations.filter((o) => o.priority === 'high').length,
      normal: activeObservations.filter((o) => o.priority === 'normal').length,
      total: activeObservations.length,
    };

    return NextResponse.json({
      dashboard: {
        vehicle: {
          id: vehicle.id,
          displayName: vehicle.displayName,
          currentMileage: vehicle.currentMileage,
          mileageUnit: vehicle.mileageUnit,
        },
        readinessScore: scoreResult.score,
        activePlansCount: scoreResult.activePlansCount,
        plansSummary,
        urgentItems,
        upcomingItems,
        watchItems,
        openObservations: openObsCounts,
        lastServiceRecord,
        expenses: {
          last30Days,
          yearToDate,
          currency,
        },
      },
    });
  } catch (error) {
    console.error('Error loading dashboard API:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Ошибка сервера при загрузке дашборда' } },
      { status: 500 }
    );
  }
}
