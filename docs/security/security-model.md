# Модель безопасности

## 1. Защищаемые данные

- учётные записи и session cookie;
- идентификаторы Telegram;
- VIN, госномер и сведения об автомобиле;
- история пробега, обслуживания и расходов;
- фото чеков и наблюдений;
- push endpoints и ключи подписки;
- секреты JWT, cron, SMTP, Telegram, Cloudinary и VAPID.

## 2. Базовые правила

- deny by default для всех страниц и API, кроме явно публичных auth endpoints;
- ownership проверяется сервером на каждом объекте и каждой связанной сущности;
- UUID от клиента не считается доказательством доступа;
- входные данные изменяющих API проходят Zod-схему либо явную строгую проверку;
- core-секреты обязательны в production и не имеют fallback;
- чувствительные значения не выводятся в логи и HTTP errors;
- операции с несколькими сущностями выполняются транзакционно.

## 3. Матрица доступа

| Ресурс | Read | Create/Update | Delete/Void |
| --- | --- | --- | --- |
| User profile | только текущий пользователь | только текущий | текущий пользователь после подтверждения логином в UI |
| Vehicle | владелец/viewer/editor | владелец/editor | владелец, soft archive |
| Plan/Observation | владелец/viewer/editor | владелец/editor, связи того же vehicle | владелец/editor |
| ServiceRecord | владелец/viewer/editor | владелец/editor | владелец/editor, только void |
| Reminder/Notification | текущий пользователь | владелец target resource | текущий пользователь |
| PushSubscription | текущий пользователь | текущий пользователь | только собственный endpoint |

## 4. Реализованные защитные меры

- устранить cross-vehicle связи Observation;
- закрыть Telegram replay через TTL `auth_date`;
- использовать корректный алгоритм Login Widget и `timingSafeEqual`;
- требовать `JWT_SECRET` и `CRON_SECRET` при production startup;
- rate limits для login/register/telegram/upload хранятся в PostgreSQL и работают между serverless instances;
- ограничить upload по размеру, MIME, dimensions и числу запросов;
- не возвращать JWT в JSON при cookie-based session;
- logout и смена пароля увеличивают `sessionVersion` и аннулируют старые JWT;
- VIN и госномер шифруются AES-256-GCM отдельным `DATA_ENCRYPTION_KEY`.

Открытые ограничения:

- Cloudinary URL является внешним URL провайдера; для строго приватных чеков
  потребуется authenticated delivery или собственный proxy;
- Telegram используется для входа, но доставка Telegram-уведомлений пока не
  реализована;
- смена `DATA_ENCRYPTION_KEY` без отдельной процедуры re-encryption сделает
  ранее зашифрованные VIN и госномера недоступными.

## 5. Security regression suite

Для каждого resource endpoint проверить:

- anonymous → 401;
- authenticated non-owner → 403 или безопасный 404;
- owner → успешная операция;
- foreign related ID → отказ без раскрытия объекта;
- malformed payload → 400;
- expired/tampered token → 401;
- повторная команда не нарушает инварианты.

Перед production-релизом провести dependency audit, secret scan и ручную
проверку OWASP ASVS-сценариев, релевантных cookie-based web application.
