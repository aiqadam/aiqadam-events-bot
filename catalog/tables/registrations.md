# Table: registrations

- **Назначение**: регистрации и чекины (IDM-1, IDM-2, OWN-6, OWN-7, OWN-9).
- **externalId таблицы**: `SM8tMxfQuQCHRDdAiNJyQ` · **внутренний id**: `a87VoexSxH2QEj4JBhSgn`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `BGTxyxBZqagpqUB3UqXta` | `HHsc0mC7zy1Fe0i18FkoF` | |
| event_id | TEXT | `qQPYl9c0ew6n8w2CGYZII` | `cQmSSShQIJlKQrrpGmMU4` | → `events.id` |
| telegram_id | TEXT | `mVfpZFCwAZskWXNT7iCuI` | `PTCaiF607xJfU2SQVdy77` | → `users.telegram_id` |
| status | STATIC_DROPDOWN | `TZyqC63UAWrPbzxuf2q4w` | `oLh0DFSDeTzwcyyDrX9tI` | `registered` / `cancelled` |
| source | TEXT | `WFWifafyD6UNNCxLQyML1` | `96zj8GQkUIg1Glsc2AoRP` | utm из `?start=e<id>-<utm>` (OWN-6) |
| registered_at | DATE | `RZYFhQBQbSfNzIVEvmYgd` | `RjFOIwzEr6eDDppY1um6L` | UTC |
| cancelled_at | DATE | `OlFAWgVQmrqhqxlraOPOZ` | `InbZuKVX15wI6vkXldP0q` | UTC |
| checked_in_at | DATE | `uCnpOj11sJLaX4Rqu6TUG` | `U7St4I3LojwMYiyCOxwFY` | пусто = не пришёл; пишется один раз (IDM-2) |
| checked_in_by | TEXT | `atmJzUFotSzE9G0akUU2M` | `HST3mLOt06tdhs5eQeuQ9` | `telegram_id` контролёра |

## Заметки

- **Уникальность `(event_id, telegram_id)` — соглашение флоу, не БД.** Проверено:
  три строки с одной парой вставляются подряд без жалоб. Чтение — только через
  эталон [`find-registration`](../snippets/find-registration.md), который берёт самую раннюю (ADR-0003).
- «Не пришёл» ищется фильтром `checked_in_at not_exists`: проверено, он
  ловит и `null`, и пустую строку.

## `cancelled_at` — не источник истины о статусе (Q30, 2026-09-12)

У **реактивированной** регистрации `cancelled_at` остаётся от прошлой отмены:
очистить DATE-поле через qadam `tables` сейчас нечем — пустая строка отвергается
валидатором дат, а «оставить пустым» у пропа `values` означает «не менять».

**Следствие, обязательное к соблюдению:** статус пары `(event_id, telegram_id)`
определяется полем **`status`**. Строка со `status = registered` и непустым
`cancelled_at` — нормальное состояние, а не противоречие в данных.
Списки участников и экспорт (OWN-8) обязаны фильтровать по `status`.

Подробности и путь к устранению — [Q30](../../docs/OPEN-QUESTIONS.md#q30).
