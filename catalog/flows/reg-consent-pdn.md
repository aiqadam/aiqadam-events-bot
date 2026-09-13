# Flow: reg-consent-pdn

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_pdn` (ADR-0015: касание = один вопрос со всеми
  ответами на него, `pdn:yes`/`pdn:no` — один флоу)
- **Назначение**: согласие на обработку данных (PAR-1, обязательное). При
  согласии — создаёт/реактивирует регистрацию (IDM-1) и открывает вопрос
  о рассылке.
- **Flow ID (MCP)**: `vQJDQ8NecB1PleIFrq07O`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` (JSON `{eventId,utm}`) | — |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack — падает на синтетических `callback_query_id` в тестах, это ожидаемо | `{{trigger['output'].data.callbackQueryId}}` |
| step_2 | CODE «parse draft + decide» | `isYes` по `callbackData`, разбор `sessionDraft`, `regId = eventId + '-' + telegramId` | `{{trigger['output'].data...}}` |
| step_3 | ROUTER: branch 0 = `no`, branch 1 = `yes`, `Otherwise` — заглушка | | `{{step_2['output'].isYes}}` |
| step_4→10 (`yes`) | `tables-upsert-records users` (`consent_pdn=true`) → `tables-upsert-records registrations` (ключ `event_id+telegram_id` — создаёт или реактивирует, IDM-1) → чтение `events.title` → CODE `reg.done` → `send_text_message` → `tables-upsert-records sessions` (`step=await_marketing`) → `send_text_message` вопрос о рассылке | | |
| step_11→12 (`no`) | `send_text_message` `reg.consent_pdn.declined` → `tables-upsert-records sessions` (`scenario='-'`, `step='-'`) | регистрация **не создаётся** (PAR-1) | |

## Зависимости

- **Таблицы**: `users`, `registrations` (запись через `tables-upsert-records`, ключ `(event_id, telegram_id)`), `events` (чтение title), `sessions`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`tables-upsert-records registrations` заменяет create-or-reactivate ROUTER**:
  `yes` и на новую, и на ранее отменённую (`cancelled`) регистрацию даёт
  один и тот же шаг и тот же `record id` (IDM-1, дублей не плодит).
- **Сессию нельзя «очистить» пустой строкой**: `tables-upsert-records` (как и
  `tables-update-record`) молча игнорирует пустую строку в TEXT-поле, значение
  остаётся прежним (не только в DATE-полях — см. [tables/README.md](../tables/README.md)).
  Используется сентинел `-` (тот же приём, что и в `fn-find-registration` для
  фильтров) — `tg-router` обязан трактовать `scenario/step = '-'` как «нет
  активной сессии».
