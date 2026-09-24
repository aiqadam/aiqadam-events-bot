# W102. Аудит `eq`-фильтров с необязательным значением (хвост W101)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн — хвост W101, решение владельца «добей хвосты» 2026-09-24
- **Зависит от**: W101 (та же причина — платформенный fail-closed на пустом `eq`)
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

Платформа fail-closed отклоняет пустое значение `eq` в `tables-find-records`
(`Filter #N: the "eq" operator on field "<f>" requires a value`). W101 закрыл
`reg-api`; остались другие флоу с тем же классом. Пройтись по всем
`tables-find-records` и убрать пустые значения фильтров там, где они
достижимы, не меняя поведение при непустых данных.

## Аудит

Полный обход `flows/*.json` (87 фильтров). Итог:

| Класс | Шаги | Вердикт |
|---|---|---|
| Публичный вебхук, `body.eventId` не валидируется | `checkin-api/step_3`, `checkin-api/step_13`, `checkin-counter-api/step_3`, `checkin-counter-api/step_4` | **чинить** |
| Публичный вебхук, нет валидности `parse` | `checkin-api/step_6` (`userId` из `fn-parse-start`) | **чинить** |
| Публичный вебхук, нет гейта `initData` | `staff-events-api/step_2` | **чинить** |
| Внутренний, no-event онбординг | `reg-profile/step_2` (`eventId:''` из draft — штатный путь menu) | **чинить** |
| Внутренний, `continueOnFailure=true` (смягчено) | `reg-consent-pdn/step_6`, `reg-consent-mkt/step_4` | **чинить** |
| Crafted callback (недостижим без bot token) | `bcast-step/step_5,13,27,37` | принято (не чиним) |
| Теоретический `valid=true` без `user` (недостижим) | все `telegram_id eq data.telegramId` после гейта | принято (не чиним) |
| Уже безопасно (сентинелы) | `fn-find-registration`, `bcast-run`, `lifecycle`, `reminders`, `reg-api`, `manage-api`, `staff-invite`, `reg-afterword` | не трогаем |
| Значение не может быть пустым | `menu`, `reg-start`, `staff-accept`, `tg-router`, `bcast-draft`, `bcast-unsub`, `events-api`, `feedback-api` (гейт `load`) | не трогаем |

## Правка

Приём тот же, что в W101: непустой sentinel `__none__` из Code-шага;
`register`/непустые пути не меняются (`sentinel === value`).

1. `checkin-api` — новый CODE `step_14` после `step_1` (`eventIdOrNone`) и
   CODE `step_15` после `step_2` (`userIdOrNone`); фильтры `step_3`/`step_13`
   → `eventIdOrNone`, `step_6` → `userIdOrNone`.
2. `checkin-counter-api` — новый CODE `step_9` после `step_1`; фильтры
   `step_3`/`step_4` → `eventIdOrNone`.
3. `staff-events-api` — новый CODE `step_6` после `step_1`; фильтр `step_2`
   → `telegramIdOrNone`.
4. `reg-profile` — `step_3` отдаёт `eventIdOrNone`; фильтр `step_2` → он же.
5. `reg-consent-pdn` — `step_2` отдаёт `eventIdOrNone`; фильтр `step_6` → он же.
6. `reg-consent-mkt` — `step_2` отдаёт `eventIdOrNone`; фильтр `step_4` → он же.

## Что построено

| flow | version id (publish) | Что изменено |
|------|----------------------|--------------|
| `checkin-api` (`rKoDYtiIVdbzlW59b57uH`) | `u3Owwfcc9NltCLlLiCfd9` | +CODE `step_14` (`eventIdOrNone`), +CODE `step_15` (`userIdOrNone`); фильтры `step_3`/`step_13`/`step_6` |
| `checkin-counter-api` (`lm9S9cRuSZOpVAgl2h44R`) | `2xKbbF8UFnMG6ajKBTg5M` | +CODE `step_9` (`eventIdOrNone`); фильтры `step_3`/`step_4` |
| `staff-events-api` (`Ok7iXvrnJUUzNcR5OwH8x`) | `B3QZyGQCC9RtlYT3noUtg` | +CODE `step_6` (`telegramIdOrNone`); фильтр `step_2` |
| `reg-profile` (`5U3Kv0cSrnvDTrbictA4L`) | `HAeSmWAMGEqsf0M1uiVqu` | `step_3` отдаёт `eventIdOrNone`; фильтр `step_2` |
| `reg-consent-pdn` (`vQJDQ8NecB1PleIFrq07O`) | `M5IVJfolzEGQ5p5QGqvRC` | `step_2` отдаёт `eventIdOrNone`; фильтр `step_6` |
| `reg-consent-mkt` (`3gLF6TcbpFObHONATQ64N`) | `uqCr7IxmvvhJrYe8nyYuH` | `step_2` отдаёт `eventIdOrNone`; фильтр `step_4` |

