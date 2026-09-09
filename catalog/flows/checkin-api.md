# Flow: checkin-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook / catch_webhook`, `authType: none`. Синхронный ответ —
  вызывается по `POST /api/v1/webhooks/CUKqiby1PoHiQiiCQy24V/sync` (суффикс `/sync`).
- **Назначение**: основной путь чекина участника ([FLOWS.md](../../docs/FLOWS.md#checkin-api--основной-путь-чекина-mini-app)) —
  контролёр сканирует QR участника в Mini App-сканере (W7), флоу проверяет
  `initData` контролёра, его членство в `event_staff` этого `event_id`, подпись
  QR, состояние регистрации, и либо отмечает чекин, либо отдаёт один из
  исходов STF-4.
- **Flow ID (MCP)**: `CUKqiby1PoHiQiiCQy24V`

## Контракт

**Вход:** `POST` тело `{ initData: string, eventId: string, payload: string }` —
`payload` это QR участника (`c<eventId>-<userId>-<sig>`), `eventId` — ивент,
на который открыт сканер.

**Ответ:**

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен (STF-2) | `401` | `{ status: "invalid_init_data", reason }` |
| `initData` валиден, но нет строки в `event_staff` на этот `eventId` (STF-2) | `403` | `{ status: "forbidden" }` |
| `payload.eventId ≠ eventId` запроса | `200` | `{ status: "wrong_event", name }` |
| подпись QR не сошлась / `payload` не разобран как `c...` | `200` | `{ status: "invalid", name }` |
| нет строки в `registrations` или каноническая `status = cancelled` | `200` | `{ status: "not_registered", name }` |
| `checked_in_at` уже стоял (IDM-2, **не перезаписывается**) | `200` | `{ status: "already", name, checkedInAt, checkedInAtTashkent }` |
| успех | `200` | `{ status: "ok", name }` |

`name` — `first_name + last_name` участника из `users` (`telegram_id` берётся
из **разобранного QR**, не из `initData`; это участник, которого сканируют,
не контролёр) — пустая строка, если пользователя нет в `users`. Заполняется
во всех исходах, где известен (в т.ч. `wrong_event`/`invalid`, если `payload`
хотя бы частично разобрался).

`telegram_id` контролёра берётся **только** из проверенного `initData`
(STF-2) — тело запроса не может задать чужого контролёра.

## Шаги

> Снято `ap_flow_structure` + `ap_read_step_code` после публикации.

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | вход сканера | — |
| step_1 | CODE «parse + validate input» | форма `eventId` (`[A-Za-z0-9_]{1,12}`, сентинел `-`) | `{{trigger['output'].body}}` |
| step_2 | `callFlow → fn-verify-init-data` | HMAC токена бота + свежесть | `{{step_1['output'].initData}}`, `maxAgeSeconds: 86400` |
| step_3 | CODE «combine auth» | `initDataValid`, `staffTelegramId` (сентинел `-`, если невалиден) | `{{step_2['output'].data}}` |
| step_4 | ROUTER «initData valid?» | `valid` (branch 0) / `Otherwise` (branch 1 → `401`) | `{{step_3['output'].initDataValid}}` |
| step_24/25 (branch 1) | CODE + `return_response` | тело `invalid_init_data`, статус `401` | `{{step_3['output'].reason}}` |
| step_5 (branch 0) | `tables-find-records event_staff` | `(event_id, telegram_id контролёра, revoked_at not_exists)` | `table_id = CyW6KjJ2BdwQEph2KEqTt` |
| step_6 | CODE «decide isStaff» | `isStaff = records.length > 0` | `{{step_5['output']}}` |
| step_7 | ROUTER «isStaff?» | `isStaff` (branch 0) / `Otherwise` (branch 1 → `403`) | `{{step_6['output'].isStaff}}` |
| step_26/27 (branch 1) | CODE + `return_response` | тело `forbidden`, статус `403` | — |
| step_8 (branch 0) | `callFlow → fn-parse-start` | разбор `payload` (`kind` ожидается `c`) | `{{step_1['output'].payload}}` |
| step_9 | `callFlow → fn-verify-qr` | подпись QR | `eventId/userId/sig` из `step_8` |
| step_10 | `callFlow → fn-find-registration` | регистрация участника (`eventId` запроса, `userId` из QR) | `{{step_1['output'].eventId}}`, `{{step_8['output'].data.userId}}` |
| step_11 | CODE «decide checkin outcome» | приоритет: `invalid` (плохой парсинг) → `wrong_event` → `invalid` (подпись) → `not_registered` → `already` → `ok` | `parse/verify/reg` из step_8/9/10, `requestEventId` из step_1 |
| step_12 | `tables-find-records users` | имя участника по `telegram_id` из QR | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_13 | CODE «build participant name» | `first_name + last_name` | `{{step_12['output']}}` |
| step_14 | ROUTER «outcome?» | `ok` (0) / `already` (1) / `Otherwise` (2) | `{{step_11['output'].outcome}}` |
| step_16→step_15 (branch `ok`) | CODE «stamp now» + `tables-update-record` | `checked_in_at = now`, `checked_in_by = staffTelegramId`, **только по `recordId`, который step_11 отдал именно для `outcome = ok`** | `table_id = PNuChoFG0tIBTND86yzDL` |
| step_17/18 | CODE + `return_response` | тело `ok`, статус `200` | — |
| step_19 (branch `already`) | `callFlow → fn-fmt-time` | `checkedInAt` → `Asia/Tashkent`, `format: time` | `{{step_11['output'].checkedInAt}}` |
| step_20/21 | CODE + `return_response` | тело `already` (+ `checkedInAtTashkent`), статус `200` | — |
| step_22/23 (branch `Otherwise`) | CODE + `return_response` | тело `wrong_event`/`invalid`/`not_registered`, статус `200` | `{{step_11['output'].outcome}}` |

## Зависимости

- **Subflow'ы**: `fn-verify-init-data`, `fn-parse-start`, `fn-verify-qr`, `fn-find-registration`, `fn-fmt-time`
- **Таблицы**: `event_staff` (чтение), `registrations` (чтение через `fn-find-registration` + прямая запись `checked_in_at`/`checked_in_by`), `users` (чтение, только имя)
- **Переменные**: — (косвенно `QR_SIGNING_KEY` через `fn-verify-qr` → `fn-sign-qr`)
- **Connections**: — (токен бота читается внутри `fn-verify-init-data`)

## Заметки

- **IDM-2 обеспечивается на уровне решения, а не CAS-примитива.** `outcome = 'already'`
  вычисляется в step_11 **до** записи — `tables-update-record` (step_15) выполняется
  только в ветке `outcome = 'ok'`, которая по построению уже означает
  «`checked_in_at` было пусто на момент чтения» (step_10 `fn-find-registration`).
  Платформа не даёт условного update («обновить, если поле пусто» — нет,
  [Q2](../../docs/OPEN-QUESTIONS.md#q2)), поэтому это read-then-branch, не
  атомарная гарантия: гонка двух одновременных сканов одного QR в теории возможна
  (см. ADR-0003 — атомарных примитивов на платформе нет вообще), но для чекина
  на входе одним контролёром за раз это тот же уровень гарантий, что у всех
  остальных пакетов проекта.
- **Порядок проверок в step_11 — то же самое, что порядок в BACKLOG/FLOWS.md**:
  сперва «`payload` вообще не похож на QR» (`invalid`), потом `wrong_event`
  (сравнение с `eventId` **запроса**, не тем, что в самом QR), потом
  «подпись не сошлась» (`invalid`), потом `not_registered`, потом `already`,
  и только в конце `ok`. Это единственный путь исполнения на все входы — веток,
  которые можно случайно пропустить, нет: обе callFlow-проверки (`fn-parse-start`,
  `fn-verify-qr`) и обе таблицы (`event_staff`, `fn-find-registration`) выполняются
  всегда, решение принимает один CODE-шаг.
- **`event_staff` фильтруется по `(event_id, telegram_id, revoked_at not_exists)`
  всегда вместе** — ровно то требование STF-2, которое чаще всего теряют:
  «пользователь вообще где-то staff» тут физически невозможно получить, потому что
  `event_id` запроса — обязательный член фильтра, а не постфильтр в коде.
- **`telegram_id` контролёра и `telegram_id` участника — из разных источников.**
  Контролёр (`staffTelegramId`) — только из `fn-verify-init-data`; участник (`userId`
  в `fn-find-registration`/`users`) — только из разобранного `payload` (QR), который
  подписан `QR_SIGNING_KEY` и никак не связан с `initData`. Смешать их — баг:
  тело запроса не может подставить участнику чужой `telegram_id`, потому что
  оно вообще не читается для этой роли.
- **401 vs 403 vs 200 — три разных уровня отказа.** `401` — «это не настоящий
  Telegram-пользователь или его `initData` протух» (аутентификация); `403` —
  «настоящий пользователь, но не контролёр этого ивента» (авторизация); всё
  остальное (`wrong_event`/`invalid`/`not_registered`/`already`/`ok`) — это
  бизнес-исход разбора QR при уже подтверждённом контролёре, поэтому он **всегда**
  `200` с кодом в теле (тот же приём, что в `my-qr-api`) — сканеру (W7) не нужно
  разбирать HTTP-статус для этих пяти случаев, только для двух верхних.
- **Имя участника ищется отдельно и всегда**, а не как побочный эффект
  `fn-find-registration` (которая имени не отдаёт). Источник `telegram_id` для
  этого поиска — `step_11.userId`, который есть даже когда регистрации нет
  (`not_registered`) или `eventId` не совпал (`wrong_event`), но пуст (сентинел
  `-`), если `payload` не разобрался вовсе (`fn-parse-start` вернул `valid: false`) —
  тогда `name` пустая строка, что и ожидаемо: показывать код без реального юзера.
- **Проверено сквозным прогоном с настоящей криптографией** на опубликованной
  версии (не только `ap_test_flow` на моках): `initData` контролёра посчитан
  через временный флоу с двумя `crypto : hmac-signature` (та же цепочка, что
  в `fn-verify-init-data`) на реальном токене бота; `payload` QR получен прогоном
  самого `fn-sign-qr` на реальном `QR_SIGNING_KEY`. Все шесть исходов
  подтверждены прогонами на фикстурах (`event_staff`/`registrations`/`users`,
  удалены после проверки):
  - `401 invalid_init_data` (`reason: "expired"`) — прогон `Hmh3thz8kPez8C2Rho16B`;
  - `200 ok` (запись `checked_in_at`, имя в ответе) — прогон `Q3un8aA2ic7fKmLBkdXgb`;
  - `200 already` (повторный скан того же QR, `checkedInAt` **не изменился**,
    `checkedInAtTashkent: "13:46"`) — прогон `HOkVgF0a7aWKVFwnskeXX`;
  - `200 wrong_event` (QR другого ивента) — прогон `GeuSptw1FS5UuxLmroxUl`;
  - `200 not_registered` (валидный QR, регистрации нет) — прогон `fcciunzxxxPXYNpFtU6za`;
  - `200 invalid` (подделанный последний символ подписи) — прогон `q2xkvWcllQfTZfO0BRgrm`;
  - `403 forbidden` (валидный `initData`, но не контролёр этого `event_id`) —
    прогон `tdnOZr9VUKcO4IVocZrJj`. Это и есть обязательный тест приёмки STF-2
    из BACKLOG.md: «зайти в Mini App обычным участником и попробовать отметить
    другого» — отказ подтверждён.
  По замечанию первого круга ревью — предыдущий `403`-прогон не отличал
  правильный фильтр `(event_id, telegram_id, revoked_at)` от гипотетически
  сломанного без `event_id` (контролёр был вообще нигде не staff). Добавлены
  два различающих прогона:
  - контролёр — **реальный staff другого ивента** (`meetup02`, `revoked_at`
    пуст), пробует отметиться на `meetup01` → `403`, `step_5` вернул `[]`
    (прогон `i2JxVaRX8sxDdFZhrpQDl`);
  - контролёр с **отозванными правами** (`event_staff.revoked_at` заполнен)
    на `meetup01` → `403`, `step_5` вернул `[]` (прогон `5W4kOSw6gYudgEhbP8yxq`).
  Оба подтверждают, что фильтр `step_5` — это действительно единый
  `(event_id AND telegram_id AND revoked_at not_exists)`, а не постфильтр
  в коде: обе фикстуры физически существовали в таблице на момент прогона
  и физически не попали в выборку.
  Временный вспомогательный флоу для расчёта `initData` (`tmp-w8-testdata`)
  удалён после проверки; все прогоны выше сняты **после** `ap_lock_and_publish`
  ([README, п.11](README.md)), поэтому доказательны для опубликованной версии.
- **Живой `initData` от настоящего клиента Telegram не проверен** —
  [Q16](../../docs/OPEN-QUESTIONS.md#q16) остаётся открытым для этого пакета:
  нужен человек (открыть Mini App у `@aiqadam_events_dev_bot`, скопировать
  `Telegram.WebApp.initData`) или сквозной прогон W7. Всё остальное в HMAC-цепочке
  (ориентация аргументов, конфигурация шагов) закрыто ещё в W2 read-only
  REST-экспортом.
- **Время исполнения** во всех прогонах выше — 4–22 с в `TESTING`-окружении
  (сумма пяти-шести последовательных `callFlow`), с запасом укладывается в
  `TRIGGER_TIMEOUT_SECONDS = 60`.
