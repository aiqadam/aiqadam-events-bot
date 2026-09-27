# W112. Приватизация run-логов (`logOutput: false`)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (следствие [W108](W108-platform-novelties.md), [ADR-0044](../adr/0044-platform-novelties-sep-2026.md) п. 3.4)
- **Зависит от**: —
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Убрать персональные данные из сохраняемых run-логов: `logOutput: false` на
триггере, несущем Telegram-апдейт (контакт/`initData`), и на шагах, чей вывод —
**полная строка** таблиц `users` / `registrations` / `staff_invites`. Значение
всё равно течёт дальше по флоу — цензурируется только запись в лог
([ADR-0005](../adr/0005-secrets-visible-in-run-logs.md), закрывается частично).

## Что построено

`logOutput: false` на 25 точках (24 шага + триггер) в 11 флоу:

| Флоу | flowId | Точки |
|------|--------|-------|
| `tg-router` | `5rpOArwaUifCX6IYF4IEQ` | trigger `new_telegram_message`, `step_6` |
| `bcast-run` | `By03Fpx1pPqJTdaQlhYsQ` | `step_32`, `step_40` |
| `bcast-unsub` | `WVEZojRTZfntv22NA5geM` | `step_2`, `step_6` |
| `checkin-api` | `fcz4H9JeR2rdLm797nBH8` | `step_8` |
| `fn-find-registration` | `2tUdR4D92NJB4f0kVgtAf` | `step_2` |
| `reg-api` | `SmutybV5qJQjQASJGY9vi` | `step_11`, `step_12`, `step_14`, `step_18`, `step_19`, `step_22` |
| `reg-consent-mkt` | `uOKODGfZjyhNbED320cjz` | `step_3` |
| `reg-consent-pdn` | `UgAeyhpI29ndjM4EM3gxf` | `step_4`, `step_5` |
| `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | `step_13`, `step_22`, `step_23`, `step_29`, `step_35` |
| `staff-accept` | `AaeNjEGoYC7vQOL57OLx0` | `step_2`, `step_7` |
| `staff-invite` | `S1DNFpjCsKyFTWN0T3u31` | `step_14` |

## Критерий отбора

Взяты **все** шаги, чей вход/вывод — строка `users`/`registrations`/
`staff_invites` **целиком** (без пропа `columns`), а также триггер
`tg-router`. Шаги с проекцией `columns` не тронуты: они и так ограничивают
выдачу; сплошная приватизация всех чтений этих таблиц — возможное расширение
(хвост). `ap_update_step` с одним `logOutput` не затирает вход шага (гоча №21:
теперь несёт сохранённые `skip`/`logInput`/`logOutput`).

## Чек-лист готовности

- [x] триггер `tg-router` с Telegram-апдейтом — `logOutput: false`;
- [x] шаги с полной строкой `users`/`registrations`/`staff_invites` —
      `logOutput: false` (24 шага, 11 флоу);
- [x] `ap_validate_flow` по всем 11 флоу — valid, недоступных пинов нет;
- [x] флоу опубликованы, экспорт MCP обновлён;
- [x] `catalog/` совпадает с живым проектом;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- **Живой инстанс (`events-dev`, MCP).** `logOutput: false` выставлен на
  перечисленных точках; `ap_validate_flow` — 53/53 (`bcast-run`), 8/8
  (`bcast-unsub`), 16/16 (`checkin-api`), 5/5 (`fn-find-registration`), 46
  (45 valid, 1 skipped — `reg-api`), 11/11 (`reg-consent-mkt`), 18/18
  (`reg-consent-pdn`), 40/40 (`reg-profile`), 13/13 (`staff-accept`), 16/16
  (`staff-invite`), 28/28 (`tg-router`). Все 11 опубликованы, экспорт снят
  сразу после публикации (гоча №14), `state: LOCKED`.
- **Дерево не сломано.** Сравнение множеств шагов `HEAD:flows/<f>.json` и
  рабочего файла по всем 11 флоу: missing/extra пусты, число шагов совпадает.
- **Диф.** Только `logOutput: false` (+ в `tg-router` — платформенная
  пере-сериализация `propertySettings.flowProps` у двух `callFlow` и новый
  `sampleData` триггера; поведение не меняется). Посторонних правок нет.
- **Офлайн:** `check-export-secrets.sh` — чисто; `check-texts.py` — 0;
  `check-commands.py` — 0; `check-agents.py` — 0; `prototypes/check.mjs` — OK.

## Цена (названа прямо)

Прогон с **зацензурированным trigger-output не ретраится** (обе стратегии
`ap_retry_run` отказывают `VALIDATION`, гоча №21) — теперь это верно для
любого прогона `tg-router`. Цензурирование **шаговых** выводов на
ретраи не влияет. Цена принята [ADR-0044](../adr/0044-platform-novelties-sep-2026.md)
п. 3.4: приватность важнее ретрая роутера (сам роутер только делегирует).

## Журнал

- **2026-09-28** — критерий «полная строка» выбран, чтобы пакет был обозрим:
  сплошное `logOutput: false` на всех ~60 касаниях трёх таблиц — отдельное
  расширение. Шаговые цензуры не влияют на ретрай, поэтому риск только у
  триггера.
- **2026-09-28** — `tg-router` уже правился пакетами W99/W108/W114; ветка от
  свежего `main` после W109, конфликтов нет.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Шаги с проекцией `columns` (в т.ч. содержащей ПД) не приватизированы —
  возможное расширение W112.
- Перенос на prod — отдельным хотфиксом (ADR-0042).
