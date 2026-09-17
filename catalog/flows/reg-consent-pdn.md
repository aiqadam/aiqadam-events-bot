# Flow: reg-consent-pdn

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_pdn`
- **Назначение**: согласие на обработку ПД (PAR-1). При `yes` создаёт регистрацию
  и **редактирует карточку** в подтверждение + вопрос о рассылке; при `no` —
  редактирует её же в отказ и закрывает сессию.
- **Flow ID (MCP)**: `vQJDQ8NecB1PleIFrq07O` · **externalId**: `PUf09unvIwSpobPr1u3kh`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «parse draft + decide» | `isYes`, `eventId`, `utm`, `cardMessageId`, готовый `draftJson` |
| step_3 | ROUTER | `no` / `yes` / `Otherwise` |
| step_14 (`no`) | CODE «card text: отказ от ПД» | отказ с объяснением причины и следующим шагом |
| step_12 (`no`) | `tables-upsert-records sessions` (`continueOnFailure`) | сессия закрыта сентинелом `-` |
| step_11 (`no`) | `edit_message_text` (`continueOnFailure`) | карточка → отказ, **кнопки сняты** |
| step_17 (`no`, On failure) | `send_text_message` | фолбэк: отказ отдельным сообщением |
| step_4 (`yes`) | `tables-upsert-records users` (`continueOnFailure`) | `consent_pdn = true` + отметка времени |
| step_6 (`yes`) | `tables-find-records events` (`continueOnFailure`) | название, дата и адрес для подтверждения |
| step_5 (`yes`) | `tables-upsert-records registrations` (`continueOnFailure`) | создание или реактивация регистрации |
| step_9 (`yes`) | `tables-upsert-records sessions` (`continueOnFailure`) | `step = await_marketing`, черновик сохраняется |
| step_7 (`yes`) | CODE «card text: зарегистрирован + вопрос о рассылке» | кульминация с датой и местом + кнопки `reg:mkt:yes` / `reg:mkt:no`; при сбое `step_4`/`step_6`/`step_5`/`step_9` — `common.err.generic` вместо ложного успеха |
| step_8 (`yes`) | `edit_message_text` (`continueOnFailure`) | карточка → подтверждение и следующий вопрос |
| step_10→15→16 (`yes`, On failure) | `send_text_message` → CODE → `tables-upsert-records sessions` | фолбэк: новая карточка, её id переписывается в черновик |

## Зависимости

- **Таблицы**: `users`, `registrations`, `sessions` (запись), `events` (чтение)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Регистрация создаётся здесь, а не в `reg-start`** — это и держит PAR-1:
  без явного согласия строки в `registrations` не появляется.
- **`consent_marketing` этот флоу не трогает ни при `yes`, ни при `no`**
  (PAR-1/PAR-2). Слияние двух вопросов в одну карточку ничего в этом не меняет:
  два тапа остаются двумя раздельными актами.
- **Состояние пишется раньше, чем рисуется экран.** Согласие, регистрация
  и сессия записаны до `edit_message_text`, поэтому упавшее редактирование
  не может потерять регистрацию — и после ветки On failure ничему не нужно
  «сходиться» обратно.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)):
  `step_4`/`step_6`/`step_5`/`step_9` — `continueOnFailure`, но **без**
  отдельной ветки отказа на каждом из них. Их общий потребитель — `step_7` —
  читает `{{stepName['error']}}` всех четырёх и, если хоть один упал,
  отдаёт `common.err.generic` вместо построенного на неполных данных текста;
  `step_8` показывает ровно этот текст. Так одно понятное сообщение заменяет
  и полную тишину (сейчас — без страховки последующий сбой валит весь прогон
  до `edit_message_text`), и риск показать пользователю ложный «✅ Вы
  зарегистрированы» на самом деле несохранённое состояние. `step_12` (ветка
  `no`) — `continueOnFailure` без всякой ветки отказа вовсе: `step_11`
  показывает «отказ от ПД» независимо от того, очистилась ли сессия, текст
  этого шага не зависит от результата `step_12`.
- **Фолбэк построен на ветках `continueOnFailure`, а не на ROUTER'е.**
  Ветка On failure **сходится обратно** в основную цепочку — этим она
  отличается от веток ROUTER'а, которые не сходятся. Побочная выгода:
  не нужно вставлять ROUTER в собранную цепочку (CLAUDE.md, Gotchas, п. 10).
- **`cardMessageId = 0` — штатный вход в фолбэк.** Редактирование
  несуществующего сообщения даёт `400 «message to edit not found»`, ветка
  On failure шлёт новую карточку. Отдельной проверки «а есть ли карточка»
  в коде нет и не нужно.
- **Редактирование без `reply_markup` снимает клавиатуру** — в ветке `no`
  на это опираются, чтобы у отказа не осталось живых кнопок.
