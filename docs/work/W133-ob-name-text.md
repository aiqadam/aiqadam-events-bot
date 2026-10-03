# W133. Онбординг: имя текстом без нажатия «Написать имя»

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W107/W119 (онбординг C) — ✅
- **Начат**: 2026-10-03 · **Закрыт**: —

## Цель

Свободный ввод имени на шаге `ob_name` принимается как `text_name`. Подробности — в BACKLOG.md, дублировать не надо.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `tg-router` (dev) | `5rpOArwaUifCX6IYF4IEQ` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `reg-profile` (dev) | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

## Чек-лист готовности

> Скопировать из [BACKLOG.md](../BACKLOG.md) и отмечать по мере прохождения.
> Плюс обязательный пункт для всех пакетов.

- [ ] `tg-router/step_10`: текст при `sessionStep = ob_name` ведёт в `reg_profile`, а не в `menu`-фолбэк; остальные шаги — как раньше
- [ ] `reg-profile/step_3`: текст на `ob_name` возвращает `text_name`
- [ ] различающие прогоны на dev (позитив + мусор + регресс)
- [ ] `ap_validate_flow` обоих флоу, публикации, экспорт `flows/*.json`, строки `migrations`
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

> Чем именно, а не «протестировано». Фикстуры, отрицательные сценарии, что видел на экране.

- `ap_validate_step_config` (CODE) обоих новых кодов до применения — valid 2/2;
- `ap_read_step_code` после `ap_update_step` — оба шага лежат побайтово как отправлено (сверены ханки W133, усечений нет);
- логические матрицы на точных копиях кода (`node`, 6+8 кейсов, все PASS):
  `reg-profile/step_3`: `ob_name` + «Александра Друккер» → `text_name`,
  `ob_await_name` + имя → `text_name`, `ob:fixname` → `show_ask_name`,
  текст на `ob_consent`/`ob_city` → `ignore`, `ob:agree` → `consent_namecheck`;
  `tg-router/step_10`: текст на `ob_name`/`ob_await_name`/`ob_await_work` → `reg_profile`,
  текст на `ob_consent`/`ob_city`/без сессии → `menu` + `fallback=true`,
  колбэки `ob:fixname`/`ob:agree` → `reg_profile`;
- живой TESTING на dev недоступен (см. находку ниже) — вместо `ap_test_step`
  доказательство составное: валидатор + побайтовый read-back + матрицы +
  опубликованные LOCKED-экспорты с новым кодом внутри;
- `ap_validate_flow`: `reg-profile` 40/40 valid, `tg-router` 28/28 valid
  (предупреждения о пинах `tables@0.4.5/0.4.6` — до пакета, живые прогоны идут);
- публикации dev: `reg-profile IotKaHI804eW07IvimapP`, `tg-router zed7ldrfwv9gzCRo6dq2N`;
  экспорт MCP сразу после публикаций (`state: LOCKED`), `flows/*.json` +
  `_manifest.json` обновлены тем же изменением;
  коммит `11cf057`, строки `migrations 2026-10-03-w133-01/02`
  (`a7LpiTZ0gP7mKNX1quJhF`, `EHIAomiwcGoIUGARPVyKl`);
- `check-texts.py` — 31 флоу / 305 ссылок `$t` / 0 расхождений;
  `check-commands.py` — 0 нарушений; `check-export-secrets.sh` — чисто;
- таблицы dev чисты: `telegram_id 644000133` в `users`/`sessions` — пусто;
  флоу dev — 31/31, временного `zz-w133-proof` нет (создан-удалён);
- живой e2e в Telegram — не прогонялся (хвост на владельца).

## Журнал

> По ходу работы. Почему сделано так, что не сработало, где потеряно время.

- **2026-10-03** — взят с живого скриншота владельца (prod, пользователь «Саша» → «Александра Друккер» в петле). Разбор по прод-прогонам: `tg-router 2NoVVOBljcIvMq64zLSbG` — текст дошёл до роутера, ушёл в `route: menu, fallback: true` при `sessionStep: ob_name`. Двойная калитка: W73-ветка роутера пропускает только `ob_await_*`, `reg-profile/step_3` принимает текст только на `ob_await_name`. Фикс — минимальный, обе калитки: роутер ведёт текст с `ob_name` в `reg_profile`, `step_3` отдаёт `text_name` и на `ob_name`. Кнопка `ob:fixname` остаётся рабочей (второй путь к тому же `text_name`). Ветка `w133-ob-name-text`, правки только на dev.
- **2026-10-03** — правки применены (`reg-profile/step_3`, `tg-router/step_10`, dev, последовательно через `ap_validate_step_config` → `ap_update_step`), обе опубликованы. Находка: dev-TESTING сломан целиком — `ap_test_step`/`ap_test_flow` отвечают `INTERNAL_ERROR` без шагов даже на нетронутых шагах (проверено на `tg-router/step_1`), свежий флоу из вебхука и чистых CODE-шагов — тоже. 27.09 TESTING-прогоны ещё шли; валидатор теперь помечает пины `tables@0.4.5/0.4.6` как недоступные на инсталляции (PRODUCTION-прогоны при этом идут — 01.10 успешно). Живые различающие прогоны заменены связкой валидатор + read-back + node-матрицы + LOCKED-экспорты; в журнал записано честно, ревьюеру — учесть. Временный `zz-w133-proof` удалён, следов нет.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

- нет

## Хвосты и блокеры

- живой e2e в Telegram — на владельца (dev-бот);
- перенос на prod — отдельным хотфиксом по ADR-0042 после приёмки;
- `tools/check-migrations.py` — нужен ключ платформы (если недоступен — хвост на W15, как у других пакетов);
- dev-TESTING сломан (все `ap_test_step`/`ap_test_flow` — `INTERNAL_ERROR`, пины `tables@0.4.5/0.4.6` недоступны) — чинить инсталляцию отдельно, пакету не блокирует (PRODUCTION идёт).
