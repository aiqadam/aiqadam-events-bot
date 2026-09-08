# Flow: fn-resolve-segment

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: список получателей рассылки по сегменту (OWN-9), с вычитанием `blocked_bot`.
- **Flow ID (MCP)**: `eJ41KArb4vGQYhWSMzUgh` · **externalId (для `callFlow`)**: `jFSgzFx50CT2Vqi7Kgu2a`

## Контракт

**Вход:** `{ segment: 'all_consent'|'registered'|'attended'|'no_show', eventId?: string }`
(`eventId` не нужен только для `all_consent`)

**Выход:** `{ allowed, reason, segment, eventId, count, recipients[], endsAt, opensAt, blockedExcluded }`

`reason`: `''` \| `bad_segment` \| `bad_event_id` \| `event_not_found` \| `no_ends_at` \| `too_early`.

Правила отбора:

| Сегмент | Кто попадает |
|---------|--------------|
| `all_consent` | `users.consent_marketing = 'true'` |
| `registered` | `registrations.status = 'registered'` этого ивента |
| `attended` | `registrations.checked_in_at` не пусто |
| `no_show` | `status = 'registered'` **и** `checked_in_at` пусто, **только при `now >= ends_at`** |

Из всех сегментов вычитаются `users.blocked_bot = 'true'`; `telegram_id` уникальны.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize segment» | допустимость сегмента, сентинел `-` | `{{trigger['output'].data.segment}}`, `...eventId` |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | `events` по `id`, `limit 5` — нужен `ends_at` | `table_id` = `kVLg1FSfDBtsP32FGPk3P`, поле `id` (`V1uVUJxRiBTNRsnsjXXUY`) |
| step_3 | `@aiqadam/qadam-tables : tables-find-records` | `registrations` по `event_id`, **без limit** | `table_id` = `PNuChoFG0tIBTND86yzDL`, поле `event_id` (`6mRpFdqphYL2PtfQwBFEr`) |
| step_4 | `@aiqadam/qadam-tables : tables-find-records` | `users` с `blocked_bot eq true` — только те, кого надо вычесть | `table_id` = `z5PX9B8mTQC9Q6Dfuj5dM`, поле `blocked_bot` (`iXD5CZ4WHR29OWcNYDjAv`) |
| step_7 | `@aiqadam/qadam-tables : tables-find-records` | `users` с `consent_marketing eq true` — для `all_consent` | то же, поле `consent_marketing` (`okGBtVrZ2FNPs7ETslHlr`) |
| step_5 | CODE «build recipient list» | отбор, дедуп, вычитание блокировок, гейт `no_show` | выходы шагов 1–4 и 7 |
| step_6 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_5['output']}}` |

Порядок на канвасе: `trigger → step_1 → step_2 → step_3 → step_4 → step_7 → step_5 → step_6`.
`step_7` добавлен после `step_4` уже на исправлениях, поэтому его номер выбивается
из порядка — имена шагов платформа не перенумеровывает.

## Зависимости

- **Таблицы**: `events`, `registrations`, `users` · **Переменные**: — · **Connections**: —

## Заметки

- **`no_show` закрыт до `ends_at`** (OWN-9) и отдаёт `reason: 'too_early'` + `opensAt`,
  чтобы owner увидел причину и дату, а не молчаливый пустой список. Проверено на
  фикстурах: будущий ивент → `too_early`, закончившийся → список.
  Отсутствие `ends_at` — тоже отказ (`no_ends_at`), а не «считаем всех не пришедшими».
- **Уникальные `telegram_id`, а не строки.** Проверено: три строки одного человека
  (две `registered`, одна `cancelled`) дали одного получателя.
- **`blocked_bot` вычитается из всех сегментов** (FLOWS.md), а `consent_marketing`
  требуется только для `all_consent`. «Не задано» ≠ `false`, но обе трактуются как
  «нет согласия»: отбор идёт по `=== 'true'`, а не по «не равно false».
- **`users` читается двумя фильтрованными выборками, а не целиком.** Первая версия
  тянула всю таблицу без фильтров, и в лог прогона уезжали `phone`, имена и
  `username` **всех** пользователей бота — прямая утечка ПД (DAT-2), потому что
  входы и выходы шагов логируются целиком. Теперь читаются только «кто заблокирован»
  и «кто дал согласие»; множества при этом ровно те же, что давала прежняя проверка
  `=== 'true'` в коде, — фильтр `eq 'true'` по dropdown'у совпадает с ней буква
  в букву, а «не задано» так же не попадает (PAR-2).
  Остаточный риск: у найденных строк всё равно логируются все колонки — проекции
  колонок у `tables` qadam нет ([Q17](../../docs/OPEN-QUESTIONS.md#q17),
  [ADR-0005](../../docs/adr/0005-secrets-visible-in-run-logs.md)).
- **Лимита у выборок нет сознательно.** `ap_get_piece_props` показывает
  «default no limit», то есть молчаливого обрезания — а с ним и пропуска
  `blocked_bot` — не будет. Цена: с ростом аудитории шаг тяжелеет и упирается
  уже не только в `FLOW_TIMEOUT_SECONDS = 600`, но и в размер лога прогона
  (`LOG_SIZE_EXCEEDED`). **На больших таблицах не проверено** — на фикстурах шаг
  занимал ~0.4 с; перемерить до W14 вместе с [Q13](../../docs/OPEN-QUESTIONS.md#q13).
- **`noConsentExcluded` из выхода убран**: посчитать «сколько отсеклось без согласия»
  можно только зная общее число пользователей, а его больше не читаем. Число
  вычтенных блокировок (`blockedExcluded`) осталось — оно считается по своей выборке.
- `count`/`recipients` — снимок на момент вызова. Материализация в `broadcast_targets`
  и защита от двойной отправки — дело `broadcast-runner` (W14).
