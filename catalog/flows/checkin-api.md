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
| `initData` невалиден | `invalid_init_data` | 401 |
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

- **`only_if: checked_in_at not_exists` у `step_8` — атомарная гарантия
  IDM-2**, не соглашение поверх non-atomic БД: платформа сама проверяет и
  пишет одним действием, при провале условия отдаёт `409
  RECORD_PRECONDITION_FAILED`. Сильнее, чем CAS-с-перечитыванием.
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** во всех пяти
  вызовах (см. CLAUDE.md, Gotchas Qadam Flow, п. 7a).
- **Контракт ответа согласован с `miniapp/index.html` (сканер)**: `{status,
  text}` плоско в теле, `status = invalid_init_data` на 401.
- **В таблицах `events`/`registrations` намеренно оставлена фикстура
  `demo`** (ивент `id: demo`, регистрация `demo-322876545`, staff-запись
  в `event_staff` на того же контролёра) — нужна, чтобы STF-2 можно было
  проверить вживую без пересборки окружения.
