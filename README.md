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

**Целевое состояние стабилизации:**
- ✅ `npm run lint`
- ✅ `npm run typecheck`
- ✅ `npm run build`
- ✅ `npm test` (unit + integration, при запущенном PostgreSQL)

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
   docker compose up -d postgres
   ```

3. **Применение миграций:**
   ```bash
   npx prisma migrate deploy
   ```

4. **Очистка legacy seed-данных:**
   ```bash
   npx prisma db seed
   ```
   Seed больше не создает demo или тестовый аккаунт. Скрипт только удаляет старые legacy seeded-учётки, если они остались в локальной базе.

5. **Запуск Next.js в режиме разработки:**
   ```bash
   npm run dev
   ```
   Приложение будет доступно на [http://localhost:3000](http://localhost:3000). Зарегистрируйте новый аккаунт через `/register`.

6. **Запуск проверок:**
   ```bash
   npm run lint
   npm run typecheck
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

- **Авторизация:** Реализован вход и регистрация по `email + password` через JWT-cookie. Вход через Telegram вынесен в следующий этап.
- **Email/Push уведомления:** Worker создает уведомления в БД, реальная отправка email/push не реализована — только `in_app`.
- **Загрузка файлов:** Фото чека/симптома принимается как URL-строка (без загрузки файлов на сервер).
- **Шифрование VIN/госномера:** Хранятся в открытом виде (поле названо `...EncryptedOrMasked` как placeholder).
- **Мультивалютность:** Интерфейс поддерживает поле `currency`, но все суммы выводятся без конвертации.
- **Offline режим PWA:** Manifest настроен, service worker не подключен (требует отдельной конфигурации next-pwa).
- **Telegram уведомления:** Поле `channel` поддерживает `telegram`, но интеграция с ботом не реализована.

## Проверки и тесты

- `npm run lint` — проверка ESLint.
- `npm run typecheck` — строгая TypeScript-проверка.
- `npm run test:unit` — быстрые unit-тесты доменной логики.
- `npm run test:integration` — интеграционные тесты с PostgreSQL. Перед запуском нужен `docker compose up -d postgres`.
- `npm test` — полный прогон unit + integration.

## Production: Vercel + Supabase

- Приложение рассчитано на деплой в `Vercel`, а PostgreSQL — в `Supabase`.
- Для Prisma используются две строки подключения:
  - `DATABASE_URL` — runtime URL. Для Vercel/Supabase используйте pooled connection string.
  - `DIRECT_URL` — direct connection string для `prisma migrate deploy`, `prisma studio` и других административных операций.
- Обязательные production env в Vercel:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `JWT_SECRET`
  - `CRON_SECRET`
- Напоминания больше не зависят от постоянного Node worker в production. Вместо этого используется Vercel cron route [src/app/api/cron/notifications/route.ts](/Users/miko/Documents/auto-care-check/src/app/api/cron/notifications/route.ts:1) и расписание из [vercel.json](/Users/miko/Documents/auto-care-check/vercel.json:1).
- Vercel cron делает `GET` на `/api/cron/notifications`; при наличии `CRON_SECRET` Vercel автоматически отправляет `Authorization: Bearer <CRON_SECRET>`.
- Локальный `src/worker/cron.ts` остаётся удобным dev-режимом, если нужно погонять напоминания вне Vercel.

---

## Для ИИ-агентов

Папка [`.agents/`](file:///Users/miko/Documents/auto-care-check/.agents/) содержит:
- [`AGENTS.md`](file:///Users/miko/Documents/auto-care-check/.agents/AGENTS.md) — свод правил разработки, формулы бизнес-логики и контекст для ИИ.
- [`implementation_plan.md`](file:///Users/miko/Documents/auto-care-check/.agents/implementation_plan.md) — план итераций и архитектурных решений.
