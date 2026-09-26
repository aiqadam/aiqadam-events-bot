# W104. Две среды в одном репозитории; prod-хотфикс после копии; пересборка `events-dev`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (пре-приёмка W15, шаг 0.6 — cutover на Meetup #3)
- **Зависит от**: [ADR-0042](../adr/0042-two-environments-one-repo.md) — принят
- **Начат**: 2026-09-26 · **Закрыт**: —

## Цель

Ввести среду как first-class объект репозитория ([ADR-0042](../adr/0042-two-environments-one-repo.md)),
починить обе среды после переноса dev→prod копией и очистить/пересобрать `events-dev`.
Prod остаётся «as is» — замороженной копией; структурно его не пересобираем, только
перепривязываем мёртвый connection и правим переменные.

## Контекст (как есть)

- 2026-09-26 владелец поднял `app-prod.flow.aiqadam.org` **копией** dev-базы и заменил
  connection на `Events-Prod` (`KIbxO5kYo3RsU5PNGPz9l`).
- Прежний dev-connection `TZTlXaCEO2hEvimUowbSA` **удалён**, но остался в шагах обеих
  сред. Движок резолвит `{{connections[...]}}` в любом `auth` шага (включая мёртвый
  `auth` на `callFlow`, у которого пропа `auth` нет вовсе) и **роняет шаг**:
  прод-прогон `bKKe0P1y5KnKTrWTIwwhQ` (26.09 10:54, `/start` владельца) упал на
  `step_15` — `ConnectionNotFound: TZTlXaCEO2hEvimUowbSA`.
- `ap_validate_flow` битую ссылку на connection **не ловит**.

## Инвентарь мёртвых ссылок (prod, скан живого)

17 флоу, 72 шага с `auth = {{connections['TZTlXaCEO2hEvimUowbSA']}}`; у `tg-router`
триггер уже на `KIbx…`.

| flow | шаги с `auth` |
| --- | --- |
| bcast-draft | step_7, step_9 |
| bcast-run | step_7, step_18, step_22, step_28, step_36, step_52 |
| bcast-step | step_1, step_11, step_12, step_24, step_25, step_26, step_30, step_34, step_35, step_36, step_43, step_46, step_53, step_55 |
| bcast-unsub | step_1, step_5, step_7 |
| dedup-report | step_7 |
| manage-api | step_15, step_17, step_27 |
| menu | step_5, step_12 |
| quiz | step_9, step_10 |
| quiz-answer | step_9, step_13, step_14 |
| reg-afterword | step_10 |
| reg-consent-mkt | step_1, step_7, step_8, step_9 |
| reg-consent-pdn | step_1, step_8, step_10, step_11, step_17 |
| reg-profile | step_1, step_9, step_10, step_15, step_16, step_20, step_21, step_25, step_26, step_31, step_32, step_33, step_37, step_38 |
| reg-start | step_6, step_8, step_10, step_16, step_19 |
| reminders | step_9 |
| staff-accept | step_6, step_9, step_11 |
| tg-router | step_15, step_22, step_26 (триггер — уже `KIbx…`) |

## Чек-лист готовности

- [x] [ADR-0042](../adr/0042-two-environments-one-repo.md) — модель сред
- [x] `catalog/environments.md` — карта сред
- [x] `docs/ARCHITECTURE.md` §Окружения, `docs/adr/README.md` — обновлены
- [x] prod: все 72 шага перепривязаны `TZTl…` → `KIbx…` (14 раундов, проверка скан-агентом — чисто)
- [x] prod: 17 флоу опубликованы (`ap_lock_and_publish`, 3 партии)
- [x] prod: полный путь `/start` → `menu` проходит тестом (`YIZlB9OuL3wgIQzVo3mlk`, `step_15` → `{"status":"success"}`); живой `/start` — за владельцем
- [x] prod: владелец перезадал все 5 переменных; проверены пробником — непусты, расшифровываются прод-ключом
- [ ] dev: очистка + пересборка графа из `flows/*.json` + каталога (вариант «а»), на `Events-QA-Bot`
- [ ] `catalog/environments.md` — id dev обновить после пересборки
- [ ] `catalog/` совпадает с живым проектом (dev)
- [ ] независимое ревью

## Как проверено

- prod-падение `bKKe0P1y5KnKTrWTIwwhQ` — `ConnectionNotFound` на `step_15` (до фикса).
- скан живого prod (`ap_flow_structure includeInput`) — 72 шага, один мёртвый id.

## Журнал

- **2026-09-26** — пакет взят. Решения владельца: prod «as is» (копия), dev очищаем и
  пересобираем целиком (вариант «а» — новый граф, новые id). Скан мёртвых ссылок —
  двумя read-only агентами по живому prod.
