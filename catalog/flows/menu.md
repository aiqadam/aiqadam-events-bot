# Flow: menu

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  (`route: menu`: голый `/start`, `/start` с неразобранным payload, любая
  незнакомая команда — [ADR-0025](../../docs/adr/0025-start-only-commands-ban.md))
- **Назначение**: меню-хаб — одно сообщение с inline-кнопками, набор которых
  зависит от ролей пользователя (гость / организатор / контролёр). Заменяет молчание на
  холостой `/start` ([W34](../../docs/work/W34-menu.md)).
- **Flow ID (MCP)**: `1DORFhP9F3W00KpKz5wDw` · **externalId**: `BOLkFV1GreF8r7opvDCVo`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `chatId`, `firstName`, `badPayload`, `telegramId` |
| step_1 | `tables-find-records staff` | строка `staff` пользователя (limit 1) — «Создать ивент» виден организатору |
| step_2 | `tables-find-records event_staff` | все staff-строки пользователя (limit 50) |
| step_3 | `tables-find-records events` | опубликованные ивенты (status = `published`, limit 50) |
| step_4 | CODE «render menu» | сборка кнопок: гость (2) + организатор (+1) + контролёр (+1); фильтр staff по `revoked_at` и будущим ивентам |
| step_5 | `send_text_message` (`format: None`) | отправка меню |

## Зависимости

- **Таблицы**: `staff` (чтение, видимость), `events` (чтение, 2 запроса),
  `event_staff` (чтение)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: `MINIAPP_URL` (URL для кнопок `web_app`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Кнопки `web_app` собираются из `MINIAPP_URL`**: `#/manage` (организатор) и
  `#/scan?event_id=<ближайший будущий>` (staff). `scanEventId` кодируется
  `encodeURIComponent`. Права проверяет не страница, а `manage-api`/`checkin-api`
  — кнопка на чужой ивент откроет страницу, которая получит 403.
- **Staff-фильтр — defense-in-depth в CODE step_4**, не в tables-запросе: шаг_2
  читает все staff-строки пользователя без фильтра `revoked_at`, CODE step_4
  постфильтрует `r.revoked_at === ''` (паттерн W18, [Q25](../../docs/OPEN-QUESTIONS.md#q25)).
  Дополнительно: только опубликованные ивенты (`byId[r.event_id]`) и только
  будущие (`notPast` по `ends_at` или `starts_at`).
- **Порядок кнопок фиксирован**: гостевые (`ev:list:upcoming`, `myreg:list`)
  → организатор (`Создать ивент`, `web_app #/manage`) → контролёр (`Сканер`, `web_app
  #/scan?event_id=`). Организатор+контролёр → 4 кнопки. Контролёр без будущих
  ивентов → без кнопки сканера (2 кнопки). Гость → 2 кнопки.
- **«Создать ивент» — видимость, а не авторизация** ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)):
  кнопка показывается по строке в [`staff`](../tables/staff.md), даже если у
  организатора ещё нет ивентов. Само правило прав живёт в одном месте —
  `manage-api`; кнопка на чужой чаптер всё равно упрётся в `403`.
- **`badPayload`** — флаг из `tg-router` (`/start` с неразобранным payload):
  меняет преамбулу с приветствия на `start.bad_payload`.
- **Тексты — через `inputs.texts`** (ADR-0014), ключи `menu.*` и `start.*`.
  `format: None` — текст без разметки, экранирование не нужно.
- **«Мои ивенты» не рисуются до W13** — вместо неё `myreg:list` (Мои регистрации).
- **Флоу собран мимо процесса и обнаружен при аудите** — принят ретроактивно
  как W34. Предыдущая запись в журнале W34 («сверка подтвердила, не создан»)
  была неверной.
