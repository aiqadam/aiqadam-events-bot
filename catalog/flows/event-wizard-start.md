# Flow: event-wizard-start

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается только из `tg-router` (`route: wiz_start`,
  команда `/newevent`)
- **Назначение**: открывает визард создания нового ивента (OWN-1…OWN-4):
  заводит сессию `scenario='event_create'`, задаёт первый вопрос ADR-0016-цепочки.
- **Flow ID (MCP)**: `hlteuRDfyahnfcHHip15E`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова от `tg-router` | `{{trigger['output'].data.telegramId/chatId}}` |
| step_1 | CODE «now» | текущее время для `updated_at` | — |
| step_2 | `tables-upsert-records sessions` | `scenario='event_create', step='title', draft='{}'` по ключу `telegram_id` | |
| step_3 | `send_text_message` | первый вопрос цепочки ADR-0016: «Как называется ивент?» | `chat_id: {{trigger['output'].data.chatId}}` |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (для `send_text_message`)

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- Не задаёт вопрос сам по себе, а только инициализирует `sessions.step='title'` —
  дальше все шесть однотипных полей (`title`/`description`/`address`/
  `starts_at`/`ends_at`/`reg_deadline_at`) ведёт один флоу `event-wizard-field`,
  а не шесть копий (см. [ADR-0016](../../docs/adr/0016-shared-flow-for-same-shaped-touches.md)).
