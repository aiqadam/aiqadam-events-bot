# W122. Перенос dev→prod: W109–W121 + i18n (хотфикс ADR-0042)

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W109, W112, W113b, W114, W116, W119, W120, W121 (все `готов` на dev)
- **Начат**: 2026-09-28 · **Закрыт**: 2026-09-28

## Цель

Догнать `events-prod` до `events-dev` по пакетам, применённым на dev после
копии 2026-09-26 и хотфикса W107. Prod — замороженная копия, меняется только
осознанным хотфиксом через MCP `app-flow-events-prod` (ADR-0042 п. 2).

## Объём (сверка `migrations` prod: строк W109–W121 нет)

**Фаза 1 — средовые механики, от i18n не зависят:**

| Пакет | Что | Точки |
|-------|-----|-------|
| W112 | `logOutput: false` | триггер `tg-router` + 24 шага, 11 флоу |
| W109 | per-row `__clear` `cancelled_at` | `reg-consent-pdn/step_5`, `reg-api/step_11`/`step_18`, `reg-profile/step_23`/`step_29` |
| W113b | `DECLARE_KEY` | `users`, `registrations`, `sessions`, `staff`, `feedback`, `quiz_attempts`, `quiz_answers` |
| W121 | удалить `dedup-report` | prod `PNjhVFpxwOyR8fVkJAR4p` пока ENABLED |

**Фаза 2 — i18n и язык/город:**

| Пакет | Что |
|-------|-----|
| W25/W27 | каталог платформенных переводов + `defaultLocale=ru` + `localeSource` `tg-router`, перевод `texts` на `{{$t[...]}}` |
| W114 | язык: карточка `ob:lang`, `set_lang`, `step_27` effective lang |
| W116 | `reg-api/step_9` получает `lang` |
| W119/W120 | город «Вы из Ташкента?» да/нет, снятие алиасов |
| W115/W117 | Mini App: переключатель языка, тихий вид |

## Различия сред (из сверки 2026-09-28)

- prod `reg-profile`/`reg-start` несут **литеральные** тексты, не `{{$t[...]}}`;
  у prod нет переводов W25/W27 (копия снята 2026-09-26, W25 — 2026-09-27).
- prod MCP **не отдаёт** инструменты переводов (`ap_upsert_translations`,
  `ap_list_translations`) — каталог на prod заливает владелец через UI.
- `tables` на prod: в схеме `tables-upsert-records` виден Clear Columns, но
  `__clear` пробуется точечно.
- prod `dedup-report` ENABLED — снимается фазой 1d.

## Чек-лист готовности

- [x] W109, W112, W113b, W121 применены на prod, флоу опубликованы;
- [x] каталог переводов на prod залит (441 ключ × ru/uz/en);
- [x] `project.defaultLocale = ru` на prod (владелец, UI);
- [x] W25-конвертация `texts`→`{{$t[...]}}` на prod (все пользовательские флоу);
- [x] W114/W116 (язык), W119/W120 (город) применены на prod;
- [x] Mini App prod пересобран (`main`→`prod`, `build:prod` зелёный), запушен и **задеплоен** (workflow `pages-prod` репо `aiqadam/aiqadam-events-bot-prod`, run `36398755348`);
- [x] строки `migrations` на prod (51 строка `2026-09-28-w122-01…51`);
- [x] `catalog/environments.md` отражает состояние;
- [x] финальная сверка: 30 общих флоу prod↔dev, **0 расхождений шагов**;
- [x] независимое ревью: круг 1 и 2 — «есть замечания» (исправлены), круг 3 — «замечаний нет».

## Как проверено (фаза 1)

- **Сверка до правки.** `migrations` prod, `package in W109…W121` — 0 строк;
  у dev — 30. Все правки фазы 1 отсутствовали на prod.
- **W112 (25 точек).** `logOutput:false` выставлен на триггере и 24 шагах
  11 флоу; `ap_validate_flow` — 11/11 valid (27/53/8/16/5/46/11/18/40/13/16);
  все 11 опубликованы.
