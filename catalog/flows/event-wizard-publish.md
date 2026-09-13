# Flow: event-wizard-publish

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается из `tg-router` (`route: wiz_publish`,
  `callback_query.data` = `wiz:publish`/`wiz:cancel` при `sessions.step='preview'`)
- **Назначение**: завершение визарда — публикация/сохранение ивента
  (create или edit) либо отмена; при правке опубликованного считает diff
  «было → стало» и рассылает уведомление зарегистрированным (OWN-5),
  но **только если изменились значимые поля**.
- **Flow ID (MCP)**: `4nbqCqBrSRZXertysDp7v`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова | `{{trigger['output'].data.callbackData/callbackQueryId/sessionScenario/sessionDraft/telegramId/chatId}}` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | закрыть «часики» на кнопке | |
| step_2 | CODE «decide action» | `cancel`/`publish`/`noop` по `callbackData` | |
| step_3 | ROUTER: `cancel`/`publish`/`Otherwise`(=noop) | | |
| step_4 (cancel) | `send_text_message` | «Отменено.» | |
| step_6 | `tables-upsert-records sessions` | сброс: `scenario='-', step='-', draft='-'` | |
| step_5 (Otherwise/noop) | CODE «ничего не делаем» | защита от повторного/чужого callback | |
| step_7 (publish) | CODE «prepare write + diff» | новый `id` (create) или переиспользование `draft.id` (edit); diff `draft._orig[f]` vs `draft[f]` по `notifyFields`; строит `changeSummaryText`/`ownerConfirmText` | |
| step_8 | `tables-upsert-records events` | запись по ключу `id` | |
| step_9 | `tables-find-records registrations` | `event_id=id`, проекция `telegram_id,status` | |
| step_10 | CODE «compute notify targets» | дедуп `telegram_id` где `status='registered'`; `[]` если `!hasChanges` | |
| step_11 | `LOOP_ON_ITEMS` по `{{step_10['output'].targets}}` | | |
| step_12 | `send_text_message` (в цикле, `continueOnFailure`) | уведомление одному зарегистрированному | `chat_id: {{step_11['output'].item}}` |
| step_13 | `send_text_message` | подтверждение владельцу (`ownerConfirmText`) | |
| step_14 | `tables-upsert-records sessions` | сброс сессии после успешной публикации | |

## Зависимости

- **Таблицы**: `events` (`R4aSQpLZvw7d3u6DVOSjH`), `registrations` (`SM8tMxfQuQCHRDdAiNJyQ`,
  чтение), `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router`; сам никого не вызывает
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **`notifyFields = [title, address, starts_at, ends_at, reg_deadline_at, lat, lon]`** —
  ровно перечень [notify-on-change](../../docs/DATA-MODEL.md#notify-on-change);
  `description`/`photo_file_id` намеренно исключены — правка описания не
  считается достаточно значимой, чтобы дёргать зарегистрированных.
- **`hasChanges` считается только для `scenario='event_edit'`** — при
  создании (`event_create`) `_orig` пуст, `changes=[]`, уведомление не шлётся
  никому (регистраций на новый ивент ещё нет).
- **Узкий цикл уведомления (закрытие [Q36](../../docs/OPEN-QUESTIONS.md#q36),
  [ADR-0016](../../docs/adr/0016-shared-flow-for-same-shaped-touches.md))**:
  прямой `LOOP_ON_ITEMS` по своим же регистрациям события, без троттлинга,
  без ретраев, без таблицы `broadcasts` — это **не** интеграция с будущим
  W14 (массовые рассылки), а узкое решение только для этого уведомления.
  При большом числе регистраций шаг ограничен обычным пределом Bot API
  без бэкоффа на `429` — намеренное упрощение, зафиксированное Q36.
- **`published_at` — пустая строка при `edit`, не `''`-очистка**: пустая
  строка не очищает `DATE`-поле (см. CLAUDE.md), поэтому `tables-upsert-records`
  с `publishedAt: ''` оставляет существующий `published_at` нетронутым при
  правке. При создании (`isEdit=false`) `publishedAt` = текущее время.
- **`step_11`/`step_12` — обращение к текущему элементу цикла через
  `{{step_11['output'].item}}`**, не через голый `{{step_11['output']}}`
  и не `.currentItem` — см. CLAUDE.md (Gotchas Qadam Flow, п. 9).
- Тестовым фикстурам этот флоу не нужен постоянный черновик — ревьюер
  создаёт свой ивент через `/newevent`.
