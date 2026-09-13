# Flow: my-reg-cancel

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на колбэки `myreg:cancel:<eventId>` / `myreg:yes:<eventId>` / `myreg:no`
  (ADR-0015: один вопрос «отменить?» со всеми ответами — один флоу)
- **Назначение**: отмена регистрации (PAR-5) — подтверждение, исполнение
  с серверной проверкой срока, отказ после старта.
- **Flow ID (MCP)**: `1pt6UqDUUunGio2V7YWna` · **externalId**: `NgRBWT6gR7yhuf1qwG2mM`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId` | — |
| step_1 | CODE «parse callback» | `confirm` / `do_yes` / `keep` + `eventId`; `eventId` валидируется алфавитом slug'а | `{{trigger['output'].data.callbackData}}` |
| step_2 | `answer_callback_query` (`continueOnFailure`) | ack | `{{trigger['output'].data.callbackQueryId}}` |
| step_3 | ROUTER по `action` | `confirm` / `do_yes` / `keep` / `Otherwise`-заглушка | `{{step_1['output'].action}}` |
| step_4→6 (`confirm`) | `tables-find-records events` (по `id`, `limit 1`) → CODE `cancel.confirm` + кнопки → `send_text_message` | вопрос с кнопками «Да, отменить» / «Оставить»; неизвестный ивент — `cancel.not_found` без кнопок (не чужой ивент) | `{{step_1['output'].eventId}}` |
| step_7→9 (`do_yes`) | `tables-find-records events` → `tables-find-records registrations` (`event_id` + `telegram_id`) → CODE «decide cancel» | `ok` / `too_late` (`now >= starts_at`) / `not_found` (нет ивента или нет активной `registered`-строки) | |
| step_10 | ROUTER по `outcome` | `ok` / `too_late` / `not_found` / `Otherwise`-заглушка | `{{step_9['output'].outcome}}` |
| step_11→12 (`ok`) | `tables-upsert-records registrations` (`status = cancelled`, `cancelled_at = now`, ключ `event_id + telegram_id`) → `send_text_message` `cancel.done` | отмена той же строкой (`updated`, не `inserted` — дублей нет) | |
| step_13 (`too_late`) | `send_text_message` `cancel.too_late` | записи нет — шаг только читал | |
| step_14 (`not_found`) | `send_text_message` `cancel.not_found` | записи нет | |
| step_15→16 (`keep`) | CODE `cancel.kept` → `send_text_message` | регистрация оставлена | |

## Зависимости

- **Таблицы**: `events` (чтение), `registrations` (чтение + запись отмены)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **PAR-5 держится двумя проверками:** кнопка не рисуется после `starts_at`
  (см. `my-regs.md`), а этот флоу перепроверяет срок сервером — опоздавший
  колбэк получает `cancel.too_late`, а не молчаливый отказ и не отмену.
- **Активная регистрация = `status = registered`.** Отменённая строка при
  повторном `myreg:yes:` даёт `not_found`, а не вторую отмену; `checked_in`
  отмене не мешает (чекин — факт прошлого, отмена — статус пары).
- **Отмена пишется upsert'ом по ключу `(event_id, telegram_id)`** — та же
  строка, `id` вида `<eventId>-<telegramId>` по конвенции проекта; повторный
  `pdn:yes` её реактивирует (IDM-1 в обе стороны).
- **Тексты — во входе `texts`** (ADR-0014); значения сверены с `i18n/ru.json`.
  Ключ `cancel.kept` заведён этим пакетом — подтверждения «оставить» раньше
  не было ни в одном пакете.
