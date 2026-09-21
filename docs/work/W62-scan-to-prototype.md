# W62. Экран контроля (сканер) — приведение к прототипу

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн (хвост соответствия прототипу)
- **Зависит от**: W49 — ✅ (прототип-эталон), W50 — ✅, W33 — ✅
- **Начат**: 2026-09-21 · **Закрыт**: 2026-09-21

## Цель

Живой экран контроля `#/scan` совпадает с прототипом по видимой части:
иконка вердикта, подпись, экран фатальной ошибки с одной кнопкой выхода,
подсказка в нативном сканере и счётчик «Отмечено X из Y». Рамка видоискателя
не переносится: в продукте камера нативная (`showScanQrPopup`), страница под
попапом не видна — свойство платформы, а не отставание.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-counter-api` | `lm9S9cRuSZOpVAgl2h44R` | [catalog/flows/checkin-counter-api.md](../../catalog/flows/checkin-counter-api.md) |
| SPA `#/scan` | `miniapp/src/routes/Scan.tsx` | — |

## Чек-лист готовности

- [x] вердикт: иконка + текст + подпись (как `renderScan` в `prototypes/app.js`)
- [x] фатальная ошибка: иконка + заголовок + одна кнопка («Закрыть» → `#/events`), повторяемая — «Продолжить»
- [x] подсказка `scan.hint` отдаётся в нативный попап (`showScanQrPopup({text})`)
- [x] счётчик и полоса: `registered` берётся один раз при открытии, `checked_in` растёт локально на исходе `ok` (как в прототипе)
- [x] `checkin-api` не тронут — счётчики отдаёт отдельный гейтнутый `checkin-counter-api`
- [~] живые проверки: `curl` на `/sync` (негатив мусорным `initData` — 401); позитив — хвост W15
- [x] `catalog/` обновлён; `flows/checkin-counter-api.json` + `_manifest.json` + 4 строки `migrations`
- [x] `check-texts.py` (232 пары, 0), `check-commands.py` (0), `check-export-secrets.sh` (чисто; `EXPECTED_BOT_TOKEN` 7→8), `tsc`/`vite build` чисты
- [x] независимое ревью, вердикт «замечаний нет» (круг 2)

## Как проверено

- `ap_validate_flow` → `9 steps, 9 valid`.
- `curl` мусорного `initData` на опубликованный `/sync` → `401`
  `{ok:false,status:"invalid_init_data",text:"Данные Mini App устарели…"}`.
- Локальный прогон кода `step_5` на обоих формах вывода
  `tables-find-records` (голый массив и `{records:[...]}`) → `registered=3,
  checked_in=1`; без staff-строки → `403 forbidden`; пустой список → `0/0`.
- `tsc --noEmit` и `vite build` — чисто.

## Журнал

- **2026-09-21** — пакет заведён по поручению владельца: «привести экран
  контроля к прототипу, что технически возможно». Разбор дельты живого
  `Scan.tsx` против `renderScan` (`prototypes/app.js:430-504`): совпадают
  тона/тексты/луп, расходятся иконки, подписи, экран ошибки, счётчик и
  подсказка. Счётчик требует серверных данных — `checkin-api` отдаёт только
  `{status,text}`, в `tables` агрегата нет, поэтому заведён отдельный
  гейтнутый `checkin-counter-api` (горячий путь чекина не трогаем).
- **2026-09-21** — счётчики читаются **один раз при открытии** экрана, дальше
  `checked_in` растёт локально на исходе `ok` — ровно как в прототипе
  (`ed.scan.checkedIn++`). Так на каждый скан нет чтения таблицы.
- **2026-09-21** — `tables-find-records` отдаёт и массив, и `{records:[…]}`:
  `manage-api/step_46` уже страхуется `arr()`, `checkin-api/step_7` — нет
  (там работает, значит форма массив). Код счётчика сделан устойчивым к обеим:
  иначе `{records}` дал бы тихие нули. Проверено локальным прогоном.
