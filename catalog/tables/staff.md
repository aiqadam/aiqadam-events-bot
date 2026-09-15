# Table: staff

- **Назначение**: глобальные права организаторов, ограниченные чаптером
  ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)):
  строка в `staff` даёт право **создавать и править** ивенты своего чаптера.
  Больше ничего: чекин — `event_staff` (STF-2), контакты — `users`.
- **externalId таблицы**: `PnDy6gw9tlLUqTGk2EOUn` · **внутренний id**: `5i6S4oXMalV0dGII7GNxt`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `ecOXPzqTqu2ktJ2Uj330k` | `qfAUeRaI9qmZCizV8dNKg` | единственный ключ (DAT-1) |
| chapter_id | TEXT | `GJtF4zTRpzLjZWhM3cmMd` | `thFbiP83v33fm1QuvjAXC` | `chapters.id`; пусто = все чаптеры |
| note | TEXT | `5p9I3gclMTwZQ8AG24ERy` | `JMFAEfEntsP0wTfPfsA4a` | справочно |
| added_at | DATE | `Scer5WFiCi5CyfMkLlKpT` | `CLaJmEvLYHQ7EAWNgrhnC` | UTC |

## Заметки

- **Логика доступа — в `manage-api`**, не в запросах: чтение берёт все строки
  по `telegram_id` (лимит 1), решение «свой чаптер / пусто» принимает CODE-шаг.
  Постфильтр по `telegram_id` в коде повторяет фильтр шага (defense in depth, Q25).
- **Пустой `chapter_id` = все чаптеры.** Значение по умолчанию безопасно ровно
  настолько, насколько доверен список `staff` (цена названа в ADR-0024).
- **Ведёт человек в UI платформы.** Первая строка — `322876545` (`return_void_0`),
  `chapter_id = 1`; заводится [W32](../../docs/work/W32-owners-initdata.md).
- Не путать с [`event_staff`](event_staff.md) — там контролёры конкретного
  ивента (per-event), здесь глобальный список организаторов (per-chapter).
