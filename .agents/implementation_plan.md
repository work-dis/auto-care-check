# AutoPulse implementation plan

Основной исполнимый план находится в
[`docs/implementation/roadmap.md`](../docs/implementation/roadmap.md).

Статус: **P0–P7 завершены**. Фактический результат описан в
[`docs/implementation/completion-report.md`](../docs/implementation/completion-report.md).

Порядок выполнения:

1. P0 — воспроизводимое окружение и зелёный CI.
2. P1 — cron, ownership, Telegram, JWT и инварианты пробега.
3. P2 — миграция push и надёжная доставка уведомлений.
4. P3 — backend application/domain modules.
5. P4 — поэтапная декомпозиция крупных React-страниц.
6. P5 — contract, security и E2E coverage.
7. P6 — observability, runbooks и production release.
8. P7 — эксплуатация, аналитика, валюты, совместный доступ и hardening.

Новые задачи оформляются отдельным планом с тестами и обновлением официальной
документации; архивные iteration prompts повторно не запускаются.
