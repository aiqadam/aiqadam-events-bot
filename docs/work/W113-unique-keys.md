# W113. Уникальные ключи и BOOLEAN/JSON: аудит, proof, ревизия ADR-0003/0011

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (следствие [W108](W108-platform-novelties.md), [ADR-0044](../adr/0044-platform-novelties-sep-2026.md) п. 3.5, 5.1)
- **Зависит от**: —
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Закрыть отложенное ADR-0044 п. 3.5: аудит дублей по бизнес-ключам, proof
write-time валидации #472 и ревизия [ADR-0003](../adr/0003-idempotency-without-atomicity.md)/[ADR-0011](../adr/0011-idempotency-on-atomic-primitives.md).
Живые таблицы не трогаются, пока решение не принято.

## Что построено

Изменений на инстансе **нет** (только чтение + временная таблица, удалена).
Артефакты — [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
(предложение) и этот журнал.

## Чек-лист готовности

- [x] аудит дублей по бизнес-ключам всех 15 таблиц;
- [x] proof write-валидации #472 на временной таблице (STATIC_DROPDOWN, DATE,
      BOOLEAN, JSON, объявленный ключ);
- [x] проект ревизии ADR-0003/0011 — [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md);
- [x] решение по BOOLEAN/JSON зафиксировано (не мигрировать сейчас);
- [x] временная таблица удалена, живые таблицы не менялись;
- [x] `catalog/` совпадает с живым проектом (не менялся);
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

**Аудит дублей** (`ap_list_tables` → `ap_find_records` с проекцией только
ключевых полей → подсчёт локально):

| Таблица | Ключ | Строк | Дублей-групп |
|---------|------|-------|--------------|
| `users` | `telegram_id` | 119 | 0 |
| `registrations` | `event_id`+`telegram_id` | 3 | 0 |
| `sessions` | `telegram_id` | 119 | 0 |
| `staff` | `telegram_id` | 2 | 0 |
| `event_staff` | `event_id`+`telegram_id` | 1 | 0 |
| `feedback` | `event_id`+`telegram_id` | 0 | 0 |
| `staff_invites` | `token_hash` | 2 | 0 |
| `broadcast_targets` | `broadcast_id`+`telegram_id` | 0 | 0 |
| `events` | `id` | 2 | 0 |
| `chapters` | `id` | 1 | 0 |
| `quizzes` | `id` | 1 | 0 |
| `quiz_questions` | `quiz_id`+`idx` | 15 | 0 |
| `quiz_attempts` | `quiz_id`+`telegram_id` | 86 | 0 |
| `quiz_answers` | `quiz_id`+`telegram_id`+`question_idx` | 903 | 0 |
| `migrations` | `id` | 313 | 0 |

`quiz_answers` (903 > лимита `ap_find_records` 500) проверена разбивкой по
`question_idx` (15 выборок, сумма 903, ни одна не превысила 500); в каждом
`idx` все `telegram_id` уникальны.

**Proof write-валидации #472** (временная таблица `zz-w113-proof`, удалена):

| Ввод | Результат |
|------|-----------|
| валидная строка (`status=a`, `when` ISO, `flag=true`, `meta={"x":1}`) | ✅ создана |
| `status=c` (вне объявленных опций) | ❌ `409 VALIDATION / valueNotInOptions` |
| `when=""` | ✅ **принято**, ячейка `null` (не отказ) |
| `flag=true` / `flag=false` | ✅ оба |
| `meta={"x":1}` | ✅ |
| `meta="не-json"` | ❌ `Invalid JSON for field "meta"` |
| `flag="true"` (строка) | ❌ `Expected boolean, received: true` |
| `DECLARE_KEY(key1)` + повторный upsert | ✅ тот же `record id` |
| `tables-create-records` с тем же `key1` | ❌ `409 RECORD_DUPLICATE_KEY` |

Вывод: серверная валидация применяется независимо от пина qadam'а; объявленный
ключ даёт реальную уникальность. Единственное расхождение с ожиданием — пустая
строка `DATE` коэрцится в `null`, а не отвергается (согласуется с «пусто = не
менять»; очистка — только `clear_columns`/`__clear`, W109).

**Офлайн:** `check-texts.py` — 0; `check-commands.py` — 0;
`check-export-secrets.sh` — чисто; `check-agents.py` — 0;
`prototypes/check.mjs` — OK (флоу/таблицы не менялись, экспорт не снимался).

## Журнал

- **2026-09-28** — аудит выявил **ноль дублей** — значит, объявить ключи
  технически можно; но это меняет путь записи (ON CONFLICT, без
  advisory-lock) и потому вынесено в [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
  как предложение владельцу, а не как правка «заодно».
- **2026-09-28** — `quiz_answers` не влезла в лимит `ap_find_records` (500);
  обошли разбивкой по `question_idx` (15 запросов) — иначе вывод «0 дублей»
  был бы необоснован.
- **2026-09-28** — замечание об инструменте: `ap_list_tables`/`ap_create_table`
  печатают **внутренний** id, а `qadam-tables` ждёт **externalId** (гоча 18);
  для proof externalId брали из `ap_export_table`.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- **Решение владельца по [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)**:
  объявлять ли уникальные ключи (отдельный пакет со сменой пути записи) и
  оставлять ли флаги на `STATIC_DROPDOWN`. Пока не принято — действует
  ADR-0003.
- Перенос чего-либо на prod — не требуется (инстанс не менялся).
