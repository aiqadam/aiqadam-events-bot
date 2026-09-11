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

**Ответ:** каждый исход несёт `text` — **уже локализованный** текст для экрана
(язык контролёра из `users.lang`, для `401` — `ru`, т.к. пользователь не определён).
Сканер (W7) показывает `text` как есть и не держит собственного словаря исходов (Q19):

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен (STF-2) | `401` | `{ status: "invalid_init_data", reason, text }` |
| `initData` валиден, но нет строки в `event_staff` на этот `eventId` (STF-2) | `403` | `{ status: "forbidden", text }` |
| `payload.eventId ≠ eventId` запроса | `200` | `{ status: "wrong_event", name, text }` |
| подпись QR не сошлась / `payload` не разобран как `c...` | `200` | `{ status: "invalid", name, text }` |
| нет строки в `registrations` или каноническая `status = cancelled` | `200` | `{ status: "not_registered", name, text }` |
| `checked_in_at` уже стоял (IDM-2, **не перезаписывается**) | `200` | `{ status: "already", name, checkedInAt, checkedInAtTashkent, text }` |
| успех | `200` | `{ status: "ok", name, text }` |

`text` собирается через `fn-t` из таблицы `strings` по ключам
`checkin.ok`/`checkin.already`/`checkin.wrong_event`/`checkin.invalid`/
`checkin.not_registered`/`checkin.forbidden`/`checkin.unauthorized`
(I18N-2, ключ `checkin.name_unknown` — подпись имени, если `first/last` пусты).
`checkin.ok` подставляет `{name}`, `checkin.already` — `{time}` (из `checkedInAtTashkent`).

`name` — `first_name + last_name` участника из `users` (`telegram_id` берётся
из **разобранного QR**, не из `initData`; это участник, которого сканируют,
не контролёр) — пустая строка, если пользователя нет в `users`. Заполняется
во всех исходах, где известен (в т.ч. `wrong_event`/`invalid`, если `payload`
хотя бы частично разобрался).

`telegram_id` контролёра берётся **только** из проверенного `initData`
(STF-2) — тело запроса не может задать чужого контролёра.

## Шаги

> Снято `ap_flow_structure` + `ap_read_step_code` после публикации (W7).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | вход сканера | — |
| step_1 | CODE «parse + validate input» | форма `eventId` (`[A-Za-z0-9_]{1,12}`, сентинел `-`) | `{{trigger['output'].body}}` |
| step_2 | `callFlow → fn-verify-init-data` | HMAC токена бота + свежесть | `{{step_1['output'].initData}}`, `maxAgeSeconds: 86400` |
| step_3 | CODE «combine auth» | `initDataValid`, `staffTelegramId` (сентинел `-`, если невалиден), `reason` | `{{step_2['output'].data}}` |
| step_4 | ROUTER «initData valid?» | `valid` (branch 0) / `Otherwise` (branch 1 → `401`) | `{{step_3['output'].initDataValid}}` |
| step_30 (branch 1) | `callFlow → fn-t` | `checkin.unauthorized`, `lang: ru` (пользователь не определён) | `{{step_4...}}` |
| step_24/25 (branch 1) | CODE + `return_response` | тело `invalid_init_data` (+`text`), статус `401` | `{{step_30['output'].data.text}}` |
| step_5 (branch 0) | `tables-find-records event_staff` | `(event_id, telegram_id контролёра, revoked_at not_exists)` | `table_id = CyW6KjJ2BdwQEph2KEqTt` |
| step_28 | `tables-find-records users` | строка контролёра → язык | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_6 | CODE «decide isStaff» | `isStaff = records.length > 0`, `staffLang` (фолбэк `ru`) | `{{step_5['output']}}`, `{{step_28['output']}}` |
| step_7 | ROUTER «isStaff?» | `isStaff` (branch 0) / `Otherwise` (branch 1 → `403`) | `{{step_6['output'].isStaff}}` |
| step_29 (branch 1) | `callFlow → fn-t` | `checkin.forbidden`, `lang: staffLang` | `{{step_6['output'].staffLang}}` |
| step_26/27 (branch 1) | CODE + `return_response` | тело `forbidden` (+`text`), статус `403` | `{{step_29['output'].data.text}}` |
| step_8 (branch 0) | `callFlow → fn-parse-start` | разбор `payload` (`kind` ожидается `c`) | `{{step_1['output'].payload}}` |
| step_9 | `callFlow → fn-verify-qr` | подпись QR | `eventId/userId/sig` из `step_8` |
| step_10 | `callFlow → fn-find-registration` | регистрация участника (`eventId` запроса, `userId` из QR) | `{{step_1['output'].eventId}}`, `{{step_8['output'].data.userId}}` |
| step_11 | CODE «decide checkin outcome» | приоритет: `invalid` → `wrong_event` → `invalid` → `not_registered` → `already` → `ok` | `parse/verify/reg` из step_8/9/10, `requestEventId` из step_1 |
| step_12 | `tables-find-records users` | имя участника по `telegram_id` из QR | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_13 | CODE «build participant name» | `first_name + last_name` | `{{step_12['output']}}` |
| step_14 | ROUTER «outcome?» | `ok` (0) / `already` (1) / `Otherwise` (2) | `{{step_11['output'].outcome}}` |
| step_31 (branch `ok`) | `callFlow → fn-t` | `keys: [checkin.ok, checkin.name_unknown]`, `lang: staffLang` | `{{step_6['output'].staffLang}}` |
| step_16→step_15 (branch `ok`) | CODE «stamp now» + `tables-update-record` | `checked_in_at = now`, `checked_in_by = staffTelegramId`, **только по `recordId`, который step_11 отдал именно для `outcome = ok`** | `table_id = PNuChoFG0tIBTND86yzDL` |
| step_17/18 (branch `ok`) | CODE + `return_response` | тело `ok` (+`text` с `{name}`), статус `200` | `{{step_31['output'].data}}`, `{{step_13['output'].name}}` |
| step_19 (branch `already`) | `callFlow → fn-fmt-time` | `checkedInAt` → `Asia/Tashkent`, `format: time` | `{{step_11['output'].checkedInAt}}` |
| step_32 (branch `already`) | `callFlow → fn-t` | `keys: [checkin.already]`, `lang: staffLang` | `{{step_6['output'].staffLang}}` |
| step_20/21 (branch `already`) | CODE + `return_response` | тело `already` (+`text` с `{time}` = `checkedInAtTashkent`), статус `200` | `{{step_32['output'].data}}`, `{{step_19['output'].data}}` |
| step_33 (branch `Otherwise`) | `callFlow → fn-t` | `keys: [checkin.wrong_event, checkin.invalid, checkin.not_registered]`, `lang: staffLang` | `{{step_6['output'].staffLang}}` |
| step_22/23 (branch `Otherwise`) | CODE + `return_response` | тело `wrong_event`/`invalid`/`not_registered` (+`text` по `outcome`), статус `200` | `{{step_33['output'].data}}`, `{{step_11['output'].outcome}}` |

