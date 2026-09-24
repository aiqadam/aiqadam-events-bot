# W101. Прод-инцидент: пустой `eventId` в фильтрах `reg-api`

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн — инцидент в проде, решение владельца 2026-09-24
- **Зависит от**: —
- **Начат**: 2026-09-24 · **Закрыт**: 2026-09-24

## Цель

Экран каталога `#/events` («Мои билеты» и таб «Профиль») отдаёт ошибку всем
пользователям. Причина — в `reg-api`: `tables-find-records` с `eq` по пустому
значению теперь падает fail-closed, а `step_7`/`step_8` фильтруют по
`{{step_2.eventId}}`, который пуст для действий `mine`, `profile_get`,
`profile_save`, `delete_account`. Убрать зависимость фильтра от пустой
строки, не меняя поведение `register`/`cancel`.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-api` | `SiYL8m6k4oy4YunAdZ1W7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |

Инстанс: изменён `reg-api` (draft → publish). Таблицы, переменные, другие
флоу не тронуты.

## Причина (разбор)

- Платформа начала **fail-closed отклонять пустое значение `eq`** в
  `tables-find-records`: `Filter #1: the "eq" operator on field "<f>" requires
  a value` (`filters.js:213`, `toScalarValue`). Раньше пустое значение
  проглатывалось.
- `reg-api` был построен в расчёте на старое поведение: `step_7` (чтение
  регистраций события) и `step_8` (чтение самого события) выполняются
  линейно для **всех** действий, но `eventId` непустой только у
  `register`/`cancel`. Для `mine`, `profile_get`, `profile_save`,
  `delete_account` фильтр получал `''` и валил прогон.
- Прогон-свидетель (владелец, `@return_void_0`): `DqQeHS8hgl7cT2SOZw7rP`
  (08:30 UTC) — `profile_get`, падение на `step_7`. Тот же отказ на всех
  прогонах `reg-api` с ~07:19 до постановки пакета.
- Проверено прямым `ap_run_action` `tables-find-records` с `value: ""` —
  та же ошибка; с непустым sentinel `__none__` — `[]` без ошибки.

## Правка

Приём уже принят в проекте (`lifecycle`, `bcast-step`): Code-шаг отдаёт
непустой sentinel, когда значение пусто. Здесь:

1. `step_2` (CODE «normalize request») дополнительно отдаёт
   `eventIdOrNone = eventId !== '' ? eventId : '__none__'`. Поле `eventId`
   остаётся как есть (его читает `step_9`).
2. `step_7` и `step_8` фильтруют по `{{step_2['output'].eventIdOrNone}}`
   вместо `{{step_2['output'].eventId}}`.

`__none__` не совпадает ни с одним реальным `event_id`/`id`, поэтому для
`mine`/`profile_*`/`delete_account` чтения возвращают `[]` (семантика
«события нет»), а `step_9` решает как раньше. Для `register`/`cancel`
`eventIdOrNone === eventId` — поведение не меняется.

## Чек-лист готовности

- [x] `ap_validate_flow reg-api` — чисто
- [x] `mine` и `profile_get` на живом `initData` — `200 {ok:true}` (пустой `eventId`)
- [x] `register`/`cancel` (непустой `eventId`) — без регресса
- [x] `flows/reg-api.json` перегенерён из LOCKED-версии тем же коммитом
- [x] `catalog/flows/reg-api.md` отражает живой проект; платформенная гоча — в `AGENTS.md`
- [x] строка `publish` в таблице `migrations` (схема `catalog/tables/migrations.md` не менялась)
- [x] офлайн-проверки (`check-export-secrets.sh`, `check-texts.py`, `check-commands.py`) — зелёные
- [x] `catalog/` совпадает с живым проектом
- [x] независимое ревью, вердикт «замечаний нет» (круг 3)

## Как проверено

- Диагностика: `ap_get_run DqQeHS8hgl7cT2SOZw7rP` — `step_7` ❌
  `the "eq" operator on field "event_id" requires a value`;
  `ap_run_action tables-find-records` с `value:""` — та же ошибка,
  с `value:"__none__"` — `[]`.
