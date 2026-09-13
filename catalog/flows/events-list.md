# Flow: events-list

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на команду `/events` и на колбэки `ev:list:upcoming` / `ev:list:past`
  (ADR-0015: один вопрос со всеми ответами — один флоу)
- **Назначение**: список ивентов (PAR-3) — будущие и прошедшие раздельно,
  с переключателем вкладок.
- **Flow ID (MCP)**: `UxuFOI7GvXaboDQZHHKSI` · **externalId**: `5Vwo7OcDP4TfHHCaPQycx`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId` | — |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack — падает на пустом `callback_query_id` при входе командой, это ожидаемо | `{{trigger['output'].data.callbackQueryId}}` |
| step_2 | `tables-find-records events` | ивенты со `status = published`, `limit 50` | фильтр `status eq published` |
| step_3 | CODE «render list» | вкладка по `callbackData` (`ev:list:past` → прошедшие, иначе будущие), деление списков в коде, ташкентское время через `Intl` | `{{step_2['output']}}`, `texts: events.list.*` |
| step_4 | `send_text_message` | список + переключатель вкладок | `{{step_3['output'].text}}`, `{{step_3['output'].reply_markup}}` |

## Зависимости

- **Таблицы**: `events` (чтение)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Деление на будущие/прошедшие — в CODE, не в фильтре.** Диапазонные
  сравнения по `DATE` не работают ни в MCP, ни в qadam'е (Q15): читаем по
  `status eq published` и делим в шаге. Прошедший = `ends_at` (или
  `starts_at`, если `ends_at` пуст) уже наступил; будущие — все остальные,
  разрывов нет.
- **Постфильтр `status = published` повторяется в коде** (defense in depth,
  Q25): снятый платформой фильтр даёт пустой список, а не чужую выдачу.
- **Тексты — во входе `texts`** (ADR-0014); значения сверены с `i18n/ru.json`.
- Вкладка по умолчанию — будущие: неизвестный `callbackData` ведёт туда же
  (`past` только на точном `ev:list:past`).
- **Порядок в обеих вкладках — по `starts_at` по возрастанию**; ивент с
  непарсящейся датой считается будущим, чтобы не пропасть из выдачи молча.
