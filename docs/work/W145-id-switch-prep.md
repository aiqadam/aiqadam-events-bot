# W145. Подготовка к переключению на AI Qadam ID: удаление человека, `bot_contacts`, приёмник удалений ID

- **Статус**: в работе (шаги 1–4 порядка ADR-0059 выполнены на QA 2026-11-25; ждёт независимого ревью)
- **Владелец**: агент (сессия AI Qadam ID)
- **Волна**: вне волн
- **Зависит от**: [ADR-0059](../adr/0059-id-switch-prep-deletion-and-delivery-state.md) (принят 2026-11-25),
  [ID ADR-0032](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0032-events-bot-switch-to-id-api.md) §7
- **Начат**: 2026-11-25 · **Закрыт**: —

## Цель

Перед переключением бота на ID API: один полный список удаления человека (закрывает Part 2
ADR-0039), место для состояния доставки вместо `users`, приёмник события ID `id.member-deleted.v1`.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `fn-delete-person` | `7jtl15LMRI0bnxxRFCMeq`, версия `VUGxCt8XEjEIYQSurP9bH` | [catalog/flows/fn-delete-person.md](../../catalog/flows/fn-delete-person.md) |
| flow `reg-api` (ветка `delete_account` → подфлоу; логи без ПД) | `SmutybV5qJQjQASJGY9vi`, версия `xp52IqjKk9gqrroRbEt5J` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| таблица `bot_contacts` | `lXsWetfliAWCaKwnDiOuA` (ext `JLPfHt5KW4PpanBBWX4V6`), пустая | [catalog/tables/bot_contacts.md](../../catalog/tables/bot_contacts.md) |
| переменная `id_module_key` | секрет, равна ID QA `module_key_events`; значение не выводилось | [catalog/variables.md](../../catalog/variables.md) |
| перевод `profile.delete.author` | ru / uz / en | [i18n/](../../i18n/) |
| эталон `delete-person-plan` + 25 тестов | шаг `plan` (`step_19`) | [catalog/snippets/delete-person-plan.md](../../catalog/snippets/delete-person-plan.md) |
| flow `id-member-deleted` (приёмник ID) | `DnYhfp9irbV993MtLbIsh`, версия `tJo8vdCZqHUkktyN0Ekoa`; в ID QA не подключён | [catalog/flows/id-member-deleted.md](../../catalog/flows/id-member-deleted.md) |
| эталон `id-event-verify` + 30 тестов | шаг `verify` (`step_1`) приёмника | [catalog/snippets/id-event-verify.md](../../catalog/snippets/id-event-verify.md) |

## Чек-лист готовности

- [x] ADR-0059 принят владельцем (2026-11-25)
- [x] Шаг 1: `fn-delete-person`, весь список §1; эталон с тестами офлайн (25/25)
- [x] Шаг 1: `reg-api` переходит на подфлоу с проверкой автора §4 (`409 author_of_events`)
- [x] Шаг 1: прогоны на выдуманных людях тестового диапазона (ниже)
- [x] Шаг 2: `bot_contacts` создана, пустая
- [x] Сквозная проверка `reg-api` → `delete_account` из Mini App (владелец, 2026-11-25, ниже)
- [x] Шаг 3: приёмник `id-member-deleted` — подпись, повтор, окно, тип, тело, ответы, время ≤ 15 с
- [x] Ворота: шаги 1–3 приняты владельцем (2026-11-25); `module_delete_url_events` в ID QA → приёмник; сквозная проверка пройдена
- [ ] Независимое ревью
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

`ap_test_flow` по `fn-delete-person` на выдуманных людях `9000000000000901…903`. Строки засеяны в
каждой таблице списка: своя регистрация, отзыв, рассылка, сессия, ответы и попытка викторины,
сообщение, права контролёра и организатора, `bot_contacts`, `users`; чужие строки, где A записан
исполнителем (чекин, выдача прав, оба поля инвайта, автор рассылки); Store-ключи напоминаний.
Проверка плана `mismatch:<имя>` гарантирует, что прогон не тронет строку с другим id.

| # | Случай | Результат | Время |
|---|---|---|---|
| 1 | A, строки во всех таблицах | `done: true`; свои строки удалены (по 1, `quiz_answers` 2); у B поля исполнителя очищены, строки на месте; ключи `rm:*` сняты | 5,1 с |
| 2 | A снова, новая регистрация и ключи | ключи сняты через `rm_events` | 1,4 с |
| 3 | C — автор события, `refuseIfAuthor: false` (режим приёмника) | `done: false, reason: author_of_events`; `staff` и `bot_contacts` удалены; событие не тронуто | — |
| 4 | A, пусто | все счётчики 0, `done: true` (идемпотентность) | — |
| 5 | id `-` | падает на `step_1` (`bad_telegram_id`) | — |
| 6 | C, `refuseIfAuthor: true` (режим `reg-api`) | `deleted: false`; ничего не удалено, строка `staff` на месте | — |

После прогонов все тестовые строки удалены. Поиск `co 900000000000090` по 16 полям с id (свои и
исполнителя, `events.staff_id`) — 0 строк.

`reg-api`: `ap_validate_flow` 0 invalid, опубликован. Сквозной прогон не делался: вход требует
валидного `initData`.

### Приёмник `id-member-deleted`

Настоящие POST на `/sync`, подписанные QA-ключом (`module_key_events` ID QA = `id_module_key`), по
выдуманным людям: 904 (регистрация и `bot_contacts`) и 905 (автор черновика события и `staff`).

