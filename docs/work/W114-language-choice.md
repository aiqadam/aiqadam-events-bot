# W114. Выбор языка: шаг онбординга и переключатель в Mini App

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: v0.1
- **Зависит от**: W25 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: —

## Цель

Дать пользователю **явный** выбор языка (ru/uz/en), а не только наследование из
Telegram: выбор сохраняется в `users.lang`, бот его уважает, Mini App его
переключает.

## Решения владельца (2026-09-27)

1. Бот **уважает сохранённый `users.lang`**: `tg-router` перестаёт перезаписывать
   `lang` из Telegram на каждом апдейте и **читает** `users.lang` в горячем пути;
   `localeSource` `tg-router` указывает на вывод этого чтения (фолбэк —
   `language_code`).
2. Шаг выбора — **первая карточка онбординга** (до согласия/имени), три кнопки
   `ru`/`uz`/`en`; дальше онбординг идёт на выбранном языке.
3. Переключатель языка — **в Mini App** (таб «Профиль»), пишет `users.lang` через
   `reg-api` (`set_lang`); SPA сразу меняет словарь и посылает выбранный язык в
   `ap-parent-run-locale`.

## Чек-лист готовности

- [x] при первом касании человек выбирает язык; выбор записан в `users.lang`
      (живые прогоны: `reg-start`/`menu` строят карточку языка; `reg-profile`
      `set_lang` кладёт `draft.profile.lang`; `users.lang` — в `finish`);
- [x] следующий апдейт бота приходит на выбранном языке (различающие прогоны
      `tg-router/step_27`: `tg=uz`→`uz`, `stored=en`→`en`, `ob:lang:ru`→`ru`);
- [x] `tg-router` не затирает `users.lang` из Telegram (`lang` убран из
      `step_6`, живой прогон: `stored=en` пережил апдейт с `language_code=uz`);
- [x] строки выбора уже есть в `i18n/*.json` (`lang.ask`, `lang.btn.ru|uz|en`,
      `lang.changed`, `menu.btn.language` — корпус W3) и импортированы в
      платформенные переводы (`ap_upsert_translations`, 4 ключа × 3 локали);
- [x] каталог и `flows/*.json` совпадают; строки `migrations` (5 publish);
- [ ] независимое ревью, вердикт «замечаний нет».

## Что сделано

### Данные и `tg-router`

- `step_6` (`tables-upsert-records users`): **убран `lang`** из `values` — выбор
  больше не затирается языком клиента на каждом апдейте.
- Новый `step_27 «effective lang»` (CODE) **после `step_8`**: `lang` =
  колбэк `ob:lang:<xx>` → `users.lang` (из вывода `step_6`, upsert отдаёт все
  ячейки строки) → `draft.profile.lang` (выбор в незавершённом онбординге) →
  `language_code` Telegram. Whitelist `ru|uz|en`.
- `localeSource` флоу = `{{step_27['output'].lang}}` (импортом; отдельной
  MCP-ручки нет — `qadam-flow#562`).

### Онбординг (`reg-start`, `menu`, `reg-profile`)

- `reg-start/step_12`/`menu/step_1` читают `users.lang`; `step_3`/`step_2`
  отдают `needsLang` (пусто → первая карточка — язык).
- `reg-start/step_9`/`menu/step_4` при `needsLang` строят вопрос `lang.ask` с
  тремя кнопками `ob:lang:ru|uz|en` и `sessionStep: 'ob_lang'`; иначе прежняя
  карточка согласия (`ob_consent`). `step_15`/`step_11` (`menu/step_6`/`step_7`)
  пишут этот шаг в черновик и колонку сессии.
- `reg-profile/step_3` парсит `ob:lang:<xx>` на шаге `ob_lang` → `action:
  'set_lang'` (whitelist); `step_4` кладёт язык в `draft.profile.lang` и идёт
  **существующей веткой `card`** — пишет сессию (`ob_consent`) и рисует карточку
  согласия на выбранном языке. `lang` сохраняется через `draft.profile` во всех
  шагах (`consent_namecheck`/`text_name` теперь мержат `prof`, а не заменяют);
  `users.lang` пишут `step_22` (`finish`) и `step_35` (`finish_no_event`).

### Mini App (`reg-api` + SPA)

- `reg-api`: `set_lang` (язык только `ru|uz|en`, требует заполненный профиль)
  идёт веткой `profile_saved`; `step_22` пишет `users.lang`; `profile_get`
  отдаёт текущий `lang`.
- SPA: `getLang()` читает выбор из `localStorage` (перебивает язык Telegram);
  `setLang()` в `lib/i18n.ts` меняет словарь немедленно; переключатель в табе
  «Профиль» (`Events.tsx`), `set_lang` на сервер, тост `lang.changed`; выбор
  синхронизируется из `profile_get.lang`.

