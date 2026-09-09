# Flow: registration

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: регистрация участника на ивент (FLOWS.md#registration) — проверка мест,
  согласие на обработку данных (обязательное, PAR-1), согласие на рассылку (отдельное,
  PAR-2), опциональный телефон (DAT-2), выдача QR (PAR-6). Вызывается из `tg-router`.
- **Flow ID (MCP)**: `vfVfIngczCKA2DpUgcevP` · **externalId (для `callFlow`)**: `RId6eBcN8T4oo8pkkWB7b`

## Контракт

Флоу — не однократный вызов, а **многошаговый диалог** между несколькими прогонами:
каждое нажатие кнопки в Telegram — отдельный webhook-апдейт, отдельный вызов `tg-router`,
отдельный вызов этого флоу. Состояние между вызовами хранится в таблице `sessions`
(`scenario = 'registration'`), не в памяти флоу — её нет (ADR-0003).

**Вход:**

| Поле | Когда заполнено | Смысл |
|------|-----------------|-------|
| `action` | всегда | `start` (первый вход по deep link) \| `continue` (продолжение визарда) |
| `eventId`, `utm` | `action = start` | из `fn-parse-start` (kind `e`) |
| `kind` | `action = continue` | `callback` \| `contact` \| `text`/`command`/др. — как классифицировал `tg-router` |
| `callbackData`, `callbackQueryId` | `kind = callback` | `reg:pdn:yes|no`, `reg:mkt:yes|no` |
| `contactPhone`, `contactIsOwn` | `kind = contact` | из `request_contact`; чужой контакт (`contactIsOwn=false`) не сохраняется |
| `sessionStep`, `sessionDraft`, `sessionRecordId` | `action = continue` | снимок активной сессии, который `tg-router` уже прочитал (`step_12`/`step_13`) — этот флоу их не перечитывает |
| `telegramId`, `chatId`, `lang` | всегда | из `tg-router` |

**Шаг 1 (CODE «normalize input + derive stage»)** переводит вход в одно поле `stage`,
по которому дальше идёт единственный плоский ROUTER (аналог `tg-router`):

| `stage` | Когда | Что делает |
|---------|-------|-----------|
| `start` | `action = start` | ветка «start» — вся логика первого входа |
| `pdn_yes` / `pdn_no` | `sessionStep = await_pdn` + соответствующий `callbackData` | согласие на обработку данных |
| `mkt_yes` / `mkt_no` (объединены в одну ветку `mkt_answer`, различаются `stage` внутри) | `sessionStep = await_marketing` | согласие на рассылку |
| `phone_contact` / `phone_skip` (объединены в `phone_answer`) | `sessionStep = await_phone` | телефон или его пропуск |
| `noop` (fallback ветка) | несовпадение `sessionStep`/`callbackData` (протухшая/чужая сессия) | ничего не делает |

`phone_skip` — **любой** апдейт в `await_phone`, кроме `contact` с `contactIsOwn = true`
(включая произвольный текст или команду) — тем же принципом, что и «любой ответ» на
согласие на рассылку: пропуск не требует отдельной кнопки/ключа i18n.

## Ветка `start`

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| step_4 | `callFlow → fn-find-registration` | есть ли уже регистрация (IDM-1) | `eventId`, `telegramId` |
| step_5 | `tables-find-records events` | ивент по `id`, `limit 1` | `table_id` = `kVLg1FSfDBtsP32FGPk3P` |
| step_6 | `tables-find-records registrations` | `status = registered` по событию, `limit 500` — для овербукинга | `table_id` = `PNuChoFG0tIBTND86yzDL` |
| step_7 | CODE «решение: declined / existing / new» | `status`/`reg_deadline_at`/овербукинг (OWN-15, `ceil(capacity×(1+overbook_pct/100))`, дефолт 40) vs IDM-1 | — |
| step_8 | ROUTER по `outcome` | `declined` / `existing` / `new` (fallback) | `{{step_7['output'].outcome}}` |

**`declined`** (step_9…step_12): `reason` → ключ i18n (`reg.not_published` / `event_cancelled` /
`event_finished` / `deadline_passed` / `no_seats`), `fn-fmt-time` для `{when}` в
`deadline_passed`, `fn-t`, `send_text_message`. Регистрация **не создаётся**.

**`existing`** (step_13…step_18, IDM-1 — повторный вход по ссылке): `fn-sign-qr` →
`qrcode` → `reg.already` (`{title}`) → `send_text_message` → best-effort `send_media`
с QR (см. «Известный блокер» ниже). Второе согласие не спрашивается.

**`new`** (step_19…step_32): `fn-event-card` → `send_text_message` (карточка,
`format: None`) → ROUTER «есть venue?» (`step_21`, `EXISTS` по `card.venue`):
при наличии — `sendVenue` через `custom_api_call` (у `@aiqadam/qadam-telegram-bot`
нет отдельного action'а — гейт из ARCHITECTURE.md, п. «Qadam'ы http и tables»)
и сообщение со ссылкой на Я.Карты (`reg.venue.hint` + `mapsUrl`); без venue — no-op.
Дальше — upsert `sessions` (find-then-write: `step_26` ищет строку по `telegram_id`,
`step_28` обновляет или заводит) со `scenario = registration`, `step = await_pdn`,
`draft = {eventId, utm}` — и вопрос согласия на обработку данных с inline-кнопками
`reg:pdn:yes` / `reg:pdn:no`.

## Ветка `pdn_yes`

`answer_callback_query` (ack, `continueOnFailure` — просроченный `callback_query_id`
не должен ронять остальную обработку) → `users.consent_pdn = true` (+`_at`) →
повторный `fn-find-registration` (реактивировать `cancelled`-строку или завести новую,
IDM-1) → `tables-create-records`/`tables-update-record registrations`
(`status = registered`, `source = utm`, `registered_at`) → `reg.done` (`{title}`) →
`sessions.step = await_marketing` → вопрос о рассылке (`reg:mkt:yes`/`no`).

## Ветка `pdn_no`

`answer_callback_query` → `reg.consent_pdn.declined` → `tables-delete-record sessions`
(`continueOnFailure`). Регистрация не создаётся (PAR-1).

## Ветка `mkt_answer`

`answer_callback_query` → ROUTER `yes`/`no` (fallback): `yes` пишет
`users.consent_marketing = true` (+`_at`) и `reg.consent_marketing.saved_yes`; `no` —
только `reg.consent_marketing.saved_no`, **никакой записи** (непроставленный флаг —
тоже «нет согласия», users.md). После обеих веток — `sessions.step = await_phone`,
вопрос о телефоне с `reply_markup.keyboard` (`request_contact: true`).

## Ветка `phone_answer`

ROUTER `contact` (при `contactIsOwn`) / fallback (пропуск): `contact` пишет
`users.phone`, шлёт `reg.phone.saved`; fallback шлёт `reg.phone.skipped`. Обе ветки
убирают reply-клавиатуру (`reply_markup.remove_keyboard`). Затем общая финализация:
`fn-sign-qr` → `qrcode` → `reg.qr.caption` → best-effort `send_media` → удаление
строки `sessions` (визард завершён).

## Зависимости

- **Subflow'ы**: `fn-find-registration`, `fn-event-card`, `fn-fmt-time`, `fn-t`, `fn-sign-qr`, `fn-parse-start` (вызывается из `tg-router`, не отсюда)
- **Таблицы**: `events` (чтение), `registrations` (чтение и запись), `users` (запись согласий/телефона), `sessions` (чтение и запись состояния визарда)
- **Переменные**: — (косвенно `BOT_USERNAME`, `QR_SIGNING_KEY` — внутри вызываемых subflow'ов)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — все `send_text_message`/`send_media`/`answer_callback_query`/`custom_api_call`

## Известный блокер — доставка QR-изображения не работает через MCP

**Подпись и генерация QR работают и проверены** (`fn-sign-qr` → `@aiqadam/qadam-qrcode`
`text_to_qrcode`), но **шаг отправки картинки участнику падает всегда** —
`send_media`: `"No media defined. Provide either a file or an id."`. Оба финальных
шага (`step_18`, `step_75`) помечены `continueOnFailure: true`, поэтому падение не
рушит остальной диалог — только сама фотография не доезжает.

Проверено на изолированной паре тестовых флоу (см. журнал пакета, docs/work/W05):

1. `send_media.media.photo` (FILE-проп) со значением-URL (строка, `{url, filename}`,
   `{type:'url', value:...}`) — во всех формах **тот же браузер ошибок**: FILE-проп
   либо роняет значение целиком (`"No media defined"`), либо (в `custom_api_call`
   `form_data` с `fieldType: file`) трактует переданную строку как **сырые байты
   файла** (`_valueLength` совпадает с длиной URL-строки, а не с размером PNG) —
   значит подстановка URL «прошлого шага» в FILE-проп через голый JSON не резолвится
   так, как это делает файловый пикер в UI.
2. `custom_api_call` (`/sendPhoto`, `/sendDocument`) с URL от `qrcode`-qadam'а
   (`https://app.flow.aiqadam.org/api/v1/files/...`) — Telegram отвечает
   `"Bad Request: failed to get HTTP URL content"` **и на фото, и на документ**:
   Telegram не может сам скачать этот URL (не проблема content-type конкретно
   для фото — падает одинаково оба метода).

**Открытый вопрос**: не может ли причина быть глубже — недоступность
`app.flow.aiqadam.org` для внешних серверов (не только Telegram) с публичного
интернета в принципе. Достоверно не проверено (агент не может воспроизвести запрос
с серверов Telegram) — см. [Q21](../../docs/OPEN-QUESTIONS.md#q21).

**Что работает уже сейчас** (без картинки): подпись, `payload` для QR (`c<eventId>-<userId>-<sig>`),
текст-подпись (`reg.qr.caption`). Участник получит текстовое сообщение с подписью, но
без самого изображения — сканировать будет нечего, пока блокер не снят.

## Заметки

- **`answer_callback_query` везде `continueOnFailure: true`.** В прогонах через
  `ap_test_flow`/`ap_test_step` с фиктивным `callback_query_id` ack всегда падает
  (`"query is too old..."`) — это артефакт тестирования, не баг; в проде с реальным
  `callback_query_id` в разумном окне он отвечает успешно, но даже если Telegram
  когда-нибудь отклонит ack (просрочка), это не должно ронять реальную бизнес-логику.
- **`sessions` — общая таблица с owner-визардами** (`event_create`/`event_edit`/`broadcast`,
  W11/W14 в будущем): одна активная сессия на `telegram_id`. Если один и тот же
  человек одновременно и owner, и участник (в процессе одного диалога), новая сессия
  перезатирает старую по `find-then-write` — на момент W5 конфликта нет, потому что
  других сценариев ещё не существует; будущему пакету, заводящему второй сценарий,
  придётся решить, может ли быть больше одной активной сессии одновременно.
- **`fn-find-registration` вызывается дважды за happy path** (в ветке `start` для
  проверки IDM-1 и снова в `pdn_yes` для решения «реактивировать/завести») — состояние
  между вызовами не передаётся через `sessions.draft`, потому что дешевле спросить
  таблицу заново, чем тащить `reactivateRecordId` через диалог из чужого прогона.
- **Овербукинг считает `tables-find-records` с `limit 500`**, не `fn-find-registration`
  (тот — для одной пары `(event_id, telegram_id)`, не для агрегатов). Если у ивента
  когда-нибудь будет больше 500 регистраций, лимит надо поднимать вместе с проверкой,
  что выборка не обрезалась — тот же класс ловушки, что и в `fn-t` (лимит 200).
- **`sendVenue` собран через `custom_api_call`**, потому что у `@aiqadam/qadam-telegram-bot`
  нет отдельного action'а (есть только `send_location`, без `title`/`address`) —
  и это тот же самый обходной путь, которым в `i18n-sync` дергали произвольные HTTP.
- Проверено прогонами (самотест в Telegram владельца, `322876545`): `start` (новая
  регистрация, полная цепочка сообщений включая `sendVenue`), `pdn_yes`, `pdn_no`,
  `mkt_yes`, `phone_contact`, `phone_skip`, IDM-1 повторный вход (`existing`), `no_seats`
  (капасити `ceil(2×1.4)=3` при трёх `registered`-строках). Сквозной прогон через
  `tg-router` (`/start emeetup01-...` → классификация → `callFlow registration`)
  подтверждён на живом `PRODUCTION`-прогоне флоу (id `0jD6a3OFxEmP6DQlgRQ8A`).
