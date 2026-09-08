# Flow: fn-sign-qr

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: подпись QR участника (PAR-6) — `sig` из 10 символов base64url.
- **Flow ID (MCP)**: `VBkXevctQRgh3em0v2ndA` · **externalId (для `callFlow`)**: `uQ1m96xr6s66C7KopPnBE`

## Контракт

**Вход:** `{ eventId: string, userId: string }` (`userId` — `telegram_id` строкой)

**Выход:** `{ sig, b64url, eventId, userId, msg, payload }`, где
`msg = "c:" + eventId + ":" + userId`, `payload = "c" + eventId + "-" + userId + "-" + sig`.

**Падает** (а не возвращает `valid: false`) на `eventId` вне `[A-Za-z0-9_]{1,12}`
или `userId` вне `[0-9]{1,16}`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «canonical msg» | валидация + канонический `msg` | `{{trigger['output'].data.eventId}}`, `...userId` |
| step_2 | `@aiqadam/qadam-crypto : hmac-signature` | HMAC-SHA256 | `secretKey` = `{{variables['QR_SIGNING_KEY']}}`, `secretKeyEncoding` = `utf-8`, `method` = `sha256`, `text` = `{{step_1['output'].msg}}`, `outputEncoding` = **`base64`** |
| step_3 | CODE «base64url + cut to 10» | `+`→`-`, `/`→`_`, срез `=`, `slice(0,10)` | `{{step_2['output']}}` (строка) |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_3['output']}}` |

## Зависимости

- **Таблицы**: — · **Connections**: —
- **Переменные**: `QR_SIGNING_KEY` (только `{{variables['QR_SIGNING_KEY']}}`)

## Заметки

- **Криптографию считает qadam, Code step только кодирует.** Своей реализации HMAC
  быть не может: в песочнице нет ни `node:crypto`, ни `crypto.subtle`, ни `Buffer`.
  Поэтому base64→base64url — строковые операции, другого пути нет.
- **Выход `hmac-signature` — голая строка**, не объект: `{{step_2['output']}}`.
- **Ключ действительно подставляется.** Контроль: HMAC-SHA256 с *пустым* ключом от
  `c:meetup01:123456789` даёт `hXO+doL7M4yot0XfX6zoJrukAfHxavZuiZ8csDvmspw=`,
  инстанс вернул `NBqSKT4StUDQQa8yVXWZqarAYGLe3OEynv6mcR6CHf0=`. Значения расходятся —
  значит `{{variables['QR_SIGNING_KEY']}}` не пустая строка. Без такой сверки
  опечатка в имени переменной выглядит как успешный прогон.
- **Падение на пустом входе — выбор, не недосмотр.** Подпись от `c::` валидна
  арифметически и катастрофична по смыслу: она сошлась бы у любого «пустого» QR.
- Срока жизни у подписи нет; ротация `QR_SIGNING_KEY` инвалидирует все выданные QR.
