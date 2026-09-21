# W61. Галочка «присылать анонсы» в профиле не работала: `consent_marketing` не читался

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне BACKLOG — прямое обращение владельца («в профиле галочка присылать анонсы не работает»)
- **Зависит от**: W60 (пакет, где таб «Профиль» получил переключатель рассылки)
- **Начат**: 2026-09-21 · **Закрыт**: —

## Цель

Починить жалобу владельца: в табе «Профиль» Mini App (`#/events?tab=profile`)
переключатель «Присылать анонсы» выглядит нерабочим — сохраняешь, открываешь
заново, галочка снова снята.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-api` (step_17 `columns`) | `SiYL8m6k4oy4YunAdZ1W7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |

## Чек-лист готовности

> Своего чек-листа в BACKLOG у пакета нет (вне волн) — взят общий набор пакета,
> трогающего `reg-api`.

- [x] `profile_get` возвращает фактическое `consent_marketing` из `users`
- [x] `profile_save` пишет его по-прежнему (регресса нет — не трогалось)
- [x] `catalog/` совпадает с живым проектом (строка step_17 + заметка о грабле)
- [x] Валидация (`ap_validate_flow`), публикация, экспорт `flows/`, миграции
- [x] Офлайн-чекеры (`check-texts.py`, `check-commands.py`, `check-export-secrets.sh`)
- [x] Независимое ревью

## Как проверено

- **Корень найден различающим прогоном `ap_run_action` на `tables-find-records`
  (`users`, `telegram_id eq 322876545`)** — два вызова, отличие ровно в проекции
  `columns`:
  - проекция **без** `FpWznk9Fgl8wUXXUKolRu` (как в живом `step_17` до фикса) —
    ячейки `consent_marketing` в выводе нет вовсе;
  - проекция **с** `FpWznk9Fgl8wUXXUKolRu` — вывод содержит
    `p5kwWMUyrOXRvQx4oTH29: {fieldName: "consent_marketing", value: "true"}`.
  `step_9` собирает строку по `fieldName` (`flat()`), поэтому без колонки
  `userRow.consent_marketing` пуст, и `profile_get` отдаёт `consentMarketing:
  false` независимо от записанного значения.
- **Живое состояние данных** (`ap_find_records users`): у трёх пользователей
  (`532804490`, `322876545`, `52128246`) `consent_marketing = true` с
  `consent_marketing_at` — то есть путь записи (`profile_save`/чат) исправен,
  не читалось именно значение. Это подтверждает, что баг только на чтении.
- **После фикса** — `ap_update_step step_17` (колонка добавлена),
  `ap_validate_flow` — зелёный (`24 steps, 23 valid, 1 skipped`),
  `ap_lock_and_publish` — успешно; свежий `ap_export_flow` (сразу после
  публикации, `state: LOCKED`) отдаёт `step_17.columns` с
  `FpWznk9Fgl8wUXXUKolRu` — экспорт `flows/reg-api.json` обновлён из него тем же
  коммитом.
- **Предел среды**: живой сквозной прогон `profile_get`/`profile_save` требует
  подписанного `initData` (реальный бот-токен) — тот же предел, что у всех
  прежних пакетов, трогавших `reg-api` (W32, W43, W50, W60). Доказательство
  построено на различающем прогоне чтения таблицы (одинаковый вход, разная
  проекция) и на живой сверке записанных значений.

## Журнал

- **2026-09-21** — Пакет взят по прямому обращению владельца. Первое, что
  проверено — путь чтения, а не записи: `flows/reg-api.json` (последний экспорт
  W60) показал, что `step_22` пишет `consent_marketing` по верному `externalId`
  (`FpWznk9Fgl8wUXXUKolRu`), а `step_17` в проекции `columns` его не запрашивает.
  Это тот же класс ошибки, что W58 (namespace `id`/`externalId`), но вывернутый:
  там ключ записи не совпадал, здесь колонка просто не читается — и то и другое
  `ap_validate_flow` не ловит.
- **2026-09-21** — Отдельно перепроверено, что `columns` — это externalId, а не
  внутренний `field id` (гоча №1): `ap_run_action` с `FpWznk9Fgl8wUXXUKolRu`
  вернул ячейку с `fieldName` — то есть проекция по externalId резолвится
  платформой. `consent_pdn` (`KtdV8plfevjdnKlLko08q`) в том же списке и работает
  в `profile_save`-гейте — ещё одно подтверждение namespace.
- **2026-09-21** — `step_12` (пропущенный W60) не тронут: он пишет по тем же
  верным externalId, вопрос был только в чтении.
- **2026-09-21** — Экспорт снят MCP-инструментом `ap_export_flow` сразу после
  `ap_lock_and_publish` и прогнан через `tools/export-flow-mcp.py`
  (`source: mcp`); диф по `flows/reg-api.json` — ровно добавленная колонка плюс
  `schemaVersion 31→32`, который платформа подняла при публикации.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: независимый агент (opencode, deepseek-v4.1-flash) · **Дата**: 2026-09-21 · **Вердикт**: есть замечания (одно, уровня «на будущее»; блокеров и «важно» нет)

### Замечания

