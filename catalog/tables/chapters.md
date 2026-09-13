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

# Table: chapters

- **Назначение**: чаптеры сообщества. Заведена заранее, чтобы второй чаптер
  не требовал миграции; правами и видимостью пока не управляет ([Q8](../../docs/OPEN-QUESTIONS.md#q8)).
- **externalId таблицы**: `yRaGKY6Rhmn6m3SKUBmOV` · **внутренний id**: `h7YMTNWbWzFG03kDFJqza`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `1p3oCEU2NpBmogWbSMik1` | `jMXytEIc8xrct611oBAor` | slug |
| title | TEXT | `DdBqUEqfBfXSbd1Z8dvIQ` | `6uPenMJiLykUVKEZGejEs` | |
| created_at | DATE | `ulaB5lZvdRM51GY0xT7Yd` | `GXlqnzeZGBc4nfZGdk4X5` | |

## Заметки

- Таблица пуста и остаётся пустой до решения Q8. Ни один флоу от неё не зависит.
