# W140. Перенос W139 на prod: имена участников (узкий join `telegram_id in <idsCsv>`)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W139 (готов на dev) — ✅
- **Начат**: 2026-10-08 · **Закрыт**: —

## Цель

Перенести W139 (в prod `manage-api` имена участников ломались на 200+
пользователях: широкое чтение `users` с самодельным `limit: 200` в join)
с dev на prod отдельным хотфиксом. Решение владельца 2026-10-08: **только
W139**; W136 (гео-ветка `step_61..71`) на prod не тянем — отдельный хвост.
Правки — только через MCP `app-flow-events-prod`; канон — dev
([ADR-0042](../adr/0042-two-environments-one-repo.md)).

## Что построено

| Артефакт | dev-эталон (canon) | prod (куда переносим) |
|----------|--------------------|------------------------|
| flow `manage-api` | `pFtbgOP3U8sNFvP86Szli` (v `jFYwwKlM25d7xBjxIXiH5`) | `CcGPwuW4ws5hkcaOPerEG` (было `8wizdJdhiOYAg0ab23e6e` → стало `Yyu3K6X95ccRlFVZDxdri`; первая публикация W140 — `VX2IszoIhTr4DdVcM3rNo`) |
| таблица `users` | `gyMqrk23KWlFQweY3qDU0` (внутр.) | те же id, что у dev (таблицы не пересобирались) |
| таблица `migrations` (prod) | — | `NCZNGuWh6PFs1JZXRPNTE` |
| connection | — | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |

`flows/*.json` и `catalog/flows/*.md` **не трогаем** — канон dev (ADR-0042);
prod-ids живут только в `catalog/environments.md`.

## Дрейф dev↔prod (предусловие)

prod `manage-api` — эпохи W132: в нём **нет W136** (гео-ветка `step_34..37`
вместо dev-овых `step_34..37` + `step_61..71`) и **нет W139**. При этом пять
целевых шагов prod (`step_40`/`step_45`/`step_49`/`step_50`/`step_52`)
**побайтово совпадают** с dev-pre-W139 (`columns`/`table_id`/`filters:{}`/
`limit:200`, `step_50.userRows = step_49`), поэтому дельта W139 ложится чисто
и в гео-ветку не заходит. Правка read-only (участники/поиск/контролёры/отзывы
только читают); i18n-ключей W139 не добавляет; Mini App не меняется.

**Баг на prod живой и различается без засева:** `users` на prod = **210**
строк (>200), поэтому и старая (wide `limit: 200`), и новая (узкий `in`) версии
дают разный результат прямо на боевых данных (на dev строк было 121 и
потребовался засев — см. W139).

## Чек-лист готовности

- [x] нет `running`-рассылки на prod (предусловие); снапшот prod снят, `publishedVersionId` записан (baseline `8wizdJdhiOYAg0ab23e6e`)
- [x] `step_45` ← dev-эталон (фильтр `telegram_id in {{step_61['output'].idsCsv}}`, `limit:500`) + новый `step_61` (CODE) после `step_44` (имя auto — на prod `step_61`, см. «Дрейф»)
- [x] `step_40` ← dev + новый `step_62` (CODE) после `step_39`
- [x] `step_52` ← dev + новый `step_63` (CODE) после `step_19`
- [x] `step_49` → чтение `registrations` события + `step_64` (CODE) после `step_49` + `step_65` (чтение `users`) после `step_48` + `step_50.userRows = {{step_65['output']}}`
- [x] `ap_validate_flow` — 0 `invalid` (66/66); read-back живой структуры
- [x] publish (`VX2IszoIhTr4DdVcM3rNo`, затем `Yyu3K6X95ccRlFVZDxdri` после правки `logInput`); строки `migrations` на **prod** `2026-10-08-w140-01`, `-02`
- [x] `catalog/environments.md` обновлён (W140 применён; prod `publishedVersionId`)
- [ ] независимое ревью, вердикт «замечаний нет»

## Детали исполнения

Порядок (правки одного флоу строго последовательны, гоча 16; вложенные
`input`/`filters` — целиком, гоча 12; вставка `AFTER` на шаг с потомком —
линейный сплайс, готачи 10/17):

