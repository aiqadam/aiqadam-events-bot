# W113b. Объявление уникальных ключей (внедрение ADR-0047)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (внедрение [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md))
- **Зависит от**: W113 (готов), ADR-0047 (принят 2026-09-28 владельцем)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Внедрить принятый [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
п. 1: объявить уникальные ключи (`DECLARE_KEY`) на таблицах, где пара/набор —
настоящий инвариант, чтобы уникальность обеспечивала БД (`ON CONFLICT`), а не
соглашение флоу.

## Что построено

`DECLARE_KEY` на семи таблицах `events-dev`:

| Таблица | Ключ |
|---------|------|
| `users` | `telegram_id` |
| `registrations` | `(event_id, telegram_id)` |
| `sessions` | `telegram_id` |
| `staff` | `telegram_id` |
| `feedback` | `(event_id, telegram_id)` |
| `quiz_attempts` | `(quiz_id, telegram_id)` |
| `quiz_answers` | `(quiz_id, telegram_id, question_idx)` |

Документы: [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
(принят), [ADR-0003](../adr/0003-idempotency-without-atomicity.md)/
[ADR-0011](../adr/0011-idempotency-on-atomic-primitives.md) (обновления),
`docs/DATA-MODEL.md`, `catalog/tables/*` (7 карточек + `event_staff`).

## Отклонение от исходного списка W113

W113 предлагал и `event_staff(event_id, telegram_id)`. При внедрении выяснилось,
что это **сломало бы** дизайн: по ADR-0024/`manage-api` для одной пары
сосуществуют revoked и active строки, а выдача/принятие идут
`tables-create-records` (не upsert) — уникальный ключ отверг бы повторную выдачу
после отзыва (`RECORD_DUPLICATE_KEY`). Ключ на `event_staff` **снят**
(`CLEAR_KEY`), таблица оставлена на ADR-0003; это отражено в ADR-0047 п. 1.

## Чек-лист готовности

- [x] ключи объявлены на семи таблицах, `event_staff` — исключён осознанно;
- [x] живые upsert'ы не сломаны: все `tables-upsert-records` на этих таблицах
      используют ровно объявленный ключ (проверено по экспорту флоу);
- [x] различающий proof: upsert-повтор — тот же `record id`; вставка дубля —
      `409 RECORD_DUPLICATE_KEY`;
- [x] `catalog/`, DATA-MODEL, ADR-0003/0011/0047 синхронизированы;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

**Живой `events-dev` (MCP).** `DECLARE_KEY` по семи таблицам — успех; `CLEAR_KEY`
по `event_staff` — успех.

**Сверка ключей флоу.** Скрипт по `flows/*.json`: все `tables-upsert-records` на
семи таблицах несут ровно объявленный набор `key_columns` (0 расхождений).
Отдельно проверено, что `tables-create-records`/`tables-update-record` на этих
таблицах — только `checkin-api/step_8` (`update-record` по `record_id`, ключа не
касается) и `event_staff` (`manage-api`/`staff-accept`, потому и исключён).

**Различающий proof** (таблица `feedback`, временная строка удалена; id прогонов
для независимого чтения `ap_get_run`):
1. `ap_run_action tables-upsert-records`, пара `(zz-w113b, 888888930)` →
   `action: "created"` (`lWFSAqLj2YeRwDrEGUkbo`);
2. повтор → `action: "updated"`, **тот же** `record id 7Ev326r3REQTVM1MOiJb7`
   (`c9fGfQJjNeAa8aOcoaPDM`);
3. `tables-create-records` с той же парой → `409 RECORD_DUPLICATE_KEY`
   (`Cr0H2Yz9g15xRcGhOCZMI`);
4. строка удалена; `users` — `create-records` с существующим
   `telegram_id 322876545` → `409 RECORD_DUPLICATE_KEY` (`T3ZzeVXVl9ebYhxWvUIf0`),
   `sessions` — то же (`mOgoGuiRVAZnIoOJGRkaR`), строк не создано.

**Ограничение чтения:** `ap_export_table`/`ap_list_tables` объявленный ключ
**не показывают**, поэтому read-only интроспекции ключа через MCP нет —
доказательство поведенческое (прогоны выше: дубль отвергается).

**Офлайн:** `check-texts.py` — 0; `check-commands.py` — 0;
`check-export-secrets.sh` — чисто; `check-agents.py` — 0;
`prototypes/check.mjs` — OK (флоу не менялись).

## Журнал

- **2026-09-28** — при первой пробе upsert по `feedback` пришла ошибка
  «Record #1 does not set every key column»: строка была собрана с **внутренними**
  id полей вместо `externalId`. После объявления ключа upsert требует, чтобы
  строка задавала каждый ключевой столбец (в терминах `externalId`); это же
  верно для флоу — но все живые флоу уже пишут `externalId`, сверка это
  подтвердила.
- **2026-09-28** — `event_staff` исключён из объявления (см. выше) — иначе
  повторная выдача прав после отзыва падала бы. Урок: объявлять ключ только там,
  где уникальность — инвариант, а не «есть ключевые колонки».
- **2026-09-28** — схема таблиц не заморожена против таких правок: ADR-0047 —
  отдельное решение владельца, DATA-MODEL/каталог обновлены тем же коммитом.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- `staff_invites`, `broadcast_targets`, `quiz_questions`, `events`, `chapters`,
  `quizzes`, `broadcasts`, `migrations`, `strings` — ключи не объявлены (см.
  ADR-0047 п. 1); при необходимости — отдельно.
- `event_staff` — намеренно без ключа.
- Перенос на prod — отдельным хотфиксом (ADR-0042).
