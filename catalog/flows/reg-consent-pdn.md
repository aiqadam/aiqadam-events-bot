# Flow: reg-consent-pdn

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_pdn`
- **Назначение**: согласие на обработку ПД (PAR-1). При `yes` создаёт регистрацию
  и **отправляет короткое сообщение** «зарегистрированы + вопрос о рассылке»
  (ADR-0056, без фактов события); при `no` — отправляет отказ и закрывает сессию.
  Легаси-путь: новые сессии в него не попадают (`await_pdn` снят W50), достижим
  только для протухших сессий; переведён на отдельные сообщения ради
  единообразия с ADR-0056.
- **Flow ID (MCP)**: `UgAeyhpI29ndjM4EM3gxf` · **externalId**: `sQkwXETrInr5lns3jHQG2`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «parse draft + decide» | `isYes`, `eventId`, `utm`, `regId`; `draftJson` (только `eventId`/`utm`) уезжает в сессию `await_marketing` и нужен `reg-consent-mkt`; ADR-0056: `cardMessageId` не читается; `eventIdOrNone = eventId \|\| '__none__'` |
| step_3 | ROUTER | `no` / `yes` / `Otherwise` |
| step_14→12→10 (`no`) | CODE «отказ от ПД» → `tables-upsert-records sessions` (`continueOnFailure`) → `send_text_message` | сессия закрыта `-`, отказ отдельным сообщением, кнопки сняты |
| step_4 (`yes`) | `tables-upsert-records users` | `consent_pdn = true` + отметка времени; **без** `continueOnFailure` — держит PAR-1 |
| step_6 (`yes`) | `tables-find-records events` (`continueOnFailure`) | событие для текста; фильтр `id eq eventIdOrNone` |
| step_5 (`yes`) | `tables-upsert-records registrations` (`continueOnFailure`) | создание/реактивация регистрации; per-row `__clear` чистит `cancelled_at` (W109) |
| step_9 (`yes`) | `tables-upsert-records sessions` (`continueOnFailure`) | `step = await_marketing`, черновик сохраняется |
| step_7 (`yes`) | CODE «текст: зарегистрирован + рассылка» | **ADR-0056: короткий текст** (финал + вопрос о рассылке, без даты/места); при сбое upstream — `common.err.generic`; кнопки `reg:mkt:yes`/`reg:mkt:no` |
| step_8 (`yes`) | `send_text_message` | отправка сообщения; фолбэк-цепочка `step_10→15→16` снята (редактирования нет) |
| step_13 | CODE noop | `Otherwise` — чужой колбэк |

## Зависимости

- **Таблицы**: `users`, `registrations`, `sessions` (запись), `events` (чтение)
- **Переменные**: —
- **Connections**: connection среды ([environments.md](../environments.md))

## Заметки

- **Регистрация создаётся здесь, а не в `reg-start`** — это и держит PAR-1:
  без явного согласия строки в `registrations` не появляется.
- **`consent_marketing` этот флоу не трогает ни при `yes`, ни при `no`**
  (PAR-1/PAR-2). Слияние двух вопросов в одну карточку ничего в этом не меняет:
  два тапа остаются двумя раздельными актами.
- **Состояние пишется раньше, чем отправляется экран.** Согласие, регистрация
  и сессия записаны до `send_text_message`, поэтому упавшая отправка не может
  потерять регистрацию — и после ветки On failure ничему не нужно «сходиться»
  обратно.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)):
  `step_6`/`step_5`/`step_9` — `continueOnFailure`, но **без** отдельной
  ветки отказа на каждом из них. Их общий потребитель — `step_7` — читает
  `{{stepName['error']}}` (и `step_4`'s, хотя тот практически недостижим —
  см. ниже) и, если хоть один упал, отдаёт `common.err.generic` вместо
  построенного на неполных данных текста; `step_8` показывает ровно этот
  текст. `step_12` (ветка `no`) — `continueOnFailure` без всякой ветки
  отказа вовсе: `step_10` показывает «отказ от ПД» независимо от того,
  очистилась ли сессия, текст этого шага не зависит от результата `step_12`.
- **`step_4` — намеренное исключение из страховки, не `continueOnFailure`.**
  Найдено ревью пакета W46 (круг 1, блокер): `continueOnFailure` — это
  «продолжай выполнение», не «переключись на альтернативную ветку»; обычное
  продолжение цепочки (`step_6 → step_5 → step_9 → step_7`) выполняется
  независимо от исхода защищённого шага. Если бы `step_4` был
  `continueOnFailure`, упавшая запись `consent_pdn` не помешала бы `step_5`
  создать регистрацию — а именно этого `step_4` обязан не допускать: он
  держит PAR-1 (регистрация без сохранённого согласия недействительна).
  Общий `error`-потребитель в конце цепочки (`step_7`) решает только какой
  **текст** показать, а не то, что уже успело записаться до него — этого
  недостаточно, когда downstream-шаг физически не должен выполняться, а не
  просто «должен показать другой текст». Поэтому `step_4` остался
  `continueOnFailure: false`: его падение останавливает весь прогон до
  `step_5` целиком (полная тишина пользователю на этом одном шаге — тот же
  Q32-риск, но принят как меньшее зло по сравнению с регистрацией без
  подтверждённого согласия). Общая гоча — [AGENTS.md](../../AGENTS.md),
  Gotchas Qadam Flow, п. 15.
- **Ветки-фолбэки сняты (ADR-0056).** Прежде отправка шла `edit_message_text`
  с веткой On failure «карточку не отредактировать → шлём новое сообщение»
  (`cardMessageId = 0` как штатный вход). Теперь и `yes` (`step_8`), и `no`
  (`step_10`) шлют новое сообщение, редактирования и `cardMessageId` нет —
  снимается и класс `400 «message to edit not found»`, ради которого фолбэк
  существовал.
- **`step_7` (ветка `yes`) короткое (ADR-0056).** Прежде несло дату и место
  события; теперь только «зарегистрированы» + вопрос о рассылке — факты
  показаны один раз, во входной карточке онбординга.
- **`step_6` фильтрует по `eventIdOrNone` (W102).** `tables-find-records`
  fail-closed отклоняет пустой `eq`; `eventId` из черновика может быть пуст
  (онбординг без события, ADR-0034). Sentinel даёт пустую выборку — `step_7`
  показывает текст без даты; платформенная гоча — `AGENTS.md`.
