# Flow: fn-hmac-init-data

- **Статус**: ENABLED
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается через `callFlow`
  (обработчиками `checkin-api`, `my-qr-api`; ADR-0015 п. 5, `fn-*` не зовёт `fn-*`)
- **Назначение**: проверка Telegram `initData` (HMAC-цепочка, STF-2) — единственное,
  что стоит между посторонним и правом отмечать участников.
- **Flow ID (MCP)**: `3iQO67hpGHq1HNGt1T84X` · **externalId (для `callFlow`)**: `VzXoy80RWnX7pM4dm8eor`

## Шаги

Код — байт-в-байт эталон [`snippets/hmac-init-data.md`](../snippets/hmac-init-data.md),
три шага цепочки собраны в одном флоу вместо трёх копий по обработчикам.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход |
| step_1 | CODE — разбор `initData` | канонизация `data_check_string`, извлечение `hash`/`auth_date`/`user` |
| step_2 | CODE — HMAC (`node:crypto`, ADR-0010) | derive secretKey из `botToken`, посчитать ожидаемый hash |
| step_3 | CODE — решение о валидности | constant-time сравнение, потолок свежести 24ч |
| step_4 | `returnResponse` | отдаёт `{valid, hashValid, fresh, reason, telegramId, user, authDate, authDateIso, ageSeconds, maxAgeSeconds}` |

## Зависимости

- **Таблицы**: —
- **Переменные**: `BOT_TOKEN` передаётся вызывающим как `botToken` (ADR-0008:
  вызывающий читает `{{variables['BOT_TOKEN']}}` и кладёт в `flowProps`, сам
  `fn-hmac-init-data` переменных не читает)
- **Connections**: —

## Заметки

- **`telegramId`/`user` отдаются ТОЛЬКО при `valid`** (не при `hashValid`) —
  просроченный `initData` не должен нести годный `telegramId`.
- **Свежесть:** `maxAgeSeconds` с вызывающей стороны обрезается сверху
  потолком 86400 с и заменяется им же при пустом/некорректном значении —
  завысить окно вызовом нельзя. Снизу допускается расхождение часов до
  300 с (`auth_date` «из будущего» в пределах пяти минут не считается
  невалидным).
- **Испорченный `hash` → `valid:false, reason:"bad_hash"`**, `telegramId`/`user` пусты.
- Единственная копия HMAC-цепочки в проекте — расхождения между обработчиками
  больше не может возникнуть по построению.
