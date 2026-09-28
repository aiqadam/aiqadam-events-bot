# W119. Город в онбординге: «Вы из Ташкента?» вместо списка городов

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W107 / ADR-0043 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: 2026-09-27

## Цель

Городской шаг онбординга (`reg-profile`) спрашивает да/нет вместо списка
городов: «Вы из Ташкента?» кнопками «Да»/«Нет», на «Нет» — свободный ввод
города. Решение — [ADR-0046](../../docs/adr/0046-city-question-yes-no-tashkent.md),
ТЗ — правка [SPEC PAR-8](../../docs/SPEC.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| ADR | [0046](../../docs/adr/0046-city-question-yes-no-tashkent.md) | — |
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w119-город-в-онбординге-вы-из-ташкента-вместо-списка-городов).

- [x] `reg-profile/step_4`: карточка города — `onb.ask_city` («Вы из Ташкента?»)
      с кнопками `common.btn.yes`/`common.btn.no` → `ob:city:yes`/`ob:city:no`;
- [x] `reg-profile/step_3`: `ob:city:yes` → `finish` с городом `Ташкент`;
      `ob:city:no` → `show_ask_city` → `ob_await_city` → текст-город → `finish`;
      старые `ob:city:Tashkent/Almaty/write` — алиасы на один релиз;
- [x] тексты `onb.ask_city` (ru/uz/en) и новый `onb.ask_city_input` импортированы
      в платформенные переводы до публикации (плюс `common.btn.yes`/`common.btn.no`);
- [x] различающие прогоны: «Да» → `finish`/`finish_no_event` с `Ташкент`,
      «Нет» → карточка ввода → текст → `finish` с городом;
- [x] SPEC PAR-8, ADR-0046, `catalog/flows/reg-profile.md` и прототип
      синхронизированы;
- [x] `tools/check-texts.py`, `check-commands.py`, `check-export-secrets.sh`,
      `prototypes/check.mjs` — зелёные;
- [x] `catalog/` совпадает с живым проектом;
- [x] независимое ревью, вердикт «замечаний нет» (круги 1–4; круг 4 — чисто).

## Как проверено

Различающие прогоны MCP на `events-dev` (обёртка `{"data":{...}}`, гоча №13),
тестовые `telegram_id` 888888901–906, диагностические строки `users`/`sessions`
удалены после проверки, `registrations` по ним пуста.

1. `step_3`, `ob:city:yes`, `draft.step=ob_city` (`keCdqCVSRJNB3H9OKm6hY`) →
   `action:'finish'`, `city:'Ташкент'`.
2. Полный прогон, `ob:city:yes`, `eventId:''` (`EqG6L9AkNpKaqgUgmJZGo`) →
   `step_4 writeKind:'finish_no_event'`, `profile.city:'Ташкент'`; ROUTER —
   ветка `finish_no_event`; `step_35` записал `users` (`city='Ташкент'`,
   `consent_pdn=true`, `lang='ru'`, `profile_completed_at`), `step_36` — сессию
   `await_marketing`; отправки дали `400 chat not found` (синтетический чат) —
   ожидаемо, после записи.
3. `step_3`, `ob:city:no` (`WEoHwrF55foiFEeTepXnB`) → `action:'show_ask_city'`.
4. Полный прогон, `ob:city:no` (`RgDb3WiVlmFOL6nFNul74`) → `step_4
   writeKind:'card'`, `cardText:'Напишите ваш город.'` (`onb.ask_city_input`),
   `nextStep:'ob_await_city'`; сессия — шаг `ob_await_city`.
5. Полный прогон, текст `Бишкек`, `draft.step=ob_await_city`
   (`lSNyOVVlpczchgMVZDuEI`) → `step_3 action:'finish'`, `city:'Бишкек'`;
   `step_4 finish_no_event`; `users.city='Бишкек'`.
6. Алиас `ob:city:write` (`RYzDMU9OFKx8FdkqMuAK9`) → `show_ask_city` (обратная
   совместимость старой карточки).
7. Полный прогон, работа `ML-инженер, Payme`, `draft.step=ob_await_work`
   (`toWNgbSpF3KcQ06OMbcjw`) → `step_4 writeKind:'card'`,
   `cardText:'Вы из Ташкента?'`, `replyMarkup` = `[["Да" ob:city:yes],
   ["Нет" ob:city:no]]`, `nextStep:'ob_city'` — рендер карточки города
   (значение перевода `onb.ask_city` ru и обе кнопки).

