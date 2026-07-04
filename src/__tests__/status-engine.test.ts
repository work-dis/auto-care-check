import { describe, it, expect } from 'vitest';
import { calculatePlanStatus, calculateReadinessScore } from '../lib/statusEngine';

const basePlan = {
  id: 'plan-1',
  kind: 'scheduled_service',
  priority: 'normal',
  scheduleMode: 'date_only',
  intervalDays: 365,
  intervalMileage: 10000,
  lastCompletedAt: new Date('2026-01-01T00:00:00Z'),
  lastCompletedMileage: 50000,
  manualDueAt: null,
  manualDueMileage: null,
  soonDaysThreshold: 30,
  soonMileageThreshold: 1000,
  watchDaysThreshold: 90,
  watchMileageThreshold: 3000,
  manualStatus: 'auto',
  disabledAt: null,
  archivedAt: null,
};

const baseVehicle = {
  currentMileage: 55000,
};

describe('Status Engine Unit Tests', () => {
  // Test 1: Расчет срока только по дате
  it('should calculate due date correctly for date_only mode', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'date_only',
      intervalDays: 30,
      lastCompletedAt: new Date('2026-01-01T00:00:00Z'),
    };
    const now = new Date('2026-01-15T00:00:00Z');
    
    const result = calculatePlanStatus(plan, baseVehicle, now);
    expect(result.nextDueAt?.toISOString()).toBe(new Date('2026-01-31T00:00:00Z').toISOString());
    expect(result.remainingDays).toBe(16);
    expect(result.status).toBe('soon'); // 16 <= soonDaysThreshold (30)
  });

  // Test 2: Расчет срока только по пробегу
  it('should calculate due mileage correctly for mileage_only mode', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'mileage_only',
      intervalMileage: 10000,
      lastCompletedMileage: 50000,
    };
    const vehicle = { currentMileage: 55000 };
    
    const result = calculatePlanStatus(plan, vehicle, new Date());
    expect(result.nextDueMileage).toBe(60000);
    expect(result.remainingMileage).toBe(5000);
    expect(result.status).toBe('normal'); // 5000 > soonMileageThreshold (1000)
  });

  // Test 3: «Что наступит раньше» — дата наступает раньше пробега
  it('should select date status if date is worse in whichever_comes_first mode', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'whichever_comes_first',
      intervalDays: 10, // nextDueAt: 2026-01-11
      intervalMileage: 10000, // nextDueMileage: 60000
    };
    const now = new Date('2026-01-09T00:00:00Z'); // remainingDays: 2 (soon)
    const vehicle = { currentMileage: 51000 }; // remainingMileage: 9000 (normal)
    
    const result = calculatePlanStatus(plan, vehicle, now);
    expect(result.status).toBe('soon');
  });

  // Test 4: «Что наступит раньше» — пробег наступает раньше даты
  it('should select mileage status if mileage is worse in whichever_comes_first mode', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'whichever_comes_first',
      intervalDays: 100, // nextDueAt: 2026-04-11
      intervalMileage: 5000, // nextDueMileage: 55000
    };
    const now = new Date('2026-01-05T00:00:00Z'); // remainingDays: 96 (normal)
    const vehicle = { currentMileage: 54500 }; // remainingMileage: 500 (soon)
    
    const result = calculatePlanStatus(plan, vehicle, now);
    expect(result.status).toBe('soon');
  });

  // Test 5: Переход в статус overdue по дате
  it('should transition to overdue status when nextDueAt has passed', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'date_only',
      intervalDays: 10, // nextDueAt: 2026-01-11
    };
    const now = new Date('2026-01-15T00:00:00Z'); // remainingDays: -4 (overdue)
    
    const result = calculatePlanStatus(plan, baseVehicle, now);
    expect(result.status).toBe('overdue');
    expect(result.statusReason).toContain('Просрочено на 4 дня');
  });

  // Test 6: Переход в статус overdue по пробегу
  it('should transition to overdue status when currentMileage exceeds nextDueMileage', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'mileage_only',
      intervalMileage: 5000, // nextDueMileage: 55000
    };
    const vehicle = { currentMileage: 56200 }; // remainingMileage: -1200 (overdue)
    
    const result = calculatePlanStatus(plan, vehicle, new Date());
    expect(result.status).toBe('overdue');
    expect(result.statusReason).toContain('Просрочено на 1200 км');
  });

  // Test 7: Переход в статус unknown при нехватке данных
  it('should return unknown status when completed dates/mileages are missing', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'date_only',
      lastCompletedAt: null, // missing completed date
    };
    
    const result = calculatePlanStatus(plan, baseVehicle, new Date());
    expect(result.status).toBe('unknown');
    expect(result.statusReason).toBe('Недостаточно данных для расчета');
  });

  // Test 8: Обновление пробега автомобиля корректно меняет статус планов
  it('should change status as vehicle mileage increases', () => {
    const plan = {
      ...basePlan,
      scheduleMode: 'mileage_only',
      intervalMileage: 10000, // nextDueMileage: 60000
      soonMileageThreshold: 1000,
      watchMileageThreshold: 3000,
    };
    
    // Normal state
    let res = calculatePlanStatus(plan, { currentMileage: 55000 }, new Date());
    expect(res.status).toBe('normal');

    // Watch state (<= 3000 km remaining)
    res = calculatePlanStatus(plan, { currentMileage: 57500 }, new Date());
    expect(res.status).toBe('watch');

    // Soon state (<= 1000 km remaining)
    res = calculatePlanStatus(plan, { currentMileage: 59200 }, new Date());
    expect(res.status).toBe('soon');

    // Overdue state
    res = calculatePlanStatus(plan, { currentMileage: 60500 }, new Date());
    expect(res.status).toBe('overdue');
  });

  // Test 9: Вычисление Readiness Score и веса
  describe('Readiness Score', () => {
    it('should calculate correct score deductions based on status and priority weight', () => {
      const activePlans = [
        { status: 'overdue' as const, priority: 'critical' }, // penalty = 18 * 2.0 = 36
        { status: 'soon' as const, priority: 'high' },      // penalty = 7 * 1.5 = 10.5
        { status: 'watch' as const, priority: 'normal' },   // penalty = 4 * 1.0 = 4
        { status: 'unknown' as const, priority: 'normal' }, // penalty = 2 * 1.0 = 2
      ];

      // Total deduction: 36 + 10.5 + 4 + 2 = 52.5 => rounded penalty = 53
      // Final Score = 100 - 52.5 = 47.5 => rounded to 48
      const result = calculateReadinessScore(activePlans);
      expect(result.score).toBe(48);
      expect(result.activePlansCount).toBe(4);
    });

    it('should lock score between [0, 100]', () => {
      const activePlans = [
        { status: 'overdue' as const, priority: 'critical' }, // -36
        { status: 'overdue' as const, priority: 'critical' }, // -36
        { status: 'overdue' as const, priority: 'critical' }, // -36
      ]; // Total deduction: 108 => should clamp to 0
      
      const result = calculateReadinessScore(activePlans);
      expect(result.score).toBe(0);
    });

    it('should ignore disabled plans in score calculations', () => {
      const plans = [
        { status: 'overdue' as const, priority: 'normal' }, // -18
        { status: 'disabled' as const, priority: 'critical' }, // ignored
      ];
      
      const result = calculateReadinessScore(plans);
      expect(result.score).toBe(82); // 100 - 18
      expect(result.activePlansCount).toBe(1);
    });
  });
});
