# W99. Ack колбэка меню вынесен из `menu` в `tg-router`

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн — прямое наблюдение владельца в чате
- **Зависит от**: W68 (кнопка `menu:bcast_help` и её ack), W73 (меню на обычный текст)
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

Убрать «холостой» вызов Bot API на входе в меню. `menu/step_14`
(`answer_callback_query`) сегодня выполняется на каждом рендере меню, но
`callbackQueryId` непуст только при входе по колбэку `menu:*`. На голом
`/start` и на обычном тексте шаг всё равно делает HTTP-визит в Telegram API
и получает `400 query is too old ... or query ID is invalid` — 0,3–0,7 с из
1,0–2,1 с суммарной латентности меню впустую. Гейт внутри `menu` требует
дублирования веток (движок не сводит ветки), поэтому ack переносится в
`tg-router`, где отдельная ветка — это один `callFlow`, а не вся цепочка меню.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `tg-router` | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |

## Чек-лист готовности

- [x] `menu` не зовёт `answer_callback_query` ни на одном входе (шаг убран)
- [x] Колбэк `menu:*` по-прежнему гасится (спиннер кнопки), но уже в `tg-router`
- [x] Меню на `/start`, обычный текст и колбэк `menu:*` отдаёт то же содержимое
- [x] `catalog/` совпадает с живым проектом
- [x] Независимое ревью (одно замечание `на будущее` — исправлено)

## Как проверено

- `ap_list_runs`/`ap_get_run` (`menu`, PRODUCTION): `step_14` ❌ 0,3–0,7 с на
  каждом из 10 последних прогонов, все входы — `/start`/текст с пустым
  `callbackQueryId`; суммарно 1,0–2,1 с на прогон.
- `ap_test_flow` `tg-router`, апдейт-колбэк `menu:bcast_help` (прогон
  `uniLltD3MbbOVefDgsVmg`): `step_10` → `route: menu_cb`, `step_11` выбрал
  ветку `menu_cb` (branchIndex 10), `step_22` — попытка ack (синтетический
  `id` → Telegram 400, ожидаемо, `continueOnFailure`), `step_23` довёл меню.
  До правки тот же вход шёл веткой `menu`.
- `ap_test_flow` `tg-router`, апдейт-сообщение `/start` (прогон
  `3grVhDwPT3g8AhIugMHrP`): `step_10` → `route: menu`, `step_11` ветка
  `menu` (branchIndex 4), `step_15` довёл меню за 1,0 с — шага ack в прогоне
  нет вовсе.
- `ap_validate_flow`: `tg-router` 24/24; `menu` 14/14 (обе — без новых
  замечаний; у `menu` остаются прежние предупреждения о пине
  `qadam-telegram-bot@0.8.0` на `step_5`/`step_12`).
- `tools/check-texts.py` (29 флоу, 254 пары, 0 расхождений),
  `tools/check-commands.py` (0 нарушений), `tools/check-export-secrets.sh`
  — чисто.

## Журнал

- **2026-09-24** — Владелец заметил по прогонам: «первый степ будто в холостую
  работает». Подтверждено: `menu/step_14` падает на всех входах, кроме
  колбэка, `continueOnFailure` это прячет. W68 уже назвал цену («лишний вызов
  Bot API») как `на будущее`, отметив, что чистого гейта в этом движке без
  дублирования веток нет.
- **2026-09-24** — Решение: ack переносится в `tg-router`. Ветка `menu_cb`
  (новый `route` из `step_10`) содержит `answer_callback_query` + `callFlow
  menu`; в `menu` шаг `step_14` убран. Дублируется только один `callFlow`, а
  не вся цепочка меню (ветки в движке не сходятся).