**Гоча тестирования:** `ap_test_step` по `step_4` возвращал `writeKind:'ignore'`
(`obWXgrnUYzWepy8ee5VRr`, `jI778NLR0WsqgfOKti8di`), хотя отдельный прогон
`step_3` давал `finish` — инструмент брал сохранённый sample выхода `step_3`, а
не свежий. Доказательство маршрута — только полные `ap_test_flow` (пп. 2, 4, 5);
`ap_test_step` на downstream-шаге для флоу с ветвлением не показателен.

**Офлайн:** `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0; `check-commands.py`
— 0; `check-export-secrets.sh` — чисто; `check-agents.py` — 0;
`prototypes/check.mjs` — OK (6 предупреждений `ask-name`/`user-name` — прежние,
не от этой правки).

**Публикация и экспорт:** `ap_validate_flow` — 40/40 valid; `ap_lock_and_publish`
→ версия `Phk4zWtWT0iJpVhBom34q` (LOCKED); экспорт MCP
(`tools/export-flow-mcp.py`) обновил `flows/reg-profile.json` и
`flows/_manifest.json`; строка `migrations` `2026-09-27-w119-01` (`version_id`
= `Phk4zWtWT0iJpVhBom34q`). Уточняющий прогон карточки города
(`toWNgbSpF3KcQ06OMbcjw`) прошёл **после** первой публикации и перевёл версию в
`DRAFT` (гоча №14) — флоу опубликован заново и экспорт снят сразу после
публикации, поэтому `flows/reg-profile.json` и `LOCKED`-версия совпадают.

## Журнал

- **2026-09-27** — Пакет взят по прямому запросу владельца (предложение в чате,
  без предварительного пакета BACKLOG — как W107). Решение — ADR-0046;
  городской шаг ADR-0043 уточнён, остальное не трогается.
- **2026-09-27** — Реализация на dev: `reg-profile/step_3` (маршрут `ob:city:*`),
  `step_4` (карточка да/нет + `onb.ask_city_input`), `i18n/{ru,uz,en}.json`,
  платформенные переводы (`onb.ask_city` обновлён; добавлены `onb.ask_city_input`,
  `common.btn.yes`, `common.btn.no` — их на платформе не было, хотя ключи есть в
  корпусе). Старые `ob:city:Tashkent`/`Almaty`/`write` оставлены алиасами: карточка,
  отправленная до правки, может ещё лежать в переписке, а необработанный колбэк дал
  бы молчание. `onb.btn.write` стал архивным ключом (в `i18n` оставлен, как
  `onb.review`).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 ·
  **Вердикт**: есть замечания (блокеров и «важно» нет; три «на будущее»)

### Замечания

1. **на будущее** — в журнале пакета `Статус: в работе`, тогда как
   [STATUS.md](../STATUS.md) (строка W119) и коммит `3d78b14` «W119: на
   проверке» — `на проверке`. По конвенции пакета на этой фазе журнал тоже
   должен быть `на проверке` (у W107 при выходе на ревью, `d527ff9`, стояло
   именно `на проверке`). Косметика учёта, одна строка; не чинить в рамках
   ревью. Где: `docs/work/W119-city-yes-no.md:3`.
   - *Исправлено*: статус журнала — `на проверке` (2026-09-27).

2. **на будущее** — алиасы `ob:city:Tashkent`/`ob:city:Almaty`/`ob:city:write`
   объявлены «на один релиз» ([ADR-0046](../adr/0046-city-question-yes-no-tashkent.md) п. 4),
   но их снятие нигде не отслеживается: ни строки в
   [BACKLOG.md](../BACKLOG.md), ни пункта в
   [OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md). Без учёта они рискуют остаться
   навсегда (новая точка, читающая старый формат, — лишний путь без владельца).
   Записать в бэклог/OPEN-QUESTIONS отдельным пунктом.
   - *Исправлено*: заведён
     [W120](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite)
     («снять алиасы `ob:city:Tashkent/Almaty/write`»); хвост пакета ссылается
     на него (2026-09-27).

3. **на будущее** — утверждение «тексты `onb.ask_city` (ru/uz/en) …
   импортированы в платформенные переводы» живьём подтверждено лишь
   **наличием** ключа, но не его **значением**: `onb.ask_city` — существующий
   ключ, у которого сменилось значение, а ни один прогон не рендерит карточку
   города. `ap_validate_flow` чист и все `step_4`-прогоны успешны (вход `texts`
   резолвит `{{$t[…]}}` целиком, отсутствующий ключ уронил бы шаг) — значит
   ключи ru есть; но увидеть сам текст «Вы из Ташкента?» и подписи «Да»/«Нет»
   ревьюерским набором нельзя (см. ограничения). Закрывается живым
   Telegram-прогоном владельца (уже хвост пакета) — прошу явно сверить
   формулировку карточки города и обе кнопки.
   - *Уточнено*: добавлен прогон `toWNgbSpF3KcQ06OMbcjw` (работа
     `ML-инженер, Payme`, `draft.step=ob_await_work`) — `step_4` отдаёт
     `cardText:'Вы из Ташкента?'` и `replyMarkup`
     `[["Да" ob:city:yes],["Нет" ob:city:no]]`: значение `onb.ask_city` (ru) и
     обе подписи кнопок видны в прогоне, а не только по наличию ключа.
     Значения `uz`/`en` — общий хвост W27 (вычитка носителем), вынесен в
     «Хвосты» пакета (2026-09-27).

### Как проверено и чем это ревью ограничено

**Живой проект (`app-flow-events-dev`, MCP).** `ap_list_flows` — 32 флоу (31
свой + чужой `ChatBot`, известный [Q34](../OPEN-QUESTIONS.md#q34));
`reg-profile` (`bEz2bKyL82zlIwckxqvxc`) — ENABLED/published.
`ap_flow_structure` совпадает с [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md)
по списку и вложенности (trigger, step_1, step_3, step_2, step_4, step_5,
ветки step_6/step_7/step_8→12/step_13→18/step_19→21/step_22→28/step_29→33/
step_35→40), без `invalid` и заглушек. `ap_read_step_code` по `step_3` и
`step_4` — код **побайтово** равен `flows/reg-profile.json` (SHA-256:
`80fc5440…` и `9e0814ab…`); живой `ap_export_flow` отдал тот же `sourceCode`,
`flows[0].id = 2VZri7RTv01XC0yZLB0so`, `flowId = bEz2bKyL82zlIwckxqvxc`,
`state: LOCKED`. Это совпадает с `publishedVersionId` в
`flows/_manifest.json` и с `version_id` строки `migrations`
`2026-09-27-w119-01` (`package W119`, `object flow:reg-profile`, `action
publish`, `commit 775522b`). Структурный диф `flows/reg-profile.json` к
базовой `1622e72` — ровно: `step_4.texts` `+common.btn.yes/no`,
`+onb.ask_city_input` и код `step_3`/`step_4`; `auth`, `connectionIds`,
табличные фильтры не тронуты.

**Различающие прогоны прочитаны, а не приняты на слово** (`ap_list_runs`
flow `reg-profile`, TESTING — 24 прогона):
- `keCdqCVSRJNB3H9OKm6hY` — `step_3`, `ob:city:yes`, `draft.step=ob_city` →
  `action:'finish'`, `city:'Ташкент'`;
- `EqG6L9AkNpKaqgUgmJZGo` — полный прогон, `ob:city:yes`, `eventId:''` →
  `step_4 writeKind:'finish_no_event'`, `profile.city:'Ташкент'`; ROUTER —
  ветка `finish_no_event`; `step_35` записал `users` (`city='Ташкент'`,
  `consent_pdn=true`, `lang='ru'`, `profile_completed_at`); `step_36` — сессия
  `await_marketing`; `step_37/38` — `400 chat not found` (синтетический чат,
  после записи; `step_1` там же падает «query is too old» под
  `continueOnFailure` — ожидаемо и безвредно);
- `WEoHwrF55foiFEeTepXnB` — `step_3`, `ob:city:no` → `action:'show_ask_city'`;
- `RgDb3WiVlmFOL6nFNul74` — полный прогон, `ob:city:no` → `step_4
  writeKind:'card'`, `cardText:'Напишите ваш город\\.'`
  (`onb.ask_city_input`, ru), `nextStep:'ob_await_city'`; `step_8` пишет сессию
  со `step:'ob_await_city'`;
- `lSNyOVVlpczchgMVZDuEI` — текст `Бишкек`, `draft.step=ob_await_city` →
  `step_3 action:'finish'`, `city:'Бишкек'`; `step_4 finish_no_event`;
  `step_35 users.city='Бишкек'`;
- `RYzDMU9OFKx8FdkqMuAK9` — алиас `ob:city:write` → `show_ask_city`.
Прогоны `jI778NLR0WsqgfOKti8di` / `obWXgrnUYzWepy8ee5VRr` действительно
показывают `step_4 writeKind:'ignore'` — прочитан: `step_3` там не выполнялся
(выход `{}`), инструмент взял сохранённый sample; доказательством маршрута не
являются и дефекта не означают (гоча `ap_test_step` на downstream-шаге).

**Чистота таблиц.** По `telegram_id` 888888901–906 (`in` и `co 888888`) в
`users`, `sessions`, `registrations` — пусто; в `registrations` всего три
строки, все с чужими id.

**AppSec.** Пользовательский город (и прочий текст) **не попадает** в
MarkdownV2: в `finish`/`finish_no_event`/`finish_lite` карточка города не
рендерит, `profile.city` идёт только в запись `users`; единственный
пользовательский текст в разметке — `fullName` через `esc(...)`
(`onb.suspect`), а `text_work`/`text_name`/`text` в карточки не подставляются.
Согласие (PAR-1) держится прежним: ветка `consent` пишет `users.consent_pdn`
до первого поля ПД, `finish`/`finish_no_event` — те же записи; W119 этого не
трогает. Криптографии, `sig`/QR, авторизации и IDOR-решений пакет не касается
(диф — `reg-profile` + i18n + docs + прототип). В экспорте секретов нет:
`tools/check-export-secrets.sh` чист, живой `ap_export_flow` значений не
содержит. CSV-инъекция (OWN-8) не применима: `city` в CSV-выгрузку участников
(`manage-api` participants: `telegram_id,name,status,checked_in_at`) не входит.

**Офлайн (запущено мной):** `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0;
`check-commands.py` — 0 нарушений; `check-export-secrets.sh` — чисто (8×
`BOT_TOKEN`, 2× `QR_SIGNING_KEY`, 0 значений `auth`); `check-agents.py` — 0;
`node prototypes/check.mjs` — OK (6 предупреждений `ask-name`/`user-name` —
прежние от ADR-0043; диф W119 их не вводит). `ap_validate_flow` —
40/40 valid, без `translation_key`/`translation_default_locale`.

