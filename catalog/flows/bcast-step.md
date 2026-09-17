# Flow: bcast-step

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `tg-router`
  (колбэки `bcast:*`, кроме `bcast:unsub:`); payload
  `{chatId, telegramId, callbackData, callbackQueryId}`
- **Назначение**: один флоу на последовательность структурно одинаковых
  вопросов рассылки (ADR-0016): выбор ивента → сегмент → превью → тест →
  отправка/отмена (OWN-9, OWN-10).
- **Flow ID (MCP)**: `Sr1e3imXkI8sN0lXyROtA` · **externalId**: `aoPOkCesQhbnxSP2Yv7ul`

## Контракт

Колбэки (формат проверяет `step_2`, мусор уходит в `Otherwise` тихо):

- `bcast:ev:<eventId>` — черновик из сессии → строка `broadcasts`
  (`status='draft'`, сегмент по умолчанию `registered`) + экран сегментов;
- `bcast:seg:<bid>:<segment>` — гейты (создатель, staff, сегмент, время
  `no_show`) → превью (`bcast.preview.*` + счётчик) с кнопками
  тест/отправка/отмена;
- `bcast:test:<bid>` — отправка тела себе **с кнопкой отписки** (овнер видит
  ровно то, что уйдёт) → штамп `test_sent_at` только при доставке;
- `bcast:send:<bid>` — гейты (создатель, сегмент задан, `test_sent_at`,
  время `no_show`) → `callFlow bcast-run`; повторный запуск бегущей
  рассылки — resume с уведомлением `bcast.interrupted`, а не дубль;
  повторный запуск остановленной (`status='failed'`) — явный отказ
  `bcast.send_after_stop`, а не тишина;
- `bcast:cancel[:<bid>]` — своя строка гаснет (`status='failed'`), чужая
  кнопка чистит только собственную сессию; отмена черновика отвечает
  `bcast.cancelled`, отмена бегущей — честным `bcast.cancelled_running`
  (текущий чанк досылается, остаток не уйдёт).

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | приём колбэка |
| step_1 | `answer_callback_query` | ack; `continueOnFailure` |
| step_2 | CODE «parse callback» | `{op, bid, arg, valid}` |
| step_3 | ROUTER `by op` | `ev`/`seg`/`test`/`send`/`cancel`/`Otherwise` |
| step_4→6 | `tables-find-records` | ветка `ev`: сессия, ивент, staff |
| step_7 | CODE «gate + segment keyboard» | гейты сессии/ивента/staff, генерация `bid`, клавиатура сегментов |
| step_8 | ROUTER `ev gate` | `ok` → создать строку + сессия + экран; иначе текст отказа |
| step_9→11 | `create broadcasts`, `upsert sessions`, `send_text_message` | строка черновика, сессия `await_segment` (`draft={bid}`), экран сегментов |
| step_12 | `send_text_message` | текст отказа `ev` |
| step_13→20 | `tables-find-records` ×5 + CODE | ветка `seg`: рассылка, контекст (`bid/eventId`), ивент, staff, регистрации, `memberCsv`, `users in-csv`, consent-база |
| step_21 | CODE «decide preview» | гейты + подсчёт тем же правилом, что материализация (`attended`-множество, дедуп, `blocked_bot` вне игры); `locked` для `no_show` до `ends_at` |
| step_22 | ROUTER `seg verdict` | `ok` / `locked` / иначе-отказ |
| step_23→24 | `upsert broadcasts`, `send_text_message` | сохранить сегмент, превью с кнопками |
| step_25→26 | `send_text_message` ×2 | тексты `locked` / отказа |
| step_27→28 | `find broadcasts`, CODE «test gate» | ветка `test`: создатель + непустое тело, `unsubMarkup` |
| step_29 | ROUTER `test gate verdict` | |
| step_30→31 | `send_text_message` (`continueOnFailure`), CODE «test delivered?» | тест себе с кнопкой отписки; доставка по отсутствию ошибки |
| step_32 | ROUTER `delivered verdict` | |
| step_33→34 | `upsert broadcasts`, `send_text_message` | штамп `test_sent_at`, `bcast.test.sent` |
| step_35→36 | `send_text_message` ×2 | `common.err.generic` (тест не дошёл) / текст отказа гейта |
| step_37→40 | `find broadcasts`, CODE ×2 | ветка `send`: контекст + финальный гейт (`test_sent_at`, `no_show`-время, `failed` → `bcast.send_after_stop`); `resumed = status='running'` |
| step_41 | ROUTER `send verdict` | |
| step_42 | ROUTER `resumed?` | resume → сначала `bcast.interrupted`, затем вызов; иначе сразу вызов |
| step_43→45 | `send_text_message`, `callFlow bcast-run` ×2 | уведомление о продолжении + запуск/перезапуск прогона |
| step_46 | `send_text_message` | текст отказа `send` |
| step_47→49 | CODE, `find broadcasts`, CODE | ветка `cancel`: `bidOrNone` (сентинел `__none__`), `{hasMine, bid, wasRunning, text}` — текст зависит от статуса: `running` → `bcast.cancelled_running`, иначе `bcast.cancelled` |
| step_50 | ROUTER `cancel verdict` | |
| step_51→53 | `upsert broadcasts`, `upsert sessions`, `send_text_message` | своя строка → `failed`, чистка сессии, текст из `step_49` |
| step_54→55 | `upsert sessions`, `send_text_message` | чужая кнопка: только своя сессия + `bcast.cancelled` |
| step_56 | CODE «unknown bcast callback» | лог (`Otherwise` от `step_3`) |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`), `events`
  (`R4aSQpLZvw7d3u6DVOSjH`), `staff` (`PnDy6gw9tlLUqTGk2EOUn`),
  `broadcasts` (`XrygYF5Q4EUOKkaBFallb`), `registrations`
  (`SM8tMxfQuQCHRDdAiNJyQ`), `users` (`xHhYjhwqKdONkrYJGcBsz`) — чтение;
  запись: `broadcasts`, `sessions`
- **Флоу**: вызывается из `tg-router` (ветка `bcast_step`); зовёт `bcast-run`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Черновик — личный диалог создателя**: ветки `seg`/`test`/`send` требуют
  `created_by == sender` (плюс staff-доступ к чаптеру). Кнопку чужой рассылки
  нажать можно, сделать — нет.
- **Пришедший считается по множеству**: у кого есть ХОТЯ БЫ ОДНА строка
  с `checked_in_at`, тот в `attended` и исключён из `no_show` (дубли пар
  схлопываются, ADR-0003). То же правило — в `bcast-run`.
- **`test_sent_at` ставится только при доставке** (`continueOnFailure` +
  проверка ошибки, а не blind-оптимизм). Недоставленный тест не открывает
  отправку — серверный гейт в `bcast-run` это дублирует.
- **Фильтры с пустым значением не используются**: `eventIdOrNone`/`bidOrNone`
  с сентинелом `__none__` (fail-closed: пустое значение валит чтение).
- **`flowProps` у `callFlow` — обёртка `{"payload": {...}}`** (глобальная
  гоча 7a); `exampleData` совпадает с триггером callee.