- После правки и публикации (версия `RFehqjpi0tvZ5u1y71ZpQ`), живые
  `curl POST /api/v1/webhooks/SiYL8m6k4oy4YunAdZ1W7/sync` на `initData`
  владельца, все четыре — на этой версии (прогоны 09:21 UTC):
  - `mine` → `200 {ok:true, outcome:"mine", mine:[<событие + registered>]}` (`6N5qz2ApjRmNw3gNxeO8P`);
  - `profile_get` → `200 {ok:true, outcome:"profile", consentMarketing:true, profile:{…}}` (`pXQNwW0saDXPIXMBIJLSu`);
  - `register` (существующее событие) → `200 {outcome:"existing"}` — повтор
    идемпотентен, регресса нет (`jVzJiA9cGVKUVazYWjHda`);
  - `cancel` (несуществующее событие) → `404 {reason:"not_registered"}` —
    непустой `eventId` проходит `step_7`/`step_8` как раньше (`3zMVU9ixpS5EOLZ2Mhea6`).
- `ap_validate_flow reg-api` — «ready to publish». `ap_test_step` для этого
  флоу непригоден: вебхук-триггер, прогон исполнил все шаги, включая
  недостижимые ветки, с пустыми выходами — код-шаги не запускались.

## Журнал

- **2026-09-24** — инцидент воспроизведён по прогонам `reg-api`; причина —
  смена поведения платформы (пустой `eq` → fail-closed), а не правка флоу.
  Владелец выбрал полный пакет с независимым ревью вместо хотфикса.
  Проверить драфт `ap_test_step` не даёт (вебхук-триггер, харнесс прогнал
  все шаги с пустыми выходами), поэтому после обсуждения фикс опубликован,
  снят живым `curl`, и только затем идёт ревью; `готов` — лишь по вердикту
  «замечаний нет».

## Закрытие

- **2026-09-24 — готов.** Ревью 3 круга: круг 1 — блокеров и «важно» нет, два
  «на будущее» (аудит прочих `eq`-фильтров вынесен в хвост; точность
  доказательств исправлена), круг 2 — только «на будущее» (шапка журнала,
  пропущенная ветка `delete_account` в каталоге), круг 3 — «замечаний нет».
  Прод-инцидент закрыт; на живом трафике Mini App пришёл прод-прогон
  `mine` (`yNwTpHrQJdWNPzx3EJTZV`, 09:26 UTC) — `200 {ok:true, outcome:"mine"}`.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash) · **Дата**: 2026-09-24 · **Вердикт**: есть замечания

Блокеров и «важно» нет — правка делает ровно то, что заявлено, и прод-инцидент
закрыт. Оба замечания — «на будущее»: их достаточно записать, чинить сейчас
нечего.

### Замечания

1. **на будущее** — платформенный fail-closed на пустом `eq` бьёт шире
   `reg-api`, а аудита нет. `AGENTS.md` получил общее правило («фильтр, чьё
   значение может оказаться пустым, обязан получать сентинел»), но проверены
   только `lifecycle`/`bcast-step`/`reg-api`. Подтверждённый пример того же
   класса: `checkin-counter-api/step_3` («check staff rights») фильтрует
   `event_id eq {{trigger['output'].body.eventId}}` без проверки формы и
   непустоты. Пока SPA всегда шлёт `eventId`, это не видно; при пустом
   значении прогон упадёт `Filter #1 ... requires a value` — до смены
   поведения это был штатный `403 forbidden`, теперь станет `500`.
   — где: `checkin-counter-api/step_3` (и, возможно, `my-qr-api`,
   `feedback-api`, `reg-consent-*` — `eq` по значению из запроса/диплинка).
   — почему важно: это не дефект W101, но цена того же изменения платформы;
   записать в OPEN-QUESTIONS/бэклог отдельным пакетом и пройтись по остальным
   `eq`-фильтрам с необязательным значением.
   - *Принято*: аудит остальных `eq`-фильтров с необязательным значением
     вынесен в «Хвосты» отдельным пакетом; W101 его не чинит — это не регресс
     W101, а цена того же изменения платформы (2026-09-24).

2. **на будущее** — журнал и `STATUS.md` приписывают все четыре живых `curl`
   опубликованной версии `RFehqjpi0tvZ5u1y71ZpQ`, но по её метаданным
   (`created 2026-09-24T09:15:31Z`) четыре из шести прогонов (`mine`,
   `profile_get`, `register`, `cancel` — `0cm2ym1luAuH6lNkGPRyK`,
   `CKpw4wdKyHP6BS9Ezoo9z`, `xOBEZEqGGQGM2GpUlDL1s`, `2pudzxbRX0jdqrdrmM6O5`,
   все 09:13 UTC) завершились раньше её появления; на опубликованной версии
   перепроверены только `mine`/`profile_get` (09:16 UTC). Регресс
   `register`/`cancel` при непустом `eventId` закрыт чтением именно
   опубликованного кода (`eventIdOrNone === eventId`, фильтры `step_7`/`step_8`
   идентичны прежним), но живого прогона на `RFehqjpi…` для этих двух действий
   нет. — где: «Как проверено» журнала и строка `W101` в `docs/STATUS.md`.
   — почему важно: для прод-инцидента утверждение «проверено на опубликованной
   версии» должно опираться на прогоны той самой версии; либо перепроверить
   `register`/`cancel` на живом `curl`, либо поправить формулировку.
   - *Исправлено*: все четыре действия перепрогнаны живым `curl` на
     `RFehqjpi0tvZ5u1y71ZpQ` (09:21 UTC, прогоны `6N5qz2Ap…`, `pXQNwW0s…`,
     `jVzJiA9c…`, `3zMVU9ix…`); «Как проверено» и строка `W101` в `STATUS`
     поправлены (2026-09-24).

