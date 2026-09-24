# Flow: quiz-answer

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `tg-router`
  (свободный текст на шаге `q_await_*` при `sessions.scenario=quiz`); payload
  `{chatId, telegramId, callbackData, callbackQueryId, messageText, messageId, firstName, lastName}`
- **Назначение**: принять свободный ответ, записать его с временем и перевести
  викторину к следующему вопросу или к финалу
  ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)).
- **Flow ID (MCP)**: `g2CN4zwC3cJXj59bCYOMR` · **externalId**: `dCl7H1XhNWfqDx5BMR4UA`

## Контракт

- **сессии/окна нет** (или номер вопроса вне диапазона) → `Outcome: ignore`,
  ничего не отправляется;
- **окно закрылось по ходу** → `quiz.closed`, ответ не пишется, сессия
  закрывается (`step_16`), чтобы текст больше не уходил в викторину;
- **ответ** → upsert `quiz_answers` (`answer` ≤500 символов, `elapsed_ms`,
  `late = elapsed > 10000`, `display_name`), затем следующий вопрос или финал.
  Финал: upsert `quiz_attempts.finished_at`, сессия закрывается (`scenario='-'`,
  `step='-'`), отправляется `quiz.done`.

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | приём payload от `tg-router` |
| step_1 | `tables-find-records sessions` | сессия вызывающего (лимит 1) |
| step_2 | CODE «parse session» | `active` (scenario=quiz, step `q_await_*`), `quizId`, `idx`, `count`, `shownAt` из `draft` |
| step_3 | `tables-find-records quizzes` | викторина по `id eq quizIdOrNone` — проверка окна |
| step_4 | `tables-find-records quiz_questions` | вопросы викторины (лимит 100) |
| step_5 | CODE «compute answer» | `outcome` (`next`/`finish`/`reply`/`ignore`), поля ответа, текст следующего вопроса/финала, `nextDraft` |
| step_6 | ROUTER `answer outcome` | `next` / `finish` / `reply` / `Otherwise` (noop) |
| step_7→9 | upsert `quiz_answers` → upsert `sessions` → `send_text_message` | ветка `next`: запись ответа, `idx+1`, вопрос |
| step_10→13 | upsert `quiz_answers` → upsert `quiz_attempts` → upsert `sessions` → `send_text_message` | ветка `finish`: запись ответа, `finished_at`, закрытие сессии, `quiz.done` |
| step_14 | `send_text_message` | ветка `reply`: `quiz.closed` |
| step_16 | `tables-upsert-records sessions` | ветка `reply`: сессия закрывается (`scenario='-'`, `step='-'`) — иначе после закрытия окна `tg-router` продолжает уводить текст в `quiz_answer` вместо меню |
| step_15 | CODE noop | непустой fallback ROUTER'а |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`), `quizzes`
  (`RA6NwbSZw7rGtcYW7dB9x`), `quiz_questions` (`Uow3rhLvdObG1mBdUcxuS`),
  `quiz_answers` (`tcwKTQH8W1EG4SHeHdoRr`), `quiz_attempts` (`JPo7yK4N9lxN8HxBwpmRs`)
- **Флоу**: вызывается из `tg-router` (ветка `quiz_answer`, `inline`,
  `waitForResponse:false`); пара — `quiz`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Время ответа — от отправки вопроса** (`draft.shownAt`), не от просмотра
  гостем; `late` — метка, а не отказ (ADR-0041 п. 4). Активного таймера/`Delay`
  нет: платформа не держит секунды точно (long-polling, диспетчер).
- **Переход делает ответ**, а не расписание: если гость не пишет, вопрос ждёт.
  На стойке это никого не блокирует — у каждого свой чат.
- **`display_name`** — `firstName lastName` из Telegram на момент ответа; профиль
  не читается, чтобы не добавлять шаг.
- **`elapsed_ms = 0`** при `shownAt <= 0` (защита от битого `draft`); такой ответ
  не помечается `late`.
- **Сессия закрывается сентинелами** `scenario='-'`, `step='-'` — так её видит
  `tg-router/step_8` («сессии нет», W26/W60).
