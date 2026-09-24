# Flow: checkin-counter-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/lm9S9cRuSZOpVAgl2h44R/sync`; тело запроса —
  `{ initData, eventId }` (`authType: none`)
- **Назначение**: счётчики «Отмечено X из Y» для экрана контроля `#/scan`
  (W62) — читает прогресс события один раз при открытии экрана, только для
  staff **этого** события (STF-2). Горячий путь `checkin-api` не тронут.
- **Flow ID (MCP)**: `lm9S9cRuSZOpVAgl2h44R` · **externalId**: `T2sUoCibzEpXFURHzUQss`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём sync-запроса SPA |
| step_1 | `callFlow fn-hmac-init-data` (`inline`) | проверка `initData`, `telegram_id` только оттуда (STF-2); окно 43200 c — как у `checkin-api`: сканер стоит в дверях часами |
| step_9 | CODE «normalize eventId» | `eventIdOrNone = eventId \|\| '__none__'` — непустое значение для фильтров `step_3`/`step_4` (пустой `eq` валит шаг); тело вебхука не валидируется |
| step_2 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'`; невалидный `initData` отвечает `401`, не доходя до чтений |
| step_7 (Otherwise) | CODE «invalid init data response» | `checkin.unauthorized`, `httpStatus: 401` |
| step_8 (Otherwise) | `return_response` | `401 {ok:false, status, text}` |
| step_3 (valid) | `tables-find-records event_staff` | `(event_id eq eventIdOrNone, telegram_id контролёра)` + `revoked_at not_exists` — гейт по конкретному событию |
| step_4 (valid) | `tables-find-records registrations` | строки события (`event_id eq eventIdOrNone`), проекция `status` + `checked_in_at`, `limit: 500` — только для подсчёта, без ПД |
| step_5 (valid) | CODE «count checkins» | нет staff-строки → `403`; иначе `registered` = строки `status=registered`, `checked_in` = из них с непустым `checked_in_at` |
| step_6 (valid) | `return_response` | `200 {ok:true, registered, checked_in, status:'ok'}` |

## Зависимости

- **Таблицы**: `event_staff` (чтение), `registrations` (чтение)
- **Флоу**: вызывает `fn-hmac-init-data` (`inline`, один уровень, ADR-0015 п. 5)
- **Переменные**: `BOT_TOKEN` (проверка `initData`)
- **Connections**: —

## Заметки

- **Почему отдельный флоу, а не поле в `checkin-api`**: счётчики нужны один
  раз при открытии экрана, а не на каждый скан (прототип растит `checked_in`
  локально). `checkin-api` — горячий путь чекина; чтение регистраций на
  каждый скан туда не добавляется.
- **`limit: 500`** — верхняя граница выборки таблиц. Событие с большим числом
  регистраций даст счётчик ниже факта; для индикатора прогресса это принято,
  не для отчётности (отчётность — `manage-api`/`participants`).
- **Потребитель**: `Scan.tsx` — читает счётчики при открытии, инкрементит
  `checked_in` локально на исходе `ok`; при отказе/ошибке счётчик просто не
  показывается, скан не блокируется.
- **Отказ закрытый**: пустой `valid`, не только `false` — тоже `401`.
- **Фильтры `event_id` — через `eventIdOrNone` (W102).** `tables-find-records`
  fail-closed отклоняет пустой `eq`; `body.eventId` не валидируется, поэтому
  пустой `eventId` давал `500` на `step_3`/`step_4`. Sentinel `__none__`
  возвращает штатный `403 forbidden` из `step_5`; платформенная гоча — `AGENTS.md`.
- Позитив живым `initData` — хвост на приёмку W15 (нужен человек с Telegram);
  негатив (`401` на мусоре) доказан `curl`'ом.
