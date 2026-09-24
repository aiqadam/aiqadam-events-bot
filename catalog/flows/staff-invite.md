# Flow: staff-invite

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/nFIO7cJiEXlQMCdr6lLjc/sync`; тело — `{initData, eventId}`
  (`authType: none`)
- **Назначение**: выдать овнеру одноразовую ссылку-инвайт контролёра
  `?start=s<eventId>-<token>` на 24 ч (OWN-14). Кнопка живёт в Mini App, на табе
  «Контролёры» `#/manage/:id` — в чат карточка-инвайт не приходит (вердикт
  владельца 2026-09-21)
- **Flow ID (MCP)**: `nFIO7cJiEXlQMCdr6lLjc`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём sync-запроса SPA (`body.initData`, `body.eventId`) |
| step_1 | CODE «normalize request» | `initData` — строка; `eventId` — только slug `^[A-Za-z0-9_]{1,12}$`, иначе сентинел `-` |
| step_2 | `callFlow fn-hmac-init-data` (`inline`) | проверка `initData`, `telegram_id` только оттуда; окно 300 c |
| step_3 | CODE «auth decide» | невалидный `initData` → `authorized:false`, текст, `httpStatus: 401` |
| step_4 | ROUTER «authorized?» | `unauthorized` → 401; иначе — рабочая ветка |
| step_5 | `return_response` (`stop`, `unauthorized`) | `401 {ok:false, error:invalid_init_data, text}` |
| step_6 | `tables-find-records staff` | строка `staff` вызывающего (`telegram_id`, limit 1) |
| step_7 | `tables-find-records events` | событие по `id` (сентинел `-` даёт пустую выборку) |
| step_8 | CODE «decide invite» | права `staff`+чаптер события, fail-closed (ADR-0024); нет события/чужой чаптер/не-slug → `403 forbidden` |
| step_9 | ROUTER «invite outcome» | `error` → ответ ошибки; иначе — выдача ссылки |
| step_10 | `return_response` (`stop`, `error`) | `403`/`400` с текстом отказа |
| step_11 | `@aiqadam/qadam-crypto : generate-password` | токен — 22 символа, `alphanumeric` (≈131 бит) |
| step_12 | `@aiqadam/qadam-crypto : hash-text` | `sha256(token)` — в БД уходит только хэш |
| step_13 | CODE «timestamps + invite link» | `created_at`, `expires_at = +24ч` (UTC ISO), ссылка `https://t.me/<BOT_USERNAME>?start=s<id>-<token>`, текст `staff.invite.created` |
| step_14 | `tables-create-records staff_invites` | `token_hash`, `event_id`, `created_by`, `created_at`, `expires_at` |
| step_15 | `return_response` (`stop`) | `200 {ok:true, inviteLink, text, eventId}` |

## Зависимости

- **Таблицы**: `staff` (`PnDy6gw9tlLUqTGk2EOUn`, чтение), `events`
  (`R4aSQpLZvw7d3u6DVOSjH`, чтение), `staff_invites` (`JIjKkDu3Im2ylBmkkH5Fu`,
  запись)
- **Флоу**: вызывает `fn-hmac-init-data` (`inline`, один уровень, ADR-0015 п. 5)
- **Переменные**: `BOT_TOKEN` (проверка `initData`), `BOT_USERNAME` (ссылка)
- **Connections**: —
- **Потребитель**: `Manage.tsx`, секция «Контролёры» — `STAFF_INVITE_API`

## Заметки

- **Ссылка создаётся на экране, а не в чате.** Прежний прототип рисовал
  чат-карточку `staff-invite` без входной кнопки (сирота); овнер всё делает
  в Mini App, поэтому создание живёт в табе «Контролёры» (вердикт владельца
  2026-09-21, прототип приведён к этому же).
- **Токен никогда не хранится и не возвращается из БД**: в `staff_invites`
  только `sha256`; ссылку с сырым токеном отдаёт один раз ответ `step_15`,
  второй раз её взять неоткуда.
- **Права — те же, что у правки события** (`staff`+чаптер, ADR-0024),
  проверяются по полям записи, а не по факту «есть строка staff» (defense in
  depth, Q25). «Не staff» / «чужой чаптер» / «нет события» / сентинел `-` —
  один `403`, ничего не перечисляем.
- **TTL 24 ч и срок считает `step_13`**, не таблица: диапазонные фильтры по
  `DATE` не подтверждены ([Q15](../../docs/OPEN-QUESTIONS.md#q15)); проверка
  срока — на приёме (`staff-accept/step_4`).
- **Позитив живым `initData` не прогнан** (нужен овнер): негатив `401` на
  мусоре доказан `curl`'ом на опубликованный `/sync`; ветка решения проверена
  кодом и приёмом. Хвост — живой прогон кнопки из Mini App после деплоя Pages.
