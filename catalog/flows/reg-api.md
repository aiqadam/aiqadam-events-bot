# Flow: reg-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/SiYL8m6k4oy4YunAdZ1W7/sync`; тело:
  `{ action, eventId?, initData, consentPdn?, consentMarketing? }`
  (`authType: none`, авторизация — `initData`)
- **Назначение**: «Мои билеты» и регистрация в каталоге `#/events`
  (PAR-3/PAR-4 в целевой форме): одно касание — три действия, все строго
  по владельцу `initData` (W43, Q57)
- **Flow ID (MCP)**: `SiYL8m6k4oy4YunAdZ1W7`

## Действия (`body.action`)

| Action | Назначение | Ответ |
|--------|-----------|-------|
| `mine` | регистрации вызывающего — живые (`registered`/`checked_in`), отменённые не возвращаются | `200 {ok, outcome:'mine', mine:[{eventId, status, registeredAt, checkedInAt}]}` |
| `register` | создать регистрацию идемпотентно (IDM-1) с двумя согласиями | `200 {ok, outcome:'registered', text}` / `200 {ok, outcome:'existing', text}` (повтор — та же строка) / отказы (см. ниже) |
| `cancel` | отменить до `starts_at` (PAR-5) | `200 {ok, outcome:'cancelled', text}` / `404 not_registered` / `409 too_late` |

Отказы `register`: `400 pdn_required` (PAR-1 не отмечен — сервер требует,
кнопка в шите без него выключена), `400 bad_request`, `404 not_found`,
`409 declined` с причиной `event_cancelled` / `event_finished` /
`not_published` / `deadline_passed` / `no_seats` (OWN-4, OWN-15). Невалидный
`initData` (истёк/подпись) — `401 invalid_init_data` до любых чтений.

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём sync-запроса SPA |
| step_1 | `callFlow fn-hmac-init-data` (`inline`, `waitForResponse`) | проверка `initData` по токену бота, окно 1 ч (`maxAgeSeconds: 3600`) |
| step_2 | CODE «normalize request» | нормализация входа: `action` lowercase, `consentPdn/Marketing` в boolean, `now` |
| step_3 | ROUTER `valid` / `Otherwise` | `step_2.valid` → ветка действий, иначе `401` |
| step_4 | CODE «invalid initData response» | `401 {ok:false, error:'invalid_init_data'}` |
| step_5 | `return_response` (`stop`) | ответ неавторизованному |
| step_6 | `tables-find-records registrations` | свои строки: `telegram_id eq <владелец initData>`, `limit 50`, проекция `telegram_id`+`status`+`registered_at`+`checked_in_at`+`event_id` |
| step_7 | `tables-find-records registrations` | происхождение события: `event_id eq <id>`, `limit 200` (подсчёт занятости — OWN-15), проекция `event_id`+`telegram_id`+`status` |
| step_8 | `tables-find-records events` | событие по `id`, `limit 1` |
| step_17 | `tables-find-records users` | профиль вызывающего (`profile_completed_at`), гейт PAR-8 (W50) |
| step_9 | CODE «decide» | решение: `mine` / `registered` (+`registered_profile` — с записью профиля из шита) / `existing` / `cancelled` / `profile` / `profile_saved` / отказы; `register` без заполненного профиля и без валидных полей → `400 profile_required`; `profile_save` требует `consent_pdn=true` (PAR-1, ревью W50); повтор проверяется раньше профильного гейта (IDM-1 с QR); все тексты — во входе `texts` |
| step_10 | ROUTER по `outcome` | `register` / `registered_profile` / `cancel` / `profile` / `profile_saved` / `Otherwise` (`mine` и отказы без записей) |
| step_11 | `tables-upsert-records registrations` | создать/реактивировать: `id = <eventId>-<telegramId>`, `status = registered`, `registered_at = now`, ключ `(event_id, telegram_id)` |
| step_12 | `tables-upsert-records users` | `consent_pdn = true` + время, `consent_marketing = true/false` + время (всегда записывается, PAR-2); профиль НЕ пишет — для него ветка `registered_profile` |
| step_13 | `return_response` (`stop`) | `200 {ok, outcome:'registered', text}` |
| step_18→20 (`registered_profile`) | upsert `registrations` → upsert `users` (согласия + профиль + `profile_completed_at`) → respond | регистрация из каталога с одновременным заполнением профиля (W50) |
| step_21 (`profile`) | `return_response` (`stop`) | таб «Профиль»: `{ok, outcome:'profile', profile, pdnDone, consentMarketing}` без записей |
| step_22→23 (`profile_saved`) | upsert `users` (профиль + `consent_marketing`/`consent_marketing_at`) → respond | правка профиля табом (W60: и переключатель рассылки); валидация профиля та же, что в шите |
| step_14 | `tables-upsert-records registrations` | отменить: `status = cancelled`, `cancelled_at = now`, ключ `(event_id, telegram_id)` |
| step_15 | `return_response` (`stop`) | `200 {ok, outcome:'cancelled', text}` |
| step_16 | `return_response` (`stop`) | `mine`, повторы, отказы — ответ из `step_9` без записей |

