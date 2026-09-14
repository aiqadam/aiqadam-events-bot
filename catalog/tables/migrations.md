# Table: migrations

- **Назначение**: журнал изменений инстанса через MCP — одна строка на каждое
  создание, правку, публикацию, отключение или удаление флоу, таблицы, поля,
  переменной. Фиксирует, что инстанс приведён к состоянию, описанному в
  репозитории ([ADR-0021](../../docs/adr/0021-repo-is-source-of-truth-migrations-table.md)).
  Служебная, к домену не относится; флоу её не читают.
- **externalId таблицы**: — (обращений из qadam'ов нет) · **внутренний id**: `NCZNGuWh6PFs1JZXRPNTE`

## Поля

| Field | Type | field id | Назначение |
|-------|------|----------|-----------|
| id | TEXT | `FCctWIUM83d63nhmt1xrf` | `YYYY-MM-DD-<пакет>-<NN>`, например `2026-09-14-w31-01` |
| applied_at | DATE | `qdnTV29X4oi63UGWUNSDN` | когда изменение применено к инстансу (UTC) |
| package | TEXT | `NdowHfcysxh78zS1vqga2` | пакет работ (`W31`) |
| object | TEXT | `KD4vFPxLFNndipPmxh4gf` | `flow:<name>` / `table:<name>` / `variable:<NAME>` |
| object_id | TEXT | `qpFhH793jITIaorG1AX1r` | flowId / внутренний id таблицы |
| action | STATIC_DROPDOWN | `gJdq91ajepkZJ64TcYBuY` | `create` / `update` / `publish` / `disable` / `delete` |
| version_id | TEXT | `uqruSlVanoYJq3joZuzub` | id опубликованной версии флоу (= `publishedVersionId` в `flows/_manifest.json`); у таблиц — `-` |
| commit | TEXT | `RANWChjPkHjgyC8SQg5NB` | хэш коммита репозитория, описывающего это состояние |
| note | TEXT | `eOCgHeXGFpPhvG5KbSyvY` | одной строкой — что изменилось |

## Заметки

- **Пишет тот, кто менял инстанс, тем же пакетом** — через `ap_insert_records`
  (MCP), не флоу. Ревьюер сверяет последнюю строку по объекту с
  `flows/_manifest.json` (`publishedVersionId`) и `ap_list_flows`.
- **Одна публикация — одна строка `publish`** с `version_id`; правки
  черновика между публикациями отдельными строками не пишутся — их состояние
  не видит пользователь.
- **Удаление флоу — строка `delete`** до самого удаления: после него
  `ap_get_run` по его прогонам отвечает «not found», и строка — единственный
  след.
- Пропущенная строка ничем не ловится, кроме ревью — это названная цена
  ADR-0021.
