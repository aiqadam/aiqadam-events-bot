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
- **`set_lang` перезаписывает `profile_completed_at`/`consent_marketing_at`**
  теми же значениями (idempotent) — цена переиспользования ветки `profile_saved`.
- **Mini App** — живая проверка переключателя на устройстве за владельцем.

## Ревью

> Заполняет независимый ревьюер.