| # | Запрос | Ответ | Время |
|---|---|---|---|
| 1 | верный, 904 | `200 {done: true}`; строки 904 удалены (`registrations` 1, `bot_contacts` 1) | 5,3 с |
| 2 | тот же конверт ещё раз | `409 {reason: replay}` | 0,4 с |
| 3 | 904, новый `request_id` | `200 {done: true}` (идемпотентно) | 1,5 с |
| 4 | чужая подпись | `401 bad_signature` | 0,9 с |
| 5 | подпись без тега направления (форма модуль→ID) | `401 bad_signature` | 0,4 с |
| 6 | `ts` старше 400 с | `401 expired` | 0,3 с |
| 7 | тип `id.member-updated.v1` | `401 bad_type` | 0,4 с |
| 8 | подпись верна, `telegram_id` числом | `400 bad_body` | 0,6 с |
| 9 | 905, автор события | `200 {done: false, reason: author_of_events}`; `staff` удалён, событие на месте | 2,9 с |

Лог прогона 1 (`lNW91p1OYk5cjAURiK65Q`): триггер и `verify` — `**REDACTED**`, в остальных шагах только
маршрут, `stored` и счётчики. После проверки событие 905 удалено; строк тестового диапазона нет.

### `delete_account` из Mini App (владелец, 2026-11-25)

Два настоящих аккаунта QA-бота; в отчёте только числа и `reason`.

| Аккаунт | Прогоны `fn-delete-person` | Ответ `reg-api` | Итог |
|---|---|---|---|
| организатор, автор событий | 4 (`19I4wPTL1U2VvpYNYvadn` и др.) | `409 author_of_events` + текст `profile.delete.author` (en) | ничего не удалено, `deleted: false` |
| контролёр, не автор | `z42nMOAh6fhMzhVWOp7TB` | по ответу подфлоу — `200` | `done: true`: удалены 6 таблиц своих строк, очищены 3 поля исполнителя в чужих строках, снят 1 ключ напоминаний; 1,3 с |

Не проверена ветка `500` (подфлоу упал): без правки подфлоу её не вызвать — вход приёмника и подфлоу
проверяются одним и тем же шаблоном id.

### Ворота и сквозная проверка (2026-11-25)

- До переключения в ID QA не было открытых строк `deletion_log` для `events` (7 строк, все `done`).
- `module_delete_url_events` в ID QA → `https://app.flow.aiqadam.org/api/v1/webhooks/DnYhfp9irbV993MtLbIsh/sync`.
- Выдуманный человек `9000000000000906`: в ID — `members` и согласие `module`/`events`; в боте — регистрация
  и `bot_contacts`. `fn-account-delete` в ID QA (TESTING `SXYvR3CGEAXXttD2jFXHN`) → `fn-notify-module` →
  приёмник `200 {done: true}` → `deletion_log` `done`, подтверждено через 2 с. Человек удалён и в ID, и в
  боте; строк тестового диапазона не осталось.

## Находки

- **`reg-api` писал персональные данные в лог прогона (было до W145).** Видно на прогоне проверки из
  Mini App: вход вебхука (весь `initData` — имя, username, фото, `hash`; IP клиента), выход проверки
  `initData`, строки `registrations` и `users`. `initData` из лога можно было повторить, пока он свежий
  (`maxAgeSeconds` 3600). **Исправлено решением владельца 2026-11-25**, как W112 в `tg-router`:
  `logOutput: false` у триггера; ввод и вывод выключены у `step_1`, `step_2`, `step_6`, `step_9`,
  `step_17`, ответов с профилем (`step_16`, `step_20`, `step_21`, `step_23`); вывод — у `step_7`, `step_8`;
  ввод — у шагов записи (`step_11`, `step_12`, `step_14`, `step_18`, `step_19`, `step_22`). Цена: прогон
  `reg-api` не ретраится. Попутно `ap_update_trigger` поднял пин триггера `webhook` 0.1.35 → 0.1.38 (та
  же версия, что у приёмника). Проверено запросом с неверным `initData`: `401`, в логе триггер и шаги с
  данными — `**REDACTED**`. Старые прогоны в логе остаются до их очистки платформой.
- **Старые поиски в `reg-api` шли с `limit 200`:** у человека с большим числом строк часть оставалась
  бы молча. В подфлоу поиски без `limit` (кроме проверки автора, `limit 1`).
- **Вывод цикла (`item`) пишется в лог даже при выключенных логах шагов.** Поэтому в списках циклов
  нет `telegram_id`: `deletes` — externalId таблицы и id строк, `rm_events` — только `event_id`;
  ключ Store собирается внутри шага с выключенным логом. Тест эталона проверяет это.
- **`tables-delete-record` с пустым `records_ids` по-прежнему `400`** (W98): в план попадают только
  непустые таблицы.
- **Store `put` не принимает `ttl_seconds`;** тестовые ключи ставились `put_if_absent` с TTL.

## Журнал

- 2026-11-25 — ADR-0059 принят. Созданы `id_module_key`, `bot_contacts`; собран, проверен и опубликован
  `fn-delete-person`; `reg-api` переведён на подфлоу (старые шаги удаления `step_24…38`, `step_40…45`
  сняты), опубликован; перевод `profile.delete.author`. Тестовые строки удалены, проверка чистая.
  Строки `migrations` `2026-11-25-w145-01…05`.
- 2026-11-25 — собран, проверен (9 подписанных запросов) и опубликован приёмник `id-member-deleted`; в ID QA
  не подключён до ворот. Строка `migrations` `2026-11-25-w145-06`.
- 2026-11-25 — владелец проверил `delete_account` из Mini App; ворота приняты; `module_delete_url_events` в ID QA
  → приёмник, сквозная проверка пройдена (ID: `migrations` `2026-11-25-w10-08`). Логи `reg-api` очищены от
  персональных данных, опубликован `xp52IqjKk9gqrroRbEt5J`; `migrations` `2026-11-25-w145-07`.
