# Table: event_staff

- **Назначение**: права контролёра **на конкретный ивент** (STF-2, OWN-14).
  Глобального staff не существует (DAT-3).
- **externalId таблицы**: `t1g8Vae3iEoDk93D6Rle7` · **внутренний id**: `qCKQP80B4OHEPCZ6ZZCaj`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| event_id | TEXT | `r5WohfFLBagrxVrPDgB9s` | `jp9rDW4F9hvGHKWN2zgMj` | → `events.id` |
| telegram_id | TEXT | `Rs62LH1YLr1QBsnpIrJzH` | `v5M9SnKGvjX35khex8mpN` | → `users.telegram_id` |
| granted_by | TEXT | `0wfqdr7vveoyWxJqjymZP` | `Cidg7WXixthi8G1GAXpXO` | кто выдал |
| granted_at | DATE | `QaIIhE43IKDzM34FDP8VP` | `FZub9qIdFBwRFJzyZ2zdP` | UTC |
| revoked_at | DATE | `zX2FO3bZZJuAZcVyZHiRw` | `LoLJWb9OyoWu7bvARKlQy` | пусто = права активны (OWN-14) |

## Заметки

- Проверка прав (STF-2) = «есть строка с этим `event_id`, этим `telegram_id`
  и пустым `revoked_at`». Фильтр по `event_id` обязателен: «пользователь вообще
  где-то staff» — это баг, любой участник отметит соседа.
