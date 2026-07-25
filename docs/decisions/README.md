# Реестр архитектурных решений

## Принятые решения

| ID | Решение | Статус |
| --- | --- | --- |
| ADR-001 | Next.js route handlers являются HTTP-слоем, бизнес-логика живёт в application/domain | принято |
| ADR-002 | PostgreSQL + Prisma migrations являются источником истины схемы | принято |
| ADR-003 | Cookie-based JWT session; токен не возвращается клиентскому JavaScript | принято |
| ADR-004 | Vercel Cron в production, polling worker только для local/self-hosted | принято |
| ADR-005 | Feature-based frontend modules вместо page monoliths | принято |
| ADR-006 | Notification generation отделена от delivery state machine | принято |
| ADR-007 | Денежные суммы агрегируются отдельно по USD/BYN/RUB/EUR без неявной конвертации | принято |
| ADR-008 | VIN и госномер шифруются AES-256-GCM прикладным ключом | принято |

## Формат новой ADR

Каждая запись должна содержать:

- контекст и проблему;
- принятое решение;
- рассмотренные альтернативы;
- последствия и риски;
- план миграции;
- статус: proposed, accepted, superseded или deprecated.

ADR обязательна при смене auth/session подхода, инфраструктуры jobs, ORM,
публичных API-контрактов, стратегии состояния frontend или внешнего провайдера.
