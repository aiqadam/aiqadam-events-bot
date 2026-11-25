# Flow: fn-delete-person

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается `inline` с ожиданием ответа.
  Вход: `{telegramId, refuseIfAuthor}`
- **Назначение**: единственный список удаления человека в боте
  ([ADR-0059](../../docs/adr/0059-id-switch-prep-deletion-and-delivery-state.md) §1). Удаляет его строки,
  обезличивает поля исполнителя в чужих строках, снимает Store-ключи напоминаний.
- **Кто вызывает**: `reg-api` (`delete_account`, `refuseIfAuthor: true`); приёмник
  [`id-member-deleted`](id-member-deleted.md) (`refuseIfAuthor: false`)
- **Flow ID (MCP)**: `7jtl15LMRI0bnxxRFCMeq` · **externalId (для `callFlow`)**: `fw93HfqLHPLC5gpllve1r`

## Шаги

Код `step_19` — байт-в-байт эталон [`snippets/delete-person-plan.md`](../snippets/delete-person-plan.md).
Ввод и вывод выключены на всех шагах с id и строками людей (ADR-0005). В логе остаются `step_26`
и ответ: только `done`, `deleted`, `reason` и счётчики.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | вход; `logOutput: false` |
| step_1 | CODE — input | `telegram_id` по `^[1-9][0-9]{0,15}$`, иначе `bad_telegram_id` |
| step_2 | `tables-find-records` `events` | автор: `eq staff_id`, `limit 1` |
| step_3…13 | `tables-find-records` | свои строки по `eq telegram_id`: `registrations`, `feedback`, `broadcast_targets`, `sessions`, `quiz_answers`, `quiz_attempts`, `reports`, `event_staff`, `staff`, `bot_contacts`, `users`; **без `limit`** |
| step_14…18, step_29 | `tables-find-records` | чужие строки, где id записан исполнителем: `registrations.checked_in_by`, `event_staff.granted_by`, `staff_invites.created_by`, `staff_invites.used_by`, `broadcasts.created_by`, `broadcasts.media_chat_id` (чат пересланного поста — личный чат автора); без `limit` |
| step_19 | CODE — plan | повторная проверка каждой строки (`mismatch:<имя>` валит прогон), план `deletes`/`clears`/`rm_events`, `refused`; удаляемая строка не очищается (свой чекин, права себе), очистки одной строки — одним элементом |
| step_20→21 | `LOOP_ON_ITEMS` → `tables-delete-record` | по таблице за итерацию: `table_id` и `records_ids` из `item`; в `deletes` только непустые таблицы |
| step_22→23 | `LOOP_ON_ITEMS` → `tables-update-record` | очистка полей строки: `clear_columns item.columns`, `values {}`; строка остаётся |
| step_24→25, 28, 30 | `LOOP_ON_ITEMS` → `store remove_value` ×3 | `rm:<event_id>:24h:<id>`, `rm:<event_id>:2h:<id>`, `afterword:<event_id>-<id>` (без TTL); ключ собирается внутри шага, в `item` только `event_id` |
| step_26 | CODE — result | `done = !author`, `deleted = !refused`, `reason`, `counts` |
| step_27 | `returnResponse` | `{done, deleted, reason, counts}` |

## Ответ

| Случай | `done` | `deleted` | `reason` |
|---|---|---|---|
| всё удалено, событий нет | `true` | `true` | `ok` |
| автор событий, `refuseIfAuthor: false` (приёмник) | `false` | `true` | `author_of_events` — удалено всё, кроме `events` |
| автор событий, `refuseIfAuthor: true` (`reg-api`) | `false` | `false` | `author_of_events` — ничего не удалено |
| любая ошибка | — | — | прогон падает; вызывающий отвечает ошибкой |

## Зависимости

- **Таблицы**: удаление — `registrations`, `feedback`, `broadcast_targets`, `sessions`, `quiz_answers`,
  `quiz_attempts`, `reports`, `event_staff`, `staff`, `bot_contacts`, `users`; очистка поля —
  `registrations`, `event_staff`, `staff_invites`, `broadcasts` (`created_by`, `media_chat_id`); чтение — `events`
- **Store**: ключи напоминаний `rm:*` и послесловия `afterword:*` (scope `COLLECTION`)
- **Переменные**: —
- **Connections**: —

## Заметки

- **Fail closed.** Ошибка любого удаления или очистки валит прогон, `done: true` при оставшихся
  строках невозможен. Проверено на QA прогоном с настоящей ошибкой итерации (`LPyPf8QSr8Kkf4N9sapoC`:
  `404` в `step_23` → прогон `FAILED`, ответа нет). Повтор безопасен: второй проход находит пустые списки.
- **Гонка поиска и удаления** — открытый вопрос [Q72](../../docs/OPEN-QUESTIONS.md#q72).
- **Пустой список — не шаг.** `tables-delete-record` с пустым `records_ids` отвечает `400` (W98),
  поэтому план кладёт в `deletes` только таблицы с найденными строками; цикл по пустому списку —
  ноль итераций.
- **`events` не трогается.** Автор событий ждёт владельца: переназначить `staff_id` в UI платформы,
  затем повторная отправка из ID (ADR-0059 §4).
- **Ключ дневного обновления профиля** (ID ADR-0032 §3) сюда добавит пакет переключения: его имя
  задаёт ADR переключения.
- **Новое касание с `telegram_id` без строки здесь — дефект удаления** (ADR-0039, ADR-0059).
- **Время.** На QA полный человек (строки во всех таблицах) — 5,1 с; пустой — 1,4 с. Предел ID — 15 с.
