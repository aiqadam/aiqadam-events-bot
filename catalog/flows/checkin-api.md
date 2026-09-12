# Flow: checkin-api

> **W24 (2026-09-13): локализация снята, только русский.**
> [ADR-0014](../../docs/adr/0014-russian-only-until-platform-i18n.md). Чтения
> таблицы `strings` удалены, тексты пришли во вход CODE-шагов, которые их
> формируют — эталон [`ru-texts`](../snippets/ru-texts.md). Форма ответа этих
> шагов не изменилась ни на байт, поэтому шаги отправки не трогались.
> Ушли `step_8` и `step_45` (чтения `strings`), а также `step_28` (чтение
> `users` ради языка контролёра — удалено по замечанию ревью W24, в
> `my-qr-api` эквивалент был снят сразу). Флоу **46 → 43 шага**.
> Ниже по тексту упоминания `strings`, `i18n-resolve` и «перевода» относятся к
> состоянию **до** этой даты и сохранены как история.

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

`text` собирается **внутри флоу** из таблицы `strings` (с W21 — без `fn-t`) по ключам
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
| step_34 | CODE «parse initData» | разбор `initData`, `data_check_string` | `{{step_1['output'].initData}}` |
| step_35 | CODE «hmac initData (эталон)» | HMAC-цепочка Telegram, `node:crypto` | `{{variables['BOT_TOKEN']}}`, `{{step_34['output'].dataCheckString}}` · эталон [`hmac-init-data`](../snippets/hmac-init-data.md) |
| step_36 | CODE «verify initData» | constant-time сравнение + свежесть | `expected` = `{{step_35['output']}}`, `maxAgeSeconds: 86400` |
| step_3 | CODE «combine auth» | `initDataValid`, `staffTelegramId` (сентинел `-`), `reason` | `{{step_36['output']}}` |
| step_4 | ROUTER «initData valid?» | `valid` (branch 0) / `Otherwise` (branch 1 → `401`) | `{{step_3['output'].initDataValid}}` |
| step_46 (branch 1) | CODE «текст 401 (ru)» | `checkin.unauthorized` из входа `texts` | эталон [`ru-texts`](../snippets/ru-texts.md) |
| step_24/25 (branch 1) | CODE + `return_response` | тело `invalid_init_data` (+`text`), статус `401` | `{{step_46['output'].text}}` |
| step_5 (branch 0) | `tables-find-records event_staff` | `(event_id, telegram_id контролёра, revoked_at not_exists)` | `table_id = CyW6KjJ2BdwQEph2KEqTt` |
| step_6 | CODE «decide isStaff (постфильтр STF-2, W18)» | **постфильтр прав**: среди выдачи должна быть строка с `event_id` запроса + `telegram_id` контролёра + пустым `revoked_at`. Ключи проверяются **на форму** (`^[A-Za-z0-9_]{1,12}$` / `^[0-9]{1,16}$`), поэтому пустое значение и сентинел `-` правами не становятся (fail-closed). Диагностика `rowsRead`/`rowsMatched`/`keysOk`. `staffLang` — константа `'ru'`, чтение `users` ради языка удалено в W24 | `{{step_5['output']}}`, `{{step_1['output'].eventId}}`, `{{step_1['output'].eventIdValid}}`, `{{step_3['output'].staffTelegramId}}`, `{{step_3['output'].initDataValid}}` |
| step_7 | ROUTER «isStaff?» | `isStaff` (branch 0) / `Otherwise` (branch 1 → `403`) | `{{step_6['output'].isStaff}}` |
| step_44 (branch 1) | CODE «текст 403 (ru)» | `checkin.forbidden` из входа `texts` | эталон [`ru-texts`](../snippets/ru-texts.md) |
| step_26/27 (branch 1) | CODE + `return_response` | тело `forbidden` (+`text`), статус `403` | `{{step_44['output'].text}}` |
| step_2 (branch 0) | CODE «parse QR payload (эталон)» | разбор `payload` (`kind` ожидается `c`) | `{{step_1['output'].payload}}` · эталон [`parse-start`](../snippets/parse-start.md) |
| step_37 | CODE «normalize QR keys» | валидация формы, сентинелы `x`/`0` | `{{step_2['output'].*}}` |
| step_38 | CODE «hmac QR (эталон)» | подпись `c:<eventId>:<userId>`, base64url, первые 10 | `{{variables['QR_SIGNING_KEY']}}` · эталон [`hmac-qr`](../snippets/hmac-qr.md) |
| step_39 | CODE «verify QR signature» | constant-time сравнение подписи | `{{step_37['output'].sig}}`, `{{step_38['output']}}` |
| step_40 | CODE «normalize registration keys» | сентинел `-` вместо пустого фильтра | `{{step_1['output'].eventId}}`, `{{step_2['output'].userId}}` |
| step_41 | `tables-find-records registrations` | два `eq`, **без `limit`** (часть инварианта) | `table_id = PNuChoFG0tIBTND86yzDL` |
| step_42 | CODE «pick earliest registration (ADR-0003)» | каноническая строка + самый ранний чекин | `{{step_41['output']}}` |
| step_11 | CODE «decide checkin outcome» | приоритет: `invalid` → `wrong_event` → `invalid` → `not_registered` → `already` → `ok` | `{{step_2}}`/`{{step_39}}`/`{{step_42}}`, `requestEventId` из step_1 |
| step_12 | `tables-find-records users` | имя участника по `telegram_id` из QR; **проекция колонок**: `first_name`, `last_name` | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_13 | CODE «build participant name» | `first_name + last_name` | `{{step_12['output']}}` |
| step_14 | ROUTER «outcome?» | `ok` (0) / `already` (1) / `Otherwise` (2) | `{{step_11['output'].outcome}}` |
| step_9 (branch `ok`) | CODE «тексты ok (ru)» | `checkin.ok`, `checkin.name_unknown` из входа `texts` | эталон [`ru-texts`](../snippets/ru-texts.md) |
| step_16→step_15 (branch `ok`) | CODE «stamp now» + `tables-update-record` с **`only_if` `checked_in_at not_exists`** (CAS, IDM-2) | `continueOnFailure: true`: проигрыш гонки — это `RECORD_PRECONDITION_FAILED`, а не сбой | `table_id = PNuChoFG0tIBTND86yzDL` |
| step_19→step_29 (branch `ok`) | `tables-find-records registrations` + CODE «pick earliest» | перечитать строку после записи — нужно, чтобы отдать **чужое** время при проигрыше | — |
| step_30→step_31 (branch `ok`) | CODE fmt + CODE «тексты already (ru)» | текст на случай проигрыша гонки | эталоны [`fmt-time`](../snippets/fmt-time.md), [`ru-texts`](../snippets/ru-texts.md) |
| step_17/18 (branch `ok`) | CODE + `return_response` | тело `ok` **или** `already` — решает по результату CAS; любая **другая** ошибка записи роняет прогон, а не отвечает `ok` | `{{step_15['error'].message}}`, `{{step_29}}`, `{{step_30}}`, `{{step_31}}` |
| step_47 (branch `already`) | CODE «format checked_in_at (эталон)» | `Intl` → `Asia/Tashkent`, `format: time` | `{{step_11['output'].checkedInAt}}` · эталон [`fmt-time`](../snippets/fmt-time.md) |
| step_10 (branch `already`) | CODE «текст already (ru)» | `checkin.already` из входа `texts` | эталон [`ru-texts`](../snippets/ru-texts.md) |
| step_20/21 (branch `already`) | CODE + `return_response` | тело `already` (+`text` с `{time}` = `checkedInAtTashkent`), статус `200` | `{{step_10['output']}}`, `{{step_47['output']}}` |
| step_43 (branch `Otherwise`) | CODE «тексты прочих исходов (ru)» | `checkin.wrong_event`, `checkin.invalid`, `checkin.not_registered` из входа `texts` | эталон [`ru-texts`](../snippets/ru-texts.md) |
| step_22/23 (branch `Otherwise`) | CODE + `return_response` | тело `wrong_event`/`invalid`/`not_registered` (+`text` по `outcome`), статус `200` | `{{step_43['output']}}`, `{{step_11['output'].outcome}}` |
## Зависимости

