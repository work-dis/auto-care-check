# AutoPulse — Сервис контроля обслуживания автомобиля

AutoPulse — личный PWA-бортжурнал для планирования технического обслуживания,
учёта пробега, работ, топлива, шин, документов и расходов. Репозиторий содержит
рабочее приложение, миграции PostgreSQL, автоматические тесты и техническую
документацию.

## Текущий статус проекта

**Статус: MVP стабилизирован, этапы P0–P7 реализованы.**

| Итерация | Описание | Статус |
| --- | --- | --- |
| Итерация 1 | Фундамент: Next.js, TypeScript, Prisma, PostgreSQL, Docker, seed и авторизация | ✅ Готово |
| Итерация 2 | Vehicle, Odometer, MaintenancePlan, Zod-валидация, ownership checks | ✅ Готово |
| Итерация 3 | Status Engine, Dashboard, Readiness Score, sidebar/bottom nav, responsive | ✅ Готово |
| Итерация 4 | ServiceRecord, ServicePart, void с причиной, транзакции, тесты | ✅ Готово |
| Итерация 5 | ReminderRule, Notification Center, worker/cron, дедупликация | ✅ Готово |
| Итерация 6 | Observations UI/API, PWA иконки, polish, reduced-motion, production build | ✅ Готово |
| Итерация 7 | Валюты, эксплуатация, аналитика, OCR, экспорт, совместный доступ и hardening | ✅ Готово |

Последняя локальная проверка:

- ✅ `npm run lint`
- ✅ `npm run typecheck`
- ✅ `npm run build`
- ✅ 40 unit- и 20 integration-тестов
- ✅ 8 E2E-сценариев: Desktop Chrome и мобильный профиль Pixel 5
- ✅ `npm audit`: 0 известных уязвимостей

## Навигация по ТЗ

| Файл | Содержание |
| --- | --- |
| [00_README.md](autopulse_car_service_specs/00_README.md) | Общее описание пакета требований. |
| [01_PRODUCT_VISION_AND_SCOPE.md](autopulse_car_service_specs/01_PRODUCT_VISION_AND_SCOPE.md) | Видение продукта, аудитория и исходные границы MVP. |
| [02_FUNCTIONAL_REQUIREMENTS.md](autopulse_car_service_specs/02_FUNCTIONAL_REQUIREMENTS.md) | Исходные функциональные требования. |
| [03_DATA_MODEL_AND_BUSINESS_LOGIC.md](autopulse_car_service_specs/03_DATA_MODEL_AND_BUSINESS_LOGIC.md) | Доменная модель и формулы статусов ТО. |
| [04_UI_UX_AUTOMOTIVE_DASHBOARD.md](autopulse_car_service_specs/04_UI_UX_AUTOMOTIVE_DASHBOARD.md) | UX/UI-концепция автомобильной панели. |
| [05_BACKEND_API_AND_NOTIFICATIONS.md](autopulse_car_service_specs/05_BACKEND_API_AND_NOTIFICATIONS.md) | Исходный проект API и уведомлений. |
| [06_NON_FUNCTIONAL_AND_SECURITY.md](autopulse_car_service_specs/06_NON_FUNCTIONAL_AND_SECURITY.md) | Нефункциональные требования и безопасность. |
| [07_ROADMAP_AND_ACCEPTANCE.md](autopulse_car_service_specs/07_ROADMAP_AND_ACCEPTANCE.md) | Исходная дорожная карта и критерии приёмки. |
| [08_MASTER_PROMPT_FOR_AI.md](autopulse_car_service_specs/08_MASTER_PROMPT_FOR_AI.md) | Архивный мастер-промпт для первоначальной реализации. |
| [09_ITERATION_PROMPTS.md](autopulse_car_service_specs/09_ITERATION_PROMPTS.md) | Архивные промпты по итерациям. |
| [10_TEST_SCENARIOS.md](autopulse_car_service_specs/10_TEST_SCENARIOS.md) | Исходные ручные и автоматические сценарии. |

## Актуальная техническая документация

Фактическая архитектура, план стабилизации, декомпозиция модулей, безопасность,
тестирование и эксплуатация описаны в
[`docs/README.md`](docs/README.md).

Исторические файлы в `autopulse_car_service_specs/` сохраняются как продуктовая
спецификация, но не должны использоваться как подтверждение текущего состояния
реализации без сверки с кодом и актуальной документацией.

## Быстрый запуск (Quick Start)

### Требования

- Node.js 20 LTS или новее;
- Docker с Compose v2;
- PostgreSQL client (`psql` и `createdb`) для подготовки integration-БД.

### Шаги для локального запуска

1. **Установка зависимостей:**

   ```bash
   npm ci
   ```