**Каталог и документы.** `catalog/flows/reg-profile.md` — раздел «Город —
вопрос да/нет (ADR-0046)», шаги/заметки совпадают с живым флоу; SPEC PAR-8
приведён к да/нет со ссылкой на ADR-0046; ADR-0046 есть в
`docs/adr/README.md`; `prototypes/scenarios.js` — город `common.btn.yes/no`,
карточка `onb.ask_city_input`, `ask-city-text`; i18n ru/uz/en —
`onb.ask_city` переписан, `onb.ask_city_input` добавлен. Единственная
расхожая копия `onb.ask_city` — `miniapp/dist/i18n/*.json`, но `miniapp/dist`
не в git (`.gitignore`: `dist/`), это локальный артефакт сборки, не
репозиторий.

**Ограничения ревью.** (1) MCP-инструмента `ap_list_translations` в наборе
нет (тот же пробел, что в W25/W108) — значения платформенных переводов
проверены косвенно (`ap_validate_flow` + успешные `step_4`, резолвящие
`texts`), поэтому замечание 3 выше. (2) Ключа платформы нет —
`tools/check-migrations.py` не запускался; `flows/_manifest.json ↔
ap_list_flows ↔ migrations` сверены точечно по `reg-profile` (совпало), состав
флоу — совпадает. (3) Живого Telegram-чата и `initData` у ревьюера нет, как и
в журнале. (4) Путь «Да» при непустом `eventId` (создание регистрации)
отдельно не перепрогонялся: ветка `finish` W119 не меняет (диф — только
источник города), в W107 она покрыта прогоном `ob:city:Almaty` с событием.

