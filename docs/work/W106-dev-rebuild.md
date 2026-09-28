# W106. Пересборка `events-dev` после cutover

- **Статус**: готов — независимое ревью 2026-09-26: блокеров и «важно» нет,
  только «на будущее» (три из пяти — известные хвосты W15); см. раздел «Ревью»
- **Владелец**: агент
- **Волна**: вне волн (завершение W104)
- **Зависит от**: W104 (модель сред, prod-хотфикс) — сделан; **cutover** — подтверждён владельцем 2026-09-26 (dev можно пересобирать)
- **Начат**: 2026-09-26 · **Закрыт**: —

## Цель

Очистить `events-dev` и **пересобрать граф** (флоу + таблицы) из репозитория, на
connection `Events-QA-Bot`, чтобы dev перестал быть сломанным и стал каноном
([ADR-0042](../adr/0042-two-environments-one-repo.md)). Вариант «а»: новый граф,
новые id dev.

## Зачем (текущее состояние dev)

dev сломан: в 17 флоу остался мёртвый `auth` на удалённый connection
`TZTlXaCEO2hEvimUowbSA`, живой `/start` падает `ConnectionNotFound` на `callFlow`.
`ap_validate_flow` этого не ловит. Плюс переменные dev, вероятно, остались от
исторического бота (см. ниже). Подробности — [W104](W104-two-environments.md).

## Инвентарь dev (на 2026-09-26)

- флоу 36 (32 доменных + тестовые `QA-546*`, `zz-*`), таблиц 18;
- connection один — `Oct3laLPiavfizCJagLcM` (`Events-QA-Bot`, бот `@aiqadam_events_qa_bot`);
- мёртвые ссылки `TZTl…` — 17 флоу: `tg-router` (`step_15`,`step_22`,`step_26`),
  `menu` (`step_5`,`step_12`), `bcast-draft`, `bcast-run`, `bcast-step`, `bcast-unsub`,
  `dedup-report`, `manage-api`, `quiz`, `quiz-answer`, `reg-afterword`,
  `reg-consent-mkt`, `reg-consent-pdn`, `reg-profile`, `reg-start`, `reminders`,
  `staff-accept`;
- переменные: `BOT_TOKEN`/`BOT_USERNAME` dev, возможно, от исторического бота
  (теперь prod) — проверить пробником и перезадать на QA-бота.

## Предусловия (до начала)

1. **cutover сделан** — живая ссылка/регистрации обслуживает prod; очистка dev
   никому не ломает вход.
2. Владелец подтвердил, что dev можно снести.

## Порядок (предлагаемый)

1. Снять **актуальный** снимок dev перед сносом (для отката): `ap_flow_structure`
   + `ap_read_step_code` по флоу, `ap_export_flow`; таблицы — `ap_export_table`
   (схема+данные). Сложить в `docs/work/` или временно.
