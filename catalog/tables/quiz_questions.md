# Table: quiz_questions

- **Назначение**: вопросы викторины ([ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md),
  [W103](../../docs/BACKLOG.md#w103-викторина-в-боте-свободный-ответ-окно-одна-попытка)).
  Ответ — свободный текст, поэтому правильных вариантов и баллов в схеме нет:
  вопросы только показываются, ответы пишутся в `quiz_answers`.
- **externalId таблицы**: `Uow3rhLvdObG1mBdUcxuS` · **внутренний id**: `dJvacDTJfkv3GUwY2CBZs`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| quiz_id | TEXT | `mn9ME7hFjTQ70ITA31EuE` | `0bP9eErHjkFZuPDAmrJCQ` | викторина, часть ключа |
| idx | NUMBER | `hgvp90ZWWWnbACEW1d2Gu` | `FH5wI9kdRxftGpmmFJm0F` | порядковый номер, с 1; часть ключа |
| text | TEXT | `fNi9OSIQOc8fft4Axjrjr` | `9P0wycvZraHexKQLKpKRe` | текст вопроса |

## Заметки

- **Порядок — по `idx`**, сортировка делается в CODE (`quiz/step_5`,
  `quiz-answer/step_5`); фильтры по `idx` не используются.
- Все вопросы викторины читаются одним запросом (`limit 100`,
  фильтр `quiz_id eq <id>`); число вопросов = длина списка.
- Вопросы засеиваются вручную (MCP) на этапе подготовки; UI нет.