### Круг 2

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 ·
  **Вердикт**: есть замечания (блокеров нет; одно «важно»)

**Все три замечания круга 1 закрыты — проверено по живым артефактам, а не по
записи владельца.**

- *Замечание 1 (статус журнала)*. `docs/work/W119-city-yes-no.md:3` —
  `на проверке`; строка W119 в [STATUS.md](../STATUS.md) — `на проверке`.
  Совпадают.
- *Замечание 2 (алиасы)*. В [BACKLOG.md](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite)
  есть раздел W120 («снять алиасы `ob:city:Tashkent/Almaty/write`») с целью и
  чек-листом: остаться только `ob:city:yes`/`ob:city:no`; каталог и ADR-0046
  больше не называют алиасы живыми; различающий прогон `ob:city:Tashkent` →
  `ignore`; независимое ревью. Раздел «Хвосты» W119 ссылается на W120. Пункт
  круга 1 закрыт.
- *Замечание 3 (значение перевода, не только наличие ключа)*. Прогон
  `toWNgbSpF3KcQ06OMbcjw` прочитан через `ap_get_run`: `step_4` отдаёт
  `cardText: 'Вы из Ташкента?'` и `replyMarkup.inline_keyboard` =
  `[[{"text":"Да","callback_data":"ob:city:yes"},{"text":"Нет","callback_data":"ob:city:no"}]]`,
  `nextStep: 'ob_city'`. Это рендер значения `onb.ask_city` (ru) и подписей
  `common.btn.yes`/`common.btn.no`, а не голое наличие ключа. Прогон помечен
  `FAILED`, но падает на `step_10` (фолбэк-отправка, `400 chat not found` на
  синтетическом чате) — **после** нужного `step_4` и после записи сессии
  `step_8`; для костыля карточки это ожидаемо.

