# Flow: reg-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/SiYL8m6k4oy4YunAdZ1W7/sync`; тело:
  `{ action, eventId?, initData, consentPdn?, consentMarketing?, confirm?, telegramId? }`
  (`authType: none`, авторизация — `initData`; `confirm`/`telegramId` — только
  для `delete_account`, чужой `telegramId` не доверяется)
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
| `delete_account` | самоудаление аккаунта (GDPR, W73, ADR-0039): строки вызывающего из `users`, `registrations`, `feedback`, `broadcast_targets`, `sessions`. Требует `confirm: true` | `200 {ok, outcome:'delete_account', text}` / `403 forbidden` (чужой `telegramId` в теле) / `400 bad_request` (нет подтверждения) |

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
| step_2 | CODE «normalize request» | нормализация входа: `action` lowercase, `consentPdn/Marketing` в boolean, `now`; `eventIdOrNone = eventId \|\| '__none__'` — непустое значение для фильтров `step_7`/`step_8` (платформенная гоча: пустой `eq` валит шаг) |
| step_3 | ROUTER `valid` / `Otherwise` | `step_2.valid` → ветка действий, иначе `401` |
| step_4 | CODE «invalid initData response» | `401 {ok:false, error:'invalid_init_data'}` |
| step_5 | `return_response` (`stop`) | ответ неавторизованному |
| step_6 | `tables-find-records registrations` | свои строки: `telegram_id eq <владелец initData>`, `limit 50`, проекция `telegram_id`+`status`+`registered_at`+`checked_in_at`+`event_id` |
| step_7 | `tables-find-records registrations` | происхождение события: `event_id eq eventIdOrNone`, `limit 200` (подсчёт занятости — OWN-15), проекция `event_id`+`telegram_id`+`status` |
| step_8 | `tables-find-records events` | событие по `id eq eventIdOrNone`, `limit 1` |
| step_17 | `tables-find-records users` | профиль вызывающего (`profile_completed_at`) + `consent_pdn`/`consent_marketing`: гейт PAR-8 (W50) и текущее значение для таба «Профиль» |
| step_9 | CODE «decide» | решение: `mine` / `registered` (+`registered_profile` — с записью профиля из шита) / `existing` / `cancelled` / `profile` / `profile_saved` / отказы; `register` без заполненного профиля и без валидных полей → `400 profile_required`; `profile_save` требует `consent_pdn=true` (PAR-1, ревью W50); повтор проверяется раньше профильного гейта (IDM-1 с QR); все тексты — во входе `texts` |
| step_10 | ROUTER по `outcome` | `register` / `registered_profile` / `cancel` / `profile` / `profile_saved` / `Otherwise` (`mine` и отказы без записей) |
| step_11 | `tables-upsert-records registrations` | создать/реактивировать: `id = <eventId>-<telegramId>`, `status = registered`, `registered_at = now`, ключ `(event_id, telegram_id)` |
| step_12 | `tables-upsert-records users` (**пропущен, W60**) | было — `consent_pdn = true` + время, `consent_marketing = true/false` + время; отключён: повторная регистрация (эта ветка достижима только при `profileDone`) больше не трогает `users` — согласия уже записаны раньше, перезапись из шита каталога по умолчанию-снятому чекбоксу молча откатывала `consent_marketing` на `false` |
| step_13 | `return_response` (`stop`) | `200 {ok, outcome:'registered', text}` |
| step_18→20 (`registered_profile`) | upsert `registrations` → upsert `users` (согласия + профиль + `profile_completed_at`) → respond | регистрация из каталога с одновременным заполнением профиля (W50) |
| step_21 (`profile`) | `return_response` (`stop`) | таб «Профиль»: `{ok, outcome:'profile', profile, pdnDone, consentMarketing}` без записей |
| step_22→23 (`profile_saved`) | upsert `users` (профиль + `consent_marketing`/`consent_marketing_at`) → respond | правка профиля табом (W60: и переключатель рассылки); валидация профиля та же, что в шите |
| step_14 | `tables-upsert-records registrations` | отменить: `status = cancelled`, `cancelled_at = now`, ключ `(event_id, telegram_id)` |
| step_15 | `return_response` (`stop`) | `200 {ok, outcome:'cancelled', text}` |
| step_16 | `return_response` (`stop`) | `mine`, повторы, отказы — ответ из `step_9` без записей |
| step_24→26 (`delete_account`) | `tables-find-records registrations` → `LOOP_ON_ITEMS` → `tables-delete-record` | строки вызывающего из `registrations`; удаление по внутреннему id, пустой список — ноль итераций (гоча 18) |
| step_27→29 | то же по `feedback` | |
| step_30→32 | то же по `broadcast_targets` | |
| step_33→35 | то же по `sessions` | |
| step_36→38 | то же по `users` | профиль удаляется последним: сбой раньше оставляет строку для повторного вызова |
| step_39 | `return_response` (`stop`) | `200 {ok, outcome:'delete_account', text}` |

