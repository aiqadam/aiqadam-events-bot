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

- **`tables-upsert-records registrations` заменяет create-or-reactivate ROUTER**
  из старого `registration` (было: найти строку → ветка create/reactivate).
  Один шаг вместо трёх, дублей не плодит (IDM-1) — проверено прогоном
  (см. журнал W26).
- **Сессию нельзя «очистить» пустой строкой** — открытие W26: `tables-upsert-records`
  (как и `tables-update-record`) молча игнорирует пустую строку в TEXT-поле,
  значение остаётся прежним (не только в DATE-полях, как было известно раньше,
  см. [tables/README.md](../tables/README.md)). Используется сентинел `-`
  (тот же приём, что и в `find-registration` для фильтров) — `tg-router`
  обязан трактовать `scenario/step = '-'` как «нет активной сессии».
- **Проверено 2026-09-13, реальная доставка в Telegram владельца (`322876545`)**:
  `yes`, новая регистрация (`eS0G9dT7ykc536BZcgH4Q`) — `consent_pdn=true`,
  строка `registrations` создана (`demo-322876545`, `status=registered`),
  текст «Вы зарегистрированы на «Демо-ивент W26»» с точной подстановкой
  title, вопрос о рассылке отправлен; **реактивация отменённой регистрации**
  (`B60AVUrHY20A7DIh3I1E0`, IDM-1) — **тот же** `record id`, статус
  `cancelled → registered`, `source` обновлён, дублей не создано;
  `no` (`YvBjDU7UCTrzy1Lbx0sG4`, после фикса сентинела) — отказ отправлен,
  `sessions.scenario/step = '-'` подтверждено чтением записи.
