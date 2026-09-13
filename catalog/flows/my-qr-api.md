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
| step_4 | CODE «decide result» | `unauthorized` / `not_registered` / `ok` | |
| step_5 | `return_response` | JSON: `{status, eventId, userId, payload}` | |

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
- Полный `ok`-сценарий требует настоящей `initData` от живого клиента —
  тот же ограничитель, что в `checkin-api.md`. Проверено агентом: `401` на
  мусорном `initData` (`fn-sign-qr` корректно поймана `continueOnFailure`,
  ответ `{"status":"unauthorized"}`).
