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

- **Subflow'ы**: **нет ни одного** (W21, [ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)) —
  девятнадцать `callFlow` заменены встроенными шагами по эталонам [`catalog/snippets/`](../snippets/)
- **Таблицы**: `events` (чтение), `registrations` (чтение и запись), `users` (запись согласий/телефона),
  `sessions` (чтение и запись состояния визарда), `strings` (чтение: по запросу на каждое место перевода)
- **Переменные**: `MINIAPP_URL` (кнопка Mini App), `BOT_USERNAME` (`step_96`, deep link карточки),
  `QR_SIGNING_KEY` (`step_13`, `step_72`) — все в длинной форме `{{variables['NAME']}}`
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

- **W21 (2026-09-12) — девятнадцать `callFlow` убраны, subflow'ов не осталось.**
  77 → 100 шагов. Заменено: два `fn-find-registration` (`start` и `pdn_yes`),
  два `fn-sign-qr` (`existing` и `finalize`), два `fn-fmt-time` (дедлайн отказа и
  батч карточки), одиннадцать `fn-t` и `fn-event-card`.
  - **Карточка ивента не читает `events` повторно.** `fn-event-card` делал свой
    запрос; встроенная версия (`step_96`) берёт строку из уже прочитанного
    `step_5`. Минус один запрос на каждой регистрации.
  - **Чтений `strings` тринадцать, по одному на место перевода.** Свести их в одно
    здесь нельзя: места разнесены по шести веткам ROUTER'а `step_2`, и общий
    запрос пришлось бы ставить до ветвления — то есть выполнять на каждом входе
    ради ветки, которая в этом прогоне не исполнится.
- **Конверт `{status, data}` у встроенных шагов — вынужденный костыль
  ([#411](https://github.com/aiqadam/qadam-flow/issues/411)).** Шаги
  `@aiqadam/qadam-telegram-bot` не редактируются (проверено 2026-09-12:
  `ap_update_step` по `step_12` отвечает `qadam_metadata_not_found`), а их ссылки
  написаны на `{{<шаг>['output'].data.text}}`. Поэтому каждая замена обязана
  1) встать **под именем удалённого шага** и 2) повторить форму ответа `callFlow`.
  Платформа выдаёт свободное имя с наименьшим номером — отсюда порядок операций:
  добавить чтение `strings` → удалить `callFlow` → добавить CODE.
  Когда #411 починят, конверт снимается, а ссылки правятся на `['output'].text`.
