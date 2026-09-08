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
| `registered`, `cancelled` | статус **канонической** (самой ранней) строки |
| `statuses` | статусы всех строк пары, в том же порядке, что `recordIds` |
| `anyRegistered`, `anyCancelled` | есть ли среди дублей хоть одна строка с таким статусом |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize keys» | проверка формы, сентинел `-` | `{{trigger['output'].data.eventId}}`, `...telegramId` |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | `registrations` по двум `eq`, **без limit** | `table_id` = `PNuChoFG0tIBTND86yzDL`, поля `event_id` (`6mRpFdqphYL2PtfQwBFEr`), `telegram_id` (`kfw8Et1Msb0Qiki6GMs9b`) |
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
- **Правило агрегации статуса названо явно.** Канонической считается **самая ранняя**
  строка — её же обновляет запись (IDM-1), поэтому её статус и есть статус пары,
  он лежит в `registration.status` / `registered` / `cancelled`. Но дубль мог лечь
  позже с другим статусом, и правило «берём раннюю» тогда ошибается в любую из двух
  сторон. Поэтому наружу отдаются `statuses` всех строк и `anyRegistered`/`anyCancelled`:
  вызывающий, которому нужна осторожность (например, «слать ли подтверждение»),
  смотрит на них, а не только на каноническую строку.
  Проверено прогоном `SmIR5pihNT4ykYHIc3cLQ` на нарочно вывернутой фикстуре —
  ранняя строка `cancelled`, поздняя `registered`: вернулось
  `registered: false`, `cancelled: true`, `statuses: ["cancelled","registered"]`,
  `anyRegistered: true`. Двусмысленность видна вызывающему, а не спрятана.
- **Лимита у выборки нет — это часть инварианта, а не небрежность.** С `limit 50`
  страница из 50 строк не обязана содержать самую раннюю, то есть «берём самую
  раннюю» переставало быть правдой ровно там, где дубли и опасны. Строк на пару
  `(event_id, telegram_id)` в норме одна, в патологии единицы, так что потолок
  не нужен.
- `duplicates > 1` — сигнал для `dedup-sweep` (W12b), а не ошибка на месте: удалять
  строки при чтении опаснее, чем жить с дублем.
- **Фильтр по `event_id` обязателен всегда.** Выборка по одному `telegram_id` — это
  чужие регистрации в ответе.