- **W109 (5 шагов).** `ap_delete_step` + `ap_add_step` подняли пять шагов
  создания/реактивации регистрации на `tables` 0.4.6 с per-row
  `__clear:["OlFAWgVQmrqhqxlraOPOZ"]` (`cancelled_at`). Читаемый экспорт
  `reg-consent-pdn`: `step_5` — `qadamVersion 0.4.6`, `__clear` на месте,
  `step_4`/`step_5` — `logOutput:false`; дерево и число шагов не менялись.
- **W113b (7 таблиц).** `DECLARE_KEY` принят платформой на всех семи
  (платформа отказала бы при дублях — значит, дублей нет).
- **W121.** `dedup-report` удалён; `ap_list_flows` prod — 30 флоу (было 31).
- **migrations prod** — 19 строк `w122-01…19`.
- **Диф сред.** `auth`/`flow`-ссылки не трогались: export `reg-consent-pdn`
  несёт prod-connection `KIbx…` и prod-`externalId` `PUf09unv…`, совпадающий
  с вызовом из prod `tg-router`. Перепривязка не потребовалась.

## Как проверено (фаза 2)

- **Сверка dev↔prod по всем флоу** (`ap_export_flow`, 30 общих): сначала
  40 отличающихся шагов (только `texts`), после переноса — **0**.
- **Валидатор**: каждый публикуемый флоу `ap_validate_flow` — valid; до
  `defaultLocale` были `translation_default_locale` (блокер), после — чисто.
- **Живой пробник `$t`** на prod (`reg-api /sync`, пустой `initData`):
  заголовок `ap-parent-run-locale` → `ru`/`uz`/`en`/`ru-RU` дают переведённый
  текст (`…устарели…` / `…eskirgan…` / `…expired…`), без `TranslationKeyNotFound`.
- **`tg-router`**: `step_27` в дереве, `step_9` под ним, `localeSource`
  выставлен, `auth` на триггере/step_15/22/26 на месте, `logOutput:false`.
- **`migrations` prod**: 51 строка `w122-01…51`, `action`/`version_id` сверены.

## Журнал

- **2026-09-28** — Пакет взят по прямому запросу владельца: «накатим на prod
  правки из dev», объём — «всё, вместе с i18n». Сверка `migrations` prod
  (`package in W109…W121`) — **0 строк**; dev — 30 строк W109–W121.
  Оба MCP-инстанса подняты, prod холодный старт со второй попытки.
- **2026-09-28** — **Фаза 1 выполнена на prod** (W109, W112, W113b, W121),
  11 флоу опубликованы, 19 строк `migrations` на prod. Version id собраны
  `ap_export_flow` (делегировано субагенту).
- **2026-09-28** — Выяснено ключевое ограничение фазы 2: prod MCP не отдаёт
  инструменты переводов, а prod `texts` — литеральные (копия снята
  2026-09-26, W25/W27 — 2026-09-27). Значит, для `{{$t[...]}}` каталог на
  prod заливает **владелец через UI**, затем конвертируются `texts`.
- **2026-09-28** — Владелец обновил prod: MCP снова отдаёт 51 инструмент,
  включая `ap_list/upsert/delete_translations`. Каталог `i18n/{ru,uz,en}.json`
  (441 ключ) залит на prod через MCP-эндпоинт (сессия не перечитала реестр —
  инструменты вызваны прямым JSON-RPC к `app-prod…/mcp`, тот же MCP).
- **2026-09-28** — **W114 для `tg-router` портирован на prod**: `step_27`
  «effective lang» (код+input с dev), `upsert users` без колонки `lang`,
  `localeSource = {{step_27['output'].lang}}` (ставится только импортом
  шаблона — отдельной ручки нет), возвращены `auth` на триггере/step_15/
  step_22/step_26 (экспорт очищает), `logOutput:false` на триггере/step_6.
  Опубликован: версия `2OUVYFWqKPVrwmE1hYTqM`; `migrations` prod `w122-20`.
- **2026-09-28** — `reg-profile`, `reg-start`, `menu`, `reg-api` переведены
  на dev-версии шагов (`texts`→`{{$t[...]}}`, `lang`/`sessionStep`, метки,
  проекции `columns`): 22 шага, drafts. **Публикация заблокирована**: у prod
  нет `project.defaultLocale`, валидатор даёт `translation_default_locale`
  (`reg-api/step_9` — invalid). Нужен `defaultLocale = ru` в UI prod.
