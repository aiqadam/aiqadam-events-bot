# Flow: fn-verify-qr

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `checkin-api`
  (ADR-0015 п. 5)
- **Назначение**: проверить подпись QR-payload участника при сканировании.
- **Flow ID (MCP)**: `wZbneQfvOoO91zEQTrQGf` · **externalId (для `callFlow`)**: `m5ZG7GqWIQCIluusyNX4c`

## Шаги

Пересчитывает подпись **инлайн**, не зовёт `fn-sign-qr` — правило ADR-0015 п. 5
«функция не зовёт функцию» (один уровень вложенности). Код пересчёта — та же
логика, что в `fn-sign-qr`, продублирована намеренно (см. `hmac-qr.md`).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход | — |
| step_1 | CODE — пересчитать `sig` | тот же HMAC, что в `fn-sign-qr`, инлайн | `{{trigger['output'].data.eventId}}`, `.userId}}`, `.qrSigningKey}}` |
| step_2 | CODE — сравнение | constant-time сравнение переданного `sig` с пересчитанным | `{{trigger['output'].data.sig}}`, `{{step_1['output'].sig}}` |
| step_3 | `returnResponse` | отдаёт `{valid, eventId, userId}` | — |

## Зависимости

- **Таблицы**: —
- **Переменные**: `QR_SIGNING_KEY` передаётся вызывающим как `qrSigningKey`
- **Connections**: —

## Заметки

- **Сравнение — constant-time**, не `===`: тайминг-атака на посимвольное
  сравнение подписи иначе становится теоретически возможной.
- Проверено 2026-09-13 тремя прогонами: настоящая подпись → `valid:true`
  (`2IeQ0ZDutdsNCHLE9eBtQ`); испорченная подпись → `valid:false`
  (`FdWIgVhKCKglnJzn0DVXx`); подпись верна для **другого** `userId` → `valid:false`
  для запрошенного (`SyQ13T9CPnI2NuVRngDee`) — сигнатура привязана к конкретной
  паре `(eventId, userId)`, подмена `userId` при валидном `sig` не проходит.
- Сквозная проверка цепочки: `sig`, выданный `fn-sign-qr` для `(demo, 322876545)`
  (`zrT53qwJct`), пройден через `fn-parse-start` (`cdemo-322876545-zrT53qwJct`)
  и принят здесь как валидный — три независимые функции согласованы.
