# 05. Backend, API и система напоминаний

## 1. Архитектурный принцип

Разделить три ответственности:

1. **HTTP/API:** принимает запросы, валидирует данные, возвращает результаты.
2. **Domain/service layer:** содержит расчёт статусов, сроков, историю выполнения и бизнес-правила.
3. **Worker/scheduler:** периодически пересчитывает кандидатов на уведомления и отправляет их по каналам.

Нельзя помещать сложную логику статусов только в React-компоненты. Фронтенд отображает уже рассчитанные и объяснимые данные, но backend остаётся источником истины.

## 2. API: рекомендуемые группы маршрутов

### Auth и профиль

- `GET /me`
- `PATCH /me`
- `GET /me/notification-preferences`
- `PATCH /me/notification-preferences`

### Vehicles

- `GET /vehicles`
- `POST /vehicles`
- `GET /vehicles/:vehicleId`
- `PATCH /vehicles/:vehicleId`
- `POST /vehicles/:vehicleId/archive`
- `POST /vehicles/:vehicleId/unarchive`
- `POST /vehicles/:vehicleId/set-primary`

### Odometer

- `GET /vehicles/:vehicleId/odometer-readings`
- `POST /vehicles/:vehicleId/odometer-readings`
- `PATCH /vehicles/:vehicleId/odometer-readings/:readingId`

### Dashboard and maintenance plans

- `GET /vehicles/:vehicleId/dashboard`
- `GET /vehicles/:vehicleId/maintenance-plans`
- `POST /vehicles/:vehicleId/maintenance-plans`
- `GET /maintenance-plans/:planId`
- `PATCH /maintenance-plans/:planId`
- `POST /maintenance-plans/:planId/complete` — удобный shortcut, создаёт ServiceRecord или открывает предзаполненную форму.
- `POST /maintenance-plans/:planId/archive`
- `POST /maintenance-plans/:planId/restore`
- `POST /maintenance-plans/:planId/disable`
- `POST /maintenance-plans/:planId/enable`

### Service records

- `GET /vehicles/:vehicleId/service-records`
- `POST /vehicles/:vehicleId/service-records`
- `GET /service-records/:recordId`
- `PATCH /service-records/:recordId` — разрешить лишь пока draft; подтверждённую запись менять через controlled edit/audit.
- `POST /service-records/:recordId/confirm`
- `POST /service-records/:recordId/void`

### Observations

- `GET /vehicles/:vehicleId/observations`
- `POST /vehicles/:vehicleId/observations`
- `PATCH /observations/:observationId`
- `POST /observations/:observationId/close`

### Reminders & notifications

- `GET /reminder-rules`
- `POST /reminder-rules`
- `PATCH /reminder-rules/:ruleId`
- `POST /reminder-rules/:ruleId/disable`
- `GET /notifications`
- `POST /notifications/:notificationId/read`
- `POST /notifications/read-all`

## 3. Формат dashboard response

Ответ не должен заставлять фронтенд собирать сложную логику из десятков запросов.

```ts
interface VehicleDashboardResponse {
  vehicle: {
    id: string;
    displayName: string;
    currentMileage: number;
    mileageUpdatedAt: string | null;
  };
  readiness: {
    score: number | null;
    state: 'enough_data' | 'not_enough_data';
    summary: string;
    disclaimer: string;
    counts: Record<'overdue' | 'soon' | 'watch' | 'normal' | 'unknown', number>;
  };
  urgentItems: MaintenancePlanView[];
  upcomingItems: MaintenancePlanView[];
  watchItems: MaintenancePlanView[];
  nextActions: TimelineItem[];
  latestServiceRecord: ServiceRecordSummary | null;
  expenseSummary: { last30Days: Money; yearToDate: Money };
}
```

`MaintenancePlanView` должен включать `status`, `statusReason`, `nextDueAt`, `nextDueMileage`, `remainingDays`, `remainingMileage`, `priority`, `canMarkCompleted`.

## 4. Валидация

### Примеры критичных правил

- Пробег — целое число ≥ 0.
- Дата работы не может быть бессмысленно далеко в будущем; допустимый лимит должен быть конфигурируемым.
- Суммы — decimal/строки, валидированные в Zod.
- `scheduleMode = date_only` требует дату/интервал по дате.
- `scheduleMode = mileage_only` требует пробег/интервал по пробегу.
- `whichever_comes_first` требует хотя бы один полный способ расчёта, иначе UI должен объяснить, что будет использовано.
- Пользователь не может обращаться к чужому `vehicleId`, `planId`, `recordId` даже если угадал UUID.

## 5. Фоновая обработка напоминаний

### Почему нужна отдельная задача

Уведомления зависят от времени и новых показаний пробега, поэтому нельзя отправлять их только во время загрузки дашборда. Нужен worker/cron с идемпотентной логикой.

### Процесс worker-а

1. Запускается периодически, например раз в 15–60 минут для дат и после изменения пробега для километровых правил.
2. Получает активные `ReminderRule` и связанные планы/наблюдения.
3. Вычисляет текущий статус и проверяет, сработало ли условие конкретного правила.
4. Создаёт `Notification` с уникальным `dedupeKey`.
5. Отправляет уведомление в выбранный канал.
6. Помечает результат: `sent`, `failed`, `cancelled`, `stale`.

### Идемпотентность

Уникальный ключ должен включать как минимум:

```text
reminderRuleId + planId/observationId + serviceCycleIdentity + triggerOccurrence
```

`serviceCycleIdentity` меняется после завершения работы. Это предотвращает повторную отправку старого напоминания после того, как пользователь уже обслужил узел.

### Правила отмены

Помечать уведомление как `stale`/`cancelled`, если:

- пользователь отметил работу выполненной;
- план архивирован или отключён;
- наблюдение закрыто;
- правило напоминания выключено;
- уведомление относится к старому циклу после пересчёта срока.

## 6. Каналы уведомлений

### In-app — обязателен для MVP

- Колокольчик с бейджем непрочитанных.
- Список уведомлений с deep link на конкретный план/наблюдение.
- Возможность отметить прочитанным.

### Email — желательно для MVP

- Шаблоны должны быть краткими: название автомобиля, действие, причина, кнопка/ссылка.
- Не хранить учётные данные SMTP в коде.
- В production использовать очередь/ретраи, а не бесконечную синхронную попытку отправки.

### Push / Telegram — после базовой версии

- Подключать только при явном согласии пользователя.
- Хранить канал как отдельную интеграцию с понятным отключением.

## 7. Пагинация, фильтрация и сортировка

- История и уведомления используют cursor pagination.
- Сортировка по умолчанию: новые/срочные первыми.
- Фильтры передаются типизированно и валидируются.
- В ответе возвращать `nextCursor` и необходимые метаданные, не весь архив за раз.

## 8. Ошибки API

Согласованный формат:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте заполненные поля",
    "fieldErrors": {
      "mileage": "Пробег не может быть меньше последнего подтверждённого значения"
    }
  }
}
```

Не раскрывать stack trace, SQL и внутренние ID в клиентской ошибке.
