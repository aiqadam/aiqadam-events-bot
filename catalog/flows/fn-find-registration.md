# Flow: fn-find-registration

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: единственная точка чтения `registrations` по паре `(event_id, telegram_id)`;
  при дублях возвращает **самую раннюю** строку (ADR-0003).
- **Flow ID (MCP)**: `OkjryrJdcdZQNAWYamZgr` · **externalId (для `callFlow`)**: `tpvo5a6wLoUAR7SAgl5bw`

## Контракт

**Вход:** `{ eventId: string, telegramId: string }`

**Выход:**

| Поле | Смысл |
|------|-------|
| `found` | есть хотя бы одна строка |
| `inputOk` | вход прошёл проверку формы |
| `duplicates` | сколько строк на пару (норма — 1) |
| `recordId` | id **самой ранней** записи — именно её обновляют |
| `recordIds` | все id, отсортированы по времени регистрации |
| `registration` | плоский объект полей самой ранней строки; `checked_in_at`/`checked_in_by` — от **самого раннего** чекина среди дублей |
| `checkedIn`, `checkedInAt` | был ли чекин и когда (минимальное значение) |
| `registered`, `cancelled` | статус самой ранней строки |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize keys» | проверка формы, сентинел `-` | `{{trigger['output'].data.eventId}}`, `...telegramId` |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | `registrations` по двум `eq`, `limit 50` | `table_id` = `PNuChoFG0tIBTND86yzDL`, поля `event_id` (`6mRpFdqphYL2PtfQwBFEr`), `telegram_id` (`kfw8Et1Msb0Qiki6GMs9b`) |
| step_3 | CODE «pick earliest (ADR-0003)» | сортировка и выбор | `records` = `{{step_2['output']}}` |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_3['output']}}` |

## Зависимости

- **Таблицы**: `registrations` · **Переменные**: — · **Connections**: —

## Заметки

- **Порядок сортировки**: `registered_at` (пустое → в конец), затем `created` записи,
  затем `id` записи. Детерминированность важнее «правильности»: два прогона на одних
  данных обязаны выбрать одну и ту же строку, иначе IDM-2 разъезжается.
- **`checked_in_at` берётся минимальный по всем дублям**, а не из выбранной строки.
  Это прямое требование IDM-2: повторный чекин показывает **исходное** время.
  Проверено на трёх строках с чекинами 13:55 и 13:42 — вернулось 13:42.
- **Пустой `eventId` или `telegramId` не превращается в выборку чужих строк**:
  подставляется `-`, которого не может быть ни в slug'е, ни в `telegram_id`.
  Проверено: пустой `eventId` → `found: false`, `inputOk: false`, выборка пуста.
- `duplicates > 1` — сигнал для `dedup-sweep` (W12b), а не ошибка на месте: удалять
  строки при чтении опаснее, чем жить с дублем.
- **Фильтр по `event_id` обязателен всегда.** Выборка по одному `telegram_id` — это
  чужие регистрации в ответе.
