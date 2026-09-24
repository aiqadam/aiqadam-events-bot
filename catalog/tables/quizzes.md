# Table: quizzes

- **Назначение**: окно викторины в чате бота ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)).
  Одна строка — одна викторина: название и окно `starts_at`/`ends_at`.
  Вход возможен только внутри окна; вне окна ни кнопка в меню, ни флоу ответов
  не работают.
- **externalId таблицы**: `RA6NwbSZw7rGtcYW7dB9x` · **внутренний id**: `onPqavTOslmDuytZ5ErDf`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `FavUrUmsZTDfkiMMh3Rie` | `gsiiMIpShxDKz0ZqFPM9E` | slug викторины, ключ |
| title | TEXT | `jWVSRXluLmnbTsJL7mbgm` | `fN4XCLQFf2mSFq8BkyjzH` | название в сообщении-вступлении |
| starts_at | DATE | `GCldG1ju4NwPtiBUpiZuS` | `TykeFiofjxY07kCNIh7kH` | начало окна, UTC |
| ends_at | DATE | `PDT4IeAn7jN4Zraw3nrEL` | `pA4G34vYGVqRGTVAJIDcu` | конец окна, UTC |

## Заметки

- **Диапазонные фильтры по DATE не работают** ([Q15](../../docs/OPEN-QUESTIONS.md#q15)):
  активная викторина выбирается в CODE-шаге `quiz/step_2` — читаются все строки
  (лимит 10), окно проверяется сравнением `now >= starts_at && now <= ends_at`.
  То же правило в `menu/step_11`.
- Если подходящих окон несколько, берётся викторина с самым поздним `starts_at`.
- Строка заводится вручную (MCP); UI создания нет — это осознанный скоуп W103.