> Имена ниже — dev-эталонные (`step_72…76`). На prod платформа выдаёт имена
> сама, и они другие: `step_61` (participants), `step_62` (search), `step_63`
> (staff), `step_64`/`step_65` (feedback); порядок вставки тот же, а ссылки в
> фильтрах и `step_50` указывают на фактически выданные prod-имена.

1. `step_45` (`ap_update_step`, полный `input` = dev): `filters` =
   `telegram_id in {{step_72['output'].idsCsv}}`, `limit: 500`; затем
   `ap_add_step` `step_72` (CODE, `regRows={{step_44['output']}}`,
   `logInput:false`, `logOutput:false`) — AFTER `step_44`.
2. `step_40` ← dev (фильтр от `step_73`); `step_73` (CODE:
   `regRows={{step_38['output']}}`, `staffRows={{step_39['output']}}`) AFTER
   `step_39`.
3. `step_52` ← dev (фильтр от `step_74`); `step_74` (CODE:
   `staffRows={{step_19['output']}}`) AFTER `step_19`.
4. `step_49` ← чтение `registrations` события (таблица
   `SM8tMxfQuQCHRDdAiNJyQ`, колонка `mVfpZFCwAZskWXNT7iCuI`, фильтр
   `event_id eq {{step_5['output'].eventId}}`, `limit:200`); `step_75` (CODE:
   `regRows={{step_49['output']}}`) AFTER `step_49`; `step_76` (tables read
   `users`, фильтр от `step_75`, `logOutput:false`) AFTER `step_48`;
   `step_50.input.userRows = {{step_76['output']}}` (полный input).
5. `ap_validate_flow` → read-back (`ap_flow_structure`) → `ap_lock_and_publish`.

`sourceCode`/`input` новых и правленых шагов берём из dev-эталона
`flows/manage-api.json`. На prod **не запускать** `ap_test_step`/`ap_test_flow`
(гоча 11).

Новый tables-шаг `step_76` на prod получит верхний доступный пин `tables`
(existing tables-шаги prod — `0.4.5`; формат входа совместим, как в W137).

Откат: по снапшоту (`ap_export_flow`, версия `8wizdJdhiOYAg0ab23e6e`) —
вернуть 5 `input`'ов + `ap_delete_step` ×5 + повторная публикация; снапшот
держать до вердикта ревью (MCP не умеет revert к версии).

## Как проверено

- **Предусловие:** `ap_find_records(broadcasts, status eq running)` на prod — 0;
  снапшот prod `8wizdJdhiOYAg0ab23e6e` снят в
  `~/qadam-snapshots/w140/`; `users` prod = **210** (>200), `registrations` = 60
  — баг живой.
- **Read-back живого prod** (`ap_flow_structure`): цепочки совпали с замыслом —
  participants `step_44→step_61→step_45→step_60→step_46`, search
  `step_38→step_39→step_62→step_40→step_41→step_42`, staff
  `step_19→step_63→step_52→step_20`, feedback
  `step_49→step_64→step_48→step_65→step_50`. Фильтры `telegram_id in
  {{step_NN['output'].idsCsv}}` + `limit:500` на `step_45`/`step_40`/`step_52`/
  `step_65`; `step_50.userRows = {{step_65['output']}}`. CODE-шаги `step_61…64`
  и `step_65` помечены `[LOG OFF: input, output]` (после правки по ревью).
- **`ap_validate_flow`** — «ready to publish (66 steps, 66 valid)». 66 = 61
  prod-шагов + 5 новых; разница с dev (77) — 11 шагов гео-ветки W136, которой на
  prod нет.
- **Публикация:** `ap_lock_and_publish` → версия `VX2IszoIhTr4DdVcM3rNo`
  (`ap_export_flow`), затем (после правки `logInput` по ревью) повторная
  публикация → `Yyu3K6X95ccRlFVZDxdri`. Свежие экспорты сохранены в
  `~/qadam-snapshots/w140/`.