#### Замечания

1. **важно** — живой `ap_export_flow` по `reg-profile` отдаёт **черновик, а не
   опубликованную версию**: `flows[0].id = Phk4zWtWT0iJpVhBom34q`,
   `state: DRAFT`, `created 2026-09-27T17:09:37Z`. Ожидалось
   `2VZri7RTv01XC0yZLB0so` / `state: LOCKED` — так записано в `flows/reg-profile.json`,
   `publishedVersionId` в `flows/_manifest.json` и `version_id` строки
   `migrations` `2026-09-27-w119-01`. Причина — гоча №14: уточняющий прогон
   `toWNgbSpF3KcQ06OMbcjw`, добавленный владельцем под замечание 3, прошёл
   **после** публикации (прогон 17:09 против публикации 16:54 UTC) и перевёл
   последнюю версию флоу в `DRAFT`. Код черновика при этом **побайтово равен**
   опубликованному: SHA-256 `step_3` `80fc5440…` и `step_4` `9e0814ab…` — те же,
   что в `flows/reg-profile.json`. Где: живой `reg-profile` (`app-flow-events-dev`).
   Почему важно: конвенция «черновик = опубликованное» (Q44/[ADR-0021](../adr/0021-repo-is-source-of-truth-migrations-table.md))
   сейчас не выполняется, а раздел «Как проверено» и «Публикация и экспорт»
   этого журнала утверждают `LOCKED` — утверждение стало неверным, как и в W107
   круг 2. Правка — `ap_lock_and_publish` заново и экспорт сразу после неё
   (goto №14), с новой строкой `migrations`; на логику прогонов и опубликованный
   рантайм не влияет (там по-прежнему `2VZri7RTv01XC0yZLB0so`).
   - *Исправлено*: `ap_lock_and_publish` заново → `Phk4zWtWT0iJpVhBom34q`
     (`state: LOCKED`), экспорт снят сразу после публикации
     (`tools/export-flow-mcp.py`), `flows/_manifest.json` и
     `migrations` `2026-09-27-w119-01` (`version_id`) обновлены; журнал
     «Публикация и экспорт» приведён к `Phk4zWtWT0iJpVhBom34q` (2026-09-27).

#### Чем проверено и чем ограничено

