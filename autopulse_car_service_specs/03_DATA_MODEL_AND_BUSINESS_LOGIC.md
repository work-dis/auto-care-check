# 03. Модель данных и бизнес-логика

## 1. Ключевые сущности

### User

- `id`
- `email`
- `name`
- `timezone`
- `locale`
- `defaultReminderTime`
- `quietHoursStart`, `quietHoursEnd`
- `createdAt`, `updatedAt`

### Vehicle

- `id`, `userId`
- `displayName`, `make`, `model`, `year`
- `currentMileage`, `mileageUnit`
- `plateNumberEncryptedOrMasked`, `vinEncryptedOrMasked`
- `fuelType`, `transmission`, `engineDescription`
- `photoUrl`, `notes`
- `isPrimary`, `archivedAt`
- `createdAt`, `updatedAt`

### OdometerReading

- `id`, `vehicleId`
- `mileage`
- `recordedAt`
- `source`: `manual | service_record | import | correction`
- `comment`
- `createdAt`

### MaintenanceCategory

- `id`, `vehicleId` nullable для системных шаблонов
- `name`, `iconKey`, `sortOrder`
- `isSystem`, `archivedAt`

### MaintenancePlan

Одна карточка регулярной работы/осмотра для конкретного автомобиля.

- `id`, `vehicleId`, `categoryId`
- `title`, `description`
- `kind`: `scheduled_service | inspection | observation | document`
- `priority`: `normal | high | critical`
- `scheduleMode`: `date_only | mileage_only | whichever_comes_first | manual`
- `intervalDays` nullable
- `intervalMileage` nullable
- `lastCompletedAt` nullable
- `lastCompletedMileage` nullable
- `manualDueAt` nullable
- `manualDueMileage` nullable
- `soonDaysThreshold`, `soonMileageThreshold`
- `watchDaysThreshold`, `watchMileageThreshold`
- `manualStatus`: `auto | watch | resolved`
- `status`: вычисляемое поле или кэш, но источник истины — формула
- `disabledAt`, `archivedAt`
- `createdAt`, `updatedAt`

### ServiceRecord

- `id`, `vehicleId`
- `performedAt`, `mileage`
- `serviceName`, `serviceContact` nullable
- `laborCost`, `partsCost`, `totalCost`, `currency`
- `notes`
- `receiptUrl`
- `state`: `confirmed | voided | draft`
- `voidReason` nullable
- `createdAt`, `updatedAt`

### ServiceRecordPlanItem

Снимок связи сервисной записи с планом обслуживания.

- `id`, `serviceRecordId`, `maintenancePlanId` nullable
- `titleSnapshot`, `categorySnapshot`
- `actionType`: `completed | inspected | repaired | note`
- `costSnapshot`

### ServicePart

- `id`, `serviceRecordId`
- `nameSnapshot`, `article`, `quantity`, `unit`
- `unitPrice`, `totalPrice`, `currency`

### Observation

- `id`, `vehicleId`, `maintenancePlanId` nullable
- `title`, `description`, `priority`
- `state`: `open | watching | service_planned | closed`
- `createdAt`, `closedAt`

### ReminderRule

- `id`, `vehicleId`, `maintenancePlanId` nullable, `observationId` nullable
- `triggerType`: `days_before | mileage_before | due_date | due_mileage | overdue_repeat | exact_datetime`
- `triggerValue` nullable
- `scheduledAt` nullable
- `channel`: `in_app | email | push | telegram`
- `sendAtLocalTime`
- `isEnabled`
- `createdAt`, `updatedAt`

### Notification

- `id`, `userId`, `vehicleId`
- `reminderRuleId` nullable
- `maintenancePlanId` nullable
- `title`, `body`, `severity`
- `status`: `pending | sent | read | failed | cancelled | stale`
- `scheduledFor`, `sentAt`, `readAt`
- `dedupeKey`
- `createdAt`

### Attachment

- `id`, `ownerType`, `ownerId`
- `url`, `mimeType`, `fileName`, `sizeBytes`
- `createdAt`

### AuditEvent

Необязательно для самого первого релиза, но желательно заложить.

- `id`, `userId`, `entityType`, `entityId`
- `action`, `beforeJson`, `afterJson`
- `createdAt`

## 2. Рассчёт следующего срока

Для каждого активного `MaintenancePlan` определить:

