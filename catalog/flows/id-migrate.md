# Flow: id-migrate

- **Статус**: ENABLED (опубликован). Ничего не отправляет, пока `migration_mode` не `test`/`real` и окно
  `migration_open_until` не открыто (≤ 4 ч); значение покоя `migration_mode` — `off`.
- **Триггер**: Manual Trigger (`@aiqadam/qadam-manual-trigger`), вывод не логируется.
- **Назначение**: перенос людей из `users` в AI Qadam ID подписанными батчами с итоговой сверкой
  ([ADR-0058](../../docs/adr/0058-id-migrate-users-to-id.md), ID ADR-0030).
- **Flow ID (MCP)**: `raJocIqi0OWCm9MrnIDTo`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | @aiqadam/qadam-manual-trigger : manual_trigger | запуск владельцем |
| step_1 `claim run lock` | @aiqadam/qadam-store : put_if_absent | `mig:lock`, TTL 3600 — один прогон за раз |
| step_2 `lock?` | ROUTER | `locked by this run` = `step_1.stored`; иначе `Otherwise` |
| step_3 `refused: another run` | CODE | *(Otherwise)* `{ok:false, reason:'locked'}` |
| step_4 `read users` | tables : tables-find-records | *(locked)* `users`, 17 сопоставленных колонок, без `phone`, без `limit` |
| step_5 `read users consent_pdn=true` | tables : tables-find-records | сверочное чтение (RT-9) |
| step_6 / step_7 | tables : tables-find-records | то же для `mig_test_users` |
| step_8 `preflight` | CODE ([id-migrate-preflight](../snippets/id-migrate-preflight.md)) | проверки, ожидаемые числа, батчи |
| step_9 `report preflight` | CODE | только числа — в журнал |
| step_10 `send?` | ROUTER | `send` = `step_8.send`; иначе `Otherwise` |
| step_11 `release lock (nothing sent)` | store : remove_value | *(Otherwise)* снять `mig:lock` |
| step_12 `batches` | LOOP_ON_ITEMS | *(send)* по батчам, SEQUENTIAL, STOP, тела итераций не хранятся, `collected` = выходы `send` |
| step_13 `send` | CODE ([id-migrate-send](../snippets/id-migrate-send.md)) | подпись и отправка батча в `migrate-import` |
| step_14 `verify` | CODE ([id-migrate-verify](../snippets/id-migrate-verify.md)) | digest и суммы в `migrate-verify`; `pass` |
| step_15 `release lock` | store : remove_value | снять `mig:lock` |

## Зависимости

- **Таблицы**: `users` (чтение), `mig_test_users` (чтение).
- **Переменные**: `migration_key`, `migration_open_until`, `migration_mode`, `migration_run`,
  `id_migrate_import_url`, `id_migrate_verify_url`.
- **Connections**: —

## Заметки

- **Логирование выключено**: вывод триггера, все чтения, `preflight`, цикл, `send`, вход `verify`.
  Логируются: результат блокировки (`stored`, имя прогона), `report preflight` и выход `verify` — только
  числа и флаги.
- **Режимы**: `dry-test`/`dry-real` — только `report preflight`; `test` — `mig_test_users`; `real` — `users`.
  Читаются обе таблицы всегда, выбор — в `preflight`: ветки в этом движке не сходятся, а таблица в
  `table_id` статична.
- **Упавший прогон оставляет `mig:lock`** до конца TTL (1 ч): так второй прогон не начнётся поверх
  незавершённого.
- Ошибка батча — `batch_failed: <статус> <код>`, без id и без тела.
