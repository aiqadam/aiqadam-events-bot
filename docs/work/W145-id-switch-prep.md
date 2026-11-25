# W145. Подготовка к переключению на AI Qadam ID: удаление человека, `bot_contacts`, приёмник удалений ID

- **Статус**: в работе (шаги 1–2 порядка ADR-0059 собраны на `events-dev` 2026-11-25; шаг 3 — приёмник —
  не начат)
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
| flow `reg-api` (ветка `delete_account` → подфлоу) | `SmutybV5qJQjQASJGY9vi`, версия `I5x2PFKqPmI6LNVQJXwd7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| таблица `bot_contacts` | `lXsWetfliAWCaKwnDiOuA` (ext `JLPfHt5KW4PpanBBWX4V6`), пустая | [catalog/tables/bot_contacts.md](../../catalog/tables/bot_contacts.md) |
| переменная `id_module_key` | секрет, равна ID QA `module_key_events`; значение не выводилось | [catalog/variables.md](../../catalog/variables.md) |
| перевод `profile.delete.author` | ru / uz / en | [i18n/](../../i18n/) |
| эталон `delete-person-plan` + 25 тестов | шаг `plan` (`step_19`) | [catalog/snippets/delete-person-plan.md](../../catalog/snippets/delete-person-plan.md) |

## Чек-лист готовности

- [x] ADR-0059 принят владельцем (2026-11-25)
- [x] Шаг 1: `fn-delete-person`, весь список §1; эталон с тестами офлайн (25/25)
- [x] Шаг 1: `reg-api` переходит на подфлоу с проверкой автора §4 (`409 author_of_events`)
- [x] Шаг 1: прогоны на выдуманных людях тестового диапазона (ниже)
- [x] Шаг 2: `bot_contacts` создана, пустая
- [ ] Сквозная проверка `reg-api` → `delete_account` из Mini App (нужен `initData`, подписанный токеном
      бота: аккаунт тестировщика)
- [ ] Шаг 3: приёмник `id-member-deleted`
- [ ] Ворота: шаги 1–3 приняты владельцем; затем `module_delete_url_events` в ID QA → приёмник
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

## Находки

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