- **2026-09-24** — `ap_update_step` по `menu/step_14` невозможен:
  `qadam_metadata_not_found` — шаг и все telegram-шаги `menu` пинованы на
  `@aiqadam/qadam-telegram-bot@0.8.0`, которого инсталляция не знает (та же
  причина, что у пинов в `ap_flow_structure`; `ap_add_step` резолвит
  доступную версию — `0.9.0`). Поэтому `skip: true` не поставить. Проверил
  `ap_delete_step` на временной копии `menu`: удаление среднего шага
  **релинкует** родителя к потомку без каскада (`trigger → step_1`), вся
  цепочка цела. Копия удалена; на живом `menu` `step_14` удалён.

## Ревью

- **Ревьюер**: независимый агент (чистый контекст), **дата**: 2026-09-24
- **Вердикт**: есть замечания (одно, `на будущее` — расхождение каталога
  с живой конфигурацией, см. ниже)

### Как проверено

- **Живой проект (MCP).** `ap_flow_structure` `menu` (`1DORFhP9F3W00KpKz5wDw`):
  шага `step_14` нет, `trigger.nextAction = step_1` (подтверждено также
  экспортом: `ap_export_flow` → `trigger.nextAction.name = "step_1"`);
  `ap_flow_structure` `tg-router` (`nyaBzgKGG8TTTsryjc9tW`): у `step_11`
  появилась ветка `menu_cb` (branchIndex 9), в ней `step_22`
  (`answer_callback_query`, `callback_query_id = {{step_1['output'].callbackQueryId}}`,
  `continueOnFailure = true`) и `step_23` (`callFlow menu`, `inline`,
  `waitForResponse: false`, после `step_22`).
- **Экспорт.** `ap_export_flow` по обоим флоу: `menu` = `BTl8TqBftj2zmNhgChZDP`,
  `tg-router` = `IUhunmfHugu5pUFBx6gYR`, оба `state: "LOCKED"`; оба id совпали
  с `flows/_manifest.json`. В `menu` нет ни `answer_callback_query`, ни
  ссылок на `step_14` (проверено и в `flows/menu.json`); в `tg-router`
  `step_22` действительно с `continueOnFailure: true`, `step_23` с `menu:bcast_help`.
- **Различающие прогоны (не со слов владельца, `ap_get_run`):**
  - `uniLltD3MbbOVefDgsVmg` — апдейт-колбэк `menu:bcast_help`:
    `step_10` `route: menu_cb` → `step_11` ветка `menu_cb` (branchIndex 10 true)
    → `step_22` ❌ 400 (синтетический `id`, ожидаемо, `continueOnFailure`)
    → `step_23` ✅ 0,8 с; меню-прогон `xPuAj1RfA6D08xUKZlvP6` отдал
    инструкцию `bcast.howto.*`. Это пара «колбэк → ack-ветка»;
  - `3grVhDwPT3g8AhIugMHrP` — `message.text = /start`: `step_10` `route: menu`
    → `step_11` ветка `menu` (branchIndex 4) → `step_15` ✅ 1,0 с; шага ack
    в прогоне нет. Контрольная пара — на колбэке маршрут `menu_cb`, на
    `/start` — `menu`, чего старый код (один `route: menu` на оба входа)
    не давал.
  - Меню само ack не зовёт: последние `menu`-прогоны (`hbK0K1BGeQWpiTZrX8eQZ`,
    `xPuAj1RfA6D08xUKZlvP6` и др., 0,7–0,9 с) идут `step_1 → step_2 → step_3
    → step_8…step_11 → step_12`, без шага между `step_3` и `step_8`.
- **`ap_validate_flow`:** `menu` — 14/14, `tg-router` — 24/24, без новых
  замечаний.
- **Офлайн:** `tools/check-texts.py i18n/ru.json flows/*.json` — 29 флоу,
  254 пары, 0 расхождений (exit 0); `tools/check-commands.py flows/*.json` —
  0 нарушений (exit 0); `tools/check-export-secrets.sh` — чисто (exit 0).
  Короткой формы `{{VAR}}` в `flows/` и `catalog/` нет (`grep` по
  `BOT_TOKEN`/`QR_SIGNING_KEY`/`MINIAPP_URL` — пусто), `ap_validate_flow`
  это подтверждает.
