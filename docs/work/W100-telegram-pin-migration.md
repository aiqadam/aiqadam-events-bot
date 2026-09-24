# W100. Перепривязка шагов с недоступных версий qadam'ов

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн — попутная находка W99, решение владельца в чате
- **Зависит от**: W99 (ак колбэка меню; та же причина — пин на недоступную версию)
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

На инстансе больше нет `qadam-telegram-bot@0.8.0` (доступна `0.9.0`), а также
`qadam-crypto@0.0.21` (`0.0.22`) и `qadam-http@0.11.9` (`0.12.0`). На старые
версии пинованы шаги во многих флоу. Прогоны работают (рантайм резолвит qadam
по имени), а `ap_update_step` по такому шагу падает `qadam_metadata_not_found`
— редактировать нельзя. Перепривязать все такие шаги на доступные версии.

## Что построено

Перепривязаны 68 шагов в 15 флоу: `bcast-draft`, `bcast-run`, `bcast-step`,
`bcast-unsub`, `dedup-report`, `manage-api`, `menu`, `reg-afterword`,
`reg-consent-mkt`, `reg-consent-pdn`, `reg-profile`, `reg-start`, `reminders`,
`staff-accept`, `staff-invite`. Затронуты три qadam'а: telegram-bot, crypto,
http. Живое состояние — [catalog/overview.md](../../catalog/overview.md),
карточки флоу — [catalog/flows/](../../catalog/flows/).

## Чек-лист готовности

- [x] Все PIECE-шаги во флоу проекта пинованы на доступную версию
      (`ap_validate_flow` по каждому из 15 флоу — без «Unavailable Qadam Versions»)
- [x] `ap_validate_flow` по каждому флоу чист
- [x] `catalog/` совпадает с живым проектом
- [ ] Независимое ревью

## Как проверено

- **Опись.** `ap_validate_flow` по всем 29 флоу: недоступные пины нашлись в
  15 флоу — `qadam-telegram-bot@0.8.0` (64 шага), `qadam-crypto@0.0.21`
  (3 шага: `staff-accept/step_1`, `staff-invite/step_11`,`step_12`),
  `qadam-http@0.11.9` (1 шаг: `manage-api/step_35`). Итого **68 шагов**.
- **Способ.** `ap_delete_step` + `ap_add_step` для каждого шага; имена при
  добавлении переиспользуются (`step_N` = наименьший свободный), поэтому
  ссылки `{{stepX[...]}}` не рвутся. Для шагов с `continueOnFailure`, у
  которых ветка On-failure содержит цепочку, ветка пересобирается целиком
  (удаление такого шага уносит и её). Для дыр в нумерации (`reg-afterword`
  #7, `reg-profile` #34) номер «занимался» временным CODE-шагом, чтобы
  переиспользование досталось исходному имени.
- **Сверка дерева до/после.** Побайтовый разбор `git HEAD:flows/<f>.json` и
  рабочего `flows/<f>.json` по всем 15 флоу: множества шагов совпадают
  (missing/extra пусты), отличия — только `qadamVersion` (0.8.0→0.9.0,
  0.0.21→0.0.22, 0.11.9→0.12.0) плюс дефолты платформы на пересозданных
  шагах (`answer_callback_query`: `show_alert:false`; `dedup-report/step_7`:
  `disable_notification/protect_content/web_page_preview:false`).
- **Живые прогоны.** `tg-router` `/start` (`zXpkNx66CQ0GY27ZUMoCB`) →
  `menu` на `telegram-bot@0.9.0`, меню отправлено (1,3 с); `staff-accept`
  (`QaHJ0jzmMOUjihOQMl8WV`) → `hash-text@0.0.22` дал SHA256, карточка
  «Ссылка не найдена» доставлена.
- `tools/check-texts.py` (29 флоу, 254 пары, 0 расхождений),
  `tools/check-commands.py` (0), `tools/check-export-secrets.sh` — чисто.

## Журнал

- **2026-09-24** — Находка W99: `menu/step_5`/`step_12` пиновны на 0.8.0,
  `ap_update_step` по ним падает. Живой `ap_flow_structure` `bcast-unsub`
  (`step_1`/`step_5`/`step_7`) подтвердил, что это не про `menu`.
- **2026-09-24** — Полная опись `ap_validate_flow` по 29 флоу: **68 шагов в
  15 флоу** и три qadam'а (telegram-bot 0.8.0, crypto 0.0.21, http 0.11.9).
  Первая оценка «46 шагов / 12 флоу» была неполной — не видел тел циклов и
  веток On-success/On-failure.
- **2026-09-24** — Способ: `ap_delete_step` + `ap_add_step` (имена
  переиспользуются). Проверено на одноразовой копии `bcast-unsub`: удаление
  первого шага, первого шага ветки и шага с `continueOnFailure` — все три
  переиспользовали имя и встали на исходное место. Round-trip
  `ap_import_flow` с поднятой версией тоже работает (проверено), но требует
  вставлять весь JSON флоу и заново проставлять `auth` — выбран `delete`+`add`.
- **2026-09-24** — Ошибка и урок: при удалении `reg-consent-pdn/step_8`
  (у него цепочка On-failure: `step_10`→`step_15`→`step_16`) пропали
  `step_15`/`step_16` — удаление шага уносит и его ветки. Восстановлены из
  git-снимка; дальше ветки с `continueOnFailure` пересобирались целиком
  (`reg-profile` — 6 групп).
- **2026-09-24** — Все 15 флоу опубликованы, снимки сняты MCP-экспортом,
  `_manifest.json` обновлён.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- Независимое ревью не запущено.
