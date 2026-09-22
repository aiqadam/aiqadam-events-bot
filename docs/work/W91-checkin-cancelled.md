# W91. Чекин отменённого события

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Сканирование QR отменённого события сейчас проходит как успех. Part 1 — вердикт
`event_cancelled` («Событие отменено»). Part 2 (ручной чекин, ADR-0036) — Phase 3.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-api` (step_13 + step_7) | `rKoDYtiIVdbzlW59b57uH` | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| Mini App `Scan.tsx` (вердикт) | — | — |

Изменения:
- `checkin-api`: новый шаг `step_13` (`tables-find-records events`, проекция
  `status`) между `step_6` и `step_7`; `step_7` читает `eventRows` и отдаёт
  `event_cancelled` при `status = cancelled` — после гейтов контролёра/подписи,
  но **до** проверки регистрации. `shouldCheckin` для этого исхода `false`,
  запись `checked_in_at` не происходит.
- `i18n/ru.json`: `checkin.event_cancelled`.
- `Scan.tsx`: вердикт `event_cancelled` (тон/иконка/подпись).
- Каталог обновлён; Part 2 (ручной чекин, ADR-0036) — не здесь.

## Чек-лист готовности

> Из [issue #143](https://github.com/aiqadam/aiqadam-events-bot/issues/143), Part 1.

- [x] скан QR отменённого события → «Событие отменено»
- [x] `i18n/ru.json`: `checkin.event_cancelled`
- [x] `check-texts.py`, `check-commands.py` зелёные
- [x] `catalog/flows/checkin-api.md`, экспорт и `_manifest.json` обновлены тем же коммитом
- [x] `catalog/` совпадает с живым проектом

## Как проверено

Живой прогон на `events-dev` (published `checkin-api`), `initData` и QR
подписаны временным флоу `zz-qa-mint` (переменные `BOT_TOKEN`/`QR_SIGNING_KEY`
читаются внутри Code step, значения не покидают инстанс; по решению владельца
2026-09-23). Временные данные после проверки удалены.

- Темп. событие `zzw91cancel` (`status=cancelled`) + контролёр +
  подписанный QR: `{"status":"event_cancelled","text":"Событие отменено"}`, HTTP 200.
- **Различающий регресс:** темп. событие `zzw91live` (`status=published`) +
  регистрация: `{"status":"ok","text":"Binali — отмечен"}`, HTTP 200 —
  гейт срабатывает только на `cancelled`, обычный чекин пишется.
- Первый прогон вскрыл ошибку: `table_id` был взят внутренним id
  (`ap_list_tables`), шаг падал `Table with externalId … not found`, весь
  `valid`-путь отдавал 500 — исправлено на externalId (`R4aSQpLZvw7d3u6DVOSjH`),
  перепубликовано, прогон зелёный.
- `check-texts.py` — 238 пар, 0 расхождений.

## Журнал

- **2026-09-23** — пакет взят. Временный минтинг-флоу `zz-qa-mint` создан и
  удалён; временные события/контролёр/регистрация удалены. `checkin-api` был
  на несколько минут сломан (500 из-за неверного `table_id`) — поймано
  первым же curl, исправлено до ухода с инстанса.

## Ревью

- **Ревьюер**: review-agent (opencode) · **Дата**: 2026-09-23 · **Вердикт**: есть замечания

### Замечания

1. **блокер** `flows/checkin-api.json` не соответствует опубликованной версии.
   У `step_13` в экспорте `table_id` = `bVtxmEkqb3dPwZ2FKljqk` — **внутренний**
   id таблицы `events` (`ap_list_tables`), тогда как живой опубликованный
   `lkYm9AUS4ELkTphQo6FlB` использует externalId `R4aSQpLZvw7d3u6DVOSjH`
   (`ap_resolve_property_options` → `events`). Там же `displayName` = «read
   participant name» вместо «read event status» и `schemaVersion` 31 вместо 32.
   Это ровно то значение, на котором упал прогон `K0tpLSU79QCCNAHJ4dVK4`
   (PRODUCTION): `Table with externalId bVtxmEkqb3dPwZ2FKljqk not found` — весь
   `valid`-путь отдавал 500. Каталог и живой флоу внешний id уже используют, а
   экспорт — нет: снимок снят с промежуточной (сломанной) публикации до фикса,
   при этом `_manifest.json` уже указывает на финальную `lkYm…`. `check-texts.py`
   такое не ловит (тексты верны), а импорт по ADR-0021 вернёт 500. Починить:
   перевыгрузить `flows/checkin-api.json` с опубликованной версии
   (`tools/export-flows.sh checkin-api` либо `ap_export_flow` +
   `tools/export-flow-mcp.py`) **тем же коммитом**, что и фикс.

2. **на будущее** `catalog/flows/checkin-api.md`, строка про `step_7`:
   «шесть оставшихся исходов STF-4» — после добавления `event_cancelled` их
   семь (таблица ниже перечисляет все восемь статусов; `invalid_init_data`
   решает `step_10`). Поправить счёт.

3. **на будущее** ADR-0027: новый вердикт `event_cancelled` отсутствует в
   `prototypes/app.js` (`renderScan`) — это расширение эталона, а не его
   элемент. Тон/иконка/подпись взяты из уже существующего паттерна отказа
   (`wrong_event`: tone `bad`, icon `alert`, `checkin.sub_denied`), это
   корректно; но расхождение с прототипом стоит назвать в журнале явно.

### Что проверено

Живой проект через MCP:

- `ap_flow_structure rKoDYtiIVdbzlW59b57uH`: цепочка линейная, внутри ветки
  `valid` — `step_6 → step_13 → step_7` (не побочная ветка). `step_13` —
  `tables-find-records`, `table_id` = `R4aSQpLZvw7d3u6DVOSjH` (externalId),
  фильтр по `events.id` = `{{trigger['output'].body.eventId}}`, проекция
  `status` (`Ia0fI5cUGnI4VH7iXsEbv`).
- `ap_read_step_code step_7`: `event_cancelled` стоит **после** гейтов
  (`!isStaff`, `!parsedValid`, `qrEventId !== requestedEventId`, `!qrValid`) и
  **до** проверки регистрации; `shouldCheckin` для него `false`,
  `writeRecordId` = `-`; текст — `inputs.texts['checkin.event_cancelled']`;
  `package.json` = `{}`.
- Тексты `step_7` (8 ключей) побайтово совпали с `i18n/ru.json`; коротких ссылок
  `{{VAR}}` в экспорте нет; новых команд нет (`check-commands.py` — 0).
- `ap_export_flow` опубликованной версии: `flows[0].id` = `lkYm9AUS4ELkTphQo6FlB`
  = `_manifest.json` = строка `migrations` `2026-09-23-w91-01` (commit `9b88fcc`,
  action `publish`) — снимок манифеста и запись о публикации сходятся.
- AppSec: `event_cancelled` отдаётся только после проверки staff **этого**
  события и подписи QR (доступ по `event_id` не даёт сам по себе; непривилегированный
  получает `403 forbidden` раньше) — утечки «состоит ли кто-то» до авторизации нет.
  Отменённое событие не даёт `ok` и записи: `shouldCheckin=false`, `step_8`
  получает `record_id='-'` и падает 404 под `continueOnFailure` — безопасный
  no-op. Пустой результат `step_13` безопасен: `status` пуст → ветка не
  срабатывает, поток идёт к проверке регистрации.
- Прогоны (PRODUCTION): `xA1rjZAJJuh6LDswGcC6s` — живое событие → `ok` +
  запись `checked_in_at`; `0qc5AySV1dnr97MMRoPYp` — отменённое → `event_cancelled`,
  `shouldCheckin=false`, `step_9` HTTP 200. Оба — штатный контролёр с валидным
  QR, то есть различающая пара на одном классе входа. `K0tpLSU79QCCNAHJ4dVK4` —
  тот самый 500 на внутреннем id до фикса.
- Живой `curl` на `/sync` (невалидный `initData`): **401**
  `{"status":"invalid_init_data","text":"Данные Mini App устарели…"}` —
  независимо воспроизведено; `valid`-путь на живом подтверждён прогонами автора
  выше (подписать `initData`/QR сам не мог — ключи `BOT_TOKEN`/`QR_SIGNING_KEY`
  ревьюеру недоступны).

Офлайн-проверки (все зелёные): `check-export-secrets.sh`, `check-texts.py`
(29 флоу, 238 пар, 0 расхождений), `check-commands.py`, `check-agents.py`,
`node prototypes/check.mjs`. `check-migrations.py` запустить не удалось: на этой
машине нет `QADAM_API_KEY` и нет macOS-Keychain; манифест ↔ инстанс ↔ `migrations`
сверены вручную через MCP (см. выше).

Mini App: `Scan.tsx` — новый вердикт `event_cancelled` (tone `bad`, icon `alert`,
`checkin.sub_denied` = «Не впускать»), главный текст — серверный «Событие
отменено»; пользовательские данные через него не проходят.

## Хвосты и блокеры

- Part 2 (ручной чекин) — Phase 3, ADR-0036.

### Ответы владельца (круг 1, 2026-09-23)

- **блокер** — *Исправлено*: `flows/checkin-api.json` приведён к опубликованной
  версии `lkYm9AUS4ELkTphQo6FlB` — `step_13.settings.input.table_id` =
  externalId `R4aSQpLZvw7d3u6DVOSjH`, node `displayName` = «read event status».
  Значения сверены с `ap_export_flow`/`ap_flow_structure`. `schemaVersion` 31 в
  снимке — как у всех `flows/*.json` в репозитории; 32 в MCP-экспорте — разница
  инструмента выгрузки, не этого пакета (в репозитории правится отдельным
  решением, здесь не трогаем).
- **на будущее 2** — *Исправлено*: каталог — «семь оставшихся исходов STF-4».
- **на будущее 3** — принято: `event_cancelled` — расширение эталона
  `prototypes/app.js` (`renderScan` его не знает), тон/иконка/подпись взяты из
  уже существующего паттерна отказа `wrong_event`. Расхождение с прототипом —
  осознанное (STF-3), названо здесь.
