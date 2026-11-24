# W144. Перенос `users` в AI Qadam ID — `id-migrate` в `events-dev`

- **Статус**: в работе (QA-часть собрана и проверена; реальный прогон ждёт принятия ADR-0058)
- **Владелец**: агент (сессия AI Qadam ID, пакет ID W06)
- **Волна**: вне волн
- **Зависит от**: ID ADR-0030, ADR-0031 (приняты), ID W06 — потоки `migrate-import`, `migrate-verify`, `migrate-undo` на ID QA
- **Начат**: 2026-11-24 · **Закрыт**: —

## Цель

Перенести людей из `users` (`events-dev`) в AI Qadam ID QA подписанным импортом внутри платформы,
со сверкой числами и digest, без данных людей в логах и у агента
([ADR-0058](../adr/0058-id-migrate-users-to-id.md)).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `id-migrate` | `raJocIqi0OWCm9MrnIDTo`, версия `tV1Ej9rg4bMwq21NfY4Vh` | [catalog/flows/id-migrate.md](../../catalog/flows/id-migrate.md) |
| таблица `mig_test_users` | `dPiHO4jTUG2N4U31krOS2` | [catalog/tables/mig_test_users.md](../../catalog/tables/mig_test_users.md) |
| эталоны | `id-migrate-preflight`, `id-migrate-send`, `id-migrate-verify` + тесты | [catalog/snippets/](../../catalog/snippets/README.md) |
| переменные | `migration_key`, `migration_open_until`, `migration_mode`, `migration_run`, `id_migrate_import_url`, `id_migrate_verify_url` | [catalog/variables.md](../../catalog/variables.md) |

## Чек-лист готовности

- [x] Эталоны с тестами (22 + 15 + 12), офлайн
- [x] `dry-test`, `test` на выдуманных строках: числа совпали с ожиданием, `pass: true`
- [x] Принудительный `401`: прогон падает на первом батче, ID отвечает `bad_signature`, повтора нет
- [x] Все шаги с людьми и ключом — `**REDACTED**`
- [x] `dry-real`: ожидаемые числа записаны (ниже)
- [ ] ADR-0058 принят владельцем
- [ ] Реальный прогон: `pass: true`, числа = ожидаемым
- [ ] Независимое ревью
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

Прогоны `ap_test_flow` (ручной триггер, вход пустой):

- `s6MH7SVth6FU59FRoOqCY`, `dry-test` → `rows 13, distinct 12, merged_dupes 1, left_behind 1`,
  `expected {sent 11, base 11, module 11, mailing 2}`, 2 батча; ничего не отправлено, блокировка снята.
- `4hA4YocykVFdyhJyxPD11`, `test`, прогон `qa-2026-11-24b` → `pass: true`: `sent 11, skipped 1,
  members_inserted 9, members_existing 1, skipped_deleted 1, created {base 10, module 10, mailing 2}`,
  ID `match: true, marked 10`. Точно по прогнозу: выдуманный 101 имеет строку `deletion_log` в ID,
  выдуманный 103 уже был членом ID.
- `UovAeSmKuy4M7tCbLSieR`, `dry-real` → живые `users`: см. «Ожидаемые числа».
- `9IiGUMGgzTd7kBqry54JJ`, `test` с неверным `migration_key` → FAILED на `step_13`; в ID прогон
  `migrate-import` `i1anErFOjkt43cuLyIx6B` — `401 bad_signature`, одна попытка. Текст ошибки шага
  через MCP не виден (инструмент не отдаёт шаги внутри цикла); формат проверен тестом эталона.

Во всех прогонах вывод триггера, чтения, `preflight`, цикл — `**REDACTED**`; видимы только блокировка,
`report preflight` и выход `verify` (числа).

## Ожидаемые числа реального прогона (из `dry-real`, 2026-11-24 12:18 UTC)

| | |
|---|---|
| строк `users` | 121, все id разные, дублей нет |
| `consent_pdn` | `true` 116, пусто 5, `false` 0 |
| `consent_marketing` | `true` 81, `false` 21, пусто 19 |
| `blocked_bot` | `true` 76, `false` 45 |
| аномалии | 0 (сверка чтений сошлась) |
| к отправке | **116**: `base` 116, `module` 116, `mailing` 81; остаются 5 |
| батчей | 12 |

Проход: `pass: true`, и по каждой цели `created + existing + пропущенные = ожидаемое`. Люди с датой
согласия раньше 2026-09-08 будут `skipped_bad` (правило ID ADR-0030 §3) — их число станет видно только
в ответе ID.

## Журнал

- **2026-11-24** — Пакет взят из сессии ID (W06). Локальная копия репозитория отставала на 284 коммита;
  обновлена до `38857a1`, схема `users` сверена (не менялась с инвентаризации ID W06). Ключ
  `telegram_id` в `users` теперь объявлен в БД (ADR-0047) — на перенос не влияет.
- **2026-11-24** — Собран `id-migrate` (16 шагов), `mig_test_users` (13 выдуманных строк), 6 переменных.
  Чтение обеих таблиц всегда и выбор в `preflight` — потому что ветки не сходятся, а `table_id` статичен.
  Отправка — `fetch` в Code step, а не HTTP-qadam: повтор подписывается заново со свежим `request_id`.
  После прогонов: `migration_mode = off`, ключ восстановлен; `mig:lock` от упавшего прогона истекает
  около 13:18 UTC.
- **2026-11-24** — Экспорт `flows/id-migrate.json` через MCP (версия `tV1Ej9rg4bMwq21NfY4Vh`); код шагов
  `step_8`, `step_13`, `step_14` совпал с эталонами байт в байт. Строки `migrations` `2026-11-24-w144-01..08`
  (commit `f3d0e6e`). `tools/check-migrations.py` падает до сверки на старой строке `2026-10-05-w135-02`
  (`applied_at` — дата без времени, Python 3.14 не сравнивает её с временем с зоной). С поправкой «без зоны
  = UTC» в памяти: по W144 расхождений 0; 28 старых (B1 `fn-hmac-init-data`, B4, C — коммиты-метки и
  форматы) — не этого пакета, не трогал.

## Ревью
