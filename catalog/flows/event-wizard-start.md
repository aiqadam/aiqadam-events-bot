# Flow: event-wizard-start

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается только из `tg-router` (`route: wiz_start`,
  команда `/newevent`)
- **Назначение**: открывает визард создания нового ивента (OWN-1…OWN-4):
  заводит сессию `scenario='event_create'`, задаёт первый вопрос ADR-0016-цепочки.
- **Flow ID (MCP)**: `hlteuRDfyahnfcHHip15E` · **externalId**: `hHkYSlrAOqi7Ka1WkQpbv`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | приём вызова от `tg-router` |
| step_1 | CODE «now» | текущее время для `updated_at` |
| step_2 | `tables-upsert-records sessions` | `scenario='event_create', step='title', draft='{}'` по ключу `telegram_id` |
| step_4 | CODE «title question text» | текст первого вопроса (`wizard.ask.title`) |
| step_3 | `send_text_message` | первый вопрос цепочки ADR-0016 — про название ивента |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (для `send_text_message`)

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **Задаёт только первый вопрос и выходит.** Ответ на него уже обрабатывает
  `event-wizard-field`: инициализированный `sessions.step='title'` уводит
  следующее касание туда. Все шесть однотипных полей (`title`/`description`/
  `address`/`starts_at`/`ends_at`/`reg_deadline_at`) ведёт один этот флоу,
  а не шесть копий (см. [ADR-0016](../../docs/adr/0016-shared-flow-for-same-shaped-touches.md)).
