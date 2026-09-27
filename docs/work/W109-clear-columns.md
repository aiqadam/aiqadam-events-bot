# W109. Очистка ячейки: `clear_columns`/`__clear` и возврат Q30

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (следствие [W108](W108-platform-novelties.md), [ADR-0044](../adr/0044-platform-novelties-sep-2026.md) п. 3.1)
- **Зависит от**: —
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Вернуть инвариант «`status` и `cancelled_at` согласованы»: реактивация
регистрации чистит `cancelled_at` явным per-row `__clear`
(`@aiqadam/qadam-tables` 0.4.6), а не оставляет его от прошлой отмены. Снять
оговорку «потребители смотрят на `status`, а не на `cancelled_at`» из
`docs/DATA-MODEL.md`, `catalog/tables/registrations.md` и Q30.

## Что построено

Перепривязаны на `tables` 0.4.6 и получили `__clear` пять шагов
создания/реактивации регистрации:

| Флоу | Шаг | Было | Стало |
|------|-----|------|-------|
| `reg-consent-pdn` (`UgAeyhpI29ndjM4EM3gxf`) | `step_5` | 0.4.5 | 0.4.6 + `__clear` |
| `reg-api` (`SmutybV5qJQjQASJGY9vi`) | `step_11` | 0.4.5 | 0.4.6 + `__clear` |
| `reg-api` | `step_18` | 0.4.5 | 0.4.6 + `__clear` |
| `reg-profile` (`bEz2bKyL82zlIwckxqvxc`) | `step_23` | 0.4.5 | 0.4.6 + `__clear` |
| `reg-profile` | `step_29` | 0.4.5 | 0.4.6 + `__clear` |

Живой экспорт: `reg-consent-pdn` версия `gxJ6ww1P3up0cbFpe57f2`,
`reg-api` — `cQptzSeyWzIIv5FzD0bPa`, `reg-profile` — `gy6jtF1CCj8r0UBWxIXm5`
(все `LOCKED`, `source: mcp`).

**Способ bump'а.** `ap_update_step` версию qadam'а не меняет (проверено по
исходникам MCP-инструмента), поэтому пин поднимается `ap_delete_step` +
`ap_add_step` по образцу [W100](W100-telegram-pin-migration.md): шаг удаляется
(движок `_deleteAction` перевешивает родителя/ветку на следующий шаг), затем
добавляется в то же место тем же именем (`findUnusedName` → наименьший
свободный `step_N`), новый шаг берёт последнюю версию (`resolveLatestQadamVersion`).
Дерево и число шагов сверены: `reg-consent-pdn` 18/18, `reg-api` 46 (45 + 1
`skipped`), `reg-profile` 40/40; `ap_validate_flow` — все valid.

## Чек-лист готовности

- [x] затронутые `tables`-шаги подняты на 0.4.6 (точечно — только там, где
      нужна очистка; см. решение ниже);
- [x] реактивация передаёт `cancelled_at` в `__clear` вместо «оставить как
      было»;
- [x] оговорка снята из `docs/DATA-MODEL.md`,
      `catalog/tables/registrations.md` и Q30;
- [x] живой различающий прогон: отмена → реактивация → `cancelled_at` пуст;
- [x] `catalog/` совпадает с живым проектом;
- [ ] независимое ревью, вердикт «замечаний нет».

## Решение по объёму bump'а

ADR-0044 п. 3.1 оставлял владельцу выбор «точечно или сплошняком». Выбран
**точечный** вариант (первый из названных): версия поднята только у шагов,
которым нужна очистка. Сплошной bump 156 `tables`-шагов (0.4.5→0.4.6) —
отдельная механическая работа без функционального выигрыша; вынесена хвостом
владельцу, если он захочет единый пин.

## Как проверено

Различающий живой прогон на `events-dev` (`ap_test_flow`, обёртка `{"data":…}`,
гоча №13), синтетический `telegram_id` 888888920, тестовые строки удалены
после проверки (`users`/`sessions`/`registrations` по 888888920 — пусто):

1. В `registrations` вставлена строка `status = cancelled`,
   `cancelled_at = 2026-09-20T00:00:00Z` (событие `mu9rqipgetmp`,
   `telegram_id 888888920`).
2. `ap_test_flow` `reg-consent-pdn`, `callbackData = reg:pdn:yes`,
   `sessionDraft.eventId = mu9rqipgetmp` (`CMcea1PrARuKWIfqlccI0`) →
   `step_5` отдал `action:"updated"`, записи: `status = registered`,
   **`cancelled_at = ""`**. До прогона `cancelled_at` был непуст.
3. Контроль механизма: тот же шаг на 0.4.5 `__clear` не понимает (per-row
   `__clear` появился в 0.4.6, PR #543), то есть на прежнем пине значение
   осталось бы — это и есть различие до/после.

- `ap_validate_flow` — `reg-consent-pdn` 18/18, `reg-api` 46 (45 valid, 1
  skipped), `reg-profile` 40/40.
- Экспорт MCP всех трёх флоу; нормализованный диф — только `__clear` и
  `qadamVersion` 0.4.5→0.4.6 (у `reg-consent-pdn` плюс платформенный шум
  пере-сериализации триггера `sampleData: {}`).
- Офлайн: `check-export-secrets.sh` — чисто; `check-texts.py` — 0;
  `check-commands.py` — 0; `check-agents.py` — 0; `prototypes/check.mjs` — OK.
- Таблицы после прогона: `telegram_id` 888888920 в `users`/`sessions`/
  `registrations` — пусто (строки удалены).

## Ограничение

`reg-api` — webhook с обязательным валидным `initData` (HMAC); живого
`initData` у исполнителя нет, поэтому Mini App-путь (`step_11`/`step_18`)
живым прогоном не покрыт — покрыт чат-путь `reg-consent-pdn/step_5` на той же
таблице/поле тем же механизмом. `reg-profile/step_23`/`step_29` — тот же
шаг-конструктор, что и проверенный, отличаются только ссылками на `step_2/3/4`.

## Журнал

- **2026-09-28** — повторная привязка через `ap_delete_step`+`ap_add_step`:
  пин 0.4.5 → 0.4.6 достижим только так. `__clear` в `tables-upsert-records`
  — ключ **в строке** `values.values[i]`, значение — `externalId` колонки
  (`columnUtils.toClearFieldIds` принимает externalId/имя/id).
- **2026-09-28** — `reg-profile` уже правился пакетом W120 (алиасы города);
  ветка W109 создана от `main` после мержа W120, конфликтов нет.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Сплошной bump остальных `tables`-шагов 0.4.5→0.4.6 — решение владельца
  (ADR-0044 п. 3.1), не входит в W109.
- Перенос на prod — отдельным хотфиксом (ADR-0042).
- Живой прогон Mini App-ветки (`reg-api` `step_11`/`step_18`) — за владельцем:
  нужен настоящий `initData`.
