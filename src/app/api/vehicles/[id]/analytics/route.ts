import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/server/shared/apiError';
import { requireVehicleAccess } from '@/server/vehicles/access';
import { vehicleBudgetSchema } from '@/lib/validation';
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from '@/domain/money/currencies';

type CurrencyStats = {
  currency: SupportedCurrency;
  service: number;
  fuel: number;
  total: number;
  forecast: number;
  costPerDistance: number | null;
  budget: number | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    const { vehicle, role } = await requireVehicleAccess(id, userId);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const [records, fuelEntries, budgets, firstReading] = await Promise.all([
      prisma.serviceRecord.findMany({
        where: { vehicleId: id, state: 'confirmed', performedAt: { gte: yearStart } },
        include: { planItems: true },
      }),
      prisma.fuelEntry.findMany({
        where: { vehicleId: id, filledAt: { gte: yearStart } },
      }),
      prisma.vehicleBudget.findMany({ where: { vehicleId: id } }),
      prisma.odometerReading.findFirst({
        where: { vehicleId: id, recordedAt: { gte: yearStart } },
        orderBy: { recordedAt: 'asc' },
      }),
    ]);
    const monthsElapsed = Math.max(1, new Date().getMonth() + 1);
    const distance = firstReading
      ? Math.max(0, vehicle.currentMileage - firstReading.mileage)
      : 0;
    const stats = new Map<SupportedCurrency, CurrencyStats>(
      SUPPORTED_CURRENCIES.map((currency) => [
        currency,
        {
          currency,
          service: 0,
          fuel: 0,
          total: 0,
          forecast: 0,
          costPerDistance: null,
          budget: Number(budgets.find((budget) => budget.currency === currency)?.annualLimit) || null,
        },
      ]),
    );
    const monthly = new Map<string, Record<SupportedCurrency, number>>();
    const categories = new Map<string, Record<SupportedCurrency, number>>();
    const add = (
      date: Date,
      currencyValue: string,
      amount: number,
      bucket: 'service' | 'fuel',
      category: string,
    ) => {
      if (!SUPPORTED_CURRENCIES.includes(currencyValue as SupportedCurrency)) return;
      const currency = currencyValue as SupportedCurrency;
      const current = stats.get(currency);
      if (!current) return;
      current[bucket] += amount;
      current.total += amount;
      const month = date.toISOString().slice(0, 7);
      const monthValues = monthly.get(month) || Object.fromEntries(
        SUPPORTED_CURRENCIES.map((code) => [code, 0]),
      ) as Record<SupportedCurrency, number>;
      monthValues[currency] += amount;
      monthly.set(month, monthValues);
      const categoryValues = categories.get(category) || Object.fromEntries(
        SUPPORTED_CURRENCIES.map((code) => [code, 0]),
      ) as Record<SupportedCurrency, number>;
      categoryValues[currency] += amount;
      categories.set(category, categoryValues);
    };
    for (const record of records) {
      const category = record.planItems[0]?.categorySnapshot || 'Прочее обслуживание';
      add(record.performedAt, record.currency, Number(record.totalCost), 'service', category);
    }
    for (const entry of fuelEntries) {
      add(entry.filledAt, entry.currency, Number(entry.totalCost), 'fuel', 'Топливо');
    }
    for (const value of stats.values()) {
      value.forecast = (value.total / monthsElapsed) * 12;
      value.costPerDistance = distance > 0 ? value.total / distance : null;
    }
    return NextResponse.json({
      role,
      vehicle: {
        id: vehicle.id,
        displayName: vehicle.displayName,
        mileageUnit: vehicle.mileageUnit,
        distanceThisYear: distance,
      },
      byCurrency: [...stats.values()].filter((value) => value.total > 0 || value.budget),
      monthly: [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, values]) => ({ month, values })),
      categories: [...categories.entries()].map(([category, values]) => ({ category, values })),
    });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось рассчитать аналитику');
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getSessionUserId();
    const { id } = await params;
    await requireVehicleAccess(id, userId, 'editor');
    const data = vehicleBudgetSchema.parse(await request.json());
    const budget = await prisma.vehicleBudget.upsert({
      where: { vehicleId_currency: { vehicleId: id, currency: data.currency } },
      create: { vehicleId: id, ...data },
      update: { annualLimit: data.annualLimit },
    });
    return NextResponse.json({ budget });
  } catch (error) {
    return apiErrorResponse(error, 'Не удалось сохранить бюджет');
  }
}