**Живой проект (MCP, `app-flow-events-dev`).** `ap_list_flows` — `reg-profile`
(`bEz2bKyL82zlIwckxqvxc`) ENABLED/published; `ap_flow_structure` — 40 шагов,
все `configured`, без `invalid` и заглушек, ветки `step_5` и состав шагов
совпадают с `catalog/flows/reg-profile.md`. `ap_read_step_code` по `step_3` и
`step_4` — SHA-256 совпали с исходниками `flows/reg-profile.json`
(`80fc5440…`/`9e0814ab…`); `ap_validate_flow` — 40/40 valid, без
`translation_key`/`translation_default_locale`. `ap_get_run` по
`toWNgbSpF3KcQ06OMbcjw` — карточка города и обе кнопки (см. замечание 3 выше).
Таблицы чисты: по `telegram_id` 888888901–907 в `users`, `sessions`,
`registrations` — пусто (проверено `in` по семи id и `co 888888`). Офлайн,
запущено мной: `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0;
`check-commands.py` — 0; `check-export-secrets.sh` — чисто (8× `BOT_TOKEN`,
2× `QR_SIGNING_KEY`, 0 значений `auth`); `check-agents.py` — 0;
`node prototypes/check.mjs` — OK (те же 6 прежних предупреждений
`ask-name`/`user-name`, не от W119). Документы согласованы: SPEC PAR-8 (да/нет +
ссылка на ADR-0046), ADR-0046 в `docs/adr/README.md`, `catalog/flows/reg-profile.md`,
`prototypes/scenarios.js` (город `common.btn.yes/no`, карточка `onb.ask_city_input`,
`ask-city-text`), `i18n/{ru,uz,en}.json` (`onb.ask_city` переписан,
`onb.ask_city_input` и `common.btn.yes/no` есть; `onb.btn.write`/`onb.review` —
архив).

**Ограничение.** Ключа платформы нет — `tools/check-migrations.py` не запускался;
сверка `flows/_manifest.json ↔ ap_list_flows ↔ migrations` сделана точечно по
`reg-profile` (совпала по опубликованному id) и неполна без ключа. Живого
Telegram-чата и `initData` у ревьюера нет. Значения `uz`/`en` живьём не сверены
(хвост W27).

### Круг 3

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 ·
  **Вердикт**: есть замечания (блокеров нет; одно «важно»)

**Замечание круга 2 (версия в `DRAFT` после тест-прогона, гоча №14) закрыто —
проверено живьём, а не по записи владельца.**

Живой `ap_export_flow` по `reg-profile` (`bEz2bKyL82zlIwckxqvxc`) отдаёт
`flows[0].id = Phk4zWtWT0iJpVhBom34q`, `state: LOCKED`,
`created 2026-09-27T17:09:37Z`, `updated 2026-09-27T17:16:22Z`,
`flowId = bEz2bKyL82zlIwckxqvxc`. Это совпадает с `publishedVersionId` в
`flows/_manifest.json` (`Phk4zWtWT0iJpVhBom34q`) и с `version_id` строки
`migrations` `2026-09-27-w119-01` (`Phk4zWtWT0iJpVhBom34q`). `ap_list_flows` —
`reg-profile` ENABLED/published. Черновик равен опубликованной версии,
отдельного `DRAFT` нет — гоча №14 закрыта.

#### Замечания

1. **важно** — строка `migrations` `2026-09-27-w119-01` провенансом
   противоречит собственному `version_id`: `version_id = Phk4zWtWT0iJpVhBom34q`
   (версия, опубликованная перепубликацией в коммите `11f3b88`), а
   `commit = 775522b` — коммит **первой** публикации, в чьём
   `flows/_manifest.json` стоит прежняя `2VZri7RTv01XC0yZLB0so`
   (`git show 775522b:flows/_manifest.json`; `git show
   11f3b88:flows/_manifest.json` — уже `Phk…`). По
   `catalog/tables/migrations.md` («`commit` — хэш коммита репозитория,
   описывающего это состояние») и по тому, как та же гоча №14 закрыта в W107
   (`2026-09-26-w107-01`: `version_id EEvBjDZGB51k4ay0vaZd8`,
   `commit bac425b` — и манифест `bac425b` несёт именно `EEvBjDZ…`), здесь
   ожидается `commit = 11f3b88`. `applied_at = 2026-09-27T16:54:09Z` (время
   первой публикации) **не** дефект: в W107 `applied_at` строки `-01` тоже
   оставлено временем первой публикации — обратное датирование `migrations.md`
   допускает. Где: живая таблица `migrations` (`app-flow-events-dev`), запись
   `wxoykib6bbGFofXFi9P44`. Почему важно: `check-migrations.py` сверяет лишь
   `version_id`/`object_id` и существование хэша, поэтому расхождение пройдёт
   мимо него; но таблица — заявленный мост «репозиторий ↔ инстанс», и её строка
   сейчас ссылается на коммит, чей манифест описывает **другую** опубликованную
   версию. Правка — обновить `commit` на `11f3b88` (одно поле); либо, по букве
   «одна публикация — одна строка» `migrations.md`, завести отдельную строку
   `publish` (напр. `2026-09-27-w119-02`) с `version_id Phk…` и
   `commit 11f3b88`, вернув `-01` первую публикацию.
   - *Исправлено*: `migrations` `2026-09-27-w119-01` — `commit` обновлён на
     `11f3b88` (коммит, чей `flows/_manifest.json` несёт `Phk4zWt…`);
     `version_id` и `object_id` уже совпадали. `applied_at` оставлен временем
     первой публикации (как в W107, `migrations.md` это допускает) (2026-09-27).

#### Чем проверено и чем ограничено

**Живой проект (MCP, `app-flow-events-dev`).**
- `ap_export_flow` `reg-profile`: `flows[0].id/state` (см. выше); `flowId`,
  `qadams` — как в каталоге. Полный нормализованный дифф живого экспорта с
  `flows/reg-profile.json` **пуст** (все 40 шагов: `type`/`valid`/`settings.input`/
  `sourceCode`, без учёта sample-данных и `lastUpdatedDate`) — снимок репозитория
  равен живому опубликованному флоу целиком, не только `step_3`/`step_4`.
- `ap_read_step_code` `step_3`/`step_4` — SHA-256
  `80fc5440e2bf735e7046114ff972d580fad36a2db9f2c8b02b23b5bc0769dfd3` /
  `9e0814abe8e95544421fcfcc1c199430fd54f15f8df2627a1b97fc8538888616` — совпали
  с `flows/reg-profile.json` (те же, что в круге 1). `ap_validate_flow` —
  `40/40 valid`, без `translation_key`/`translation_default_locale`.
- `ap_flow_structure` — 40 шагов, все `configured`, без `invalid`/заглушек;
  состав и вложенность (ветки `step_5`, цепочки `step_8→12`, `13→18`, `19→21`,
  `22→28`, `29→33`, `35→40`) совпадают с `catalog/flows/reg-profile.md`.
- `ap_list_runs` (TESTING, 25 прогонов) — все семь W119-прогонов на месте.
  `ap_get_run toWNgbSpF3KcQ06OMbcjw`: `step_4`
  `cardText:'Вы из Ташкента?'`, `replyMarkup` =
  `[[{"text":"Да","callback_data":"ob:city:yes"},{"text":"Нет","callback_data":"ob:city:no"}]]`,
  `nextStep:'ob_city'` (замечание 3 круга 1). Дополнительно прочитан
  `RgDb3WiVlmFOL6nFNul74` (`ob:city:no`): `step_4`
  `cardText:'Напишите ваш город\\.'` (`onb.ask_city_input`), сессия
  `step:'ob_await_city'` (`step_8`). Оба прогона помечены `FAILED`/`step_1 ❌`,
  но падают на фолбэк-отправке в синтетический чат (`400 chat not found` и
  `query is too old` под `continueOnFailure`) — **после** нужных `step_4`/`step_8`.
- Таблицы чисты: `in` по `telegram_id` 888888901–907 и `co 888888` в `users`,
  `sessions`, `registrations` — пусто (записи от прогонов `toWNgb`/`RgDb3`,
  видимые в их `step_8`, удалены).
- Документы согласованы: журнал `Статус: на проверке`; `docs/STATUS.md` (W119) —
  `на проверке` с `Phk4zWt…`; SPEC PAR-8 (да/нет + ссылка на ADR-0046);
  `docs/adr/README.md` (0046); `catalog/flows/reg-profile.md`;
  `prototypes/scenarios.js` (`common.btn.yes/no`, `onb.ask_city_input`,
  `ask-city-text`); `i18n/{ru,uz,en}.json` — `onb.ask_city` переписан,
  `onb.ask_city_input`/`common.btn.yes`/`common.btn.no` есть, `onb.btn.write` —
  архив. [W120](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite) в
  BACKLOG на месте.
- `flows/_manifest.json`: 31 запись, имена совпадают с 31 «своим» флоу
  `ap_list_flows` (плюс чужой `ChatBot`, известный Q34).

**Офлайн (запущено мной).** `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0;
`check-commands.py` — 0; `check-export-secrets.sh` — чисто (8× `BOT_TOKEN`,
2× `QR_SIGNING_KEY`, 0 значений `auth`); `check-agents.py` — 0;
`node prototypes/check.mjs` — OK (те же 6 прежних предупреждений
`ask-name`/`user-name`, не от W119).

