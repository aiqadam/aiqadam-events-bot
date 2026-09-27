# W114. Выбор языка: шаг онбординга и переключатель в Mini App

- **Статус**: готов
- **Владелец**: агент
- **Волна**: v0.1
- **Зависит от**: W25 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: 2026-09-27 (круг 3 ревью — «замечаний нет»)

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
- [x] независимое ревью, вердикт «замечаний нет» (3 круга: круг 1 — два
      `важно` — `migrations` порядок и метки `set_lang`, исправлены; круг 2 —
      одно `важно` — `tg-router` в DRAFT после тестов, исправлено; круг 3 —
      «замечаний нет»).

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

## Коррекция (2026-09-27, после круга 3): «блокера платформы» нет

**Это была моя ошибка, а не платформа.** Первая версия журнала утверждала, что
новые табличные шаги через MCP невозможны. Перепроверка на свежих пробниках
показала обратное:

- `ap_build_flow` с `tables-upsert-records`, где `table_id`/`key_columns` —
  **верхнеуровневые** пропы (рядом с `values`) → шаг (0.4.6) **валиден**,
  `ap_validate_flow` — 2/2;
- тот же шаг, где `table_id`/`key_columns` **вложены внутрь `values`** →
  **invalid** с сообщением про UI-селект.

Я слал вложенную форму — скопировал её со **старых 0.4.5-шагов** (в проекте
они исторически хранят dropdown'ы внутри `values`), хотя `ap_get_piece_props`
перечисляет `table_id`/`key_columns` отдельными пропами. Отсюда «invalid» и
ложный вывод; контрольный тест («скопировал вход quiz») повторил ту же
вложенность и потому «подтвердил» ошибку. Пин 0.4.5 через MCP действительно
не выставить, но он и не был нужен.

Следствия:
- **новые табличные шаги создавать можно** (0.4.6, верхнеуровневые пропы);
  **W109 этим не заблокирован**;
- W114 собран без новых табличных шагов **не** из-за ограничения платформы, а
  как выбранное решение (язык в черновике сессии, `users.lang` в `finish`,
  `reg-api/set_lang` через ветку `profile_saved`). Оно рабочее и отревьюено;
  отдельные табличные шаги под `set_lang`/запись языка — возможная более
  чистая реализация (отдельная задача, если владелец захочет).

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
- **Отдельные табличные шаги под `set_lang`/запись языка** — возможны (см.
  «Коррекцию»); текущая реализация обходится без них. Кандидат в отдельный
  пакет полировки, если владелец захочет; W109 не заблокирован.
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

### Ревью, круг 2 (2026-09-27)

- **Ревьюер**: независимый агент (чистый контекст), **дата**: 2026-09-27
- **Вердикт**: есть замечания (одно `важно`, одно `на будущее`)

#### Замечания

1. **важно** После различающего прогона круга 1 флоу `tg-router` остался в
   состоянии **DRAFT**, а не в чистом опубликованном. Живой
   `ap_export_flow(5rpOArwaUifCX6IYF4IEQ)` отдаёт версию
   `zJ69nZIp6XaAbStweTDkg`, `state: DRAFT`, `created 11:43:27Z`,
   `updated 11:43:41Z` — это два TESTING-прогона круга 1
   (`7gh3GY3GMTN7Clg83Ixgj` в 11:43:27 и `RVQJzUW9Zzg1yQ4Nit6Y0` в 11:43:41),
   см. `ap_list_runs`. Манифест и снимок указывают опубликованную
   `tUW8ZG8B3tX83cl3vALIP` (`state: LOCKED`). Содержимое черновика
   **идентично** снимку (сравнение `trigger`-поддерева без sample/timestamp —
   равно), то есть это sample-данные теста: опубликованная версия и продакшн
   не задеты. Но по гоче #14 (и прецеденту W38) `ap_test_step`/`ap_test_flow`
   **после** публикации делают продолжение `ap_export_flow` непригодным для
   снимка — флоу надо переопубликовать (`ap_lock_and_publish`) и снять экспорт
   сразу после неё, добавив строку в `migrations`. Сейчас этого не сделано:
   живой флоу не в опубликованном состоянии, а следующий publish создаст
   версию, не отражённую в `migrations`. Пункт проверки 1a/2
   («`flows[0].id` == `publishedVersionId` манифеста») на `tg-router` не
   проходит; остальные четыре флоу проходят — `reg-start`
   `l5dllJkgk9TzBiDcc4mWI`, `menu` `mivExl0RXx77Q2ypz61FT`, `reg-profile`
   `Ftnxj7hBYyGjp30y2ypsW`, `reg-api` `BUBPy3ZCZL5LgvEClkaa7`, все `LOCKED`.

2. **на будущее** Журнал (круг 1, п. 4) утверждает, что поведение «профиль
   заполнен до W114, `users.lang` пуст → карточку языка не видит, меняет язык
   переключателем Mini App; бот до этого остаётся на языке Telegram» записано
   в карточки `reg-start`/`menu`. В `catalog/flows/reg-start.md` и `menu.md`
   такой оговорки нет (там только про «выбравших язык»). Решение принято —
   недостаёт самой записи в карточках.

#### Что проверено (круг 2)

- **Круг 1, п. 1 (`migrations` порядок) — закрыт.** Живые `w114-01…05` имеют
  `applied_at = 2026-09-27T14:00:00.000Z` (позже W25 `12:00/13:00Z`), поэтому
  `last_publish = max(applied_at, _record_created)` для каждого из пяти флоу
  выбирает W114-строку, и её `version_id` совпадает с манифестом
  (`tUW8ZG`/`l5dllJ`/`mivExl`/`Ftnxj7`/`BUBPy3`), `object_id` — тоже.
  `tools/check-migrations.py` на машине не запускается (ключа нет, как и в
  круге 1) — вывод детерминирован алгоритмом скрипта (строки 148–156, 303–311).
- **Круг 1, п. 2 (метки `set_lang`) — закрыт.** Живой `reg-api`: `step_17`
  (`tables-find-records users`) читает `consent_marketing_at` (проекция
  `3t75byELQCZ1ejfTADsvp`); `step_9` для `set_lang` отдаёт
  `profileCompletedAt`/`consentMarketingAt` из строки пользователя, для
  `profile_save` — дефолт `now`; `step_22` пишет их в upsert `users`. Поведение
  `profile_save` не изменилось. Остаточный нюанс: при пустом сохранённом
  `consent_marketing_at` `set_lang` всё же проставит `now` (значение согласия
  при этом сохраняется); в dev таких строк нет — проверено запросом `users`
  (`profile_completed_at` есть, `consent_marketing_at` пуст → 0 записей).
- **Круг 1, п. 3 (`draft.profile.lang`) — подтверждён различающим прогоном.**
  `RVQJzUW9Zzg1yQ4Nit6Y0`: `step_27`
  `{lang:'uz', stored:'', tg:'en', pending:'', draftLang:'uz'}` — при пустых
  `pending`/`stored` побеждает `draft.profile.lang='uz'`, тогда как без него
  результат был бы `en` (выиграла бы ветка `language_code`): прогон различает.
- **`ap_validate_flow`** — `tg-router` 28/28, `reg-start` 21/21, `menu` 15/15,
  `reg-profile` 40/40, `reg-api` 45/46 + 1 skipped.
- **`flows/*.json` ↔ инстанс** — `tg-router`/`reg-api`/`reg-profile`:
  `trigger`-поддеревья живого экспорта и снимков равны (без sample/timestamp);
  `reg-start`/`menu`: id опубликованной версии и `state: LOCKED` совпадают с
  манифестом. Единственное расхождение — DRAFT `tg-router` (п. 1).
- **Каталог** — `step_27`, `needsLang`, `set_lang`, `ob:lang:*`, `localeSource`,
  `users.lang` в `finish`/`finish_no_event` в карточках совпадают с живой
  структурой; правка меток в `catalog/flows/reg-api.md` (стр. 159–170)
  соответствует коду. Прототипу и голосу не противоречит.
- **Офлайн** — `check-texts.py` 283 ссылки/0; `check-commands.py` 0;
  `check-export-secrets.sh` чисто; `grep` по `miniapp/*.html` на цвет/шрифт —
  0 совпадений. SPA-переключатель (`getLang`/`setLang`, `lang.changed`,
  `set_lang`) на месте.
- **AppSec** — `set_lang` берёт `telegram_id` из проверенного `initData`, язык
  сужается до `ru|uz|en` (`LANG_OK` в `reg-api/step_9`, whitelist в
  `reg-profile/step_3`), пишет только свою строку (`telegram_id` из `step_2`);
  `consent_pdn` не трогается, `consent_marketing` сохраняется; новых табличных
  шагов нет. IDOR/PAR-1/PAR-2-нарушений не найдено.

После исправления п. 1 — снова ревью.

### Исправления владельца (круг 2, 2026-09-27)

1. **важно (`tg-router` в DRAFT) — исправлено.** `ap_lock_and_publish`
   (`tg-router`) → новая опубликованная версия `zJ69nZIp6XaAbStweTDkg`;
   экспорт через MCP, `flows/tg-router.json` и `_manifest.json` обновлены;
   строка `w114-01` в `migrations` переставлена на новую версию
   (`applied_at` 14:00Z). Пять флоу снова `LOCKED` и совпадают с манифестом.
2. **на будущее (оговорка в карточках) — исправлено.** В
   `catalog/flows/reg-start.md` и `menu.md` добавлено: пользователи с уже
   заполненным профилем и пустым `users.lang` карточку языка не видят, меняют
   язык переключателем в табе «Профиль» Mini App, бот до этого — на языке
   Telegram.

После исправлений — повторное ревью (круг 3).

### Ревью, круг 3 (2026-09-27)

- **Ревьюер**: независимый агент (чистый контекст), **дата**: 2026-09-27
- **Вердикт**: замечаний нет

#### Замечания

Нет.

#### Что проверено (круг 3)

- **Круг 2, п. 1 (`tg-router` в DRAFT) — закрыт.** Живой
  `ap_export_flow(5rpOArwaUifCX6IYF4IEQ)` отдаёт `flows[0].id =
  zJ69nZIp6XaAbStweTDkg`, `state: LOCKED`; `flows/_manifest.json` — тот же
  `publishedVersionId`; строка `w114-01` в `migrations` совпадает по
  `object_id`/`version_id` (`zJ69…`) и имеет
  `applied_at = 2026-09-27T14:00:00Z`, позже перевыпуска W25
  (`12:00/13:00Z`). `ap_list_runs` по `tg-router`: последние TESTING-прогоны —
  11:43:27Z/11:43:41Z, после переопубликации (11:54Z) тестов не было.
  Снимок `flows/tg-router.json` (`state: LOCKED`) по `trigger`-поддереву равен
  живому (без sample/timestamp), `localeSource = {{step_27['output'].lang}}`.
- **Круг 2, п. 2 (оговорка в карточках) — закрыт.** В
  `catalog/flows/reg-start.md` (стр. 125–128) и `menu.md` (стр. 133–134)
  добавлено: у пользователей с заполненным профилем и пустым `users.lang`
  карточки языка нет, меняют переключателем в табе «Профиль» Mini App, бот до
  этого — на языке Telegram (диффом подтверждено, `10a8f15`).
- **Регресс.**
  - `ap_validate_flow`: `tg-router` 28/28, `reg-start` 21/21, `menu` 15/15,
    `reg-profile` 40/40, `reg-api` 45/46 + 1 skipped.
  - Живые `ap_export_flow` по всем пяти: `flows[0].id` = `publishedVersionId`
    манифеста и `state: LOCKED` (`zJ69…`/`l5dllJ…`/`mivExl…`/`Ftnxj7…`/`BUBPy3…`).
    `trigger`-поддеревья снимков `flows/tg-router.json`/`reg-profile.json`/
    `reg-api.json` равны живым; `reg-start`/`menu` — живой `id`/`state` и
    наличие `needsLang`/`ob:lang` в снимке.
  - `migrations`: для каждого из пяти `object_id` максимум `applied_at` —
    строка W114 (14:00Z); более поздних публикаций этих флоу нет
    (W25 12:00/13:00Z, W106/W107 26.09).
  - Круг 1, п. 2 (метки `set_lang`) держится: живой `reg-api/step_9` для
    `set_lang` отдаёт `profileCompletedAt`/`consentMarketingAt` из строки
    (`step_17`), `step_22` пишет их; запрос `users` — все 99 строк с
    заполненным профилем имеют непустой `consent_marketing_at`, то есть фолбэк
    `|| now` на dev не срабатывает.
  - Каталог: `needsLang`, `ob:lang:*`, `set_lang`, `localeSource`, оговорка
    про профиль до W114 — совпадают с живой структурой.
  - Офлайн: `check-texts.py` — 31 флоу, 283 ссылки, 0 расхождений;
    `check-commands.py` — 0 нарушений (самопроверка ok);
    `check-export-secrets.sh` — чисто (0 значений, `{{variables[...]}}` на месте).
  - Mini App: `npm run build:dev` зелёный; `grep` по `miniapp/*.html` на
    цвет/шрифт — 0 совпадений; переключатель (`getLang`/`setLang`/
    `lang.changed`/`set_lang`) на месте.
  - AppSec: `set_lang` — `telegram_id` из проверенного `initData`, язык
    `ru|uz|en` (`LANG_OK`), пишет только свою строку; IDOR/PAR-1/PAR-2 не
    найдено.

#### Оговорки проверки

- `tools/check-migrations.py` и `tools/export-flows.sh` на машине не
  запускаются: ключа платформы нет ни в `QADAM_API_KEY`, ни в Keychain (как и
  в кругах 1–2). Версия/состояние сверены живым MCP (`ap_export_flow` +
  `ap_list_flows` + чтение `migrations`) — это сильнее снимка.
- Живой e2e в Telegram и на устройстве Mini App — за владельцем (нет
  телефона), как и записано в хвостах пакета.
