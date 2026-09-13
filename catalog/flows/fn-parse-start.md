# Flow: fn-parse-start

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  и `checkin-api` (ADR-0015 п. 5)
- **Назначение**: разобрать `/start`-payload (`e...` регистрация, `c...` чекин,
  `s...` инвайт staff).
- **Flow ID (MCP)**: `9iKpekYS4tRUOsmYZaXZg` · **externalId (для `callFlow`)**: `kn8WWJTyEm7S51Blwg0Eg`

## Шаги

Код — байт-в-байт эталон [`snippets/parse-start.md`](../snippets/parse-start.md),
плоская форма: конверт не нужен, ответ вызывающий и так читает как
`{{step_N['output'].data.<поле>}}`.

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
  `valid:false, error:"bad_charset"`. Длина payload'а ограничена 64 символами
  (`too_long`), `eventId` — `^[A-Za-z0-9_]{1,12}$`, `userId` — `^[0-9]{1,16}$`,
  `utm` — `^[A-Za-z0-9_]{1,32}$`, staff-токен — `^[A-Za-z0-9]{22}$`.
- **Ни один вход не валит шаг** — на мусоре возвращается `valid:false`
  с причиной (`empty`, `too_long`, `bad_charset`, `unknown_kind`,
  `bad_event_id`, `bad_user_id`, `bad_sig`, `bad_utm`, `bad_qr_payload`,
  `bad_token`). Это обратная сторона `fn-sign-qr`, который на мусоре падает.
