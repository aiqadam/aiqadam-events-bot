# W98. Удаление строк таблиц на инстансе

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: Phase 0 ([issue #150](https://github.com/aiqadam/aiqadam-events-bot/issues/150))
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Выяснить, как `tables` удаляет строки (пустой список, несуществующий id,
hard/soft delete, лимиты). Разблокирует #118, #125 (вариант B), #138.
Итог — безопасный паттерн удаления в «Gotchas» `AGENTS.md`.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| временная таблица `tmp_delete_test` | внутр. id `rHhztblJJClOlmuzJbIKx`, externalId `0sQukymfRfAVMsT2g5xYs` | — (удалена, в каталог не входит) |
| временный flow `tmp-delete-test` | `fm14BJJiPY1sxBWNZcblX` | — (удалён, не экспортируется) |

## Чек-лист готовности

- [x] Все 7 пунктов отвечены
- [x] Безопасный паттерн удаления записан в `AGENTS.md` («Gotchas»)
- [x] Временная таблица и флоу удалены, записи в `migrations` (`2026-09-23-w98-01…04`)
- [x] `catalog/` совпадает с живым проектом (временные артефакты в каталог не входят,
      живые флоу/таблицы не тронуты)

## Ответы (#150)

1. **Действия удаления.** `tables-delete-record` — параметры `table_id`
   (externalId таблицы!) и `records_ids` (ARRAY внутренних id записей).
   Есть также `tables-clear-table` (удалить все строки). Удаления «по фильтру»
   нет — только по id.
2. **Пустой `records_ids`.** Статически пустой массив нельзя даже сохранить
   в шаге: `ap_update_step` отвечает «This update would clear required input».
   В рантайме пустой список падает `400 body/ids required`
   (не 404, как было записано в ARCHITECTURE до этого пакета).
   `continueOnFailure` помогает: прогон `sa51A6xqWtuIGjgQv1iLx` — `SUCCEEDED`,
   шаг помечен ❌ с телом ошибки.
3. **Несуществующий id.** Падает `404 ENTITY_NOT_FOUND` (не тихо):
   прогон `NYlhIZlSjl7xNSHNMfnBT` на id `does-not-exist-000`.
4. **Удаление жёсткое.** Строка сразу исчезает из `tables-find-records`
   (после удаления `k1` выборка начинается с `k2`; после удаления всех 50 —
   «No records found»). Восстановить нельзя.
5. **Только по id.** Фильтра у действия нет, поэтому всегда `find` → id →
   `delete`. `tables-clear-table` — для полной очистки таблицы.
6. **Лимит и время.** Одним вызовом удалялись 1, 10, 38 и 50 записей — все
   успешно, шаг `tables-delete-record` в прогоне каждый раз 0,1 с
   (разрешение лога). Потолок до 50 не встречен.
7. **REST DELETE.** По [ADR-0018](../../docs/adr/0018-rest-read-for-everyone.md)
   `POST`/`PATCH`/`DELETE` запрещены всем; проверил только документами,
   не вызывал.

## Как проверено

- `ap_run_action` `tables-delete-record` с пустым списком →
  `400 body/ids required` (run `mYMaGWFt4KJbjX8DVDRx5`);
- `ap_run_action` с несуществующим id → `404 ENTITY_NOT_FOUND`
  (run `NYlhIZlSjl7xNSHNMfnBT`);
- `ap_run_action` с одним реальным id → `{"success":true}`
  (run `kiXlEmBQTFBaRPxOT6lI2`), `find` подтвердил исчезновение строки;
- временный flow `tmp-delete-test` (callableFlow + один `tables-delete-record`):
  1 строка `HPe5rsM7JgGeJySN7SftV`, 10 строк `ITKtTKKs3PIkdDIpeolm6`,
  38 строк `iGWR8wYRB5mYittKN59Jv`, 50 строк `Qf5f7Vv7oz6GcThkgAbIQ` —
  все `SUCCEEDED`, шаг 0,1 с;
- `continueOnFailure: true` + несуществующий id → прогон `SUCCEEDED`,
  шаг ❌ (run `sa51A6xqWtuIGjgQv1iLx`).

Выводы прогонов скопированы сюда до удаления временного флоу: `ap_get_run`
по ним после удаления отвечает «not found».

**Читаемое доказательство (ответ на ревью, замечание 2).** Те же ключевые
факты заново собраны в живой временной паре `tmp_delete_demo` +
`zz-w98-delete-demo`, которая **держится до вердикта повторного ревью**
(приём из гочи 17/17, как `zz-diag-skip-primitive`), а затем удаляется.
Прогон `8fQ3S9LiPT3kvxoYmUqXB` (`ap_test_flow`) читается через `ap_get_run`:

- `step_1` `tables-delete-record` реального id → `{"success":true}` (hard
  delete: строки `d1` больше нет);
- `step_2` `tables-delete-record` несуществующего id с `continueOnFailure` →
  шаг ❌ `404 ENTITY_NOT_FOUND`, прогон `SUCCEEDED` (ошибка поймана);
- `step_3` `tables-find-records` → остались только `d2`/`d3` (`d1` исчез).

Это покрывает hard-delete, 404 и `continueOnFailure` живой читаемой трассой.
Пустой список остаётся непокрытым флоу: статически его валидатор не
сохраняет, а `ap_run_action`-прогоны не читаются — факт (пустой список →
`400 body/ids required`) зафиксирован в ARCHITECTURE и в гоче 18.

## Журнал

- **2026-09-23** — **ревью круг 1** (независимый агент): блокеров нет, два
  «важно» — (1) #150 без Result-комментария, (2) временный флоу удалён до
  вердикта, прогоны нечитаемы. Исправления: Result-комментарий опубликован;
  читаемая временная пара `tmp_delete_demo` + `zz-w98-delete-demo` собрана и
  держится до вердикта повторного ревью (см. «Как проверено»); гоча 18
  дополнена кросс-ссылкой на гочи 1/12.
- **2026-09-23** — пакет взят.
- **2026-09-23** — первая попытка `ap_run_action` с внутренним id таблицы
  (`rHhztblJJClOlmuzJbIKx`) упала: «Table with externalId … not found».
  У `tables`-шагов `table_id` — **externalId** из
  `ap_resolve_property_options`, а `ap_list_tables`/`ap_find_records` отдают
  внутренний id; это разные строки (для `tmp_delete_test` —
  `0sQukymfRfAVMsT2g5xYs` против `rHhztblJJClOlmuzJbIKx`). Дальше работал
  с externalId.
- **2026-09-23** — статически пустой `records_ids` валидатор шага не пропускает
  вовсе, поэтому «пустой список» проверен через `ap_run_action` (там проходит)
  и через `continueOnFailure` на несуществующем id.
- **2026-09-23** — попутно уточнён `ARCHITECTURE.md`: у пустого списка сейчас
  `400 body/ids required`, а 404 — это несуществующий id.
- **2026-09-23** — после удаления артефактов в `migrations` добавлены строки
  `2026-09-23-w98-01…04` (create+delete для таблицы и флоу), `commit 56cc087`.
  `tools/check-migrations.py` локально **не прогнан** — нет ключа платформы
  (та же оговорка, что у W12b/W12c: на W15/a приёмке). Состав проверен через
  MCP: `ap_list_flows`/`ap_list_tables` — временных объектов нет.

## Ревью

- **Ревьюер**: review-agent · **Дата**: 2026-09-23 · **Вердикт**: есть замечания

### Проверено

- MCP (`events-dev`): таблицы `tmp_delete_test` нет (`ap_list_tables`), флоу
  `tmp-delete-test` нет (`ap_list_flows`; 31 флоу, из них два `zz-*` —
  не артефакты W98). В `migrations` 4 строки `2026-09-23-w98-01…04`, package
  W98, commit `56cc087`, object `table:tmp_delete_test`/`flow:tmp-delete-test`,
  последняя по каждому объекту — `delete`.
- `ap_get_piece_props tables-delete-record`: `table_id` (DROPDOWN, «Use the
  returned value (ID)»), `records_ids` (ARRAY, required); удаления по фильтру
  нет; `tables-clear-table` есть — пп. 1/5/6 подтверждены по составу.
- `docs/ARCHITECTURE.md:188–189` уточнён (пустой список → `400 body/ids
  required`, несуществующий id → `404 ENTITY_NOT_FOUND`); `AGENTS.md` гоча 18
  добавлена, гочи 1 и 12 не тронуты.
- `flows/`, `flows/_manifest.json`, `catalog/` временных артефактов не
  содержат; офлайн-проверки (`check-export-secrets.sh`, `check-texts.py`,
  `check-commands.py`, `check-agents.py`, `prototypes/check.mjs`) — все exit 0.
- **Не проверено**: `check-migrations.py` не запускается — ключа платформы нет
  (та же оговорка, что у владельца; строки `migrations` сверены вручную через
  MCP); все прогоны W98 недоступны — временный флоу удалён (`ap_get_run`/
  `ap_list_runs` → not found).

### Замечания

1. **важно** — issue [#150](https://github.com/aiqadam/aiqadam-events-bot/issues/150)
   без комментария-Result: 0 комментариев. #117 прямо требует «Each result is
   a comment in the issue using its "Result" template», и #148/#149 его имеют.
   Итог W98 существует только в журнале — для фазового гейта #117 это дыра.
   - *Исправлено*: Result-комментарий опубликован в #150 (2026-09-23).
2. **важно** — доказывающий временный флоу удалён до вердикта ревью, поэтому
   ни один прогон W98 не читается: `ap_get_run`/`ap_list_runs` по ним отвечают
   «not found». Центральные факты (1/10/38/50 записей, пустой список, 404,
   `continueOnFailure`) непроверяемы, а в журнале — выводы, не сырые
   envelope. Это ровно случай, от которого предупреждает гоча 11
   («доказывающие временные флоу не удалять до вердикта ревью»). DoD #150
   требует удаления, но безопасный порядок — держать артефакт до вердикта
   (и/или сохранять сырые выводы в журнал до удаления).
   - *Исправлено*: собрана и **держится до вердикта повторного ревью** живая
     временная пара `tmp_delete_demo` + `zz-w98-delete-demo` (приём гочи 17);
     читаемый прогон `8fQ3S9LiPT3kvxoYmUqXB` покрывает hard-delete, 404 и
     `continueOnFailure` (см. «Как проверено»). После вердикта пара удаляется,
     в `migrations` — строки delete.
3. **на будущее** — гоча 18 вводит внутренние id записей как параметр
   PIECE-шага (`records_ids`), что читается против гочи 1 («внутренний id —
   только в CODE-шагах»). Прямого противоречия нет (гоча 1 — про ключи
   `values`).
   - *Исправлено*: в гоче 18 добавлена явная кросс-ссылка на гочи 1/12
     (2026-09-23).

## Хвосты и блокеры

- `tools/check-migrations.py` без ключа платформы локально не запускается —
  прогнать с ключом на ревью/приёмке (W15).
