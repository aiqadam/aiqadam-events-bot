# Flow: staff-accept

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из
  `tg-router` (ветка `staff_accept`, диплинк `/start s<eventId>-<token>`)
- **Назначение**: принять одноразовую ссылку-инвайт контролёра (OWN-14):
  проверить токен, выдать права на конкретное событие и прислать карточку
  с кнопкой сканера
- **Flow ID (MCP)**: `8seS0t3EfBZbmMSxuuYwC` · **externalId (для `callFlow`)**:
  `dvKFrQsi45NHHz1vAyjlc`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `token`, `eventId`, `chatId`, `telegramId` (плоские поля в `trigger['output'].data`) |
| step_1 | `@aiqadam/qadam-crypto : hash-text` | `sha256(токен из ссылки)` — по нему ищем запись |
| step_2 | `tables-find-records staff_invites` | строка по `token_hash` (limit 1) |
| step_3 | `tables-find-records events` | событие по `id` из ссылки (limit 1) |
| step_4 | CODE «decide accept outcome» | fail-closed: нет записи / `event_id` инвайта ≠ `eventId` ссылки / нет события → `invalid`; `used_at` непуст → `used`; `now > expires_at` → `expired`; иначе `ok` с текстом и `title` |
| step_5 | ROUTER «accept outcome» | `invalid`/`used`/`expired` → отказ; `ok` → выдача прав |
| step_6 | `send_text_message` (ветка отказа) | `staff.accept.invalid` / `.used` / `.expired` — короткий факт, без ленты |
| step_7 | `tables-update-record staff_invites` (ветка `ok`) | claim: `used_at`, `used_by` — **`only_if` `used_at` не существует** (одноразовость) |
| step_8 | `tables-create-records event_staff` (on success) | `event_id`, `telegram_id`, `granted_by` (автор инвайта), `granted_at` |
| step_10 | CODE «build scanner button» | `web_app` на `#/scan?event_id=<id>` |
| step_11 | `send_text_message` | `staff.accept.ok` + кнопка «Открыть сканер» |
| step_9 | `send_text_message` (on failure `step_7`) | проигранная гонка claim'а: `staff.accept.used` |
| step_12 | CODE «no-op» (fallback `Otherwise`) | недостижимая ветка-заглушка (валидатор требует непустой fallback) |

## Зависимости

- **Таблицы**: `staff_invites` (`JIjKkDu3Im2ylBmkkH5Fu`, чтение/update),
  `events` (`R4aSQpLZvw7d3u6DVOSjH`, чтение), `event_staff`
  (`t1g8Vae3iEoDk93D6Rle7`, create)
- **Флоу**: вызывается из `tg-router`
- **Переменные**: `MINIAPP_URL` (кнопка сканера)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — отправка

## Заметки

- **`initData` не проверяется — и не должен**: это вход по диплинку, не Mini App;
  доказательство — одноразовый токен `<22 alnum>` из `staff_invites`. Права
  выдаются по `telegram_id` из апдейта (`tg-router`), а не по телу запроса.
- **`sig`-ловушка здесь не применима**, но `event_id` из ссылки обязательно
  сверяется с `event_id` инвайта (`step_4`): иначе токен одного события дал бы
  права на другое. Проверка идёт до `used`/`expired` — подмена ссылки не
  «сжигает» инвайт.
- **Одноразовость — claim, а не проверка**: `step_7` пишет `used_at` только
  если поле ещё пусто (`only_if`, паттерн checkin-api/IDM-2). Две одновременные
  попытки одной ссылки: выигравшая создаёт `event_staff`, проигравшая уходит
  в `on failure` и получает `staff.accept.used` — атомарных примитивов нет
  (ADR-0003).
- **Повтор прав не проверяется**: если человек уже контролёр (выдан логином,
  W36/W55), принятие инвайта добавит вторую активную строку `event_staff` —
  дубли считает [W12b](../../docs/BACKLOG.md#w12b-dedup-report--диагностика-дублей),
  чтения отбирают активные. Ссылка при этом честно «использована».
- **Ответы — короткими карточками, не лентой** (лекало W28): один текст +
  кнопка сканера (событие известно), отказы — одна строка.
- **Отзыв прав** — `event_staff.revoked_at` (W36); `checkin-api` проверяет его
  на каждом скане, поэтому отзыв действует немедленно.
- **Тексты — из `i18n/ru.json`** через `inputs.texts` (ADR-0014), не литералами.
