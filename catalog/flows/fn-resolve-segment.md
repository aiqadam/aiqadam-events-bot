# Flow: fn-resolve-segment

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: список получателей рассылки по сегменту (OWN-9), с вычитанием `blocked_bot`.
- **Flow ID (MCP)**: `eJ41KArb4vGQYhWSMzUgh` · **externalId (для `callFlow`)**: `jFSgzFx50CT2Vqi7Kgu2a`

## Контракт

**Вход:** `{ segment: 'all_consent'|'registered'|'attended'|'no_show', eventId?: string }`
(`eventId` не нужен только для `all_consent`)

**Выход:** `{ allowed, reason, segment, eventId, count, recipients[], endsAt, opensAt, blockedExcluded, noConsentExcluded }`

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
| step_4 | `@aiqadam/qadam-tables : tables-find-records` | `users` целиком, **без фильтров и limit** | `table_id` = `z5PX9B8mTQC9Q6Dfuj5dM`, `filters.filters = []` |
| step_5 | CODE «build recipient list» | отбор, дедуп, вычитание блокировок, гейт `no_show` | выходы шагов 1–4 |
| step_6 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_5['output']}}` |

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
- **`users` читается целиком, без лимита** — иначе нельзя достоверно вычесть блокировки.
  Это осознанная цена: с ростом аудитории шаг тяжелеет. Ограничение упирается
  в `FLOW_TIMEOUT_SECONDS = 600`, и к W14 (рассылки) его надо перемерить на реальном
  объёме. **Не проверено на больших таблицах** — на фикстурах шаг занимал ~0.4 с.
- `count`/`recipients` — снимок на момент вызова. Материализация в `broadcast_targets`
  и защита от двойной отправки — дело `broadcast-runner` (W14).
