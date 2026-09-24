# W101. Прод-инцидент: пустой `eventId` в фильтрах `reg-api`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн — инцидент в проде, решение владельца 2026-09-24
- **Зависит от**: —
- **Начат**: 2026-09-24 · **Закрыт**: —

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

- [ ] `ap_validate_flow reg-api` — чисто
- [ ] `mine` и `profile_get` на живом `initData` — `200 {ok:true}` (пустой `eventId`)
- [ ] `register`/`cancel` (непустой `eventId`) — без регресса
- [ ] `flows/reg-api.json` перегенерён из LOCKED-версии тем же коммитом
- [ ] `catalog/flows/reg-api.md` отражает живой проект; платформенная гоча — в `AGENTS.md`
- [ ] строка `publish` в таблице `migrations` + `catalog/tables/migrations.md`
- [ ] офлайн-проверки (`check-export-secrets.sh`, `check-texts.py`, `check-commands.py`) — зелёные
- [ ] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

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
