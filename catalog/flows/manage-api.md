# Flow: manage-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/CcGPwuW4ws5hkcaOPerEG/sync`
- **Назначение**: сервер формы ивента роут `#/manage` SPA (`miniapp/src/routes/Manage.tsx`)
  ([ADR-0017](../../docs/adr/0017-screen-not-message.md) п. 3): список ивентов
  чаптера (W37 — вход в правку без команд, [ADR-0025](../../docs/adr/0025-start-only-commands-ban.md)),
  выдача staff'у ивент для правки, приём создания/правки (OWN-1…OWN-5, OWN-15),
  ссылка регистрации, список контролёров ивента (W36 — ручной путь вместо
  инвайт-ссылок W10; W44 — выбор из списка с поиском по имени/`@username`),
  недавние места для визарда (W42 — `address`/`lat`/`lon`
  в `list` только у своих ивентов) и разбор орг-ссылки Яндекс.Карт через
  Геокодер (W42, [Q55](../../docs/OPEN-QUESTIONS.md#q55) — `resolve_geo`).
  Права решаются здесь, страница их не решает.
- **Flow ID (MCP)**: `CcGPwuW4ws5hkcaOPerEG`

## Вход

`POST` тела: `{ initData, action, eventId, fields }`.

| Поле | Что |
|---|---|
| `initData` | `Telegram.WebApp.initData` страницы |
| `action` | `load` — отдать ивент для правки; `save` — создать (`eventId` пустой) или обновить; `list` — ивенты чаптера для `#/manage` без `:id` (W37); `staff_list` / `staff_add` / `staff_remove` — список контролёров ивента, выдача и отзыв прав; `staff_search` — поиск кандидатов в контролёры по имени/`@username` (W44); `resolve_geo` — координаты и адрес орг-ссылки Яндекс.Карт через Геокодер (W42, Q55) |
| `staffTelegramId` | только при `staff_add`/`staff_remove`: `telegram_id` контролёра; формат (цифры 8–16) проверяет `step_20` |
| `query` | только при `staff_search`: строка поиска (W44); минимум длины и сравнение — в CODE-шаге поиска, здесь только обрезка до 100 |
| `link` | только при `resolve_geo`: ссылка Яндекс.Карт; из неё берётся **только числовой `oid`** (хост — `yandex.*`, путь `/maps/org/…`), в Геокодер уходит `uri=ymapsbm1://org?oid=…`; короткие `maps/-/…` не поддержаны — в них нет `oid` |
| `eventId` | slug `^[A-Za-z0-9_]{1,12}$`; пустой = создание; всё иное → сентинел `-` (пустая выборка и отказ) |
| `newId` | только при создании: slug того же вида, который страница генерирует один раз на открытие формы — ключ идемпотентности (ADR-0003); ивент получает этот `id` |
| `fields` | только при `save`: `title`, `description`, `address`, `lat`, `lon`, `starts_at`, `ends_at`, `reg_deadline_at`, `capacity`, `overbook_pct`, `status` — строки как в форме; даты `YYYY-MM-DDTHH:mm` **ташкентские** |

## Шаги

ROUTER сразу после проверки `initData` (`step_2`) — тот же гейт, что в
`checkin-api`/`my-qr-api`: невалидный `initData` отвечает `401` без обращения
к таблицам. Второй ROUTER (`step_8`) разводит исходы одного CODE-шага решения:
ветки не сходятся, поэтому ответ страницы стоит в каждой ветке отдельно.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём POST |
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData` по `BOT_TOKEN`, `telegramId` вызывающего; окно **300 c** ([Q49](../../docs/OPEN-QUESTIONS.md#q49)) |
| step_2 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'` |
| step_3 (Otherwise) | CODE «invalid init data response» | `checkin.unauthorized`, `httpStatus: 401` |
| step_4 (Otherwise) | `return_response` (`stop`) | ответ `401` |
| step_5 (valid) | CODE «normalize request» | `eventId` → slug или `-` (при создании — `newId`); `isNew`; `action`; `fields` |
| step_18 (valid) | `tables-find-records staff` | строка `staff` вызывающего по `telegram_id` (`limit: 1`) |
| step_19 (staff) | `tables-find-records event_staff` | строки ивента (`event_id`, проекция, `limit: 200`) — список и поиск активной строки |
| step_20 (staff) | CODE «staff: decide» | права повторно по полям, валидация `telegram_id`, идемпотентность add/remove, тексты и строки списка; `outcome` = `list` / `add` / `remove` / `error` |
| step_21 (staff) | ROUTER: `add` / `remove` / `Otherwise` | по `{{step_20['output'].outcome}}` |
| step_22 (add) | `tables-create-records event_staff` | `event_id`, `telegram_id`, `granted_by`, `granted_at` |
| step_23 (add) | `return_response` (**`respond`**) | `200` странице **до** уведомления |
| step_24 (add) | `tables-find-records users` | есть ли добавленный в `users` (`telegram_id`, `limit: 1`) |
| step_25 (add) | CODE «staff: notify targets» | цели уведомления (`[]` или один id), текст и `web_app`-кнопка сканера |
| step_26 (add) | `LOOP_ON_ITEMS` по `{{step_25['output'].targets}}` | пустой список — ни одной отправки |
| step_27 (add, в цикле) | `send_text_message` (`continueOnFailure`) | уведомление новому контролёру; ошибка Bot API (403) не отменяет добавление |
| step_28 (remove) | `tables-update-record event_staff` | `revoked_at = now (UTC)` |
| step_29 (remove) | `return_response` (`stop`) | `200` с обновлённым списком |
| step_30 (Otherwise) | `return_response` (`stop`) | `200` список / `422` валидация / `400` |
| step_38 (search) | `tables-find-records registrations` | участники ивента (`event_id`, проекция `event_id`+`telegram_id`, `limit: 200`) — половина пула кандидатов |
| step_39 (search) | `tables-find-records staff` | весь `staff` без фильтра (таблица организаторов — единицы строк; глобальные `chapter_id=''` фильтром `eq` не ловятся), проекция `telegram_id`+`chapter_id` — вторая половина пула |
| step_40 (search) | `tables-find-records users` | все `users` без фильтра (`limit: 200`, проекция `telegram_id`+имя+`username`) — join имён; при росте упрётся в Q31, как и широкое чтение на `/start` |
| step_41 (search) | `tables-find-records event_staff` | контролёры ивента (`event_id`, проекция +`revoked_at`, `limit: 200`) — исключение действующих |
| step_42 (search) | CODE «staff: search candidates» | права повторно по полям (Q25), запрос <2 символов → пустой список, пул = участники + staff чаптера (+глобальные), минус активные; совпадение по имени/`@username` регистронезависимо, топ-20; `outcome` = `done` / `error` |
| step_43 (search) | `return_response` (`stop`) | `200 {ok:true, candidates:[{telegram_id,name,username}], count}` / `403` |
| step_6 (valid) | `tables-find-records events` | ивент по `id`, `limit: 1` |
| step_7 (valid) | CODE «decide: staff, validate, diff» | права по `staff`+чаптеру, `list` — сразу `outcome='events_list'` с чаптером; валидация, конвертация дат, `id` нового ивента, значения записи, diff `notify-on-change`, тексты, `inviteLink`; исход `outcome` = `list`→`events_list` / `load` / `save` / `staff` / `error` |
| step_8 (valid) | ROUTER: `save` / `load` / `staff` / `events_list` / `geo_link` / `search` / `Otherwise` (=error) | по `{{step_7['output'].outcome}}` |
| step_9 (Otherwise) | `return_response` (`stop`) | `403` forbidden / `422` validation / `400` |
| step_10 (load) | `return_response` (`stop`) | `200`, `event` — поля ивента для формы (+ `hasPhoto`, `inviteLink` для published) |
| step_11 (save) | `tables-upsert-records events` | запись по ключу `id` (пишет `staff_id` и `chapter_id`) |
| step_12 (save) | `return_response` (**`respond` — «Respond and Continue»**) | `200` странице **до** отправки сообщений (+ `inviteLink`) |
| step_13 (save) | `tables-find-records registrations` | `event_id = id`, проекция `telegram_id`, `status` |
| step_14 (save) | CODE «notify targets + owner text» | дедуп `telegram_id` со `status='registered'`; `[]` если `notifyKind='none'`; текст организатору с `{count}` |
| step_15 (save) | `send_text_message` (`continueOnFailure`) | подтверждение staff'у в чат (`format: None`) — короткий факт; ссылка регистрации живёт на экране (W37, ADR-0017), не здесь |
| step_16 (save) | `LOOP_ON_ITEMS` по `{{step_14['output'].targets}}` | |
| step_17 (в цикле) | `send_text_message` (`continueOnFailure`) | уведомление одному зарегистрированному (`format: None`) |
| step_31 (events_list) | `tables-find-records events` | ивенты чаптера: фильтр `chapter_id eq {{step_7['output'].chapterId}}`, `limit: 200` |
| step_32 (events_list) | CODE «shape events list» | форма списка (`id`, `title`, `starts_at`, `status`, `isAuthor`) и порядок: будущие по возрастанию, затем прошедшие по убыванию; у своих ивентов (`isAuthor`) с непустым адресом добавляются `address`/`lat`/`lon` — недавние места визарда (W42) |
| step_33 (events_list) | `return_response` (`stop`) | `200 {ok:true, events:[…], count}` |
| step_34 (geo_link) | CODE «geo link: parse» | вырезает `oid` из орг-ссылки (`/maps/org/<slug?>/<oid>`); всё прочее даёт пустой `uri` — Геокодер ответит `400`, отказ вернёт `step_36` |
| step_35 (geo_link) | `@aiqadam/qadam-http : send_request` | `GET https://geocode-maps.yandex.ru/1.x/` (`apikey` — `{{variables['YANDEX_GEOCODER_API_KEY']}}`, `uri`, `format=json`, `lang=ru_RU`, `results=1`), `failureMode: continue_all`, `timeout: 10`. **Именно `1.x`:** тот же ключ на `/v1/` отвечает `403 Invalid api key` — различающий прогон в журнале W42 |
| step_36 (geo_link) | CODE «geo link: parse response» | разбирает обе формы вывода `http` (2xx — плоская, 4xx/5xx — `response`); `Point.pos` = «долгота широта» → `lat`/`lon` (6 знаков), адрес — `Address.formatted` (подряд идущие одинаковые компоненты схлопываются, ≤300); отказ — `422 {fields:{geo:'manage.geo.org_fail'}}` |
| step_37 (geo_link) | `return_response` (`stop`) | `200 {ok:true, lat, lon, address}` или `422` с ключом ошибки |

### Контракт ответа (согласован с `#/manage` SPA)

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен (>300 c) | 401 | `{ok:false, error:"invalid_init_data", text}` |
| нет строки `staff`; ивент не найден; `event.chapter_id` не подходит под `staff.chapter_id`; сентинел `-`; создание с `newId`, занятым записью чужого чаптера | 403 | `{ok:false, error:"forbidden", text}` — одинаково, ничего не перечисляем |
| поля не прошли валидацию | 422 | `{ok:false, error:"validation", text, fields:{<поле>: <ключ i18n>}}` — ключ поля `geo` относится к паре `lat`/`lon` |
| `load` staff'ом своего чаптера | 200 | `{ok:true, event:{id,title,description,address,lat,lon,starts_at,ends_at,reg_deadline_at,status,capacity,overbook_pct,hasPhoto}, eventId, inviteLink}` — `inviteLink` непустой только у `published` |
| `list` staff'ом | 200 | `{ok:true, events:[{id,title,starts_at,status,isAuthor,address?,lat?,lon?}], count}` — ивенты своего чаптера; `address`/`lat`/`lon` только у своих (`isAuthor`) и только при непустом адресе (недавние места, W42); не staff — `403`, как у `load` |
| `save` | 200 | `{ok:true, text, eventId, inviteLink}` — `eventId` созданного ивента нужен странице, чтобы второй «Сохранить» стал правкой, а не дублем; `inviteLink` — только у `published` |
| `staff_list` (staff чаптера) | 200 | `{ok:true, title, staff:[{telegram_id, item}]}` — только активные строки ивента, `item` отформатирован сервером |
| `staff_add` / `staff_remove` | 200 | `{ok:true, text, staff:[...]}` — обновлённый список; повтор add/remove идемпотентен (тексты «уже контролёр» / «прав нет»), `403` — как у `load` |
| `staff_search` успех (W44) | 200 | `{ok:true, title, candidates:[{telegram_id,name,username}], count}` — до 20 совпадений; запрос короче 2 символов — пустой список, а не вся база |
| `staff_search` отказ | 403 | `{ok:false, error:"forbidden", text}` — не-staff, чужой чаптер, нет ивента: один ответ, как у `load` |
| `resolve_geo` успех | 200 | `{ok:true, lat, lon, address}` — координаты (6 знаков) и адрес из Геокодера; `address` может быть пустым |
| `resolve_geo` отказ (нет `oid` в ссылке, организация не найдена, Геокодер недоступен или ключ отвергнут) | 422 | `{ok:false, error:"validation", text, fields:{geo:"manage.geo.org_fail"}}` — страница переводит ключ и оставляет шит открытым; фолбэк — координаты текстом |
| нечисловой `staffTelegramId` | 422 | `{ok:false, error:"validation", text, fields:{telegram_id:"manage.err.bad_telegram_id"}, staff:[...]}` — страница переводит ключ |

Тело ответа собирается из вывода шага-решения своей ветки, поэтому `return_response`
не переживёт отсутствующего поля: `step_10`/`step_12` ссылаются на вывод
`step_7` (`ok`, `error`, `text`, `fields`, `event`, `eventId`, `inviteLink`),
`step_9` — на него же, `step_30` — на `step_20` (`+ staff`), `step_33` — на
`step_32` (`+ events`, `count`); `step_7` объявляет весь набор ключей заранее,
чтобы ветка без ошибки его не теряла.

### Правила `step_7`

- **Права — `staff` + чаптер, fail-closed** ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)).
  Нет строки `staff` для `telegramId` — отказ и на создание, и на правку.
  Доступ есть, если `staff.chapter_id === ''` (все чаптеры) **или**
  `staff.chapter_id === event.chapter_id`. Запись выбирается в коде по
  `id`/`telegram_id`, а не как первая строка выборки — отбор повторяется в коде
  и не зависит от фильтра `step_6`/`step_18`; сентинел `-` отвергается до
  сравнения. Проверяется до любой валидации; «не staff», «чужой чаптер» и
  «нет ивента» — один и тот же `403`.