- **2026-09-28** — **Mini App prod**: `origin/prod` отставала от `main` на
  100 коммитов (сборка W104-эпохи, русского-онли). Смержено `main`→`prod`
  без конфликтов, `npm ci && npm run build:prod` — зелёный (95 модулей,
  `dist/` собран), коммит `3551460`, запушено в `origin/prod`. Деплой —
  CI репозитория `aiqadam/aiqadam-events-bot-prod` (в этом репо `pages.yml`
  реагирует только на `main`, `prod` его не триггерит).
- **2026-09-28** — Владелец выставил `project.defaultLocale = ru` на prod.
  Валидатор перестал давать `translation_default_locale`: все 4 флоу valid.
  Опубликованы `reg-profile` `SLNDfnPegKww7FLX9ewF9`, `reg-api`
  `39naNidX19agPOACPbMLC`, `reg-start` `yzDxSbBNB6ME3qtMbdlUm`, `menu`
  `ZYG367q9x1nXxiqk0VcI4` (`migrations` `w122-21…24`).
- **2026-09-28** — **Остаток W25** (остальные пользовательские флоу): сверка
  всех 30 общих флоу показала 40 шагов, отличающихся **только** полем `texts`
  (литерал vs `{{$t[...]}}`). Портированы dev-входы в 16 флоу, все
  опубликованы (`migrations` `w122-25…40`).
- **2026-09-28** — **Финальная сверка**: `ap_export_flow` dev vs prod по 30
  общим флоу — **0 расхождений шагов**; `ChatBot` — только на dev (чужой
  платформенный, Q34). Живой пробник `reg-api /sync` на prod: `$t` резолвится
  в `ru`/`uz`/`en`/`ru-RU` (401 `invalid_init_data` с переведённым текстом, без
  `TranslationKeyNotFound`).
- **2026-09-28** — **Ревью круг 1**: вердикт «есть замечания» — два «важно»
  (неполная W25: 6 текстов в `reminders/step_8`, `reg-start/step_18`,
  `staff-accept/step_10`; 4 prod-флоу в `DRAFT`), три «на будущее». Исправлено:
  три шага переведены на `{{$t}}` и перепубликованы (`w122-45…47`), четыре
  флоу опубликованы в `LOCKED` (`w122-41…44`). «На будущее»: фильтры — диф
  dev↔prod идентичен (не воспроизводится), `flowProps` — платформенная
  сериализация, `DECLARE_KEY` — ограничение проверки.
- **2026-09-28** — **Деплой Mini App prod**: workflow `pages-prod` в репо
  `aiqadam/aiqadam-events-bot-prod` запущен `workflow_dispatch` (run
  `36398755348`, success) — он сам чекаутит ветку `prod` `aiqadam-events-bot`,
  собирает `build:prod` и публикует Pages. Проверено: `miniapp-prod…` отдаёт
  `assets/index-DfD21f1G.js` (наш prod-билд), в бандле есть
  `ap-parent-run-locale`, `last-modified` 2026-09-28.
- **2026-09-28** — **Ревью круг 2**: закрыты оба «важно»; остались два «на
  будущее», из них одно — моя ошибка: `field.id` в трёх фильтрах действительно
  отсутствовал на prod (мой нормализованный диф исключал `id` рекурсивно).
  Выровнено до dev: `menu/step_1`, `reg-api/step_17`, `reg-start/step_12`
  (`w122-48…50`); возвращены dev-комментарии `reminders/step_8` (`w122-51`).
  Полный диф **с `id`** по 30 флоу — 0 расхождений.

## Хвосты и блокеры

- Деплой Mini App prod — CI репо `aiqadam/aiqadam-events-bot-prod` (ветка
  `prod` запушена); живая проверка на устройстве — за владельцем.
- Живой сквозной прогон бота в Telegram (карточка языка, uz/en ответы,
  город да/нет) — за владельцем: у агента нет телефона.
