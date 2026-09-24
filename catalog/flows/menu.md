# Flow: menu

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  (`route: menu`: голый `/start`, `/start` с неразобранным payload, любая
  незнакомая команда — [ADR-0025](../../docs/adr/0025-start-only-commands-ban.md),
  обычный текст — W73, колбэк `menu:*` — W68)
- **Назначение**: точка входа на голый `/start`. Сначала гейт профиля
  (ADR-0034): пока `users.profile_completed_at` не заполнен — тот же
  онбординг C, что и по диплинку события, только без карточки события;
  профиль заполнен — меню-хаб с набором кнопок по ролям (гость /
  организатор / контролёр).
- **Flow ID (MCP)**: `1DORFhP9F3W00KpKz5wDw` · **externalId**: `BOLkFV1GreF8r7opvDCVo`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `chatId`, `firstName`, `badPayload`, `fallback`, `telegramId`, `callbackData`, `callbackQueryId` |
| step_1 | `tables-find-records users` | `profile_completed_at` вызывающего — гейт ADR-0034 |
| step_2 | CODE «gate» | `needsOnboard` (пусто → true) |
| step_3 | ROUTER по `needsOnboard` | `has_profile` / `needs_onboard` / `Otherwise` (недостижим, оба условия исчерпывающие) |
| step_8→12 (`has_profile`) | `tables-find-records staff` → `event_staff` → `events` → CODE «render menu» → `send_text_message` | прежнее меню-хаб без изменений (см. ниже) |
| step_4→7 (`needs_onboard`) | CODE «build onboarding entry card (no event)» → `send_text_message` → CODE «draft JSON» → `tables-upsert-records sessions` | why-карточка онбординга без события, сессия `ob_consent` с `eventId: ''`; дальше колбэки `ob:*` подхватывает `reg-profile` (маршрутизация `tg-router` не знает о `menu` — работает по префиксу и активной сессии) |
| step_13 (`Otherwise`) | CODE noop | недостижимая ветка, нужна платформе как непустой fallback |

### `has_profile` — прежнее меню (без изменений)

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| step_8 | `tables-find-records staff` | строка `staff` пользователя (limit 1) — видимость кнопок овнера |
| step_9 | `tables-find-records event_staff` | все staff-строки пользователя (limit 50) |
| step_10 | `tables-find-records events` | опубликованные события (status = `published`, limit 50) |
| step_11 | CODE «render menu» | сборка кнопок: гость — 1 кнопка; организатор — [`Панель администратора`, `События`, `Новое событие`, `Как сделать рассылку` (`callback_data: menu:bcast_help`, W68)]; контролёр — тот же 1 экран, свой текст; `fallback=true` (ответ на обычный текст, W73) меняет преамбулу на `menu.fallback_text`, кнопки и лид те же; `callbackData=menu:bcast_help` от организатора отдаёт инструкцию `bcast.howto.*` вместо приветствия (W68) |
| step_12 | `send_text_message` (`format: None`) | отправка меню |

## Зависимости

- **Таблицы**: `users` (чтение, гейт), `staff` (чтение, видимость), `events`
  (чтение), `event_staff` (чтение), `sessions` (запись, ветка `needs_onboard`)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`);
  продолжение (`ob:*`) уходит в `reg-profile`
- **Переменные**: `MINIAPP_URL` (URL для кнопок `web_app`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Гейт один на все роли** (ADR-0034): staff/owner видят свою кнопку
  `Панель администратора` только после того же онбординга, что проходит
  гость — своя роль не освобождает от профиля. Роли (`step_8`/`step_9`)
  читаются только внутри ветки `has_profile`, до гейта они не нужны.
- **Ветка `needs_onboard` — та же исходная точка диалога, что и `reg-start`
  при входе по диплинку** (`step_11` в `reg-start`), но без карточки
  события: `draft.eventId = ''`. Диалог дальше — общий код в `reg-profile`;
  различие проявляется только в финале (`finish` vs `finish_no_event`,
  см. `catalog/flows/reg-profile.md`).
- **ROUTER пересобран с нуля, не ретрофичен** — гоча CLAUDE.md №10
  (`ap_add_step` с `ROUTER` через `AFTER` на шаг с уже существующим
  продолжением не гейтит старую цепочку). Прежние `step_1`…`step_5`
  (без гейта) удалены с хвоста и отстроены заново внутри веток.
- **Кнопки `web_app` собираются из `MINIAPP_URL`**: `#/events` (все роли —
  каталог и «Мои билеты» — один экран, открывается первым табом),
  `#/manage` (организатор — свой список с входом в правку) и
  `#/manage/new` (организатор — сразу форма создания). Кнопки сканера
  в чате нет: сканер — рядом с событием в Mini App по правам плюс кнопка
  «Открыть сканер» на конкретное событие в accept-карточке контролёра.
  Права проверяет не страница, а `manage-api`/`checkin-api`.