**Ограничение.** Ключа платформы нет — `tools/check-migrations.py` не
запускался; `flows/_manifest.json ↔ ap_list_flows ↔ migrations` сверены точечно
(по `reg-profile` совпало, по составу флоу — 31/31). Значения `uz`/`en` живьём
не сверены (общий хвост W27; `ru` доказан рендером карточки). Живого
Telegram-чата и `initData` у ревьюера нет. Путь «Да» при непустом `eventId`
(создание регистрации) отдельно не перепрогонялся: ветку `finish` W119 не
меняет, а код `step_3`/`step_4` побайтово тот же, что прочитан в кругах 1–2.

### Круг 4

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 ·
  **Вердикт**: замечаний нет

**Замечание круга 3 (провенанс строки `migrations`) закрыто — проверено
живьём, а не по записи владельца.**

Живая строка `migrations` `2026-09-27-w119-01` (`app-flow-events-dev`, запись
`wxoykib6bbGFofXFi9P44`, `package W119`, `object flow:reg-profile`):
`commit = 11f3b88`, `version_id = Phk4zWtWT0iJpVhBom34q`,
`object_id = bEz2bKyL82zlIwckxqvxc`, `action = publish`,
`applied_at = 2026-09-27T16:54:09Z`. `git show 11f3b88:flows/_manifest.json`
действительно несёт `publishedVersionId = Phk4zWtWT0iJpVhBom34q` для
`reg-profile`, а `git show 775522b:flows/_manifest.json` — прежний
`2VZri7RTv01XC0yZLB0so`. Конвенция подтверждена и живым прецедентом W107:
строка `2026-09-26-w107-01` (`version_id EEvBjDZGB51k4ay0vaZd8`,
`commit bac425b`), и `git show bac425b:flows/_manifest.json` несёт именно
`EEvBjDZ…`. `applied_at`, оставленный временем первой публикации, — допустимое
обратное датирование ([migrations.md](../../catalog/tables/migrations.md)), как
и в W107.

