# Flow: reg-start

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на `/start e<eventId>-<utm>` (ADR-0015: касание = один вопрос/вход)
- **Назначение**: вход участника по deep link на ивент. Проверяет доступность
  мест (OWN-15), показывает карточку ивента или существующую регистрацию,
  открывает диалог согласия на ПД (PAR-1).
- **Flow ID (MCP)**: `FkxtgayOK5QubyqqMd9q4` · **externalId**: не вызывается через `callFlow` другими флоу (пока)

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `eventId`, `utm`, `telegramId`, `chatId` | — |
| step_1 | `tables-find-records events` | ивент по `id`, `limit 1` | `{{trigger['output'].data.eventId}}` |
| step_2 | `tables-find-records registrations` | все регистрации ивента (проекция `telegram_id`, `status`) — кормит и подсчёт занятости, и поиск своей строки | `event_id eq {{trigger['output'].data.eventId}}` |
| step_3 | CODE «decide outcome» | `existing` (моя строка `registered`) / `new` / `declined` (`not_found`/`event_cancelled`/`event_finished`/`not_published`/`deadline_passed`/`no_seats`, OWN-15: `limit = ceil(capacity×(1+overbook_pct/100))`) | `{{step_1/2['output']}}` |
| step_4 | ROUTER по `outcome` | три ветки: `declined` (branch 0), `existing` (branch 1), `new` (branch 2), `Otherwise` — заглушка | `{{step_3['output'].outcome}}` |
| step_5→6 (`declined`) | CODE текст по причине → `send_text_message` | вежливый отказ, регистрация не создаётся | `{{step_3['output'].reason}}` |
| step_7→8 (`existing`) | CODE `reg.already` → `send_text_message` + кнопка `web_app` на `ticket.html` | второе подтверждение не шлём (IDM-1) | `{{step_3['output'].title}}` |
| step_9→12 (`new`) | CODE карточка (Asia/Tashkent, `Intl`) → `send_text_message` → `tables-upsert-records sessions` (`scenario=registration`, `step=await_pdn`, `draft={eventId,utm}`) → `send_text_message` вопрос о ПД | два сообщения (ADR-0013) |

## Зависимости

- **Таблицы**: `events` (чтение), `registrations` (чтение), `sessions` (запись, `toTKgngMTqDNJWDpQMh4d`)
- **Переменные**: `MINIAPP_URL` (кнопка QR в ветке `existing`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Регистрация не создаётся здесь** — только сессия. Строка `registrations`
  появляется в `reg-consent-pdn` (`pdn:yes`), это и держит PAR-1: без согласия
  на ПД записи не будет.
- **`tables-upsert-records`** используется вместо read-then-branch-then-write
  везде в W26 — избегает необходимости сводить ветки ROUTER'а обратно вместе
  (в Activepieces ветки не сходятся); апсерт по ключу не плодит дублей.
- **Лимит мест** — `capacity × (1 + overbook_pct/100)`, округление вверх;
  при достижении лимита — вежливый отказ вместо регистрации.
- **Карточка не использует эталон `event-card.md` побайтово** — упрощена
  (без i18n-конверта, ADR-0014 уже убрал `strings`) и без кнопок «Открыть на
  карте»/«Зарегистрироваться» (регистрация уже идёт по факту deep link,
  отдельная кнопка не нужна). Ссылка на карту — строкой в тексте.