### Строки

Новых ключей нет — корпус W3 уже содержал `lang.ask`, `lang.btn.ru|uz|en`,
`lang.changed`, `menu.btn.language`. Импортированы в платформенные переводы
(`lang.ask`, `lang.btn.*` — ru/uz/en).

## Платформенная находка: новые табличные шаги через MCP невозможны

Попытка собрать ветку `lang` с собственным `tables-upsert-records users`
упёрлась в платформу: `ap_add_step`/`ap_build_flow` прибивают шаг к
`tables` **0.4.6**, а его валидатор помечает шаг `invalid` («table_id/
key_columns must be configured in the Qadam Flow UI») — `ap_lock_and_publish`
такой флоу не публикует. Пин **0.4.5** через MCP не выставить (ни
`ap_add_step`, ни `ap_update_step` не принимают версию; `qadamName@0.4.5`
не распознаётся). Существующие 0.4.5/0.4.6-шаги валидны, потому что были
сохранены раньше. Следствие для W114: **ни одного нового табличного шага** —
язык живёт в черновике сессии, `users.lang` пишется существующими
0.4.5-апсертами, а `reg-api/set_lang` переиспользует ветку `profile_saved`.
Это же блокирует W109 (bump `tables` до 0.4.6) — там понадобится либо
UI-конфигурация, либо фикс платформы.

`localeSource` на существующем флоу ставится только `ap_import_flow`
(`ap_build_flow` умеет, но создаёт новый флоу). Импорт снят через MCP-эндпоинт
напрямую (не REST): экспорт → правка `localeSource` → `ap_import_flow`, затем
восстановлены `auth` на `trigger`/`step_15`/`step_22`/`step_26` (экспорт
очищает connection-ссылки). Экспорт после этого нормализовал форму
табличных входов (`table_id`/`key_columns` вынесены из `values`) — отсюда
крупный дифф `flows/tg-router.json`.

## Как проверено

Живые прогоны на dev (TESTING), `ap_get_run` по каждому:

| Что | Прогон | Результат |
|---|---|---|
| `tg-router/step_27`, новый юзер, `language_code=uz` | `VduPDE7KZgb7al6ymCdL3` | `{lang:'uz', stored:'', tg:'uz'}` — фолбэк на язык Telegram |
| `tg-router/step_27`, `users.lang=en`, апдейт `language_code=uz` | `bJaRXDD5siFmferSEOHm7` | `{lang:'en', stored:'en', tg:'uz'}` — сохранённый выбор пережил апдейт |
| `tg-router/step_27`, колбэк `ob:lang:ru` при `stored=en` | `EZ8mAZHzwWXqNXCktAdMU` | `{lang:'ru', pending:'ru'}` — колбэк задаёт локаль прогона |
| `reg-profile` полный прогон, `ob:lang:uz` | `ivZk1Abhqqnrkul4GDpsK` | `step_3` `set_lang uz`; `step_4` `writeKind card`, `draft.profile.lang uz`, `nextStep ob_consent`; `step_5` ветка `card`; `step_8` сессия `ob_consent` с `profile.lang uz` |
| `menu` полный прогон, новый юзер | `NFDYKmCpHuycNiAzs7vF2` | `step_2` `needsLang true`; `step_4` карточка языка (`ob:lang:ru/uz/en`), `sessionStep ob_lang` |
| `reg-start` полный прогон, событие+новый юзер | `fys5tBZ2cUo3qKE2f7Yfe` | `step_3` `needsLang true`; `step_9` карточка события + `lang.ask` + 3 кнопки, `sessionStep ob_lang` |

Прогоны падали только на отправке в фейковый чат (`chat not found`) — логика
до отправки подтверждена. Временное событие, пользователь и сессия удалены
после проверок.

Офлайн: `ap_validate_flow` по всем пяти флоу — чисто (`tg-router` 28/28,
`reg-start` 21/21, `menu` 15/15, `reg-profile` 40/40, `reg-api` 45/46 + 1
skipped); `check-texts.py` 283 ссылки/0; `check-commands.py` 0; `check-export-secrets.sh`
чисто; `miniapp npm run build:dev` — зелёный.

## Журнал