- **2026-09-21** — первая публикация `gGH8A4wz…`, затем правка устойчивости и
  перепубликация `aLZTTcR8…` (черновик перекрыл публикацию, gotcha 14):
  экспорт снят сразу после `ap_lock_and_publish`, строки `migrations` —
  create + две publish.
- **2026-09-21** — круг 1 ревью: блокер подтверждён и закрыт. `step_4` читал
  `registrations` во **внутренних id полей** (`oLh0…`, `U7St…`, `cQmSS…`),
  а `tables-find-records` принимает `externalId` — нечитаемые `columns`/фильтр
  валят шаг fail-closed, счётчик не отдавался бы никогда. Проверено
  `ap_resolve_property_options` (`columns`, `table_id: SM8tMxfQuQCHRDdAiNJyQ`):
  девять externalId, среди них `event_id qQPYl9c0ew6n8w2CGYZII`,
  `status TZyqC63UAWrPbzxuf2q4w`, `checked_in_at uCnpOj11sJLaX4Rqu6TUG` —
  подставлены. Перепубликация `9X0AEtc4gCwkT2ByAuQo7`, экспорт сразу после
  (gotcha 14), `migrations` — строка `w62-04`. Урок на будущее: id полей для
  таблиц брать `ap_resolve_property_options`, а `ap_list_tables` — только для
  обзора схемы.
- **2026-09-21** — замечание 2 закрыто: снят `sub scan.reopen_app` у
  `invalid_init_data` (в эталоне у ошибок нет подписи, текст сервера
  `checkin.unauthorized` её уже содержит). Замечание 4 — шапка журнала
  приведена к `на проверке`. Замечание 3 принято как «на будущее»: сверка
  прав по полям, а не по непустоте — общий паттерн `checkin-api/step_7`,
  не регрессия W62.

## Ревью

- **Ревьюер**: независимый агент (чистый контекст) · **Дата**: 2026-09-21 ·
  **Вердикт**: **есть замечания** (круг 1)

### Замечания

1. **блокер** — `checkin-counter-api` (lm9S9cRuSZOpVAgl2h44R), шаг `step_4`
   «read registrations (counters)» читает `registrations` во **внутреннем
   namespace'е field id, а не в externalId**. `columns` —
   `oLh0DFSDeTzwcyyDrX9tI` и `U7St4I3LojwMYiyCOxwFY` (внутренние id полей
   `status` и `checked_in_at`; верные externalId — `TZyqC63UAWrPbzxuf2q4w`
   и `uCnpOj11sJLaX4Rqu6TUG`), фильтр `event_id` — `cQmSSShQIJlKQrrpGmMU4`
   (верный externalId — `qQPYl9c0ew6n8w2CGYZII`); репо: `flows/checkin-counter-api.json:96-98,104`.
   Таблицы принимают externalId: `ap_resolve_property_options` по `columns`
   (`table_id: SM8tMxfQuQCHRDdAiNJyQ`) отдаёт ровно девять externalId, и ни одного
   из этих трёх среди них нет; так же читают `registrations` все рабочие флоу
   (`manage-api`, `fn-find-registration` — `qQPYl9c0ew6n8w2CGYZII`,
   `catalog/tables/README.md`). Следствие: `tables-find-records` с нечитаемым
   фильтром/колонками **валяет шаг** (fail-closed; в схеме шага прямо:
   «A filters value that cannot be read raises an error — it is never ignored»),
   `step_6 return_response` при этом не исполняется и счётчик не отдаётся
   **никогда** — на любом валидном staff-запросе. `Scan.tsx` ошибку проглатывает
   (`loadCounters` при `ok !== true` молча выходит), поэтому в UI просто нет
   полосы прогресса. Цель пакета «Отмечено X из Y» на живом инстансе не достигнута.
   Почему не поймано: позитив ни разу не прогонялся живьём (честно объявленный
   хвост W15), а локальный прогон трогал только CODE-шаг `step_5` на
   синтетических входах и до реального `step_4` не доходил.    Фикс — подставить
   три externalId; после правки обязателен **живой** позитив (staff → `ok`) и
   различающий негатив (не-staff → `403`), иначе правка снова непроверена.
   - *Исправлено*: `step_4` переведён на externalId (`qQPYl9c0ew6n8w2CGYZII`,
     `TZyqC63UAWrPbzxuf2q4w`, `uCnpOj11sJLaX4Rqu6TUG`), перепубликован
     `9X0AEtc4gCwkT2ByAuQo7`; живой позитив — по-прежнему хвост W15 (нет
     `initData`), это названо в «Хвостах» (2026-09-21).