- **migrations (prod):** строки `2026-10-08-w140-01` (`VX2…`) и `-02` (`Yyu3…`).
- **Живой сквозной прогон на prod (доказательство основного сценария).**
  После публикации (`VX2…`, 10:53Z) на prod прошли живые прогоны Mini App
  (`participants`, `feedback_list`, `load`, `staff_list`; 10:58Z) — все
  `SUCCEEDED`. `participants` вернул **55 имён**, включая ранее отображавшиеся
  `telegram_id` свежих регистрантов (`509627989`, `108259963`, `782128795`,
  `7093788550`); `feedback_list` прошёл цепочку `step_64→step_65→step_50`.
  Проверено и `get_run` (`staff_list`): имена контролёров на месте, а новый
  `step_63` в логе — `REDACTED` (log-off работает).

## Журнал

- **2026-10-08** — пакет заведён по решению владельца (план согласован:
  только W139; старт сразу). Разведка prod через MCP `app-flow-events-prod`:
  `manage-api` `CcGPwuW4ws5hkcaOPerEG`, published `8wizdJdhiOYAg0ab23e6e`
  (2026-10-03), живые прогоны идут (`SUCCEEDED`); `users` = 210 (>200),
  `registrations` = 60, `events` = 3 — баг воспроизводится на боевых данных.
  `running`-рассылок нет. Снапшот prod снят в
  `~/qadam-snapshots/w140/prod-manage-api-8wizdJdhiOYAg0ab23e6e.json`.
- **2026-10-08** — пакет применён на prod. Правки через MCP
  `app-flow-events-prod` строго последовательно, каждый шаг с read-back
  (`ap_flow_structure`). **Неожиданное:** платформа выдала новым шагам имена
  `step_61…65`, а не dev-овые `step_72…76` — на prod нет W136, поэтому
  auto-нумерация идёт с `step_61`. Первая редакция `step_45` ссылалась на
  `{{step_72…}}` (dev-имя) — поправлена на фактическое `{{step_61…}}` до
  публикации; дальше имена брались из ответов `ap_add_step`. Публикация →
  `VX2IszoIhTr4DdVcM3rNo`, экспорт сохранён. `catalog/environments.md`
  дополнен разделом W140 (в т.ч. про расхождение имён шагов prod↔dev).
- **2026-10-08** — ревью круг 1: одно `важно` — `step_65` не гасил `logInput`
  (dev-эталон `step_76` гасит оба). Исправлено: `ap_update_step` `logInput:false`
  на `step_65` → повторная публикация `Yyu3K6X95ccRlFVZDxdri`, строка
  `migrations` `2026-10-08-w140-02`. Замечание «на будущее» про «не проверено
  живьём» учтено: в «Как проверено» внесены живые прогоны Mini App на prod
  (`participants` — 55 имён, ранее «сломанные» тоже), основной сценарий закрыт
  живьём.
- **2026-10-08** — ревью круг 2: только bookkeeping — шапка журнала приведена к
  `на проверке`; хвост в `catalog/environments.md` помечен подтверждённым
  живыми прогонами; `migrations` `2026-10-08-w140-02.commit` поправлен с
  `ca2f0bf` на `970a5b2` (коммит, описывающий именно это состояние).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: независимый агент-ревьюер (opencode, `deepseek-v4.1-flash`) · **Дата**: 2026-10-08 · **Вердикт**: есть замечания

### Что проверено (живой prod через MCP `app-flow-events-prod` + репозиторий)

- **Структура** `manage-api` (`CcGPwuW4ws5hkcaOPerEG`), `ap_flow_structure(includeInput)` +
  `ap_read_step_code`: цепочки совпали с замыслом — participants
  `step_44→step_61→step_45→step_60→step_46`, search
  `step_38→step_39→step_62→step_40→step_41→step_42`, staff
  `step_19→step_63→step_52→step_20`, feedback
  `step_49→step_64→step_48→step_65→step_50`. Фильтры `telegram_id in
  {{step_NN['output'].idsCsv}}` + `limit:500` — на `step_45`(←`step_61`)/`step_40`(←`step_62`)/
  `step_52`(←`step_63`)/`step_65`(←`step_64`); `step_50.userRows = {{step_65['output']}}`;
  `step_49` — чтение `registrations` (колонка `mVfpZFCwAZskWXNT7iCuI`, фильтр `event_id eq
  {{step_5['output'].eventId}}`, `limit:200`); `step_61…64` — `[LOG OFF: input, output]`,
  `step_65` — `[LOG OFF: output]`.
