# Flow: my-qr-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/wRV7Iho1yaxJ7VnsS49P4/sync`
- **Назначение**: отдаёт подписанный QR-`payload` участнику для клиентского
  рендеринга в роут `#/ticket` SPA (`miniapp/src/routes/Ticket.tsx`) (ADR-0007 — QR не шлётся файлом).
  Для **онлайн-события** QR не выдаётся вовсе: вместо `payload` отдаётся ссылка
  трансляции (`online_url`) — кнопкой в билете (W67, [ADR-0051](../../docs/adr/0051-online-event-link-instead-of-qr.md)).
- **Flow ID (MCP)**: `wRV7Iho1yaxJ7VnsS49P4`

## Вход

`POST` тела: `{ initData, eventId }` — `initData` берётся роут `#/ticket` из
`Telegram.WebApp.initData`, `eventId` — из query-параметра страницы.

## Шаги

**ROUTER сразу после проверки `initData`** (`step_2`), тот же приём, что и в
`checkin-api`: невалидный `initData` отвечает `401` немедленно, без обращения
к `fn-find-registration`/`fn-sign-qr`.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём POST |
| step_1 | `callFlow fn-hmac-init-data` | проверка `initData` участника |
| step_2 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'` |
| step_7 (Otherwise) | CODE «invalid init data response» | `texts['checkin.unauthorized']`, `httpStatus: 401` |
| step_8 (Otherwise) | `return_response` | ответ `401` немедленно |
| step_3 (valid) | `callFlow fn-find-registration` | своя регистрация на `eventId` |
| step_9 (valid) | `tables-find-records events` (`continueOnFailure`) | `format` и `online_url` события по `id`; сбой чтения = офлайн-ветка с ошибкой |
| step_4 (valid) | `callFlow fn-sign-qr` (`continueOnFailure`) | подпись `(eventId, userId)` (для офлайна; онлайн подпись не отдаёт) |
| step_5 (valid) | CODE «decide result» | `not_registered` / `ok`; при `format=online` — `ok` + `online:true` + `url` (ссылка может быть пустой), без `payload`; регистрация есть, а событие не прочитано → `500` |
| step_6 (valid) | `return_response` | JSON: `{ok, error, text, payload, online, url, eventId, userId}` — форма, которую ждёт `#/ticket` |

### Контракт ответа (согласован с `#/ticket` SPA)

| Ситуация | Тело |
|---|---|
| успех (офлайн) | `{ok: true, payload: "c<eventId>-<userId>-<sig>"}` |
| успех (онлайн) | `{ok: true, online: true, url: "<online_url или ''>"}` — без `payload`; пустой `url` = ссылка ещё не задана |
| `initData` невалиден/просрочен | `{ok: false, error: "invalid_init_data", text}`, HTTP 401 |
| нет активной регистрации | `{ok: false, error: "not_registered", text}` |

## Зависимости

- **Таблицы**: `registrations` (чтение через `fn-find-registration`)
- **Флоу**: `fn-hmac-init-data`, `fn-find-registration`, `fn-sign-qr`
- **Переменные**: `BOT_TOKEN`, `QR_SIGNING_KEY`
- **Connections**: —

## Заметки

- **`fn-sign-qr` обязан вызываться с `continueOnFailure: true`.** Он
  намеренно падает громко на невалидных `eventId`/`userId`
  («подписать мусор хуже, чем упасть», `snippets/hmac-qr.md`) — если
  `initData` невалиден и `telegramId` пуст, подпись пустого `userId` должна
  быть отловлена, а не уронить весь `my-qr-api`.
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** в обоих вызовах
  внутри ветки `valid` (см. CLAUDE.md, Gotchas Qadam Flow, п. 7a).
- **Окно `initData` — 300 c** (`maxAgeSeconds: 300`, [Q49](../../docs/OPEN-QUESTIONS.md#q49)):
  страница `#/ticket` читает `initData` один раз при открытии, короткого окна
  достаточно; `MAX_AGE_CAP` у `fn-hmac-init-data` при этом 43200 — потолок
  для `checkin-api`, не для этого флоу.
- **Контракт ответа `{ok,error,text,payload}` задан клиентом**: страница
  роут `#/ticket` проверяет `data.ok`/`data.error`, а не `{status,...}`
  (как `checkin-api`) — форма ответа этого флоу подстроена под уже
  задеплоенную статику, а не выбрана свободно.
- **Онлайн-событие (W67, [ADR-0052](../../docs/adr/0052-event-format-field-online-offline.md)).**
  `step_9` читает `format` и `online_url` (чужой `eventId`/пустая выборка —
  офлайн-ветка, но `step_5` отдаёт `500`, если регистрация есть, а события нет).
  Онлайн — `format === 'online'` (старые записи без `format` — непустая ссылка).
  QR для онлайна не выдаётся никогда: есть ссылка — она, нет — пустой `url`.
  `fn-sign-qr` в цепочке всё равно вызывается (подпись не возвращается).
  Ссылка видна только владельцу `initData` с активной регистрацией; публичный
  `events-api` её не отдаёт.
- **Менять ROUTER можно только пересборкой цепочки внутри ветки** — та же
  грабля, что в `checkin-api`: вставка ROUTER'а в существующее ребро не
  гейтит старое продолжение (CLAUDE.md, Gotchas Qadam Flow, п. 10).
