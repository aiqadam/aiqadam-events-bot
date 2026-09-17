# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ оставляет регистрацию в силе, закрывает сессию и выдаёт **билет отдельным сообщением** (телефон не спрашивается с 2026-09-14).
- **Flow ID (MCP)**: `3gLF6TcbpFObHONATQ64N` · **externalId**: `JH42q9BkKDYUti7leKJrC`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «decide yes/no + разбор draft» | `isYes`, `cardMessageId`, `eventId`, `utm` |
| step_3 | `tables-upsert-records users` (`continueOnFailure`) | `consent_marketing = true/false` + отметка времени **всегда** |
| step_6 | `tables-upsert-records sessions` (`continueOnFailure`) | сессия закрыта сентинелом `-` |
| step_4 | `tables-find-records events` (`continueOnFailure`) | ивент для финальной карточки (`title`, `starts_at`, `address`) |
| step_5 | CODE «тексты: финальная карточка и билет» | `cardText`/`ticketText`, время Tashkent; при сбое `step_3`/`step_6`/`step_4` — оба текста заменяются на `common.err.generic` |
| step_7 | `edit_message_text` (`continueOnFailure`) | карточка → итог диалога, **кнопки сняты** |
| step_8 (On failure) | `send_text_message` | фолбэк: новая карточка если редактирование не удалось |
| step_9 | `send_text_message` | **билет** + кнопка `web_app` на `#/ticket?event_id=…` (SPA) |

## Зависимости

- **Таблицы**: `users`, `sessions` (запись), `events` (чтение)
- **Переменные**: `MINIAPP_URL`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Флоу терминальный**: после ответа сразу закрывает сессию и выдаёт билет. Телефон в регистрации не спрашивается (SPEC, DAT-2); `promptMessageId`, `request_contact` и reply-клавиатура здесь не используются.
- **`consent_marketing_at` проставляется и при `no`** — пустую дату платформа игнорирует, так что «очистить» поле было бы нечем.
- **`consent_pdn` этот флоу не трогает** (PAR-1/PAR-2).
- **Билет уходит новым сообщением, а не редактированием карточки.** Правило ADR-0017: состояние диалога редактируется, факт, к которому вернутся, отправляется. Билет оказывается внизу ленты, а не наверху, где висит карточка начала диалога.
- **У финального редактирования есть фолбэк** (`step_8`): `cardMessageId = 0` или удалённая карточка дают `400 «message to edit not found»`, шлём новую карточку. Это единственный фолбэк в этом флоу.
- **Тексты — во входе `texts`** (ADR-0014); значения сверены с `i18n/ru.json`: `reg.done.header`, `reg.consent_marketing.saved_yes/no`, `ticket.header`, `ticket.hint`.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)):
  `step_3`/`step_6`/`step_4` — `continueOnFailure`, без отдельной ветки отказа
  на каждом. `step_5` читает их `error` и при любом сбое отдаёт `common.err.generic`
  и в карточку, и в билет (не только карточку — иначе билет пришёл бы валидным
  текстом на несохранённое состояние). Регистрация уже создана в `reg-consent-pdn`,
  поэтому кнопка «Открыть билет» под текстом ошибки не ломает IDOR — билет
  по-прежнему проверяет `initData` и факт регистрации на сервере, а не то,
  что показал этот текст.
