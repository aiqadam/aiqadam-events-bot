# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ оставляет регистрацию в силе. Редактирует карточку и шлёт
  **транзиентный** вопрос о телефоне.
- **Flow ID (MCP)**: `3gLF6TcbpFObHONATQ64N` · **externalId**: `JH42q9BkKDYUti7leKJrC`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «decide yes/no + разбор draft» | `isYes`, `cardMessageId`, черновик на следующий шаг |
| step_3 | `tables-upsert-records users` | `consent_marketing = true/false` + отметка времени **всегда** |
| step_6 | `tables-upsert-records sessions` | `step = await_phone` |
| step_4 | CODE «card text: рассылка учтена, остался телефон» | итог по рассылке + что осталось |
| step_5 | `edit_message_text` (`continueOnFailure`) | карточка → новое состояние, **кнопки сняты** |
| step_9 (On failure) | `send_text_message` | фолбэк: новая карточка |
| step_8 | CODE «phone prompt: текст + reply-клавиатура» | `request_contact` + кнопка «Пропустить» |
| step_7 | `send_text_message` | **отдельное транзиентное сообщение** с reply-клавиатурой |
| step_10 | CODE «draft: cardMessageId + promptMessageId» | коалесцирует id карточки: фолбэк важнее исходного |
| step_11 | `tables-upsert-records sessions` | дописывает `promptMessageId` в черновик |

## Зависимости

- **Таблицы**: `users`, `sessions`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Вопрос о телефоне физически не может жить на карточке.** DAT-2 требует
  `request_contact`, а это **reply-клавиатура**; `edit_message_text` принимает
  только inline и отвечает `400 «inline keyboard expected»`. Поэтому вопрос
  уходит отдельным сообщением, его `message_id` кладётся в черновик, и
  `reg-phone` удаляет это сообщение после ответа. В ленте гостя остаются
  карточка и билет.
- **`consent_marketing_at` проставляется и при `no`** — пустую дату платформа
  игнорирует, так что «очистить» поле было бы нечем.
- **`consent_pdn` этот флоу не трогает** (PAR-1/PAR-2).
- **Транзиентный промпт идёт с `format: "None"`** — он состоит только из наших
  строк и живёт до ответа, разметка ему не нужна. Остальные шаги — `MarkdownV2`,
  экранирование по эталону [`markdown-v2.md`](../snippets/markdown-v2.md).
- **`step_10` коалесцирует `cardMessageId`**: шаг фолбэка выполняется не всегда,
  и его выход нельзя читать напрямую — при успешном редактировании он пуст.
- **Reply-клавиатура снимается не явно, а через `one_time_keyboard`.**
  Отдельного сообщения с `remove_keyboard` нет: билет несёт inline-кнопку,
  а два вида `reply_markup` в одном сообщении невозможны.
