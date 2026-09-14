# W34. Стартовое меню на холостой `/start`

- **Статус**: готов (2026-09-14, решением владельца — см. «Закрытие»)
- **Владелец**: агент аудита → агент ревью-правок
- **Волна**: вне волн (малый, не блокирует)
- **Зависит от**: W28 (лекало экрана), W06 (events-list/my-regs), W33 (роуты SPA `#/manage`, `#/scan`), переменная `MINIAPP_URL`
- **Начат**: 2026-09-14 (ретроактивно) · **Закрыт**: 2026-09-14

## Цель

Гость без ссылки получает меню за один тап: холостой `/start`, `/start` с мусором, `/menu`, `/help` отвечают одним и тем же меню вместо `Otherwise` без ответа. Подробности — [BACKLOG.md](../BACKLOG.md#w34-стартовое-меню-на-холостой-start).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `menu` | `1DORFhP9F3W00KpKz5wDw`, externalId `BOLkFV1GreF8r7opvDCVo` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| flow `tg-router` (ветка `menu`) | `nyaBzgKGG8TTTsryjc9tW`, step_15 (callFlow menu), branch 7 в step_11 | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |

## Чек-лист готовности

> Скопировать из BACKLOG.md и отмечать по мере прохождения.

- [x] холостой `/start`, `/menu`, `/help` — один и тот же ответ меню; `/start мусор` — то же меню с преамбулой `start.bad_payload` (прогоны в `PRODUCTION` после `ap_lock_and_publish`, по одному на каждый вход) — `3oCRKYgCXKIN7VTwFH2aN` (`/start`), `7sUvyYkl0oidy5MNSRGcC` (`/menu`), `Dkydjm3L5GGagVxFfzCPG` (`/help`), `s3nhA4Kptn2EwGFCxXbHz` (мусор, `badPayload: true`); повторные `/start` — `F8L2KoFVqe2xcTMRwP5Dl`, `4XZbKj5e4iG7oMwT4t7Cd`
- [x] `e<id>-<utm>` по-прежнему уходит в `reg-start`, а не в меню (регресс W28) — `G3cxFS1qbHEUPBGna713k`: `fn-parse-start` разобрал `kind: e`, `route: reg_start`, `step_12`; регистрация пройдена до конца (`reg_pdn` `oO82Usz6v45U7yJJE7W6y`, `reg_mkt` `vP5cMnrNAvz2y3zrfkrgA`)
- [~] гость без ивентов — 2 кнопки, owner — 3, staff — 3, owner+staff — 4 в фиксированном порядке — owner и owner+staff проверены в `PRODUCTION` (`rod26P3qfxBzAvStKPqgN`: 3 кнопки, `isOwner: true`; `95MWOcs7MbrIzBs5iA9eT`: 4 кнопки, `scanEventId: demo`); гость (2) и staff-only (3) — только `TEST`-прогоны 2026-09-13 (`4L3uUGuCeJaJW0w5BT4vbQ`, `u60CpfDWQYMRJ0eoNK3Rw`); негативные ветки (отозванный staff, staff без будущих ивентов) не прогонялись — принято решением владельца
- [x] колбэк `myreg:list` доходит до `my-regs`; `ev:list:upcoming` из меню работает (регресса W06 нет) — `myreg:list` → `my_regs`/`step_24` (`J72oMI88QWfXu9OGe8N6e`, `QpMwNNmxgC735Yo5JuxZ2`); `ev:list:upcoming` → `events_list`/`step_23` (`FI0SFm4ZQsMz8WUranAwk`, `o2XZUCznVnELp1Kt6E5w2`, `Wu0SlTAtK2KVaV1HKKEnC`), бонусом `ev:list:past` (`HaKdEMfrMmWvDXuP4I4KU`)
- [x] повторный `/start` не плодит `sessions` и не шлёт второе подтверждение (`sessions` до/после — 0 новых строк) — три повторных `/start`; `sessions` 6 строк до и после, новых нет
- [x] `format` задан явно (`None`), строки — из `texts`, сверены с `i18n/ru.json` (проверено экспортом `flows/*.json`, `source: "mcp"`)
- [x] `FLOWS.md` поправлен отдельным коммитом (пусто/мусор → меню)
- [x] `catalog/flows/menu.md` + правка `catalog/flows/tg-router.md` (ветка `menu`, колбэк `myreg:list`) + `catalog/overview.md` (раздел Flows), экспорт тем же коммитом, `check-export-secrets.sh` чист
- [~] независимое ревью, вердикт «замечаний нет» — круг 1 дал «есть замечания» (блокер 1, важно 2–3, на будущее 4–6); замечание 3 и мелочи 6 исправлены (`7f8765a`), блокер 1 закрыт PRODUCTION-прогонами (см. «Как проверено»), замечание 2 закрыто частично; повторного круга нет — принято решением владельца
- [x] `catalog/` совпадает с живым проектом

## VOICE — что проверит ревьюер (п. 3a)

- [ ] длина сообщения по `VOICE.md:42` — медиана 26, максимум 130, одна мысль — одно сообщение; точка в конце, `!` только в приветствии
- [ ] эмодзи — норма 0, максимум 1 в первой строке (`VOICE.md:70`), в кнопках эмодзи нет, в отказе эмодзи нет
- [ ] кнопки — inline, подпись глаголом без точки/эмодзи, медиана 10 (`VOICE.md:94`), порядок продолжающее→отменяющее, пара `Да/Нет` своими словами
- [ ] класс сообщения — карточка/список по `VOICE.md:112`, отказ `что→почему→что делать` без «извините» там где не виноваты, без внутренних терминов
- [ ] `format` задан явно в `send_text_message`, экранирование по `catalog/snippets/markdown-v2.md` если `MarkdownV2`

## Как проверено

- **AppSec-аудит кода** (step_4 «render menu»): `revoked_at` фильтруется в CODE (defense-in-depth, паттерн W18); URL кнопок `web_app` собираются из `MINIAPP_URL` + `encodeURIComponent(scanEventId)`, роуты `#/manage` и `#/scan?event_id=`; `format: None` — текст без разметки. Owner — post-filter `r.owner_id === telegramId`. Staff — только активные (пустой `revoked_at`) + только опубликованные + только будущие.
- **Экспорт**: `flows/menu.json` + `flows/tg-router.json` через `ap_export_flow` → `tools/export-flow-mcp.py`, `check-export-secrets.sh` чист.
- **Прогоны в PRODUCTION** (живой Telegram; аккаунты `322876545` и `8255904812`), после `ap_lock_and_publish`:
  - входы меню: `/start` — `3oCRKYgCXKIN7VTwFH2aN`; `/menu` — `7sUvyYkl0oidy5MNSRGcC`; `/help` — `Dkydjm3L5GGagVxFfzCPG`; `/start мусор` — `s3nhA4Kptn2EwGFCxXbHz` (`badPayload: true`); повторные `/start` — `F8L2KoFVqe2xcTMRwP5Dl`, `4XZbKj5e4iG7oMwT4t7Cd`. Во всех `tg-router` — `route: menu`, вызов `step_15`; меню-прогоны (`rod26P3qfxBzAvStKPqgN`, `FV2pjfgoNRykrzQeahFTF`, `6E2xM7ezrXLuseE9jNhU6`, `xhMA2mMJ4V4wBZnsFRYxc`, `v9S37nCBKuAYxDfdNqUkq`) — 200 OK от Bot API, 3 кнопки (`isOwner`), у мусорного — преамбула `start.bad_payload`.
  - регресс W28: `/start edemo-w34` — `G3cxFS1qbHEUPBGna713k`: `route: reg_start`, `step_12`; продолжение регистрации — `oO82Usz6v45U7yJJE7W6y`, `vP5cMnrNAvz2y3zrfkrgA`.
  - колбэки: `ev:list:upcoming` → `events_list`/`step_23` — `FI0SFm4ZQsMz8WUranAwk`, `o2XZUCznVnELp1Kt6E5w2`, `Wu0SlTAtK2KVaV1HKKEnC`; `myreg:list` → `my_regs`/`step_24` — `J72oMI88QWfXu9OGe8N6e`, `QpMwNNmxgC735Yo5JuxZ2`.
  - роли: owner 3 кнопки — `rod26P3qfxBzAvStKPqgN`; owner+staff 4 кнопки (`Сканер чекина` на `#/scan?event_id=demo`) — `95MWOcs7MbrIzBs5iA9eT` (аккаунт `8255904812`, owner прошедшего ивента + staff demo).
  - повторный `/start`: `sessions` — 6 строк до и после, новых нет.
- **Попутно**: сканирование билета demo аккаунтом staff (`kfxhn2Pc7vqi2Zvx3vpPj`, `0p6w1LXbF4d5YRc6o2Hxu`) — верный `already` с исходным временем 13.09 (IDM-2); билет другого ивента (`uYiiEkfTRMddovfz8sDuE`) — верный `wrong_event`; 404 на `step_8` — штатный сентинел `-` (оформлен в карточке `checkin-api`).

## Журнал

- **2026-09-14** — пакет заведён: холостой `/start` сейчас `Otherwise` без ответа (`tg-router.md:36`), `FLOWS.md:43` обещал приветствие. Ключи `menu.*`/`start.greeting*` с `W03` мёртвые. Заведен `W34` в `BACKLOG.md`/`STATUS.md`/`ROADMAP.md`, создан журнал.
- **2026-09-14** — задание переопределено с владельцем («вариант B», меню-хаб): owner/staff-кнопки — `web_app` в существующие роуты SPA (`#/manage`, `#/scan?event_id=`), гостевые — колбэки `ev:list:upcoming` и новый `myreg:list`; «Мои ивенты» не рисуем до `W13` (хвост записан в `W13`), staff без будущих ивентов — без кнопки сканера; мусорный `/start` — преамбула `start.bad_payload` + то же меню; home-роут SPA сознательно не фиксируется. `BACKLOG`/`ROADMAP`/`FLOWS.md` переписаны, чек-лист обновлён.
- **2026-09-14** — пакет **возвращён в бэклог** решением владельца: взятие muse-spark не привело к работе — сверка с живым инстансом (`ap_list_flows`, 17 флоу) подтвердила, что флоу `menu` не создан и ветка в `tg-router` не добавлена. Статус → `не начат`, владелец снят. Чек-лист дополнен пятой фикстурой (owner+staff одновременно — 4 кнопки). Журнал сохранён: записи выше фиксируют принятое задание («вариант B»), следующему владельцу начинать с них.
- **2026-09-14** — **флоу `menu` обнаружен при аудите**: на инстансе 18 флоу (не 17), `menu` (`1DORFhP9F3W00KpKz5wDw`) ENABLED, published, вызывается из `tg-router` step_15 (branch 7 «menu»). Карточки в каталоге нет, экспорта нет, записи в `migrations` нет, ревью не проходило. Запись выше («сверка подтвердила, не создан») **была неверной**. tg-router draft был `DRAFT` (черновик правлен после публикации) — опубликован через `ap_lock_and_publish` после `ap_validate_flow` (21 шаг, 21 valid). Принято решение: принять как W34 ретроактивно, довести по процессу. Каталог и экспорт обновлены; строк в `migrations` не появилось — дозапись вынесена пакетом [W35](../BACKLOG.md#w35-дозапись-migrations-за-w33w34-adr-0021). Статус → `в работе` (на проверке после ревью).

- **2026-09-14** — **замечание 3 закрыто**: колбэк `myreg:list` описан в контракте и шагах `tg-router.md`, вход `my-regs.md` — команда и колбэк; заодно мелочи 6 — опечатка `menu.md`, полный перечень `texts`-флоу в `ru-texts.md`, заметка «Все вызовы касаний» без неполного перечисления. Флоу на инстансе и экспорт не менялись; сверка обновлённых мест — MCP (`ap_flow_structure`, `ap_read_step_code`).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: агент-ревьюер · **Дата**: 2026-09-14 · **Вердикт**: есть замечания

### Чем проверено

- **Живой проект (MCP)**: `ap_flow_structure` — `menu` 6/6 шагов `configured`, `tg-router` 21/21, `invalid` нет; `ap_read_step_code` на всех CODE-шагах пакета (`menu/step_4`, `tg-router/step_10`, логи `step_5`/`step_16`, `step_1`/`step_3`/`step_8`) — чистые функции, ни сети, ни записи; ветка `menu` — branch 7 `step_11`; `step_15` — `queue`, обёртка `flowProps.payload` (gotcha 7a); `ap_validate_flow` — оба флоу valid.
- **Published-версии (REST GET, ADR-0018)**: `GET /flows/:id?versionId=…` — `menu` `42flU3b7ZmTUFbR7OWRpk`, `tg-router` `1LNpRakfrf9CPzl7SXKi9`, оба `LOCKED`; в них: `format: "None"` у `menu/step_5`, постфильтры `r.owner_id === telegramId`, `r.revoked_at === ''`, `byId[r.event_id]`, `notPast`, `encodeURIComponent(scanEventId)`, `callbackData === 'myreg:list'` — в опубликованном коде, не только в описании; короткой формы `{{VAR}}` нет ни одной, ссылок вне `{{variables[...]}}`/`{{step_N[...]}}`/`{{trigger[...]}}`/`{{connections[...]}}` нет.
- **Каталог ↔ проект**: `menu.md` и `tg-router.md` по шагам и зависимостям совпадают с живым, кроме замечания 3; `overview.md` — 18 флоу и 11 таблиц против `ap_list_flows`/`ap_list_tables`; лишних карточек нет (`i18n-sync.md` помечен «не существует»).
- **Экспорт**: `flows/menu.json` и `flows/tg-router.json` — тем же коммитом `a6bf987`, `source: mcp`, `state: LOCKED`; `tools/check-export-secrets.sh` — exit 0 (27 `auth` — ссылки); `publishedVersionId` **всех 18** записей манифеста сверены живым `GET /api/v1/flows` — расхождений нет; `tools/check-texts.py i18n/ru.json flows/*.json` — 112 пар, 0 расхождений.
- **FLOWS.md** (пункт 7 чек-листа) фактически закрыт коммитом `0182b95`: `FLOWS.md:43` уже описывает пусто/мусор → меню; галочка в чек-листе просто не поставлена.
- **AppSec**: `telegramId` — только из апдейта (`tg-router/step_1` → `step_15`); `menu` — `callableFlow`, снаружи не вызывается; URL — `{{variables['MINIAPP_URL']}}` + `encodeURIComponent`, `callback_data` статичны; телефон и прочие ПД в шагах не читаются. Различающего прогона на постфильтр нет — замечание 2.
- **Не относится к пакету**: HTTP/cron/hmac-шагов нет (блок 1a — только `tables-find-records`; их фильтры в published-версии действительно фильтруют, что видно по выходам прогонов); `edit_message_text`/фолбэк — меню карточку не редактирует; Mini App (3a, пп. 5–7) не тронут; 4.2 (крипта), 4.3 (CSV/utm), 4.5 (вебхук/рассылка) — неприменимо; 2a в байтовой части — W26-вариант эталона (см. замечание 6).

### Замечания

1. **блокер** — Путь меню не подтверждён ни одним прогоном через `tg-router`, а в PRODUCTION последние `/start` обработала ещё старая версия. Доказательство: published `tg-router` `1LNpRakfrf9CPzl7SXKi9` создан `2026-09-14 13:53:11 UTC` (`ap_export_flow`), после чего прогонов `tg-router` нет — последние PRODUCTION это `13:44:46–13:45:40`: `4YoA6XB9LOAFamM133hZE` (голый `/start`, `step_11` из 8 веток без `menu`, `route: none` → `step_16`) и `KKlylCpKOVdzMPQpSv72c` (deep link → `reg_start`); последние TEST — 2026-09-13. Маршрута `route: menu` нет ни в одном прогоне, вызов `step_15` (обёртка `payload`, gotcha 7a) не исполнялся ни разу — а именно он даёт тихий отказ при ошибке формы. Пункты 1 и 4 чек-листа «Готово, когда» не закрыты, и без прогонов в PRODUCTION пакет сдавать нельзя.
   - *Закрыто* (2026-09-14): PRODUCTION-прогоны сделаны по каждому входу — `route: menu` и вызов `step_15` исполнены, меню доставлено (id прогонов — «Как проверено»); пункты 1, 2, 4, 5 чек-листа пакета закрыты.
2. **важно** — Фикстуры и негативные ветки CODE-фильтра не прогонялись. Есть ровно 3 TEST-прогона меню — `vpjiIlh8kNb9ZMuzsGQg9` (owner, 3 кнопки), `4L3uUGuCeJaJW0w5BT4vbQ` (гость, 2), `u60CpfDWQYMRJ0eoNK3Rw` (staff, 3) — все с `badPayload: "false"` и прямым входом в `menu`. Не проверены: `badPayload=true`, отозванный staff (в `event_staff` все 3 строки с пустым `revoked_at`), staff на прошедшем ивенте (фикстура `999000333`/`mu022plsnokv` есть, прогона нет), owner+staff (4 кнопки), повторный `/start` и `myreg:list`/`ev:list:upcoming` из меню. Постфильтр в published-коде есть (см. «Чем проверено»), но различающего прогона на него нет — пункт 4.1 чек-листа ревьюера и пункты 3, 4 чек-листа пакета не закрыты. Ущерб ограничен видимостью кнопки: реальные права всё равно проверяет `checkin-api`, — но и он не прогонялся в паре с меню.
   - *Закрыто частично* (2026-09-14): `badPayload=true`, owner (3 кнопки) и owner+staff (4 кнопки) прогнаны в PRODUCTION; гость и staff-only — только TEST-прогоны 2026-09-13; негативные ветки (отозванный staff, staff без будущих ивентов) и pair-прогон со сканером не делались. Принято решением владельца — см. «Закрытие».
3. **важно** — Каталог расходится с живым проектом: `catalog/flows/tg-router.md` не упоминает маршрут `myreg:list` ни в контракте (п. 2b), ни в шагах, тогда как published `step_10` (`1LNpRakfrf9CPzl7SXKi9`) содержит `callbackData === 'myreg:list'` → `my_regs`, а `W34-menu.md:31` отмечает правку «колбэк `myreg:list`» выполненной. `catalog/flows/my-regs.md:4-5` тоже описывает только вход `/myregs`. Следующий агент по карточке не увидит новый маршрут и сломает его при правке ветвления; пункт «`catalog/` совпадает с живым проектом» не закрыт.
   - *Исправлено* (2026-09-14): [`catalog/flows/tg-router.md`](../../catalog/flows/tg-router.md) — в контракте (п. 2b) назван колбэк `myreg:list` → `my-regs`; в строке `step_10` — маршрут `my_regs` по `command === 'myregs' || callbackData === 'myreg:list'`; заметка «Все вызовы касаний» переписана без неполного перечисления шагов, чтобы полнота не устаревала при добавлении вызовов. [`catalog/flows/my-regs.md`](../../catalog/flows/my-regs.md) — вход описан как `/myregs` **и** `myreg:list`, `callbackData` — только ack. Сверено с живым проектом через MCP: `ap_flow_structure` по `tg-router` (ветка 7 `menu`, `step_15` — `callFlow menu`, `executionMode: queue`, обёртка `flowProps.payload`) и `ap_read_step_code` по `step_10` (`command === 'myregs' || callbackData === 'myreg:list'` → `my_regs`); флоу и экспорт не менялись.
4. **на будущее** — VOICE 3a: три из четырёх подписей кнопок — существительные («Ивенты», «Мои регистрации», «Сканер чекина»), при требовании «подпись — глагол» (`VOICE.md:91`); «Сканер чекина» вдобавок несёт внутренний термин. Строки взяты из W03 и согласованы с остатком корпуса («Будущие», «Прошедшие», `scan.title`), поэтому это корпусный долг, а не новая порча W34: чинить сейчас не нужно, стоит завести общий аудит подписей (OPEN-QUESTIONS/бэклог).
5. **на будущее** — `start.bad_payload` («Ссылку не удалось разобрать. Вот что открыто сейчас:», `i18n/ru.json:236`) обещает список открытых ивентов, а показывает «Что дальше?» с навигационными кнопками. Текст писался под прежнюю идею ответа; переформулировать при следующей правке текстов.
6. **на будущее** — Мелочи каталога и эталона: `catalog/flows/menu.md:16` — опечатка «одноgo»; `catalog/snippets/ru-texts.md:33-35` перечисляет потребителей W26-варианта без `menu` (список вообще отстал от каталога); `catalog/flows/tg-router.md:80` говорит «Все вызовы касаний (`step_12→14`, `step_23→26`), забывая `step_15` (тоже `queue`).
   - *Исправлено* (2026-09-14): [`catalog/flows/menu.md`](../../catalog/flows/menu.md) — «одноgo» → «одного», других вхождений в каталоге нет; [`catalog/flows/tg-router.md`](../../catalog/flows/tg-router.md) — «Все вызовы касаний» без неполного перечисления (см. замечание 3); [`catalog/snippets/ru-texts.md`](../../catalog/snippets/ru-texts.md) — перечень `texts`-шагов приведён к фактическому (двенадцать флоу, включая `menu`), полнота сверена по закоммиченному экспорту `flows/*.json`.

### Чек-лист пакета на момент ревью

- Закрыты: «`format` задан явно (`None`), строки из `texts`, сверены с `i18n/ru.json`» (published-версия REST + `check-texts` 0 расхождений); «`FLOWS.md` поправлен отдельным коммитом» (проверено по `FLOWS.md:43` и `0182b95`, в журнале просто нет галочки).
- Не закрыты: пункт 1 (PRODUCTION-прогоны всех входов), пункт 2 (регресс deep link), пункт 3 (пять фикстур), пункт 4 (`myreg:list`, `ev:list:upcoming`), пункт 5 (повторный `/start`), пункт 8 — каталожная часть выполнена не полностью (замечание 3), пункт «`catalog/` совпадает с живым проектом» (там же).
- Незакрытый пункт 8-в-части «колбэк `myreg:list`» отмечен в чек-листе как выполненный — это и есть расхождение, ловящееся замечанием 3.

## Закрытие (2026-09-14) — решением владельца проекта

Владелец распорядился принять работу и закрыть пакет («принимаем работу,
закрываем пакет и пушим в main»). Это **не** вердикт «замечаний нет»: такого
вердикта у пакета нет — ревью прошло один круг и дало замечания.

Что это значит по существу:

- **Блокер единственного круга закрыт.** PRODUCTION-прогоны по каждому входу
  сделаны, `route: menu` и вызов `step_15` исполнены, меню доставлено; id
  прогонов — в «Как проверено».
- **Замечание 3 (важно) исправлено** коммитом `7f8765a`; чек-лист каталога
  и «`catalog/` совпадает с живым проектом» стали истинными.
- **Замечание 2 (важно) закрыто частично:** owner и owner+staff прогнаны в
  PRODUCTION, `badPayload=true` — тоже; гость и staff-only остались на
  TEST-прогонах 2026-09-13, негативные ветки постфильтра и pair со сканером
  не прогонялись. Принято владельцем сознательно.
- **Замечания 4–5 оставлены «на будущее»** (подписи кнопок — корпусный долг
  W03; текст `start.bad_payload` — при следующей правке текстов).
- **Повторного круга ревью нет.** Появившиеся позже замечания — отдельная
  работа, как и [W35](../BACKLOG.md#w35-дозапись-migrations-за-w33w34-adr-0021)
  (дозапись `migrations`).

## Хвосты и блокеры

- **Гость (2 кнопки) и staff-only (3) в PRODUCTION не прогнаны** — только
  `TEST`-прогоны 2026-09-13; негативные ветки постфильтра (отозванный staff,
  staff без будущих ивентов) — тоже. Версия принята владельцем как есть;
  закрывать при следующем касании меню.
- **`migrations` по W34 не записаны** — вынесено в отдельный пакет
  [W35](../BACKLOG.md#w35-дозапись-migrations-за-w33w34-adr-0021).
- **Кнопка «Мои ивенты»** не рисуется до [W13](../BACKLOG.md#w13-список-участников-и-экспорт);
  хвост записан в W13.
- **Замечания 4–5 ревью** (VOICE-подписи кнопок-существительных, текст
  `start.bad_payload`) — на будущее, отдельным аудитом/правкой текстов.