- **Subflow'ы**: **нет ни одного** (W21, [ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)) —
  флоу end-to-end, вся переиспользуемая логика встроена CODE-шагами по эталонам
  [`catalog/snippets/`](../snippets/)
- **Таблицы**: `event_staff` (чтение), `users` (чтение: **только имя участника**, `step_12`),
  `registrations` (чтение `step_41` + запись `checked_in_at`/`checked_in_by` в `step_15`).
  **`strings` не читается вовсе** с W24; чтение `users` ради языка контролёра удалено там же
- **Переменные**: `BOT_TOKEN` (`step_35`), `QR_SIGNING_KEY` (`step_38`) — обе в длинной форме `{{variables['NAME']}}`
- **Connections**: —

## Заметки

- **W21 (2026-09-12) — subflow'ов не осталось ни одного.** Десять `callFlow`
  заменены встроенными шагами ([ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)):
  `fn-verify-init-data` → `step_34`/`step_35`/`step_36`, `fn-parse-start` → `step_2`,
  `fn-verify-qr` → `step_37`/`step_38`/`step_39`, `fn-find-registration` →
  `step_40`/`step_41`/`step_42`, `fn-fmt-time` → `step_47`, пять вызовов `fn-t` →
  два чтения `strings` (`step_8`, `step_45`) плюс по одному CODE-шагу разрешения
  на ветку. 34 → 42 шага, после W20 — 46, вызовов на горячем пути — ноль.
  - **Пять вызовов `fn-t` стали двумя чтениями таблицы, а не пятью.** Ключи
    каждой ветки известны на этапе сборки, поэтому `step_8` читает объединение
    ключей всех веток после аутентификации одним запросом `in`, а ветки лишь
    разрешают язык из уже загруженной выборки. Отдельное чтение нужно только
    ветке `401`: она исполняется **до** того, как известен пользователь.
  - **Нормализации ключей (шаг `step_1` у `fn-t`) больше нет** — она превращала
    рантайм-вход в список для фильтра `in`; здесь список статический. Вместе с
    ней исчезла и её причина: сентинел `!no-key` на пустой список.
  - **`limit` у `step_8`/`step_45` не задан намеренно.** У `fn-t` стоял `limit 200`,
    и переполнение обрезало бы выборку **молча**. Здесь потолок не нужен: число
    строк ограничено списком ключей (7 × 3 языка = 21).
  - **Имена шагов переиспользуются платформой.** Удалённый `step_2` (`fn-verify-init-data`)
    и добавленный следом CODE-шаг разбора QR получили **одно и то же имя** `step_2`;
    то же с `step_8`/`step_9`/`step_10`. Ссылки вниз по флоу это переживают только
    потому, что потребители были переписаны до удаления. Порядок «добавить новое →
    перевести потребителей → удалить старое» здесь не стилистика, а условие
    корректности.