2. **Создание локальной конфигурации:**

   ```bash
   cp .env.example .env
   ```

   Значения по умолчанию рассчитаны на локальный PostgreSQL из
   `docker-compose.yml`. Секреты из шаблона нельзя использовать в production.

3. **Запуск базы данных в Docker:**

   ```bash
   docker compose up -d postgres
   ```

4. **Применение миграций:**

   ```bash
   npx prisma migrate deploy
   ```

5. **Опционально — создание локального demo-пользователя:**

   ```bash
   npx prisma db seed
   ```

   Команда создаёт только локального пользователя `demo / demo123`, если его ещё
   нет. Системные категории ТО устанавливаются миграцией и от seed не зависят.
   В production demo-seed запускать не следует.

6. **Запуск Next.js в режиме разработки:**

   ```bash
   npm run dev
   ```

   Приложение будет доступно на
   [http://localhost:3000](http://localhost:3000). Новый аккаунт можно создать
   на странице `/register`.

7. **Запуск проверок:**

   ```bash
   npm run test:prepare
   npm run verify
   ```

### Запуск всего стека в Docker (Production Build)

```bash
docker compose up -d --build
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

- **Авторизация:** Реализованы username/password и Telegram Login Widget через HttpOnly JWT-cookie.
- **Email/Push уведомления:** Поддерживаются `in_app`, email и Web Push при наличии конфигурации провайдера.
- **Загрузка файлов:** Изображения загружаются в Cloudinary с ограничением размера и формата.
- **Шифрование VIN/госномера:** Новые и изменённые значения шифруются AES-256-GCM. Для старых данных выполните `npm run encrypt-sensitive-data`.
- **Мультивалютность:** Поддерживаются USD, BYN, RUB и EUR. Суммы считаются отдельно и не конвертируются.
- **Offline режим PWA:** Service worker кэширует только статические ресурсы; полноценная offline-работа с данными не поддерживается.
- **Telegram уведомления:** Поле `channel` поддерживает `telegram`, но интеграция с ботом не реализована.
- **OCR чеков:** Доступен при наличии `OCR_SPACE_API_KEY`; распознанные значения всегда требуют проверки пользователем.
- **JSON import:** Создаёт новый автомобиль и восстанавливает карточку,
  документы, шины и заправки. Планы ТО, сервисные записи и наблюдения из полного
  JSON export пока не импортируются.

## Эксплуатация и аналитика

- `/ownership` — заправки, документы, комплекты шин, OCR чеков, роли viewer/editor, экспорт и импорт;
- `/analytics` — расходы по валютам, месяцам и категориям, стоимость километра, годовой прогноз и бюджеты;
- PDF, CSV и JSON экспорт доступны из раздела «Эксплуатация»;
- документы со сроком действия автоматически попадают в notification engine за 30 и 7 дней и после истечения.

## Проверки и тесты

- `npm run lint` — проверка ESLint.
- `npm run typecheck` — строгая TypeScript-проверка.
- `npm run test:unit` — быстрые unit-тесты доменной логики.
- `npm run test:integration` — интеграционные тесты с PostgreSQL. Перед запуском нужен `docker compose up -d postgres`.
- `npm run test:prepare` — создаёт и мигрирует локальную изолированную `autopulse_test`.
- `npm run test:e2e` — браузерные smoke/E2E сценарии Playwright.
- `npm test` — полный прогон unit + integration.

## Production: Vercel + PostgreSQL

- Приложение рассчитано на Vercel и совместимую PostgreSQL, включая Neon и
  Supabase.
- Для Prisma используются две строки подключения:
  - `DATABASE_URL` — runtime URL. Для Vercel/Supabase используйте pooled connection string.
  - `DIRECT_URL` — direct connection string для `prisma migrate deploy`, `prisma studio` и других административных операций.
- Обязательные production env в Vercel:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `JWT_SECRET`
  - `DATA_ENCRYPTION_KEY`
  - `CRON_SECRET`
- В production напоминания обрабатывает
  [Vercel Cron route](src/app/api/cron/notifications/route.ts) по расписанию из
  [vercel.json](vercel.json).
- Vercel cron делает `GET` на `/api/cron/notifications`; при наличии
  `CRON_SECRET` Vercel автоматически отправляет
  `Authorization: Bearer <CRON_SECRET>` — см.
  [официальную документацию Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- Локальный `src/worker/cron.ts` остаётся удобным dev-режимом, если нужно погонять напоминания вне Vercel.

---

## Для ИИ-агентов

Папка [`.agents/`](.agents/) содержит:

- [`AGENTS.md`](.agents/AGENTS.md) — актуальные правила разработки и контекст
  для ИИ-агентов;
- [`implementation_plan.md`](.agents/implementation_plan.md) — краткая карта
  этапов и ссылка на официальный план.