2. **на будущее** — под экраном ошибки `invalid_init_data`
   (`miniapp/src/routes/Scan.tsx:124`, рендер `:250`) выводится подпись
   `scan.reopen_app`, которой в эталоне нет: у всех состояний `scanErrors`
   (`prototypes/app.js:420-428`) только `icon/text/action`, а бокс ошибки
   (`prototypes/app.js:451-463`) рисует иконку, заголовок и одну кнопку — без
   `sub`. Строка унаследована из `main`, но по чек-листу 3a каждое расхождение
   с прототипом должно быть названо в журнале; сейчас не названо. Либо признать
   осознанным отличием, либо убрать при следующем касании.
   - *Исправлено*: `sub scan.reopen_app` у `invalid_init_data` убран
     (`Scan.tsx`), подписи у ошибок нет — как в эталоне (2026-09-21).

3. **на будущее** — `checkin-counter-api/step_5` решает про права по **непустоте**
   выдачи `tables-find-records` (`staffRows.length === 0`), а не по полям строки
   (`event_id`/`telegram_id`); чек-лист 4.1 предпочитает сверку по полям. Это
   **не регрессия W62**: так же устроен `checkin-api/step_7`
   (`isStaff = staffRows.length > 0`), а фильтры fail-closed и содержат
   `event_id`+`telegram_id`+`revoked_at not_exists` (STF-2 по конкретному
   событию — выполнен). Закрывать обобщающим пакетом, не здесь.

4. **на будущее** — шапка журнала («Статус: в работе», строка 3) разошлась с
   `docs/STATUS.md` («на проверке»). Учётная мелочь.
   - *Исправлено*: шапка журнала приведена к `на проверке` (2026-09-21).

### Чем проверено

- **MCP, живой `events-dev`**: `ap_flow_structure` и `ap_read_step_code` по
  `checkin-counter-api` (lm9S9cRuSZOpVAgl2h44R) и `checkin-api`
  (rKoDYtiIVdbzlW59b57uH); `ap_list_tables`; `ap_get_piece_props` +
  `ap_resolve_property_options` по `tables-find-records`; `ap_export_flow` —
  версия `aLZTTcR8e0TVmyxkUWTJC`, `state: LOCKED`, `status: PUBLISHED`;
  `ap_validate_flow` — 9/9 valid; `ap_list_flows` — состав совпал с манифестом.
- **`migrations`** (`ap_find_records`, `package=W62`): три строки — `create` +
  два `publish`; `version_id` последней `publish` (`aLZTTcR8e0TVmyxkUWTJC`)
  совпал с `flows/_manifest.json` и с живым `ap_export_flow`.
- **Офлайн**: `check-texts.py` (232 пары, 0), `check-commands.py` (0),
  `check-export-secrets.sh` (чисто; `BOT_TOKEN` 8 — рост на один из-за нового
  флоу законен), `node prototypes/check.mjs` (OK), `npx tsc --noEmit`,
  `npm run build` — чисто.
- **SPA ↔ прототип по коду**: вердикт (тон/иконка/подпись), экран ошибки
  (иконка/заголовок/одна кнопка), подсказка в нативный попап, счётчик и полоса,
  сохранённый луп (STF-1) — совпадают; отказ от рамки видоискателя назван
  в журнале причиной «камера нативная».