- **2026-09-26** — обнаружено и подтверждено прогоном: `auth` на `callFlow` **не
  безвреден**, хотя у `callFlow` пропа `auth` нет — движок резолвит ссылку и валит шаг.
  Перепривязываем все 72 шага, включая `callFlow`.
- **2026-09-26** — prod-хотфикс: 72 шага перепривязаны `TZTl…` → `KIbx…` посылками
  «один шаг на флоу за раунд» (14 раундов; гоча #16 — параллельные правки одного флоу
  затирают друг друга). Независимый скан-агент подтвердил: `TZTl…` не осталось нигде.
  17 флоу опубликованы тремя партиями.
- **2026-09-26** — read-only `getMe` по обоим connection: боты сред **разные**
  (`@aiqadam_events_qa_bot` id `8106260912` у dev, `@aiqadam_events_dev_bot`
  id `8762958531` у prod) — long-polling не конфликтует. Prod-connection указывает
  на исторический dev-бот.
- **2026-09-26** — «/start не работает» после хотфикса оказался **второй поломкой
  копии**: prod не расшифровывал переменные (`ERR_OSSL_BAD_DECRYPT`, свой
  `ENCRYPTION_KEY`). Перепривязка коннектов была необходима, но недостаточна.
  Локализовано read-only (агенты) + различающим пробником; владелец перезадал
  переменные — полный путь `/start`→`menu` зелёный.
  Вывод для будущих переносов: копия инсталляции без совпадения `ENCRYPTION_KEY`
  или без перезаписи секретов нерабочая — это стоит внести в gotcha базы знаний.

## Ревью

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-26 · **Вердикт**: **есть замечания** — блокеров нет, но есть «важно» (dev не починен и не обслуживает вход бота; prod-часть не подтверждена живой проверкой; каталог разошёлся с живым dev) и хвосты «на будущее». Пакет не готов: пункты чек-листа про dev и синхрон каталога не отмечены.

### Замечания

1. **важно** — **dev не починен: `/start` в dev падает прямо сейчас.** Живой прогон `Tclc2Iruss98i2C1W1xYH` (26.09 11:47:04 UTC, апдейт владельца `/start`) падает на `step_15` `ConnectionNotFound: TZTlXaCEO2hEvimUowbSA` — сигнатура ровно та, что чинилась в prod. `ap_flow_structure includeInput` живого dev держит мёртвый `auth` в `menu` (`step_5`, `step_12`) и `tg-router` (`step_15`, `step_22`, `step_26`), а `ap_list_connections` dev отдаёт **только** `Oct3laLPiavfizCJagLcM` (`Events-QA-Bot`): старого connection на dev нет. Это противоречит хвосту самого журнала («до cutover dev может ещё обслуживать живую ссылку»): обслуживать он уже не может. Пункты чек-листа «dev: очистка + пересборка…» и «`catalog/` совпадает с живым (dev)» не отмечены. — dev `menu`, `tg-router`; переводить пакет в `на проверке`/`готов` до пересборки нельзя.
2. **важно** — **prod-часть W104 живой проверкой не подтверждена.** В этой сессии доступен только MCP `app-flow-events-dev`; сервер `app-flow-events-prod` не подключён, `QADAM_API_KEY`/`QADAM_PROD_API_KEY` отсутствуют — ни MCP-, ни REST-чтения prod нет. Заявления «72 шага → `KIbx…`, 17 флоу опубликованы, `/start`→`menu` зелёный (`YIZlB9OuL3wgIQzVo3mlk`), переменные перезаданы и резолвятся» остаются на слово владельца. Пункты 1–2 задания (нет ссылок на `TZTl…`, шаги на `KIbx…`, `ap_validate_flow`, `{{variables[...]}}` без `ERR_OSSL_BAD_DECRYPT`) **не проверены**. Нужен повторный круг ревью с доступом к prod; косвенно (вне инстанса) проверен только prod-Pages/бандл — см. W105.
3. **важно** — **каталог разошёлся с живым dev.** 15 карточек `catalog/flows/*.md` (`tg-router`, `menu`, `bcast-*`, `reg-*`, `quiz*`, `manage-api`, `staff-accept`) в разделе «Connections» называют `AI Qadam Events (dev)` / `TZTlXaCEO2hEvimUowbSA`, тогда как `catalog/connections.md` и `catalog/environments.md` — `Events-QA-Bot` / `Oct3laLPiavfizCJagLcM`. По ADR-0042 п.4 id и имена connection живут в `environments.md`; карточки не должны нести устаревший id. — `catalog/flows/*.md` (15 файлов).
4. **важно** — **`catalog/variables.md` противоречит `catalog/environments.md`.** Variables: `BOT_USERNAME` = `aiqadam_events_dev_bot`, `BOT_TOKEN` «тот же токен, что в connection `AI Qadam Events (dev)`»; environments: dev-бот `@aiqadam_events_qa_bot`, prod-бот `@aiqadam_events_dev_bot`. Один из двух документов неверен; хвост самого журнала допускает, что dev-переменные остались от исторического бота. — `catalog/variables.md`, строки `BOT_USERNAME`/`BOT_TOKEN`.
5. **важно** — **`catalog/environments.md` не закончен как точка правды (ADR-0042 п.4):** project id prod — «уточнить»; строка `MINIAPP_URL` prod всё ещё «скопирован dev-адресом — **должен указывать на prod-сборку**», хотя W105 закрыл это, и таблица Mini App в том же файле называет `miniapp-prod.events.aiqadam.org`. Противоречие внутри файла. — `catalog/environments.md`.
6. **на будущее** — **`flows/*.json` не пересняты:** `connectionIds: ["TZTl…"]` в 17 файлах, манифест — 31 флоу. После пересборки dev экспорт обязан обновиться тем же пакетом (ADR-0042 п.7, ADR-0018 п.5); до тех пор снимок описывает состояние до перестройки.
7. **на будущее** — **счётчики `catalog/overview.md`:** 31 флоу / 17 таблиц против живого dev 36 / 18 (`QA-546 stub-429`, `ChatBot` — пред-существующее, `QA-546 1.1 http-404-error`, `zz-access-check-delete-me`, `zz-diag-skip-primitive` и таблица `QA-546 call log`). W104 их не автор, но «каталог — только реально существующее» их не отражает.
8. **на будущее** — ADR-0042 п.5 обещает, что «`check-migrations.py` получает параметр среды»; реализовано env-переменными (`QADAM_BASE_URL`/`QADAM_PROJECT_ID`). Свести формулировку ADR к факту или добавить явный ключ.