## Зависимости

- **Таблицы**: `registrations` (чтение + запись), `users` (запись согласий), `events` (чтение)
- **Переменные**: `BOT_TOKEN`
- **Флоу**: `fn-hmac-init-data` (`inline` — ответ нужен для маршрутизации)
- **Connections**: —

## Заметки

- **`telegram_id` берётся только из `initData`** (`step_2.telegramId` из
  `fn-hmac-init-data`): поле с таким именем в теле запроса read-only
  (нормализация его отбрасывает) — создать регистрацию другому или прочитать
  чужие `mine` запросом нельзя (IDOR закрыт построением, проверен различающим
  прогоном: `telegramId: '999000111'` в теле дал строку вызывающего).
- **Окно `initData` — 1 ч**, не 300 с (Q49): шит регистрации открывается
  минутами после открытия каталога, окно `manage`/`ticket` здесь слишком
  узкое. Цена — реплей чужого `initData` в течение часа даёт только
  собственную регистрацию вызывающего (действия идемпотентны).
- **PAR-2 пишется `false` явно и со временем** (`consent_marketing_at` всегда),
  как в чат-пути: `false` по умолчанию — отсутствие согласия, а не побочный
  эффект. `source` регистрация из Mini App не пишет — поле зарезервировано
  за utm из deep link (OWN-6).
- **Регистрация — тот же `id` вида `<eventId>-<telegramId>`**, что и в чате:
  оба пути пишут одну строку, IDM-1 действует между путями.
- **`mine` возвращает только живые строки** (`registered`/`checked_in`):
  отменённая строка не билет и из таба исчезает сразу; заголовочная
  информация (название, дата, адрес) добирается SPA из публичного
  `events-api` — сервер не дублирует её.
- **Подсчёты — defense in depth**: чтения фильтруют по `telegram_id`/`event_id`,
  CODE повторяет те же фильтры на строке (Q25). Лимит 200 на происхождение —
  договорённость Q15 для точности `no_seats`.
- **`step_17`/`step_19`/`step_22` до 2026-09-20 писали и читали шесть
  колонок профиля (`profile_first_name`, `profile_last_name`, `position`,
  `company`, `city`, `profile_completed_at`) по внутреннему `id` поля вместо
  `externalId` (CLAUDE.md, гоча №1). `columns`-проекция на чтении к этому
  терпима (отдаёт `null`, шаг не падает), а `values` на записи — нет: ключ,
  не совпадающий ни с одним `externalId`, молча отбрасывается. В результате
  вкладка «Профиль» и регистрация из каталога с профилем (`registered_profile`)
  не сохраняли ни одного из шести полей ни разу с момента W50, при этом сам
  вызов отвечал `200 ok` — различающий прогон: `ap_run_action` тем же
  `tables-upsert-records` напрямую, с литеральным значением, тоже не записал.
  Исправлено на верные `externalId` (см. `ap_export_table` для маппинга).
- **Таб «Профиль» переключает `consent_marketing` (W60).** Причина: чат-путь
  (`reg-profile/finish_lite`) больше не переспрашивает согласие на рассылку
  при повторной регистрации (спросили один раз — хватит), поэтому нужен
  способ передумать без новой регистрации. `profile_get` отдаёт текущее
  значение (`consentMarketing`, из `users.consent_marketing`), `profile_save`
  принимает `consentMarketing` в теле и пишет его вместе с профилем —
  `consent_marketing_at` проставляется всегда, тем же приёмом, что и везде
  с PAR-2 (пустая дата — «не отвечал», а не «нет»).
- **Проекция `columns` на `step_6`/`step_7` — защита логов от ПД, не от объёма
  ([Q31](../../docs/OPEN-QUESTIONS.md#q31)).** `step_7` без неё писал в лог
  прогона `telegram_id` каждого участника события на любой вызов `register`/
  `cancel`, доступный любому пользователю с валидным `initData` на произвольный
  `eventId`. Набор колонок — ровно то, что читает `step_9` (`decide`); не
  переносить на другие чтения без сверки с их собственным CODE-шагом (тот же
  урок W26 про `find-registration`).
