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
- [x] Временная таблица и флоу удалены, записи в `migrations`
- [ ] `catalog/` совпадает с живым проектом

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

## Журнал

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

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- <заполняется>