- **`checkin-api` не тронут**: в дифе его нет, строк `migrations` по нему
  в W62 нет, живая структура совпала с `flows/checkin-api.json` из `main`.
- **`.result` у прочих потребителей** (Manage/Events/Ticket/Feedback): `index.css`
  изменён только добавлением, правила `.card`/`.result` целы, сборка чиста.

### Ограничения ревью

- `tools/check-migrations.py` прогнать не удалось: `QADAM_API_KEY` в окружении
  нет, keychain отсутствует (Linux). Версию `checkin-counter-api` сверил вручную
  (манифест ↔ `migrations` ↔ `ap_export_flow`); остальные 27 флоу манифеста этой
  проверкой не покрыты.
- Живые прогоны `checkin-counter-api` (позитив с настоящим `initData`, негатив
  не-staff → `403`) не выполнялись: у ревьюера нет живого `initData`,
  а `ap_test_flow`/`ap_test_step` запрещены каноном (меняют состояние версии,
  gotcha 11/14). Именно поэтому дефект namespace'а виден только по статике
  экспорта.

### Круг 2 (повторное ревью)

- **Ревьюер**: независимый агент (чистый контекст) · **Дата**: 2026-09-21 ·
  **Вердикт**: **замечаний нет**

Замечания круга 1 закрыты, новых блокирующих и «важно» не найдено.

#### Что проверено живьём (MCP, `events-dev`)

- **Блокер 1 закрыт по существу.** `ap_flow_structure lm9S9cRuSZOpVAgl2h44R`
  (`includeInput`): `step_4` — `columns`
  `["TZyqC63UAWrPbzxuf2q4w","uCnpOj11sJLaX4Rqu6TUG"]`, фильтр `event_id`
  `qQPYl9c0ew6n8w2CGYZII` (`table_id SM8tMxfQuQCHRDdAiNJyQ`). Независимо:
  `ap_resolve_property_options` по `columns` этой таблицы отдаёт ровно девять
  externalId, включая все три подставленных; внутренних id `oLh0…`/`U7St…`/
  `cQmSS…` среди них нет. `step_3` (`event_staff`,
  `table_id t1g8Vae3iEoDk93D6Rle7`) тоже на externalId (`r5Woh…`, `Rs62…`,
  `zX2FO3…`) — подтверждено тем же резолвом.
- `ap_read_step_code step_5` — чистая функция: `arr()`/`flat()` совпадают с
  рабочими потребителями таблиц (`staff-invite`, `lifecycle`, `manage-api`),
  ни сети, ни записи. Гейт `staffRows.length === 0` — принятый кругом 1
  паттерн `checkin-api/step_7`, не регрессия.
- `step_1`: `flow.externalId VzXoy80RWnX7pM4dm8eor` = `fn-hmac-init-data`
  (сверено `ap_resolve_property_options` по пропу `flow`), `flowProps`
  обёрнут в `payload` (gotcha 7a), `BOT_TOKEN` — длинной формой. `step_4`
  читает только `status`+`checked_in_at` — без ПД.
- **Экспорт/манифест/migrations сошлись:** живой `ap_export_flow` —
  `flows[0].id = 9X0AEtc4gCwkT2ByAuQo7`, `state: LOCKED`, `status: PUBLISHED`;
  `flows/_manifest.json` → `publishedVersionId 9X0AEtc4gCwkT2ByAuQo7`;
  последняя строка `migrations` пакета W62 (`w62-04`, publish) →
  `version_id 9X0AEtc4gCwkT2ByAuQo7`. Возможные расхождения `ap_export_flow`
  и `flows/checkin-counter-api.json` не найдены (сверены входы всех девяти
  шагов).
- `ap_validate_flow` — `9 steps, 9 valid`. `ap_list_flows` —
  `checkin-counter-api` ENABLED published; состав манифеста (28) совпал с
  `flows/*.json`; два `zz-*` (draft, DISABLED) — диагностические, вне W62.
