import { z } from 'zod';

// 1. Vehicle Validation Schema
export const vehicleSchema = z.object({
  displayName: z.string().min(1, 'Укажите название автомобиля (например, Моя Camry)'),
  make: z.string().min(1, 'Укажите марку автомобиля'),
  model: z.string().min(1, 'Укажите модель автомобиля'),
  year: z
    .number()
    .int()
    .min(1900, 'Год выпуска должен быть не ранее 1900')
    .max(new Date().getFullYear() + 1, 'Недопустимый год выпуска'),
  currentMileage: z.number().int().min(0, 'Пробег не может быть отрицательным').default(0),
  mileageUnit: z.enum(['km', 'mi']).default('km'),
  plateNumberEncryptedOrMasked: z.string().nullable().optional(),
  vinEncryptedOrMasked: z.string().nullable().optional(),
  fuelType: z.string().nullable().optional(),
  transmission: z.string().nullable().optional(),
  engineDescription: z.string().nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// 2. Odometer Reading Validation Schema
export const odometerSchema = z.object({
  mileage: z.number().int().min(0, 'Пробег не может быть отрицательным'),
  recordedAt: z
    .string()
    .transform((str) => new Date(str))
    .or(z.date())
    .default(() => new Date()),
  source: z.enum(['manual', 'service_record', 'import', 'correction']),
  comment: z.string().nullable().optional(),
});

// 3. Maintenance Plan Validation Schema
export const maintenancePlanSchema = z
  .object({
    categoryId: z.string().min(1, 'Категория обязательна'),
    title: z.string().min(1, 'Укажите название регламентной работы'),
    description: z.string().nullable().optional(),
    kind: z.enum(['scheduled_service', 'inspection', 'observation', 'document']),
    priority: z.enum(['normal', 'high', 'critical']).default('normal'),
    scheduleMode: z.enum(['date_only', 'mileage_only', 'whichever_comes_first', 'manual']),
    intervalDays: z.number().int().min(1, 'Интервал в днях должен быть более 0').nullable().optional(),
    intervalMileage: z.number().int().min(1, 'Интервал пробега должен быть более 0').nullable().optional(),
    soonDaysThreshold: z.number().int().min(0).default(30),
    soonMileageThreshold: z.number().int().min(0).default(1000),
    watchDaysThreshold: z.number().int().min(0).default(90),
    watchMileageThreshold: z.number().int().min(0).default(3000),
    manualDueAt: z
      .string()
      .transform((str) => (str ? new Date(str) : null))
      .or(z.date())
      .nullable()
      .optional(),
    manualDueMileage: z.number().int().min(0).nullable().optional(),
    manualStatus: z.enum(['auto', 'watch', 'resolved']).default('auto'),
  })
  .refine(
    (data) => {
      if (data.scheduleMode === 'date_only') {
        return data.intervalDays !== null && data.intervalDays !== undefined;
      }
      return true;
    },
    {
      message: 'Для режима по дате необходимо указать интервал в днях',
      path: ['intervalDays'],
    }
  )
  .refine(
    (data) => {
      if (data.scheduleMode === 'mileage_only') {
        return data.intervalMileage !== null && data.intervalMileage !== undefined;
      }
      return true;
    },
    {
      message: 'Для режима по пробегу необходимо указать интервал пробега',
      path: ['intervalMileage'],
    }
  )
  .refine(
    (data) => {
      if (data.scheduleMode === 'whichever_comes_first') {
        const hasDays = data.intervalDays !== null && data.intervalDays !== undefined;
        const hasMileage = data.intervalMileage !== null && data.intervalMileage !== undefined;
        return hasDays && hasMileage;
      }
      return true;
    },
    {
      message: 'Для режима "что наступит раньше" необходимо заполнить оба интервала (дни и пробег)',
      path: ['scheduleMode'],
    }
  )
  .refine(
    (data) => {
      if (data.scheduleMode === 'manual') {
        const hasDate = data.manualDueAt !== null && data.manualDueAt !== undefined;
        const hasMileage = data.manualDueMileage !== null && data.manualDueMileage !== undefined;
        return hasDate || hasMileage;
      }
      return true;
    },
    {
      message: 'В ручном режиме укажите хотя бы один срок (дату или пробег)',
      path: ['scheduleMode'],
    }
  );

// 4. Service Record Validation Schema
export const serviceRecordSchema = z.object({
  performedAt: z
    .string()
    .transform((str) => new Date(str))
    .or(z.date()),
  mileage: z.number().int().min(0, 'Пробег не может быть отрицательным'),
  serviceName: z.string().min(1, 'Укажите название выполненной работы'),
  serviceContact: z.string().nullable().optional(),
  laborCost: z.number().min(0, 'Стоимость работ не может быть отрицательной').default(0),
  partsCost: z.number().min(0, 'Стоимость запчастей не может быть отрицательной').default(0),
  currency: z.string().default('RUB'),
  notes: z.string().nullable().optional(),
  planIds: z.array(z.string()).default([]),
  observationIds: z.array(z.string()).default([]),
});

// 5. Reminder Rule Validation Schema
export const reminderRuleSchema = z.object({
  maintenancePlanId: z.string().uuid('Некорректный ID плана').nullable().optional(),
  observationId: z.string().uuid('Некорректный ID наблюдения').nullable().optional(),
  triggerType: z.enum(['days_before', 'mileage_before', 'due_date', 'due_mileage', 'overdue_repeat', 'exact_datetime']),
  triggerValue: z.string().nullable().optional(),
  sendAtLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Неверный формат времени (ЧЧ:ММ)').default('09:00'),
  isEnabled: z.boolean().default(true),
});

// 6. Auth Validation Schemas
export const registerSchema = z.object({
  email: z.string().email('Укажите корректный email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
  name: z.string().min(1, 'Укажите ваше имя'),
});

export const loginSchema = z.object({
  email: z.string().email('Укажите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

// 8. Telegram Auth Validation Schema
export const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData обязателен'),
});

// 8. User Preferences Validation Schema
export const userPreferencesSchema = z.object({
  timezone: z.string().min(1, 'Укажите часовой пояс'),
  defaultReminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Неверный формат времени (ЧЧ:ММ)'),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Неверный формат времени (ЧЧ:ММ)').nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Неверный формат времени (ЧЧ:ММ)').nullable().optional(),
});

// 9. Observation Validation Schema
export const observationSchema = z.object({
  title: z.string().min(1, 'Укажите название наблюдения'),
  description: z.string().nullable().optional(),
  priority: z.enum(['normal', 'high', 'critical']).default('normal'),
  state: z.enum(['open', 'watching', 'service_planned', 'closed']).default('open'),
  photoUrl: z.string().nullable().optional(),
  maintenancePlanId: z.string().uuid('Некорректный ID плана').nullable().optional(),
  serviceRecordId: z.string().uuid('Некорректный ID записи ТО').nullable().optional(),
});