## Зависимости

- **Subflow'ы**: `fn-verify-init-data`, `fn-parse-start`, `fn-verify-qr`, `fn-find-registration`, `fn-fmt-time`, `fn-t`
- **Таблицы**: `event_staff` (чтение), `users` (чтение: язык контролёра + имя участника), `registrations` (чтение через `fn-find-registration` + прямая запись `checked_in_at`/`checked_in_by`)
- **Переменные**: — (косвенно `QR_SIGNING_KEY` внутри `fn-verify-qr` — с 2026-09-09,
  W16, напрямую, не через `fn-sign-qr`; `BOT_TOKEN` внутри `fn-verify-init-data`)
- **Connections**: — (токен бота читается внутри `fn-verify-init-data` из Variable)

## Заметки

- **Локализация текста исхода — на сервере (Q19, W7).** Язык — `users.lang`
  контролёра: `step_28`/`step_6` резолвят его по `staffTelegramId` до маршрутизации
  исходов. Каждая терминальная ветка `step_14`/`step_7`/`step_4` тянет нужный ключ
  через `fn-t`; `step_17`/`step_20`/`step_22` вставляют `{name}`/`{time}` в шаблон.
  `401` не может знать язык (пользователь не проверен) — фиксированный `ru`.
  Страница сканера словарь исходов **не держит** — показывает серверный `text`.
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
- **Проверено сквозным прогоном с настоящей криптографией в W8** на опубликованной
  версии до правки W7 (шесть исходов STF-4 + `401`/`403`, различающие прогоны
  STF-2 по `event_id` и `revoked_at`) — детали ниже в старых записях W8.
