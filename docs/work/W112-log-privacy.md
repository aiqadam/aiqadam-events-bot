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
- **Диф.** `logOutput: false` на заявленных точках; в `tg-router` —
  платформенная пере-сериализация `propertySettings.flowProps` у двух
  `callFlow` (поведение не меняется). Единственная незаявленная правка —
  комментарий `reg-consent-pdn/step_2.sourceCode` (добавлена запятая; код и
  поведение те же): живой проект уже нёс этот вариант, экспорт привёл
  репозиторий к нему. Нормализованный диф живого экспорта с `flows/*.json` — 0.
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

- **Ревьюер**: review-agent (независимый, чистый контекст) · **Дата**: 2026-09-28 · **Вердикт**: есть замечания

### Замечания

1. **важно** — Описание дифа в журнале не совпадает с коммитом (источник: `git show 2c276b1`). Заявлено
   «посторонних правок нет» и «новый `sampleData` триггера» в `tg-router`, но пофайловый рекурсивный
   дифф старой и новой версий даёт ровно: `logOutput: false` на заявленных точках (25), плюс в
   `tg-router` — добавленные `propertySettings.flowProps` у двух `callFlow`, плюс **незаявленная правка
   `sourceCode` у `reg-consent-pdn/step_2`** (в комментарии добавлена запятая: «JSON.stringify, и кавычка
   …»; код и поведение не изменились), а `sampleData` триггера `tg-router` в коммите **не менялся**.
   Почему важно: молчаливая правка `sourceCode` опубликованного флоу в пакете, заявленном как «только
   `logOutput`», — ровно тот класс расхождений, который журнал обязан называть (гоча №16 — частичный
   `sourceCode` опасен). Чинить дёшево: либо строка в журнал, либо вернуть комментарий. Не блокер —
   живой проект и `flows/*.json` совпадают (нормализованный дифф = 0), функционально строка инертна.
   - *Исправлено*: журнал приведён к реальному диффу — `sampleData` убран,
     правка комментария `reg-consent-pdn/step_2` названа (живой уже нёс этот
     вариант, экспорт привёл репозиторий к нему) (2026-09-28).

2. **на будущее** — Цель «убрать ПД из сохраняемых run-логов» достигнута лишь частично, и хвост в журнале
   назван уже́, чем он есть. Цензурируется только **вывод** полных строк; входы шагов (`logInput` включён)
   и триггеры/входы вызываемых флоу по-прежнему пишут ПД в лог: например, вход `tg-router/step_6` несёт
   `firstName`/`lastName`/`username`, а `reg-start`, `menu`, `reg-profile`, `reg-consent-*` получают
   `firstName`/`lastName`/`telegramId`/телефон через `flowProps`. Журнал перечисляет хвостом только шаги с
   проекцией `columns` — зафиксировать и остаток (OPEN-QUESTIONS/бэклог), иначе приватность логов будет
   читаться как закрытая. Новых утечек и секретов пакет не вносит (см. ниже).
   - *Принято*: остаток (`logInput` включён, входы шагов/вызываемых флоу)
     зафиксирован в «Хвостах» как отдельное расширение; цель W112 по
     ADR-0044 п. 3.4 — выводы/триггер, а не полная приватизация (2026-09-28).

### Что проверено и сошлось

- **Живой `events-dev` (MCP), все 11 флоу.** `logOutput: false` стоит ровно на заявленных точках
  (`[LOG OFF: output]` в `ap_flow_structure` + поле в экспорте): `tg-router` trigger/`step_6`,
  `bcast-run` `step_32`/`step_40`, `bcast-unsub` `step_2`/`step_6`, `checkin-api` `step_8`,
  `fn-find-registration` `step_2`, `reg-api` `step_11`/`12`/`14`/`18`/`19`/`22`,
  `reg-consent-mkt` `step_3`, `reg-consent-pdn` `step_4`/`step_5`, `reg-profile`
  `step_13`/`22`/`23`/`29`/`35`, `staff-accept` `step_2`/`step_7`, `staff-invite` `step_14`.
  Посторонних шагов с `logOutput: false` нет; `skip` (`reg-api/step_12` — `true`) и входы не задеты.
- **Множества шагов до/после не изменились** (сверка с `2c276b1^`): tg-router 28, bcast-run 53,
  bcast-unsub 8, checkin-api 16, fn-find-registration 5, reg-api 46, reg-consent-mkt 11,
  reg-consent-pdn 18, reg-profile 40, staff-accept 13, staff-invite 16 — missing/extra пусты и совпадают
  с числом шагов в `ap_validate_flow`.
- **`ap_validate_flow` всех 11 — valid**, числа совпадают с журналом (reg-api: 45 valid, 1 skipped);
  недоступных пинов в структуре не отмечено.
- **Версии опубликованы и совпадают:** `flows[0].id` живого `ap_export_flow` = `publishedVersionId`
  `flows/_manifest.json` = `version_id` строк `migrations` `2026-09-28-w112-01..11` (commit `2c276b1`,
  `object_id` = flowId), `state: LOCKED`. Все 11 сверены.
- **Нормализованный дифф живого экспорта и `flows/*.json` = 0 расхождений** (форма
  `tools/export-flow-mcp.py`) — проверено на четырёх самых сложных: `bcast-run`, `reg-api`,
  `reg-profile`, `tg-router` (включая пере-сериализацию `propertySettings`).
- **Офлайн (сам):** `check-export-secrets.sh` — 0; `check-texts.py` — 0 (285 ссылок);
  `check-commands.py` — 0; `check-agents.py` — 0; `node prototypes/check.mjs` — OK.
- **AppSec:** новых URL/секретов/полей не появилось; экспорт чист (токен и ключ — ссылками
  `{{variables[...]}}`, connections — `connectionIds`/`{{connections[...]}}`). Правка носит
  приватность-улучшающий характер.
- **Цена названа верно:** не ретраится именно прогон с зацензуренным **trigger-output** (`tg-router`),
  шаговые цензуры ретрай не ломают — соответствует гоче №21 и ADR-0044 п. 3.4.
- `ChatBot` (чужой платформенный, Q34) в инстансе — известный внепакетный хвост, к W112 не относится.
- «Ревью» в чек-листе BACKLOG остаётся последним неотмеченным пунктом — верно, до исправления замечания 1.

## Хвосты и блокеры

- Шаги с проекцией `columns` (в т.ч. содержащей ПД) не приватизированы —
  возможное расширение W112.
- **`logInput` включён:** входы шагов (в т.ч. `telegram_id`, имена, телефон) и
  входы вызываемых флоу (`reg-start`, `menu`, `reg-profile`, `reg-consent-*`)
  по-прежнему пишутся в run-лог. Остаток приватности — отдельное расширение
  (ревью W112, «на будущее»).
- Перенос на prod — отдельным хотфиксом (ADR-0042).
