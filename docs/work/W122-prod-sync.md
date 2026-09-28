# W122. Перенос dev→prod: W109–W121 + i18n (хотфикс ADR-0042)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W109, W112, W113b, W114, W116, W119, W120, W121 (все `готов` на dev)
- **Начат**: 2026-09-28 · **Закрыт**: —

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
- [x] Mini App prod пересобран (`main`→`prod`, `build:prod` зелёный) и запушен;
- [x] строки `migrations` на prod (40 строк `2026-09-28-w122-01…40`);
- [x] `catalog/environments.md` отражает состояние;
- [x] финальная сверка: 30 общих флоу prod↔dev, **0 расхождений шагов**;
- [ ] независимое ревью, вердикт «замечаний нет».

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
- **`migrations` prod**: 40 строк `w122-01…40`, `action`/`version_id` сверены.

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

## Хвосты и блокеры

- Деплой Mini App prod — CI репо `aiqadam/aiqadam-events-bot-prod` (ветка
  `prod` запушена); живая проверка на устройстве — за владельцем.
- Живой сквозной прогон бота в Telegram (карточка языка, uz/en ответы,
  город да/нет) — за владельцем: у агента нет телефона.
- Прогон `tg-router` на prod больше не ретраится (`logOutput:false`, цена
  ADR-0044) — как и на dev.