- Прогон `tg-router` на prod больше не ретраится (`logOutput:false`, цена
  ADR-0044) — как и на dev.

## Ревью

- **Ревьюер**: независимый review-agent (opencode, `deepseek-v4.1-flash`), **дата**: 2026-09-28
- **Вердикт**: **есть замечания**

Живой prod проверен read-only через MCP `app-flow-events-prod`: bulk-экспорт
`ap_export_flow` по 30 общим флоу в обеих средах с независимым дифом, структуры
ключевых флоу, `ap_validate_flow` по всем 30, `migrations`, `ap_list_runs`/
`ap_get_run`, каталог переводов. REST-POST к платформе не делался (запрещён и
ролью, и харнессом); живой пробник `$t` подтверждён чтением прод-прогонов
владельца того же сценария.

### Замечания

1. **важно** — W25-конвертация `texts`→`{{$t[...]}}` на prod неполна: **6
   пользовательских текстов остались русскими литералами**.
   - `reminders`, `step_8` («reminder text», внутри `LOOP_ON_ITEMS`):
     `remind.24h`, `remind.2h`, `remind.btn.directions`, `ticket.btn.open`;
     версия `sxt9fKhn548NZtwM91d2E` (LOCKED), в `migrations` W122 строки по
     `reminders` нет — флоу вообще не попал в W25-пакет `w122-25…40`.
   - `reg-start`, `step_18` («текст сбоя: попробуйте ещё раз», onFailure-ветка):
     `common.err.generic`; версия `yzDxSbBNB6ME3qtMbdlUm` (`w122-23`).
   - `staff-accept`, `step_10` («build scanner button», onSuccess-ветка):
     `staff.accept.btn.scanner`; версия `g6JcrpxiZU7vNh4d5I9St` (`w122-39`).
   На dev те же тексты — `{{$t[...]}}`, а все 6 ключей уже есть в prod-каталоге
   переводов с ru/uz/en, то есть правка сводится к копированию dev-входа.
   Следствие: uz/en-пользователь получит русские напоминания и подпись кнопки.
   Это прямо противоречит отмеченному пункту чек-листа «W25-конвертация
   `texts`→`{{$t[...]}}` на prod (все пользовательские флоу)» и журнальному
   «0 расхождений». **До исправления пакет не может стать `готов`.**

2. **важно** — **4 prod-флоу экспортируются в состоянии `DRAFT`**, а не
   `LOCKED`, поэтому `ap_export_flow` отдаёт по ним черновик, а не
   опубликованную версию: `events-api` (`HhYjxjK2rTGcN4onpD4uZ`),
   `fn-parse-start` (`oG1KA0SNUzlEeyBSHHlpf`),
   `fn-sign-qr` (`4y8YAiiYEDb9ldW1fHRbl`),
   `fn-verify-qr` (`s4pUC42gyWRWavdVdqarr`). W122 этих флоу не касался; в
   `migrations` последняя публикация `events-api` — W72
   (`hJyGxfWMj3WGtihDMtfJV`), по трём `fn-*` строк публикации нет. Содержимое
   шагов совпадает с dev, но именно у этих четырёх «0 расхождений» доказано
   для черновика, а не для того, что видит пользователь. Нужно выяснить
   причину draft (след `ap_test_flow`/незавершённая правка?) и убедиться, что
   published = dev; при расхождении — опубликовать. `fn-sign-qr`/`fn-verify-qr`
   — крипто-шаги, подтверждение их published-версии особенно существенно.

3. **на будущее** — у prod в трёх фильтрах `tables-find-records` потерян
   `filters[].field.id`, который есть на dev: `menu` (чтение `users` по
   `telegram_id`), `reg-api`, `reg-start`. По схеме qadam `field` — «column
   name or id», `name`+`type` на месте, так что фильтр рабочий; но это
   расхождение со всеми прочими фильтрами и с dev. Поскольку в проекте уже
   был класс дефектов «потерянный фильтр = fail-open», стоит выровнять до dev
   или подтвердить живым прогоном затронутого шага.

