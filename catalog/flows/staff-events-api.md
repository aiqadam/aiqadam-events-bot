# Flow: staff-events-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/Ok7iXvrnJUUzNcR5OwH8x/sync`; тело запроса — только
  `initData` (`authType: none`)
- **Назначение**: чьи кнопки сканера рисовать в каталоге `#/events` и списке
  `#/manage` — решает сервер по `event_staff`, страница только показывает
  (вердикт W49, W50)
- **Flow ID (MCP)**: `Ok7iXvrnJUUzNcR5OwH8x` · **externalId**: `yoK5mLb4UHTiHHYsmSM8O`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём sync-запроса SPA (`body.initData`) |
| step_1 | `callFlow fn-hmac-init-data` (`inline`) | проверка `initData`, `telegram_id` только оттуда (STF-2); окно 300 c |
| step_6 | CODE «normalize initData» | `telegramIdOrNone = telegramId \|\| '__none__'` — непустое значение для фильтра `step_2` (пустой `eq` валит шаг); невалидный `initData` даёт пустую выборку, а `step_4` отдаёт `401` |
| step_2 | `tables-find-records event_staff` | строки вызывающего (`telegram_id eq telegramIdOrNone`, limit 200) |
| step_3 | `tables-find-records events` | опубликованные события (status = `published`, limit 200) |
| step_4 | CODE «shape staff events» | активные строки (`revoked_at` пуст) на не прошедшие опубликованные события → `eventIds[]`; невалидный `initData` → `401 invalid_init_data` |
| step_5 | `return_response` (`stop`) | `200 {ok, eventIds[]}` |

## Зависимости

- **Таблицы**: `event_staff` (чтение), `events` (чтение)
- **Флоу**: вызывает `fn-hmac-init-data` (`inline`, один уровень, ADR-0015 п. 5)
- **Переменные**: `BOT_TOKEN` (проверка `initData`)
- **Connections**: —

## Заметки

- **Публичный каталог (`events-api`) осознанно не тронут**: он без `initData`
  и без ПД по дизайну — гейт «только staff» живёт отдельным флоу, а не
  опциональным параметром публичного.
- **Фильтр `revoked_at` и «не прошедший» — постфильтр в CODE** (паттерн W18,
  Q25): шаг_2 читает без `revoked_at`, CODE отбирает `''` + `byId[event_id]`
  + `notPast` по `ends_at || starts_at`.
- **Отказ закрытый**: пустой `valid` (а не только `false`) — тоже `401`;
  позитив (`200` с непустым списком) живым `initData` не прогнан — хвост
  на приёмку W15, негатив (`401` на мусоре) доказан прогоном.
- **Потребители**: `Events.tsx` (кнопки на карточках каталога) и `Manage.tsx`
  (кнопки в строках списка) — оба молча прячут кнопку при пустом ответе.
- **`step_2` фильтрует по `telegramIdOrNone` (W102).** У флоу нет ROUTER-гейта
  на `initData`: при невалидном `initData` `telegramId` пуст, и раньше
  `tables-find-records` падал (fail-closed на пустом `eq`) до того, как
  `step_4` успевал ответить `401`. Sentinel `__none__` возвращает прежнее
  поведение: пустая выборка → `401` из `step_4`; платформенная гоча — `AGENTS.md`.