### Чем проверено (ревьюер)

- Живой проект через MCP: `ap_flow_structure` (includeInput) — `step_2` отдаёт
  `eventIdOrNone`, `step_7`/`step_8` фильтруют `eq` по `{{step_2['output'].eventIdOrNone}}`,
  `step_9` по-прежнему получает сырой `eventId`; `ap_read_step_code step_2`/`step_9`;
  `ap_validate_flow` — «ready to publish» (40 шагов, 39 valid, 1 skipped);
  `ap_list_flows` — `reg-api` ENABLED/published.
- Прогоны: прод-свидетель `DqQeHS8hgl7cT2SOZw7rP` (`profile_get`, 08:30) — падение
  `step_7` на пустом `eq`; успешные `mine`/`profile_get` (`i5NcSFWO45dNPtAgduKut`,
  `8jPQIg7yAM0N0fM1iqgBD`, 09:16) — `step_2.eventIdOrNone = '__none__'`,
  `step_7`/`step_8` = `[]`, исход `mine`/`profile` корректен; `register`
  (`xOBEZ…`) → `existing`, `cancel` (`2pudzxb…`) → `404 not_registered` при
  `eventIdOrNone === eventId`; `[TEST] 335i887…` — артефакт `ap_test_step`
  (вебхук-триггер, пустые выходы), как и описано в журнале.
- IDOR/владелец `initData` не затронуты: `step_2.telegramId` — только из
  проверенного `hmac` (`{{step_1['output'].data}}`), фильтры чтения — по
  `telegramId`/`event_id`, `targetTelegramId` сравнивается с `telegramId` в
  `step_9` (403). Семантика `register`/`cancel` при непустом `eventId`
  не меняется (`eventIdOrNone === eventId`). Проекции `columns` у `step_7`/`step_8`
  не расширены — новых ПД в логах нет.
- Офлайн: `tools/check-export-secrets.sh` (0), `tools/check-texts.py` (0),
  `tools/check-commands.py` (0). `tools/check-migrations.py` не запустился —
  нет ключа платформы (среда), вместо него вручную: `flows/_manifest.json`
  (`RFehqjpi0tvZ5u1y71ZpQ`) ↔ `ap_export_flow.flows[0].id` ↔ `migrations`
  (строка `W101`, `commit 45fb6f4`) — совпадают.
- Каталог: `catalog/flows/reg-api.md` соответствует живой структуре (шаги,
  фильтры, заметка про `eventIdOrNone`); гочу в `AGENTS.md` подтверждает
  `ap_run_action`-находка журнала.

## Ревью, круг 2

> Повторное ревью после ответа владельца на замечания круга 1 (коммит `4e59fac`).

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash) · **Дата**: 2026-09-24 · **Вердикт**: есть замечания

Оба замечания круга 1 закрыты, правки документов новых расхождений не внесли;
блокеров и «важно» нет. Оставшиеся замечания — гигиена каталога и шапки
журнала, не регресс W101.

- **Замечание №2 круга 1 (точность доказательств) — закрыто.** Все четыре
  действия (`mine`, `profile_get`, `register`, `cancel`) перепрогнаны живым
  `curl` на опубликованной версии `RFehqjpi0tvZ5u1y71ZpQ`
  (`created 2026-09-24T09:15:31Z`); прогоны 09:21 UTC, все `PRODUCTION`:
  `6N5qz2ApjRmNw3gNxeO8P` (`mine` → `200 outcome:"mine"`, `eventIdOrNone:"__none__"`,
  `step_7`/`step_8` = `[]`), `pXQNwW0saDXPIXMBIJLSu` (`profile_get` → `200
  outcome:"profile"`), `jVzJiA9cGVKUVazYWjHda` (`register` → `200
  outcome:"existing"`, `eventIdOrNone === eventId`), `3zMVU9ixpS5EOLZ2Mhea6`
  (`cancel` → `404 reason:"not_registered"`). Публикаций после `09:15:41Z` не
  было: `ap_export_flow` отдаёт ту же `RFehqjpi…`, `flows/_manifest.json` и
  `migrations.version_id` совпадают. Формулировки «Как проверено» и строки
  `W101` в `STATUS.md` исправлены верно.
