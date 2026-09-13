# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ оставляет регистрацию в силе.
- **Flow ID (MCP)**: `3gLF6TcbpFObHONATQ64N`

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
| step_7 | `send_text_message` | вопрос о телефоне, `reply_markup.keyboard` с `request_contact: true` | |

## Зависимости

- **Таблицы**: `users`, `sessions`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`consent_marketing` не проставляется побочным эффектом `consent_pdn`**
  (PAR-1/PAR-2) — эта функция единственная, кто пишет `consent_marketing`,
  и вызывается только по прямому ответу на явный вопрос.
- **Проверено 2026-09-13, реальная доставка в Telegram владельца (`322876545`)**:
  `yes` (`ZMnZb8bCMLU1SupVyAmsX`) — `consent_marketing=true`, `consent_pdn`
  не тронут (остался как был); `no` (`dyy8m15q5T85G8aJgWT5l`) —
  `consent_marketing=false`, независимо от `consent_pdn`. Оба прогона
  подтверждают PAR-2 различающим чтением записи `users` после.
