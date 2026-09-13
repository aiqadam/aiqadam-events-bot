# Flow: fn-sign-qr

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `registration`
  (выдача QR) и `my-qr-api` (ADR-0015 п. 5)
- **Назначение**: подписать QR-payload участника (`c<eventId>-<userId>-<sig>`).
- **Flow ID (MCP)**: `9XXJu9hlSJC8nIfoYjMcV` · **externalId (для `callFlow`)**: `VvSckbBbWGJcq7MaNGbwm`

## Шаги

Код — байт-в-байт эталон [`snippets/hmac-qr.md`](../snippets/hmac-qr.md), раздел
«Код — сторона подписи».

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход | — |
| step_1 | CODE — канонический `msg` | валидация формы `eventId`/`userId`, падает громко на мусоре | `{{trigger['output'].data.eventId}}`, `.userId}}` |
| step_2 | CODE — подпись (`node:crypto`, ADR-0010) | HMAC-SHA256 → base64 → base64url → срез 10 символов | `{{step_1['output'].msg}}`, `{{trigger['output'].data.qrSigningKey}}` |
| step_3 | `returnResponse` | отдаёт `{sig, eventId, userId, msg, payload}` | — |

## Зависимости

- **Таблицы**: —
- **Переменные**: `QR_SIGNING_KEY` передаётся вызывающим как `qrSigningKey`
  (сам `fn-sign-qr` переменных не читает — единственная форма `{{variables['NAME']}}`
  остаётся на стороне вызывающего)
- **Connections**: —

## Заметки

- Формат `msg = 'c:' + eventId + ':' + userId` менять нельзя — обесценивает
  все уже выданные QR.
- Подписывает пустые/мусорные `eventId`/`userId` — намеренное исключение
  из правила «не падать на мусоре» (`snippets/README.md`): подписать пустой
  `eventId` хуже, чем упасть.
