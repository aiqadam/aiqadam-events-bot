# Table: quiz_answers

- **Назначение**: свободные ответы участника ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)).
  Одна строка на пару (викторина, участник, вопрос). Ответы не скоринг —
  победителей определяет владелец вне системы, выгружая таблицу.
- **externalId таблицы**: `tcwKTQH8W1EG4SHeHdoRr` · **внутренний id**: `0XbW7Mm9jS8rO9T3PFX3Y`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| quiz_id | TEXT | `5KdiLsnBLjzmGztcRNVNE` | `4ISuL3ijicFGJcPMqyxPy` | викторина, часть ключа |
| telegram_id | TEXT | `2BAq301w1b6cMrkFhi6wN` | `oyLy2cqnpWz5qgYRgW7C0` | участник (DAT-1), часть ключа |
| question_idx | NUMBER | `cl72Lugc5JYhevn3iHVZM` | `lgcitsznlfmG8upYrDJrE` | номер вопроса, часть ключа |
| answer | TEXT | `XueeXCZW4ubs8Ed1QHwXw` | `hWJxZF3vyoP3Tz4fB4rWS` | текст ответа, обрезан до 500 символов |
| answered_at | DATE | `Rep2FlfObV5GK3ypiKP1c` | `ucRDyl4ygygaDGj6SsXcT` | UTC, момент приёма ответа |
| elapsed_ms | NUMBER | `hN0pdoo5kervGHv5F16VE` | `Jt542qouQLj1CWPmkDjtR` | мс от отправки вопроса до ответа |
| late | STATIC_DROPDOWN | `xTAR5v3pS5F6gDEqQDFqf` | `rMvn42WuKkGnV5yaolX7o` | `true`/`false`: ответ позже 10 с |
| display_name | TEXT | `T26xWiZNFdFq3iWBYwkmK` | `iUR0cDB4Ccoz6xNk30q4m` | имя из Telegram на момент ответа — для читаемой выгрузки |

`late` options: `["true", "false"]`.

## Заметки

- **Ключ `(quiz_id, telegram_id, question_idx)`** — upsert перезаписывает ответ
  на тот же вопрос, а не плодит строку. При старте заново все вопросы
  проходятся снова, поэтому старых ответов не остаётся: они перезаписываются
  по своим ключам.
- **`elapsed_ms` не режется**: «10 секунд» — не запрет, а пометка `late`
  (ADR-0041 п. 4). Время приблизительное — считается от отправки вопроса ботом.
- **ПД**: `answer` (свободный текст) и `display_name` лежат в таблице и
  выгружаются владельцем. Следствие — самоудаление аккаунта чистит и эти строки:
  `reg-api/delete_account` проходит по `quiz_answers` и `quiz_attempts`
  вызывающего (W103, [ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md)).
- **Пишет только `quiz-answer`**; `quiz` пишет попытку и сессию, ответов не трогает.
