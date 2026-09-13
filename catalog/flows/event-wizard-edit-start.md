# Flow: event-wizard-edit-start

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается только из `tg-router` (`route: wiz_edit_start`,
  команда `/editevent <id>`)
- **Назначение**: открывает визард правки существующего ивента: проверяет
  владельца (STF-2-подобная проверка авторизации правки, OWN-5), строит
  черновик `draft` со снапшотом исходных значений (`_orig`) для будущего
  diff-уведомления, задаёт первый вопрос той же цепочки, что и создание.
- **Flow ID (MCP)**: `aPZHkBfShDwwjIcYKq6Tf`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `callableFlow` | приём вызова | `{{trigger['output'].data.telegramId/chatId/eventId}}` |
| step_1 | `tables-find-records events` | ивент по `id` | `id eq {{trigger['output'].data.eventId}}` |
| step_2 | CODE «decide + build draft» | `ok`/`not_found`/`not_owner`; `draft = {id, ...поля, _orig: {...те же поля}}` | |
| step_3 | ROUTER: `ok`/`not_found`/`Otherwise` (=not_owner) | | |
| step_4 (ok) | `tables-upsert-records sessions` | `scenario='event_edit', step='title', draft` | |
| step_7 | CODE «ask title text» | текст первого вопроса с текущим значением `title` | |
| step_8 | `send_text_message` | | |
| step_5 (not_found) | `send_text_message` | «Ивент с таким id не найден.» | |
| step_6 (Otherwise/not_owner) | `send_text_message` | «Вы не владелец этого ивента.» | |

## Зависимости

- **Таблицы**: `events` (`R4aSQpLZvw7d3u6DVOSjH`), `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router` (`queue`, `flowProps.payload`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Авторизация правки — `events.owner_id == telegramId` инициатора**, не
  `event_staff`: правка ивента доступна только владельцу, а не любому
  контролёру (иначе смешивается с ролью STF из чекина). Найдено `id
  eq eventId` без фильтра по `owner_id` в самой выборке `step_1` — сравнение
  сделано явно в CODE (`step_2`), чтобы отличить `not_found` от `not_owner`
  одним понятным исходом каждый.
- **`draft._orig` — снапшот полей на момент открытия правки**, нужен только
  `event-wizard-publish` для diff «было → стало» при уведомлении OWN-5;
  без него пришлось бы перечитывать `events` заново в конце цепочки.
- **`/editevent` перебивает любую активную сессию**, включая недоведённый
  `event_create` — то же правило, что у `/start e<id>` в `tg-router` (новый
  явный вход важнее недоведённого диалога).
- Проверено интеграционными прогонами через `tg-router` и напрямую:
  `/editevent emtzwkv2mdtus` при активной стуковавшей сессии `event_create` →
  маршрут `wiz_edit_start`, сессия корректно перезаписана (прогон
  `m8eygtY7u3NkPlxc8AidP`); `not_found` на несуществующем `id` — реальная
  доставка сообщения (прогон `u36hzsBAwk2JfoMKK1z2J`); `not_owner` —
  чужой `telegramId` на реальном ивенте — реальная доставка (прогон
  `i82zqVhW3l2bzyWiVcq59`). Все три исхода закрывают чек-лист W11
  «авторизация правки».
