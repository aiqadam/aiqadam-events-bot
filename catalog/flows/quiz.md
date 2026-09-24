# Flow: quiz

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `tg-router`
  (колбэк `qz:start`); payload
  `{chatId, telegramId, callbackData, callbackQueryId, messageText, messageId, firstName}`
- **Назначение**: вход в викторину ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)):
  проверить окно, отсечь завершённую попытку, начать (или начать заново) и
  отправить первый вопрос. Ответы ведёт `quiz-answer`.
- **Flow ID (MCP)**: `6wceNeNPjDvHW7zXOOBi2` · **externalId**: `WE8CzyJMuEnEXm1iBufk7`

## Контракт

Колбэк `qz:start` приходит из кнопки «Викторина» в `menu` (видна только в окне).

- **окно закрыто** (или викторина не заведена) → текст `quiz.closed`, записей нет;
- **попытка завершена** (`quiz_attempts.finished_at` непусто) → `quiz.already`,
  записей нет; перепройти нельзя;
- **иначе** → старт: upsert `quiz_attempts` (`started_at=now`), upsert `sessions`
  (`scenario=quiz`, `step=q_await_answer`, `draft={quizId, idx:1, count, shownAt}`),
  отправка вступления `quiz.intro` + вопроса 1 `quiz.q_header`/`quiz.q_hint`.

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | приём payload от `tg-router` |
| step_1 | `tables-find-records quizzes` | все викторины (лимит 10); диапазон по DATE не фильтруется (Q15) |
| step_2 | CODE «resolve active quiz» | окно `now ∈ [starts_at, ends_at]`, выбор позднейшей; `quizId`/`quizIdOrNone`, `nowIso`/`nowMs`; нет активной → `active:false` |
| step_3 | `tables-find-records quiz_questions` | вопросы по `quiz_id eq quizIdOrNone` (лимит 100) |
| step_4 | `tables-find-records quiz_attempts` | попытка по `quiz_id`+`telegram_id` (лимит 1) |
| step_5 | CODE «decide entry» | `outcome`: `start` / `reply`; собирает текст вопроса 1 и стартовый `draft` сессии |
| step_6 | ROUTER `entry outcome` | `start` / `reply` / `Otherwise` (структурный noop) |
| step_7 | `tables-upsert-records quiz_attempts` | `started_at=now`; `finished_at` не трогает |
| step_8 | `tables-upsert-records sessions` | `scenario=quiz`, `step=q_await_answer`, `draft` с `idx:1` |
| step_9 | `send_text_message` | вопрос 1 (текст из `step_5`) |
| step_10 | `send_text_message` | `reply`-ветка: `quiz.closed` / `quiz.already` |
| step_11 | CODE noop | непустой fallback ROUTER'а |

## Зависимости

- **Таблицы**: `quizzes` (`RA6NwbSZw7rGtcYW7dB9x`), `quiz_questions`
  (`Uow3rhLvdObG1mBdUcxuS`), `quiz_attempts` (`JPo7yK4N9lxN8HxBwpmRs`),
  `sessions` (`toTKgngMTqDNJWDpQMh4d`) — чтение/запись
- **Флоу**: вызывается из `tg-router` (ветка `quiz`, `inline`, `waitForResponse:false`);
  пары — `quiz-answer`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`flowProps` у вызова — обёртка `{"payload": {...}}`** (гоча 7a); callee читает
  поля плоско: `{{trigger['output'].data.<field>}}`.
- **Свободный ввод сюда не приходит**: тексты во время викторины маршрутизирует
  `tg-router` в `quiz-answer` по `sessions.step = q_await_*`. Этот флоу — только вход.
- **Профиль не проверяется**: кнопка живёт в меню, а меню рендерит её лишь после
  онбординга (ADR-0034). Устаревший колбэк `qz:start` у неонборднутого — не риск
  (викторина публичная, ПД не читает).
- **Перезапись сессии** — способ «начать сначала»: старый `draft` (недоделанная
  попытка) затирается записью `idx:1`; ответы перезапишутся по своим ключам
  в `quiz-answer`.
- **Пустой `quiz_id` в фильтрах недопустим** (fail-closed платформы): везде
  сентинел `__none__` (`quizIdOrNone`).
