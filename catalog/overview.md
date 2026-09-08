# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

**Состояние на 2026-09-08:** 10 таблиц (W1), flows пока нет, один connection
(шаг 0.2). Сборка флоу начинается с W2.

## Flows

| Flow | Триггер | Назначение | Файл |
|------|---------|-----------|------|
| — | — | — | — |

## Таблицы

Заведены в W1. Идентификаторы, dropdown-значения и рецепт пересборки —
[tables/README.md](tables/README.md).

| Таблица | Назначение | externalId | Файл |
|---------|-----------|-----------|------|
| `users` | люди, язык, согласия (DAT-1, PAR-1, PAR-2) | `z5PX9B8mTQC9Q6Dfuj5dM` | [users.md](tables/users.md) |
| `events` | ивенты, время, место, статус (OWN-2…OWN-4) | `kVLg1FSfDBtsP32FGPk3P` | [events.md](tables/events.md) |
| `chapters` | чаптеры, заведена под будущее (Q8) | `yRaGKY6Rhmn6m3SKUBmOV` | [chapters.md](tables/chapters.md) |
| `registrations` | регистрации и чекины (IDM-1, IDM-2) | `PNuChoFG0tIBTND86yzDL` | [registrations.md](tables/registrations.md) |
| `event_staff` | права контролёра на конкретный ивент (STF-2) | `CyW6KjJ2BdwQEph2KEqTt` | [event_staff.md](tables/event_staff.md) |
| `staff_invites` | одноразовые инвайты staff на 24ч (OWN-14) | `TrHzP09CQTbpU14FPBZLQ` | [staff_invites.md](tables/staff_invites.md) |
| `broadcasts` | рассылки, прогресс, курсор (OWN-10…OWN-13) | `RtlPCu8KxBRPHCX62ifhc` | [broadcasts.md](tables/broadcasts.md) |
| `broadcast_targets` | снимок получателей рассылки | `lg5rQmGCnNrbAJSAQOUfX` | [broadcast_targets.md](tables/broadcast_targets.md) |
| `sessions` | состояние визардов, `draft` — JSON строкой | `tL4fbi1GisDwA8UJ9zSod` | [sessions.md](tables/sessions.md) |
| `strings` | рабочая копия i18n (I18N-2) | `qi6bBTL7plRGBgFUfli8w` | [strings.md](tables/strings.md) |

Все таблицы пусты: пробные записи W1 удалены после проверок.

## Переменные

См. [variables.md](variables.md).

## Connections

См. [connections.md](connections.md).

## Схема потоков данных

Целевая схема описана в [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои)
и [FLOWS.md](../docs/FLOWS.md). Заполняется здесь по мере сборки.
