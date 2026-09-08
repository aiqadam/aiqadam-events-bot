# W1. Таблицы

- **Статус**: на проверке
- **Владелец**: агент (Claude Code, сессия barustamov)
- **Волна**: 1
- **Зависит от**: W0
- **Начат**: 2026-09-08 · **Закрыт**: —

## Цель

Завести в проекте `events-dev` все таблицы из [DATA-MODEL.md](../DATA-MODEL.md)
и зафиксировать схему в репозитории так, чтобы её можно было воспроизвести
в другом проекте. `events-prod` в цель не входит (решение 2026-09-08, см. BACKLOG).

## Что построено

10 таблиц в `events-dev`. Идентификаторы полей и рецепт пересборки —
[catalog/tables/README.md](../../catalog/tables/README.md).

| Таблица | externalId (для qadam'а) | внутренний id (для MCP) | Каталог |
|---------|--------------------------|-------------------------|---------|
| `users` | `z5PX9B8mTQC9Q6Dfuj5dM` | `vWhLIDzqSFF0brn7bdF47` | [users.md](../../catalog/tables/users.md) |
| `events` | `kVLg1FSfDBtsP32FGPk3P` | `9Hw8OsZkAV3zspM6w756N` | [events.md](../../catalog/tables/events.md) |
| `chapters` | `yRaGKY6Rhmn6m3SKUBmOV` | `h7YMTNWbWzFG03kDFJqza` | [chapters.md](../../catalog/tables/chapters.md) |
| `registrations` | `PNuChoFG0tIBTND86yzDL` | `9l2eoVI3ld9owKlOMDCpE` | [registrations.md](../../catalog/tables/registrations.md) |
| `event_staff` | `CyW6KjJ2BdwQEph2KEqTt` | `VGAwAHHdqwZ5HClegiaFX` | [event_staff.md](../../catalog/tables/event_staff.md) |
| `staff_invites` | `TrHzP09CQTbpU14FPBZLQ` | `jkomdSZUOorlO0kGZanuv` | [staff_invites.md](../../catalog/tables/staff_invites.md) |
| `broadcasts` | `RtlPCu8KxBRPHCX62ifhc` | `2kSUjdfCLbymInDj2jiGM` | [broadcasts.md](../../catalog/tables/broadcasts.md) |
| `broadcast_targets` | `lg5rQmGCnNrbAJSAQOUfX` | `0dGx02CIBS2aaIuY6jSCQ` | [broadcast_targets.md](../../catalog/tables/broadcast_targets.md) |
| `sessions` | `tL4fbi1GisDwA8UJ9zSod` | `1ffo6zKnrUPJDXSB1Oduz` | [sessions.md](../../catalog/tables/sessions.md) |
| `strings` | `qi6bBTL7plRGBgFUfli8w` | `6965qPeAeAWTWJtna835A` | [strings.md](../../catalog/tables/strings.md) |

Флоу не создавалось ни одного: в проекте по-прежнему 0 flows.

## Чек-лист готовности

- [x] таблицы из DATA-MODEL.md есть в `events-dev` — все 10, поля один-в-один
- [x] схема в репозитории совпадает с инстансом — каталог собран из вывода
      `ap_list_tables` и `ap_get_piece_props`, а не из ТЗ
- [x] флаги заведены как `STATIC_DROPDOWN` со значениями `true` / `false` —
      `consent_pdn`, `consent_marketing`, `blocked_bot`
- [x] `sessions.draft` — `TEXT`, JSON проверен на round-trip
- [x] создание схемы описано воспроизводимо —
      [catalog/tables/README.md](../../catalog/tables/README.md), раздел «Как пересобрать схему»
- [x] `catalog/` совпадает с живым проектом
- [ ] пройдено независимое ревью, вердикт «замечаний нет»

## Как проверено

Пробные записи вставлялись, читались, затем удалены — на момент сдачи все таблицы
пусты (`ap_list_tables`: `rowCount: 0` у всех десяти).

- **Флаги.** `consent_pdn = "true"` записался и прочитался как `"true"`.
  Непроставленный `consent_marketing` вернулся `null` — не `"false"` и не `""`.
- **Флаги, отрицательный сценарий.** `consent_pdn = "yes"`, `blocked_bot = "1"` —
  ⚠️ **записались и прочитались как есть**. `STATIC_DROPDOWN` значения не валидирует.
- **`sessions.draft`.** Строка `{"title":"Тест \"кавычки\" и \n перевод","lat":41.311081,"capacity":null,"tags":["a-b","c_d"]}`
  вернулась байт в байт, включая экранированные кавычки и `\n`.
- **`telegram_id` за 2^53.** `"9007199254740993"` и `"9007199254740994"` сохранились
  и вернулись без потери младшего разряда — строковый тип оправдан (DAT-1).
- **Дубли (ADR-0003).** Две строки `registrations` с одной парой
  `(event_id, telegram_id)` вставились подряд без жалоб. Уникальность — соглашение флоу.
- **«Не пришёл».** Фильтр `checked_in_at not_exists` вернул ровно те две строки,
  где чекина не было, и не вернул строку с `checked_in_at`.
- **«Без лимита».** `capacity = ""` (пустая строка, не `null`) тоже ловится
  `not_exists` — отдельного случая для OWN-15 не нужно.
- **`DATE` со смещением.** `ends_at = "2026-09-10T12:00:00+05:00"` сохранён как есть,
  к UTC платформой **не** приводится. Инвариант OWN-3 держат только флоу.
- **Типы на чтении.** Всё возвращается строками: `lat` → `"41.311081"`,
  `overbook_pct` → `"40"`, `capacity` → `""`.
- **Диапазонные фильтры.** `overbook_pct gt 10` находит строку, `starts_at lt <дата>`
  и `title gt A` — нет. Подробно и с последствиями — [Q15](../OPEN-QUESTIONS.md#q15).

## Журнал

- **2026-09-08** — пакет взят. `ap_list_tables` на старте: `{"tables":[],"count":0}` —
  проект действительно пуст, совпадает с `catalog/overview.md`.
- **2026-09-08** — таблицы созданы по одной через `ap_create_table`. `boolean` → dropdown
  `true`/`false`, JSON → `TEXT`, timestamps → `DATE`, как предписано DATA-MODEL.
  Отклонений от ТЗ нет; `scenario` и `lang` оставлены `TEXT` ровно как в модели,
  хотя оба перечислимые — dropdown всё равно ничего не валидирует.
- **2026-09-08** — попытка проверить фильтры через **qadam** `tables-find-records`
  (а не MCP-инструмент) уперлась в две вещи. Первая: qadam ждёт **externalId** таблицы,
  внутренний id даёт `Table with externalId ... not found`. Вторая, хуже: `filters` —
  DYNAMIC-проп, и обе угаданные формы (`fieldName`, `field_id`) были **молча
  проигнорированы** — действие вернуло все строки, включая заведомо
  не подходящие под фильтр. Проигнорированный фильтр, отвечающий «успех», —
  ровно та ошибка, которая в чекине или рассылке не заметна до последствий.
  Форма `filters` вынесена в [Q15](../OPEN-QUESTIONS.md#q15) и решается в W2,
  где шаг настраивается через `ap_add_step` и структура пропа видна.
- **2026-09-08** — выяснилось, что у поля **два разных идентификатора**: `externalId`
  для записи (`values` у `tables-create-records`) и внутренний `id` для чтения
  (`cells` в выводе `find`). Это не оговорка gotcha №1 из CLAUDE.md, а её полная
  версия: перепутать их легко, потому что оба выглядят одинаково. Собраны оба
  набора для всех 10 таблиц — иначе W2 начался бы с этой же раскопки.
- **2026-09-08** — флоу-сидер решено **не** делать. Он запускается один раз
  в жизни проекта, всё равно требует ручной сверки и остаётся в проекте
  лишним артефактом. Вместо него — рецепт пересборки в `catalog/tables/README.md`
  и один источник истины на поле (ADR-0004). Дублировать схему ещё и в JSON
  не стали: два описания одной схемы расходятся, вопрос только когда.
- **2026-09-08** — пробные записи удалены. Замечено попутно: `ap_delete_records`
  за один вызов удаляет записи **только одной таблицы** (передал 7 id из четырёх
  таблиц — удалилось 2), молча, без ошибки. Удалять пришлось по таблицам,
  результат сверен `ap_list_tables` — везде `rowCount: 0`.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- **[Q15](../OPEN-QUESTIONS.md#q15)** — выборка по диапазону дат. Схему не меняли
  (варианта с `*_ms`-дублями не заводили), W2 не блокирует, W10/W12 блокирует.
- `chapters` остаётся пустой до решения [Q8](../OPEN-QUESTIONS.md#q8) — так и задумано.
- Таблицы в `events-prod` не заводились: проект появится не раньше W15 (шаг 0.6).
