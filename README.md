# AutoPulse — Сервис контроля обслуживания автомобиля

Репозиторий содержит техническое задание (ТЗ) и инфраструктуру для разработки приложения **AutoPulse** — личного PWA-сервиса («бортового журнала») для отслеживания технического состояния и планирования ТО автомобиля.

## Текущий статус проекта

**Итерация 6 завершена (MVP полностью реализован)**

| Итерация | Описание | Статус |
| --- | --- | --- |
| Итерация 1 | Фундамент: Next.js, TypeScript, Prisma, PostgreSQL, Docker, seed, demo-auth | ✅ Готово |
| Итерация 2 | Vehicle, Odometer, MaintenancePlan, Zod-валидация, ownership checks | ✅ Готово |
| Итерация 3 | Status Engine, Dashboard, Readiness Score, sidebar/bottom nav, responsive | ✅ Готово |
| Итерация 4 | ServiceRecord, ServicePart, void с причиной, транзакции, тесты | ✅ Готово |
| Итерация 5 | ReminderRule, Notification Center, worker/cron, дедупликация | ✅ Готово |
| Итерация 6 | Observations UI/API, PWA иконки, polish, reduced-motion, production build | ✅ Готово |

**Результаты финальных проверок:**
- ✅ `npx tsc --noEmit` — без ошибок
- ✅ `npm test` — 37 тестов прошли (7 наборов)
- ✅ `npm run build` — успешная production сборка

## Навигация по ТЗ

| Файл | Содержание |
| --- | --- |
| [00_README.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/00_README.md) | Общее описание проекта, ценность и рекомендуемый стек. |
| [01_PRODUCT_VISION_AND_SCOPE.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/01_PRODUCT_VISION_AND_SCOPE.md) | Видение продукта, целевая аудитория, границы MVP. |
| [02_FUNCTIONAL_REQUIREMENTS.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/02_FUNCTIONAL_REQUIREMENTS.md) | Функциональные требования, User Stories. |
| [03_DATA_MODEL_AND_BUSINESS_LOGIC.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/03_DATA_MODEL_AND_BUSINESS_LOGIC.md) | Модель данных, логика расчета статусов ТО. |
| [04_UI_UX_AUTOMOTIVE_DASHBOARD.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/04_UI_UX_AUTOMOTIVE_DASHBOARD.md) | Фронтенд-требования, стилистика приборной панели. |
| [05_BACKEND_API_AND_NOTIFICATIONS.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/05_BACKEND_API_AND_NOTIFICATIONS.md) | API, фоновые задачи, напоминания. |
| [06_NON_FUNCTIONAL_AND_SECURITY.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/06_NON_FUNCTIONAL_AND_SECURITY.md) | Безопасность, производительность, надежность. |
| [07_ROADMAP_AND_ACCEPTANCE.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/07_ROADMAP_AND_ACCEPTANCE.md) | Дорожная карта и критерии приемки. |
| [09_ITERATION_PROMPTS.md](file:///Users/miko/Documents/auto-care-check/autopulse_car_service_specs/09_ITERATION_PROMPTS.md) | Поэтапные промпты для ИИ-разработки. |

## Быстрый запуск (Quick Start)

### Требования
- Node.js v20+
- Docker & Docker Compose

### Шаги для локального запуска

1. **Установка зависимостей:**
   ```bash
   npm install
   ```

2. **Запуск базы данных в Docker:**
   ```bash
   docker-compose up -d postgres
   ```

3. **Запуск миграций и сидирование (заполнение демо-данными):**
   ```bash
   npx prisma migrate dev --name init
   npx prisma db seed
   ```

4. **Запуск Next.js в режиме разработки:**
   ```bash
   npm run dev
   ```
   Приложение будет доступно на [http://localhost:3000](http://localhost:3000). Демо-авторизация сработает автоматически (пользователь: `Иван Демидов`, UUID: `00000000-0000-0000-0000-000000000001`).

5. **Запуск тестов:**
   ```bash
   npm test
   ```

### Запуск всего стека в Docker (Production Build)

```bash
docker-compose up -d --build
```

---

## Демо-flow

1. Открыть `/dashboard` — выбрать автомобиль.
2. Нажать «Обновить пробег» → ввести новый пробег.
3. Перейти на страницу авто → вкладка «Планы ТО».
4. Добавить план (например, «Замена масла» → по дате и пробегу, интервал 365 дней / 10 000 км).
5. Вернуться на Dashboard — увидеть план со статусом и Readiness Score.
6. Вкладка «Наблюдения» → добавить симптом (например, «Шум в подвеске», приоритет Высокий).
7. Вкладка «История ТО» → «Внести запись» → отметить выполненные планы и устраненные наблюдения.
8. После сохранения — Dashboard обновит следующий срок и Readiness Score.

---

## Известные ограничения MVP

- **Авторизация:** Реализована как демо-авторизация по cookie (userId фиксирован). Полноценная аутентификация (JWT / OAuth) вынесена за рамки MVP.
- **Email/Push уведомления:** Worker создает уведомления в БД, реальная отправка email/push не реализована — только `in_app`.
- **Загрузка файлов:** Фото чека/симптома принимается как URL-строка (без загрузки файлов на сервер).
- **Шифрование VIN/госномера:** Хранятся в открытом виде (поле названо `...EncryptedOrMasked` как placeholder).
- **Мультивалютность:** Интерфейс поддерживает поле `currency`, но все суммы выводятся без конвертации.
- **Offline режим PWA:** Manifest настроен, service worker не подключен (требует отдельной конфигурации next-pwa).
- **Telegram уведомления:** Поле `channel` поддерживает `telegram`, но интеграция с ботом не реализована.

---

## Для ИИ-агентов

Папка [`.agents/`](file:///Users/miko/Documents/auto-care-check/.agents/) содержит:
- [`AGENTS.md`](file:///Users/miko/Documents/auto-care-check/.agents/AGENTS.md) — свод правил разработки, формулы бизнес-логики и контекст для ИИ.
- [`implementation_plan.md`](file:///Users/miko/Documents/auto-care-check/.agents/implementation_plan.md) — план итераций и архитектурных решений.