- **`tools/check-migrations.py` не запущен:** ключа платформы нет ни в
  `QADAM_API_KEY`, ни в Keychain (exit 2). Синхронность манифеста закрыта
  экспортом (`ap_export_flow` отдал ровно те `publishedVersionId`, что в
  `flows/_manifest.json`, оба `LOCKED`) — то же доказательство, что и у скрипта.
- **Состояние версии:** я **не** запускал `ap_test_flow`, поэтому DRAFT
  не вносил; оба флоу живьём `LOCKED`, переопубликация владельцу не нужна.
- **Оговорка о ветке:** рабочая копия — на `w100-telegram-pin-migration`
  (HEAD `2465431`), W99 лежит ниже (`a4c7258`); живой проект уже содержит
  перепривязку W100, но она не трогает логику W99 — ветка `menu_cb`,
  `step_22`/`step_23` и удалённый `step_14` проверены в текущем живом
  состоянии.

### Замечания

1. **на будущее** Каталог подчищает `callbackQueryId` там, где живая
   конфигурация его ещё несёт. В W99 из `catalog/flows/menu.md` убран
   `callbackQueryId` из списка полей триггера, а из `catalog/flows/tg-router.md`
   — из полей, которые `step_15` передаёт в меню (`catalog/flows/tg-router.md:79`).
   Живьём: триггер `menu` по-прежнему объявляет `callbackQueryId`
   (`ap_flow_structure`, `exampleData`), а `step_15` и `step_23` продолжают
   его передавать (`ap_export_flow` → `flowProps.payload.callbackQueryId`).
   Поле теперь не читается (`menu` его не использует), так что рантайму это
   не вредит; но каталог перестал совпадать с реальностью по списку полей —
   ровно то, что п. 2 чек-листа требует держать синхронным. Привести в
   порядок дёшево: либо вернуть поле в каталог как есть, либо (чище) убрать
   мёртвый проброс из `step_15`/`step_23` отдельным пакетом с публикацией.
   Чинить сейчас, в рамках W99, не обязательно.

### AppSec

- **4.1 Авторизация/IDOR — не относится:** пакет не трогает проверки прав;
  `menu_cb` ничего не даёт и не расширяет доступ (видимость кнопок овнера
  по-прежнему по строке `staff`, авторизация — в `manage-api`).
- **4.2 Криптография — не относится:** HMAC/подписей в пакете нет; короткой
  формы `{{VAR}}` нет (проверено).
- **4.3 Инъекции:** `answer_callback_query` пользовательского текста не
  содержит (`show_alert: false`), в разметку ничего не подставляется;
  `format` у отправки меню задан явно (`None`, онбординг — `MarkdownV2`).
  Не задето правкой.
- **4.4 Утечки:** новых полей ПД не появляется; `callbackQueryId` — не
  секрет и не ПД.
- **4.5 Устойчивость:** `step_22` с `continueOnFailure` — правильный выбор:
  недоставленный ack не валит рендер меню, что и подтвердил прогон.
- Секретов в шагах/каталоге/экспорте нет (`check-export-secrets.sh`).

### Ответ владельца

1. **на будущее — исправлено (каталог).** Вернул `callbackQueryId` в
   `catalog/flows/menu.md` (поля триггера) и в `catalog/flows/tg-router.md`
   (список полей, что `step_15` передаёт в меню) — как в живой конфигурации.
   Мёртвый проброс из `step_15`/`step_23` не убирал: это отдельная правка
   флоу с публикацией, поле рантайму не мешает.

## Хвосты и блокеры

- Мёртвый проброс `callbackQueryId` из `tg-router/step_15`/`step_23` (меню его
  больше не читает) — косметика, при следующем касании `tg-router`.

## Закрытие

- **2026-09-24 — готов.** Независимое ревью: одно замечание `на будущее`
  (каталог подчистил `callbackQueryId`) — исправлено возвратом поля в каталог.
  Логика, рантайм и безопасность чисты; оба флоу живьём `LOCKED`.
