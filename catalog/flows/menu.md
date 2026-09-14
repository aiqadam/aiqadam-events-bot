# Flow: menu

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  (`route: menu`: голый `/start`, `/start` с неразобранным payload, `/menu`, `/help`)
- **Назначение**: меню-хаб — одно сообщение с inline-кнопками, набор которых
  зависит от ролей пользователя (гость / owner / staff). Заменяет молчание на
  холостой `/start` ([W34](../../docs/work/W34-menu.md)).
- **Flow ID (MCP)**: `1DORFhP9F3W00KpKz5wDw` · **externalId**: `BOLkFV1GreF8r7opvDCVo`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `chatId`, `firstName`, `badPayload`, `telegramId` |
| step_1 | `tables-find-records events` | ивенты, где `owner_id` = пользователь (limit 1 — хватит одноgo факта) |
| step_2 | `tables-find-records event_staff` | все staff-строки пользователя (limit 50) |
| step_3 | `tables-find-records events` | опубликованные ивенты (status = `published`, limit 50) |
| step_4 | CODE «render menu» | сборка кнопок: guest (2) + owner (+1) + staff (+1); фильтр staff по `revoked_at` и будущим ивентам |
| step_5 | `send_text_message` (`format: None`) | отправка меню |

## Зависимости

- **Таблицы**: `events` (чтение, 2 запроса), `event_staff` (чтение)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: `MINIAPP_URL` (URL для кнопок `web_app`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Кнопки `web_app` собираются из `MINIAPP_URL`**: `#/manage` (owner) и
  `#/scan?event_id=<ближайший будущий>` (staff). `scanEventId` кодируется
  `encodeURIComponent`. Права проверяет не страница, а `manage-api`/`checkin-api`
  — кнопка на чужой ивент откроет страницу, которая получит 403.
- **Staff-фильтр — defense-in-depth в CODE step_4**, не в tables-запросе: шаг_2
  читает все staff-строки пользователя без фильтра `revoked_at`, CODE step_4
  постфильтрует `r.revoked_at === ''` (паттерн W18, [Q25](../../docs/OPEN-QUESTIONS.md#q25)).
  Дополнительно: только опубликованные ивенты (`byId[r.event_id]`) и только
  будущие (`notPast` по `ends_at` или `starts_at`).
- **Порядок кнопок фиксирован**: гостевые (`ev:list:upcoming`, `myreg:list`)
  → owner (`Создать ивент`, `web_app #/manage`) → staff (`Сканер`, `web_app
  #/scan?event_id=`). Owner+staff → 4 кнопки. Staff без будущих ивентов →
  без кнопки сканера (2 кнопки). Гость → 2 кнопки.
- **`badPayload`** — флаг из `tg-router` (`/start` с неразобранным payload):
  меняет преамбулу с приветствия на `start.bad_payload`.
- **Тексты — через `inputs.texts`** (ADR-0014), ключи `menu.*` и `start.*`.
  `format: None` — текст без разметки, экранирование не нужно.
- **«Мои ивенты» не рисуются до W13** — вместо неё `myreg:list` (Мои регистрации).
- **Флоу собран мимо процесса и обнаружен при аудите** — принят ретроактивно
  как W34. Предыдущая запись в журнале W34 («сверка подтвердила, не создан»)
  была неверной.
