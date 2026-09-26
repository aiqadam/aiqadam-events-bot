# Flow: fn-sign-qr

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается только из
  `my-qr-api` (`step_4`, ADR-0015 п. 5). Выдача QR участнику на подпись не
  ходит: `reg-consent-mkt` шлёт кнопку `web_app` на `#/ticket`, а подписывает
  уже `my-qr-api` при открытии страницы
- **Назначение**: подписать QR-payload участника (`c<eventId>-<userId>-<sig>`).
- **Flow ID (MCP)**: `SS91uEqPxhpn0yzBct6M4` · **externalId (для `callFlow`)**: `zxS7MKLXGaCDf3KStMTZN`

## Шаги

Код — байт-в-байт эталон [`snippets/hmac-qr.md`](../snippets/hmac-qr.md), раздел
«Код — сторона подписи».

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход |
| step_1 | CODE — канонический `msg` | валидация формы `eventId`/`userId`, падает громко на мусоре |
| step_2 | CODE — подпись (`node:crypto`, ADR-0010) | HMAC-SHA256 → base64 → base64url → срез 10 символов |
| step_3 | `returnResponse` | отдаёт `{sig, eventId, userId, msg, payload}` |

## Зависимости

- **Таблицы**: —
- **Переменные**: `QR_SIGNING_KEY` передаётся вызывающим как `qrSigningKey`
  (сам `fn-sign-qr` переменных не читает — единственная форма `{{variables['NAME']}}`
  остаётся на стороне вызывающего)
- **Connections**: —

## Заметки

- Формат `msg = 'c:' + eventId + ':' + userId` менять нельзя — обесценивает
  все уже выданные QR.
- **Падает на пустых/мусорных `eventId`/`userId`** (`throw` в `step_1`:
  `eventId` — `^[A-Za-z0-9_]{1,12}$`, `userId` — `^[0-9]{1,16}$`) — намеренное
  исключение из правила «не падать на мусоре» (`snippets/README.md`):
  подписать пустой `eventId` хуже, чем упасть. Поэтому вызывающий обязан
  ставить `continueOnFailure: true` — см. `my-qr-api`.