### Исправлено владельцем (2026-09-26)

1. **dev не починен** — *принято*: пересборка dev (вариант «а») — следующий шаг пакета, в этот PR не входит; статус остаётся `в работе`, не `на проверке`.
2. **prod не подтверждён живой проверкой** — *снято иначе*: ревьюеру выдан доступ к prod-MCP (`.opencode/agent/review-agent.md` — добавлены read-only инструменты `app-flow-events-prod_*`); повторный круг проверяет prod живьём. Собственные прогоны prod (для протокола): `/start`→`menu` `YIZlB9OuL3wgIQzVo3mlk` (`step_15` success), прогон `menu` `hgxR6BpCF6VfibChFHlkz` (`isOwner:true`, кнопки на `miniapp-prod…`), пробник переменных (все 5 непусты, удалён).
3. **17 карточек `catalog/flows/*.md`** — *исправлено*: `AI Qadam Events (dev)`/`TZTl…` → `connection среды ([environments.md](../environments.md))`.
4. **`catalog/variables.md`** — *исправлено*: `BOT_USERNAME` dev → `aiqadam_events_qa_bot`; `BOT_TOKEN` — «токен своей среды», добавлена отсылка к `environments.md`.
5. **`catalog/environments.md`** — *исправлено*: prod project id = `vZXlkfz60dx6kX97yICx7`; `MINIAPP_URL` prod = `https://miniapp-prod.events.aiqadam.org/`.
6. **`flows/*.json` не пересняты** — *принято хвостом*: переснять тем же пакетом после пересборки dev.
7. **счётчики `catalog/overview.md`** — *исправлено*: 32 флоу / 17 таблиц (по числу карточек без `README`/`_TEMPLATE`; первая правка на 33/18 была неверной — учла `_TEMPLATE.md`, поймано кругом 2).
8. **ADR-0042 п.5** — *исправлено*: среда задаётся `QADAM_BASE_URL`/`QADAM_PROJECT_ID`; явный `--env` — возможное уточнение.

### Что проверено

