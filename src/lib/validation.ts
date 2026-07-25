import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '@/domain/money/currencies';

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
  currency: z.enum(SUPPORTED_CURRENCIES, {
    message: 'Выберите валюту: USD, BYN, RUB или EUR',
  }).default('RUB'),
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
  scheduledAt: z
    .string()
    .datetime()
    .transform((value) => new Date(value))
    .or(z.date())
    .nullable()
    .optional(),
  channel: z.enum(['in_app', 'push', 'email']).default('in_app'),
  sendAtLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Неверный формат времени (ЧЧ:ММ)').default('09:00'),
  isEnabled: z.boolean().default(true),
}).superRefine((data, context) => {
  if (data.triggerType === 'exact_datetime' && !data.scheduledAt) {
    context.addIssue({
      code: 'custom',
      path: ['scheduledAt'],
      message: 'Для точного напоминания укажите дату и время',
    });
  }
});

// 6. Auth Validation Schemas
export const registerSchema = z.object({
  username: z.string().min(3, 'Логин должен быть не менее 3 символов').max(32, 'Логин не более 32 символов').regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _'),
  password: z.string().min(10, 'Пароль должен быть не менее 10 символов'),
  name: z.string().min(1, 'Укажите ваше имя'),
  timezone: z.string().refine((timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }).default('UTC'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Введите логин'),
  password: z.string().min(1, 'Введите пароль'),
});

export const userProfileSchema = z.object({
  name: z.string().trim().min(1, 'Укажите имя').max(100),
  email: z.string().trim().email('Некорректный email').nullable().optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: z.string().min(10, 'Новый пароль должен быть не менее 10 символов'),
});

// 8. Telegram Auth Validation Schema
export const telegramAuthSchema = z.object({
  initData: z.string().min(1, 'initData обязателен'),
});

// 8. User Preferences Validation Schema
export const userPreferencesSchema = z.object({
  timezone: z.string().min(1, 'Укажите часовой пояс').refine((timezone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Неизвестный часовой пояс'),
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

const optionalDate = z
  .string()
  .transform((value) => (value ? new Date(value) : null))
  .or(z.date())
  .nullable()
  .optional();

export const vehicleDocumentSchema = z.object({
  type: z.enum(['insurance', 'inspection', 'tax', 'warranty', 'registration', 'other']),
  title: z.string().trim().min(1, 'Укажите название документа').max(120),
  number: z.string().trim().max(80).nullable().optional(),
  validFrom: optionalDate,
  expiresAt: optionalDate,
  fileUrl: z.string().url('Некорректная ссылка на файл').nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const tireSetSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название комплекта').max(100),
  season: z.enum(['summer', 'winter', 'all_season']),
  brand: z.string().trim().max(80).nullable().optional(),
  model: z.string().trim().max(80).nullable().optional(),
  size: z.string().trim().max(40).nullable().optional(),
  status: z.enum(['installed', 'storage', 'retired']).default('storage'),
  storageLocation: z.string().trim().max(160).nullable().optional(),
  purchasedAt: optionalDate,
  installedAt: optionalDate,
  installedMileage: z.number().int().min(0).nullable().optional(),
  totalDistance: z.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const fuelEntrySchema = z.object({
  filledAt: z.string().transform((value) => new Date(value)).or(z.date()),
  mileage: z.number().int().min(0),
  liters: z.number().positive('Объём должен быть больше нуля').max(500),
  totalCost: z.number().min(0).max(1000000),
  currency: z.enum(SUPPORTED_CURRENCIES),
  station: z.string().trim().max(120).nullable().optional(),
  fullTank: z.boolean().default(true),
  receiptUrl: z.string().url().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const vehicleMemberSchema = z.object({
  username: z.string().trim().min(3).max(32),
  role: z.enum(['viewer', 'editor']).default('viewer'),
});

export const vehicleBudgetSchema = z.object({
  currency: z.enum(SUPPORTED_CURRENCIES),
  annualLimit: z.number().positive('Бюджет должен быть больше нуля').max(1000000000),
});