1. **на будущее** — карточка `catalog/flows/reg-api.md` сохраняет историю обнаружения: заметка про W58 («`step_17`/`step_19`/`step_22` до 2026-09-20 писали и читали…», «различающий прогон…») и заметка про W60 («Раньше `step_12` писал…») — `catalog/flows/reg-api.md`, строки ~84–94 и ~110–123 — по правилу «Каталог — инструкция, а не дневник» (AGENTS.md) фразы вида «раньше было по-другому» удаляются при следующей правке карточки, а W61 карточку правил. W61 этого не вносил, на корректность флоу не влияет. При следующем касании оставить только текущее состояние (что читается/пишется сейчас и почему `columns` обязателен), даты и путь решения убрать.
   - *Исправлено*: заметки `reg-api.md` переписаны в текущее состояние — убраны «до 2026-09-20», «Раньше `step_12` писал…», «Исправлено на…»; остались действующие правила (namespace `columns`/`values`, обязательная колонка `consent_marketing`, `skip` на `step_12` и его причина) и ссылка на `catalog/tables/users.md` (2026-09-21).

#### Что проверено и сошлось (свидетельства)

- `ap_flow_structure` (includeInput=true): `step_17.settings.input.columns` содержит `FpWznk9Fgl8wUXXUKolRu` (10 колонок); `ap_read_step_code` `step_9` собирает строку `flat()` по `fieldName` и читает `userRow.consent_marketing` в ветке `profile_get` — без колонки значение пусто, `consentMarketing: false`. Цепочка фикса сходится.
- `ap_export_table` (users, внутренний id `gyMqrk23KWlFQweY3qDU0`): `consent_marketing` → externalId `FpWznk9Fgl8wUXXUKolRu`, field id `p5kwWMUyrOXRvQx4oTH29` — namespace (`columns` использует externalId) подтверждён первоисточником, гоча №1 не нарушена. Этим же вызовом и `ap_find_records` (фильтр `consent_marketing eq true`) подтверждено: у `532804490`, `322876545`, `52128246` `consent_marketing = "true"` — путь записи исправен.
- `step_22` пишет `FpWznk9Fgl8wUXXUKolRu` (`consent_marketing`) и `3t75byELQCZ1ejfTADsvp` (`consent_marketing_at`) — верные externalId; `step_19` — те же плюс профиль. Гейт `profile_save` (`userRow.consent_pdn === 'true'`) не тронут, регресса нет.
- Мини-апп: `miniapp/src/routes/Events.tsx` читает `res.data['consentMarketing']` из `profile_get` и отправляет его в `profile_save` — цепочка «колонка → ответ → галочка» сходится.
- Сверка версий: свежий `ap_export_flow` даёт `flows[0].id = N82R7sL1wxm3Ws177RHb0` = `publishedVersionId` в `flows/_manifest.json` = `version_id` строки `migrations 2026-09-21-w61-01` (package W61, object `flow:reg-api`, object_id `SiYL8m6k4oy4YunAdZ1W7`, action publish, commit `7a513c6`). Commit совпадает с HEAD ветки; в экспорте `schemaVersion 31→32`, `state: LOCKED`.
- Диф `7a513c6` (5 файлов): только колонка `step_17`, `schemaVersion`, версия в манифесте, строка STATUS, журнал и каталог. Постороннего нет.
- Офлайн-чекеры: `check-export-secrets.sh` — 0 совпадений, auth-поля ссылками (`{{connections['...']}}`), exit 0; `check-texts.py` — 230 пар, 0 расхождений, exit 0; `check-commands.py` — 0 нарушений, exit 0; `check-agents.py` — 0 нарушений, exit 0.
- AppSec (применимое): изменение — чтение собственной строки вызывающего после проверки `initData` (ветка `valid` `step_3`), новых источников `telegram_id`, инъекций (значение колонки — константа, не пользовательский ввод), секретов и утечек не вносит. Криптография, IDOR-решения, CSV — не относятся.

#### Пределы среды (не замечания к пакету)

- `ap_run_action` (буквальный различающий прогон проекции `columns` из журнала) в моём MCP-наборе не экспонирован — воспроизвести не смог. Заменил его `ap_export_table` (первоисточник маппинга `fieldName`↔`externalId`) плюс `ap_find_records`; для проверки namespace это не слабее.
- `tools/check-migrations.py` не запустился: ключа платформы нет ни в `QADAM_API_KEY`, ни в Keychain (exit 2). Инварианты B1/C проверены вручную по строке `migrations` через MCP — сходятся.
- Живой сквозной прогон `profile_get`/`profile_save` не выполнялся (нужен подписанный `initData`; `ap_test_flow`/`ap_test_step` по этому флоу запрещены гочей №11/№14) — тот же предел, что заявлен в журнале владельца.

## Хвосты и блокеры

- Живой сквозной прогон `reg-api` (`profile_get`/`profile_save` на реальном
  `initData`) не выполнялся — нужен подписанный `initData` от владельца. При
  первой же сессии с ним стоит открыть таб «Профиль» у пользователя с
  `consent_marketing = true` и убедиться, что галочка отрисована включённой.
