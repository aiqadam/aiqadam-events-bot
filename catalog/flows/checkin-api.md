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

**ROUTER сразу после проверки `initData`** (`step_10`): невалидный `initData`
отвечает `401` немедленно, ветка `valid` — единственное место, где
выполняются остальные проверки и обращения к таблицам. Смысл гейта в том,
чтобы мусорный публичный запрос (эндпоинт `authType: none`) не тратил
обращения к `event_staff` и `callFlow`-хопы.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём POST |
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData` по `BOT_TOKEN` (STF-2, первая половина) |
| step_10 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'` |
| step_11 (Otherwise) | CODE «invalid init data response» | `texts['checkin.unauthorized']`, `httpStatus: 401` |
| step_12 (Otherwise) | `return_response` | ответ `401` немедленно, ветка `valid` не выполняется |
| step_2 (valid) | `callFlow fn-parse-start` | разбор QR-`payload` (`kind` должен быть `c`) |
| step_3 (valid) | `tables-find-records event_staff` | `(event_id, telegram_id контролёра)` + `revoked_at not_exists` — **вторая половина STF-2**: без фильтра по `event_id` любой участник отметит соседа |
| step_4 (valid) | `callFlow fn-verify-qr` | подпись QR по `QR_SIGNING_KEY` |
| step_5 (valid) | `callFlow fn-find-registration` | регистрация участника **по данным из QR**, не из запроса |
| step_6 (valid) | `tables-find-records users` | имя участника для ответа контролёру (`first_name`, проекция) |
| step_7 (valid) | CODE «decide result» | пять оставшихся исходов STF-4 (см. ниже, `invalid_init_data` теперь решает `step_10`), время `already` — Asia/Tashkent, тексты — `inputs.texts` (ADR-0014) |
| step_8 (valid) | `tables-update-record` (`continueOnFailure`) | `checked_in_at`/`checked_in_by`, **`only_if: checked_in_at not_exists`** — атомарная гарантия IDM-2. При исходе не-`ok` вместо id записи подставляется сентинел `-`: гарантированный 404, безопасный no-op |
| step_9 (valid) | `return_response` | JSON-ответ Mini App |

### Порядок проверок и HTTP-статусы

| Условие | `status` | HTTP | Где решается |
|---|---|---|---|
| `initData` невалиден | `invalid_init_data` | 401 | `step_10` (ROUTER), до `step_7` не доходит |
| контролёр не staff **этого** `eventId` (или отозван) | `forbidden` | 403 | `step_7` |
| QR не `c`-payload / не распарсен | `invalid` | 200 | `step_7` |
| `eventId` из QR ≠ запрошенный | `wrong_event` | 200 | `step_7` |
| подпись QR не сошлась | `invalid` | 200 | `step_7` |
| нет регистрации / `status ≠ registered` | `not_registered` | 200 | `step_7` |
| `checked_in_at` уже стоит | `already` (+ время Tashkent) | 200 | `step_7` |
| иначе | `ok` (+ имя) | 200 | `step_7` |

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
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** во всех четырёх
  вызовах внутри ветки `valid` (см. CLAUDE.md, Gotchas Qadam Flow, п. 7a).
- **Контракт ответа согласован с роут `#/scan` SPA (сканер)**: `{status,
  text}` плоско в теле, `status = invalid_init_data` на 401.
- **Тексты (`step_7`, `step_11`) — через `inputs.texts`**, не литералом в коде
  (ADR-0014); значения сверены с `i18n/ru.json`.
- **Менять этот ROUTER можно только пересборкой цепочки внутри ветки.**
  `ap_add_step` с `ROUTER` через `AFTER` на уже связанный шаг не гейтит
  существующее продолжение — старое ребро остаётся безусловным путём, и
  обе цепочки выполняются одновременно (CLAUDE.md, Gotchas Qadam Flow, п. 10).
  Для этого флоу цена ошибки максимальна: незагейченная ветка `valid` — это
  чекин без проверки `initData`.
- **В таблицах `events`/`registrations` намеренно оставлена фикстура
  `demo`** (ивент `id: demo`, регистрация `demo-322876545`, staff-запись
  в `event_staff` на того же контролёра) — нужна, чтобы STF-2 можно было
  проверить вживую без пересборки окружения.