Каталоги — `catalog/flows/<name>.md`; экспорт — `flows/*.json` + `_manifest.json`.

## Чек-лист готовности

- [x] `ap_validate_flow` чист по каждому из 6 флоу
- [x] пустой `eventId`/`userId` больше не валит шаг (живой/различающий прогон)
- [x] непустые пути без регресса
- [x] `flows/*.json` + `_manifest.json` перегенерены тем же коммитом
- [x] `catalog/flows/*.md` отражают живой проект; гоча в `AGENTS.md` (W101) дополнена
- [x] строки `publish` в `migrations`
- [x] офлайн-проверки зелёные
- [x] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

- **`checkin-api`** (живой `curl /sync`, `initData` владельца, окно 12 ч):
  - `eventId: ""`, `payload: "c demo-1-x"` → `403 forbidden` (было `500`);
  - `eventId: "demo"`, `payload: "notaqr"` → `403 forbidden`, прогон
    `q0XPjE3xoRmoxf9ifJmBW`: `step_14.eventIdOrNone="demo"`,
    `step_2.data.userId=""`, `step_15.userIdOrNone="__none__"`,
    `step_3=[]`, `step_6=[]` (**без падения**), `step_13=[]`.
- **`checkin-counter-api`**: `initData` валиден, `eventId: ""` → `403 forbidden`
  (было `500`).
- **`staff-events-api`**: `initData: "garbage"` → `401 {ok:false}`
  (было `500`); `step_6.telegramIdOrNone="__none__"` → `step_2=[]` →
  `step_4` отдаёт `401`, как задумано.
- **`reg-profile` / `reg-consent-pdn` / `reg-consent-mkt`**: фильтр
  `events.id eq __none__` → `[]`, `events.id eq mu9rqipgetmp` → строка
  (`ap_run_action`); код шагов и структура сверены, `ap_validate_flow` чист.
  Живой онбординг требует Telegram-пользователя — хвост.
- **Регресс**: `checkin-api` с непустым `eventId` (`step_3`/`step_13`
  получили `eventIdOrNone === eventId`); `register`/`cancel`/`mine` `reg-api`
  не трогались.

## Журнал

- **2026-09-24** — аудит `flows/*.json` (explore-агент) + ручная сверка
  подозрительных мест через MCP. Подтверждён штатный путь поломки
  `reg-profile/step_2` (онбординг без события из menu, `draft.eventId:''`).
  Приняты как недостижимые без bot token: crafted `callback_data` в
  `bcast-step` и подписанный `initData` без `user` (фильтры по
  `data.telegramId` после гейта) — записаны в хвост.

## Ревью

- **Ревьюер**: review-agent (deepseek-v4.1-flash), **дата**: 2026-09-24
- **Вердикт**: есть замечания — блокеров и «важно» нет, два «на будущее»

### Что сверено

- **Живой проект (MCP)**: `ap_flow_structure` + `includeInput` по всем шести
  флоу; `ap_read_step_code` по добавленным/изменённым CODE-шагам
  (`checkin-api/step_14,15,7`, `checkin-counter-api/step_9,5`,
  `staff-events-api/step_6,4`, `reg-profile/step_3`,
  `reg-consent-pdn/step_2,7`, `reg-consent-mkt/step_2,5`);
  `ap_validate_flow` — 6/6 «ready to publish»; `ap_list_flows` — все шесть
  ENABLED/published. `ap_export_flow` по `checkin-api`:
  `flows[0].id == u3Owwfcc9NltCLlLiCfd9` (= `_manifest.json`), `state: LOCKED`.
  Версии остальных пяти сверены по `migrations` + `_manifest.json` (ключ
  платформы в среде отсутствует, `tools/check-migrations.py` не запускается —
  шаг 0.7 ROADMAP), а сами изменения подтверждены живой структурой.
