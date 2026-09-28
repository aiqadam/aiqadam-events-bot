# Table: registrations

- **Назначение**: регистрации и чекины (IDM-1, IDM-2, OWN-6, OWN-7, OWN-9).
- **externalId таблицы**: `SM8tMxfQuQCHRDdAiNJyQ` · **внутренний id**: `a87VoexSxH2QEj4JBhSgn`

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

- **Уникальность `(event_id, telegram_id)` объявлена в БД** ([ADR-0047](../../docs/adr/0047-unique-keys-and-types-after-audit.md), W113b):
  upsert идёт через `ON CONFLICT`, повторная вставка той же пары — `RECORD_DUPLICATE_KEY`;
  читать по-прежнему через [`find-registration`](../snippets/find-registration.md).
- «Не пришёл» ищется фильтром `checked_in_at not_exists`: проверено, он
  ловит и `null`, и пустую строку.

## `cancelled_at` согласован со `status` (W109, 2026-09-28)

Реактивация строки очищает `cancelled_at` явным per-row `__clear: [OlFAWgVQmrqhqxlraOPOZ]`
(`@aiqadam/qadam-tables` 0.4.6) в создающих/реактивирующих шагах:
`reg-consent-pdn/step_5`, `reg-api/step_11`/`step_18`,
`reg-profile/step_23`/`step_29`. Инвариант: `status = registered` — пустой
`cancelled_at`, `status = cancelled` — непустой.

Статус пары `(event_id, telegram_id)` по-прежнему определяется полем
**`status`** (он первичен); списки участников и экспорт (OWN-8) фильтруют по
нему. История — [Q30](../../docs/OPEN-QUESTIONS.md#q30).
