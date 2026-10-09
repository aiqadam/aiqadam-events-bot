# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ пишет `consent_marketing`, закрывает сессию и **отправляет билет
  отдельным сообщением**. **ADR-0056: отдельной карточки-подтверждения больше
  нет** — финал и вопрос о рассылке (msg4) шлёт `reg-profile`/`reg-consent-pdn`;
  здесь только запись ответа и билет (msg5). Если черновик несёт `eventId` —
  билет на событие. Если `eventId` пуст (ADR-0034: онбординг без диплинка) —
  вторым сообщением уходит кнопка каталога Mini App вместо билета.
- **Flow ID (MCP)**: `uOKODGfZjyhNbED320cjz` · **externalId**: `PWmFAu3Ia71OyANEgzwxN`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «decide yes/no + разбор draft» | `isYes`, `eventId`, `utm`; ADR-0056: `cardMessageId` не читается; `eventIdOrNone = eventId \|\| '__none__'` — непустое значение для фильтра `step_4` |
| step_3 | `tables-upsert-records users` (`continueOnFailure`) | `consent_marketing = true/false` + отметка времени **всегда** |
| step_6 | `tables-upsert-records sessions` (`continueOnFailure`) | сессия закрыта сентинелом `-` |
| step_4 | `tables-find-records events` (`continueOnFailure`) | событие для билета: `title`, `starts_at`, `ends_at`, `address`, `format` (W131 — онлайн без QR); фильтр `id eq eventIdOrNone` |
| step_10 | `tables-find-records quizzes` | все викторины (limit 10); окно проверяет CODE `step_5` (W103) |
| step_5 | CODE «тексты: билет» | `ticketText`/`ticketReplyMarkup`; при сбое `step_3`/`step_6`/`step_4` — текст `common.err.generic`; содержимое зависит от `hasEvent = eventId !== ''`. W76: в билете «Добавить в календарь»; W103: кнопка «Викторина» в окне |
| step_9 | `send_text_message` | билет + кнопки `web_app` (`#/ticket?event_id=…` или `#/events`), отдельным сообщением |

## Зависимости

- **Таблицы**: `users`, `sessions` (запись), `events`, `quizzes` (чтение)
- **Переменные**: `MINIAPP_URL`
- **Connections**: connection среды ([environments.md](../environments.md))

## Заметки

- **Флоу терминальный**: после ответа сразу закрывает сессию и выдаёт билет. Телефон в регистрации не спрашивается (SPEC, DAT-2); `promptMessageId`, `request_contact` и reply-клавиатура здесь не используются.
- **`consent_marketing_at` проставляется и при `no`** — пустую дату платформа игнорирует, так что «очистить» поле было бы нечем.
- **`consent_pdn` этот флоу не трогает** (PAR-1/PAR-2).
- **Только билет, без карточки-подтверждения (ADR-0056).** Прежний `edit_message_text` «итог диалога» и его фолбэк сняты вместе с `cardMessageId`: финал и вопрос о рассылке шлёт `reg-profile`/`reg-consent-pdn` отдельным сообщением, а этот флоу отвечает на уже нажатый `reg:mkt:*` — остаётся один `send_text_message` с билетом.
- **Тексты — во входе `texts`** (ADR-0045, `$t`); ссылки `$t` сверены с
  `i18n/ru.json`: `ticket.header`, `ticket.hint` (онлайн — `ticket.hint_online`,
  W131), `events.catalog.hint`, `menu.btn.events`, `menu.btn.quiz`.
- **Без диплинка (ADR-0034) второе сообщение — кнопка каталога**, не билет:
  `eventId` в черновике сессии пуст, регистрации не было, «Открыть билет» не
  имеет смысла ни при каких данных — она заменена кнопкой `#/events` тем же
  кодом, что выбирает заголовок билета по `hasEvent`. `eventId` в черновик
  кладёт `reg-consent-pdn/step_9` (и `reg-profile` в ветках `finish`), поэтому
  `draftJson` там сохраняется, даже когда карточка больше не редактируется.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)):  `step_3`/`step_6`/`step_4` — `continueOnFailure`, без отдельной ветки отказа
  на каждом. `step_5` читает их `error` и при любом сбое отдаёт `common.err.generic`
  в билет. Регистрация уже создана в `reg-consent-pdn`, поэтому кнопка «Открыть
  билет» под текстом ошибки не ломает IDOR — билет по-прежнему проверяет
  `initData` и факт регистрации на сервере, а не то, что показал этот текст.
- **Тексты `step_5` (W76):** в билете — вторая кнопка «Добавить в календарь»
  (`event.card.btn_calendar`, ссылка Google Calendar). Текста карточки с адресом
  и «Открыть на карте» больше нет (карточку снял ADR-0056).
- **`step_4` фильтрует по `eventIdOrNone` (W102).** `tables-find-records`
  fail-closed отклоняет пустой `eq`, а при онбординге без события `eventId`
  в черновике пуст (ADR-0034). Sentinel даёт пустую выборку, и `step_5`
  выбирает ветку «события нет» как раньше; платформенная гоча — `AGENTS.md`.
- **Кнопка «Викторина» в билете (W103, ADR-0041).** Финальный экран
  онбординга — тупик для викторины: меню здесь не вызывается, и без этой
  кнопки участник, только что завершивший профиль, входа не видит. `step_10`
  читает `quizzes`, `step_5` проверяет окно в CODE (диапазонные фильтры по
  DATE не работают, Q15) и при открытом окне добавляет кнопку `qz:start`
  последней строкой билета; вне окна кнопки нет. Маршрут колбэка и ack —
  в `tg-router` (ветка `quiz`, `step_26`), как у меню.
