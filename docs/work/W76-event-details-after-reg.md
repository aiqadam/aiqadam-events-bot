# W76. Детали события в чате после регистрации

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

После «Зарегистрироваться» карточка события заменяется подтверждением, и дата,
адрес, ссылка на карту исчезают. Вернуть их в карточку «Вы зарегистрированы» /
«Ваш билет», плюс кнопка «Добавить в календарь» (решение владельца 2026-09-23).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-profile` (`step_4`) | `5U3Kv0cSrnvDTrbictA4L` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| flow `reg-consent-mkt` (`step_4`, `step_5`) | `3gLF6TcbpFObHONATQ64N` | [catalog/flows/reg-consent-mkt.md](../../catalog/flows/reg-consent-mkt.md) |

Изменения (решение владельца 2026-09-23 — кнопку календаря добавить):
- `reg-profile/step_4`: финальные карточки `finish`/`finish_lite` несут факты
  события (дата, адрес, «Открыть на карте») вместо одной строки с названием;
  в билет `finish_lite` добавлена кнопка «Добавить в календарь».
- `reg-consent-mkt`: проекция `step_4` расширена (`ends_at`, `lat`, `lon`);
  `step_5` кладёт в карточку адрес и ссылку на карту, в билет — кнопку календаря.
- Координаты: ссылка на карту только при непустых координатах и не `(0,0)`
  (`Number('') === 0` — баг #124, в этой правке учтён).
- `i18n/ru.json`: новый ключ `event.card.btn_calendar`.

## Чек-лист готовности

> Из [issue #128](https://github.com/aiqadam/aiqadam-events-bot/issues/128).

- [x] детали события не исчезают из чата после регистрации
- [x] кнопка «Добавить в календарь» (ссылка Google Calendar) для офлайн-события
- [x] онлайн-событие → без адреса и карты
- [x] `check-texts.py` зелёный, экспорт обновлён
- [x] `catalog/` совпадает с живым проектом

## Как проверено

- **Локальный прогон чистых функций** (`/tmp/opencode/w76.mjs`, 19/19 OK):
  `finish`/`finish_lite` дают карточку с датой, адресом и
  `yandex.uz/maps`; билет содержит `calendar.google.com` с
  `dates=20261002T130000Z/20261002T160000Z`; без координат карты нет, дата и
  адрес остаются; `reg-consent-mkt` — карта в карточке, календарь в билете,
  ветка сбоя возвращает generic без кнопок, без события — каталог без календаря.
- Живые флоу опубликованы (`reg-profile` `Zk1LotBaEVkIni7wbEstD`,
  `reg-consent-mkt` `Lo4XdDMjJ91DFl5g0tcbb`), `_manifest.json` обновлён,
  `migrations` — две строки `publish` (`w76-01/02`).
- `check-texts.py` — 240 пар, 0 расхождений; офлайн-чеки зелёные.
- **Живой сквозной прогон бота не выполнен**: путь требует интерактива в
  Telegram, владельца нет в сети; `ap_test_step` в TESTING не передаёт выходы
  между шагами для этого флоу. Хвост — на владельца (первое касание в боте).

## Журнал

- **2026-09-23** — пакет взят. `ap_test_step` на `reg-profile` с
  `triggerTestData` в TESTING вернул пустые выходы промежуточных шагов
  (`step_3`/`step_4` — `{}`, `writeKind=ignore`) — для этого callableFlow
  TESTING-прогон не воспроизводит цепочку; верификацию логики сделал чистым
  прогоном кода шагов локально. Попутно исправил ловушку 0,0 в своей же правке.

## Ревью

- **Ревьюер**: review-agent (opencode / opencode-go/deepseek-v4.1-flash), **дата**: 2026-09-23
- **Вердикт**: есть замечания

Проверено живьём (MCP): структура и код `reg-profile/step_4`, `reg-consent-mkt/step_4/step_5`;
столбцы `events` в проекции `step_4` — `zIA6xEHm7y1bwkajoYDQn` = `ends_at`,
`EKEX5zyhKo3WChz5ZquY0` = `lat`, `Br2f0wjLugSGIS2kjfoFE` = `lon` (обе цепочки читают их
по `fieldName`); `ap_validate_flow` — 40/40 и 10/10 valid; `ap_get_run` по TESTING-прогонам;
`migrations` — обе строки `publish`, `version_id` совпадают с `_manifest.json` и живым
`flows[0].id`. Ветки `finish`/`finish_lite`, `finish_no_event`, `declined` и ветка сбоя
`reg-consent-mkt/step_5` (`common.err.generic` + пустой `ticketReplyMarkup`) — по смыслу как
заявлено; `eventFacts` несёт только публичные поля события. Офлайн: `check-export-secrets.sh`,
`check-texts.py i18n/ru.json flows/*.json` (240 пар, 0 расхождений), `check-commands.py`
(с аргументами — 0 команд), `check-agents.py`, `node prototypes/check.mjs` — exit 0;
`/tmp/opencode/w76.mjs` — 19/19. Плюс собственный edge-прогон 14/14: `(0,0)` и числовые
`0/0` — карты нет, `(0; 41.3)` — карта есть, нечисловой `lat` — карты нет,
`encodeURIComponent` и MarkdownV2-экранирование держат `#`, `*`, `_`, `[`, `]`.

### Замечания

1. **важно** — `flows/reg-profile.json` в коммите `0c27aa4` — не пост-публикационный
   снимок версии `Zk1LotBaEVkIni7wbEstD`. Признаки: (а) `backupFiles` в файле непустой
   (`{"31":"69v5dk3TgoLlF9L23gwrm"}`), тогда как живой `ap_export_flow` этой `LOCKED`-версии
   отдаёт `backupFiles: null`, а непустой `backupFiles` — свойство **черновика**
   (у `zz-diag-skip-primitive`, `state: DRAFT`, он тоже непустой); это единственный из 29
   файлов `flows/` с непустым `backupFiles`. (б) Код `step_4` не побайтово равен живому:
   нет двух строк `// W76: финальная карточка несёт…`, иначе сформулирован комментарий
   ветки `finish_lite`, `parseIso` объявлен до `ev` (в живом — после `mapsUrl`). Различия —
   только комментарии и порядок объявления чистой функции, логика идентична, поэтому
   функционального/security-эффекта нет. Но манифест помечает файл `source: "mcp"` с
   `versionId` `Zk1…`, то есть снимок расходится с версией, которую он называет своей
   ([ADR-0021](../adr/0021-repo-is-source-of-truth-migrations-table.md); чек-лист ревью п. 2 —
   «снимок снимается сразу после `ap_lock_and_publish`»). Починка: перегнать
   `flows/reg-profile.json` через `tools/export-flow-mcp.py` (или `tools/export-flows.sh`)
   и закоммитить — `backupFiles` станет `null`, код совпадёт. `flows/reg-consent-mkt.json` —
   чистый пост-публикационный снимок, `step_5` совпадает с живым байт-в-байт.

2. **на будущее** — `catalog/flows/reg-consent-mkt.md` (абзац «Тексты — во входе `texts`»,
   стр. 42) перечисляет ключи входа, но не называет новый `event.card.btn_calendar`, хотя он
   теперь во входе `step_5`. Каталог и так показывает кнопку в таблице шагов — правка
   косметическая.

3. **на будущее** — журнал, «Как проверено»: «`migrations` — строки `create publish`».
   Фактически по W76 в `migrations` две строки, обе `publish` (`2026-09-23-w76-01/02`);
   `create` нет — флоу существовали с прошлых пакетов. Там же: 19/19 `w76.mjs` — это прогон
   кода **из `flows/*.json`** (репозиторный снимок), а не живых шагов; для `reg-profile`
   снимок совпадает с живой логикой, но сам прогон живой инстанс не доказывает.

### Остаточный риск

- **Живого сквозного прогона нет — и это ограничивает доверие именно к финальной
  отрисовке, а не к логике.** TESTING-прогоны (`oRpqqdjPTY579yLpyn4u6`,
  `ya76os6FlJG9aTLkE6Oea`) подтверждают: промежуточные выходы `{}`, `step_4` отдаёт
  `{"writeKind":"ignore"}` — `ap_test_step` в TESTING не прокидывает выходы между шагами
  для этого `callableFlow`, ветки W76 там не исполняются. Логика ссылок (карта, календарь,
  экранирование) доказана чистым прогоном кода и edge-тестами выше; не доказан самый конец:
  примет ли Telegram новый `MarkdownV2`-текст карточки и URL-кнопку календаря. Если
  `parse_mode` отклонит текст, `step_7` (`continueOnFailure`) уйдёт в фолбэк `step_8`,
  который шлёт тот же `cardText` и упадёт так же — пользователь не получит ничего.
  Поэтому первый реальный тап в боте стоит просмотреть владельцу: это закрывает хвост,
  записанный в журнале.

## Хвосты и блокеры

- —

### Ответы владельца (круг 1, 2026-09-23)

- **важно** — *Исправлено*: `flows/reg-profile.json` перегенерирован с живой
  опубликованной версии `Zk1LotBaEVkIni7wbEstD` через `tools/export-flow-mcp.py`
  (снимок из `ap_export_flow`): `backupFiles` теперь `null`, код `step_4`
  совпадает с живым. `reg-consent-mkt.json` был чистым и не менялся.
- **на будущее 2** — *Исправлено*: в каталог `reg-consent-mkt.md` добавлен
  вход `event.card.btn_calendar`; в журнале — «две строки `publish`».
- **на будущее 3** — принято: `w76.mjs` гоняет код из `flows/*.json`
  (репозиторный снимок), не из живых шагов; для чистой функции это
  эквивалентно, после перегенерации снимок = живой.

### Круг 2 (2026-09-23)

- **Ревьюер**: review-agent (opencode / opencode-go/deepseek-v4.1-flash), **дата**: 2026-09-23
- **Вердикт**: замечаний нет

«Важно» круга 1 закрыто. Проверено заново по живому проекту, а не по ответу владельца:

- **`flows/reg-profile.json` — чистый пост-публикационный снимок.** Свежий
  `ap_export_flow` (`5U3Kv0cSrnvDTrbictA4L`) отдаёт `flows[0].id` =
  `Zk1LotBaEVkIni7wbEstD` = `publishedVersionId` манифеста, `state: LOCKED`,
  `backupFiles: null`. Файл после нормализации тем же `walk()` (вырезаны
  `lastUpdatedDate`/`lastTestDate`/`sampleDataFileId`, корневые
  `created`/`updated`/`id`/`flowId`/`updatedBy`) **побайтово равен** свежему
  экспорту (82 358 байт, сравнение `==` даёт True) — совпадают не только
  `step_4`, но и все прочие шаги, входы и `texts`. `ap_read_step_code` по
  `step_4` содержит добавленные комментарии W76 и `parseIso` перед `ev`,
  как в живом.
- **`flows/reg-consent-mkt.json`** — в `e6bcced` не менялся; свежий
  `ap_export_flow` (`3gLF6TcbpFObHONATQ64N`) даёт `id`
  `Lo4XdDMjJ91DFl5g0tcbb` (= манифест), `state: LOCKED`,
  `backupFiles: null`; `step_5` и колонки `step_4`
  (`…kSRM3ouou0Owj2yDYk92W` + `EKEX5zyhKo3WChz5ZquY0`,
  `Br2f0wjLugSGIS2kjfoFE`, `zIA6xEHm7y1bwkajoYDQn`) совпадают с живым.
- **Каталог**: `catalog/flows/reg-consent-mkt.md` называет вход
  `event.card.btn_calendar` (пункт W76, стр. 56–58);
  `catalog/flows/reg-profile.md` описывает факты в `finish`/`finish_lite`
  и кнопку календаря — сверено с кодом живых шагов. Наблюдение (не
  замечание): в списке ключей абзаца «Тексты — во входе `texts`» новый
  ключ не появился, он назван отдельным пунктом ниже; на чтение каталога
  это не влияет.
- **Журнал**: «Как проверено» говорит «`migrations` — две строки `publish`
  (`w76-01/02`)»; в ответах владельца отмечено, что `w76.mjs` гоняет код из
  `flows/*.json`, а не живых шагов.
- **Офлайн (все exit 0)**: `check-export-secrets.sh`; `check-texts.py
  i18n/ru.json flows/*.json` (240 пар, 0 расхождений); `check-commands.py
  i18n/*.json flows/*.json` (29 флоу, 0 нарушений); `check-agents.py`;
  `node prototypes/check.mjs`; `/tmp/opencode/w76.mjs` — 19/19 OK.
  Без аргументов `check-commands.py` печатает usage и выходит 2 — это
  штатное поведение, не расхождение.
- **Ветка относительно `main`**: `git log main..HEAD` — только `0c27aa4`
  и `e6bcced`; `git diff --stat main...HEAD` — 7 ожидаемых файлов
  (`flows/reg-profile.json`, `flows/reg-consent-mkt.json`,
  `flows/_manifest.json`, `i18n/ru.json`, два `catalog/flows/*.md` и
  журнал). Рабочее дерево чистое.