- **Дефект, найденный прогоном: реактивация отменённой регистрации падала.**
  `step_41` писал в `cancelled_at` значение, которое `tables-update-record`
  больше не принимает: `Invalid date for field "cancelled_at"` (прогон
  `nk7ET4kibX4N2YWUqJqtX`). Шаг пересоздан без `cancelled_at`.
  **Цена решения названа прямо:** у реактивированной строки `cancelled_at`
  остаётся от прошлой отмены. Очистить его штатно нечем — пустая строка теперь
  отвергается валидатором дат, а «оставить пустым» у пропа `values` означает
  «не менять». Потребители обязаны смотреть на `status`, а не на `cancelled_at`;
  см. [Q30](../../docs/OPEN-QUESTIONS.md#q30).
  Этот дефект был **замаскирован** [Q29](../../docs/OPEN-QUESTIONS.md#q29):
  пока `step_38` получал пустой вход, ветка реактивации не исполнялась вовсе.
- **Как проверялось перед публикацией (W21).** Полный проход визарда на живом
  боте (dev), все сообщения дошли. Регистрация участника временно переведена в
  `cancelled`, чтобы поднять ветку `new`, и восстановлена самим флоу.

  | Ветка | Прогон | Результат | Время |
  |---|---|---|---|
  | `existing` | `uE2pnEBzKglCe6FNtUddk` | `reg.already` + приглашение в Mini App | 4,9 с |
  | `new` | `uAT9OxBNwIeJM7G70qTz7` | карточка + venue + сессия + согласие на ПД | 8,4 с |
  | `pdn_yes` | `xMpWPMRnyoslhD1mssDWx` | регистрация реактивирована, `reg.done`, вопрос о рассылке | 6,4 с |
  | `mkt_no` | `pdwSpdrGh6i5lZD9Dc6Ab` | `saved_no` + вопрос о телефоне | 4,2 с |
  | `phone_skip` | `Dzl5lD3a9U82399pCHhGs` | `skipped` + подпись QR + приглашение + сессия удалена | 4,1 с |

  - **Подпись сошлась с двумя другими флоу.** `registration/step_72` выдал
    `aIxmwbnzb_` — то же, что `my-qr-api/step_24` и что принял `checkin-api/step_38`.
    Три независимые встроенные копии HMAC, одно значение.
  - **`step_33`/`step_52` (ack callback) падали во всех прогонах** —
    `callback_query_id` синтетический, Telegram его не знает. У шагов стоит
    `continueOnFailure`, обработка шла дальше; в бою id настоящий.
  - **Не прогнаны:** ветка `declined` (`step_11`/`step_38`), `pdn_no` (`step_49`),
    `mkt_yes` (`step_57`) и `phone_contact` (`step_68`). Каждая — близнец
    прогнанной ветки по устройству, но это рассуждение, а не проверка.

- **Второй вызов `fn-t` в трёх ветках заменён CODE-шагом** (12.09.2026, W20,
  [Q28](../../docs/OPEN-QUESTIONS.md#q28)): `step_16` (existing), `step_73`
  (finalize), `step_46` (pdn_yes). Первый вызов в паре забирает все ключи
  батчем, CODE-шаг достаёт свой ключ и **повторяет форму ответа `fn-t` один
  в один** — именно поэтому шаги отправки ниже не пришлось трогать (они и не
  редактируются, [#411](https://github.com/aiqadam/qadam-flow/issues/411)).
  Экономия ~2 с на ветку: вызов subflow стоит 1,2–1,9 с даже inline, CODE-шаг —
  0,1 с. **Правя эти шаги, сохраняйте форму ответа**, иначе сломается шаг
  отправки, а не сам перевод.
- ⚠️ **`step_38` получает пустой вход** — реактивация не работает, каждое
  прохождение `pdn_yes` создаёт новую строку `registrations` вместо поиска
  существующей. Нарушение IDM-1, подтверждено боевым прогоном
  `wOV2cCyvBUZ4eN8NQuoIy`. Подробности и последствия —
  [Q29](../../docs/OPEN-QUESTIONS.md#q29). **Не чинилось в W20.**

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
- **W17 (2026-09-11) — все синхронные `callFlow` переведены на
  `executionMode: "inline"`** ([qadam-flow#363](https://github.com/aiqadam/qadam-flow/issues/363),
  раскатано на инстансе): `step_4`, `step_10`, `step_11`, `step_13`, `step_14`,
  `step_16`, `step_17`, `step_19` (`fn-event-card`, сам получил inline своих
  вложенных вызовов — см. `fn-event-card.md`), `step_23`, `step_31`, `step_38`,
  `step_43`, `step_46`, `step_49`, `step_57`, `step_59`, `step_62`, `step_68`,
  `step_70`, `step_72`, `step_73`, `step_74` — 22 шага во всех ветках визарда.
  **Не тронут** `tg-router → registration` (`waitForResponse: false`,
  fire-and-forget) — inline не применим к вызову, результат которого никто не
  ждёт. После публикации прогон `fGqdXXeslOT5TAtbW53TR` (TESTING, `/start`,
  новая регистрация, ветка `new`) дал 17,1 с против эталона 34,2 с
  (`JYWkDu2jBXX9BDd3kHna3`, ADR-0009) — почти двукратное ускорение, «пауза»
  упала с ≈26,4 с до ≈0,2 с. Подробности — [W17](../../docs/work/W17-inline-callflow.md).
- **Приглашение в Mini App перепроверено отдельно, после перехода на ADR-0007**:
  `existing`-ветка (изолированная фикстура `events`+`registrations`) и
  `phone_answer`-финализация (фикстура `sessions.step = await_phone`) — оба
  реальных ответа Telegram Bot API показывают корректный `reply_markup.inline_keyboard`
  с `web_app.url = "https://miniapp.events.aiqadam.org/ticket.html?event_id=<eventId>"`.
  Все тестовые фикстуры удалены после проверки.
