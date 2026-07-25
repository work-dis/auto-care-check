# Справочник API AutoPulse

## Общие правила

- Все маршруты начинаются с `/api`.
- Сессия хранится в HttpOnly cookie `auth_token`; JWT не возвращается
  клиентскому JavaScript.
- Приватный API без действующей сессии возвращает `401`.
- Тела изменяющих запросов передаются в JSON, кроме загрузки изображения через
  `multipart/form-data`.
- Ошибки обычно имеют вид:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте заполненные поля",
    "fieldErrors": {
      "mileage": "Укажите корректный пробег"
    }
  }
}
```

## Публичные и инфраструктурные маршруты

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Регистрация |
| `POST` | `/api/auth/login` | Вход по логину и паролю |
| `POST` | `/api/auth/telegram` | Вход через Telegram Login Widget |
| `GET` | `/api/health` | Проверка приложения и соединения с БД |
| `GET` | `/api/cron/notifications` | Не требует cookie, но требует `Authorization: Bearer CRON_SECRET` |

## Профиль и сессия

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `POST` | `/api/auth/logout` | Выход и отзыв текущей версии сессии |
| `GET`, `PATCH`, `DELETE` | `/api/me` | Профиль, настройки уведомлений, удаление аккаунта |
| `PATCH` | `/api/me/profile` | Имя/e-mail либо смена пароля |
| `POST`, `DELETE` | `/api/push/subscribe` | Добавить или удалить Web Push subscription |

Смена пароля увеличивает `sessionVersion`, отзывает старые JWT и выдаёт новую
cookie текущему браузеру. Logout также увеличивает версию сессии.

## Автомобили и обслуживание

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET`, `POST` | `/api/vehicles` | Список доступных автомобилей / создание |
| `GET`, `PATCH`, `DELETE` | `/api/vehicles/:id` | Карточка / изменение / soft archive |
| `POST` | `/api/vehicles/:id/primary` | Сделать автомобиль основным |
| `GET`, `POST` | `/api/vehicles/:id/odometer` | История / новое показание пробега |
| `GET` | `/api/vehicles/:id/dashboard` | Агрегированный dashboard |
| `GET`, `POST` | `/api/vehicles/:id/plans` | Планы ТО |
| `GET` | `/api/categories?vehicleId=:id` | Системные и автомобильные категории |
| `PATCH`, `DELETE` | `/api/plans/:planId` | Изменение / архивирование плана |
| `GET`, `POST` | `/api/vehicles/:id/records` | История / новая сервисная запись |
| `POST` | `/api/records/:recordId/void` | Отмена записи с причиной |
| `GET`, `POST` | `/api/vehicles/:id/observations` | Наблюдения автомобиля |
| `GET` | `/api/observations` | Сводный список наблюдений владельца |
| `PATCH`, `DELETE` | `/api/observations/:observationId` | Изменение / удаление наблюдения |
| `POST` | `/api/observations/:observationId/close` | Закрытие наблюдения |

## Эксплуатация, аналитика и обмен данными

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/vehicles/:id/ownership` | Топливо, документы, шины и участники |
| `GET`, `POST` | `/api/vehicles/:id/analytics` | Аналитика / годовой бюджет |
| `GET` | `/api/vehicles/:id/export?format=json\|csv\|pdf` | Экспорт журнала |
| `POST` | `/api/vehicles/import` | Импорт JSON backup версии 1 |
| `POST` | `/api/upload` | Загрузка JPEG/PNG/WebP/AVIF до 8 МБ |
| `POST` | `/api/receipts/ocr` | OCR ранее загруженного Cloudinary-чека |

Параметр `kind` маршрута `ownership` принимает `fuel`, `document`, `tire` или
`member`. Управление участниками доступно только владельцу.

Импорт версии 1 создаёт новый автомобиль и переносит его основные поля,
документы, комплекты шин и заправки. Планы ТО, сервисные записи и наблюдения из
полного JSON export пока не восстанавливаются.

## Напоминания

| Метод | Маршрут | Назначение |
| --- | --- | --- |
| `GET`, `POST` | `/api/reminder-rules` | Список / создание правила |
| `PATCH`, `DELETE` | `/api/reminder-rules/:ruleId` | Изменение / удаление правила |
| `GET`, `POST` | `/api/notifications` | Список / отметить все прочитанными |
| `POST` | `/api/notifications/:notificationId/read` | Отметить одно прочитанным |

Поддерживаемые каналы модели: `in_app`, `email`, `push`, `telegram`.
Фактически доставляются первые три при наличии конфигурации; Telegram delivery
пока не реализован.

## Роли доступа к автомобилю

| Роль | Чтение | Изменение данных | Участники и архивирование авто |
| --- | --- | --- | --- |
| `viewer` | Да | Нет | Нет |
| `editor` | Да | Да | Нет |
| `owner` | Да | Да | Да; также выбор основного автомобиля |

Денежные значения принимают только `USD`, `BYN`, `RUB` и `EUR`. Они
агрегируются отдельно и не конвертируются без явно заданного механизма курсов.