- **Как проверялось перед публикацией (W21, 2026-09-12).** `initData` синтезировать
  нельзя ([Q16](../../docs/OPEN-QUESTIONS.md#q16)), поэтому ветки за `step_4`
  прогонялись при **временно замкнутом** сравнении в черновике
  (`step_36.expected` ← `{{step_34['output'].hash}}`). Замыкание снято сразу после
  прогонов, возврат подтверждён двумя способами: чтением входа шага
  (`ap_read_step_code`) и **различающим прогоном** — тот же вход, что проходил при
  замыкании, дал `401 bad_hash` (прогон `uOOB7nJJ3NzprUuAFt80V`). Публикация — после
  возврата. Прогоны (все `SUCCEEDED`, окружение `TESTING`):

  | Исход | Прогон | Ответ | Время |
  |---|---|---|---|
  | `401` мусорная `initData` | `xyVclYSqIhFHUK4dBnMBG` | `401 invalid_init_data` | 1,5 с |
  | `403` не-контролёр (`111222333`) | `E3pRNLxnrPkq0ormitDce` | `403 forbidden`, `step_5` → `[]` | 2,6 с |
  | `403` контролёр **чужого** ивента (`other1`) | `mKJvvnpkq2Fiqo8sr58ix` | `403 forbidden`, `step_5` → `[]` | 2,4 с |
  | `invalid` подпись не сошлась | `5SWdjE4vgobq4DJlXCCM3` | `200 invalid` | 3,6 с |
  | `already` (IDM-2) | `G05GjI12dsGeWssBAwAAt` | `200 already`, `19:41` | 3,7 с |
  | `ok` (запись чекина) | `07uT6MP3yOpwQ9xhNCCBn` | `200 ok`, записан `checked_in_at` | 5,9 с |

  - **STF-2 закрыт двумя различающими прогонами плюс позитивным контролем**:
    не-контролёр → `403`; контролёр `demo`, сканирующий `other1` → `403` (значит
    `event_id` действительно в фильтре, а не «staff вообще где-то»); тот же
    контролёр на `demo` → прошёл дальше. `step_5` в обоих отказах вернул `[]` —
    fail-open из [#382](https://github.com/aiqadam/qadam-flow/issues/382) не
    воспроизводится.
  - **IDM-2 подтверждён впервые на живых данных**: `checked_in_at` = `14:41:46Z`
    показан как `19:41` Ташкента (UTC+5, OWN-3) и **не перезаписан**.
  - **Подпись QR проверена сквозным сценарием**: подпись для `(demo, 322876545)`
    снята из `step_38` и подставлена на вход — `step_39` принял её, подделанная
    (`AAAAAAAAAA`) отклонена. Это тот самый тест на дрейф копий крипты, ради
    которого ADR-0012 принимает риск дублирования; **между** флоу он ещё не
    прогонялся (нужен QR, подписанный в `registration`).
  - **Цена прогона ветки `ok`**: `checked_in_at` у единственной строки
    `registrations` был очищен перед прогоном и записан обратно самим флоу
    (`15:09:04Z`). Фикстур не заводилось, мусора не осталось.
- **`ap_validate_flow` сообщает о `{{variables...}}` как о несуществующей ссылке —
  это дефект валидатора, не флоу.** То же сообщение даёт живой рабочий
  `fn-verify-init-data`. Проверено 2026-09-12; на публикацию не влияет.

- **Текст исхода собирается на сервере (Q19, W7), и он всегда русский.**
  С W24 ([ADR-0014](../../docs/adr/0014-russian-only-until-platform-i18n.md))
  выбора языка нет: каждая терминальная ветка берёт свой текст из входа
  `texts` своего CODE-шага (эталон [`ru-texts`](../snippets/ru-texts.md)),
  `step_17`/`step_20`/`step_22` вставляют `{name}`/`{time}` в шаблон.
  Прежняя схема — `step_28`/`step_6` резолвили `users.lang` контролёра до
  маршрутизации исходов — снята вместе с шагом `step_28`. Поле `staffLang` в
  `step_6` осталось константой `'ru'`: на него ссылается неиспользуемый вход
  `lang` у шагов текстов, и сносить его отдельно смысла нет.
  Страница сканера словарь исходов **не держит** — показывает серверный `text`.
- **IDM-2 обеспечивается CAS (W20, 2026-09-12), а не только порядком шагов.**
  `step_15` пишет чекин с `only_if` «`checked_in_at` ещё пуст»
  ([ADR-0011](../../docs/adr/0011-idempotency-on-atomic-primitives.md)). Проигравший
  гонку получает `409 RECORD_PRECONDITION_FAILED`, и `step_17` отдаёт `already`
  с **чужим, исходным** временем — для этого строка перечитывается (`step_19`/`step_29`).
  - **Цена названа прямо:** перечитывание выполняется **всегда** на ветке `ok`,
    а не только при проигрыше, — примерно +0,4 с к успешному чекину. Router ради
    экономии этих 0,4 с потребовал бы переносить шаги ответа внутрь ветки, а
    `continueOnFailure` веток не создаёт: шаги ниже исполняются в обоих случаях.
  - **Не любая ошибка записи означает «уже отмечен».** `step_17` проверяет код
    ошибки и при любой другой **бросает исключение**: ответить `ok` на неудавшуюся
    запись значит соврать контролёру, что участник отмечен.
  - **Различающий прогон** `QsPQJcVcwUDVVQ9cVmT7d`: временный шаг записал чекин
    между чтением и записью (имитация второго контролёра, `10:00Z`), CAS получил
    409, ответ — `already` в `15:00` Ташкента, то есть **время победителя**, не наше.
    Позитивный контроль `PIM2m7AfPKtPFl9Lw70Gk`: на пустом поле запись прошла, ответ `ok`.
    Временный шаг удалён сразу после.

- **Прежняя формулировка (до W20), сохранена как история:** IDM-2 обеспечивался
  на уровне решения, а не CAS-примитива. `outcome = 'already'`
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
  которые можно случайно пропустить, нет: обе проверки подписи (разбор payload —
  `step_2`, HMAC QR — `step_37`/`step_38`/`step_39`) и оба чтения
  (`event_staff` — `step_5`, `registrations` — `step_41`/`step_42`) выполняются
  всегда, решение принимает один CODE-шаг.
- **Права контролёра проверяются дважды: фильтром чтения и постфильтром в коде.**
  `step_5` фильтрует `event_staff` по `(event_id, telegram_id, revoked_at
  not_exists)` — все три члена всегда вместе, ровно то требование STF-2, которое
  чаще всего теряют. `step_6` **повторяет тот же отбор по полям записи**, а не
  довольствуется непустотой выдачи.
  **История утверждения (важно, чтобы не откатили).** До W18 здесь стояло, что
  «пользователь вообще где-то staff» получить физически невозможно, потому что
  `event_id` — член фильтра, а не постфильтр в коде. Это утверждение было
  **неверным** с момента [qadam-flow#382](https://github.com/aiqadam/qadam-flow/issues/382):
  если форма `filters` переставала распознаваться, `tables-find-records` молча
  возвращал **все** строки таблицы, и `isStaff = records.length > 0` давало
  `true` любому пользователю с валидным `initData` — инвариант №1 из CLAUDE.md,
  «участник отметит соседа». Правка 2026-09-11 сняла ложную гарантию, но дыру
  не закрыла: постфильтра всё ещё не было.
  **С W18 (2026-09-13) постфильтр есть.** Апстрим #382 закрыт
  (`6b4d5a0839`), но постфильтр остаётся как defense-in-depth: авторизация не
  должна держаться на неизменности недокументированной формы DYNAMIC-пропа.
  Гарантию даёт теперь **код шага**, а не форма фильтра — и это доказано
  прогоном, в котором `step_6` намеренно скормили всю таблицу (см. «Как
  проверено», W18). См. [Q25](../../docs/OPEN-QUESTIONS.md#q25).
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

- **2026-09-12 (по ревью W21) — исправлен регресс, внесённый W21.** `step_12`
  (`find participant user`) фильтровал `users` по `{{step_8['output'].data.userId}}` —
  ссылка осталась от удалённого `callFlow → fn-verify-qr`, а `step_8` после W21
  стал чтением `strings`. Имя участника **не резолвилось никогда**: все прогоны
  зелёные, контролёр всегда видел «участник без имени». Это ровно та тихая
  деградация, которой ADR-0012 «не создаёт» — и она возникла из-за
  **переиспользования освободившегося имени шага**.
  Источник исправлен на `{{step_11['output'].userId}}`, шаг пересоздан с
  проекцией колонок. Доказано прогоном `HaTnsrmVy3y5YssvtBFE3`:
  `step_13.name` = `Binali Rustamov` вместо пустой строки.
  **Урок:** при удалении шага надо проверять не только тех потребителей, которых
  переписываешь, но и всех, кто ссылается на удаляемое имя. `ap_validate_flow`
  этого не ловит — ссылка формально валидна, просто указывает на другой шаг.

## Изменения W22 (2026-09-13)

Тела шагов не менялись, кроме одного: CODE-шаг эталона
[`find-registration`](../snippets/find-registration.md) получил **отбор строк
по паре `(event_id, telegram_id)` прямо в коде**, а не только в фильтре чтения.
Это часть общей правки эталона (все копии обновлены одним текстом) и имеет
двойной смысл: латентность (одно широкое чтение может кормить нескольких
потребителей) и страховка от fail-open платформы
([#382](https://github.com/aiqadam/qadam-flow/issues/382),
[Q25](../../docs/OPEN-QUESTIONS.md#q25)) — выпавший фильтр чтения больше не
превращается в выдачу чужой строки.

Здесь читающие фильтры остались **узкими** (два `eq`), поэтому поведение шага
не изменилось: отбор в коде отбрасывает ноль строк. Затронутые шаги:
`step_42` (основной путь) и `step_29` (перечитывание после CAS).

## Изменения W18 (2026-09-13)

**Постфильтр прав контролёра в `step_6`** — закрытие пункта 1
[Q25](../../docs/OPEN-QUESTIONS.md#q25). Единственный изменённый шаг: `step_6`,
тип CODE. `step_5` (`tables-find-records event_staff`) **не трогался** — в том
числе потому, что MCP не отдаёт его `settings.input`, и восстановить фильтр
после правки владелец пакета не смог бы.

Было: `isStaff = records.length > 0`.
Стало: среди записей ищется строка с `event_id` **запроса** (`step_1`),
`telegram_id` **контролёра** (`step_3`, только из проверенного `initData`) и
пустым `revoked_at`. Без `eventIdValid`/`initDataValid` или с пустым ключом —
отказ, не выдача (fail-closed). Наружу добавлены `rowsRead`/`rowsMatched`:
расхождение между ними означает, что фильтр чтения отработал шире, чем должен.

### Как доказано, что постфильтр работает

Три различающих прогона STF-2 и позитивный контроль проходят и на **старом**
коде — сами по себе они правку не доказывают. Поэтому сделан отдельный
**дифференцирующий прогон**: в `step_6` временно подставлен литеральный вход
`records` со **всеми пятью** строками `event_staff` — ровно то, что отдавал бы
`tables-find-records` при снятом фильтре (#382). Флоу опубликован с этим
входом, прогоны выполнены, вход возвращён на `{{step_5['output']}}`, флоу
опубликован снова.

| Сценарий (fail-open, `rowsRead: 5`) | Прогон | Итог |
|---|---|---|
| не контролёр вовсе (`700000774`) | `OifLDzW11SoSVAXP283Wf` | `403`, `rowsMatched: 0` |
| контролёр **чужого** ивента (`700000772`, `othr09`) | `EYGUsoCzQ1E0cNaTbC7YY` | `403` |
| **отозванный** контролёр `demo` (`700000773`) | `IkGi3yYXxpUEiUm7TTUw7` | `403` |
| настоящий контролёр `demo` (`700000771`) | `N4NvnjwiJ3hC3583oOtTM` | `200 already` |

На старом коде все четыре дали бы `isStaff: true` — список непуст во всех
четырёх. В прогоне `OifLDzW11SoSVAXP283Wf` видно и то, что настоящий `step_5`
при этом вернул `[]`: фильтр чтения исправен, отказ дал именно постфильтр.

### Прогоны на восстановленной опубликованной версии

`event_staff` — три временные фикстуры (`700000771` staff `demo`, `700000772`
staff `othr09`, `700000773` staff `demo` с заполненным `revoked_at`), удалены
сразу после прогонов; `700000774` строки не имел вовсе. `initData` подписан
настоящим `BOT_TOKEN` приёмом W8 (дать шагу заведомо неверный `hash`, забрать
эталон из вывода `step_35`, подставить обратно).

| Сценарий | Прогон | Итог |
|---|---|---|
| контролёр `demo` — позитивный контроль | `K99jXM1Rw26sMAvL3u4Jg` | `200 already`, `rowsRead: 1`, `rowsMatched: 1` |
| контролёр чужого ивента | `8Sv8L1DbBHdiolCFBKQRL` | `403` |
| отозванный контролёр | `zJiJ44xd6dlBidx2ZaRel` | `403` |
| не контролёр вовсе | `6oewgEqHz4qe9gRChFbFp` | `403` |
| битый `hash` в `initData` | `ntYEJ8ksWPOi3IglAe06g` | `401 bad_hash` |

Позитивный контроль прошёл весь путь до `already` и показал **исходное** время
чекина `2026-09-12T22:41:53.313Z` (03:41 Ташкент) — IDM-2 не задет, строка
`registrations` ни в одном прогоне не менялась.

**Хвост:** во входе `step_6` остался мёртвый ключ `staffUserRecords: null` от
удалённого в W24 чтения `users`. `ap_update_step` входы **сливает**, а не
заменяет, поэтому убрать ключ через MCP нечем. На исполнение не влияет — шаг
его не читает.

### Правка по ревью W18 (второй круг, 2026-09-13)

Ревью нашло, что fail-closed отсекал **пустой** ключ, но не **сентинел**.
`step_3` отдаёт `staffTelegramId = String(data.telegramId || '-')` — значит
`-` возможен и при `initDataValid: true`, если проверенный Telegram'ом
`initData` не содержит `user.id`. Строка `event_staff` с `telegram_id = '-'`
тогда совпадала бы, и — в отличие от сценария #382 — **фильтр чтения отдавал бы
её сам**: обход не требовал никакого дефекта платформы, только строки-сентинела
в таблице.

Закрыто проверкой ключей на форму вместо проверки на непустоту:
`SLUG = /^[A-Za-z0-9_]{1,12}$/` для `event_id`, `USER = /^[0-9]{1,16}$/` для
`telegram_id`. Это строже перечисления частных случаев — закрывает и пустое, и
`-`, и любой будущий сентинел вне этих алфавитов. Наружу добавлен `keysOk`.

**Доказано прогоном, а не рассуждением** (`INqiGWE9ryivvoZEkfPdZ`, фикстура
`event_staff` с `telegram_id = '-'`, `initData` с `user` без `id`, подписан
настоящим `BOT_TOKEN`): `step_36` → `valid: true`, `step_3` → `staffTelegramId:
'-'` при `initDataValid: true`, **`step_5` вернул строку с `-`**, `step_6` →
`keysOk: false`, `rowsMatched: 0` → `403`. До правки этот вход дал бы права.

Вся регрессия повторена на опубликованной версии после правки.

| Сценарий | Прогон | Итог |
|---|---|---|
| контролёр `demo` — позитивный контроль | `3uQwhelDcLQOTSaXtHRRK` | `200 already` |
| контролёр чужого ивента | `ciycrrLMv4VTApsGHhOSP` | `403` |
| отозванный контролёр | `Skswbo0sjbM8bYsX1Q8eK` | `403` |
| не контролёр вовсе | `Qy0HtNEn22T5xgoohxcfW` | `403` |
| битый `hash` | `HZ3OLdOtq5Fd4CTrSMJHU` | `401 bad_hash` |
| сентинел `-` (user без `id`) | `INqiGWE9ryivvoZEkfPdZ` | `403`, `keysOk: false` |

Дифференцирующий fail-open прогон тоже переделан на исправленном коде — вход
`step_6` временно подменён на **все шесть** строк `event_staff`, включая
строку-сентинел:

| Сценарий (fail-open, `rowsRead: 6`) | Прогон | Итог |
|---|---|---|
| не контролёр вовсе | `H0o1rONA0crgWUHZrYVoN` | `403` |
| контролёр чужого ивента | `xj8ch04xWoavmLiWcpT8A` | `403` |
| отозванный контролёр | `0qmnIt7zmqec7MmIQuI0v` | `403` |
| сентинел `-` (user без `id`) | `II0NFtJYzINyBgNUL8OBR` | `403` |
| настоящий контролёр `demo` | `8zQRwXbpx08JLI0n0nNAA` | `200 already` |

Вход возвращён на `{{step_5['output']}}`, флоу опубликован, смоук после
восстановления: контролёр → `200`, не-контролёр → `403`. Фикстуры удалены,
`event_staff` снова 2 исходные строки, `registrations` не менялась —
`checked_in_at` всё тот же `2026-09-12T22:41:53.313Z`.