- **Замечание №1 круга 1 (аудит прочих `eq`-фильтров с необязательным
  значением) — записано хвостом.** В разделе «Хвосты и блокеры» есть отдельный
  пункт с подтверждённым примером `checkin-counter-api/step_3`; чинить
  в W101 его не требуется.

### Замечания

1. **на будущее** — шапка журнала `- **Статус**: в работе` расходится с
   [STATUS.md](../../docs/STATUS.md), где `W101` — «**на проверке**» (ждёт
   повторного ревью). — где: `docs/work/W101-reg-api-empty-filter.md`,
   строка 3. — почему важно: статус пакета должен читаться одним значением;
   то же замечание помечалось в W10 (круг 1) и W71 (круг 1). Поправить
   при ответе на ревью.
2. **на будущее** — в `catalog/flows/reg-api.md` перечисление веток `step_10`
   неполно: живьём их семь (`register`, `cancel`, `registered_profile`,
   `profile`, `profile_saved`, `delete_account`, `Otherwise`), а в карточке
   `delete_account` пропущен (описан отдельно только в строке `step_24→26`).
   — где: `catalog/flows/reg-api.md`, строка `step_10`. — почему важно:
   [чек-лист ревьюера](REVIEW-CHECKLIST.md) требует соответствия шагов/веток
   «по списку»; пропуск pre-existing (с W73), не регресс W101 — дописать при
   следующей правке карточки.

### Чем проверено (ревьюер, круг 2)

- Прогоны через MCP: `ap_list_runs` по `reg-api` (последние 30) — четыре
  успешных 09:21 UTC с `Environment: PRODUCTION`; `ap_get_run` по каждому:
  вход/выход `step_2` (`eventIdOrNone`), `step_7`/`step_8` (`[]` на `__none__`,
  непусто на реальном `eventId`), итоговые `step_9`/ответ. Все — после
  `created` опубликованной версии.
- Версия: `ap_export_flow reg-api` — `flows[0].id = RFehqjpi0tvZ5u1y71ZpQ`,
  `created 2026-09-24T09:15:31Z`; `ap_list_flows` — ENABLED/published;
  `migrations` (`W101`, `publish`, `commit 45fb6f4`, `version_id`
  `RFehqjpi…`); `flows/_manifest.json` — тот же id.
- Структура и каталог: `ap_flow_structure` и `ap_validate_flow` («ready to
  publish», 40 шагов / 39 valid / 1 skipped) сверены с
  `catalog/flows/reg-api.md` — `step_2.eventIdOrNone`, фильтры `step_7`/`step_8`
  по нему, `step_9` по сырому `eventId`; списком сошлись все 40 шагов,
  расхождение — только перечисление веток `step_10` (замечание 2).
- Офлайн: `tools/check-export-secrets.sh` (0), `tools/check-texts.py
  i18n/ru.json flows/*.json` (254 пары, 0 расхождений),
  `tools/check-commands.py i18n/*.json flows/*.json` (0).
  `tools/check-migrations.py` — код 2: ключа платформы в среде нет
  (`QADAM_API_KEY` unset, Keychain пуст); сверка manifest ↔ `ap_export_flow` ↔
  `migrations` сделана вручную, как и написано в журнале.
- `AGENTS.md` (гоча W101 про пустой `eq`) содержит общее правило и ссылку на
  `__none__`; факт подтверждается диагностикой журнала (`ap_run_action` на
  пустом значении и на сентинеле).

## Ревью, круг 3

> Повторное ревью после ответа владельца на замечания круга 2 (коммит `d86b7d8`).

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash) · **Дата**: 2026-09-24 · **Вердикт**: замечаний нет

Оба замечания круга 2 закрыты, новых расхождений правки не внесли; блокеров,
«важно» и «на будущее» не осталось. Прежние «на будущее»-пункты (аудит прочих
`eq`-фильтров, живой прогон `delete_account`) приняты хвостом — чинить в W101
нечего.

- **Замечание №1 круга 2 (шапка журнала) — закрыто.** Строка 3 журнала —
  `- **Статус**: на проверке`; `docs/STATUS.md` (строка `W101`) — тоже
  «**на проверке**». Статус читается одним значением.
