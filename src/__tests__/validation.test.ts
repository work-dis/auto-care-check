import { describe, it, expect } from 'vitest';
import { vehicleSchema, odometerSchema, maintenancePlanSchema } from '../lib/validation';

describe('Validation Schemas', () => {
  describe('Vehicle Schema', () => {
    it('should validate correct vehicle details', () => {
      const valid = {
        displayName: 'My Audi',
        make: 'Audi',
        model: 'A4',
        year: 2018,
        currentMileage: 120000,
        mileageUnit: 'km',
      };
      const result = vehicleSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid year and negative mileage', () => {
      const invalid = {
        displayName: 'My Audi',
        make: 'Audi',
        model: 'A4',
        year: 1899,
        currentMileage: -50,
      };
      const result = vehicleSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.year).toBeDefined();
        expect(errors.currentMileage).toBeDefined();
      }
    });
  });

  describe('Odometer Schema', () => {
    it('should validate valid mileage log', () => {
      const valid = {
        mileage: 95000,
        source: 'manual',
        comment: 'Regular check',
      };
      const result = odometerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject negative mileage', () => {
      const invalid = {
        mileage: -10,
        source: 'manual',
      };
      const result = odometerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('Maintenance Plan Schema', () => {
    it('should validate plan with date_only if intervalDays is provided', () => {
      const valid = {
        categoryId: 'cat-id-123',
        title: 'Замена тормозной жидкости',
        kind: 'scheduled_service',
        priority: 'high',
        scheduleMode: 'date_only',
        intervalDays: 730,
        soonDaysThreshold: 30,
        watchDaysThreshold: 90,
      };
      const result = maintenancePlanSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject date_only plan if intervalDays is missing', () => {
      const invalid = {
        categoryId: 'cat-id-123',
        title: 'Замена тормозной жидкости',
        kind: 'scheduled_service',
        priority: 'high',
        scheduleMode: 'date_only',
        intervalDays: null,
      };
      const result = maintenancePlanSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should validate whichever_comes_first if both intervals are provided', () => {
      const valid = {
        categoryId: 'cat-id-123',
        title: 'Замена ремня ГРМ',
        kind: 'scheduled_service',
        priority: 'critical',
        scheduleMode: 'whichever_comes_first',
        intervalDays: 1825,
        intervalMileage: 90000,
      };
      const result = maintenancePlanSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject whichever_comes_first if either interval is missing', () => {
      const invalid = {
        categoryId: 'cat-id-123',
        title: 'Замена ремня ГРМ',
        kind: 'scheduled_service',
        priority: 'critical',
        scheduleMode: 'whichever_comes_first',
        intervalDays: 1825,
        intervalMileage: null,
      };
      const result = maintenancePlanSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
