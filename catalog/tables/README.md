# Таблицы: как читать этот каталог и как воспроизвести схему

Живое состояние — 10 таблиц в проекте `events-dev`, собраны в пакете W1
([журнал](../../docs/work/W01-tables.md)). Модель и смысл полей —
[docs/DATA-MODEL.md](../../docs/DATA-MODEL.md); здесь только то, что нужно,
чтобы обращаться к ним из флоу и пересобрать их в другом проекте.

## Два namespace'а идентификаторов — главная ловушка

У каждого поля **два разных id**, и путать их дорого:

| Где | Какой ключ | Как узнать |
| --- | --- | --- |
| `values` у `tables-create-records`, `tables-update-record` | **externalId** поля | `ap_get_piece_props` с `input.table_id` |
| `cells` в выводе `tables-find-records`, `tables-get-record` | **внутренний field id** | `ap_list_tables` |
| `table_id` в любом действии qadam'а | **externalId таблицы** | `ap_resolve_property_options` |
| `tableId` в MCP-инструментах (`ap_find_records`, `ap_insert_records`) | **внутренний id таблицы** | `ap_list_tables` |

Проверено 2026-09-08: `tables-find-records` с внутренним id таблицы падает
`Table with externalId <id> not found`. Оба id есть в каждом файле каталога.

**Значение в `cells` вложено ещё на уровень:** запись выглядит как
`cells[<fieldId>] = { fieldName, value, created, updated }`, то есть строка лежит
в `cells[<fieldId>].value`, а не в `cells[<fieldId>]`. Ссылка на поле из шага —
`{{step_1['output'][0].cells.<fieldId>.value}}`; подставленный без `.value`
объект тихо превратится в `[object Object]`. В CODE-шаге удобнее не помнить id вовсе,
а собрать объект по `fieldName`, который платформа отдаёт в той же записи.

**Все id — свои у каждого проекта.** При пересборке в `events-prod` (W15)
они будут другими: сначала создаются таблицы, потом по новым id настраиваются шаги.
Захардкоженный dev-id в prod-флоу — тихая запись в чужую таблицу.

## Как пересобрать схему в пустом проекте

Порядок не важен — внешних ключей платформа не знает, связи держат флоу.
Для каждого файла `<table>.md` в этом каталоге:

1. `ap_create_table` с `name` = имя таблицы и `fields` из её таблицы полей:
   `name` = колонка **Field**, `type` = колонка **Type**;
2. для каждого поля типа `STATIC_DROPDOWN` — `options` **массивом строк**
   из раздела «Dropdown-значения» ниже, в том же порядке; пустой вариант
   не перечисляем, его добавляет платформа сама;
3. `ap_list_tables` + `ap_get_piece_props` — снять новые id и обновить каталог
   для нового проекта.

Колонки в файлах таблиц читать так: значения dropdown'ов, упомянутые в колонке
**Назначение**, — пояснение для человека; машинно точный список — только раздел ниже.

### Dropdown-значения

Восемь полей на четыре таблицы. Список полный: других `STATIC_DROPDOWN` в схеме нет.

| Таблица | Field | `options` |
|---------|-------|-----------|
| `users` | `consent_pdn` | `["true", "false"]` |
| `users` | `consent_marketing` | `["true", "false"]` |
| `users` | `blocked_bot` | `["true", "false"]` |
| `events` | `status` | `["draft", "published", "cancelled", "finished"]` |
| `registrations` | `status` | `["registered", "cancelled"]` |
| `broadcasts` | `segment` | `["all_consent", "registered", "attended", "no_show"]` |
| `broadcasts` | `status` | `["draft", "running", "done", "failed"]` |
| `broadcast_targets` | `state` | `["pending", "sent", "blocked", "failed"]` |

Порядок значимый только для UI; логика флоу на него не опирается и не должна.

Отдельного флоу-сидера **нет** сознательно: он был бы кодом, который запускается
один раз в жизни проекта и всё равно требует ручной сверки. Каталог как спека +
`ap_create_table` дают тот же результат без лишнего артефакта в проекте
([ADR-0004](../../docs/adr/0004-catalog-instead-of-flow-export.md)).

## Что платформа не делает за нас — проверено 2026-09-08

- **`STATIC_DROPDOWN` не валидирует значения.** `consent_pdn = "yes"` и
  `blocked_bot = "1"` записались и прочитались как есть. Dropdown — подсказка в UI,
  а не ограничение; допустимость значений проверяет флоу.
- **К каждому dropdown платформа добавляет пустой вариант** (`{"label":"","value":""}`).
  Значит у флага три состояния: `true`, `false`, «не задано».
- **Типов нет на чтении.** Всё возвращается строками: `lat` → `"41.311081"`,
  `capacity` → `""`. Числа приводит Code step.
- **`DATE` — это текст.** `2026-09-10T12:00:00+05:00` сохранился со смещением,
  без нормализации к UTC. Инвариант «всё в UTC» (OWN-3) держат только флоу.
- **Пустое значение и `null` — разные вещи, но `not_exists` ловит оба.**
  Проверено на `checked_in_at` (`null`) и `capacity` (`""`).
- **Уникальных индексов нет** — три строки с одной парой `(event_id, telegram_id)`
  вставились подряд ([ADR-0003](../../docs/adr/0003-idempotency-without-atomicity.md)).
