# Flow: fn-parse-start

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  и `checkin-api` (ADR-0015 п. 5)
- **Назначение**: разобрать `/start`-payload (`e...` регистрация, `c...` чекин,
  `s...` инвайт staff).
- **Flow ID (MCP)**: `9iKpekYS4tRUOsmYZaXZg` · **externalId (для `callFlow`)**: `kn8WWJTyEm7S51Blwg0Eg`

## Шаги

Код — байт-в-байт эталон [`snippets/parse-start.md`](../snippets/parse-start.md),
плоская форма (без конверта — конверт был нужен только пока `parse-start`
встраивался inline в `tg-router` до ADR-0015; здесь ответ и так `callFlow['output'].data`).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход | — |
| step_1 | CODE — разбор | алфавит/длина → `kind` по первому символу → разбор `e`/`c`/`s` | `{{trigger['output'].data.start}}` |
| step_2 | `returnResponse` | отдаёт `{valid, kind, error, eventId, userId, utm, token, sig, start}` | — |

## Зависимости

- **Таблицы**: —
- **Переменные**: —
- **Connections**: —

## Заметки

- **`sig` — последние 10 символов, не `split('-')`**: base64url содержит дефис
  (SECURITY.md#ловушка-парсинга). Разбор `c`-payload идёт с конца строки.
- **Алфавит payload** — `A-Za-z0-9_-`; символ вне алфавита (пробел, `!`) даёт
  `valid:false, error:"bad_charset"`.