- **Staff-фильтр — defense-in-depth в CODE step_11**, не в tables-запросе:
  `step_9` читает все staff-строки пользователя без фильтра `revoked_at`,
  CODE `step_11` постфильтрует `r.revoked_at === ''` ([Q25](../../docs/OPEN-QUESTIONS.md#q25)).
  Дополнительно: только опубликованные события (`byId[r.event_id]`) и только
  будущие (`notPast` по `ends_at` или `starts_at`). Флаг `isController` не
  выбирает событие для кнопки — только текст и `role`; отозванный контролёр
  падает в гостя.
- **Порядок кнопок фиксирован, по одной в ряд**: гость — [`События`];
  организатор — [`Панель администратора`, `События`, `Новое событие`]
  (управление первым — овнер чаще открывает свой список);
  контролёр — [`События`] со своим текстом; двойная роль — объединение
  (кнопки овнера). Общего заголовка «Что дальше?» нет: у каждой роли свой
  лид (`menu.lead_guest` / `menu.lead_owner` / `menu.lead_controller`).
  Каталог событий — экран (ADR-0023), а не чат-лист: своих колбэков у меню
  нет. Ключи `menu.title`, `menu.btn.my_events`, `menu.btn.my_tickets`,
  `menu.btn.scanner` остались в `i18n/ru.json` как архив корпуса, живые
  флоу их не читают.
- **«Новое событие» — видимость, а не авторизация** ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)):
  кнопка показывается по строке в [`staff`](../tables/staff.md), даже если у
  организатора ещё нет событий. Само правило прав живёт в одном месте —
  `manage-api`; кнопка на чужой чаптер всё равно упрётся в `403`.
- **`badPayload`** — флаг из `tg-router` (`/start` с неразобранным payload):
  меняет преамбулу с приветствия на `start.bad_payload`. Работает только
  внутри `has_profile` — у нового гостя с неразобранным payload сначала
  всё равно онбординг.
- **Ответ на обычный текст (W73, #125).** `tg-router` зовёт меню не только
  на `/start` и незнакомую команду, но и на обычный текст — с
  `fallback=true`. Тогда преамбула — `menu.fallback_text`, а не приветствие
  по имени; лид (`menu.lead_guest`/`lead_owner`/`lead_controller`) и кнопки
  не отличаются от `/start`. Для нового гостя (профиль не заполнен) флаг
  ни на что не влияет: сначала тот же онбординг (ADR-0034).
- **Тексты — через `inputs.texts`** (ADR-0014), ключи `menu.*`, `onb.*` и
  `start.*`. `format: None` в ветке меню (без разметки), `MarkdownV2` в
  ветке онбординга (общий эталон экранирования с `reg-start`/`reg-profile`).
- **Кнопка «Как сделать рассылку» (W68, #120).** У организатора (и двойной
  роли) в меню есть кнопка с колбэком `menu:bcast_help`; `tg-router`
  (`step_10`) маршрутизирует префикс `menu:` в это же меню, а `step_11`
  отдаёт инструкцию в 3 шага (`bcast.howto.title`/`step1`/`step2`/`step3`) —
  тот же текст, что таб «Рассылка» Mini App. Гостю и контролёру (кнопки нет)
  колбэк отдаёт обычное меню. Это не команда — префикс колбэка, ADR-0025 не
  затронут.
- **Ack колбэка — в `tg-router`, не здесь (W99).** Раньше `menu` первым шагом
  звал `answer_callback_query`, но `callbackQueryId` непуст только у колбэка:
  на `/start` и обычном тексте шаг всё равно делал HTTP-визит в Bot API и
  получал `400` — 0,3–0,7 с из ~1,2 с прогона впустую (`continueOnFailure`
  прятал). Шаг из флоу убран; ack делает первый шаг ветки `menu_cb` в
  `tg-router` (`step_22`), до вызова меню.