- **Замечание №2 круга 2 (неполный список веток `step_10`) — закрыто.**
  `catalog/flows/reg-api.md`, строка `step_10`, перечисляет семь веток —
  `register` / `cancel` / `registered_profile` / `profile` / `profile_saved` /
  `delete_account` / `Otherwise`; живой ROUTER `step_10` (`ap_flow_structure`)
  содержит ровно те же семь, с `delete_account` ветвью 5 и `Otherwise` ветвью 6,
  в том же порядке.

### Чем проверено (ревьюер, круг 3)

- Диф `d86b7d8` — только две правки по замечаниям: строка статуса журнала и
  строка `step_10` в карточке (плюс коммит вердикта круга 2); посторонних
  изменений нет. `git diff --stat main...HEAD` — 6 файлов (`AGENTS.md`,
  `catalog/flows/reg-api.md`, `docs/STATUS.md`, журнал, `flows/_manifest.json`,
  `flows/reg-api.json`), все относятся к W101.
- Живой проект через MCP: `ap_flow_structure` (includeInput) — `step_2` отдаёт
  `eventIdOrNone` (`eventId !== '' ? eventId : '__none__'`), `step_7`/`step_8`
  фильтруют `eq` по `{{step_2['output'].eventIdOrNone}}`, `step_9` читает сырой
  `{{step_2['output'].eventId}}`; `step_10` — семь веток, как в карточке.
  `ap_validate_flow` — «ready to publish» (40 шагов, 39 valid, 1 skipped);
  `ap_list_flows` — `reg-api` ENABLED/published.
- Версия и след: `ap_export_flow` отдаёт `flows[0].id = RFehqjpi0tvZ5u1y71ZpQ`
  (`created 2026-09-24T09:15:31Z`, `updated 09:15:41Z`); `flows/_manifest.json`
  (`publishedVersionId` `RFehqjpi…`) и живая строка `migrations`
  (`2026-09-24-w101-01`, `publish`, `flow:reg-api`, `version_id`
  `RFehqjpi0tvZ5u1y71ZpQ`, `commit 45fb6f4`) совпадают. Публикаций после
  `09:15:41Z` не было.
- Прогоны: четыре `curl`-прогона 09:21 UTC (`6N5qz2Ap…`, `pXQNwW0s…`,
  `jVzJiA9c…`, `3zMVU9ix…`) на месте, все `SUCCEEDED`; свежий прод-прогон
  09:26 UTC (`yNwTpHrQJdWNPzx3EJTZV`, `Environment: PRODUCTION`, origin
  `miniapp.events.aiqadam.org`) — `action:"mine"`, `step_2.eventIdOrNone =
  "__none__"`, `step_7`/`step_8` = `[]`, `step_10` семь веток (сработала
  `Otherwise`), ответ `200 {ok:true, outcome:"mine"}`. Инцидент на живом
  трафике закрыт.
- Офлайн: `tools/check-export-secrets.sh` (0), `tools/check-texts.py
  i18n/ru.json flows/*.json` (254 пары, 0 расхождений), `tools/check-commands.py
  i18n/*.json flows/*.json` (0). `tools/check-migrations.py` — код 2: ключа
  платформы в среде нет (`QADAM_API_KEY` unset, Keychain пуст); сверка
  manifest ↔ `ap_export_flow` ↔ `migrations` сделана вручную.
- AppSec по правке: `telegram_id` — только из `step_1` (проверенный `initData`),
  фильтры чтения — по `telegram_id`/`event_id`; проекции `columns` `step_7`/`step_8`
  не расширены (новых ПД в логах нет); `eventIdOrNone === eventId` при непустом
  `eventId`, так что семантика `register`/`cancel` не меняется; коротких форм
  `{{VAR}}` в `flows/reg-api.json` нет.

## Хвосты и блокеры

- **Отдельный пакет: аудит `eq`-фильтров с необязательным значением** (ревью
  круг 1, «на будущее»). Подтверждённый пример — `checkin-counter-api/step_3`
  («check staff rights»): `event_id eq {{trigger['output'].body.eventId}}` без
  проверки формы; при пустом `eventId` упадёт `Filter #1 … requires a value`
  (был `403 forbidden`, станет `500`). Проверить также `my-qr-api`,
  `feedback-api`, `reg-consent-*`. Не регресс W101 — цена того же изменения
  платформы.
- Живая проверка `delete_account` (разрушительное действие) на реальном
  аккаунте не выполняется — проверяется кодом и драфт-прогоном до чтений.
- `tools/check-migrations.py` без ключа платформы в среде — сверка
  manifest ↔ `ap_export_flow` ↔ `migrations` сделана вручную (ревьюер
  подтвердил), автопроверка — на W15.
