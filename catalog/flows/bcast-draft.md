# Flow: bcast-draft

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `tg-router`
  (пересланное сообщение без команды), payload
  `{chatId, telegramId, firstName, fwdText, messageId}`
- **Назначение**: пересылка овнера → черновик рассылки в `sessions` + выбор
  события кнопками (OWN-9, headline-UX W14).
- **Flow ID (MCP)**: `2AUeMeakjrrjUqZ0RuGpL` · **externalId**: `uvBaBR9JmEUQV2qKEngnX`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | приём `fwdText` (`text\|\|caption` пересылки, `parse_mode` всегда `None`) |
| step_1 | `@aiqadam/qadam-tables : tables-find-records` | строка `staff` по `telegram_id` |
| step_2 | CODE «staff gate» | `isStaff` + `chapterId`; постфильтр по `telegram_id` (defense in depth, Q25) |
| step_3 | ROUTER: `staff` / `Otherwise` | не-staff пересылка уходит в тишину (форварды от гостей — обычное дело) |
| step_4 | `tables-find-records events` | `published,finished`, лимит 100 |
| step_5 | CODE «build event keyboard» | фильтр по чаптеру staff, сортировка по `starts_at`, кнопки `bcast:ev:<eventId>` + отмена; `draftJson` (`body/createdBy/chatId/mediaChatId/mediaMessageId`) |
| step_6 | ROUTER: `empty` / `Otherwise` | |
| step_7 | `@aiqadam/qadam-telegram-bot : send_text_message` | `owner.events.empty` (ветка `empty`) |
| step_8 | `tables-upsert-records sessions` | `scenario='broadcast'`, `step='await_event'`, `draft` — тело черновика |
| step_9 | `send_text_message` | `bcast.ask.event` + клавиатура событий |
| step_10 | CODE «non-staff forward ignored» | лог тишины (`Otherwise` от `step_3`) |

## Зависимости

- **Таблицы**: `staff` (`PnDy6gw9tlLUqTGk2EOUn`, чтение), `events`
  (`R4aSQpLZvw7d3u6DVOSjH`, чтение), `sessions` (`toTKgngMTqDNJWDpQMh4d`, запись)
- **Флоу**: вызывается из `tg-router` (ветка `bcast_draft`); продолжает
  `bcast-step` (колбэк `bcast:ev:` читает сессию `await_event`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Черновик между пересылкой и выбором события живёт в `sessions.draft`**
  (JSON строкой), а не в строке `broadcasts`: `callback_data` не вмещает
  текст (лимит 64 байта), а строка рассылки создаётся только когда известен
  событие. Отмена до выбора события (`bcast:cancel` без `bid`) чистит только сессию.
- **Черновик всегда привязан к событию** — сегмента «все с consent» без события
  нет (пустой `event_id` не используется); `all_consent` выбирается на экране
  сегментов уже в привязке к событию.
- **Источник `copyMessage` живёт в черновике (W79, #131).** `step_5` кладёт в
  `draft` `mediaChatId` (= `chatId` организатора) и `mediaMessageId`
  (= `messageId` пересланного поста). Отправка идёт копией исходного сообщения,
  поэтому овнер видит в тесте ровно то, что уйдёт (фото, жирный, ссылка под
  словом), а не один пересказанный текст. `body` остаётся текстом/подписью для
  превью.
- **Доступ — граница `manage-api`** (ADR-0024): строка `staff` + (`chapter_id`
  staff пуст или равен чаптеру события). События `draft`/`cancelled`/`finished`
  мимо `published`/`finished` не предлагаются; `finished` нужен для `no_show`.
- **`flowProps` вызова — обёртка `{"payload": {...}}`** (глобальная гоча 7a);
  `exampleData` вызова совпадает с триггером callee.
- **Ack колбэка здесь нет** — его ставит `bcast-step` (единственное место,
  куда ведут кнопки этого экрана).
