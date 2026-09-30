# W131. Онлайн-событие: UX без QR

- **Статус**: готов
- **Владелец**: агент
- **Волна**: не в волне (хвост W67)
- **Зависит от**: W67 — ✅ 2026-09-29
- **Начат**: 2026-09-29 · **Закрыт**: 2026-09-29

## Цель

Убрать QR-язык с онлайн-событий и лишнюю кнопку из напоминания. Подробности —
[BACKLOG.md](../BACKLOG.md#w131-онлайн-событие-ux-без-qr), дизайн —
[ADR-0053](../adr/0053-online-event-no-qr-wording.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `events-api` | `7MSsiJX1OJM9jcvZoU7g5` | [catalog/flows/events-api.md](../../catalog/flows/events-api.md) |
| flow `reminders` | `5JiN4gJgdh8ItkzUqVnTf` | [catalog/flows/reminders.md](../../catalog/flows/reminders.md) |
| flow `reg-api` | `SmutybV5qJQjQASJGY9vi` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| flow `reg-start` | `furNEp5R3KFZ2jdSni2Eu` | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| flow `reg-consent-mkt` | `uOKODGfZjyhNbED320cjz` | [catalog/flows/reg-consent-mkt.md](../../catalog/flows/reg-consent-mkt.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w131-онлайн-событие-ux-без-qr).

- [x] `reminders/step_8`: онлайн — одна кнопка; текст без ссылки не обещает кнопку;
- [x] `format` в публичном `events-api`; карточка и «Мои билеты» без «Показать QR»;
- [x] билет-сообщение и `reg.already` на онлайне без QR;
- [x] экран билета на онлайне без карты/адреса, заголовок/ошибки без QR;
- [x] офлайн-проверки и сборка зелёные;
- [x] `catalog/` совпадает; экспорт и `migrations` тем же PR;
- [x] независимое ревью, «замечаний нет» (круг 2).

## Как проверено

- **Живой проект (MCP):** `ap_validate_flow` по шести флоу — `reminders`,
  `events-api`, `reg-api`, `reg-start`, `reg-profile`, `reg-consent-mkt` — все
  `valid`, ошибок перевода нет; `ap_lock_and_publish` каждого, экспорт
  `ap_export_flow` сразу после публикации (гоча 14), дерево в экспорте
  (`flows/*.json`) несёт новый код/колонки.
- **Ключ `reg.qr.button`** до импорта отсутствовал в платформенных переводах
  (использовался только в Mini App) — `ap_validate_flow` `reg-start` его
  назвал; импортирован, повторная валидация чистая. Поймано валидатором, а не
  прогоном.
- **Офлайн:** `check-export-secrets.sh` 0; `check-texts.py` 305 ссылок, 0
  расхождений; `check-commands.py` 0; `check-agents.py` 0; `prototypes/check.mjs`
  OK; `miniapp npm run build` OK.
- **Логика напоминания** (по коду): онлайн со ссылкой → одна кнопка «Открыть
  трансляцию»; онлайн без ссылки → одна «Открыть билет» и текст
  `remind.*_online_pending`; офлайн → «Открыть билет» + «Как добраться».
- **`check-migrations.py`** без ключа платформы не гоняется (шаг 0.7) — сверку
  манифест↔инстанс↔`migrations` по шести флоу делает ревьюер.
- **Хвост:** живой e2e в Telegram (владелец) — на онлайне со ссылкой и без неё,
  карточка каталога, «Мои билеты», билет-сообщение.

## Журнал

- **2026-09-29** — пакет взят. Аудит UX (жалоба владельца): (1) `reminders/step_8`
  на онлайне кладёт и «Открыть билет», и «Открыть трансляцию»; (2) QR-язык на
  онлайне в карточке каталога и «Моих билетах» (`Events.tsx`), шите регистрации,
  билет-сообщении (`reg-profile`, `reg-consent-mkt`), `reg.already`
  (`reg-start`, `reg-api`), заголовке/ошибках `Ticket.tsx`. Корень для
  Mini App — `events-api` не отдаёт `format`.

- **2026-09-29** — реализация. `reminders/step_8` — одна кнопка на онлайн, тексты
  `remind.*_online_pending`; `events-api` — `format` в проекции и в `item`;
  `reg-api/step_8` (+колонка) и `step_9` — `reg.already_online`; `reg-start`
  `step_3` (+`format` в вывод), `step_7` (текст и надпись кнопки), `step_8`
  (надпись из `step_7`); `reg-profile/step_2` (+колонка) и `step_4`
  (`ticket.hint_online`); `reg-consent-mkt/step_4` (+колонка) и `step_5` (то же).
  Mini App: `Events.tsx` (тип `format`, карточка, «Мои билеты», шит регистрации),
  `Ticket.tsx` (заголовок, скрытие карты/адреса на онлайне). Шесть публикаций,
  экспорт MCP, шесть строк `migrations`.
- **2026-09-29** — `texts` CODE-шагов шлются полной картой: частичная замена
  стирает остальные ключи (гоча 12). Проверял сверкой живого экспорта с
  `i18n/ru.json` — `check-texts.py` 305/0.

## Ревью

- **Ревьюер**: субагент-ревьюер (opencode, deepseek-v4.1-flash) · **Дата**: 2026-09-29 · **Вердикт**: есть замечания

Проверен живой `events-dev` (проект `vZXlkfz60dx6kX97yICx7`): `ap_flow_structure(includeInput)`
и `ap_read_step_code` по шести флоу, `ap_validate_flow` (6/6 valid; `reg-api` — 45 valid +
1 skipped `step_12`, W60), `ap_export_flow` ↔ `_manifest.json` ↔ `migrations`, схема `events`
(`format` = `8bBZDyWWWFBV311w5lPY7`, `online_url` = `ko1bekdWsaspUtTydMee1`), публичный
`events-api` и `my-qr-api`. Офлайн-проверки прогнаны самому: `check-export-secrets.sh` — 0,
`check-texts.py` — 31 флоу / 305 ссылок / 0, `check-commands.py` — 0, `check-agents.py` — 0,
`node prototypes/check.mjs` — OK, `miniapp npm run build` — OK. `check-migrations.py` не
запускается (`QADAM_API_KEY` не задан, Keychain на Linux нет) — сверку манифест↔инстанс↔
`migrations` сделал вручную, она сходится (см. ниже); это ограничение, а не «пройдено».

**Что подтверждено живым:**

- `reminders/step_8` — онлайн ровно **одна** кнопка: со ссылкой `remind.btn.stream` (`url`),
  без неё `ticket.btn.open` (`web_app`); текст `remind.*_online_pending` кнопку трансляции не
  обещает; офлайн — прежние две. Код и набор ключей `texts` совпали с `flows/reminders.json`
  (порядок ключей в экспорте иной — на смысл не влияет).
- `events-api/step_1` читает `format`, `step_2.item()` отдаёт `format`; `online_url` в проекции
  и в выдаче **нет**. Свежий `ap_export_flow` дал `flows[0].id = lj27awI9gVSJtRctXdcyf` —
  равен `publishedVersionId` манифеста.
- `reg-api/step_8` читает `format`, `step_9` при `existing` отдаёт `reg.already_online`, если
  `ev.format === 'online'`.
- `reg-start/step_3` отдаёт `format` в ветке `existing`, `step_7` выбирает текст и надпись
  (`ticket.btn.open` онлайн / `reg.qr.button` офлайн), `step_8` подставляет
  `{{step_7['output'].btn}}`; `reg.qr.button` резолвится — валидация `reg-start` чистая.
- `reg-profile/step_2` и `reg-consent-mkt/step_4` читают `format`, `reg-profile/step_4` и
  `reg-consent-mkt/step_5` берут `ticket.hint_online` при `format=online`.
- Mini App: `Events.tsx` в трёх местах (карточка, «Мои билеты», шит успеха) на онлайне зовёт
  `ticket.btn.open` / `reg.done.hint_online`; `format` приходит из каталога (`eventsById`),
  строке `mine` он не нужен. `Ticket.tsx` — заголовок `ticket.title_online`, QR-плита, адрес
  и карта скрыты при `online`; `online` — из ответа `my-qr-api`.
- AppSec: ссылки трансляции в публичном каталоге нет (её нет в проекции), `my-qr-api` отдаёт
  `url` только при `found && registered && online`; `format` — не ПД; авторизация
  `reg-api`/`reg-start` не тронута (диф — только проекция события и выбор текста).
- `migrations`: шесть строк `2026-09-29-w131-01…06` — `version_id` совпадают с
  `flows/_manifest.json` (`reminders Qzq0…`, `events-api lj27…`, `reg-api xbe7…`,
  `reg-start r9AI…`, `reg-profile nfu3…`, `reg-consent-mkt vsTi…`); `commit: '-'` — та же
  конвенция, что у публикаций W67 через MCP.

### Замечания

1. **важно.** `catalog/flows/events-api.md` (строка `step_1`) провозглашает исчерпывающий
   список «только поля карточки: `id`, `title`, `address`, `lat`, `lon`, `starts_at`,
   `ends_at`, `reg_deadline_at`, `status`, `lang`» — `format` в нём нет, хотя живой `step_1`
   его читает, а буллет ниже в той же карточке прямо пишет, что проекция читает `format`.
   Противоречие внутри карточки; до W131 список был точен, W131 его не обновил. Тот же
   недуг — строка `step_4` в `catalog/flows/reg-consent-mkt.md` (перечисляет
   `title/starts_at/ends_at/address/lat/lon`, `format` не назван). Образец корректной
   записи — `catalog/flows/reminders.md` `step_1`: «колонки включают … `format` и `online_url`».
   Правка — по строке, но каталог — это утверждение о реальности, а не выдержка.
2. **на будущее.** В журнале W131 нет секции «Сверка с прототипом» (чек-лист 3а,
   [ADR-0027](../adr/0027-prototype-as-target-reference.md)), хотя пакет меняет четыре экрана
   (карточка каталога, «Мои билеты», шит регистрации, `#/ticket`). Дельта — продолжение уже
   названной в [W67](W67-online-event-link.md#сверка-с-прототипом-adr-0027) (билет и
   напоминания онлайн), но новое («Открыть билет» вместо «Показать QR» там, где эталон
   всегда рисует `reg.qr.button`; `ticket.title_online`) в журнале W131 не зафиксировано.
   Достаточно ссылки на секцию W67 с одной строкой про формулировки.
3. **на будущее.** Латентная рассинхронизация признака онлайна для старых записей.
   `catalog/tables/events.md` объявляет: «пусто у старых = офлайн, кроме непустой `online_url`».
   Бот (`reminders/step_2`, `my-qr-api/step_5`) это правило держит, а публичный `events-api`
   отдаёт сырой `format` и `online_url` вовсе не читает — Mini App для записи
   `format=''` + `online_url≠''` покажет «Показать QR», тогда как `#/ticket` откроет
   трансляцию. Живых таких записей нет (проверил `events`: у всех онлайновых `format=online`;
   новые записи всегда пишут `format`), поэтому сейчас не проявляется. Либо считать `format`
   единственным признаком и убрать url-фолбэк из бота, либо довести его и до `events-api`.
   Не чинить в W131.
4. **на будущее (косметика).** Внутренние имена и комментарии не поспели за смыслом:
   displayName `reg-start/step_8` — «send already + QR button» (теперь кнопка билета),
   комментарий `reg-api/step_9` — «получает existing с QR» (верно только офлайн); строка
   «Ключи текстов» в `catalog/flows/reminders.md` не перечисляет `remind.*_online*` и
   `remind.btn.stream`. На поведение не влияет.

### Оценка риска: онлайн-напоминание без кнопки «Открыть билет»

Решение [ADR-0053](../adr/0053-online-event-no-qr-wording.md) п. 1 признаю приемлемым, а не
потерей доступа к отмене. Отмена живёт на `#/ticket` (`canCancel` до старта), но билет
достижим не только из напоминания: вкладка «Мои билеты» и карточка события в каталоге ведут
туда же, а напоминание — nudge, не единственная точка входа. Цена решения сознательная: при
наличии ссылки вторая кнопка («Открыть билет») вела почти в то же место, потому что билет
онлайна несёт ту же ссылку. Переделывать нечего.

### Хвосты (не замечания)

- живой e2e в Telegram (владелец) — им же закрывается отсутствие различающего прогона на
  одну кнопку и `ticket.title_online`: агентский `ap_test_flow` для бота недостижим без
  `initData`, а `ap_test_step` после публикации переводит экспорт в DRAFT (гоча 14);
- очистка ячеек (`clear_columns`) — хвост W67, отдельный пакет;
- посещаемость онлайна — [Q71](../OPEN-QUESTIONS.md#q71).

## Сверка с прототипом (ADR-0027)

Пакет правит четыре экрана Mini App: карточка каталога, «Мои билеты», шит
регистрации, `#/ticket`. Дельта к эталону — продолжение уже названной в
[W67](W67-online-event-link.md#сверка-с-прототипом-adr-0027) (билет и напоминания
онлайна): новое здесь только формулировки — «Открыть билет» вместо «Показать QR»
там, где прототип всегда рисует `reg.qr.button`, и `ticket.title_online`. Само
отсутствие QR у онлайна в эталоне не нарисовано (онлайн — расширение поверх
[ADR-0052](../adr/0052-event-format-field-online-offline.md)), поэтому
прототип не правится.

## Ответ владельца пакета (круг 1, 2026-09-29)

- **важно (каталог `events-api`/`reg-consent-mkt`)** — *исправлено*: в обоих
  списках проекции добавлен `format`.
- **на будущее (сверка с прототипом)** — добавлена секция выше со ссылкой на W67.
- **на будущее (рассинхронизация `format=''` + `online_url`)** — принято
  хвостом: живых таких записей нет, свести признак к `format` — отдельным
  пакетом вместе с очисткой ячеек (хвост W67).
- **на будущее (косметика)** — строка «Ключи текстов» в `reminders.md`
  поправлена; displayName `reg-start/step_8` и комментарий `reg-api/step_9`
  оставлены (правка ради комментария тянет публикацию и новый экспорт) —
  внесены в хвосты.

## Инцидент после мержа (2026-09-29)

- **Симптом.** Владелец спросил «Бот живой?». Живые прогоны `events-api`
  (`PRODUCTION`) падали на `step_2`: `ReferenceError: r is not defined` — каталог
  Mini App не открывался. Последний успешный прогон до правки — 06:15, первый
  после публикации — 07:25.
- **Причина — моя правка, не платформа.** При ручном переносе кода я написал
  `rows.filter(isPast(r))` вместо `rows.filter(isPast)` — `isPast(r)`
  вычисляется на верхнем уровне, где `r` не определён. `ap_validate_flow`,
  экспорт и ревью этого не видят: они не исполняют код (дважды принял за
  «платформенный сбой» — `ap_test_flow` на минимальном теле проходил, на
  прежнем «до-W131» тексте падал, потому что я и там повторял свою же ошибку).
- **Лечение.** `step_2` исправлен (`filter(isPast)`), `ap_test_flow` SUCCEEDED,
  публикация `qwbiAdfsdfZKj7rxZYQOF`, прод-проверка `curl` на
  `POST /api/v1/webhooks/<events-api>/sync` → `200` с `format` в ответе.
  Строка `migrations` `2026-09-29-w131-07`.
- **Урок.** `ap_validate_flow` не исполняет код; любую правку CODE-шага
  подтверждать прогоном (`ap_test_flow` для вебхук/subflow с безвредным входом
  или `curl` на `/sync`), а не только валидацией и экспортом. Прогон `step_2`
  ловил бы это на круге 1.

## Ревью — круг 2

- **Ревьюер**: субагент-ревьюер (opencode, deepseek-v4.1-flash) · **Дата**: 2026-09-29 · **Вердикт**: замечаний нет

Проверена только дельта круга 1 (коммит `c8b9006`): каталог сверен с живым `events-dev`
(`ap_flow_structure(includeInput)` по двум флоу). Коммит дельты трогает только `catalog/*.md`
и этот журнал — флоу и `i18n` не менялись, поэтому офлайн-проверки круга 1 остаются в силе,
повторный прогон не требовался.

1. **важно (списки проекции) — закрыто, живым.** `events-api/step_1` читает 11 колонок:
   `id`, `title`, `address`, `format` (`8bBZDyWWWFBV311w5lPY7`), `lat`, `lon`, `starts_at`,
   `ends_at`, `status`, `reg_deadline_at`, `lang`; строка карточки перечисляет ровно эти же
   11 полей. `reg-consent-mkt/step_4` читает 7 колонок: `title`, `starts_at`, `address`,
   `lat`, `lon`, `ends_at`, `format`; строка карточки — те же 7. Порядок перечисления в
   карточке отличается от порядка колонок в шаге, но это перечень, а не порядок, — множества
   совпали. Противоречие с буллетом `format` в карточке `events-api` снято.
2. **на будущее (сверка с прототипом) — закрыто.** Секция «Сверка с прототипом (ADR-0027)»
   добавлена, дельта названа, ссылка на W67 ведёт на существующую секцию (якорь сверен).
3. **на будущее (косметика, `reminders.md`) — закрыто.** Строка «Ключи текстов» теперь
   перечисляет `remind.24h/2h`, `remind.*_online*`, `ticket.btn.open`, `remind.btn.stream`
   и `remind.btn.directions`.
4. **на будущее (рассинхронизация `format=''`+`online_url`; displayName `reg-start/step_8`
   и комментарий `reg-api/step_9`) — занесено в «Хвосты и блокеры».** Три строки на месте;
   отказ править имя/комментарий ради этого (тянет публикацию и новый экспорт) принят.

Новых замечаний нет; пакет готов к статусу `готов`.

## Хвосты и блокеры

- живой прогон в Telegram (владелец);
- косметика имён: displayName `reg-start/step_8`, комментарий `reg-api/step_9`;
- свести признак онлайна к `format` (без url-фолбэка) — вместе с `clear_columns`;
- очистка ячеек (`clear_columns`) — хвост W67, отдельный пакет;
- посещаемость онлайна — [Q71](../OPEN-QUESTIONS.md#q71).
