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
  Если регистраций много, шаг ограничен обычным пределом Bot API
  (тот же принцип `retry_after`/`blocked_bot`, что и в W14, но не реализован
  здесь явно — намеренное упрощение, зафиксированное Q36).
- **`published_at` — пустая строка при `edit`, не `''`-очистка**: платформенный
  факт «пустая строка не очищает `DATE`-поле» (см. CLAUDE.md) здесь работает
  **в нашу пользу** — `tables-upsert-records` с `publishedAt: ''` оставляет
  существующий `published_at` нетронутым при правке, а не затирает его. При
  создании (`isEdit=false`) `publishedAt` = текущее время.
- **Найденная платформенная ловушка `LOOP_ON_ITEMS`, ранее не задокументированная
  нигде в проекте**: обращение к текущему элементу цикла из дочернего шага —
  **`{{loopStepName['output'].item}}`**, а НЕ `{{loopStepName['output']}}`
  (голый, без `.item`) и НЕ `{{loopStepName.currentItem}}`. Обе неверные формы
  проходят `ap_validate_flow` и даже проходят прогон с **нулевыми** итерациями
  (пустой список целей уведомления) — ошибка проявляется только когда в цикле
  реально есть ≥1 элемент, и тогда прогон падает `INTERNAL_ERROR` без детализации
  по шагам. Найдено на прогоне правки `emtzwkv2mdtus` с одной реальной
  регистрацией: `INTERNAL_ERROR` без объяснения → изолированный одноразовый
  стенд (`w26-scratch-loop-test`, удалён после) перебором трёх синтаксисов
  подтвердил правильную форму. Это стоит унести в
  [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) как факт платформы: **тесты
  `LOOP_ON_ITEMS` с пустым списком маскируют ошибки синтаксиса текущего элемента.**
- Проверено `ap_test_flow` (cancel/noop/publish-create/publish-edit-with-changes/
  publish-edit-no-changes) и полным интеграционным прогоном правки реального
  тестового ивента `emtzwkv2mdtus`: диф посчитан верно, уведомление доставлено
  реальному зарегистрированному, `published_at` не переписан при правке.
  Интеграционная маршрутизация через `tg-router` (`route: wiz_publish` на
  реальном `callback_query`) — прогон `txh7HK0Zo0mXlPRQD0D9j`. Тестовые
  фикстуры (`emtzwkv2mdtus` + его регистрация) удалены после проверки —
  реальному прогону этого флоу, в отличие от `checkin-api`, не нужна
  постоянная фикстура: ревьюер создаёт свой ивент через `/newevent`.
