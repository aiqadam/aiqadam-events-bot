# Flow: checkin-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/rKoDYtiIVdbzlW59b57uH/sync`
- **Назначение**: основной путь чекина через Mini App-сканер. Проверяет
  `initData` контролёра (STF-2), права на конкретный ивент, подпись QR,
  состояние регистрации; пишет `checked_in_at` атомарно (IDM-2).
- **Flow ID (MCP)**: `rKoDYtiIVdbzlW59b57uH`

## Вход

`POST` тела: `{ initData, payload, eventId }` — `payload` это `c<eventId>-<userId>-<sig>`
из QR участника, `eventId` — какой ивент сканирует контролёр (из Mini App URL).

## Шаги

Флоу **линейный, без ROUTER**: все проверки читаются заранее, решение и HTTP-ответ
считает один CODE-шаг. Это сознательный выбор — ROUTER-ветки в этом движке не
сходятся обратно, а здесь после любого исхода нужен один и тот же ответ вебхука.

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём POST | — |
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData` по `BOT_TOKEN` (STF-2, первая половина) | `payload: {initData, botToken: {{variables['BOT_TOKEN']}}, maxAgeSeconds}` |
| step_2 | `callFlow fn-parse-start` | разбор QR-`payload` (`kind` должен быть `c`) | `payload: {start}` |
| step_3 | `tables-find-records event_staff` | `(event_id, telegram_id контролёра)` + `revoked_at not_exists` — **вторая половина STF-2**: без фильтра по `event_id` любой участник отметит соседа | `event_id eq {{trigger.body.eventId}}`, `telegram_id eq {{step_1.data.telegramId}}` |
| step_4 | `callFlow fn-verify-qr` | подпись QR по `QR_SIGNING_KEY` | `payload: {eventId, userId, sig, qrSigningKey}` из `step_2.data` |
| step_5 | `callFlow fn-find-registration` | регистрация участника **по данным из QR**, не из запроса | `payload: {eventId, telegramId}` = `step_2.data.eventId/userId` |
| step_6 | `tables-find-records users` | имя участника для ответа контролёру (`first_name`, проекция) | `telegram_id eq {{step_2.data.userId}}` |
| step_7 | CODE «decide result» | все шесть исходов STF-4 одним деревом `if/else` (см. ниже), время `already` — Asia/Tashkent | |
| step_8 | `tables-update-record` (`continueOnFailure`) | `checked_in_at`/`checked_in_by`, **`only_if: checked_in_at not_exists`** — атомарная гарантия IDM-2 | `record_id` = реальный id при исходе `ok`, иначе `-` (гарантированно 404, безопасный no-op) |
| step_9 | `return_response` | JSON-ответ Mini App | `status`/`text` из `step_7` |

### Порядок проверок (`step_7`) и HTTP-статусы

| Условие | `status` | HTTP |
|---|---|---|
| `initData` невалиден | `unauthorized` | 401 |
| контролёр не staff **этого** `eventId` (или отозван) | `forbidden` | 403 |
| QR не `c`-payload / не распарсен | `invalid` | 200 |
| `eventId` из QR ≠ запрошенный | `wrong_event` | 200 |
| подпись QR не сошлась | `invalid` | 200 |
| нет регистрации / `status ≠ registered` | `not_registered` | 200 |
| `checked_in_at` уже стоит | `already` (+ время Tashkent) | 200 |
| иначе | `ok` (+ имя) | 200 |

## Зависимости

- **Таблицы**: `event_staff`, `registrations` (чтение через `fn-find-registration`,
  запись — `only_if`-guarded update), `users` (чтение имени)
- **Флоу**: `fn-hmac-init-data`, `fn-parse-start`, `fn-verify-qr`, `fn-find-registration`
- **Переменные**: `BOT_TOKEN` (ADR-0008), `QR_SIGNING_KEY`
- **Connections**: —

## Заметки

- **`only_if: checked_in_at not_exists` — настоящая атомарная гарантия
  IDM-2**, не соглашение поверх non-atomic БД: платформа сама проверяет и
  пишет одним действием, при провале условия отдаёт `409
  RECORD_PRECONDITION_FAILED`. Проверено 2026-09-13 отдельным стендом:
  первый вызов на пустом `checked_in_at` — успех; второй на том же
  `record_id` — `409`. Это сильнее, чем CAS-с-перечитыванием, которым эта же
  гарантия добивалась в удалённом коде до W26 (см. историю W20 в STATUS.md).
- **`callFlow`'s `flowProps` — обязательно обёртка `{"payload": {...}}`**
  (открытие W26, см. `tg-router.md`) — применено во всех пяти вызовах.
- **Полный сквозной прогон (`hmacValid: true`) требует настоящей `initData`
  от живого Telegram-клиента** — `BOT_TOKEN` секретный, агент не может её
  подделать. Проверено агентом: `unauthorized` (401, мусорный `initData`,
  прогон в вывод) и атомарность записи (отдельный стенд). **Не проверено
  агентом**: `forbidden`/`wrong_event`/`invalid`/`not_registered`/`already`/`ok`
  — все требуют валидной подписи, которую даёт только реальный клиент.
  Это тот же паттерн, что в W8 (Q16): «прогон на живом `initData`» —
  отдельный, обязательный шаг перед `готово`, который делает владелец.
- **Подпись QR подтверждена совместимой со старым проектом**: `fn-sign-qr`
  с реальным `QR_SIGNING_KEY` для `(demo, 322876545)` дал `aIxmwbnzb_` —
  то самое значение, что зафиксировано в `catalog/snippets/hmac-qr.md` до
  очистки инстанса. Ключ не менялся, крипто-цепочка совместима.