- **2026-09-27** — пакет взят; разбор `reg-start`/`menu`/`reg-profile`/`reg-api`
  и `tg-router`. Ветка от `w25-i18n-platform` (PR #179 смержен).
- **2026-09-27** — **находка при разведке: живой черновик `tg-router` уже нёс
  неопубликованную правку W114** (`step_27`, `state: DRAFT`), без строки в
  журнале/`migrations`/каталоге и без экспорта в репозитории; при этом `step_6`
  ещё писал `lang`, а `step_27` читал `rec.cells` вместо `rec.record.cells`
  (upsert отдаёт `[{action, record:{cells}}]`) — `stored` всегда пуст. Правка
  доведена, а не переизобретена; расхождение живое↔репозиторий закрыто пакетом.
- **2026-09-27** — реализация: `tg-router` (шаг `effective lang` после `step_8`,
  `localeSource`), `reg-start`/`menu`/`reg-profile`/`reg-api`, Mini App.
  Платформенный блокер новых табличных шагов обойдён без единого нового
  табличного шага (см. выше).
- **2026-09-27** — 4 ключа импортированы в платформенные переводы; 5 флоу
  опубликованы; экспорт `flows/*.json`+`_manifest.json` (MCP); 5 строк
  `migrations` (`w114-01…05`).

## Хвосты и блокеры

- **prod** — те же правки при переносе (хотфикс ADR-0042), включая
  `localeSource` и `users.lang`.
- **Живой e2e в Telegram** (карточка языка, ответы бота на выбранном языке,
  переключатель Mini App) — у агента нет телефона; положительный сквозной
  прогон за владельцем (как в W25/W107).
- **MCP-ручка `localeSource`** — запрошена ([qadam-flow#562](https://github.com/aiqadam/qadam-flow/issues/562));
  до неё смена — импортом (через MCP-эндпоинт).
- **`tables` 0.4.6 через MCP** — невалидные новые шаги; блокирует W109.
- **Mini App** — живая проверка переключателя на устройстве за владельцем.

## Ревью

- **Ревьюер**: независимый агент (чистый контекст), **дата**: 2026-09-27
- **Вердикт**: есть замечания (два `важно`, два `на будущее`)

### Замечания

1. **важно** Строки `migrations` пакета W114 несут `applied_at` раньше, чем
   перевыпущенные строки W25, из-за чего `tools/check-migrations.py` выберет
   `last_publish` по W25 и отрапортует расхождение B1 по всем пяти флоу —
   `migrations` строки `w114-01…05`, сверка `tools/check-migrations.py`.
   Записи W114 имеют `applied_at = 2026-09-27T11:26:18Z`, а перевыпуск W25 —
   `2026-09-27T12:00:00Z` (`w25-01/11/16/19`) и `13:00:00Z` (`w25-24`), то есть
   позже по времени в таблице. `last_publish` берёт максимум по `applied_at`
   (тай-брейк — время вставки записи), поэтому «последней публикацией» для
   каждого из пяти флоу окажется версия W25 (`qaaxlm…`/`xserRL…`/`8t8dxc…`/
   `bPnw22…`/`a5XaAf…`), а не `w114` (`tUW8ZG…`/`mivExl…`/`lkpKlw…`/
   `Ftnxj7…`/`l5dllJ…`), и B1 сверит не тот `version_id`. Выполнить сам скрипт
   не смог: ключа платформы нет ни в `QADAM_API_KEY`, ни в Keychain — вывод
   детерминирован алгоритмом (строки 148–156, 303–311 `tools/check-migrations.py`).
   Живой `ap_export_flow` для `menu` и `tg-router` отдаёт ровно
   `publishedVersionId` манифеста, так что расходится не инстанс, а порядок
   строк. Починка — проставить `applied_at` строк W114 позже W25 (или
   поправить round-числа W25 датами фактической публикации).

2. **важно** `set_lang` через ветку `profile_saved` перезаписывает
   `profile_completed_at` и `consent_marketing_at` **текущим временем**, а не
   «теми же значениями», как написано в журнале и в
   `catalog/flows/reg-api.md` — `reg-api/step_22` (значения `EAlXy4Xs…`
   и `3t75byEL…` = `{{step_2['output'].now}}`), журнал W114 «Хвосты»,
   `catalog/flows/reg-api.md` («Минус обхода»).
   Значение согласия при этом сохраняется (берётся из строки пользователя,
   `step_9`), а вот метка времени согласия на рассылку (PAR-2) и метка
   завершения профиля обнуляются и переставляются на «сейчас» при простом
   переключении языка — это не идемпотентная перезапись, как заявлено, а
   изменение аудит-полей. Либо для `set_lang` передавать в `step_22` сохранённые
   `consent_marketing_at`/`profile_completed_at` (расширив проекцию `step_17`),
   либо честно зафиксировать это в журнале/каталоге как цену, а не как
   «idempotent».

3. **на будущее** Приоритет `step_27` проверен различающими прогонами не
   целиком: подтверждены `pending` (`EZ8mAZHz…`), `stored` (`bJaRXDD5…`) и
   `language_code` (`VduPDE7K…`), а ветка `draft.profile.lang` (третий приоритет)
   ни одним прогоном не выигрывала — в доступных прогонах её перекрывали
   `stored`/`pending`. Сама логика читается однозначно, но различающего
   прогона на «нет `pending`, нет `stored`, есть `draft.lang`» в журнале нет.
   (Одновременно: ни один прогон не показывает карточку языка на `uz`/`en` —
   все проверочные прогоны идут на `ru`. По ADR-0045 отсутствующий перевод
   падает на `ru`, а `ap_validate_flow` по всем пяти флоу чист, что косвенно
   говорит о наличии ключей; но для W27/вычитки это стоит увидеть глазами.)

4. **на будущее** Пользователи, заполнившие профиль до W114 (у них `users.lang`
   пуст, но `profile_completed_at` не пуст), карточку языка не увидят:
   `needsLang` вычисляется только в ветке `onboard` (`reg-start/step_3`,
   `menu/step_2`), а повторное касание даёт `register` → `finish_lite`, который
   `lang` не пишет (`reg-profile/step_29…33`). Бот у них остаётся на языке
   Telegram, выбрать язык можно только переключателем Mini App. Если это
   осознанно — стоит сказать в карточке флоу; если нет — нужен догон
   (например, `users.lang` при `finish_lite`).

### Что проверено

- **Живой проект (MCP)**: `ap_validate_flow` — `tg-router` 28/28, `reg-start`
  21/21, `menu` 15/15, `reg-profile` 40/40, `reg-api` 45/46 + 1 skipped; шаги
  и структура совпадают с каталогом и экспортом. CODE-шаги `tg-router/step_27`,
  `reg-start/step_3/9/15`, `menu/step_2/4/6`, `reg-profile/step_3/4`,
  `reg-api/step_2/9` — чистые функции, без сети и записи.
- **Различающие прогоны** (`ap_get_run`): `stored=en` переживает апдейт с
  `language_code=uz` (`bJaRXDD5…`, `step_6` не пишет `lang`); колбэк `ob:lang:ru`
  при `stored=en` задаёт локаль прогона (`EZ8mAZHz…`); новый юзер `tg=uz` даёт
  `uz`; `reg-profile` `ob:lang:uz` → `action set_lang`, `draft.profile.lang=uz`,
  `step ob_consent` (`ivZk1Abh…`); `menu`/`reg-start` строят карточку языка
  (`NFDYKmCp…`, `fys5tBZ2…`). Временные событие/пользователи/сессии удалены —
  проверил чтением таблиц (`w114testevt`, `999000111/222/333` — нет).
- **Живой «menu» и «tg-router»** через `ap_export_flow`: `flows[0].id` =
  `publishedVersionId` манифеста, `state: LOCKED`, `localeSource` `tg-router` =
  `{{step_27['output'].lang}}`. Строки `w114-01…05` в `migrations` совпадают с
  манифестом по `object_id`/`version_id` (кроме порядка `applied_at`, п. 1).
- **Офлайн**: `check-texts.py` 283 ссылки/0, `check-commands.py` 0,
  `check-export-secrets.sh` чисто, `miniapp npm run build:dev` зелёный.
- **AppSec**: `telegram_id`/`lang` в `set_lang` берутся из проверенного
  `initData`, язык сужается до `ru|uz|en` в `reg-api/step_9` и
  `reg-profile/step_3`; `ob:lang:*` обрабатывается только на шаге `ob_lang`;
  IDOR/PAR-1 не найдено; новых табличных шагов нет (все upsert — существующие
  `tables` 0.4.5), IDM не затронут (дедуп `update_id` и upsert-сессии как были).

### Исправления владельца (круг 1, 2026-09-27)

1. **важно (`migrations` порядок) — исправлено.** Пять строк W114
   (`w114-01…05`) переставлены на `applied_at = 2026-09-27T14:00:00.000Z` —
   позже перевыпуска W25 (`12:00/13:00Z`), поэтому `last_publish` выберет
   W114-строку с верным `version_id`. Инстанс не трогался.
2. **важно (метки времени `set_lang`) — исправлено.** `reg-api/step_17`
   читает `consent_marketing_at`; `step_9` для `set_lang` отдаёт **сохранённые**
   `profile_completed_at`/`consent_marketing_at` (для `profile_save` —
   по-прежнему текущее время); `step_22` пишет их. Смена языка больше не
   двигает аудит-поля (PAR-2); поведение `profile_save` не изменилось.
   Журнал и `catalog/flows/reg-api.md` поправлены.
3. **на будущее (`draft.profile.lang` без различающего прогона) — закрыто
   прогоном.** Добавлен различающий прогон: пользователь с пустым `users.lang`
   и активной сессией, где `draft.profile.lang='uz'`, апдейт без `pending`
   (`ob:fixname`) → `step_27` `{lang:'uz', stored:'', draftLang:'uz'}`.
4. **на будущее (профиль до W114, `lang` пуст) — принято осознанно** и
   записано в карточки `reg-start`/`menu`: такие пользователи меняют язык
   переключателем Mini App; бот до этого остаётся на языке Telegram.

После исправлений — повторное ревью (круг 2).
