# W66. «Отменить»/«Удалить» на первом экране + удаление черновика

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: #150 (готов), #120 для Part 2
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Кнопка «Отменить событие» спрятана на последнем шаге визарда, а черновик нельзя
удалить вовсе. Part 1 — вынести «Отменить»/«Удалить» на первый экран и в строку
списка и научить удалять черновик.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `manage-api` | `CcGPwuW4ws5hkcaOPerEG`, published `PLEU2BP6GTKuhHxXr2VMJ` | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
| `step_5` (нормализация) | `delete` добавлен в белый список действий | там же |
| `step_7` (решение) | `action='delete'` → `outcome='delete'`; `__recordId` — внутренний id записи | там же |
| `step_53`…`step_59` | ветка `delete`: чтение регистраций/`event_staff`, серверная проверка, гейт, `tables-delete-record`, ответы | там же |
| Mini App `Manage.tsx` | кнопки на первом экране + строка списка, шит удаления | — |
| SPEC OWN-4.1 | правило удаления | [docs/SPEC.md](../SPEC.md) |

## Чек-лист готовности

> Из [issue #118](https://github.com/aiqadam/aiqadam-events-bot/issues/118), Part 1.

- [x] «Отменить»/«Удалить» видны сразу при открытии события, без шагов визарда
- [x] SPEC OWN-4 описывает удаление (OWN-4.1, отдельным коммитом)
- [x] `delete` работает только при 0 регистраций (curl, см. «Как проверено»)
- [x] текст в `i18n/ru.json`, `check-texts.py` зелёный (245 пар, 0 расхождений)
- [x] `catalog/`, `flows/*.json`, `_manifest.json` обновлены одним коммитом
- [x] `cd miniapp && npm run build` проходит (tsc + vite)
- [x] `catalog/` совпадает с живым проектом

## Как проверено

Живые `curl` на опубликованный `/sync` (`manage-api`), свежий `initData` от
временного флоу (удалён после тестов):

| Случай | Ответ |
|---|---|
| черновик с нулём регистраций → удаление | `200 {ok:true, deleted:true}`; строка `events` действительно исчезла (`ap_find_records` → 0) |
| повторный `delete` удалённого | `403 forbidden` (события нет) |
| `published` с 5 регистрациями | `409 {reason:"has_registrations"}`; строка на месте |
| `published` с нулём регистраций | `409 {reason:"not_draft"}` — граница Part 1 |
| не-staff (`532804490`) | `403 forbidden` |

Плюс офлайн: `check-export-secrets.sh`, `check-texts.py`, `check-commands.py`,
`check-agents.py`, `prototypes/check.mjs` — зелёные.

## Журнал

- **2026-09-23** — пакет взят. Part 1: кнопки на первом экране + удаление черновика;
  двухшаговая отмена с рассылкой — Part 2 (Phase 3, зависит от #120).
- **2026-09-23** — реализация. Точка отката `manage-api` до правки —
  `z8ZDy7YasY3HpgGlXL15a`. Первый прогон curl дал `400`: `step_5` фильтрует
  `action` по белому списку и не знал `delete` — добавлен. Второй прогон —
  все случаи таблицы выше. Публикация `QOZhdStd1zSQPa6SJFsgc`, экспорт снят
  сразу после публикации (гоча 14).
- **2026-09-23** — временный флоу `zz-qa-mint` (подпись `initData` через
  `node:crypto`, `BOT_TOKEN` — переменной) создан для тестов и удалён; в
  манифесте/каталоге его нет.

## Ревью

- **Ревьюер**: независимый агент, **дата**: 2026-09-23
- **Вердикт**: есть замечания — только уровня «мелко»; блокеров и «важно» нет

### Что проверено живьём (MCP `app-flow-events-dev`)

- `ap_flow_structure manage-api`: ветка `delete` достижима; `step_56` —
  ROUTER по `{{step_55['output'].canDelete}}` `BOOLEAN_IS_TRUE`;
  `tables-delete-record` (`step_57`) стоит **только** в ветке `canDelete`;
  `records_ids: ["{{step_55['output'].recordId}}"]` (внутренний id записи
  `events`, не бизнес-поле `id`). Рядом с `step_56` нет безусловного ребра —
  гоча 15 не воспроизводится.
- `ap_read_step_code` по `step_5`, `step_7`, `step_55` **побайтово** совпал с
  `flows/manage-api.json`; сверены и `settings` всех шагов `step_53…step_59` —
  расхождений снимка с живым нет. Живой `ap_export_flow` отдаёт
  `flows[0].id = QOZhdStd1zSQPa6SJFsgc` = `publishedVersionId` манифеста
  (текущая версия и есть опубликованная, draft == published).
- `ap_get_run` по живым прогонам (PRODUCTION, 2026-09-23):
  - `QGVc5uxRVR2MZ2avge5vt` — `draft` с 0 регистраций: `step_53=[]`,
    `step_54=[]`, `step_55 canDelete:true` → `step_56 canDelete=true` →
    `step_57 {"success":true}` → `step_58 200 deleted:true`;
  - `CRylA3H3szCIshPlfcvQG` — повторный `delete` удалённого: `step_6=[]` →
    `403` (ветка `delete` не выполняется);
  - `vDYnbiSxBBKsreVElgOtK` — `published` с регистрациями:
    `step_55 has_registrations` → `step_56 Otherwise` → `step_59 409`,
    `step_57` **не выполнен**;
  - `CXSpbcdSL08aGdWLS327f` — `published` с 0 регистраций:
    `step_55 not_draft` → `step_59 409`, `step_57` не выполнен;
  - `AIrunXXtH8IxiZXKcxRWw` — не-staff (`532804490`) на том же событии
    `mu9uzchnu2il`: `step_18=[]` → `step_7 403`. Пара `CXSpbcdSL…`
    (staff `322876545` → `409 not_draft`) и `AIrunXXt…` (не-staff → `403`) на
    **одном и том же `eventId`** — годный различающий прогон прав.
- AppSec: `telegram_id` — только из проверенного `initData`; право решается по
  конкретному событию (строка `staff` + `canAccess(ev.chapter_id)`, ADR-0024),
  не-staff / чужой чаптер / нет события — один `403`; `__recordId` берётся из
  строки `events`, а не из тела запроса, подменить его входом нельзя;
  `eventId` — только slug; удаление по фиксированному `table_id` events;
  проекции `step_53`/`step_54` — лишь `event_id` (ПД в лог прогона не текут);
  ответы ветки не подставляют пользовательские данные.
- Каталог: `catalog/flows/manage-api.md` сверен с `ap_flow_structure` — состав
  шагов и назначение `step_53…step_59` совпадают; `flows/_manifest.json` —
  `QOZhdStd1zSQPa6SJFsgc`; `migrations` — строка `2026-09-23-w66-01`
  (`version_id: QOZhdStd1zSQPa6SJFsgc`, `commit: 0f291f1`, `action: publish`).
- Офлайн заново: `check-export-secrets.sh` (0 совпадений), `check-texts.py`
  (245 пар, 0 расхождений), `check-commands.py`, `check-agents.py`,
  `prototypes/check.mjs` — зелёные; `cd miniapp && npm run build` (tsc + vite)
  проходит. **`check-migrations.py` запустить не удалось** — ключа платформы на
  машине нет (ни `QADAM_API_KEY`, ни Keychain); сверку манифест ↔ живой проект
  ↔ `migrations` сделал вручную через MCP.
- Чистота: флоу `zz-qa-mint` в проекте нет; событие `qadeltest01` удалено
  (`events` — только `mu9rqipgetmp`, `mu9uzchnu2il`), тестовых регистраций и
  `event_staff` для него не осталось. `zz-diag-skip-primitive` (W60) и
  `zz-access-check-delete-me` (W58) — задокументированные чужие артефакты, не W66.

### Замечания

1. **мелко** — `step_7` (живой код и `flows/manage-api.json`): комментарий
   ссылается на «ветке `delete` (step_60…step_66)», фактическая ветка —
   `step_53…step_59`. На исполнение не влияет, но вводит в заблуждение при
   следующей правке.
2. **мелко** — SPEC OWN-4.1: «Связанные строки (`event_staff` и **прочие**)
   блокируют удаление», а реализация проверяет только `event_staff` (плюс
   регистрации отдельным правилом). Строки `staff_invites` / `broadcasts`
   (для черновика реалистичны) / `feedback`, привязанные к удаляемому событию,
   останутся сиротами. Либо сузить формулировку SPEC, либо добавить проверки.
3. **мелко** — `catalog/flows/manage-api.md`, «Зависимости»: `events` описан
   как «чтение и upsert», хотя `step_57` теперь ещё и удаляет
   (`tables-delete-record`). Дополнить формулировку.
4. **мелко** — `miniapp/src/routes/Manage.tsx`: кнопка «Удалить» в строке
   списка вложена в `<a class="event-card">` (интерактивный элемент внутри
   ссылки — невалидная вложенность). Гасится
   `preventDefault()`/`stopPropagation()` и повторяет уже принятый паттерн
   ссылки сканера (W50); в живом WebView не проверялось. На будущее — вынести
   действия из `<a>`.

### Круг 2 — исправления владельца (2026-09-23)

- **1 исправлено**: комментарий `step_7` → `step_53…step_59`; перепубликация
  `PLEU2BP6GTKuhHxXr2VMJ`, экспорт и манифест обновлены, `migrations`
  `2026-09-23-w66-02`.
- **2 исправлено**: SPEC OWN-4.1 сужен до `event_staff`; `feedback`/`broadcasts`/
  `staff_invites` отнесены к Part 2 (у черновика первые две недостижимы).
- **3 исправлено**: каталог, «Зависимости» — `events`: чтение, upsert и удаление.
- **4 не чиним (решение)**: кнопка «Удалить» в строке списка остаётся внутри
  `<a class="event-card">` — это тот же сознательно принятый паттерн, что у
  ссылки сканера (W50, вердикт W49); `preventDefault`/`stopPropagation` гасят
  переход. Вынос действий из `<a>` — отдельная задача оформления списка, не W66.

### Круг 2 — вердикт ревьюера (2026-09-23)

- **Ревьюер**: независимый агент, **дата**: 2026-09-23
- **Вердикт**: замечаний нет

Все четыре замечания круга 1 закрыты, новых не внесено:

- **1 (комментарий `step_7`)** — исправлено: живой `ap_read_step_code step_7`
  содержит «ветке `delete` (step_53…step_59)», вхождений `step_60…step_66`
  нет. Диф `flows/manage-api.json` от `0f291f1` к `0426e73` — ровно одна
  строка (комментарий), поведение не менялось.
- **2 (SPEC)** — исправлено: OWN-4.1 сужен до `event_staff`; `feedback` /
  `broadcasts` / `staff_invites` отнесены к Part 2.
- **3 (каталог)** — исправлено: «Зависимости» — `events`: «чтение, upsert и
  удаление черновика — `tables-delete-record`, W66».
- **4 (кнопка в `<a>`)** — зафиксировано решение владельца: сознательный
  паттерн W50, отдельной правкой не чинится.

Живая сверка круга 2 (MCP):

- `ap_export_flow` отдаёт `flows[0].id = PLEU2BP6GTKuhHxXr2VMJ` =
  `publishedVersionId` манифеста (текущая версия == опубликованная).
- Побайтовая сверка `flows/manage-api.json` с живым экспортом: все **60**
  шагов (`settings` целиком) совпадают, расхождений нет.
- `ap_flow_structure`: ветка `delete` и гейт `step_56` (`canDelete` /
  `Otherwise`) на месте; `step_57` — `tables-delete-record` только в ветке
  `canDelete`.
- `migrations`: `2026-09-23-w66-01` → `QOZhdStd1zSQPa6SJFsgc` / `0f291f1` и
  `2026-09-23-w66-02` → `PLEU2BP6GTKuhHxXr2VMJ` / `0426e73` — обе согласованы
  с манифестом.
- Офлайн: `check-export-secrets.sh` (0 совпадений) и `check-texts.py`
  (245 пар, 0 расхождений) — зелёные.
- `git diff 0f291f1..0426e73`: изменения только в `docs/SPEC.md`,
  `catalog/flows/manage-api.md`, `flows/_manifest.json`,
  `flows/manage-api.json` (комментарий), `docs/work/W66-event-delete.md` —
  лишнего нет.

## Хвосты и блокеры

- Part 2 (удаление опубликованного с 0 регистраций, двухшаговая отмена с рассылкой) — Phase 3.