- **W7 (2026-09-09) — повторный сквозной прогон локализованного `text`.**
  `initData` посчитан временным флоу с двумя `crypto : hmac-signature` на реальном
  `variables['BOT_TOKEN']` (приём W8), подписи QR — `callFlow → fn-sign-qr` на
  реальном `QR_SIGNING_KEY`; фикстуры (`users`, `event_staff`, `registrations`)
  созданы и удалены после проверки; временный флоу `tmp-w7-testdata` удалён.
  Прогоны на **опубликованной** версии, напрямую `curl` (Origin =
  `https://miniapp.events.aiqadam.org`, `access-control-allow-origin: *` на ответе,
  `OPTIONS` → `204` с нужными заголовками):
  - контролёр `ru` (lang из `users`), 1-й скан участника `meetup01` →
    `200 {"status":"ok","name":"Aziz Test","text":"Aziz Test — отмечен"}` (записан
    `checked_in_at`);
  - повторный скан того же QR → `200 {"status":"already", "checkedInAtTashkent":"18:01",
    "text":"Уже отмечен в 18:01"}` — `checked_in_at` не изменился (IDM-2);
  - QR другого ивента → `200 {"status":"wrong_event","text":"Другой ивент"}`;
  - QR несуществующего участника → `200 {"status":"not_registered","text":"Нет регистрации"}`;
  - подделанный последний символ подписи → `200 {"status":"invalid","text":"Код не распознан"}`;
  - тот же «уже отмечен», но контролёр `en` (другая staff-строка, `users.lang=en`) →
    `200 {"status":"already","text":"Already checked in at 18:01"}` — язык исхода
    действительно контролёра, время исходное;
  - участник вместо контролёра → `403 {"status":"forbidden","text":"Нет прав на чекин этого ивента"}`;
  - мусорный `initData` → `401 {"status":"invalid_init_data","reason":"malformed",
    "text":"Данные Mini App устарели — переоткройте приложение"}`.
- **Живой `initData` от настоящего клиента Telegram** закрыт в [Q16](../../docs/OPEN-QUESTIONS.md#q16)
  (реальный баг с `{{connections[...]}}`, токен переведён в `variables['BOT_TOKEN']`).
- **Время исполнения** в прогонах — 4–9 с в `TESTING`-окружении (сумма
  последовательных `callFlow`), с запасом укладывается в
  `TRIGGER_TIMEOUT_SECONDS = 60`. Публичный прогон через `/sync` в e2e W7 —
  те же единицы секунд.
- **W17 (2026-09-11) — все десять `callFlow`-шагов переведены на
  `executionMode: "inline"`** ([qadam-flow#363](https://github.com/aiqadam/qadam-flow/issues/363),
  раскатано на инстансе): `step_2` (`fn-verify-init-data`), `step_8`
  (`fn-parse-start`), `step_9` (`fn-verify-qr`), `step_10` (`fn-find-registration`),
  `step_19` (`fn-fmt-time`), `step_29`/`step_30`/`step_31`/`step_32`/`step_33`
  (все ветки `fn-t`) — вся цепочка из пяти последовательных хопов, которую
  T-0161 (увеличение воркеров) не ускорил (см. [Q22](../../docs/OPEN-QUESTIONS.md#q22)).
  Опубликовано, `ap_validate_flow` чист. **After-прогон на реальном скане**
  (прогон `Dv6ccs06vqwdHeXBH6bVE`, контролёр `binali_beelab` через Mini
  App-сканер, участник `return_void_0`): 10,0 с полная длительность, ≈9,95 с
  сумма шагов, пауза ≈0,05 с — против 22,8 с после W16 (пауза ≈17,9 с) и
  23,3 с исходного эталона. Числа записаны в Q22/ADR-0009.
  Подробности — [W17](../../docs/work/W17-inline-callflow.md).
- **W16 (2026-09-09) — HMAC внутри `fn-verify-init-data`/`fn-sign-qr` слиты в
  CODE-шаги через `node:crypto`, `fn-verify-qr` перестал вызывать `fn-sign-qr`
  как subflow** ([ADR-0010](../../docs/adr/0010-unsandboxed-code-step-for-crypto.md)) —
  сам `checkin-api` не менялся, но три различающих прогона STF-2 повторены на
  новой версии: не-стафф (403), стафф чужого ивента `tmp-w16-otherevt` (403),
  отозванный стафф `demo` (403), плюс позитивный контроль настоящего стаффа
  `demo` (`isStaff: true`, прошёл дальше 403) — регресса нет. Фикстуры временные,
  удалены сразу после проверки. Латентность одного скана (тёплый прогон,
  тот же метод, что в [Q22](../../docs/OPEN-QUESTIONS.md#q22)): сумма шагов
  ≈4,9 с, полная длительность 22,8 с, «пауза» ≈17,9 с (прогон
  `cCXetqX6VPVmPpe3s1p5G`) — против ≈19,9 с в эталоне до W16
  (`EFIxi7F09xHzQEmQRKsl0`); эффект в ожидаемую сторону, но на одном прогоне
  не заявляется как точная экономия. Подробности —
  [W16](../../docs/work/W16-hmac-inline-code-step.md).
