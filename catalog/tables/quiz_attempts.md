# Table: quiz_attempts

- **Назначение**: попытка прохождения викторины ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)):
  кто начал и когда закончил. Служит замком «одна попытка»: завершённую
  (`finished_at` непусто) перепройти нельзя, недоделанную — можно начать сначала.
- **externalId таблицы**: `JPo7yK4N9lxN8HxBwpmRs` · **внутренний id**: `LWUEI27IwYuV9sXOVBw4R`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| quiz_id | TEXT | `zbgUjxPT1E7G6lE0u79Py` | `bjA1d84XKABjHkxClN26F` | викторина, часть ключа |
| telegram_id | TEXT | `YCln1HsH5h0pN0DQ6VzU5` | `nFRfAMn5v2vzftWEGtOv7` | участник (DAT-1), часть ключа |
| started_at | DATE | `Szk76LrXvZMW2ycwCRxi1` | `V6Iajxj8Ynk7HHuB0BUZj` | когда начал; обновляется при старте заново |
| finished_at | DATE | `EGGvJgw5tF3ig4lHqVzmz` | `9ssaesTtriLx7nTo5aMMN` | пусто = не завершена; по нему ворота повторного входа |

## Заметки

- **Ключ `(quiz_id, telegram_id)`** — `tables-upsert-records`. Уникальность не
  гарантирована БД ([ADR-0003](../../docs/adr/0003-idempotency-without-atomicity.md));
  матч делает qadam. Повторный вход в незавершённую викторину обновляет
  `started_at`, `finished_at` не трогает.
- **Границы попытки определяется `finished_at`, а не счётчиком ответов**: счёт
  ответов мог бы дать ложное «завершено», если вопросы викторины поправят в середине.
- **Попытки пользователя удаляются самоудалением аккаунта**: `reg-api/delete_account`
  проходит по `quiz_answers` и `quiz_attempts` вызывающего (W103,
  [ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md)).
