# Flow: manage-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/CcGPwuW4ws5hkcaOPerEG/sync`
- **Назначение**: сервер формы ивента роут `#/manage` SPA (`miniapp/src/routes/Manage.tsx`)
  ([ADR-0017](../../docs/adr/0017-screen-not-message.md) п. 3): отдаёт
  owner'у его ивент для правки и принимает создание/правку (OWN-1…OWN-5,
  OWN-15). Права решаются здесь, страница их не решает.
- **Flow ID (MCP)**: `CcGPwuW4ws5hkcaOPerEG`

## Вход

`POST` тела: `{ initData, action, eventId, fields }`.

| Поле | Что |
|---|---|
| `initData` | `Telegram.WebApp.initData` страницы |
| `action` | `load` — отдать ивент для правки; `save` — создать (`eventId` пустой) или обновить |
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
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData` по `BOT_TOKEN`, `telegramId` вызывающего |
| step_2 | ROUTER: `valid` / `Otherwise` | `{{step_1['output'].data.valid}} == 'true'` |
| step_3 (Otherwise) | CODE «invalid init data response» | `checkin.unauthorized`, `httpStatus: 401` |
| step_4 (Otherwise) | `return_response` (`stop`) | ответ `401` |
| step_5 (valid) | CODE «normalize request» | `eventId` → slug или `-` (при создании — `newId`); `isNew`; `action`; `fields` |
| step_6 (valid) | `tables-find-records events` | ивент по `id`, `limit: 1` |
| step_7 (valid) | CODE «decide: owner, validate, diff» | владелец, валидация, конвертация дат, `id` нового ивента, значения записи, diff `notify-on-change`, тексты; исход `outcome` = `load` / `save` / `error` |
| step_8 (valid) | ROUTER: `save` / `load` / `Otherwise` (=error) | по `{{step_7['output'].outcome}}` |
| step_9 (Otherwise) | `return_response` (`stop`) | `403` forbidden / `422` validation / `400` |
| step_10 (load) | `return_response` (`stop`) | `200`, `event` — поля ивента для формы (+ `hasPhoto`) |
| step_11 (save) | `tables-upsert-records events` | запись по ключу `id` |
| step_12 (save) | `return_response` (**`respond` — «Respond and Continue»**) | `200` странице **до** отправки сообщений |
| step_13 (save) | `tables-find-records registrations` | `event_id = id`, проекция `telegram_id`, `status` |
| step_14 (save) | CODE «notify targets + owner text» | дедуп `telegram_id` со `status='registered'`; `[]` если `notifyKind='none'`; текст владельцу с `{count}` |
| step_15 (save) | `send_text_message` (`continueOnFailure`) | подтверждение владельцу в чат (`format: None`), при создании — со ссылкой регистрации (OWN-6) |
| step_16 (save) | `LOOP_ON_ITEMS` по `{{step_14['output'].targets}}` | |
| step_17 (в цикле) | `send_text_message` (`continueOnFailure`) | уведомление одному зарегистрированному (`format: None`) |

### Контракт ответа (согласован с `#/manage` SPA)

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен | 401 | `{ok:false, error:"invalid_init_data", text}` |
| ивент не найден **или** не принадлежит вызывающему; сентинел `-`; создание с `newId`, занятым чужой записью | 403 | `{ok:false, error:"forbidden", text}` — одинаково, ничего не перечисляем |
| поля не прошли валидацию | 422 | `{ok:false, error:"validation", text, fields:{<поле>: <ключ i18n>}}` — ключ поля `geo` относится к паре `lat`/`lon` |
| `load` владельцем | 200 | `{ok:true, event:{id,title,description,address,lat,lon,starts_at,ends_at,reg_deadline_at,status,capacity,overbook_pct,hasPhoto}, eventId}` |
| `save` | 200 | `{ok:true, text, eventId}` — `eventId` созданного ивента нужен странице, чтобы второй «Сохранить» стал правкой, а не дублем |

Тело ответа во всех ветках имеет один набор ключей (`ok`, `error`, `text`,
`fields`, `event`, `eventId`), потому что `return_response` ссылается на них
из вывода `step_7`/`step_3` и не переживёт отсутствующего поля.

### Правила `step_7`

- **Владелец** — `events.owner_id == telegramId` из `initData`, по **этому**
  `id`. Запись выбирается в коде по `id`, а не как первая строка выборки —
  отбор повторяется в коде и не зависит от фильтра `step_6`; сентинел `-`
  отвергается до сравнения. Проверяется до любой валидации; `load` и `save`
  на чужой/несуществующий ивент — один и тот же `403`. Доказано прогоном с
  подменой входа на **всю** таблицу: не-владелец → 403, владелец → 200.
- **Идемпотентность создания** — `id` нового ивента приходит со страницы
  (`newId`, один на открытие формы): потерянный ответ и повторный
  «Сохранить» апсертят ту же запись (второй раз — как правка, `published_at`
  не перезаписывается). `newId`, уже занятый чужой записью, — `403`.
  Идемпотентна **запись**, не сообщения: подтверждение владельцу уходит на
  каждый успешный `save`, повтор даст второе «обновлён» — журнала отправок
  нет (ADR-0003). Цена клиентского `id`: два создателя с одним `newId` в одну
  секунду дадут две строки (`tables-upsert-records` матчит на своей стороне,
  ADR-0003), и `step_6` с `limit: 1` отдаст произвольную — второй «владелец»
  получит `403` на свой же ивент; эскалации нет. `newId` — 12 случайных
  символов, столкновение возможно только намеренно; захват slug'ов любым
  пользователем бота — часть [Q47](../../docs/OPEN-QUESTIONS.md#q47).
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
  `cancelled_at` — при первой отмене. Та же таблица переходов стоит на
  странице и решает, какие радио видны.
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
- **Фото формой не трогается** — `photo_file_id` не входит в `values` upsert'а,
  поэтому афиша из визарда переживает правку; создать афишу формой нельзя
  ([Q46](../../docs/OPEN-QUESTIONS.md#q46)).

## Зависимости

- **Таблицы**: `events` (`R4aSQpLZvw7d3u6DVOSjH`, чтение и upsert),
  `registrations` (`SM8tMxfQuQCHRDdAiNJyQ`, чтение)
- **Флоу**: `fn-hmac-init-data`
- **Переменные**: `BOT_TOKEN` (ADR-0008, передаётся в `fn-hmac-init-data`),
  `BOT_USERNAME` (ссылка регистрации)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — `step_15`, `step_17`

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
- **`initData` целиком лежит в логе прогона** (вывод триггера) и годен 24 ч
  (потолок `fn-hmac-init-data`): любой, кто читает прогоны проекта, может
  повторить запрос от имени пользователя в это окно. Это свойство всех
  webhook-флоу с `initData` (`checkin-api`, `my-qr-api`), не только этого.
- **Оба `send_text_message` — `continueOnFailure`**: заблокировавший бота
  получатель не должен прерывать ни цикл, ни ответ владельцу; ответ странице
  к этому моменту уже отдан.
- **Событие `emtzwtmr32apl`** (13 символов) формой не открывается: `id` длиннее
  slug'а `fn-parse-start`, у него и deep link не работает. Это дефект данных
  старого визарда, не формы.
