# Flow: event-wizard-geo

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается из `tg-router` (`route: wiz_geo`,
  активная сессия визарда с `sessions.step='geo'`)
- **Назначение**: принимает геоточку ивента гео-сообщением (или пропуск `"-"`),
  затем передаёт эстафету первому вопросу дат (`starts_at`), который снова
  ведёт `event-wizard-field`.
- **Flow ID (MCP)**: `sAJFoscopo3EgwQlDfaA7`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова | `{{trigger['output'].data.hasLocation/locationLat/locationLon/text/sessionDraft/chatId}}` |
| step_1 | CODE «decide» | `ok = hasLocation \|\| text === '-'`; `draft.lat/lon` из локации или `''` | |
| step_2 | ROUTER: `ok`/`Otherwise` | | |
| step_3 (ok) | `tables-upsert-records sessions` | `draft`, `step='starts_at'` | |
| step_5 | `send_text_message` | «Когда начало? Формат: ДД.ММ.ГГГГ ЧЧ:ММ (время ташкентское)» | |
| step_4 (Otherwise) | `send_text_message` | «Отправьте точку на карте или "-" чтобы пропустить.» — сессия не двигается | |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router`; следующее касание (`starts_at`)
  обслуживает `event-wizard-field`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Гео принимается только сообщением-локацией** (`message.location`), не
  текстом с координатами.
- Отдельный флоу по той же причине, что и `event-wizard-photo`: другая
  механика входа (гео-сообщение), не текст — ADR-0016.
