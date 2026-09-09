# Flow: fn-sign-qr

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: подпись QR участника (PAR-6) — `sig` из 10 символов base64url.
- **Flow ID (MCP)**: `VBkXevctQRgh3em0v2ndA` · **externalId (для `callFlow`)**: `uQ1m96xr6s66C7KopPnBE`

## Контракт

**Вход:** `{ eventId: string, userId: string }` (`userId` — `telegram_id` строкой)

**Выход:** `{ sig, eventId, userId, msg, payload }`, где
`msg = "c:" + eventId + ":" + userId`, `payload = "c" + eventId + "-" + userId + "-" + sig`.

Полный дайджест наружу **не отдаётся**: в QR публикуются первые 10 символов,
остальные 33 не нужны никому, а вывод шага попадает в лог каждого прогона
([ADR-0005](../../docs/adr/0005-secrets-visible-in-run-logs.md)). Убрано по
замечанию I второго ревью; проверено прогоном `7GNpQUi1Zvpe9ciQj7bpH` —
в выходе только `sig`.

**Падает** (а не возвращает `valid: false`) на `eventId` вне `[A-Za-z0-9_]{1,12}`
или `userId` вне `[0-9]{1,16}`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «canonical msg» | валидация + канонический `msg` | `{{trigger['output'].data.eventId}}`, `...userId` |
| step_2 | CODE «sig = HMAC(QR_SIGNING_KEY, msg) + base64url + cut to 10 (node:crypto, ADR-0010)» | HMAC-SHA256 + кодирование в одном шаге | `msg` = `{{step_1['output'].msg}}`, `qrSigningKey` = `{{variables['QR_SIGNING_KEY']}}`; возвращает `{ sig, eventId, userId, msg, payload }` |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_2['output']}}` |

**С 2026-09-09 (W16, [ADR-0010](../../docs/adr/0010-unsandboxed-code-step-for-crypto.md)):**
старые `step_2` (`@aiqadam/qadam-crypto : hmac-signature`) + `step_3` (CODE
«base64url + cut to 10») слиты в один CODE-шаг через `node:crypto` — полный
HMAC-дайджест перестал быть *выводом* какого-либо шага, наружу по-прежнему
только `sig` (10 символов). **Работает только при `AP_EXECUTION_MODE=UNSANDBOXED`**
на инстансе (обратимая настройка, см. ADR-0010 «Следствия»).

## Зависимости

- **Таблицы**: — · **Connections**: —
- **Переменные**: `QR_SIGNING_KEY` (только `{{variables['QR_SIGNING_KEY']}}`)

## Заметки

- **W16, 2026-09-09**: `step_2`+`step_3` слиты в один CODE-шаг (`node:crypto`,
  ADR-0010). Регресс исключён прогоном на реальном `QR_SIGNING_KEY`:
  `eventId=meetup01, userId=123456789` дал `sig: "NBqSKT4StU"` (прогон
  `29op9oeJfU7XcHHxqFRHz`) — то же значение, что документировано ниже для старой
  двухшаговой цепочки (`NBqSKT4StUDQQa8yVXWZqarAYGLe3OEynv6mcR6CHf0=`.slice(0,10)).
  Стаб-путь (`eventId=x, userId=0`, тот же `msg` формат, что использует
  `fn-verify-qr` для мусорного входа) дал `sig: "Roafqu7eao"` (прогон
  `MV7L4myiJhYsZLTuxthZG`) — совпадает с тем, что тем же прогоном получил
  `fn-verify-qr` на своём инлайненном пути (см. заметки `fn-verify-qr.md`) —
  дублированная логика не разошлась. Подробности — [W16](../../docs/work/W16-hmac-inline-code-step.md).
- **Криптографию с 2026-09-09 считает сам CODE step через `node:crypto`
  (ADR-0010), не отдельный `crypto` qadam** — узкое, явно поименованное
  исключение из «HMAC руками не пишем», не общее снятие запрета
  (см. CLAUDE.md, ADR-0001). base64→base64url по-прежнему строковые операции.
- **Ключ действительно подставляется.** Контроль: HMAC-SHA256 с *пустым* ключом от
  `c:meetup01:123456789` даёт `hXO+doL7M4yot0XfX6zoJrukAfHxavZuiZ8csDvmspw=`,
  инстанс вернул `NBqSKT4StUDQQa8yVXWZqarAYGLe3OEynv6mcR6CHf0=`. Значения расходятся —
  значит `{{variables['QR_SIGNING_KEY']}}` не пустая строка. Без такой сверки
  опечатка в имени переменной выглядит как успешный прогон.
- **Падение на пустом входе — выбор, не недосмотр.** Подпись от `c::` валидна
  арифметически и катастрофична по смыслу: она сошлась бы у любого «пустого» QR.
- Срока жизни у подписи нет; ротация `QR_SIGNING_KEY` инвалидирует все выданные QR.
