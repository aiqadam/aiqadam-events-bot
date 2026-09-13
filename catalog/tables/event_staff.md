> # ⛔ ТАБЛИЦА НЕ СУЩЕСТВУЕТ
>
> Инстанс `events-dev` очищен владельцем проекта **13.09.2026**: таблиц в проекте
> ноль. Все идентификаторы ниже — и `externalId`, и внутренний `id`, и id полей —
> **мертвы**; при пересборке платформа выдаст новые
> ([tables/README.md](README.md#два-namespaceа-идентификаторов--главная-ловушка)).
>
> **Схема полей ниже актуальна и есть спека для пересборки.** Идентификаторы —
> нет. Пересборка идёт пакетом
> [W26](../../docs/work/W26-rebuild-on-one-touch.md).

# Table: event_staff

- **Назначение**: права контролёра **на конкретный ивент** (STF-2, OWN-14).
  Глобального staff не существует (DAT-3).
- **externalId таблицы**: `CyW6KjJ2BdwQEph2KEqTt` · **внутренний id**: `VGAwAHHdqwZ5HClegiaFX`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| event_id | TEXT | `0AipPIr6eNpcSRKOOKYHa` | `s3k20LTKlfBERVJpnE7nH` | → `events.id` |
| telegram_id | TEXT | `3qeJoI9px9XeexnoKule3` | `2L1K3gDNCk9MpMlFbKn0R` | → `users.telegram_id` |
| granted_by | TEXT | `1bqMNUsGp6mu7FR2NPzJ7` | `gzvGWnv10fIXPTAnA7a5H` | кто выдал |
| granted_at | DATE | `iPuiQ94ukJDRNkveRnH3e` | `yxqC091WOmveptuyCku4Y` | UTC |
| revoked_at | DATE | `gAmh2DlmC2ettBV0cRMtR` | `jdxPgqfEuPUSCwENpL3Uc` | пусто = права активны (OWN-14) |

## Заметки

- Проверка прав (STF-2) = «есть строка с этим `event_id`, этим `telegram_id`
  и пустым `revoked_at`». Фильтр по `event_id` обязателен: «пользователь вообще
  где-то staff» — это баг, любой участник отметит соседа.