## Зависимости

- **Таблицы**: `registrations` (чтение + запись + удаление), `users` (запись
  согласий + удаление), `events` (чтение), а также `feedback`,
  `broadcast_targets`, `sessions` (только удаление, W73)
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
- **`columns` на чтении и `values` на записи адресуют поля по `externalId`.**
  Это разные namespace'ы: внутренний `field id` встречается только в `cells`
  вывода `tables-find-records` (CLAUDE.md, гоча №1). Ошибка тут тихая с обеих
  сторон: `values` с ключом-`id` платформа молча отбрасывает — шаг всё равно
  отвечает `200 ok`, — а `columns` с чужим ключом просто не отдаёт колонку, и
  CODE-шаг видит пустое поле. Маппинг `users` — в
  [catalog/tables/users.md](../tables/users.md), сверять с `ap_export_table`,
  а не с памятью.
- **Таб «Профиль» переключает `consent_marketing`.** Чат-путь
  (`reg-profile/finish_lite`) спрашивает согласие на рассылку один раз, при
  повторной регистрации не переспрашивает — таб даёт передумать без новой
  регистрации. `profile_get` отдаёт текущее
  значение (`consentMarketing`, из `users.consent_marketing`), `profile_save`
  принимает `consentMarketing` в теле и пишет его вместе с профилем —
  `consent_marketing_at` проставляется всегда, тем же приёмом, что и везде
  с PAR-2 (пустая дата — «не отвечал», а не «нет»).
  **Грабля чтения:** `step_17` обязан держать `consent_marketing` в проекции
  `columns` (externalId `FpWznk9Fgl8wUXXUKolRu`). Пропущенная колонка не
  ошибка — `userRow.consent_marketing` просто пуст, `profile_get` возвращает
  `false` при любом записанном значении, и галочка в табе выглядит снятой,
  хотя запись `profile_save` отрабатывает. `profile_get` возвращает `false`
  и для действительно непроставленного поля — отличить эти два случая по
  ответу нельзя, поэтому проверять надо проекцией, а не поведением таба.
- **Повторная регистрация (`register`, `profileDone = true`) не трогает
  `users`.** `step_12` помечен `skip`: к моменту, когда `profile_completed_at`
  заполнен, согласия (`consent_pdn`, `consent_marketing`) уже записаны, а шит
  каталога (`RegistrationSheet`) при каждом открытии сбрасывает чекбоксы в
  снятое состояние — запись с него откатывала бы `consent_marketing` на
  `false`. Симметрично чат-пути (`reg-profile/finish_lite`). Гейт `consentPdn`
  в `step_9` — «либо прислано в теле, либо уже есть `users.consent_pdn = true`»
  (`alreadyConsentedPdn`). Ветка `registered_profile` (`step_18→20`,
  регистрация из каталога с одновременным заполнением профиля) не тронута:
  там это первое и единственное согласие, писать обязательно.
- **Самоудаление аккаунта (W73, #125, ADR-0039).** `delete_account` удаляет
  строки вызывающего жёстко и без каскада. `telegram_id` — только из
  проверенного `initData` (DAT-1); `telegramId` в теле, не равный
  вызывающему, даёт `403` (попытка IDOR), а не «тихое своё удаление».
  Подтверждение (`confirm: true`) обязательно — кнопка в табе «Профиль»
  шлёт его после шита. Повтор безвреден: циклы по пустым выборкам делают
  ноль итераций. **Границы Part 1:** удаляются `users`, `registrations`,
  `feedback`, `broadcast_targets`, `sessions`; права и организационные
  касания (`event_staff`, `staff`, `staff_invites`, `events.staff_id`) —
  Part 2 (ADR-0039, «Границы»).
- **Проекция `columns` на `step_6`/`step_7` — защита логов от ПД, не от объёма
  ([Q31](../../docs/OPEN-QUESTIONS.md#q31)).** `step_7` без неё писал в лог
  прогона `telegram_id` каждого участника события на любой вызов `register`/
  `cancel`, доступный любому пользователю с валидным `initData` на произвольный
  `eventId`. Набор колонок — ровно то, что читает `step_9` (`decide`); не
  переносить на другие чтения без сверки с их собственным CODE-шагом (тот же
  урок W26 про `find-registration`).
- **`step_7`/`step_8` фильтруют по `eventIdOrNone`, а не по `eventId`.**
  `tables-find-records` fail-closed отклоняет пустое значение `eq`
  (`Filter #1: the "eq" operator on field "<f>" requires a value`) — см.
  платформенную гочу в `AGENTS.md`. Оба чтения идут линейно до роутера и
  выполняются для всех действий, но `eventId` непустой только у
  `register`/`cancel`; для `mine`/`profile_get`/`profile_save`/
  `delete_account` sentinel `__none__` даёт пустую выборку. `step_9` по-прежнему
  получает сырой `eventId` и решает как раньше.
