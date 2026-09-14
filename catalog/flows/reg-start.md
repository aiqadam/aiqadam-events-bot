# Flow: reg-start

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на `/start e<eventId>-<utm>` (ADR-0015: касание = один вопрос/вход)
- **Назначение**: вход участника по deep link. Проверяет доступность мест (OWN-15)
  и показывает **карточку-экран**: факты ивента и вопрос о согласии на ПД
  в одном сообщении, которое дальше редактируется на месте ([ADR-0017](../../docs/adr/0017-screen-not-message.md)).
- **Flow ID (MCP)**: `FkxtgayOK5QubyqqMd9q4` · **externalId**: `HGX7KPhFsyFrapBRvlIAT`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `eventId`, `utm`, `telegramId`, `chatId` |
| step_1 | `tables-find-records events` | ивент по `id` |
| step_2 | `tables-find-records registrations` | регистрации ивента — кормят и подсчёт занятости, и поиск своей строки |
| step_3 | CODE «decide outcome» | `existing` / `new` / `declined` (шесть причин); отдаёт поля карточки и `photoFileId` |
| step_4 | ROUTER по `outcome` | `declined` / `existing` / `new` / `Otherwise` |
| step_5→6 (`declined`) | CODE текст по причине → `send_text_message` | вежливый отказ, регистрация не создаётся |
| step_7→8 (`existing`) | CODE `reg.already` → `send_text_message` + кнопка `web_app` | второе подтверждение не шлём (IDM-1) |
| step_9 (`new`) | CODE «build card: ивент + вопрос ПД» | один текст на весь экран + inline-кнопки `reg:pdn:yes` / `reg:pdn:no` |
| step_12 (`new`) | `send_media` (`continueOnFailure`) | афиша отдельным сообщением — **штатно падает**, если афиши нет (см. «Заметки») |
| step_10 (`new`) | `send_text_message` | **единственная отправка карточки за весь диалог** |
| step_15 (`new`) | CODE «draft JSON + cardMessageId» | собирает черновик сессии вместе с id карточки |
| step_11 (`new`) | `tables-upsert-records sessions` | `scenario=registration`, `step=await_pdn` |

## Зависимости

- **Таблицы**: `events`, `registrations` (чтение), `sessions` (запись)
- **Переменные**: `MINIAPP_URL` (кнопка QR в ветке `existing`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`cardMessageId` живёт в JSON внутри `sessions.draft`, а не отдельной колонкой.**
  Схема таблиц заморожена с W1, а срок жизни поля равен сроку жизни сессии.
  Читают его `reg-consent-pdn`, `reg-consent-mkt` — каждый через
  `sessionDraft`, который прокидывает `tg-router`.
- **Порядок «состояние раньше экрана» здесь нарушен намеренно и единственный раз**:
  `cardMessageId` невозможно записать до отправки карточки, потому что его
  выдаёт сам Telegram. Во всех остальных флоу гостевого среза сначала пишется
  состояние, потом рисуется экран.
- **Афиша (`step_12`) — вариант (а) из ADR-0017 «Цена»:** карточка текстовая,
  фото уходит отдельным сообщением один раз. `edit_message_caption` в qadam'е
  нет, поэтому карточку с фото нельзя редактировать на месте.
  **Шаг стоит без ROUTER'а и с `continueOnFailure`:** при пустом `photo_file_id`
  он падает `No media defined` за ~0,1 с, и путь продолжается. Так сделано,
  чтобы не вставлять ROUTER в уже собранную линейную цепочку — это отдельная
  гоча платформы (CLAUDE.md, Gotchas, п. 10). Цена решения названа прямо:
  у большинства ивентов афиши нет, и в логе прогона будет красный шаг,
  который не является ошибкой.
- **Разметка `MarkdownV2`,** экранирование — эталон
  [`catalog/snippets/markdown-v2.md`](../snippets/markdown-v2.md). `format`
  задан явно в каждом шаге отправки: умолчание пропа — `MarkdownV2`, и шаг
  без явного `format` меняет разметку молча.
- **Ветки `declined` и `existing` остались на `format: None`** и обычной
  отправкой: это одноразовые ответы, а не состояние диалога, редактировать
  там нечего.
- **Лимит мест** — `capacity × (1 + overbook_pct/100)`, округление вверх.
  Пустой `overbook_pct` читается как **40**, пустой `capacity` — как «лимита нет».
- **Ветка `existing` проверяется раньше состояния ивента**: у уже
  зарегистрированного участника отменённый или завершённый ивент всё равно
  даёт `existing` с кнопкой QR, а не отказ.
