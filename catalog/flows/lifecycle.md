# Flow: lifecycle

- **Статус**: ENABLED (published)
- **Триггер**: cron `*/15 * * * *`, `Asia/Tashkent` (`@aiqadam/qadam-schedule : cron_expression`)
- **Назначение**: автопереход `published → finished` по `ends_at` (OWN-4) и вызов `reg-afterword` для пришедших.
- **Flow ID (MCP)**: `EJMVNrNdyM6b46uKXHOaS`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-schedule : cron_expression` | каждые 15 мин, Asia/Tashkent |
| step_1 | `tables-find-records events` | `published` + `finished` широким фильтром — решение принимает CODE |
| step_2 | CODE «due to finish» | `now`; `due` (только `published` с `ends_at <= now`, с record id); catch-up `finished` с `finished_at` не старше 2 тиков (30 мин); `finishedIds` + сентинел |
| step_3 | LOOP_ON_ITEMS | по `due` |
| step_7 (в цикле) | `tables-update-record events` | `status = finished`, `finished_at = nowIso` по record id; `continueOnFailure` |
| step_4 | `tables-find-records registrations` | `event_id in finishedIds`, `limit 500` |
| step_5 | CODE «afterword targets» | непустой `checked_in_at` → `{telegramId, chatId, eventId}`, дедуп пар |
| step_6 | LOOP_ON_ITEMS | по `targets` |
| step_8 (в цикле) | `subflows : callFlow reg-afterword` | `inline`, `flowProps.payload` |

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
- **`step_7` — `continueOnFailure`.** Падающий апдейт события (например,
  запись удалена между чтением и записью) не обрывает тик: цикл продолжается,
  и послесловия следующим шагам всё равно уходят. Отметку `finished` такой
  апдейт не теряет — событие остаётся `published` и попадёт в `due` на
  следующем тике.
- **`step_8` — `executionMode: inline`, без `waitForResponse`.** Цикл `step_6`
  ждёт окончания каждого вызова `reg-afterword` (включая отправку сообщения
  Bot API), а не рассылает их очередью параллельно. Для крона раз в 15 мин
  это приемлемо; `reg-afterword` пауз внутри не имеет (иначе `inline` был бы
  запрещён платформой).
- **Известный риск (не блокер): у `step_8` (`callFlow`) `continueOnFailure`
  выключен.** Упавший вызов послесловия обрывает цикл `step_6` — оставшиеся
  получатели этого тика пропускаются. Повторная попытка возможна только пока
  событие моложе `finished_at + 2 тика` (catch-up); после сужения окна это
  ~30 мин вместо прежних 48 ч. Включать `continueOnFailure` здесь не стали:
  это меняло бы поведение сверх задания W12c, а вызов `reg-afterword`
  с уже существующим flow падает практически только при недоступности
  платформы.
- **Сентинел `__none__` вместо пустого `in`.** Пустое значение валит чтение
  (fail-closed), а несуществующий id возвращает ноль строк. Тот же приём —
  в `reminders`.
- **Find-шаги обязаны содержать `limit` + `record_ids`.** Без этих ключей шаг
  помечается невалидным (валидация это ловит, но сообщение не объясняет причину).
- **Catch-up — короткий хвост, 2 тика (30 мин) от `finished_at`.** Нужен для
  позднего чекина сразу после финиша: событие уже `finished`, а отметка
  появилась позже. Отсчёт от `finished_at` (его ставит `step_7`), не от
  `ends_at`: иначе окно тянется 48 ч и каждый тик зовёт `reg-afterword` по всем
  пришедшим (~192 лишних вызова на человека), хотя callee всё равно дедупит
  ключом `afterword:<eventId>-<telegramId>`. Если `finished_at` пуст —
  запасной отсчёт от `ends_at` с тем же окном. **Цена:** чекин позднее ~30 мин
  после финиша послесловия уже не получит; нормальный чекин (до финиша) получает
  его на тике перехода.
- **Вызов `reg-afterword` — здесь, а не в `reminders`.** Послесловие —
  пост-событие: зовём по факту финиша (плюс catch-up), а не по факту чекина,
  чтобы «спасибо, что были» не уходило человеку на входе. Сам `reg-afterword`
  не менялся; его ворота (присутствие + `stored`) — вторая линия обороны.
- **Присутствие = непустой `checked_in_at`, статус не смотрим** (DATA-MODEL):
  строка, отменённая после чекина, всё равно означает «был».
- **Порядок `flowProps` у `callFlow`** — объект `flow` с `exampleData` плюс
  обёртка `payload` (гочи 7/7a); плоские дубли рядом — конвенция `tg-router`.