#### Замечания

Замечаний нет.

#### Чем проверено и чем ограничено

**Живой проект (MCP, `app-flow-events-dev`).**
- `ap_export_flow` `reg-profile`: `flows[0].id = Phk4zWtWT0iJpVhBom34q`,
  `state: LOCKED`, `flowId = bEz2bKyL82zlIwckxqvxc`; совпадает с
  `publishedVersionId` в `flows/_manifest.json` и `version_id` строки
  `migrations` `2026-09-27-w119-01`. `ap_list_flows` — `reg-profile`
  ENABLED/published.
- `ap_validate_flow` — `40/40 valid`, без `translation_key`/`translation_default_locale`.
- `ap_read_step_code` `step_3`/`step_4` — SHA-256 `80fc5440…`/`9e0814ab…`,
  совпали с `flows/reg-profile.json`; полный нормализованный дифф живого
  экспорта с `flows/reg-profile.json` **пуст** (41 узел — `type`/
  `settings.input`/`sourceCode`, включая `step_3`/`step_4`): снимок репозитория
  равен живому опубликованному флоу целиком.
- `ap_flow_structure` — 40 шагов, все `configured`, без `invalid`/заглушек;
  состав и вложенность (ветки `step_5` 0–7, `step_6`, `step_7`, `step_8→12`,
  `13→18`, `19→21`, `22→28`, `29→33`, `35→40`) совпадают с
  `catalog/flows/reg-profile.md`.
- `ap_list_runs` (TESTING, 25 прогонов) — последний W119-прогон
  `toWNgbSpF3KcQ06OMbcjw` (17:09:37) прошёл **до** перепубликации версии
  (17:16:22); после неё прогонов нет, свежего `DRAFT` не создано — гоча №14
  закрыта. `ap_get_run toWNgbSpF3KcQ06OMbcjw`: `step_4` отдаёт
  `cardText: 'Вы из Ташкента?'` и `replyMarkup` =
  `[[{"text":"Да","callback_data":"ob:city:yes"},{"text":"Нет","callback_data":"ob:city:no"}]]`,
  `nextStep:'ob_city'`; `step_8` пишет сессию `step:'ob_city'`; падает позже
  на фолбэк-отправке (`400 chat not found`) — после нужных шагов.
- Таблицы чисты: `in` по `telegram_id` 888888901–907 и `co 888888` в `users`,
  `sessions`, `registrations` — пусто; в `registrations` 3 строки, все с
  чужими id.

**Офлайн (запущено мной).** `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0;
`check-commands.py` — 0; `check-export-secrets.sh` — чисто (8× `BOT_TOKEN`,
2× `QR_SIGNING_KEY`, 0 значений `auth`); `check-agents.py` — 0;
`node prototypes/check.mjs` — OK (те же 6 прежних предупреждений
`ask-name`/`user-name`, не от W119).

**Документы.** SPEC PAR-8 (да/нет + ссылка на ADR-0046), `docs/adr/README.md`
(0046), `catalog/flows/reg-profile.md` (раздел «Город — вопрос да/нет
(ADR-0046)»), `prototypes/scenarios.js` (`common.btn.yes/no`,
`onb.ask_city_input`, `ask-city-text`), `i18n/{ru,uz,en}.json` (`onb.ask_city`
переписан, `onb.ask_city_input`/`common.btn.yes/no` есть, `onb.btn.write` —
архив) — согласованы; журнал (`Статус: на проверке`) и строка W119 в
`docs/STATUS.md` совпадают.

**Ограничение.** Ключа платформы нет — `tools/check-migrations.py` не
запускался; `flows/_manifest.json ↔ ap_list_flows ↔ migrations` сверены точечно
(по `reg-profile` совпало; состав — 31/31 + чужой `ChatBot`, [Q34](../OPEN-QUESTIONS.md#q34)).
Значения `uz`/`en` живьём не сверены (общий хвост W27; `ru` доказан рендером
карточки `toWNgbSpF3KcQ06OMbcjw`). Живого Telegram-чата и `initData` у ревьюера
нет. Путь «Да» при непустом `eventId` (создание регистрации) отдельно не
перепрогонялся: ветку `finish` W119 не меняет.

## Хвосты и блокеры

- Перенос на prod — отдельным хотфиксом (ADR-0042).
- Живой прогон в Telegram — за владельцем.
- Снятие алиасов `ob:city:Tashkent`/`Almaty`/`write` — [W120](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite).
- Значения переводов `uz`/`en` живьём не сверены (общий хвост W27 — вычитка
  носителем); `ru` доказан рендером карточки (`toWNgbSpF3KcQ06OMbcjw`).