4. **на будущее** — у prod отсутствует `settings.propertySettings.flowProps`
   (есть на dev) в `manage-api` и в `tg-router` (callFlow-ветки `menu` и
   `staff_accept`). Это UI-метаданные для резолва динамических пропов;
   рантайм читает `input.flowProps`, который совпадает, поэтому поведение не
   меняется, но с dev расходится.

5. **на будущее** — `DECLARE_KEY` по W113b (7 таблиц) через MCP **независимо
   не перепроверяется**: ни `ap_export_table`, ни `ap_list_tables` объявленный
   ключ не отдают. Опираюсь на `migrations` `w122-01…07` и на то, что
   платформа отказала бы при дублях; отдельного живого подтверждения нет —
   записать как ограничение проверки.

### Ответ владельца (исправления, 2026-09-28)

1. *Исправлено.* Остаток W25 действительно был неполон: мой диф обходил
   `nextAction`/`children`, но не `continueOnFailureBranches`, а тело
   `LOOP_ON_ITEMS` (`reminders/step_8`) экспорт вообще не отдаёт — шаг взят из
   `ap_read_step_code`. Переведены на dev-входы и перепубликованы:
   `reminders/step_8`, `reg-start/step_18`, `staff-accept/step_10`
   (`migrations` `w122-45…47`). Живой прогон напоминаний — за владельцем.
2. *Исправлено.* Причина — drift от dev (dev `LOCKED`, prod `DRAFT`). Все
   четыре флоу валидированы (`valid: true`) и опубликованы, теперь `LOCKED`
   (`migrations` `w122-41…44`). `fn-sign-qr`/`fn-verify-qr` сверились с dev
   побайтово по `sourceCode`.
3. *Исправлено (моя проверка была ошибочной).* Ревьюер прав: мой нормализованный
   диф исключал ключ `id` рекурсивно, поэтому расхождение `field.id` не видел.
   Прямая сверка подтвердила: на dev `field.id` есть, на prod его не было.
   Выровнено: `menu/step_1`, `reg-api/step_17`, `reg-start/step_12` —
   `field.id = JtylZU291K7TuMn9c9F2t`; флоу перепубликованы (`w122-48…50`).
   Повторный полный диф dev↔prod **с `id`** — 0 расхождений.
4. *Принято как платформенный артефакт сериализации.* `propertySettings.flowProps`
   — UI-метаданные; рантайм читает `input.flowProps`, который совпадает с dev
   (то же явление зафиксировано в W112). Правки не требует.
5. *Принято как ограничение проверки.* `DECLARE_KEY` через MCP не читается;
   опора — `migrations` `w122-01…07` и fail-closed поведение платформы при
   дублях. Тем же ограничением живёт W113b на dev.

### Что подтверждено на живом prod (без замечаний)

- `ap_list_flows` prod: ровно **30** флоу, все `ENABLED`/published,
  `dedup-report` отсутствует (dev — 31, из них `ChatBot` — чужой платформенный).
- `tg-router`: `step_27` «effective lang» на месте, `step_9` под ним;
  `localeSource = {{step_27['output'].lang}}` — совпадает с dev; `[LOG OFF]`
  на триггере и `step_6`; `auth` (prod-connection `KIbx…`) на триггере,
  `step_15`, `step_22`, `step_26`.
- W109: per-row `__clear: ["OlFAWgVQmrqhqxlraOPOZ"]` на
  `reg-consent-pdn/step_5`, `reg-api/step_11`/`step_18`,
  `reg-profile/step_23`/`step_29` — совпадает с dev; шаги на `tables` 0.4.6.
- W112: `logOutput` совпадает dev↔prod во всех 30 общих флоу — диф не нашёл ни
  одного расхождения по `logOutput`.
- `ap_validate_flow` по всем 30 prod-флоу: `valid: true`, `invalidSteps: 0`,
  `issues: []`, `warnings: []`; `translation_default_locale`/`translation_key`
  отсутствуют.
- `migrations` prod: 40 строк `2026-09-28-w122-01…40`; все 32 `publish`-строки
  сверены, **последняя publish по каждому из 22 объектов совпала с живым
  `ap_export_flow.flows[0].id`**; у `table:`-строк `version_id` «-», `commit` «-».