```text
nextDueAt =
  manualDueAt, если scheduleMode = manual и manualDueAt задан;
  lastCompletedAt + intervalDays, если есть дата последней работы и интервал;
  null, если даты недостаточно.

nextDueMileage =
  manualDueMileage, если scheduleMode = manual и manualDueMileage задан;
  lastCompletedMileage + intervalMileage, если есть пробег последней работы и интервал;
  null, если данных недостаточно.
```

### Как совместить дату и пробег

- `date_only`: учитывается только `nextDueAt`.
- `mileage_only`: учитывается только `nextDueMileage`.
- `whichever_comes_first`: статус становится срочным, когда наступает **любое** из двух условий.
- `manual`: использовать ручные значения; можно заполнить один или оба показателя.

## 3. Статус пункта обслуживания

### Предварительные правила

1. Если `archivedAt` задан — карточка не участвует в активном дашборде.
2. Если `disabledAt` задан — статус `disabled`.
3. Если `manualStatus = watch` или есть открытое Observation высокой важности — `watch`, кроме случая, когда срок уже просрочен.
4. Если для необходимого режима расчёта нет даты/пробега/интервала — `unknown`.

### Основная формула

```text
remainingDays = nextDueAt - now (в днях, c учётом timezone пользователя)
remainingMileage = nextDueMileage - vehicle.currentMileage
```

Для `whichever_comes_first` использовать худший из доступных показателей.

| Условие | Статус |
|---|---|
| `remainingDays < 0` или `remainingMileage < 0` | `overdue` |
| `remainingDays <= soonDaysThreshold` или `remainingMileage <= soonMileageThreshold` | `soon` |
| `remainingDays <= watchDaysThreshold` или `remainingMileage <= watchMileageThreshold` | `watch` |
| данных достаточно, другие условия не сработали | `normal` |
| не хватает данных | `unknown` |

### Пороговые значения по умолчанию

| Тип | Soon | Watch |
|---|---:|---:|
| По дате | 30 дней | 90 дней |
| По пробегу | 1 000 км | 3 000 км |

Пользователь может переопределить их на уровне конкретного плана.

### Человеческое объяснение статуса

API/фронтенд должны возвращать не только enum, но и объяснение, например:

- `Просрочено на 15 дней`.
- `Просрочено на 420 км`.
- `Осталось 18 дней или 870 км — сработает более ранний срок`.
- `Нужны дата и пробег последней замены`.
- `Пользователь отметил: вибрация при торможении`.

## 4. Индекс «Состояние обслуживания»

Это не диагностика автомобиля, а визуальное резюме заполненного плана.

### Ограничение

Называть его **«Готовность по обслуживанию»**, а не «здоровье автомобиля».

### Простая и объяснимая формула

- Начать со 100.
- Для каждого активного плана:
  - `overdue`: минус 18 × вес приоритета;
  - `soon`: минус 7 × вес;
  - `watch`: минус 4 × вес;
  - `unknown`: минус 2 × вес;
  - `normal`: 0.
- Вес: normal = 1, high = 1.5, critical = 2.
- Ограничить 0–100.
- Если активных пунктов меньше 3, не показывать точное число: вместо этого «Заполните ещё N пунктов, чтобы видеть сводку».

Ни один текст не должен утверждать, что автомобиль исправен или неисправен на основании этого индекса.

## 5. Логика завершения работы

При подтверждении `ServiceRecord`:

1. Проверить, что пользователь владеет автомобилем.
2. Проверить корректность даты, пробега и суммы.
3. Создать снапшоты названий работ/цен.
4. Создать/обновить `OdometerReading`.
5. Для каждого связанного `MaintenancePlan` обновить последние дату и пробег.
6. Очистить устаревшие напоминания, относящиеся к предыдущему циклу.
7. Пересчитать кеш статуса только как оптимизацию; формула должна оставаться воспроизводимой.
8. Записать событие аудита.

## 6. Логика отмены сервисной записи

- Не удалять подтверждённую запись физически.
- Перевести `state` в `voided`, сохранить причину и время.
- Пересчитать последние обслуживающие значения по оставшимся подтверждённым записям для затронутых планов.
- Не стирать связанные вложения до явного подтверждения пользователя и истечения политики хранения.

## 7. Правила целостности

- Все денежные значения хранить в decimal/целых минимальных единицах, не в float.
- У каждого исторического поля, которое пользователь видит в прошлом, должен быть snapshot.
- Один `ReminderRule` должен быть связан ровно с одним владельцем: планом, наблюдением либо точной датой.
- `Notification.dedupeKey` уникален.
- Все запросы к автомобилю проверяют `vehicle.userId === currentUser.id`.
