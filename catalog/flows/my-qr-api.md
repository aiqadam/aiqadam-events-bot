# Flow: my-qr-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/WYmnxVM4xPAWZA1IvNZok/sync`
- **Назначение**: отдаёт подписанный QR-`payload` участнику для клиентского
  рендеринга в `miniapp/ticket.html` (ADR-0007 — QR не шлётся файлом).
- **Flow ID (MCP)**: `WYmnxVM4xPAWZA1IvNZok`

## Вход

`POST` тела: `{ initData, eventId }` — `initData` берётся `ticket.html` из
`Telegram.WebApp.initData`, `eventId` — из query-параметра страницы.

## Шаги

**ROUTER сразу после проверки `initData`** (`step_2`), тот же приём, что и в
`checkin-api`: невалидный `initData` отвечает `401` немедленно, без обращения
к `fn-find-registration`/`fn-sign-qr`.

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём POST | — |
| step_1 | `callFlow fn-hmac-init-data` | проверка `initData` участника | `payload: {initData, botToken: {{variables['BOT_TOKEN']}}, maxAgeSeconds}` |
| step_2 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'` | |
| step_7 (Otherwise) | CODE «invalid init data response» | `texts['checkin.unauthorized']`, `httpStatus: 401` | |
| step_8 (Otherwise) | `return_response` | ответ `401` немедленно | `status/body` из `step_7` |
| step_3 (valid) | `callFlow fn-find-registration` | своя регистрация на `eventId` | `payload: {eventId, telegramId: step_1.data.telegramId}` |
| step_4 (valid) | `callFlow fn-sign-qr` (`continueOnFailure`) | подпись `(eventId, userId)` | `payload: {eventId, userId: step_1.data.telegramId, qrSigningKey: {{variables['QR_SIGNING_KEY']}}}` |
| step_5 (valid) | CODE «decide result» | `not_registered` / `ok`, тексты — `inputs.texts` (ADR-0014) | |
| step_6 (valid) | `return_response` | JSON: `{ok, error, text, payload, eventId, userId}` — форма, которую ждёт `ticket.html` | |

### Контракт ответа (согласован с `miniapp/ticket.html`)

| Ситуация | Тело |
|---|---|
| успех | `{ok: true, payload: "c<eventId>-<userId>-<sig>"}` |
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
- **Контракт ответа `{ok,error,text,payload}` задан клиентом**: страница
  `miniapp/ticket.html` проверяет `data.ok`/`data.error`, а не `{status,...}`
  (как `checkin-api`) — форма ответа этого флоу подстроена под уже
  задеплоенную статику, а не выбрана свободно.
- **`ROUTER` вставлен через `ap_delete_step` + пересборку цепочки внутри
  ветки** (тот же приём и та же причина, что в `checkin-api` — см. CLAUDE.md,
  Gotchas Qadam Flow, п. 10).