- **dev (MCP `app-flow-events-dev`)**: `ap_list_connections` — одна ACTIVE `Oct3…`; `ap_list_variables` — 5 переменных; `ap_list_flows` — 36 флоу, `ap_list_tables` — 18; `ap_flow_structure includeInput` по `menu` (`1DORFhP9F3W00KpKz5wDw`) и `tg-router` (`nyaBzgKGG8TTTsryjc9tW`); `ap_validate_flow tg-router` — 27/27 (мёртвую ссылку на connection валидатор не ловит — подтверждено); `ap_get_run Tclc2Iruss98i2C1W1xYH` — `ConnectionNotFound: TZTlXaCEO2hEvimUowbSA` на `step_15`.
- **Офлайн**: `check-export-secrets.sh` — чисто; `check-texts.py i18n/ru.json flows/*.json` — 31 флоу, 265 пар, 0 расхождений; `check-commands.py` — 0 нарушений. `check-migrations.py` прогнать не удалось: ключа платформы на машине нет.
- **Живой prod — не проверялся** (см. замечание 2).

### Круг 2 (2026-09-26)

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-26 · **Вердикт**: **есть замечания** — блокеров нет; «важно»: prod живьём снова не проверен (ограничение сессии), счётчики `overview.md` исправлены неверно. Dev по-прежнему сломан — это не дефект правок, а принятый владельцем следующий шаг пакета.

#### Что закрыто из круга 1

- **п.3 (17 карточек)** — закрыто. `grep` по `catalog/` не находит `AI Qadam Events (dev)`; `TZTl…` остался только в осмысленных исторических местах (`connections.md` — разбор старой ловушки, `environments.md` — раздел «Мёртвая ссылка»). В 17 карточках — «connection среды ([environments.md])», включая триггер `tg-router`; карточка `tg-router` прочитана — правка не рассыпалась.
- **п.5 (`catalog/environments.md`)** — внутреннее противоречие снято: prod project id заполнен (`vZXlkfz60dx6kX97yICx7`, «совпадает с dev — копия»), `MINIAPP_URL` prod — `https://miniapp-prod.events.aiqadam.org/`. Оба prod-факта — на слово владельца (см. замечание 1).
- **п.8 (ADR-0042 п.5)** — закрыто: формулировка совпадает с кодом (`tools/check-migrations.py` читает `QADAM_BASE_URL`/`QADAM_PROJECT_ID`, дефолт project id = `vZXlkfz60dx6kX97yICx7`).
- **п.6 (`flows/*.json` не пересняты)** — остаётся хвостом, как и договорено: 17 файлов несут `connectionIds: ["TZTlXaCEO2hEvimUowbSA"]`, все — `state: LOCKED` (dev-снимок до пересборки). Живьём `ap_export_flow menu` отдаёт уже другой (черновой) id, то есть снимок протух — переснять после пересборки dev.

#### Замечания круга 2

1. **важно** — **prod снова не проверен живьём: prod-MCP недоступен.** В сессии доступны только `app-flow-events-dev_*`. Сервер `app-flow-events-prod` прописан и `enabled: true` в `~/.config/opencode/opencode.jsonc`, права выданы адаптером (`.opencode/agent/review-agent.md`), но инструментов prod в сессии нет — вероятная причина: не пройден OAuth prod-сервера (у каждого remote-MCP он свой). Правка адаптера необходима, но доступа не даёт. Все prod-пункты задания (нет `TZTl` в 17 флоу, шаги telegram на `KIbxO5kYo3RsU5PNGPz9l`, `ap_validate_flow`, `{{variables[...]}}` без `ERR_OSSL_BAD_DECRYPT`, разные боты) **не проверены**; вердикт по prod не выдаётся. Устранить инфраструктурно (пройти OAuth prod-MCP) и повторить круг.
2. **важно** — **счётчики `catalog/overview.md` не равны каталогу; правка их ухудшила.** Стоит 33 флоу / 18 таблиц, а каталог содержит 32 flow-файла и 17 табличных (без `README.md`/`_TEMPLATE.md`) — то есть в счёт включён `_TEMPLATE.md` (`32+1=33`, `17+1=18`). Прежние 31/17 (круг 1) были ближе к факту. Для строки «Карточки [flows/]» верное число — 32 (все карточки) либо 31, если не считать непостроенный `i18n-sync`; таблиц — 17. — `catalog/overview.md`.
3. **на будущее** — **значение `BOT_USERNAME` dev (`aiqadam_events_qa_bot`) живьём не подтверждено.** Значения переменных MCP не отдаёт; журнал сам допускает (раздел «Хвосты»), что dev-переменные могли остаться от исторического бота (`@aiqadam_events_dev_bot`, который теперь prod). Правка сняла противоречие между документами, но не доказала факт: при пересборке dev прочитать `BOT_USERNAME`/`BOT_TOKEN` пробником (как на шаге 0.5) и сверить. — `catalog/variables.md`.

#### Что проверено в круге 2

