# Flow: bcast-unsub

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `tg-router`
  (кнопка «Отписаться») и кнопка в каждом массовом сообщении `bcast-run`;
  payload `{chatId, telegramId, callbackData, callbackQueryId}`
- **Назначение**: отписка получателя от анонсов (OWN-13). Staff-гейта нет —
  получатель порочит гость.
- **Flow ID (MCP)**: `eymcIde00G3SNlhaBvAbB` · **externalId**: `4MEoT3F9xRVwSIftttnan`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | приём нажатия `bcast:unsub:<bid>` |
| step_1 | `@aiqadam/qadam-telegram-bot : answer_callback_query` | гашение спиннера; `continueOnFailure` (протухший query не роняет отписку) |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | строка `users` по `telegram_id` |
| step_3 | CODE «decide unsub» | `already` (нет строки или `consent_marketing != true`), текст ответа, `now` |
| step_4 | ROUTER: `already` / `Otherwise` | |
| step_5 | `send_text_message` | `unsub.already` (ветка `already`) |
| step_6 | `tables-upsert-records users` | `consent_marketing='false'` + `consent_marketing_at` |
| step_7 | `send_text_message` | `unsub.done` |

## Зависимости

- **Таблицы**: `users` (`xHhYjhwqKdONkrYJGcBsz`, чтение+запись)
- **Флоу**: вызывается из `tg-router` (ветка `bcast_unsub`)
- **Переменные**: —
- **Connections**: connection среды ([environments.md](../environments.md))

## Заметки

- **Снимает только `consent_marketing`** (OWN-13, PAR-2): `consent_pdn`
  не трогается — отписка от анонсов не отменяет регистрацию.
- **`bid` из колбэка не используется**: отписка — свойство человека, а не
  рассылки; кнопка с любого (в т.ч. тестового) сообщения делает одно и то же.
- **`blocked_bot=true` не мешает отписке**: апсерт по `telegram_id` находит
  строку независимо от флага.
