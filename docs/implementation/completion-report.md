# Отчёт о реализации roadmap P0–P7

Дата: **2026-07-25**.

## Выполнено

### P0 — baseline

- lint и typecheck приведены к зелёному состоянию;
- добавлены Prisma config, изолированная `autopulse_test`, preflight и подготовка БД;
- создан GitHub Actions pipeline;
- обновлён dependency tree, `npm audit` сообщает 0 уязвимостей.

### P1 — безопасность и корректность

- Vercel Cron добавлен в `vercel.json`, proxy поддерживает bearer auth;
- создан настоящий `/api/observations/:id/close`;
- связанные Observation ресурсы проверяются на принадлежность тому же vehicle;
- Telegram Login Widget проверяется через SHA-256/HMAC, timing-safe comparison и TTL;
- JWT использует только HS256, production fallback запрещён;
- добавлен server-side logout;
- ServiceRecord не принимает пробег ниже текущего.

### P2 — уведомления и интеграции

- добавлена миграция `PushSubscription` и индексы;
- генерация отделена от доставки;
- реализованы claim, attempts, retry/backoff, sent/failed states;
- upload ограничен по rate, размеру и MIME;
- email HTML экранирует пользовательские значения;
- push endpoint нельзя перезаписать из чужого аккаунта.

### P3 — backend-модули

- выделены `src/domain`, `src/server`, `src/integrations`;
- Observation и ServiceRecord транзакции вынесены в application services;
- notification generation/delivery разделены;
- добавлен единый `ApiError`.
- обязательные системные категории ТО перенесены из demo-seed в идемпотентную
  миграцию справочных данных.

### P4 — frontend-модули

- типы dashboard, maintenance и vehicle workspace вынесены в feature-модули;
- vehicle header, tabs, plans, records и observations выделены в компоненты;
- пять форм workspace выделены в самостоятельные диалоги;
- загрузка workspace перенесена в `useVehicleWorkspace`, mutation-запросы — в
  единый feature API client;
- `vehicles/[id]/page.tsx` сокращён с 2133 до примерно 230 строк;
- добавлены доступные tab semantics и touch targets;
- диалоги получили modal semantics, закрытие по Escape, связанные labels и
  локальные сообщения об ошибках;
- исправлен hydration mismatch регистрации и настоящий logout flow.

### P5 — тестирование

- 40 unit tests;
- 20 PostgreSQL integration/security tests;
- proxy/cron contract regression;
- Playwright: health, регистрация, первый автомобиль, формы workspace,
  раздельные валюты и PDF-экспорт;
- CI запускает unit, integration, build и E2E.

### P6 — эксплуатация

- публичный безопасный health endpoint;
- проверка обязательных production variables;
- structured cron logging;
- актуализированы environment template, runbooks и архитектурные документы.

### P7 — эксплуатация автомобиля и hardening

- USD, BYN, RUB и EUR валидируются и агрегируются раздельно;
- уведомления учитывают IANA timezone, локальное время и тихие часы;
- зависшие delivery leases автоматически возвращаются в очередь;
- добавлены документы, шины, заправки, OCR чеков и напоминания о документах;
- добавлены аналитика, прогноз, стоимость километра и бюджеты по валютам;
- реализованы viewer/editor роли и выбор основного автомобиля;
- добавлены JSON/CSV/PDF export и JSON import;
- VIN и госномер шифруются AES-256-GCM;
- rate limiting перенесён из памяти процесса в PostgreSQL;
- logout и смена пароля отзывают старые JWT;
- мобильная навигация сокращена до пяти основных действий и учитывает safe area;
- E2E выполняется в Desktop Chrome и мобильном Pixel 5 профиле.

## Проверяемые команды

```bash
npm run test:prepare
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
npm audit --audit-level=high
```

## Операционное действие перед production

1. Создать уникальные production-значения `JWT_SECRET`,
   `DATA_ENCRYPTION_KEY` и `CRON_SECRET`.
2. Применить `npx prisma migrate deploy`.
3. Для существующих открытых VIN/госномеров один раз выполнить
   `npm run encrypt-sensitive-data`.

Ранее в истории `.env.example` находился VAPID private key. Он удалён из текущей
версии, но должен считаться скомпрометированным: перед production необходимо
сгенерировать новую пару VAPID и заменить значения в Vercel. Переписывание git
history выполняется только отдельным согласованным действием.
