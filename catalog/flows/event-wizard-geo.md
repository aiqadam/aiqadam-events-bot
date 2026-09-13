# Flow: event-wizard-geo

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается из `tg-router` (`route: wiz_geo`,
  активная сессия визарда с `sessions.step='geo'`)
- **Назначение**: принимает геоточку ивента гео-сообщением (или пропуск `"-"`),
  затем передаёт эстафету первому вопросу дат (`starts_at`), который снова
  ведёт `event-wizard-field`.
- **Flow ID (MCP)**: `sAJFoscopo3EgwQlDfaA7` · **externalId**: `wZLWTVqVzSODF6DZYvOHx`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова | `{{trigger['output'].data.hasLocation/locationLat/locationLon/text/sessionDraft/chatId}}` |
| step_1 | CODE «decide» | `ok = hasLocation \|\| text === '-'`; `draft.lat/lon` из локации или `''` | |
| step_2 | ROUTER: `ok`/`Otherwise` | | |
| step_3 (ok) | `tables-upsert-records sessions` | `draft`, `step='starts_at'` | |
| step_6 | CODE «starts_at question text» | текст вопроса о начале (формат `ДД.ММ.ГГГГ ЧЧ:ММ`, время ташкентское) | |
| step_5 | `send_text_message` | вопрос о начале | `{{step_6['output'].text}}` |
| step_7 (Otherwise) | CODE «geo error text» | текст подсказки «точка на карте или `-`» | |
| step_4 (Otherwise) | `send_text_message` | подсказка — сессия не двигается, вопрос повторяется | `{{step_7['output'].text}}` |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router`; следующее касание (`starts_at`)
  обслуживает `event-wizard-field`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **Гео принимается только сообщением-локацией** (`message.location`), не
  текстом с координатами.
- Отдельный флоу по той же причине, что и `event-wizard-photo`: другая
  механика входа (гео-сообщение), не текст — ADR-0016.
