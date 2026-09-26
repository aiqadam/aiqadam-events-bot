# Flow: reg-consent-mkt

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_marketing`
- **Назначение**: отдельное согласие на рассылку (PAR-2, необязательное).
  Любой ответ закрывает сессию. Если черновик несёт `eventId` — регистрация
  остаётся в силе, выдаётся **билет отдельным сообщением** (телефон не
  спрашивается с 2026-09-14). Если `eventId` пуст (ADR-0034: онбординг без
  диплинка) — регистрации не было, вторым сообщением уходит кнопка каталога
  Mini App вместо билета.
- **Flow ID (MCP)**: `uOKODGfZjyhNbED320cjz` · **externalId**: `PWmFAu3Ia71OyANEgzwxN`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId`, `sessionDraft` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack |
| step_2 | CODE «decide yes/no + разбор draft» | `isYes`, `cardMessageId`, `eventId`, `utm`; `eventIdOrNone = eventId \|\| '__none__'` — непустое значение для фильтра `step_4` (пустой `eq` валит шаг) |
| step_3 | `tables-upsert-records users` (`continueOnFailure`) | `consent_marketing = true/false` + отметка времени **всегда** |
| step_6 | `tables-upsert-records sessions` (`continueOnFailure`) | сессия закрыта сентинелом `-` |
| step_4 | `tables-find-records events` (`continueOnFailure`) | событие для финальной карточки: `title`, `starts_at`, `ends_at`, `address`, `lat`, `lon` (W76 — карта и календарь); фильтр `id eq eventIdOrNone` — при онбординге без события (ADR-0034) даёт пустую выборку, а не падение |
| step_10 | `tables-find-records quizzes` | все викторины (limit 10); диапазон по DATE не фильтруется (Q15) — окно проверяет CODE `step_5` (W103) |
| step_5 | CODE «тексты: финальная карточка и билет» | `cardText`/`ticketText`/`ticketReplyMarkup`, время Tashkent; при сбое `step_3`/`step_6`/`step_4` — оба текста заменяются на `common.err.generic`; заголовок карточки и содержимое второго сообщения зависят от `hasEvent = eventId !== ''`. W76: карточка несёт адрес и «Открыть на карте» (только при валидных координатах, не `(0,0)`), в билет добавлена кнопка «Добавить в календарь». W103: пока открыто окно викторины, в билет добавляется кнопка «Викторина» (`callback_data: qz:start`) |
| step_7 | `edit_message_text` (`continueOnFailure`) | карточка → итог диалога, **кнопки сняты** |
| step_8 (On failure) | `send_text_message` | фолбэк: новая карточка если редактирование не удалось |
| step_9 | `send_text_message` | второе сообщение, `reply_markup` = `step_5['output'].ticketReplyMarkup`: билет + кнопка `web_app` на `#/ticket?event_id=…` (есть событие) или кнопка `web_app` на `#/events` (события нет, ADR-0034) |

## Зависимости

- **Таблицы**: `users`, `sessions` (запись), `events`, `quizzes` (чтение)
- **Переменные**: `MINIAPP_URL`
- **Connections**: connection среды ([environments.md](../environments.md))

## Заметки

- **Флоу терминальный**: после ответа сразу закрывает сессию и выдаёт билет. Телефон в регистрации не спрашивается (SPEC, DAT-2); `promptMessageId`, `request_contact` и reply-клавиатура здесь не используются.
- **`consent_marketing_at` проставляется и при `no`** — пустую дату платформа игнорирует, так что «очистить» поле было бы нечем.
- **`consent_pdn` этот флоу не трогает** (PAR-1/PAR-2).
- **Билет уходит новым сообщением, а не редактированием карточки.** Правило ADR-0017: состояние диалога редактируется, факт, к которому вернутся, отправляется. Билет оказывается внизу ленты, а не наверху, где висит карточка начала диалога.
- **У финального редактирования есть фолбэк** (`step_8`): `cardMessageId = 0` или удалённая карточка дают `400 «message to edit not found»`, шлём новую карточку. Это единственный фолбэк в этом флоу.
- **Тексты — во входе `texts`** (ADR-0014); значения сверены с `i18n/ru.json`: `reg.done.header`/`profile.saved.header` (заголовок карточки — по `hasEvent`), `reg.consent_marketing.saved_yes/no`, `ticket.header`, `ticket.hint`, `events.catalog.hint`, `menu.btn.events`.
- **Без диплинка (ADR-0034) заголовок — «Профиль сохранён», не «Вы
  зарегистрированы»**: `eventId` в черновике сессии пуст, регистрации не
  было (её создавать было не на что — см. `catalog/flows/reg-profile.md`,
  ветка `finish_no_event`). Кнопка «Открыть билет» здесь не имеет смысла
  ни при каких данных: заменена кнопкой каталога `#/events` тем же кодом,
  что выбирает и заголовок.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)):  `step_3`/`step_6`/`step_4` — `continueOnFailure`, без отдельной ветки отказа
  на каждом. `step_5` читает их `error` и при любом сбое отдаёт `common.err.generic`
  и в карточку, и в билет (не только карточку — иначе билет пришёл бы валидным
  текстом на несохранённое состояние). Регистрация уже создана в `reg-consent-pdn`,
  поэтому кнопка «Открыть билет» под текстом ошибки не ломает IDOR — билет
  по-прежнему проверяет `initData` и факт регистрации на сервере, а не то,
  что показал этот текст.
- **Тексты `step_5` (W76):** в карточке — адрес и «Открыть на карте» (ссылка
  только при валидных координатах, не `(0,0)`), в билете — вторая кнопка
  «Добавить в календарь» (`event.card.btn_calendar`, ссылка Google Calendar).
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
