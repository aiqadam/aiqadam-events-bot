# Flow: fn-find-registration

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из
  `checkin-api` (`step_5`) и `my-qr-api` (`step_3`), ADR-0015 п. 5 —
  «общие чтения». Обработчики регистрации и списков его **не** зовут:
  `reg-start`, `my-regs`, `my-reg-cancel` читают `registrations` напрямую,
  потому что им нужна выборка по ивенту или по участнику целиком, а не
  одна каноническая строка пары
- **Назначение**: найти каноническую регистрацию участника на ивент, схлопнув
  дубли по `(event_id, telegram_id)` детерминированно (IDM-1, ADR-0003).
- **Flow ID (MCP)**: `O5TtpU4antbkUgeKXVwq5` · **externalId (для `callFlow`)**: `Q3iGnxOcpjzeUVvXQc48L`

## Шаги

Код — байт-в-байт эталон [`snippets/find-registration.md`](../snippets/find-registration.md).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход | — |
| step_1 | CODE — normalize | валидация формы, сентинел `-` вместо пустого фильтра | `{{trigger['output'].data.eventId}}`, `.telegramId}}` |
| step_2 | `tables-find-records` (`registrations`, `SM8tMxfQuQCHRDdAiNJyQ`) | `eq event_id` + `eq telegram_id`, без `limit` | `{{step_1['output'].queryEventId}}`, `.queryTelegramId}}` |
| step_3 | CODE — pick earliest | отбор по паре повторяется в коде (страховка от fail-open, #382), сортировка по `registered_at`→`created`→`id`, самый ранний `checked_in_at` (IDM-2) | `{{step_2['output']}}` |
| step_4 | `returnResponse` | отдаёт `{found, inputOk, duplicates, recordId, recordIds, registration, checkedIn, checkedInAt, cancelled, registered, statuses, anyRegistered, anyCancelled, eventId, telegramId}` | — |

## Зависимости

- **Таблицы**: `registrations` (`SM8tMxfQuQCHRDdAiNJyQ`)
- **Переменные**: —
- **Connections**: —

## Заметки

- **Без `limit`** — с лимитом каноническая строка может не попасть в выборку.
- **Наружу отдаются `anyRegistered`/`anyCancelled`** — не только статус
  канонической строки: вызывающему, которому нужна осторожность (например,
  решение слать ли повторное подтверждение), мало одного значения.
- **Фильтр изолирует по `event_id`** — та же регистрация другого `event_id`
  не находится (`found:false`), аналог STF-2 для чтений.