- **CODE-сверка с каноном dev** (`w139-users-join-fix` / `fd8d7ff:flows/manage-api.json`,
  `step_72…75`): `step_61`↔`step_72`, `step_62`↔`step_73`, `step_63`↔`step_74`, `step_64`↔`step_75` —
  **побайтово равны** (`sourceCode.code`); `step_65`↔`step_76` — вход равен (mod ref-номер),
  отличается только пин qadam'а (`tables` 0.4.6 на prod против 0.5.1 на dev — средовая разница,
  задокументирована). Входы `step_40`/`step_45`/`step_49`/`step_50`/`step_52` равны dev-овым
  с точностью до номера ссылаемого шага.
- **Структурный дифф снапшотов** `8wizdJdhiOYAg0ab23e6e` → `VX2IszoIhTr4DdVcM3rNo`:
  добавлены ровно `step_61…65`, удалённых нет; `settings` изменены **только** у
  `step_40`/`step_45`/`step_49`/`step_50`/`step_52` (фильтр+`limit`, repurpose `step_49`,
  `userRows` у `step_50`); `step_48`/`step_50` перевязаны на новые шаги. Ветки
  `save`/`load`/`events_list`/`geo_link`/`delete` не тронуты.
- **`ap_validate_flow`** — «ready to publish (66 steps, 66 valid)».
- **Публикация подтверждена живым `ap_export_flow`**: `flows[0].id = VX2IszoIhTr4DdVcM3rNo`,
  `flowId = CcGPwuW4ws5hkcaOPerEG`, `state: LOCKED`; вывод **побайтово совпал**
  (sha256 `b9fb6f66…`) со снятым владельцем `~/qadam-snapshots/w140/prod-manage-api-VX2IszoIhTr4DdVcM3rNo.json`.
  Секретов нет: 0 токен-подобных строк, 0 коротких `{{VAR}}`, 4 `{{variables[...]}}`,
  connection-ссылки вычищены экспортом.
- **`migrations` prod** (`NCZNGuWh6PFs1JZXRPNTE`): ровно одна строка `2026-10-08-w140-01`,
  `publish`, `object_id CcGPwuW4ws5hkcaOPerEG`, `version_id VX2IszoIhTr4DdVcM3rNo`, `commit ca2f0bf`.
- **Живые прогоны после публикации** (10:58Z, `PRODUCTION`): `participants`, `feedback_list`,
  `load` — все `SUCCEEDED`. `participants` (OCSM0ZM0KdPVFVWGdnUfi) вернул **55 имён**, в т.ч.
  ранее отображавшиеся `telegram_id` свежие регистранты (`509627989`→«Как пройти регистрацию»,
  `108259963`→«Равиль Хайрулин», `782128795`→«Rustam Talipov», `7093788550`→«Жавохир Мавлонов») —
  основной дефект W139 на prod закрыт живьём. `feedback_list` прошёл `step_64→step_65→step_50`.
- **Поведение `in`+`__none__` на prod** (`ap_find_records users`, 210 строк): `in "__none__"` →
  0 записей **без ошибки**; `in "322876545,5895728710,999999999999"` → 2 (несуществующий id
  проигнорирован).
- **Scope/дрейф**: в живом экспорте нет `step_66…71` (W136), гео-ветка — прежняя
  `step_34→step_35→step_36→step_37`; пять новых шагов — ровно W139.
- **AppSec**: права/IDOR не менялись (диффом затронуты только выходы join; решающие шаги
  `step_7`/`step_20`/`step_42`/`step_46`/`step_50` и их входы `hmac`/`staff`/`event` те же);
  join только сужает выборку имён по `telegram_id`, уже прочитанным для этого события.
