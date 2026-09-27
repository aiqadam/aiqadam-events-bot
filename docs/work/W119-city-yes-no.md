# W119. Город в онбординге: «Вы из Ташкента?» вместо списка городов

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W107 / ADR-0043 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: —

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
- [ ] независимое ревью, вердикт «замечаний нет».

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
→ версия `2VZri7RTv01XC0yZLB0so` (LOCKED); экспорт MCP
(`tools/export-flow-mcp.py`) обновил `flows/reg-profile.json` и
`flows/_manifest.json`; строка `migrations` `2026-09-27-w119-01`.

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

## Хвосты и блокеры

- Перенос на prod — отдельным хотфиксом (ADR-0042).
- Живой прогон в Telegram — за владельцем.
- Снятие алиасов `ob:city:Tashkent`/`Almaty`/`write` — [W120](../BACKLOG.md#w120-снять-алиасы-obcitytashkentalmatywrite).
- Значения переводов `uz`/`en` живьём не сверены (общий хвост W27 — вычитка
  носителем); `ru` доказан рендером карточки (`toWNgbSpF3KcQ06OMbcjw`).
