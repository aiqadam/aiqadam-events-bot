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
| `eventId`, `utm` | `action = start` | из разбора deep link в `tg-router/step_15` (эталон [`parse-start`](../snippets/parse-start.md), kind `e`) |
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

> Снято `ap_flow_structure` 2026-09-13 после W22. **92 шага**, `callFlow` — ноль.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| step_77 → step_22 → step_79 | CODE + `tables-find-records registrations` + CODE | **одно** чтение всех регистраций ивента (`event_id eq`) кормит двух потребителей: `step_79` отбирает свою строку (эталон [`find-registration`](../snippets/find-registration.md), отбор по `telegram_id` — в коде), `step_7` считает занятость. До W22 это были два отдельных чтения (`step_78` и `step_6`, −0,41 с) |
| step_5 | `tables-find-records events` | ивент по `id`, `limit 1` |
| step_7 | CODE «решение» | `declined` / `existing` / `new` (OWN-15, IDM-1); занятость считается здесь по `status = registered`, а не фильтром запроса |
| step_8 | ROUTER по `outcome` | три ветки |

**`declined`** (step_9 → step_38 → step_82 → step_11 → step_12): `reason` → ключ i18n;
`step_38` — CODE-формат дедлайна ([`fmt-time`](../snippets/fmt-time.md)); `step_82` —
чтение `strings` по пяти ключам отказа; `step_11` — CODE-разрешение **в конверте**
([`i18n-resolve`](../snippets/i18n-resolve.md)); `step_12` — отправка. Регистрация **не создаётся**.

**`existing`** (step_94 → step_13 → step_10 → step_14 → step_15 → step_83 → step_17 → step_16 → step_18):
подпись QR двумя CODE-шагами ([`hmac-qr`](../snippets/hmac-qr.md), `step_13` **в конверте**),
`reg.already` через чтение `strings` + разрешение, отправка, затем батч ключей
приглашения в Mini App и кнопка QR. Второе согласие не спрашивается.

**`new`** (step_96 → step_97 → step_21 → step_99 → step_19 → step_20 → …):
карточка ивента собирается **внутри флоу** ([`event-card`](../snippets/event-card.md)),
`step_96` берёт строку ивента из уже прочитанного `step_5` — отдельного запроса
к `events` больше нет. `step_21` — **одно** чтение `strings` на всю ветку: десять
ключей карточки плюс три ключа согласия на ПД; его разбирают и `step_99` (карточка),
и `step_31` (согласие). До W22 это были два чтения (`step_98` и `step_85`, −0,46 с).
Затем `step_20` отправляет карточку, upsert `sessions`
(`step_26`/`step_27`/`step_28`/`step_29`/`step_30`) и `step_32` задаёт вопрос
о согласии.

**Ветка шлёт два сообщения, а не четыре** ([ADR-0013](../../docs/adr/0013-fewer-messages-on-start.md),
правит OWN-2). Удалены `step_21`-ROUTER «есть venue?», `sendVenue` (`step_22`),
чтение `strings` для `reg.venue.hint` (`step_84`), его разрешение (`step_23`) и
отправка ссылки на карты (`step_24`). Адрес и ссылка остались в тексте карточки
(`event.card.where`, `event.card.map_link`). Экономия — 1,45 с отправок плюс
0,53 с чтения. Имя `step_21` переиспользовано платформой под новое чтение
`strings` — это **другой шаг**, не переименованный ROUTER.

## Ветка `pdn_yes`

`step_33` (ack, `continueOnFailure`) → `step_34` (`users`, **проекция: только
`telegram_id`**) → `step_35` → `step_36` (`consent_pdn = true`) → `step_37`
(`events`) → `step_4`/`step_80`/`step_81` (поиск регистрации) → `step_39` →
ROUTER `step_40`: `step_41` реактивирует либо `step_42` заводит → `step_86`/`step_43`
(батч `reg.done` + рассылка) → `step_44` → `step_45` (`sessions.step = await_marketing`)
→ `step_46` → `step_47`.

## Ветка `pdn_no`

`step_48` (ack) → `step_87` → `step_49` → `step_50` → `step_51` (удалить сессию).
Регистрация не создаётся (PAR-1).

## Ветка `mkt_answer`

`step_52` (ack) → ROUTER `step_53`: `yes` — `step_54` (`users`, **проекция**) →
`step_55` → `step_56` (`consent_marketing = true`) → `step_88`/`step_57` → `step_58`;
`no` — `step_89`/`step_59` → `step_60`, **никакой записи**. После обеих —
`step_61` (`await_phone`), `step_90`/`step_62`, `step_63`.

## Ветка `phone_answer`