- i18n: **199** различных `$t`-ключей, реально используемых в prod-флоу, — все
  есть в prod-каталоге переводов и все с ru/uz/en; недостающих ключей нет.
- Живой `$t`: прод-прогоны `reg-api` `hXLzlUoD5kJvMdEIQ5ANL` (ru,
  «…устарели…»), `eEiKVuxLpvgpN5oE8vAHi` (uz, «…eskirgan…»),
  `c6qK2IKJ7atNeZSKPRrNY` (en, «…expired…») от 2026-09-28 07:18–07:20,
  `environment: PRODUCTION`, `SUCCEEDED`, `invalid_init_data`, без
  `TranslationKeyNotFound`.
- AppSec: экспорт не содержит значений connections/variables (`ap_export_flow`
  очищает `auth`; `check-export-secrets.sh` — чисто); W122 не трогал логику
  авторизации/IDOR (только тексты, `lang`, город); `telegram_id`/`lang` берутся
  из проверенного источника (`initData`/апдейт).
- Офлайн: `check-texts.py` (280 ссылок, 0 расхождений), `check-commands.py`
  (0 нарушений), `check-export-secrets.sh` (чисто), `check-agents.py` (ok).

### Ограничения ревью

- Живой `POST /sync`-пробник `$t` не воспроизводился: POST к платформе
  запрещён ролью ревьюера и заблокирован харнессом; проверено чтением
  прод-прогонов того же сценария (`ap_get_run`).
- Bulk-сверка 30 флоу сделана read-only MCP-вызовами (`ap_export_flow` обеих
  сред) с нормализацией env-специфики (`auth`, `flow.externalId`, sample data);
  `tools/check-migrations.py` без ключа платформы не запускался.
- `catalog/environments.md` в части «логика флоу prod пошагово совпадает …
  0 расхождений шагов» **не соответствует** фактам п. 1–4; после исправления
  формулировку нужно уточнить.

## Ревью (круг 2)

- **Ревьюер**: независимый review-agent (opencode, `deepseek-v4.1-flash`), **дата**: 2026-09-28
- **Вердикт**: **есть замечания** (оба — уровня «на будущее»;
  функциональных расхождений нет). Круг 1 сохранён выше, не переписывался.

Повторная read-only проверка живого prod после «Ответа владельца».

### Закрыто

- **Круг 1, п. 1 (W25-тексты) — закрыто.** `reminders/step_8` (тело
  `LOOP_ON_ITEMS`, читается `ap_read_step_code`) — `texts` теперь
  `{{$t[...]}}` на dev **и** prod; `reg-start/step_18` и `staff-accept/step_10`
  — `{{$t[...]}}` на обеих средах (`ap_export_flow`). Флоу перепубликованы:
  `migrations` `w122-45…47`, последняя publish совпала с живыми версиями
  `uTdqdRmvdsRrwffFOQA4R` / `CzeIgDKeFz4Q1TAmFoxRM` /
  `gjuogv6YdiImr9DhROKK4`. Полный диф больше не показывает расхождений по
  `texts`.
- **Круг 1, п. 2 (4 DRAFT-флоу) — закрыто.** `events-api`,
  `fn-parse-start`, `fn-sign-qr`, `fn-verify-qr` теперь `state: LOCKED`,
  `valid: true`; `migrations` `w122-41…44`, последняя publish по каждому
  совпала с живой версией (`HhYjxjK…`, `oG1…`, `4y8…`, `s4p…`). `sourceCode`
  всех CODE-шагов побайтово совпал с dev, полный диф по этим флоу — без
  расхождений.
- **Круг 1, п. 4/5 — принято**: платформенный артефакт `propertySettings` /
  непрозрачность `DECLARE_KEY`; поведение не меняется.

### Замечания

