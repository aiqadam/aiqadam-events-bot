# W106. Пересборка `events-dev` после cutover

- **Статус**: на проверке — граф dev пересобран, опубликован и проверен;
  `flows/*.json` + `_manifest.json` пересняты; ждёт независимого ревью
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
3. перепривязаны `auth` на `Oct3laLPiavfizCJagLcM` — **72 шага** (инвентарь W104)
   + пропущенный при первом проходе `tg-router/step_26` (нашёл скан);
4. перепривязаны `flow.externalId` в **32 `callFlow`-шагах** на новые externalId
   (+ новый `exampleData` из справочника) — иначе вызовы указывали бы на удалённые
   флоу;
5. все 31 опубликованы; `ap_validate_flow` ключевых — без ошибок
   (`reg-api`: 45 valid + 1 пропущенный намеренно, W60);
6. каталог обновлён тем же коммитом: `catalog/flows/*.md` (31 карточка — новые
   flowId/externalId), `catalog/environments.md` (id сред разошлись),
   `miniapp/.env.dev` (9 flowId); `miniapp/.env.prod` не менялся — старые id
   теперь принадлежат prod.

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

- Живой e2e на dev возможен только после того, как владелец откроет QA-бота
  (`/start`), иначе Telegram `chat not found` для dev-чата.
- `check-migrations.py` (нужен ключ) не прогнан; строки `migrations` за W106
  дописаны отдельно.
- `catalog/variables.md` — dev `BOT_TOKEN`/`BOT_USERNAME` могли остаться от
  исторического бота (W104, круг 2): значения MCP не читает; проверить пробником
  при следующем касании dev.
