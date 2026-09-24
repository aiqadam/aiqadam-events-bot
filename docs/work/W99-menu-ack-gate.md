# W99. Ack колбэка меню вынесен из `menu` в `tg-router`

- **Статус**: на проверке
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
- [ ] Независимое ревью

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

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- Независимое ревью не запущено.
