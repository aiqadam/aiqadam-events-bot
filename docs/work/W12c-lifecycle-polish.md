# W12c. Полировка `lifecycle`/`reminders` (хвосты ревью W12)

- **Статус**: готов
- **Владелец**: агент
- **Волна**: v0.1 (критический путь, до приёмки W15)
- **Зависит от**: W12 — готов
- **Начат**: 2026-09-21 · **Закрыт**: 2026-09-21

## Цель

Три замечания уровня «на будущее» из ревью [W12](W12-lifecycle.md):
`limit` чтения регистраций, гейт послесловия падающим апдейтом события,
неограниченный catch-up послесловия. Подробности —
[BACKLOG W12c](../BACKLOG.md#w12c-полировка-lifecyclereminders-хвосты-ревью-w12).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `lifecycle` (правка) | `4qjk9PsPgcliBvrdt8vbr` · версия `NOgvaWpXJWlAr1IGJApA4` | [catalog/flows/lifecycle.md](../../catalog/flows/lifecycle.md) |
| flow `zz-diag-continue-on-failure` (временный, DRAFT) | `yUTtH6Je2a5j3MHfdbZre` | — (доказательство, удалить после вердикта) |

`reminders` не менялся: замечание 1 — только `lifecycle/step_4`.

### Три правки

1. **`step_4` (чтение регистраций финишировавших событий): `limit` 100 → 500.**
   При >100 регистрациях хвост списка не получал вызов `reg-afterword`;
   остальные чтения пакета уже 500.
2. **`step_7` (апдейт `finished`): `continueOnFailure: true`.** Падающий
   `tables-update-record` больше не обрывает тик — цикл и следующие шаги
   (в т.ч. вызов послесловия) выполняются. Отметку `finished` такой апдейт
   не теряет: событие остаётся `published` и попадёт в `due` на следующем тике.
   Альтернативу «сначала послесловие, потом отметка» отвергли: это перестройка
   линейной цепочки (gotcha 10), цена ошибки выше выигрыша.
3. **`step_2` (catch-up послесловия): окно сужено с 48 ч до 2 тиков (30 мин)
   от `finished_at`** (запасной отсчёт — `ends_at`, если `finished_at` пуст).
   Было: событие до 48 ч после финиша звало `reg-afterword` по всем пришедшим
   каждые 15 мин (~192 лишних вызова на человека), хотя callee всё равно
   дедупит. **Цена названа прямо:** чекин позднее ~30 мин после финиша
   послесловия уже не получит; нормальный чекин (до финиша) получает его
   на тике перехода.

## Чек-лист готовности

- [x] `lifecycle/step_4`: `limit` 100 → 500
- [x] `lifecycle/step_7`: падение апдейта не обрывает вызов послесловия
- [x] `lifecycle/step_2`: у catch-up послесловия есть верхняя граница
- [x] `catalog/` совпадает с живым проектом

## Как проверено

- **Офлайн-харнесс `/tmp/w12/test.mjs` — 50/50** (было 46/46; +4 проверки
  границы catch-up). Перепроверены все прежние границы окон напоминаний,
  `due`/`finishedIds`, join и дедуп. Новые проверки `step_2`: `finished_at`
  1 с назад → catch-up; ровно 30 мин → catch-up (граница); 30 мин + 1 с → нет;
  `ends` 47 ч, `finished_at` 47 ч → нет (окно сужено, раньше это был catch-up);
  пустой `finished_at` + `ends` 5 мин → catch-up (запасной отсчёт);
  пустой `finished_at` + `ends` 49 ч → нет; `finished` без `ends` → нет.
- **Байтовое равенство:** тело `step_2` в `flows/lifecycle.json` совпадает
  с `/tmp/w12/lifecycle-due.js` (файлом, что гонял харнесс) — проверено
  скриптом, тестировалось ровно опубликованное.
- **`ap_validate_flow`: `lifecycle` ready** (9 шагов, 9 valid).
- **Живой различающий прогон `bSZAlwsLYMtnJmjA8aiwv`** (TESTING, SUCCEEDED)
  на временных фикстурах в `events` (удалены сразу после):
  - `w12c-due-noatt` — `published`, `ends_at` в прошлом → переведён в `finished`
    (`step_7` отработал, `finished_at` записан);
  - `w12c-catchup-new` — `finished`, `finished_at` 10 мин назад → в catch-up;
  - `w12c-catchup-old` — `finished`, `ends_at` час назад, `finished_at` 2 ч назад
    → **исключён** (доказывает верхнюю границу).
  `step_2` вернул `finishedIds: ["w12c-due-noatt","w12c-catchup-new"]`;
  `step_5 targets: []` → ни одного вызова `reg-afterword`, ни одного сообщения
  живому человеку. Прогон на прогретом проекте, 0,5 с.
- **Живой диагностический прогон `U857drNSvIRIoQ7NAAP0H`** (TESTING, SUCCEEDED,
  флоу `zz-diag-continue-on-failure`): `step_3` — PIECE `tables-update-record`
  по несуществующему record id — **FAILED** (`404 ENTITY_NOT_FOUND`),
  `continueOnFailure: true`; `step_4` («reached after loop») **всё равно
  выполнился**, `{reached:true}`. Это то же поведение, на которое настроен
  `lifecycle/step_7`; доказательство семантики, а не рассуждение.
- **`tools/check-texts.py i18n/ru.json flows/*.json` — 28 флоу, 232 пары,
  0 расхождений. `check-commands.py` — 0 нарушений. `check-export-secrets.sh` —
  чисто.** `check-migrations.py` не прогнан: ключа платформы в сессии нет
  (шаг 0.7) — хвост ревью/приёмке; строки `migrations` вставлены вручную,
  сверка manifest↔instance сделана глазами.

## Журнал

- **2026-09-21** — пакет взят (ветка `w12c-lifecycle-polish`, строка в STATUS,
  журнал; коммит взятия `08cdb9c`).
- **2026-09-21** — сборка и проверка:
  - **Правка 1** — `ap_update_step step_4 {"limit":500}` (скалярный мерж,
    вложенные `filters`/`columns` не тронуты).
  - **Правка 2** — `ap_update_step step_7 {continueOnFailure:true}`; структура
    показала ветки On success/On failure, `ap_validate_flow` остался clean
    (пустые ветки валидатор не отвергает — как у `reminders/step_9`).
  - **Правка 3** — `ap_update_step step_2` с **полным** `sourceCode` (гоча 16:
    частичный `sourceCode` усекает шаг). Сначала код и тесты прогнаны офлайн,
    потом тот же текст применён к живому флоу.
  - Правки одного флоу — **строго последовательно** (гоча 16), не батчем.
  - `ap_lock_and_publish` → версия `NOgvaWpXJWlAr1IGJApA4`; экспорт снят
    **сразу после публикации** (гоча 14) через `ap_export_flow` +
    `tools/export-flow-mcp.py` (ключа REST нет, `source: mcp`).
    Снимок дополнительно несёт `schemaVersion 32` и `agentIds` (платформа
    добавила поле между W12 и W12c) — это единственные изменения помимо правок.
  - **Временные фикстуры** в `events` (3 строки) удалены сразу после прогона.
  - **Диагностический флоу** `zz-diag-continue-on-failure` оставлен DRAFT
    до вердикта ревью (гоча 11: удалённый флоу = `not found` у ревьюера),
    заведён строкой `migrations 2026-09-21-w12c-02`.
  - Строки `migrations`: `2026-09-21-w12c-01` (lifecycle publish,
    `NOgvaWpXJWlAr1IGJApA4`, commit `a29d408`), `-02` (diag create).
- **2026-09-24 — живая проверка послесловия; принято владельцем.** Живой
  прогон крона `lifecycle` (04:00 UTC): событие с истёкшим `ends_at` помечено
  `finished`, цель взята по непустому `checked_in_at`; `reg-afterword` отправил
  владельцу (`322876545`) «Спасибо, что были. Надеемся, было не зря.» + кнопку
  «Оставить отзыв» (`web_app` → `#/feedback?event_id=…`), `message_id 2614`.
  Регистрация без бизнес-ключа `id=<eventId>-<telegramId>` корректно
  трактуется как «не приходил» (независимая перепроверка в `reg-afterword`).
  Напоминания — живой прогон в [W90](W90-reminder-buttons.md). Фикстуры и
  дедуп-ключ сняты. См. #117 «Live verification».

## Ревью

- **Ревьюер**: агент-ревьюер (независимый, чистый контекст) · **Дата**: 2026-09-21 · **Вердикт**: есть замечания (блокеров нет; одно «важно», одно «на будущее»)

### Замечания

1. **важно** — `catalog/flows/reg-afterword.md`, блок «Кто вызывает» (строка
   `(плюс catch-up 48 ч)`): карточка `reg-afterword` продолжает утверждать, что
   вызывающий `lifecycle` зовёт послесловие «плюс catch-up 48 ч», тогда как
   правка 3 сузила окно до двух тиков (~30 мин от `finished_at`). Каталог
   описывает вызывающего как текущий факт, а не как историю, поэтому он разошёлся
   с живым проектом (AGENTS.md: «Каталог и живой проект должны совпадать»).
   Правка — одна строка в `catalog/flows/reg-afterword.md`: назвать окно 2 тика /
   30 мин от `finished_at` либо убрать конкретное число и сослаться на
   `catalog/flows/lifecycle.md`. Масштаб маленький, но это именно тот класс
   расхождений, ради которого каталог и ревью существуют.
2. **на будущее** — `lifecycle/step_8` (`callFlow reg-afterword`,
   `continueOnFailure: false`): сужение catch-up с 48 ч до ~30 мин уменьшило не
   только шум по «позднему чекину», но и окно восстановления после сбоя вызова
   послесловия. Если `callFlow` для одного получателя в цикле `step_6` упадёт,
   цикл оборвётся на нём, а оставшиеся получатели тика подхватятся следующим
   тиком только пока событие моложе `finished_at + 30 мин`; под 48-часовым окном
   запас был кратно больше. Журнал называет цену правки только для позднего
   чекина — этот побочный эффект не назван. Не блокер (отказ постановки в
   очередь редок, а callee всё равно дедупит), но стоит либо поставить
   `continueOnFailure: true` на `step_8` (тогда падение одного вызова не съедает
   остальных), либо явно зафиксировать риск. Отдельного пакета не требует —
   достаточно строки в каталоге/OPEN-QUESTIONS, если решите оставить как есть.

### Что проверено

- Живой `lifecycle` (MCP, `events-dev`): `ap_flow_structure` — 9 шагов, все
  `configured`; `ap_validate_flow` — «ready (9 steps, 9 valid)»; `ap_list_flows` —
  ENABLED / published. Все три правки на месте: `step_1`/`step_4` `limit: 500`;
  `step_7` `continueOnFailure.value: true`; `step_2` — новый catch-up.
- `ap_export_flow` `lifecycle`: `flows[0].id = NOgvaWpXJWlAr1IGJApA4` = `publishedVersionId`
  в `flows/_manifest.json`; `state: LOCKED`, `status: PUBLISHED`. Экспорт в
  `flows/lifecycle.json` сделан тем же коммитом `a29d408`, что и правка.
- **Побайтово** (md5 `26a9b1f025974d9b9ac0909719532f14`, 3127 Б) совпали три
  источника `sourceCode` `step_2`: живой вывод `ap_read_step_code`, `flows/lifecycle.json`
  (через `json.load`) и `/tmp/w12/lifecycle-due.js`, который импортирует харнесс.
- Офлайн-харнесс `/tmp/w12/test.mjs` перезапущен мной (`node /tmp/w12/test.mjs`):
  `pass=50 fail=0`. В нём есть проверки ровно новой границы: `finished_at` 1 с назад
  → catch-up; ровно 30 мин → catch-up; 30 мин + 1 с → нет; `finished_at` 47 ч →
  нет; пустой `finished_at` + `ends_at` 5 мин → catch-up; пустой `finished_at` +
  `ends_at` 49 ч → нет; `finished` без `ends_at` → нет.
- Живой прогон `bSZAlwsLYMtnJmjA8aiwv` (TESTING, SUCCEEDED): на одном входе
  `step_2` вернул `due: ["w12c-due-noatt"]`, `finishedIds:
  ["w12c-due-noatt","w12c-catchup-new"]` — старый `finished` (`finished_at` 2 ч
  назад) **исключён**, свежий — **включён**: это различающий прогон для правки 3.
  `step_5 targets: []`, `step_6 iterations: []` — вызова `reg-afterword` и
  сообщений не было. Фикстуры из `events` удалены (сейчас в таблице 2 записи).
- Живой диагностический `U857drNSvIRIoQ7NAAP0H` (флоу `zz-diag-continue-on-failure`,
  DRAFT, DISABLED): форма совпадает с `lifecycle` (PIECE внутри `LOOP_ON_ITEMS`,
  шаг после цикла); экспорт подтверждает `step_3.continueOnFailure.value: true`;
  в прогоне `step_3` — FAILED `404 ENTITY_NOT_FOUND`, а `step_4` всё равно вернул
  `{reached:true}`. Это корректное доказательство семантики, на которую настроен
  `lifecycle/step_7`.
- Офлайн-проверки прогнаны мной с нулевым кодом: `check-export-secrets.sh` — чисто
  (токенов/hex нет, `auth` — ссылки); `check-texts.py i18n/ru.json flows/*.json` —
  28 флоу, 232 пары, 0 расхождений; `check-commands.py i18n/*.json flows/*.json` —
  самопроверка ok, 0 нарушений.
- `migrations` (живой таблицей): `2026-09-21-w12c-01` — `flow:lifecycle`, publish,
  `NOgvaWpXJWlAr1IGJApA4`, commit `a29d408`; `2026-09-21-w12c-02` — create
  `zz-diag-continue-on-failure`, version `-`. Совпадают с манифестом и журналом.
- Чужие флоу не тронуты: диff ветки — только `catalog/flows/lifecycle.md`,
  `flows/lifecycle.json`, `flows/_manifest.json`, `docs/STATUS.md`, этот журнал.
  Сверены с инстансом: `reminders` = `AzpGNY9OyDL6v8IICQ30F`,
  `checkin-api` = `M0vMBqVya8f117JBNmDLQ`, `reg-afterword` = `c1iPATKDXhTCT85UaqJCP`
  — все равны `publishedVersionId` манифеста. Ссылка `callFlow` из `step_8` ведёт
  на `1lrH7mXwLldQhc8p1Y2sC` — это `metadata.externalId` флоу `reg-afterword`
  (не MCP-flowId), то есть мишень верная.
- `catalog/flows/lifecycle.md` сверен с живой структурой: список из 9 шагов и
  порядок совпадают (включая `step_7` внутри `step_3`), `limit 500` у `step_4`,
  короткий catch-up и **названная цена** правки 3 (чекин позднее ~30 мин после
  финиша послесловия не получает) на месте.

### Не удалось проверить (ограничение)

- `tools/check-migrations.py` — ключа платформы (`QADAM_API_KEY`/Keychain) в
  сессии нет, скрипт завершился с кодом 2 и прямым сообщением об этом. Поэтому
  детерминированная сверка `_manifest.json` ↔ инстанс ↔ `migrations` целиком не
  выполнена; сделана ручная по 4 флоу (в т.ч. `lifecycle`) плюс сверка двух строк
  `migrations`. Это ограничение среды, а не замечание владельцу.
- `tools/export-flows.sh` по той же причине не прогонялся (нужен ключ);
  опубликованность версии подтверждена через `ap_export_flow` (`state: LOCKED`,
  `status: PUBLISHED`, id = версии в манифесте).

### Ответ владельца (2026-09-21)

1. **важно — исправлено.** `catalog/flows/reg-afterword.md`, блок «Кто вызывает»:
   `(плюс catch-up 48 ч)` заменено на «короткий catch-up — 2 тика от
   `finished_at`, окно и его цена — в `lifecycle.md`». Проверка: `grep "48 ч"`
   по `catalog/flows/reg-afterword.md` молчит, живой `lifecycle` не менялся
   (правка каталога, пересборка не нужна).
2. **на будущее — зафиксировано, не чинится сейчас** (правило: «на будущее» —
   записать, не чинить). Риск назван отдельным пунктом в
   `catalog/flows/lifecycle.md`: у `step_8` (`callFlow`) `continueOnFailure`
   выключен, упавший вызов обрывает цикл `step_6`, повтор — только в пределах
   ~30 мин catch-up. Если решите чинить — отдельным пакетом
   (`continueOnFailure: true` на `step_8`), это меняет поведение сверх задания W12c.

### Круг 2 (2026-09-21)

- **Ревьюер**: агент-ревьюер (независимый, чистый контекст) · **Дата**: 2026-09-21 · **Вердикт**: замечаний нет

#### Замечания

Нет. Оба замечания круга 1 закрыты, новых расхождений каталога с живым проектом не внесено.

#### Что проверено

1. **«важно» исправлено.** `catalog/flows/reg-afterword.md`, блок «Кто вызывает»
   (строки 64–67): формулировка «плюс короткий catch-up — 2 тика от `finished_at`,
   окно и его цена — в `lifecycle.md`». `grep "48 ч"` по этому файлу молчит.
   По всему `catalog/flows/` упоминания 48 ч остались только в `lifecycle.md`
   (внутри заметок-обоснований: «~30 мин вместо прежних 48 ч» и «иначе окно
   тянется 48 ч») и в `reminders.md` (TTL маркера, другая сущность). Противоречия
   живому `lifecycle` нет: текущее окно везде названо как 2 тика / 30 мин.
2. **«на будущее» зафиксировано.** `catalog/flows/lifecycle.md`, заметка
   «Известный риск (не блокер): у `step_8` (`callFlow`) `continueOnFailure`
   выключен» — называет механизм (падение обрывает цикл `step_6`, оставшиеся
   получатели тика пропускаются), сужение окна восстановления (~30 мин вместо
   прежних 48 ч) и решение не чинить сейчас. Severity соответствует: «на будущее»
   — записано, не исправляется.
3. **Живой проект не менялся и совпадает с каталогом.** `ap_export_flow`
   `lifecycle`: `flows[0].id = NOgvaWpXJWlAr1IGJApA4` = `publishedVersionId`
   в `flows/_manifest.json`, `state: LOCKED`, `status: PUBLISHED`.
   `ap_validate_flow` — «ready (9 steps, 9 valid)». DFS-структура совпадает
   с таблицей шагов карточки: trigger, step_1, step_2, step_3, step_7 (в цикле),
   step_4, step_5, step_6, step_8 (в цикле). Правки на месте: step_4 `limit 500`;
   step_7 `continueOnFailure.value: true`; step_8 `continueOnFailure.value: false`;
   step_2 — `CATCHUP_MS = 2 * 15 * 60 * 1000` от `finished_at` с запасным `ends_at`.
   `step_8.flow.externalId = 1lrH7mXwLldQhc8p1Y2sC` = externalId `reg-afterword`
   из карточки.
4. **Снимок не протух.** `flows/lifecycle.json`, `step_2` — md5
   `26a9b1f025974d9b9ac0909719532f14`, 3127 Б (совпадает с заявленным в круге 1),
   текст совпадает с живым экспортом. Ветка трогает только
   `catalog/flows/lifecycle.md`, `catalog/flows/reg-afterword.md`,
   `flows/lifecycle.json`, `flows/_manifest.json`, `docs/STATUS.md` и журнал —
   чужих флоу нет.
5. **`migrations` (живой таблицей, MCP).** `2026-09-21-w12c-01` — publish
   `flow:lifecycle` (`4qjk9PsPgcliBvrdt8vbr`), версия `NOgvaWpXJWlAr1IGJApA4`,
   commit `a29d408`; `2026-09-21-w12c-02` — create
   `flow:zz-diag-continue-on-failure` (`yUTtH6Je2a5j3MHfdbZre`), version `-`.
   Совпадают с манифестом и журналом. `zz-diag-continue-on-failure` — DISABLED /
   draft, не удалён (оставлен до вердикта).
6. **Офлайн-проверки с нулевым кодом:** `check-export-secrets.sh` — чисто
   (токенов/hex нет, `auth` — ссылки); `check-texts.py i18n/ru.json flows/*.json`
   — 28 флоу, 232 пары, 0 расхождений; `check-commands.py i18n/*.json flows/*.json`
   — 0 нарушений.
7. **Журнал.** Текст круга 1 не переписан: diff `15f4d49` удалил только две
   строки-заглушки (`<заполняет ревьюер>`); ответ владельца — отдельный подраздел
   под замечаниями.

#### Не удалось проверить (ограничение)

- `tools/check-migrations.py` — ключа платформы в сессии нет (`QADAM_API_KEY`
  не задан, macOS Keychain / `security` недоступны), скрипт завершился кодом 2
  с прямым сообщением. Вместо него сверка `_manifest.json` ↔ инстанс ↔
  `migrations` сделана вручную через MCP (пп. 3, 5) — совпадает; но это
  не заменяет детерминированный прогон.
- `tools/export-flows.sh` по той же причине не прогонялся; опубликованность
  подтверждена `ap_export_flow` (`state: LOCKED`, `status: PUBLISHED`,
  id = версия манифеста).

### Закрытие 2026-09-21

Круг 2 независимого ревью — «замечаний нет». Временный диагностический флоу
`zz-diag-continue-on-failure` удалён после вердикта (гоча 11 больше не держит;
выводы прогона `U857drNSvIRIoQ7NAAP0H` скопированы в «Как проверено» до удаления).
Строка `migrations 2026-09-21-w12c-03` фиксирует удаление.

## Хвосты и блокеры

- **`check-migrations.py` не прогнан** — нет ключа платформы в сессии
  (шаг 0.7, «готов»). Сверка `migrations` ↔ манифест ↔ инстанс — на ревьюера
  и приёмку W15.
- **Продуктовое следствие правки 3** названо в карточке `lifecycle` и выше:
  чекин позднее ~30 мин после финиша послесловия не получает. Решение принято
  BACKLOG W12c; если владелец захочет вернуть длинный хвост — это отдельный
  пакет (catch-up по факту чекина, а не поллингом).