- **Сентинелы**: во всех шести флоу значение фильтра — `XOrNone`, причём
  `XOrNone === X` при непустом `X` (в `checkin-api`/`checkin-counter-api`/
  `staff-events-api` — с точностью до `.trim()`, на реальных id/telegram_id
  неотличимо). Сентинел никуда не пишется: в `regId`/`registrations` уходит
  сырой `eventId`, в фильтры — только `…OrNone`. Поведение при непустом
  не меняется.
- **Топология и ссылки**: `step_14`/`step_15` (`checkin-api`), `step_9`
  (`checkin-counter-api`), `step_6` (`staff-events-api`) вставлены линейно в
  верное место цепочки, старые рёбра перелинкованы (не осталось безусловного
  продолжения — гоча №10 не проявилась); ссылки `{{stepN['output'].…}}`
  разрешаются, `ap_validate_flow` чист. Семантический диф `flows/*.json`
  (`719d160^`↔`719d160`) по всем шести флоу — только заявленные правки
  (новые CODE-шаги и ссылки в фильтрах); посторонних изменений нет. Пропажа
  `"value": ""` у `not_exists` — разница сериализации MCP-снимка, не логика.
- **Прогоны прочитаны, а не приняты на слово**: `checkin-api`
  `q0XPjE3xoRmoxf9ifJmBW` (пустой `eventId` → `step_14=__none__`, битый QR →
  `step_15=__none__`, `step_3/6/13=[]`, `403 forbidden`) и
  `dqv6K7GUiAF4W1XfCN8mG`; `checkin-counter-api` `absLo34oCoEG57C2Vn42e`
  (`step_9=__none__` → `403`); `staff-events-api` `vqcDOYg6SMnUb5pfrhmB5`
  (`initData:"garbage"` → `step_6=__none__` → `step_2=[]` → `401`) и
  `hqgvLkaJxriI88rqmdKSJ` (валидный `initData` — непустой путь `step_6`).
- **Аудит полноты**: сплошной обход `flows/*.json` — 78 `eq`-фильтров. Все
  значения, достижимо пустые, либо закрыты сентинелами, либо берутся из
  проверенного источника (`initData`, апдейта бота, валидированного slug).
  Выборочно прочитаны «уже безопасные»: `fn-find-registration/step_1`
  (`queryEventId/queryTelegramId` → `-`), `manage-api/step_5`
  (`eventId` → `-`), `staff-invite/step_1` (`eventId` → `-`),
  `feedback-api/step_6` (гейт `!telegramId || !eventId || !attended`),
  `bcast-run/step_2/4` (`eventIdOrNone`, `bid` только при `found`),
  `tg-router/step_10` (`reg_start`/`staff_accept` только на валидный slug) —
  сентинелы/гейты на месте. Принятый класс crafted-`callback_data`
  (`bcast-step/step_5,13,27,37`) подтверждён: подделать `callback_data` без
  bot token нельзя. Пропущенного достижимого пустого `eq` не найдено.
- **Репозиторий**: `flows/*.json` и `_manifest.json` обновлены тем же
  коммитом; `migrations` — 6 строк `publish` W102, `version_id` совпадают с
  манифестом (и с заданием); офлайн-проверки `check-export-secrets.sh`,
  `check-texts.py`, `check-commands.py`, `check-agents.py` — зелёные (0
  расхождений). AppSec-гейты не ослаблены: STF-2 по-прежнему по конкретному
  `event_id` + `telegram_id` из `initData` (`checkin-api/step_3`), проекции
  ПД (`step_6` — `first_name`, `step_13` — `status`) не расширены,
  `revoked_at not_exists` на месте, новых чтений ПД нет.

### Замечания