- **Прогоны:** `ap_list_runs` — два прогона (2026-09-21 06:51, до фикса),
  оба SUCCEEDED. `ap_get_run rjOGIYaCkHNAhKC34cJsp` читается целиком:
  `initData: "garbage"` → `step_1 valid:false, reason:malformed` →
  `step_7` → `step_8` `401 {ok:false,status:"invalid_init_data"}`.
  Различающий негатив доказан; позитива после фикса нет (см. «Ограничения»).
- **Замечания 2 и 4 закрыты.** `Scan.tsx`: `invalid_init_data` →
  `stopAll('clock', text, false)` без `sub` (подписи у ошибок нет, как в
  `prototypes/app.js:451-463`); шапка журнала и `docs/STATUS.md` — `на проверке`.

#### Офлайн (запущено ревьюером 2026-09-21)

- `check-texts.py` — 28 флоу, 232 пары, 0 расхождений (exit 0);
- `check-commands.py` — 0 нарушений (exit 0);
- `check-export-secrets.sh` — чисто: токен 0, hex 0, `BOT_TOKEN` 8,
  `QR_SIGNING_KEY` 2, поля `auth` — ссылки (exit 0);
- `node prototypes/check.mjs` — OK (ключи резолвятся, сценарии проходятся);
- `npx tsc --noEmit` и `npm run build` — exit 0;
- `grep -E '#[0-9a-fA-F]{3,8}|rgb\(|oklch\(|font-family|font-size' miniapp/*.html`
  — молчит; веб-шрифтов на `ticket`/`scan` нет.

#### Ограничения ревью (круг 2)

- `tools/check-migrations.py` не выполнен: `QADAM_API_KEY` в окружении нет,
  keychain на Linux отсутствует (то же, что в круге 1). Вручную сверены только
  `checkin-counter-api` (манифест ↔ `migrations` ↔ `ap_export_flow`); остальные
  27 флоу манифеста этой проверкой не покрыты.
- **Живой позитив не выполнен и агентом невыполним:** нет `initData`
  (нужен `BOT_TOKEN`, значение скрыто), а `ap_test_flow`/`ap_test_step`
  запрещены каноном (меняют состояние версии, gotcha 11/14). Прогонов
  `checkin-counter-api` после перепубликации `9X0AEtc…` нет. Это названный
  хвост W15; закрытие блокера круга 1 опирается на статику: подставлены
  ровно те externalId, которые отдаёт `ap_resolve_property_options` и
  использует каждый рабочий потребитель `registrations`.
- Диф ветки против `main` включает три коммита W61 (`reg-api`) — W61 уже
  `готов` и отревьюен своим кругом; здесь повторно не проверялся.

#### Наблюдения (замечаниями не считаю)

- `scan.reopen_app` после снятия подписи не используется ни в SPA, ни в
  прототипе — мёртвый ключ в `ru/uz/en`; снять при возврате i18n (W25/W27)
  или следующим касанием.
- `step_5` считает «пришёл» по `checked_in_at !== ''`, тогда как `lifecycle`
  и `reg-afterword` дополнительно отсекают сентинел `-`. В `registrations`
  (3 строки: пусто/ISO) он сейчас не встречается — риск теоретический.
- `prototypes/app.js`/`proto.js` переведены с `proto.result_*` на
  `checkin.sub_*` — следствие добавления ключей в `ru.json` и правила
  `check.mjs` о дублях словаря (как в `a060b0e`); видимые строки те же.

## Хвосты и блокеры

- Позитив `checkin-counter-api` живым `initData` и клик-проход сканера
  (все исходы, счётчик) — на W15: у агента нет живого `initData`.
- Счётчик в `limit: 500` строк: событие с большим числом регистраций даст
  значение ниже факта; для индикатора прогресса принято, не для отчётности.
- `scan.reopen_app` стал мёртвым ключом (снят с подписи) — снять при W25/W27.
