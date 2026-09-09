# Table: sessions

- **Назначение**: состояние визардов (создание/правка ивента, составление рассылки).
  Памяти процесса у флоу нет.
- **externalId таблицы**: `tL4fbi1GisDwA8UJ9zSod` · **внутренний id**: `1ffo6zKnrUPJDXSB1Oduz`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `74TuBqW5EdFq2VZo7Da81` | `RtikPovQ4yekuyyx95n0q` | одна активная сессия на человека |
| scenario | TEXT | `uNx8kOWIpa6ZZguE9hfuf` | `vlKI7py7SBTcCKEmokSwB` | `event_create` / `event_edit` / `broadcast` / `registration` (W5) |
| step | TEXT | `XbSpXk0XD4Ixf4dt9zsnJ` | `p1HQ0Rww4Yyw1gkn7ZF9y` | текущий шаг визарда |
| draft | TEXT | `x29VFvZnmmaMm5E2T0Iap` | `67Nx2qs4APWZ22tcv0tS0` | **JSON строкой** — своего типа нет |
| updated_at | DATE | `6Waw1f9cqNQ7j30QBG0XA` | `26R7kSdsQbjjWF8mLsHN7` | сессии старше 24ч протухли |

## Заметки

- `draft` проверен на round-trip: строка с `"кавычками"`, `\n`, кириллицей,
  вложенным массивом и `null` вернулась байт в байт. `JSON.parse` в Code step
  разбирает её без оговорок.
- `scenario` оставлен `TEXT`, а не dropdown: список сценариев меняется чаще,
  чем хочется править схему, и валидации от dropdown всё равно нет.