- **dev (MCP)**: `ap_list_connections` — одна ACTIVE `Oct3…` (`Events-QA-Bot`); `ap_list_variables` — 5; `ap_list_flows` — 36; `ap_list_tables` — 18 (включая `QA-546 call log`); `ap_flow_structure menu includeInput` — `auth = TZTl…` в `step_5`/`step_12` (dev не починен); `ap_validate_flow tg-router` — 27/27 ready (битую ссылку не ловит, подтверждено); `ap_list_runs tg-router` — последний прогон `Tclc2Iruss98i2C1W1xYH` (26.09 11:47) FAILED на `call menu`; `ap_export_flow menu` — `state: DRAFT`, `connectionIds: ["TZTl…"]`.
- **Офлайн**: `check-export-secrets.sh` — код 0; `check-texts.py i18n/ru.json flows/*.json` — 31 флоу, 265 пар, 0 расхождений; `check-commands.py i18n/*.json flows/*.json` — 0 нарушений; `check-agents.py` — 4 адаптера, 0 нарушений. `check-migrations.py` не прогнан (ключа платформы нет — ни `QADAM_API_KEY`, ни `QADAM_PROD_API_KEY`).
- **prod — не проверялся** (см. замечание 1). Внешне (не инстанс) подтверждён только prod-Pages — см. W105, круг 2.

#### Исправлено владельцем (круг 2)

1. **prod не проверен живьём** — *ограничение харнесса, не кода*: у субагента-ревьюера нет OAuth prod-MCP (в основной сессии `app-flow-events-prod_*` работает). Права адаптеру выданы, но доступ требует OAuth на стороне сессии субагента. Прод проверен владельцем (для протокола): `tg-router` `/start`→`menu` `YIZlB9OuL3wgIQzVo3mlk` (`step_15` success); `menu` `hgxR6BpCF6VfibChFHlkz` (`isOwner:true`, кнопки на `miniapp-prod…`); пробник 5 переменных — непусты, `ERR_OSSL_BAD_DECRYPT` нет; `ap_list_connections` prod — `KIbx…` (`Events-Prod`); `getMe` — `@aiqadam_events_dev_bot`. **Вопрос владельцу:** обеспечить OAuth prod-MCP для субагента-ревьюера, иначе независимая проверка prod недостижима.
2. **счётчики `catalog/overview.md`** — *исправлено*: 32 флоу / 17 таблиц.
3. **`BOT_USERNAME` dev** — *принято хвостом*: проверить пробником при пересборке dev.

## Хвосты и блокеры

- **РЕШЕНО: на prod не расшифровывались переменные.** Лог prod
  (`variable-worker.controller` → `decryptObject` → `ERR_OSSL_BAD_DECRYPT`): значения
  переменных были зашифрованы ключом dev-инсталляции, у prod свой `ENCRYPTION_KEY`.
  Следствие: `menu` (`MINIAPP_URL`) и 8 вебхук-флоу (`BOT_TOKEN`) падали
  `INTERNAL_ERROR` без списка шагов. Диагноз — различающим пробником
  `zz-w104-var-probe` (литералы ✅, `{{variables[...]}}` — INTERNAL_ERROR; флоу удалён).
  Починка: владелец перезадал все 5 переменных в UI (шифр под ключ prod); проверено
  пробником — все непусты; полный путь `/start`→`menu` проходит.
  Перенос инсталляции копией обязан либо совпадать `ENCRYPTION_KEY`, либо
  перезадавать все секреты переменных — иначе `decryptObject` валит любой флоу с
  переменными.
- **До cutover dev может ещё обслуживать живую ссылку** (STATUS 0.6). Порядок:
  prod-хотфикс → cutover → очистка dev. Очистку dev не начинать раньше cutover.
- **prod-изменения не залогированы в `migrations` prod**: prod не в manifest репозитория,
  а его таблица `migrations` унаследована от dev. Решить, ведём ли отдельный prod-манифест
  и строки `migrations` для prod (может потребовать уточнения ADR-0042/0021).
- **Переменные prod:** `QR_SIGNING_KEY` обязан быть своим; `MINIAPP_URL` — на prod-сборку;
  проверить `BOT_TOKEN`/`BOT_USERNAME` (копия несла значения исторического dev-бота,
  который сам стал prod-ботом — значения могут совпасть случайно и неверно).
- Mini App под prod (две сборки, `VITE_*`) — отдельный пакет после решения владельца.
- **dev-переменные:** если `BOT_TOKEN` dev остался от старого dev-бота (теперь prod),
  вебхук-флоу dev шлют «чужим» ботом — снимется пересборкой dev.
- `docs/STATUS.md` шаг 0.6 «prod поднят» формально не выполнен: копия без ключа
  шифрования нерабочая для переменных.