- **Офлайн** (с аргументами, как в хуке): `check-texts.py` — 30 флоу / 302 ссылки / 0 расхождений;
  `check-commands.py` — 3 файла строк / 0 нарушений; `check-export-secrets.sh` — чисто.
- **Откат**: снапшот `~/qadam-snapshots/w140/prod-manage-api-8wizdJdhiOYAg0ab23e6e.json`
  на месте, порядок отката описан в журнале.
- **Каталог**: `catalog/environments.md` описывает живое prod точно (210 users, `VX2…`,
  `step_61…64`/`step_65`, расхождение имён prod↔dev); `flows/*.json` и
  `catalog/flows/*.md` коммитами W140 не трогались (канон dev) — подтверждено `--stat`.

### Замечания

1. **важно** — prod `manage-api/step_65` (`feedback: read users`) **не гасит `logInput`**,
   тогда как dev-эталон `step_76` гасит **и `logInput`, и `logOutput`** (проверено: в живом
   экспорте у `step_65` стоит только `"logOutput": false`, `logInput` по умолчанию включён;
   `ap_flow_structure` показывает `[LOG OFF: output]`). Вход `step_65` несёт
   `filters[...].value = {{step_64['output'].idsCsv}}`, то есть в лог прогона ложится CSV
   `telegram_id` регистрантов события. Нового разглашения сверх уже логируемого нет
   (`step_49` логирует те же `telegram_id` полными строками `registrations`), поэтому это не
   блокер, но это расхождение с каноном dev и с целью ADR-0005. Либо выставить
   `logInput:false` на `step_65` (как в dev `step_76`), либо явно записать, что вход
   `step_65` на prod логируется намеренно. — prod `manage-api/step_65`; dev
   `flows/manage-api.json`, `step_76`.
   - *Исправлено*: `logInput:false` выставлен на `step_65`; повторная
     публикация `Yyu3K6X95ccRlFVZDxdri`, строка `migrations` `2026-10-08-w140-02`
     (2026-10-08).

2. **на будущее** — журнал в «Не проверено живьём» утверждает, что сквозного прогона Mini App
   на prod не было; фактически после публикации (`VX2…`, 10:53Z) на prod есть живые прогоны
   Mini App (`participants`, `feedback_list`, `load`, 10:58Z), и именно `participants` даёт
   доказательство основного сценария W139 (55 имён, ранее «сломанные» тоже). Стоит перенести
   это в «Как проверено», а не держать как непроверенное. — журнал W140, раздел «Не проверено живьём».
   - *Учтено*: живые прогоны (`participants` — 55 имён, `feedback_list`) внесены
     в «Как проверено» (2026-10-08).

