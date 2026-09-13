# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ оставляет регистрацию в силе.
- **Flow ID (MCP)**: `3gLF6TcbpFObHONATQ64N` · **externalId**: `JH42q9BkKDYUti7leKJrC`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId` | — |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack | `{{trigger['output'].data.callbackQueryId}}` |
| step_2 | CODE «decide yes/no» | `isYes` по `callbackData == 'reg:mkt:yes'` | |
| step_3 | `tables-upsert-records users` | `consent_marketing = true/false`, `consent_marketing_at = now` **всегда** (и на `no` тоже — иначе пришлось бы передавать пустую дату, которую платформа игнорирует) | |
| step_4 | CODE `reg.consent_marketing.saved_yes`/`saved_no` | | |
| step_5 | `send_text_message` | подтверждение | |
| step_6 | `tables-upsert-records sessions` | `step = await_phone` | |
| step_8 | CODE «phone question text» | текст вопроса о телефоне | |
| step_7 | `send_text_message` | вопрос о телефоне, `reply_markup.keyboard` с `request_contact: true` | `{{step_8['output'].text}}` |

## Зависимости

- **Таблицы**: `users`, `sessions`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **`consent_marketing` не проставляется побочным эффектом `consent_pdn`**
  (PAR-1/PAR-2) — эта функция единственная, кто пишет `consent_marketing`,
  и вызывается только по прямому ответу на явный вопрос. `consent_pdn`
  этот флоу не трогает ни при `yes`, ни при `no`.