ROUTER `step_64`: `contact` — `step_65` (`users`, **проекция**) → `step_66` →
`step_67` (`phone`) → `step_91`/`step_68` → `step_69`; fallback — `step_92`/`step_70`
→ `step_71`. Затем финализация: `step_95`/`step_72` (подпись QR, **в конверте**) →
`step_93`/`step_74`/`step_73` → `step_75` → `step_76` (удалить сессию).

## Зависимости

- **Subflow'ы**: **нет ни одного** (W21, [ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)) —
  девятнадцать `callFlow` заменены встроенными шагами по эталонам [`catalog/snippets/`](../snippets/)
- **Таблицы**: `events` (чтение), `registrations` (чтение и запись), `users` (запись согласий/телефона),
  `sessions` (чтение и запись состояния визарда), `strings` (чтение: **одно на ветку**
  в ветке `start` после W22; в остальных ветках пока по чтению на каждое место перевода —
  см. «Хвосты» в [W22](../../docs/work/W22-latency-and-cleanup.md))
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
  Этот дефект был **замаскирован** [Q29 (снят в W21)](../../docs/OPEN-QUESTIONS.md#q29):
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
-   прохождение `pdn_yes` создаёт новую строку `registrations` вместо поиска
  существующей. Нарушение IDM-1, подтверждено боевым прогоном
  `wOV2cCyvBUZ4eN8NQuoIy`. Подробности и последствия —
  [Q29 (снят в W21)](../../docs/OPEN-QUESTIONS.md#q29). **Не чинилось в W20.**

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
- **Регистрация ищется дважды за happy path** (в ветке `start` для проверки IDM-1
  и снова в `pdn_yes` для решения «реактивировать/завести») — состояние между
  вызовами не передаётся через `sessions.draft`, потому что дешевле спросить
  таблицу заново, чем тащить `reactivateRecordId` через диалог из чужого прогона.
- **Овербукинг и поиск своей регистрации в ветке `start` — одно чтение** (W22):
  `step_22` берёт все строки ивента (`event_id eq`, без `limit`), `step_79`
  отбирает свою пару в коде, `step_7` считает `registered`. Раньше это были два
  запроса, второй — с `limit 500`. **Лимита теперь нет вовсе**, так что ловушка
  «выборка молча обрезалась» здесь закрыта; взамен появилась другая — на очень
  большом ивенте в лог прогона уедут все строки регистраций
  ([Q17](../../docs/OPEN-QUESTIONS.md#q17)). В ветке `pdn_yes` (`step_80`) чтение
  осталось узким, по двум `eq`.
- **`sendVenue` удалён в W22** ([ADR-0013](../../docs/adr/0013-fewer-messages-on-start.md)).
  Заметка ниже сохранена на случай возврата пина: он был собран через
  `custom_api_call`, потому что у `@aiqadam/qadam-telegram-bot`
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
  **Поправка 2026-09-12 (повторное ревью):** здесь стояло «не тронут
  `tg-router → registration` — inline не применим к вызову, результат которого
  никто не ждёт». В живом флоу у `tg-router/step_18` и `step_20` стоит
  **`inline`**; утверждение устарело и было неверным на момент чтения. После публикации прогон `fGqdXXeslOT5TAtbW53TR` (TESTING, `/start`,
  новая регистрация, ветка `new`) дал 17,1 с против эталона 34,2 с
  (`JYWkDu2jBXX9BDd3kHna3`, ADR-0009) — почти двукратное ускорение, «пауза»
  упала с ≈26,4 с до ≈0,2 с. Подробности — [W17](../../docs/work/W17-inline-callflow.md).
- **Приглашение в Mini App перепроверено отдельно, после перехода на ADR-0007**:
  `existing`-ветка (изолированная фикстура `events`+`registrations`) и
  `phone_answer`-финализация (фикстура `sessions.step = await_phone`) — оба
  реальных ответа Telegram Bot API показывают корректный `reply_markup.inline_keyboard`
  с `web_app.url = "https://miniapp.events.aiqadam.org/ticket.html?event_id=<eventId>"`.
  Все тестовые фикстуры удалены после проверки.

- **2026-09-12 (по ревью W21/W19) — исправлено в каталоге и во флоу:**
  - раздел шагов переписан по живой структуре: раньше он описывал `callFlow`,
    которых в проекте нет, и не упоминал 22 шага из 100;
  - **три чтения `users` без проекции колонок** (`step_34`, `step_54`, `step_65`)
    сужены до одной колонки `telegram_id`. Их потребителям нужен только
    `rows[0].id`, а в лог прогона уезжала строка целиком — включая `phone`.
    Это наследство W5, не замеченное аудитом W19 («все шесть» на деле было девять);
  - [Q29](../../docs/OPEN-QUESTIONS.md#q29) снят: вход поиска регистрации в ветке
    `pdn_yes` больше не приходит из `callFlow` и не бывает пустым.
