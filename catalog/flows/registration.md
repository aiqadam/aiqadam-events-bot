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
`reg.already` (`{title}`) → `send_text_message` → приглашение в Mini App за QR
(см. «Выдача QR» ниже). Второе согласие не спрашивается.

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
`fn-sign-qr` → приглашение в Mini App за QR (см. «Выдача QR» ниже) → удаление
строки `sessions` (визард завершён).

## Зависимости

- **Subflow'ы**: `fn-find-registration`, `fn-event-card`, `fn-fmt-time`, `fn-t`, `fn-sign-qr`, `fn-parse-start` (вызывается из `tg-router`, не отсюда)
- **Таблицы**: `events` (чтение), `registrations` (чтение и запись), `users` (запись согласий/телефона), `sessions` (чтение и запись состояния визарда)
- **Переменные**: `MINIAPP_URL` (кнопка Mini App); косвенно `BOT_USERNAME`, `QR_SIGNING_KEY` — внутри вызываемых subflow'ов
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — все `send_text_message`/`answer_callback_query`/`custom_api_call`

## Выдача QR — через Mini App, не файлом (ADR-0007)

Первая версия пакета пыталась сгенерировать картинку `@aiqadam/qadam-qrcode` и
отправить её `send_media`/`custom_api_call` — не заработало ни в одной форме
(FILE-пропы не резолвятся через MCP ни на одном qadam'е, ни с одним получателем,
см. [Q21](../../docs/OPEN-QUESTIONS.md#q21)). Решение —
[ADR-0007](../../docs/adr/0007-qr-rendered-in-miniapp.md): QR не отправляется
файлом вовсе, шаги `text_to_qrcode`/`send_media` из обеих веток (`existing`,
`phone_answer`-финализация) удалены.

Вместо этого оба финальных шага (`step_18` в `existing`, `step_75` в финализации
`phone_answer`) шлют `send_text_message` с `reply_markup.inline_keyboard` —
одна кнопка типа `web_app`, ведущая на
`{{variables['MINIAPP_URL']}}ticket.html?event_id=<eventId>`. `eventId` берётся
из собственного вывода `fn-sign-qr` того же шага (`step_13`/`step_72`), не
требует отдельного чтения. Страница `miniapp/ticket.html` при открытии берёт
`Telegram.WebApp.initData`, зовёт синхронный вебхук `my-qr-api`
([catalog/flows/my-qr-api.md](my-qr-api.md)) и рисует QR клиентским JS
(`miniapp/vendor/qrcode.min.js`, MIT, davidshimjs/qrcodejs) из полученного
`payload` — без единого байта файла, летящего через сам `registration`.

Тексты кнопки и приглашения — новые ключи i18n `reg.qr.button`/`reg.qr.open_miniapp`
(добавлены этим пакетом в `i18n/*.json`; до прогона `i18n-sync` **после мержа**
`fn-t` вернёт сам ключ вместо перевода — это ожидаемо, не баг флоу, см. журнал
пакета).

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
- **Приглашение в Mini App перепроверено отдельно, после перехода на ADR-0007**:
  `existing`-ветка (изолированная фикстура `events`+`registrations`) и
  `phone_answer`-финализация (фикстура `sessions.step = await_phone`) — оба
  реальных ответа Telegram Bot API показывают корректный `reply_markup.inline_keyboard`
  с `web_app.url = "https://miniapp.events.aiqadam.org/ticket.html?event_id=<eventId>"`.
  Все тестовые фикстуры удалены после проверки.