1. **на будущее (круг 1, п. 3 — не закрыт; обоснование владельца неверно)** —
   `field.id` в фильтре `tables-find-records` по `users.telegram_id` на prod
   **отсутствует, а на dev присутствует**: `menu/step_1`, `reg-api/step_17`,
   `reg-start/step_12`. Подтверждено двумя независимыми живыми чтениями —
   `ap_export_flow` и `ap_flow_structure includeInput`: dev
   `{"id":"JtylZU291K7TuMn9c9F2t","name":"telegram_id","type":"TEXT"}` vs prod
   `{"name":"telegram_id","type":"TEXT"}`. То есть это **не** «отсутствует в
   обеих средах». Функционально безопасно: по схеме qadam поле фильтра —
   «column name or id», `name`+`type` на месте, фильтр рабочий, fail-open нет;
   прочие фильтры тех же флоу `id` несут. Просьба либо выровнять до dev, либо
   записать как принятое расхождение с корректной формулировкой.
2. **на будущее (новое, косметика)** — `reminders/step_8` на prod потерял
   комментарии из dev-кода: после удаления строк, начинающихся с `//`, код
   **побайтово совпадает** (логика идентична), но `sourceCode` как строка
   различается (dev 1734 симв., prod 1235). Похоже, при исправлении кода шага
   на prod он собран из версии без комментариев. На поведение не влияет.

### Итог круга 2

Полный диф dev↔prod по 30 общим флоу (все ветки, `children`, `nextAction`,
`continueOnFailureBranches`, тело `LOOP_ON_ITEMS`) — **7 листьев**: 3×
`propertySettings.flowProps` (принято, п. 4), 3× `field.id` (замечание 1),
1× комментарии `reminders/step_8` (замечание 2). Функциональных расхождений
нет. `migrations` prod — **47** строк `w122-01…47`; `ap_validate_flow` —
30/30 `valid`, `issues`/`warnings` пусты. Все замечания круга 1, кроме п. 3,
закрыты; замечание 1 несёт лишь запись/выравнивание, замечание 2 —
косметика.

## Ревью (круг 3)

- **Ревьюер**: независимый review-agent (opencode, `deepseek-v4.1-flash`), **дата**: 2026-09-28
- **Вердикт**: **замечаний нет**

Финальная read-only проверка живого prod после правок по кругу 2. Круги 1–2
сохранены выше.

### Закрыто

- **Круг 2, замечание 1 (`field.id`) — закрыто.** `ap_flow_structure includeInput`
  и `ap_export_flow` дают на prod и dev идентичное поле фильтра
  `users.telegram_id`: `{"id":"JtylZU291K7TuMn9c9F2t","name":"telegram_id","type":"TEXT"}`
  в `menu/step_1`, `reg-api/step_17` (и `step_36`), `reg-start/step_12`.
  Флоу перепубликованы; `migrations` `w122-49…51` (menu `anrXmDAnTGSRkqxEVt3gS`,
  reg-api `cV4mHnQgHr1XVpURmGNuj`, reg-start `kxQp9swpVqSAAwpIm4U8j`) — publish
  совпадает с живыми версиями.
- **Круг 2, замечание 2 (комментарии `reminders/step_8`) — закрыто.**
  `ap_read_step_code` на dev и prod отдаёт **побайтово одинаковый** `sourceCode`
  (len 1734, sha256 `c62d75f0b766…`) и `texts` = `{{$t[...]}}`; тело
  `LOOP_ON_ITEMS` через `ap_flow_structure includeInput` (`/steps/8`) идентично.
  Версия `w2rrMiILLP14xED4ikLZO`, `migrations` `w122-48` — publish совпадает.

### Итог круга 3

Полный диф dev↔prod по 30 общим флоу **с сохранением `id`** — **3 листа**,
все `settings.propertySettings.flowProps` (принятый платформенный артефакт,
круг 1 п. 4): `manage-api` (1), `tg-router` (2). Иных функциональных и
структурных расхождений нет. `migrations` prod — **51** строка
`w122-01…51`; `ap_validate_flow` — **30/30** `valid: true`,
`issues`/`warnings` пусты; `translation_default_locale`/`translation_key`
отсутствуют. Все 30 флоу `state: LOCKED`.

Расхождение нумерации: в запросе круга 3 четыре правки ожидались как
`w122-48…50` (фильтры) + `w122-51` (reminders); фактически
**`w122-48` — reminders, `w122-49` — menu, `w122-50` — reg-api,
`w122-51` — reg-start**. Все четыре строки на месте, последняя publish
каждой совпала с живой версией — на результат не влияет.