- **`events.staff_id` — авторство, не гейт:** пишется при создании
  (= `telegramId`), при правке не меняется. Право «править» — глобальный
  глагол `staff`, а не per-event роль.
- **`events.chapter_id`** при создании = `staff.chapter_id || '1'`; у
  существующего ивента не меняется. Выбора чаптера в форме нет (чаптер один).
- **Список ивентов чаптера (W37, `action='list'`)** — вход в правку для
  `#/manage` без `:id` (команд у бота нет, ADR-0025). Права те же, что у
  правки: нет строки `staff` — `403`. Читается отдельной веткой
  (`step_31`…`step_33`) по `chapter_id eq chapterId`, где
  `chapterId = staff.chapter_id || '1'` — та же нормализация, что при создании
  (отдельных чаптеров в проекте пока нет). Форма и порядок — в `step_32`:
  будущие по возрастанию, затем прошедшие по убыванию; `isAuthor` по
  `staff_id` (метка «Вы создали»); записи без `id` не показываются.
  **W42:** у своих ивентов с непустым адресом в ответ добавляются
  `address`/`lat`/`lon` — визард берёт их для «Недавних мест» (чужой адрес
  в ответ не попадает); отдельного хранилища недавних мест нет.
- **Орг-ссылка (`resolve_geo`, W42/[Q55](../../docs/OPEN-QUESTIONS.md#q55))** —
  отдельная ветка (`step_34`…`step_37`), ранний возврат в `step_7` до
  *использования* ивента (сам `step_6` в графе выполняется всегда: сентинел
  `-` даёт пустую выборку, это цена линейного графа): ивент не нужен, прав
  достаточно строки `staff` (проверена выше).
  Из ссылки берётся **только `oid`** (цифры), URL Геокодера фиксирован в
  `step_35` — произвольный URL через флоу не ходит. Ответ — `lat`/`lon`/`address`;
  отказ Геокодера — `422` с ключом `manage.geo.org_fail`, страница оставляет шит
  открытым (фолбэк — координаты текстом, визард их принимает). Свободный ключ
  Геокодера и принятая цена — [Q55](../../docs/OPEN-QUESTIONS.md#q55).
- **Ссылка регистрации (`inviteLink`)** строится сервером из `BOT_USERNAME`
  (`https://t.me/<bot>?start=e<id>`) и возвращается только для `published`
  (`load` и `save`) — черновик участникам невидим (OWN-4). Формат — OWN-6;
  страница её не собирает, username в SPA не запекается (ADR-0017).
- **Идемпотентность создания** — `id` нового ивента приходит со страницы
  (`newId`, один на открытие формы): потерянный ответ и повторный
  «Сохранить» апсертят ту же запись (второй раз — как правка, `published_at`
  не перезаписывается). `newId`, занятый записью **чужого чаптера**, — `403`;
  тот же `newId` в своём чаптере — идемпотентная правка.
  Идемпотентна **запись**, не сообщения: подтверждение организатору уходит на
  каждый успешный `save`, повтор даст второе «обновлён» — журнала отправок
  нет (ADR-0003). Цена клиентского `id`: два staff'а с одним `newId` в одну
  секунду дадут две строки (`tables-upsert-records` матчит на своей стороне,
  ADR-0003), и `step_6` с `limit: 1` отдаст произвольную — второй получит
  `403` на свой же ивент; эскалации нет. `newId` — 12 случайных
  символов, столкновение возможно только намеренно.
- **Даты**: вход трактуется как Asia/Tashkent (UTC+5, без DST) и пишется
  UTC ISO (OWN-3). Обязательны только при `status='published'`; у черновика
  могут быть пустыми. `ends_at > starts_at`, `reg_deadline_at ≤ starts_at`.
  «В будущем» требуется только для **публикуемого** ивента и только для
  **изменённой** даты — иначе у идущего ивента нельзя было бы поправить адрес.
- **Гео**: обе координаты или ни одной; широта ±90, долгота ±180; запятая как
  разделитель принимается.
- **`capacity`** — целое ≥ 1 или пусто; **`overbook_pct`** — 0…100 или пусто.
  Пусто у `NUMBER`/`DATE` значит «не менять», не «очистить» (см. CLAUDE.md,
  лимиты Tables) — снять раз выставленную ёмкость формой нельзя.
- **`status` — переходы ровно по OWN-4** (`draft → published → cancelled |
  finished`): новый/`draft` → `draft`|`published`; `published` →
  `published`|`cancelled`; `cancelled` и `finished` — только тот же статус
  (поля править можно, статус — нет). Обратных переходов нет: снять
  публикацию или «воскресить» ивент формой нельзя (`cancelled_at`/`finished_at`
  очистить нечем — Q30). `published_at` ставится при первой публикации,
  `cancelled_at` — при первой отмене. Та же таблица переходов решает, какие
  действия видны на странице: «Сохранить черновик»/«Опубликовать» — у нового
  и черновика, «Сохранить»/«Отменить ивент» — у опубликованного (W42).
- **`id` нового ивента** — `newId` страницы: 12 символов `[A-Za-z0-9_]`, без
  префикса `e` (тот же контракт, что у `fn-parse-start`).
- **Даты проверяются обратным разбором компонент**: `2026-02-31` и `25:00`
  отвергаются, а не переносятся `Date.UTC` на соседний день.
- **Уведомление (OWN-5)** — только если ивент **был** `published` до правки:
  `status → cancelled` даёт `notify.event_cancelled`; иначе список
  «было → стало» по полям [notify-on-change](../../docs/DATA-MODEL.md#notify-on-change)
  (`title`, `address`, `starts_at`, `ends_at`, `reg_deadline_at`, `lat`/`lon`,
  `status`). Правка `description`, `capacity`, `overbook_pct` уведомления не
  даёт. Даты в уведомлении — Asia/Tashkent словами.
- **Фото формой не трогается** — `photo_file_id` не входит в `values` upsert'а;
  создать афишу формой нельзя ([Q46](../../docs/OPEN-QUESTIONS.md#q46)).

### Правила `step_20` (контролёры, W36)

- **Права те же, что у правки ивента, и проверяются повторно по полям записи**
  (defense in depth, Q25): любой `staff` с доступом к чаптеру ивента, **не
  только автор** ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)).
  «Не staff» / «чужой чаптер» / «нет ивента» / сентинел `-` — один `403`.
- **`telegram_id` — только цифры 8–16**; username не принимается (DAT-1).
  Нечисловой → `422 {fields:{telegram_id:…}}`, в `event_staff` ничего не пишется.
- **Добавление идемпотентно:** активная строка (`revoked_at` пусто) для этого
  `(event_id, telegram_id)` уже есть — вторая не создаётся, ответ «уже
  контролёр» с текущим списком. Гонка двух одновременных добавлений остаётся
  возможной — уникальности в БД нет (ADR-0003).
- **Отзыв идемпотентен:** `revoked_at = now (UTC)`; отзывать нечего — `200` с
  текстом «активных прав нет», не `404`. Возврат прав — **только новой
  строкой** (Q30: очистить DATE нечем); чтения фильтруют `revoked_at === ''`,
  дубли revoked+active допускаются и считаются [W12b](../../docs/BACKLOG.md#w12b-отчёт-о-дублях-dedup-report).
- **Уведомление** — одно сообщение в DM и только тем, кто есть в `users`
  (`telegram_id` — единственный ключ, DAT-1): цели уведомления — `[]` или один
  id, цикл по пустому списку не отправляет ничего, поэтому отдельной ветки «нет
  в users» нет. Кнопка — та же `web_app` на сканер этого ивента, что в меню;
  переоткрыть меню колбэком нельзя, такого маршрута в `tg-router` нет.
  Отправка `continueOnFailure` — ошибка Bot API (403, бот заблокирован) не
  отменяет добавление.
- **Строки списка собирает сервер** (`manage.staff.item`: `ID <id> — контролёр
  с <когда>`, Asia/Tashkent): имён нет — их пришлось бы читать из `users`
  вторым запросом, а контролёра staff добавляет по ID. Список и `text` приходят
  и в ответах add/remove — страница не перезапрашивает.
- **Запись**: `tables-create-records` (`event_id`, `telegram_id`, `granted_by` —
  кто выдал, `granted_at` — UTC) и `tables-update-record` по `record_id` из
  чтения `step_19` (`__recordId` — `id` записи, а не поле).

## Зависимости

- **Таблицы**: `events` (`R4aSQpLZvw7d3u6DVOSjH`, чтение и upsert),
  `staff` (`PnDy6gw9tlLUqTGk2EOUn`, чтение), `registrations`
  (`SM8tMxfQuQCHRDdAiNJyQ`, чтение), `event_staff` (`t1g8Vae3iEoDk93D6Rle7`,
  чтение / create / update), `users` (`xHhYjhwqKdONkrYJGcBsz`, чтение)
- **Флоу**: `fn-hmac-init-data`
- **Переменные**: `BOT_TOKEN` (ADR-0008, передаётся в `fn-hmac-init-data`),
  `BOT_USERNAME` (`inviteLink` в ответах `load`/`save`, W37), `MINIAPP_URL`
  (кнопка сканера в уведомлении), `YANDEX_GEOCODER_API_KEY` (`step_35`,
  Геокодер; заводится в UI, ADR-0008 — в репозиторий не попадает)
- **Qadam'ы**: `@aiqadam/qadam-http : send_request` (`step_35` — единственный
  HTTP-шаг флоу, `failureMode: continue_all`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — `step_15`, `step_17`, `step_27`

## Заметки

- **Ответ странице уходит до сообщений** (`step_12`, режим `respond`):
  отправка в Bot API — самая дорогая операция (0,7–0,9 с на сообщение), а
  зарегистрированных может быть много; страница получает `200` за ~1 с,
  рассылка идёт после. Это первое применение «Respond and Continue» в проекте.
- **Узкий нетроттленый цикл уведомления** ([Q36](../../docs/OPEN-QUESTIONS.md#q36)):
  без бэкоффа на `429`, без `broadcasts`; это не W14.
- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014);
  значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
  Ключи ошибок полей уходят странице **ключами**, а не текстом: страница
  переводит их тем же словарём (`i18n/ru.json` с Pages), общий текст
  отказа — текстом.
- **`initData` целиком лежит в логе прогона** (вывод триггера) и годен **300 c**
  (окно этого флоу, [Q49](../../docs/OPEN-QUESTIONS.md#q49)): любой, кто читает
  прогоны проекта, может повторить запрос от имени пользователя в это окно.
  Это свойство всех webhook-флоу с `initData` (`checkin-api`, `my-qr-api`),
  не только этого.
- **Все три `send_text_message` — `continueOnFailure`**: заблокировавший бота
  получатель не должен прерывать ни цикл, ни ответ организатору; ответ странице
  к этому моменту уже отдан (у уведомления контролёру — ответ отдан в `step_23`).
- **Контролёры (W36) — ручной путь вместо инвайт-ссылок W10** (v0.2): staff
  вводит `telegram_id` руками, одноразовых токенов нет. Секция «Контролёры» —
  внутри существующего роута `#/manage/:id`, четвёртой страницы Mini App не
  заводится (ADR-0017 п. 3). Свой `telegram_id` staff добавить себе тоже может —
  легальный случай (staff-организатор он же контролёр своего ивента).
- **Поиск кандидатов (W44, [Q51](../../docs/OPEN-QUESTIONS.md#q51))** — шит
  «Выбор контролёра» в той же секции: поле поиска, список с аватарами-инициалами,
  именем и `@username`, добавление тапом тем же `staff_add`. Пул — участники
  ивента (`registrations` → `users`) + `staff` чаптера (+глобальные);
  действующие контролёры исключены; кого нет в `users` — не показывается
  (показать нечего), остаётся ручной ввод. Имя/`username` — только подписи для
  поиска (DAT-1): решение и запись — по `telegram_id`, который в списке текстом
  не показывается. Запрос короче 2 символов (включая пустой) даёт пустой список —
  отличие от прототипа, где пустой запрос показывал всех: без запроса базу не
  светим. Ручной ввод `telegram_id` (W36) остаётся запасным путём.
- **Ссылка регистрации живёт на экране, а не в чате (W37).** Подтверждение
  организатору (`step_15`) — короткий факт «ивент опубликован»; ссылка с
  кнопками «Скопировать»/«Поделиться» — панель формы, данные — `inviteLink`
  ответа. Граница сред ([ADR-0017](../../docs/adr/0017-screen-not-message.md)):
  экран — редактируемое состояние, чат — факт; два места с одной ссылкой не
  нужны, а список `#/manage` не даёт ей потеряться.
- **Событие `emtzwtmr32apl`** (13 символов) формой не открывается: `id` длиннее
  slug'а `fn-parse-start`, у него и deep link не работает. Это дефект данных
  старого визарда, не формы.
