# Flow: manage-open

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается только из `tg-router`
  (`route: manage_open`, команда `/manage` и `/manage <id>`)
- **Назначение**: единственный вход на страницу `manage` из чата — одно
  сообщение с кнопкой `web_app` на `manage.html` (создание) или
  `manage.html?event_id=<id>` (правка). Сам ничего не проверяет и не пишет.
- **Flow ID (MCP)**: `tMu8WwjrdqMpJYzuCHQcI` · **externalId**: `01jaqjCtzFMy0AlUXwY8C`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `chatId`, `telegramId`, `commandArgs` |
| step_1 | CODE «build open-form message» | `commandArgs` → `event_id` только если это валидный slug, иначе создание; текст и `inline_keyboard` с `web_app.url` |
| step_2 | `send_text_message` (`format: None`) | сообщение с кнопкой «Открыть форму» |

## Зависимости

- **Таблицы**: —
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: `MINIAPP_URL`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Права здесь не решаются намеренно.** Кнопка на чужой `event_id` откроет
  страницу, которая получит `403` от `manage-api` — там и только там
  проверяется `events.owner_id`. Проверять дважды значило бы завести второе
  место, где правило может разойтись с первым.
- **Тексты — через `inputs.texts`** (ADR-0014), ключи `manage.open.*`.
- Команда `/manage` временная: пока `event-wizard-*` живут параллельно,
  `/newevent` и `/editevent` ведут в визард. При выводе визарда из
  эксплуатации эти команды переключаются сюда, `/manage` остаётся синонимом.