Замечания-хвосты из ревью W139, **унаследованные** переносом (не переоткрываются здесь):
чтения-источники `step_38`/`step_44`/`step_49` остаются с `limit:200` (событие >200 регистраций
снова обрежет строки); на `step_40`/`step_45`/`step_52` логи не сняты, и их вход теперь несёт
`idsCsv` — на dev это уже записано «на будущее» [ревью W139](W139-users-join-limit.md#замечания).

## Ревью, круг 2

> Повторное ревью после ответа владельца на замечания круга 1 (коммит `970a5b2`).

- **Ревьюер**: независимый агент-ревьюер (opencode, `deepseek-v4.1-flash`) · **Дата**: 2026-10-08 · **Вердикт**: есть замечания (только `на будущее`; блокеров и «важно» нет)

### Что проверено (живой prod через MCP `app-flow-events-prod` + репозиторий)

- **Замечание круга 1 №1 (`step_65` logInput) закрыто по существу, живой prod.**
  `ap_flow_structure(includeInput)` даёт `step_65` (`feedback: read users`) →
  `configured [LOG OFF: input, output]`; живой `ap_export_flow` — `logInput: false`
  и `logOutput: false` на `step_65`. `step_61…step_64` не изменились.
- **Структурный дифф снапшотов** `VX2IszoIhTr4DdVcM3rNo` → `Yyu3K6X95ccRlFVZDxdri`
  (`~/qadam-snapshots/w140/`): из содержательных листьев изменён **ровно один** —
  `…feedback/step_49→step_64→step_48→step_65.logInput` (`<MISSING>` → `false`).
  Все прочие различия — `flows[0].id/created/updated` и `lastUpdatedDate` шагов от
  перепубликации; структура, входы, фильтры и ветки не тронуты.
- **Живая версия**: `ap_export_flow manage-api` — `flows[0].id = Yyu3K6X95ccRlFVZDxdri`,
  `flowId = CcGPwuW4ws5hkcaOPerEG`, `state: LOCKED`; `ap_list_flows` —
  ENABLED/published; `ap_validate_flow` — «ready to publish (66 steps, 66 valid)».
- **migrations (prod)**: ровно две строки — `2026-10-08-w140-01` (`version_id VX2…`)
  и `2026-10-08-w140-02` (`version_id Yyu3…`), обе `action publish`,
  `object_id CcGPwuW4ws5hkcaOPerEG`.
- **Живые прогоны**: `ap_list_runs` по `manage-api` (PRODUCTION, 50) — после
  перепубликации (`updated 2026-10-08T11:14:25Z`) прогонов **нет**; последние живые —
  11:13:43–11:13:45Z (5 шт., `SUCCEEDED`), они предшествуют публикации и шли на `VX2…`.
  `ap_get_run` `DL4remhq6IBekE3ADCifu` (`participants`) — `step_61` `REDACTED`,
  `step_46` вернул имена (55 строк), join W139 работает. Дельта круга 1 — флаг
  логирования; исполнением он не проверяется по существу, его доказывает read-back
  конфигурации (чист), а последующего регресса прогоны не показывают (их и нет).
- **Офлайн** (с аргументами, как в хуке): `check-texts.py i18n/ru.json flows/*.json` —
  30 флоу / 302 ссылки / 0 расхождений; `check-commands.py i18n/*.json flows/*.json` —
  3 файла / 0 нарушений; `check-export-secrets.sh` — rc=0. `flows/*.json` и
  `catalog/flows/*.md` коммитами W140 (`ca2f0bf`, `970a5b2`) не трогались (канон dev).
- **AppSec**: правка только сужает логирование (`logInput:false`), новых поверхностей
  не добавляет; авторизация/IDOR, HMAC, фильтры и короткая форма `{{VAR}}` не
  затронуты (диффом подтверждено отсутствие изменений вне `step_65`).

### Замечания

1. **на будущее** — шапка журнала (строка 3) — `- **Статус**: в работе`, тогда как
   `docs/STATUS.md` (строка W140) — «**на проверке**». — журнал W140, строка 3. —
   статус должен читаться одним значением; тот же пункт отмечался в W38/W101/W128.
2. **на будущее** — `catalog/environments.md` (конец раздела W140) держит «Хвост:
   живой сквозной прогон Mini App «Участники» — на владельце», тогда как журнал и
   `STATUS.md` фиксируют этот прогон **подтверждённым** (`participants`, 10:58Z).
   Одно утверждение о состоянии разошлось в двух файлах. — `catalog/environments.md`,
   конец раздела W140.
3. **на будущее** — строка `migrations` `2026-10-08-w140-02` несёт `commit ca2f0bf` —
   хэш коммита, описывающего состояние **до** правки круга 1 (`-01`), тогда как по
   определению поля ([`catalog/tables/migrations.md`](../../catalog/tables/migrations.md))
   это должен быть коммит, описывающий именно это состояние, — `970a5b2`.
   `check-migrations.py` такое не ловит (проверяет лишь существование хэша). — prod
   `migrations`, `-02`.

Оба замечания круга 1 закрыты: №1 — живой конфигурацией, №2 — переносом живых
прогонов в «Как проверено». Блокеров и «важно» нет.

## Хвосты и блокеры

- живой сквозной прогон Mini App на prod — **подтверждён** прогонами
  `participants`/`feedback_list`/`staff_list` (10:58Z); визуальная проверка
  владельцем — по желанию;
- W136 на prod (гео-ветка) — отдельный хвост, в этот пакет не входит (решение владельца 2026-10-08);
- `tools/check-migrations.py` по prod — известный хвост (нет ключа платформы), как в W134/W137.
