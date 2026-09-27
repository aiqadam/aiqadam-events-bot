# W120. Снять алиасы `ob:city:Tashkent/Almaty/write`

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W119 (готов)
- **Начат**: 2026-09-28 · **Закрыт**: 2026-09-28

## Цель

Убрать обратную совместимость со старыми кнопками города, заведённую W119 «на
один релиз»: в `reg-profile/step_3` остаются только `ob:city:yes`/`ob:city:no`,
мёртвый ключ `onb.btn.write` уходит из входов `step_4`, каталог и ADR-0046
больше не называют алиасы живыми.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` (версия `9T98glHpVp81w44xff36q`) | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

Изменено ровно: `step_3.sourceCode` (ветка `city:*` — только `yes`/`no`),
`step_4.texts` (убран `onb.btn.write`, 38→37 ключей). Документы: каталог,
ADR-0046 (обновление п. 4), BACKLOG/STATUS. `i18n/*.json` не тронуты —
`onb.btn.write` остаётся архивом корпуса (ADR-0046).

## Чек-лист готовности

- [x] в `reg-profile/step_3` остались только `ob:city:yes`/`ob:city:no`;
- [x] `catalog/flows/reg-profile.md` и `docs/adr/0046-…` больше не называют
      алиасы живыми;
- [x] различающий прогон: `ob:city:Tashkent` → `ignore` (алиаса нет);
- [x] `catalog/` совпадает с живым проектом;
- [x] независимое ревью, вердикт «замечаний нет».

## Как проверено

Различающие прогоны MCP на `events-dev`, `ap_test_step` по `step_3` с
обёрткой `{"data": {...}}` (гоча №13), `sessionDraft` со `step:"ob_city"`,
синтетические `telegram_id` 888888911–915:

| Вход (`callbackData`) | Прогон | `step_3.action` |
|---|---|---|
| `ob:city:Tashkent` | `WRMCSLYTQZ6nSjWfNI8ZD` | `ignore` |
| `ob:city:Almaty` | `oMty4qXoa4yXLsa2FNAje` | `ignore` |
| `ob:city:write` | `m8o3nYkTjsaz0cpufAbZj` | `ignore` |
| `ob:city:yes` | `iSWDlt4xRhpo85dwK5lDg` | `finish`, `city: 'Ташкент'` |
| `ob:city:no` | `PZojBimTJT1EFGxBTvGhT` | `show_ask_city` |

- **Живой экспорт.** `ap_export_flow` (после `ap_lock_and_publish`) отдал
  `flows[0].id = 9T98glHpVp81w44xff36q`, `state: LOCKED`; нормализованный снимок
  записан `tools/export-flow-mcp.py` в `flows/reg-profile.json`, диф к базе —
  ровно снятые алиасы в `step_3` и строка `onb.btn.write` в `step_4.texts`.
- **Валидация.** `ap_validate_flow` — 40/40 valid.
- **Офлайн.** `check-texts.py` — 0 расхождений; `check-commands.py` — 0;
  `check-export-secrets.sh` — чисто; `check-agents.py` — 0;
  `prototypes/check.mjs` — OK (6 прежних предупреждений `ask-name`/`user-name`).

## Журнал

- **2026-09-28** — `step_3` правился целиком через `sourceCode` (гоча №16:
  частичный код усекает шаг), `step_4.texts` — **всей картой** (гоча №12:
  частичный `input` заменяет вложенный объект, а не мержит). После правок —
  `ap_validate_flow`, затем `ap_test_step` (5 различающих), затем
  `ap_lock_and_publish` и экспорт **сразу** после публикации (гоча №14).
- **2026-09-28** — по ревью W119 алиасы жили «на один релиз»; снятие сделано
  отдельным пакетом, без правки `i18n` (архив) и без касания `reg-start`/`menu`
  (город живёт только в `reg-profile`).
- **2026-09-28** — события тестовых прогонов (синтетические `telegram_id`)
  проверены и удалены из `users`/`sessions`/`registrations`.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: review-agent (независимый, чистый контекст, opencode/deepseek-v4.1-flash) · **Дата**: 2026-09-28 · **Вердикт**: замечаний нет (блокеров и «важно» нет; одно наблюдение «на будущее» — вне пакета, принято хвостом)

### Замечания

Замечаний к W120 нет: блокеров нет, «важно» нет.

**на будущее (вне пакета, хвост)** — `step_4.texts` после снятия `onb.btn.write` (38→37) всё ещё несёт **8 ключей, которые код не читает**: `onb.review`, `onb.btn.fix`, `onb.name_ok`, `onb.btn.itsme`, `onb.btn.all_good`, `onb.btn.continue`, `onb.btn.fix_name`, `reg.done` (сверено разбором `t('...')` в живом `step_4` против карты `texts`). Это наследие ADR-0043, W120 его не заводит и не обязан чистить; сейчас вреда нет — все 37 ключей есть в `i18n/{ru,uz,en}.json`. Ловушка латентная: платформа резолвит **каждую** ссылку `{{$t[...]}}` входа `texts`, поэтому удаление любого «неиспользуемого» ключа из i18n-архива уронит `step_4` целиком. Кандидат в бэклог — отдельной мелкой правкой сузить `texts` до реально читаемых ключей (литеральных строк это не вводит: значения останутся `{{$t[...]}}`). На приёмку W120 не влияет.

### Чем проверено

**Живой проект (`app-flow-events-dev`, MCP).**
- `ap_flow_structure reg-profile` (`bEz2bKyL82zlIwckxqvxc`) — 40 шагов (trigger + 39), все `configured`, без `invalid`/заглушек; ветки `step_5` целы (8: `ignore`/`card`/`consent`/`declined`/`finish`/`finish_lite`/`finish_no_event`/`Otherwise`). `ap_validate_flow` — `40/40 valid`.
- `ap_read_step_code step_3`: ветка `city:*` знает только `city === 'yes'` → `finish` (city `Ташкент`) и `city === 'no'` → `show_ask_city`; веток/`||` для `Tashkent`/`Almaty`/`write` не осталось, прочее падает в `ignore`.
- `step_4` вход `texts` — ровно 37 ключей, `onb.btn.write` отсутствует; все 37 ссылок `{{$t[...]}}` резолвятся в `i18n/ru.json` (и присутствуют в `uz`/`en`).
- `ap_export_flow`: `flows[0].id = 9T98glHpVp81w44xff36q`, `state: LOCKED`, `flowId = bEz2bKyL82zlIwckxqvxc`. **Полный нормализованный дифф живого экспорта с `flows/reg-profile.json` пуст** (все 40 шагов, `type`/`valid`/`settings.input`/`sourceCode`), т.е. снимок репозитория равен живой опубликованной версии целиком.
- `flows/_manifest.json` (запись `reg-profile`) — `publishedVersionId 9T98glHpVp81w44xff36q`, `source mcp`; коммит `16bd7e3` (`git show 16bd7e3:flows/_manifest.json` несёт именно `9T98…`). Строка `migrations 2026-09-28-w120-01`: `object flow:reg-profile`, `object_id bEz2bKyL82zlIwckxqvxc`, `version_id 9T98glHpVp81w44xff36q`, `action publish`, `commit 16bd7e3` — провенанс сходится.
- `ap_list_flows` — 32 флоу (31 свой + чужой `ChatBot`, [Q34](../OPEN-QUESTIONS.md#q34)), состав = 31 запись `_manifest.json`; `reg-profile` ENABLED/published.

**Различающие прогоны прочитаны, не приняты на слово.** W120 (`ap_test_step step_3`, обёртка `{"data":{...}}`, `draft.step=ob_city`, синтетические id 888888911–915): `ob:city:Tashkent` (`WRMCSLYTQZ6nSjWfNI8ZD`), `Almaty` (`oMty4qXoa4yXLsa2FNAje`), `write` (`m8o3nYkTjsaz0cpufAbZj`) → `action:'ignore'`; `ob:city:yes` (`iSWDlt4xRhpo85dwK5lDg`) → `finish`, `city:'Ташкент'`; `ob:city:no` (`PZojBimTJT1EFGxBTvGhT`) → `show_ask_city`. Пара на одном входе доказана старым кодом: тот же `ob:city:write` в прогоне `RYzDMU9OFKx8FdkqMuAK9` (старый код) давал `show_ask_city`, `ob:city:Tashkent` в `aRPtNivdz1YOMfvFcHwnF` (старый код) давал `finish`/`city:'Ташкент'` — теперь `ignore`. Старая кнопка прежнего пути не даёт.
- Таблицы чисты: `telegram_id co 888888` в `users`, `sessions`, `registrations` — пусто; следов прогонов нет, объяснять нечего.

**Офлайн (запущено мной).** `check-export-secrets.sh` — 0 (8× `BOT_TOKEN`, 2× `QR_SIGNING_KEY`, 0 значений `auth`); `check-texts.py i18n/ru.json flows/*.json` — 31 флоу / 285 ссылок `$t` / 0 расхождений; `check-commands.py` — 0; `check-agents.py` — 0; `node prototypes/check.mjs` — OK (те же 6 прежних предупреждений `ask-name`/`user-name`). Грепом по `flows/`, `i18n/`, `prototypes/`, `miniapp/` старых `ob:city:Tashkent/Almaty/write` и ссылок на `onb.btn.write` в живых флоу нет (`onb.btn.write_name` — другой ключ; `i18n/{ru,uz,en}.json` хранит `onb.btn.write` архивом, как и заявлено ADR-0046; `miniapp/dist` — не в git).

**Документы.** `catalog/flows/reg-profile.md` (step_3 и заметка о городе — W120, алиасы сняты), [ADR-0046](../adr/0046-city-question-yes-no-tashkent.md) (обновление 2026-09-28), [BACKLOG W120](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite) (три пункта `[x]`, ревью открыто), [STATUS](../STATUS.md) (W120 `на проверке`, `9T98…`) — согласованы с живым проектом; лживых утверждений не нашёл.

**Ограничение.** Ключа платформы нет (`QADAM_API_KEY`/Keychain) — `tools/check-migrations.py` не запускался; сверка `_manifest ↔ ap_list_flows ↔ migrations` сделана точечно по `reg-profile` и по составу флоу (31/31). Значения переводов `uz`/`en` живьём не рендерились (общий хвост W27), проверено наличие ключей. Живого Telegram-чата/`initData` у ревьюера нет.

## Хвосты и блокеры

- Перенос на prod — отдельным хотфиксом (ADR-0042), как и W119.
- Живой прогон в Telegram — за владельцем.
- **На будущее (ревью):** в `step_4.texts` осталось 8 ключей, которые код не
  читает (`onb.review`, `onb.btn.fix`, `onb.name_ok`, `onb.btn.itsme`,
  `onb.btn.all_good`, `onb.btn.continue`, `onb.btn.fix_name`, `reg.done`).
  Вреда нет (ключи есть в `i18n`), но платформа резолвит каждую ссылку
  `{{$t[...]}}`, поэтому чистить их можно только вместе с ревизией архива
  ключей — отдельной мелкой задачей, не в W120.