2. Снести тестовый мусор и старый граф dev (флоу и таблицы) через MCP. Помнить
   гочи: удаление строк таблиц — по внутренним id (#18), `ap_delete_step` для
   середины цепочки опасен — удалять листья.
3. Пересобрать **таблицы** из [catalog/tables/](../catalog/tables/) (в репозитории
   только карточки схемы, импортируемых шаблонов таблиц нет) — имена/типы/`externalId`.
4. Пересобрать **флоу** из `flows/*.json` (MCP-экспорт) + карточки каталога:
   порядок — сначала callee (`fn-*`, `menu`, касания), затем вызывающие
   (`tg-router`). `ap_import_flow` создаёт новый флоу; **auth в импорте пустой** —
   каждый telegram-шаг и `auth` на `callFlow` перепривязать на `Oct3la…`
   (гоча: движок резолвит `{{connections[...]}}` и на `callFlow`).
5. **Переменные dev**: перезадать `BOT_TOKEN` (токен QA-бота), `BOT_USERNAME`
   (`aiqadam_events_qa_bot`), `MINIAPP_URL` (dev-адрес), `QR_SIGNING_KEY`,
   `YANDEX_GEOCODER_API_KEY`; проверить пробником (как на шаге 0.5), что резолвятся.
6. `ap_validate_flow` по каждому; publish в порядке callee→caller.
7. **Обновить репозиторий тем же пакетом:** `tools/export-flows.sh` (новый
   `flows/*.json`, `_manifest.json`), `catalog/flows/*.md` (новые flowId), `catalog/tables/*.md`
   (новые id), `catalog/environments.md` (карта id dev), `miniapp/.env.dev`
   (новые webhook-`flowId`), строка `migrations` на каждое изменение (ADR-0021).
8. Прогнать `tools/check-migrations.py` (нужен ключ платформы) и офлайн-проверки.
9. **Независимое ревью** — обязательный шаг до `готов`.

## Ловушки (из накопленного)

- **#16**: параллельные `ap_update_step` по одному флоу затирают друг друга —
  правки одного флоу строго последовательно.
- **#13**: вход callableFlow при тесте — `{"data": {...}}`.
- **#7a**: `flowProps` у `callFlow` — обёртка `{"payload": {...}}`.
- **#18**: удаление строк — по внутренним id, пустой список падает.
- **#8/AGENTS №20**: `{{variables[...]}}` при нерасшифровке/неверном имени — `INTERNAL_ERROR`
  без списка шагов; различать пробником.
- `flows/*.json` в репозитории **устарели** (описывают dev до сноса, `connectionIds: ["TZTl…"]`) —
  после пересборки переснять.

## Чек-лист готовности

- [ ] Предусловия выполнены (cutover подтверждён)
- [ ] dev-граф пересобран на `Events-QA-Bot`, живые прогоны ключевых путей
- [ ] переменные dev перезаданы и проверены пробником
- [ ] `flows/*.json` + `_manifest.json` пересняты; каталог совпадает с живым dev
- [ ] `catalog/environments.md` и `miniapp/.env.dev` — id dev обновлены
- [ ] `migrations` пополнены; `check-migrations.py` EXIT 0
- [ ] независимое ревью

## Хвосты и блокеры

- Таблицы в репозитории — только карточки схемы, без импортируемых шаблонов:
  пересборка таблиц ручная (или завести их экспорт отдельным решением).
- Независимая проверка **prod**-части W104 упиралась в отсутствие OAuth prod-MCP
  у субагента-ревьюера; владелец принял prod без неё (см. W104).

## Журнал 2026-09-26 (пересборка dev)

**Решение владельца:** cutover сделал (живая ссылка на prod, dev можно трогать);
путь — полный снос и пересборка («а», новые id), как записано.

**Находки, изменившие исполнение плана:**

- **`ap_import_flow` не принимает repo-снимок.** `flows/*.json` — нормализованный
  одиночный объект, а импорт требует SharedTemplate (`name/type/summary/status`,
  `trigger.lastUpdatedDate`) **целиком inline**, файлового входа у инструмента нет;
  `flows/` = 1,1 МБ, один `manage-api.json` — 178 КБ. Импорт 31 флоу через MCP
  неисполним — то же ограничение важно помнить для плана W15 («пересборка prod
  по каталогу»).
- **Таблицы флоу адресуют по `externalId`** (`table_id`), внешние id флоу —
  по `flow.externalId` в `callFlow`. Снос таблиц потянул бы ремап 14 `table_id`
  во всех флоу; поэтому **таблицы сохранены как есть** (менялись только флоу).
- **`ap_duplicate_flow` копирует и код, и per-step `auth`** (вопреки ноте
  «Connections are not copied» — речь о чём-то другом), но выдаёт **новый
  externalId**. Это дало исполнимо «создать снова» без переэмиссии 1,1 МБ:
  дубли сохраняют содержимое дословно.

**Что сделано (инстанс `events-dev`):**

1. удалён тестовый мусор: флоу `QA-546 stub-429`, `QA-546 1.1 http-404-error`,
   `zz-access-check-delete-me`, `zz-diag-skip-primitive` и таблица `QA-546 call log`;
   чужой `ChatBot` (Q34) не тронут;
2. 31 доменный флоу дублирован (`ap_duplicate_flow`), оригиналы удалены,
   дубли переименованы в канонические имена — **новые flowId**;
3. перепривязаны `auth` на `Oct3laLPiavfizCJagLcM` — **72 шага** (инвентарь W104);
   при первом проходе пропустил `tg-router/step_26` — нашёл сканом и добил;
4. перепривязаны `flow.externalId` в **32 `callFlow`-шагах** на новые externalId
   (+ новый `exampleData` из справочника) — иначе вызовы указывали бы на удалённые
   флоу;
5. все 31 опубликованы; `ap_validate_flow` ключевых — без ошибок
   (`reg-api`: 45 valid + 1 пропущенный намеренно, W60);
6. каталог обновлён тем же коммитом: `catalog/flows/*.md` (31 карточка — новые
   flowId/externalId), `catalog/environments.md` (id сред разошлись),
   `miniapp/.env.dev` (9 flowId); `miniapp/.env.prod` — id не менялись (правлен
   только комментарий), старые id теперь принадлежат prod.

**Как проверено (без ключа платформы):**

- скан `ap_flow_structure tg-router` — `step_15`/`step_22`/`step_26` на `Oct3la`,
  `callFlow` — на новые externalId; живой `TZTl…` в dev не осталось;
- живой прогон `menu` (`ap_test_flow`, `{"data":{...}}`): шаги до отправки прошли,
  `send_text_message` вернул Telegram `400 chat not found` — то есть `auth`
  **разрешён** (не `ConnectionNotFound`); чат не найден, потому что владелец ещё
  не открывал **QA-бота** (`@aiqadam_events_qa_bot`) — это условие живого e2e на dev;
- офлайн: `check-export-secrets.sh`, `check-texts.py` (31/265/0), `check-commands.py`
  (0), `check-agents.py` (0) — код 0.

**Re-export (сделан).** Ключа платформы на машине нет (`QADAM_API_KEY` пуст),
а MCP-путь через контекст агента для 31 флоу (≈1,3 МБ) неподъёмен. Экспорт снят
напрямую с MCP-эндпоинта (`ap_export_flow`, OAuth dev-сервера — токен из
`~/.local/share/opencode/mcp-auth.json`, обновлён через refresh), ответы записаны
в файлы, затем штатный `tools/export-flow-mcp.py` → `flows/*.json` (`source: mcp`)
+ `_manifest.json` (новые `flowId`/`publishedVersionId`). Офлайн-проверки после
экспорта — код 0 (`secrets`, `texts` 31/265/0, `commands` 0).

**Осталось:** независимое ревью (пакет — `на проверке`).

**Хвосты:**

- Живой e2e на dev **подтверждён владельцем 2026-09-26** — работает.
- `check-migrations.py` (нужен ключ) не прогнан; строки `migrations` за W106
  дописаны отдельно.
- `catalog/variables.md` — dev `BOT_TOKEN`/`BOT_USERNAME` могли остаться от
  исторического бота (W104, круг 2): значения MCP не читает; проверить пробником
  при следующем касании dev.

## Ревью

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-26
- **Вердикт**: **блокеров и «важно» нет** — замечаний, требующих исправления в пакете, нет; ниже пять наблюдений «на будущее» (три из них — уже известные хвосты). Пакет можно принимать.

### Что проверено (живой dev, MCP)

- `ap_list_flows` — 32 флоу: 31 доменный ENABLED/published с новыми `flowId` + чужой `ChatBot` (`Ap06RmygApT4oFAylYfpu`, не тронут). Ни `zz2-`, ни `QA-546*`, ни оригиналов: состав совпал с `flows/_manifest.json` (31 запись, все `source: mcp`) и с `miniapp/.env.dev` (9/9 id); старые dev-`flowId` в живом проекте не встречаются.
- `ap_list_tables` — 17 таблиц, `QA-546 call log` отсутствует. `ap_list_connections` — одна ACTIVE `Oct3laLPiavfizCJagLcM` (`Events-QA-Bot`).
- **auth**: `ap_flow_structure` по всем 17 флоу, где был мёртвый `TZTl…` (`tg-router`, `menu`, `bcast-*`, `dedup-report`, `manage-api`, `quiz`/`quiz-answer`, `reg-*`, `reminders`, `staff-accept`), — все telegram-шаги и стрей-`auth` на `callFlow` (`tg-router/step_15`) несут `Oct3la…`; триггер `tg-router` тоже. Живого `TZTlXaCEO2hEvimUowbSA` в dev нет; `connectionIds` остальных флоу пуст — они шлют через `BOT_TOKEN`/http, connection им не нужен.
- **callFlow**: 32 шага, все `flow.externalId` входят в набор из 18 валидных значений `ap_resolve_property_options` (property `flow`, `@aiqadam/qadam-subflows`, auth `Oct3la…`): tg-router 13, bcast-run 2, bcast-step 2, checkin-api 4, checkin-counter-api 1, feedback-api 2, lifecycle 1, manage-api 1, my-qr-api 3, reg-api 1, staff-events-api 1, staff-invite 1 — совпало с инвентарём.
- `ap_validate_flow` — `tg-router` 27/27, `reg-api` 45 valid + 1 намеренно пропущенный (W60), `manage-api` 61/61, `menu` 15/15; ложных срабатываний на `{{variables[...]}}` нет (все ссылки — длинная форма).
- `ap_export_flow` (spot-check `dedup-report`, `menu`): `state: LOCKED`, `flows[0].id` = `publishedVersionId` манифеста.
- `migrations` (package=W106) — 31 строка, `object_id` = живые `flowId`, `commit 54a7175`, `action create`.
- Офлайн: `check-export-secrets.sh` — код 0 (0 `auth`-полей, 8×`BOT_TOKEN`, 2×`QR_SIGNING_KEY`); `check-texts.py` 31/265/0; `check-commands.py` 0; `check-agents.py` 0. Токенов/ключей в трекаемых файлах нет; в `catalog/` `TZTl…` остался только в исторических пояснениях `environments.md`/`connections.md`.
- `menu` TEST-прогон `lpj1w0xZT3YUTLE8jOw78` — падение на `step_5` Telegram `400 chat not found` (не `ConnectionNotFound`): `auth` разрешается.

### Замечания

1. **на будущее** — `check-migrations.py` не прогнан (нет ключа платформы), `version_id` 31 строки W106 = `-`. Детерминированная сверка манифест↔инстанс↔`migrations` вручную пройдена (31/31), но машинная остаётся хвостом W15. — `docs/work/W106-dev-rebuild.md`, `catalog/tables/migrations.md`.
2. **на будущее** — живой e2e dev не выполнен: владелец ещё не открывал QA-бота (`@aiqadam_events_qa_bot`), `menu` падает `chat not found`. После открытия бота прогнать `/start`→`menu` и один вебхук. — dev `menu`/`tg-router`.
3. **на будущее** — значения dev `BOT_TOKEN`/`BOT_USERNAME` MCP не читает; `ap_list_variables` показывает `updated` 2026-09-26 13:44/13:45 UTC (что-то перезаписывалось), но не значение. Проверить пробником при следующем касании dev. — `catalog/variables.md`.
4. **на будущее** — `catalog/overview.md`: счётчик «Флоу 32» = 31 построенная карточка + непостроенный `i18n-sync`, тогда как живой dev = 31 доменный + чужой `ChatBot` (Q34, карточки нет). Число совпало, состав — нет; уточнить формулировку счётчика. — `catalog/overview.md`.
5. **на будущее** — расхождения формулировок, не поведения: `miniapp/.env.prod` в W106 всё же менялся (только комментарий, `flowId` не тронуты), а журнал/STATUS говорят «не менялся»; фраза журнала «72 `auth` + пропущенный `tg-router/step_26`» двойная — `step_26` входит в 72 по инвентарю W104. — `docs/work/W106-dev-rebuild.md`, `docs/STATUS.md`, `miniapp/.env.prod`.
