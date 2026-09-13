# Flow: event-wizard-photo

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается из `tg-router` (`route: wiz_photo`,
  активная сессия визарда с `sessions.step='photo'`)
- **Назначение**: принимает фото ивента (или пропуск `"-"`), затем передаёт
  эстафету касанию `address` (которое ведёт `event-wizard-field`).
- **Flow ID (MCP)**: `mGUl0dCEyJQjjN3VtyjAN`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова | `{{trigger['output'].data.hasPhoto/photoFileId/text/sessionDraft/chatId}}` |
| step_1 | CODE «decide» | `ok = hasPhoto \|\| text === '-'`; `draft.photo_file_id` = `photoFileId` или `''` | |
| step_2 | ROUTER: `ok`/`Otherwise` | | |
| step_3 (ok) | `tables-upsert-records sessions` | `draft`, `step='address'` | |
| step_5 | `send_text_message` | «Адрес текстом?» | |
| step_4 (Otherwise) | `send_text_message` | «Пришлите фото или "-" чтобы пропустить.» — сессия не двигается | |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router`; следующее касание (`address`) обслуживает
  `event-wizard-field`, эстафета — через `sessions.step`, не `callFlow`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Отдельный флоу, а не часть `event-wizard-field`**: механика входа другая —
  фото-сообщение, а не текст (ADR-0016 разделяет по устройству касания:
  «фото» и «гео» — разные входные примитивы Telegram, поэтому не подпадают
  под правило «делят один флоу» несмотря на структурное сходство с текстовыми
  полями).
- `photo_file_id` хранится как есть (Telegram `file_id`), без скачивания —
  ретрансляция фото при необходимости (например, будущая карточка ивента)
  использует тот же `file_id` через `send_photo`.
