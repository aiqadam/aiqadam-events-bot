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
  (missing/extra пусты), топология (parent/relationship, `continueOnFailureBranches`)
  и `sourceCode` идентичны. Отличия — `qadamVersion` (0.8.0→0.9.0,
  0.0.21→0.0.22, 0.11.9→0.12.0), дефолты платформы на пересозданных шагах
  (`answer_callback_query`: `show_alert:false`; `dedup-report/step_7`:
  `disable_notification/protect_content/web_page_preview:false`), и
  пере-сериализация: сброс `exampleData` триггера `reg-profile` к
  `{"sampleData":{}}` (живой такой же, гоча #19), `schemaVersion` 31→32,
  поля `notes`/`backupFiles` (MCP-снимок), пропажа `auth` в снимке
  `reg-afterword/step_10` (MCP-экспорт не пишет `auth`; живой `auth` на месте).
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

- **Ревьюер**: агент (review-agent, чистый контекст), **дата**: 2026-09-24
- **Вердикт**: есть замечания

### Замечания

1. **важно** — `staff-accept`: живая текущая версия — **DRAFT** `BLlc5yNIFIfbY3pXF34rC`,
   созданная тестовым прогоном `QaHJ0jzmMOUjihOQMl8WV` в 07:51:24Z, то есть
   **после** снятия снимка (12:49). При этом `flows/_manifest.json`,
   `flows/staff-accept.json` и строка `migrations` фиксируют опубликованную
   `t49krbUz3SMgSyso3BjVL`. Это гоча #14: `ap_test_flow` после публикации
   пишет sample-данные и переводит версию в DRAFT. Опубликованная версия и
   репозиторий согласованы (прод не затронут), но `_manifest.json` ↔ живой
   `ap_export_flow` расходятся, и следующий агент откроет не тот слой, что
   закоммичен. Лечение по гоче: `ap_lock_and_publish` `staff-accept` заново и
   экспорт сразу после неё (обновив `_manifest.json` и `migrations`), либо
   явно зафиксировать, почему черновик оставлен. Среди 15 флоу расхождение
   только у `staff-accept` — `menu` после теста остался LOCKED и совпал.

2. **на будущее** — в журнале сказано «отличия — только `qadamVersion` плюс
   дефолты платформы», но дифф содержит ещё: сброс `exampleData` триггера
   `reg-profile` к `{"sampleData":{}}` (живой триггер такой же — это sample-данные,
   на рантайм не влияют, гоча #19); `schemaVersion` 31→32 и поля
   `notes`/`backupFiles` в `bcast-unsub`, `reg-consent-pdn`, `reg-afterword`;
   `auth` исчез из снимка `reg-afterword/step_10`, потому что снимок снят
   MCP-экспортом. Всё это — пере-сериализация платформы и sample-данные, не
   логика; в журнале их стоит назвать, чтобы «только версии» не читалось буквально.

3. **на будущее** — `reg-afterword` переведён со REST-снимка на MCP (`source: mcp`),
   и его снимок потерял `auth` у `step_10`. ADR-0021 это допускает, живой `auth`
   на месте (проверено `ap_flow_structure includeInput`), но снимок стал беднее
   прежнего. Нужен полноценный снимок с `auth` — снимать REST-экспортом при наличии ключа.

4. **на будущее** — `tools/check-export-secrets.sh` теперь отчитывается
   «все 0 полей `auth`»: на MCP-снимках проверка `auth`-полей вакуумна (их там
   нет по определению). Токен-паттерн и hex-проверка по-прежнему работают;
   сужение — только для проверки connection-ссылок.

### Как проверено

- `ap_validate_flow` по всем **29** флоу проекта — чисто, ни одного
  «Unavailable Qadam Versions» (в т.ч. `reg-api` — 39 valid + 1 skipped,
  известный W60).
- Опись версий по `flows/*.json`: `qadam-telegram-bot` только `0.9.0` (66 шагов),
  `qadam-crypto` только `0.0.22` (3), `qadam-http` только `0.12.0` (1); старых
  `0.8.0`/`0.0.21`/`0.11.9` нет ни в одном флоу.
- Побайтовое сравнение дерева `git show HEAD~1:flows/<f>.json` ↔ `flows/<f>.json`
  по 15 флоу: **68** изменений `qadamVersion` (2+6+14+3+1+4+2+1+4+5+14+5+1+4+2 —
  совпадает с журналом и со счётчиками в `migrations.note`); топология
  (parent/relationship, включая `continueOnFailureBranches` — `reg-profile`
  step_9/15/25/37, `reg-start` step_18→19, `manage-api` step_34→35) **идентична**
  во всех 15; ни один `sourceCode` не изменён.
- Целостность ссылок: скрипт собрал все `{{stepX[...]}}` по 15 флоу — ни одной
  ссылки на несуществующий шаг (единственное «missing: variables» — ложное
  срабатывание регулярки на длинной форме `{{variables['...']}}`).
- Свежесть снимков: живой `ap_export_flow` по `bcast-unsub`, `reg-afterword`,
  `menu` — `flows[0].id` = `publishedVersionId` манифеста, `state: LOCKED`,
  версии `0.9.0`; `staff-accept` — расхождение (замечание 1).
- `migrations`: 15 строк `package: W100` `action: publish`, `version_id` каждой =
  `publishedVersionId` манифеста.
- Живые прогоны прочитаны: `zXpkNx66CQ0GY27ZUMoCB` (tg-router `/start` → меню
  доставлено), `1EXh4zPs0SsyM0YED8w3B` (menu, `send_text_message` 0.9.0, 200),
  `QaHJ0jzmMOUjihOQMl8WV` (staff-accept: `hash-text@0.0.22` дал SHA256,
  «Ссылка не найдена.» доставлена, 200).
- Офлайн: `tools/check-texts.py` (29 флоу, 254 пары, 0 расхождений),
  `tools/check-commands.py` (0), `tools/check-export-secrets.sh` (0 токенов,
  0 hex, переменные как ожидалось) — все exit 0.
- AppSec: дифф не добавляет ни секретов, ни URL, ни новых `auth`/значений;
  изменены только версии, платформенные дефолты и sample-данные. Логику
  авторизации, криптографии и фильтров пакет не трогает (это же подтверждает
  неизменный `sourceCode` и неизменные `input` кроме версий/дефолтов).
- `tools/check-migrations.py` и `tools/export-flows.sh` запустить не удалось —
  нет ключа платформы (`QADAM_API_KEY`/Keychain), как в ревью W4/W8; сверка
  манифеста сделана через живой `ap_export_flow` + таблицу `migrations`.

### Ответы владельца

1. **важно — исправлено.** `staff-accept` переопубликован (`ap_lock_and_publish`),
   снимок переснят MCP-экспортом сразу после: `flows/staff-accept.json` не
   изменился (содержимое черновика совпадало), `_manifest.json` и строка
   `migrations` `2026-09-24-w100-14` указывают на новую опубликованную версию
   `BLlc5yNIFIfbY3pXF34rC`. Расхождение манифеста с живым устранено.
   Причина — мой же тестовый прогон (`QaHJ0jzmMOUjihOQMl8WV`) после снятия
   снимка (гоча #14); впредь тесты не запускать между publish и экспортом.
2. **на будущее — названо.** Дифф действительно шире «только версий»:
   пере-сериализация MCP-снимка (`schemaVersion` 31→32, `notes`/`backupFiles`,
   сброс `exampleData` триггера `reg-profile` — гоча #19) и пропажа `auth` в
   снимке. Дописано в «Как проверено».
3. **на будущее — принято.** Снимок `reg-afterword` стал MCP (`source: mcp`) и
   без `auth`; живой `auth` на месте. Полноценный REST-снимок с `auth` —
   когда будет ключ платформы (общий хвост всего репозитория, не W100).
4. **на будущее — принято.** На MCP-снимках `check-export-secrets.sh` не видит
   `auth`-полей; токен-паттерн и hex-проверка работают. Проявилось от перехода
   на MCP-экспорт (Q38/ADR-0021), не дефект W100.

## Хвосты и блокеры

- Повторное независимое ревью после исправления замечания 1 не запущено.
