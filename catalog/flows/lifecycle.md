# Flow: lifecycle

- **Статус**: ENABLED (published)
- **Триггер**: cron `*/15 * * * *`, `Asia/Tashkent` (`@aiqadam/qadam-schedule : cron_expression`)
- **Назначение**: автопереход `published → finished` по `ends_at` (OWN-4) и вызов `reg-afterword` для пришедших.
- **Flow ID (MCP)**: `4qjk9PsPgcliBvrdt8vbr`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-schedule : cron_expression` | каждые 15 мин, Asia/Tashkent |
| step_1 | `tables-find-records events` | `published` + `finished` широким фильтром — решение принимает CODE |
| step_2 | CODE «due to finish» | `now`; `due` (только `published` с `ends_at <= now`, с record id); catch-up `finished` с `ends_at` не старше 48 ч; `finishedIds` + сентинел |
| step_3 | LOOP_ON_ITEMS | по `due` |
| step_7 (в цикле) | `tables-update-record events` | `status = finished`, `finished_at = nowIso` по record id |
| step_4 | `tables-find-records registrations` | `event_id in finishedIds` |
| step_5 | CODE «afterword targets» | непустой `checked_in_at` → `{telegramId, chatId, eventId}`, дедуп пар |
| step_6 | LOOP_ON_ITEMS | по `targets` |
| step_8 (в цикле) | `subflows : callFlow reg-afterword` | `queue`, fire-and-forget, `flowProps.payload` |

## Зависимости

- **Таблицы**: `events` (чтение + запись), `registrations` (чтение)
- **Переменные**: —
- **Store**: — (ключи `afterword:*` ставит сам callee)
- **Connections**: — (таблицы и `callFlow` без auth)

## Заметки

- **Только вперёд.** Ворота — CODE `step_2`: `status == published && ends_at <= now`.
  `cancelled` / `finished` / `draft` этот флоу перевести не может; пустой `ends_at` —
  пропуск. `only_if` у апдейта нет осознанно: прогон занимает секунды при кадансе
  15 мин, гонка двух тиков практически невозможна, а проигранная гонка здесь
  безвредна (перезапись `finished_at` тем же переходом).
- **Сравнение дат — в CODE, а не в фильтрах** (Q15: диапазон по DATE в фильтрах
  не работает). Чтение берёт `published,finished` оператором `in`, отбор — код.
- **Сентинел `__none__` вместо пустого `in`.** Пустое значение валит чтение
  (fail-closed), а несуществующий id возвращает ноль строк. Тот же приём —
  в `reminders`.
- **Find-шаги обязаны содержать `limit` + `record_ids`.** Без этих ключей шаг
  помечается невалидным (валидация это ловит, но сообщение не объясняет причину).
- **Catch-up 48 ч** — для позднего чекина после финиша: событие уже `finished`,
  а отметка появилась позже; без catch-up `reg-afterword` не позовут никогда.
  Окно конечное: catch-up вечно растущего списка `finished` не масштабируется,
  при сотнях событий окно придётся сужать.
- **Вызов `reg-afterword` — здесь, а не в `reminders`.** Послесловие —
  пост-событие: зовём по факту финиша (плюс catch-up), а не по факту чекина,
  чтобы «спасибо, что были» не уходило человеку на входе. Сам `reg-afterword`
  не менялся; его ворота (присутствие + `stored`) — вторая линия обороны.
- **Присутствие = непустой `checked_in_at`, статус не смотрим** (DATA-MODEL):
  строка, отменённая после чекина, всё равно означает «был».
- **Порядок `flowProps` у `callFlow`** — объект `flow` с `exampleData` плюс
  обёртка `payload` (гочи 7/7a); плоские дубли рядом — конвенция `tg-router`.
