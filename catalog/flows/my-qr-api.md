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

Линейный, без ROUTER (тот же принцип, что в `checkin-api`).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём POST | — |
| step_1 | `callFlow fn-hmac-init-data` | проверка `initData` участника | `payload: {initData, botToken: {{variables['BOT_TOKEN']}}, maxAgeSeconds}` |
| step_2 | `callFlow fn-find-registration` | своя регистрация на `eventId` | `payload: {eventId, telegramId: step_1.data.telegramId}` |
| step_3 | `callFlow fn-sign-qr` (`continueOnFailure`) | подпись `(eventId, userId)` | `payload: {eventId, userId: step_1.data.telegramId, qrSigningKey: {{variables['QR_SIGNING_KEY']}}}` |
| step_4 | CODE «decide result» | `invalid_init_data` / `not_registered` / `ok` | |
| step_5 | `return_response` | JSON: `{ok, error, text, payload, eventId, userId}` — форма, которую ждёт `ticket.html` | |

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
  `initData` невалиден, `telegramId` пуст, и подпись пустого `userId`
  должна быть отловлена, а не уронить весь `my-qr-api`. Найдено прогоном:
  без `continueOnFailure` весь флоу падал вместо ответа `401`.
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** — как и везде
  после открытия W26 (см. `tg-router.md`).
- **Контракт ответа `{ok,error,text,payload}` — не мой выбор, а то, что уже
  ждёт задеплоенный `ticket.html`.** Первая версия флоу отвечала `{status,...}`
  (как `checkin-api`) — рассинхрон нашёлся только на живом тесте владельца
  («Нет соединения»): страница проверяет `data.ok`/`data.error`, этих полей
  не было. Урок: перед сборкой API с готовым клиентом — сверять форму ответа
  с клиентским кодом **до** сборки, не после.
- **Найден и исправлен блокер, не в самом флоу**: задеплоенный `ticket.html`
  указывал на **старый** `flowId` `my-qr-api` (до-очистки, мёртвый) — та же
  причина, что и у `checkin-api` (Pages деплоится только с `main`, W26 шёл
  веткой). Исправлено PR [#35](https://github.com/aiqadam/aiqadam-events-bot/pull/35).
- Проверено агентом: `401`/`invalid_init_data` на мусорном `initData`
  (`fn-sign-qr` корректно поймана `continueOnFailure`). Полный `ok`-сценарий
  подтверждён живым прогоном владельца в связке с `checkin-api` (см. его
  карточку) — участник получил и отрисовал QR, который затем реально
  отсканировали.
