# Flow: reg-afterword

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вход: `telegramId`,
  `chatId`, `eventId`
- **Назначение**: послесловие после чекина ([ADR-0017](../../docs/adr/0017-screen-not-message.md)
  п. 7) — «спасибо, что были» плюс ближайший следующий ивент с кнопкой
  регистрации. Единственное исходящее касание после ивента.
- **Flow ID (MCP)**: `oMIjSHxUO7m9P7iaeMZ8y` · **externalId**: `1lrH7mXwLldQhc8p1Y2sC`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: кому и по какому ивенту |
| step_2 | `tables-find-records registrations` | строка регистрации по `<eventId>-<telegramId>` |
| step_1 | CODE «пришёл ли гость на самом деле» | `attended` по непустому `checked_in_at` |
| step_3 | ROUTER «пришёл?» | `attended` / `Otherwise` |
| step_5 (`Otherwise`) | CODE «не приходил — молчим» | лог с причиной `not_attended` |
| step_4 (`attended`) | `@aiqadam/qadam-store : put_if_absent` | захват ключа `afterword:<eventId>-<telegramId>` |
| step_6 (`attended`) | ROUTER «первый раз?» | `first` / `Otherwise` |
| step_8 (`Otherwise`) | CODE «послесловие уже отправляли» | лог с причиной `already_sent` |
| step_7 (`first`) | `tables-find-records events` | опубликованные ивенты — из них выбирается ближайший будущий |
| step_9 (`first`) | CODE «текст послесловия + ближайший ивент» | текст и кнопка на deep link |
| step_10 (`first`) | `send_text_message` | послесловие |

## Зависимости

- **Таблицы**: `registrations`, `events` (чтение)
- **Переменные**: `BOT_USERNAME` (deep link на следующий ивент)
- **Store**: `afterword:<eventId>-<telegramId>`, `COLLECTION`, **без TTL**
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Порядок ворот принципиален: сначала присутствие, потом ключ.**
  `put_if_absent` гейтит **отправку**, а не вход во флоу, поэтому захват
  стоит внутри ветки `attended`. Если захватывать ключ раньше проверки,
  вызов для не пришедшего гостя сжигает ключ навсегда: человек, отмеченный
  позже, не получит послесловия никогда, а в логе это будет выглядеть как
  «уже отправляли». Это не теория — так и было собрано в первой версии,
  и вызывающий (W12) вполне может звать флоу по списку регистраций.
- **Доказательство присутствия — непустой `checked_in_at`, а не статус
  регистрации.** `registered` означает «записался», а не «пришёл».
- **`put_if_absent` отдаёт поле `stored`, а не `acquired`.** Ошибка в имени
  не валит шаг и не видна в валидации — гейт просто всегда закрыт, и
  послесловие молча не уходит никому.
- **Две причины молчания различаются в логе** (`not_attended` против
  `already_sent`): при разборе жалобы «мне не пришло» это разные истории.
- **Два ROUTER'а, а не один с составным условием.** Условие `attended && stored`
  в одной ветке потребовало бы захватывать ключ до ветвления — то есть
  ровно того дефекта, от которого уходили.
- **Кто вызывает:** [`lifecycle`](lifecycle.md) ([W12](../../docs/BACKLOG.md#w12-жизненный-цикл-и-напоминания)):
  цикл по регистрациям с непустым `checked_in_at` у финишировавших ивентов
  (плюс catch-up 48 ч), `callFlow` с `{telegramId, chatId, eventId}`.
  `checkin-api` пакетом W28 **не менялся**.
- **Ближайший ивент выбирается в CODE, а не запросом:** у `tables-find-records`
  нет сортировки, поэтому берутся все опубликованные и сортируются по
  `starts_at` на месте. Отменённые и завершённые отсеиваются, текущий ивент
  исключается.
