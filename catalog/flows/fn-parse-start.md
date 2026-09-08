# Flow: fn-parse-start

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: разбор `start`-payload deep link'а в `{kind, eventId, userId, utm, token, sig}`.
- **Flow ID (MCP)**: `KmUrHSoKEPDo02J8mKAn6` · **externalId (для `callFlow`)**: `9H027DdckYSgu7Yp1LQRS`

## Контракт

**Вход:** `{ start: string }`

**Выход:**

| Поле | Тип | Смысл |
|------|-----|-------|
| `valid` | bool | payload разобран |
| `kind` | `e` \| `c` \| `s` \| `''` | тип ссылки; `''` при отказе |
| `error` | string | `''` \| `empty` \| `too_long` \| `bad_charset` \| `unknown_kind` \| `bad_event_id` \| `bad_utm` \| `bad_qr_payload` \| `bad_user_id` \| `bad_sig` \| `bad_invite_payload` \| `bad_token` |
| `eventId`, `userId`, `utm`, `token`, `sig` | string | заполняются по `kind`, иначе `''` |
| `start` | string | исходный payload; `''` если отбит до разбора алфавита |

Форматы (SECURITY.md, «Бюджет deep link»): `e<id>[-<utm>]`, `c<eventId>-<userId>-<sig>`,
`s<eventId>-<token>`. `id` — `[A-Za-z0-9_]{1,12}`, `utm` — `[A-Za-z0-9_]{1,32}`,
`userId` — `[0-9]{1,16}`, `token` — `[A-Za-z0-9]{22}`, `sig` — `[A-Za-z0-9_-]{10}`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «parse» | чистый парсинг | `start` ← `{{trigger['output'].data.start}}` |
| step_2 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_1['output']}}` |

## Зависимости

- **Таблицы**: —
- **Переменные**: —
- **Connections**: —

## Заметки

- **`sig` — последние ровно 10 символов, `split('-')` запрещён.** base64url включает `-`,
  поэтому разбор идёт справа: символ на позиции `len-11` обязан быть `-`, всё до него —
  `eventId-userId`. Проверено на реальной подписи `cmeetup01-555000111-x6-XmQ2T8R`,
  где наивный `split('-')` дал бы `sig = "x6"`.
- Ограничения длины (≤64) и алфавита (`A-Za-z0-9_-`) проверяются **до** всякой другой
  логики — так мусор не доезжает до таблиц.
- `utm` не может содержать `-`: дефис зарезервирован как разделитель.
- Проверка подписи здесь **не делается** — это `fn-verify-qr`. Разделение сознательное:
  парсинг чистый и дешёвый, проверка подписи требует секрета.