1. **на будущее** — сентинел `__none__` для `eventId` формально **валиден**
   (`^[A-Za-z0-9_]{1,12}$`), в отличие от проектного `-`, и событие с `id:
   __none__` создаётся через `manage-api`; тогда `id eq __none__` совпадёт с
   реальной строкой. Практического обхода не найдено: в
   `checkin-api`/`checkin-counter-api` успех требует совпадения `eventId` из
   **подписанного** QR с запрошенным, а `telegram_id` числовой; в
   `reg-profile` ветвление идёт по сырому `eventId`, не по `…OrNone`. Цена —
   теоретическое совпадение в `reg-consent-mkt` (в карточку может попасть
   чужое событие `__none__`) и в `reg-profile` (без последствий — `eventFacts`
   в `finish_no_event` не используется). Не блокер: конвенция унаследована от
   W101, обхода нет. Предложение: зарезервировать `__none__` (проверять форму
   ключа на входе `manage-api`) либо использовать для `eventId` не-слаговый
   сентинел; правило «сентинел — не валидный ключ» из
   [REVIEW-CHECKLIST](../../docs/work/REVIEW-CHECKLIST.md) п. 4.1 записать в
   `AGENTS.md`. Где: `checkin-api/step_14`, `checkin-counter-api/step_9`,
   `reg-profile/step_3`, `reg-consent-pdn/step_2`, `reg-consent-mkt/step_2`.
   - *Принято (конвенция)*: `__none__` — уже принятый в проекте сентинел
     (`lifecycle`/`bcast-step`/`reg-api`); обхода нет, а совпадение требует,
     чтобы владелец завёл событие с id ровно `__none__` (id нового события —
     клиентский `newId` под `SLUG = ^[A-Za-z0-9_]{1,12}$`). `__none__`
     объявлен зарезервированным в `AGENTS.md`; вытеснение сентинела на
     не-слаговый (`-`) — хвост, если решим унифицировать (2026-09-24).

2. **на будущее** — каталог `catalog/flows/checkin-api.md` (заметка о фикстуре
   `demo`) не соответствует живому проекту: в `events` нет события `demo`
   (только `mu9rqipgetmp`/`mu9uzchnu2il`), в `event_staff` нет строки
   `demo`/`322876545` (единственная — `mu9rqipgetmp`/`5895728710`), в
   `registrations` нет `demo-322876545`. Расхождение **не внесено W102** (строка
   из W91-эпохи, диф `719d160` её не трогал), но бьёт по доказательной базе:
   позитивный различающий прогон STF-2 на версии W102 не сделан — все живые
   прогоны `checkin-api`/`checkin-counter-api`/`staff-events-api` показывают
   только отказ, потому что staff-фикстуры для владельца нет. Для непустых
   значений поведение доказано сохраняется (`eventIdOrNone === eventId` видно
   в `q0XP…`), регресса нет; каталог надо привести в соответствие — либо
   восстановить фикстуру и снять позитивный прогон, либо убрать неверную
   заметку. Замечание к каталогу, не к логике W102.
   - *Исправлено*: устаревшую заметку про фикстуру `demo` убрал из
     `catalog/flows/checkin-api.md` (2026-09-24). Позитивный различающий
     прогон STF-2 на непустом `eventId` — хвост: нужен Telegram-пользователь,
     заведённый в `event_staff` (в текущем снимке такого нет).

### Итог

Заявленное выполнено: пустой `eq` в шести флоу убран сентинелами, непустые
пути не изменились, топология и ссылки целы, `ap_validate_flow` чист,
каталог/экспорт/манифест/`migrations` согласованы, AppSec-гейты (STF-2/IDOR/
владелец `initData`) не ослаблены, аудит полноты не нашёл пропущенного
достижимого пустого `eq`. Блокеров и «важно» нет; два замечания — «на
будущее», одно из них предсуществующее (каталог).

## Хвосты и блокеры

- **Живой онбординг без события** (`reg-profile` → `reg-consent-*`) не
  прогнан end-to-end: нужен Telegram-пользователь без профиля (онбординг
  запускается из чата). Логика закрыта чтением кода, `ap_validate_flow` и
  различающим `ap_run_action` по фильтру; живой позитив — хвост на W15.
- **Принято как недостижимое без bot token:** crafted `callback_data` в
  `bcast-step` (`step_5/13/27/37`); `valid=true` без `user` в подписанном
  `initData` (фильтры по `data.telegramId` после гейта в `manage-api`,
  `reg-api`, `checkin-api`, `checkin-counter-api`). Пользователь не может
  подделать `callback_data`, а подписанный `initData` без `user` требует
  bot token — не чиним.
- **Позитивный различающий прогон STF-2** (непустой `eventId`, контролёр —
  staff этого события) не снят: нужен Telegram-пользователь, заведённый в
  `event_staff`; в снимке инстанса такой есть только у `5895728710`. Хвост
  на приёмку W15.
- **Унификация сентинела `eventId`** на не-слаговый (`-`) — «на будущее»
  ревью круг 1; сейчас `__none__` зарезервирован в `AGENTS.md`.
- `tools/check-migrations.py` без ключа платформы в среде — сверка
  manifest ↔ `ap_export_flow` ↔ `migrations` вручную; автопроверка — на W15.
