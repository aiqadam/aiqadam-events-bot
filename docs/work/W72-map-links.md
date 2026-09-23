# W72. Phase 2: ссылки на карты в Mini App + фикс 0,0

- **Статус**: готов
- **Владелец**: агент
- **Волна**: P2 ([#124](https://github.com/aiqadam/aiqadam-events-bot/issues/124))
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: 2026-09-24

## Цель

В Mini App у офлайн-события под адресом появляются две ссылки — «Яндекс.Карты» и
«Google Maps»; онлайн-события их не показывают. Попутно чинится баг 0,0: пустой
`lat`/`lon` через `Number('') === 0` давал ссылку на точку 0,0 в Атлантике.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `events-api` | `wEdKdE4RBGKIzWkl4MJHG` | [catalog/flows/events-api.md](../../catalog/flows/events-api.md) |
| flow `reg-start` | `FkxtgayOK5QubyqqMd9q4` | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| `miniapp/src/lib/maps.ts` | — | — |
| `miniapp/src/components/MapLinks.tsx` | — | — |

Версии при публикации: `events-api` → `hJyGxfWMj3WGtihDMtfJV` (откат
`UVCk436XmnjYSoMAgevTG`), `reg-start` → `f7Ruj775L2rgdwmRQOA0r` (откат
`l3UqicR6uUGlxtEfJQXbr`).

## Чек-лист готовности

- [x] Офлайн-события в Mini App имеют обе ссылки, открываются через `openLink`
- [x] Широта и долгота не перепутаны (проверено на координатах Ташкента)
- [x] Баг 0,0 исправлен (в `reg-start`; в `reg-profile`/`reg-consent-mkt` — уже W76)
- [x] `catalog/`, экспорт, `_manifest.json`, `migrations` обновлены
- [x] `catalog/` совпадает с живым проектом

## Как проверено

- `ap_validate_flow` → `events-api` 4/4, `reg-start` 21/21.
- **Живой `curl` `events-api/sync`** → `ok:true`, офлайн-событие отдаёт
  `lat=41.341407`/`lon=69.335264`, онлайн — пустые `lat`/`lon` (не `0`).
- **Логика `reg-start`** — код `step_9`/`step_14`, взятый из экспорта, прогнан
  локально: пустые, `('0','0')` и координата вне диапазона (`lat=141`) → ссылки
  «Открыть на карте» в тексте нет; реальные координаты → есть (8/8). Ссылка:
  `yandex.uz/maps/?ll=69.335264%2C41.341407…`. Тот же guard — в `reg-profile/step_4`
  и `reg-consent-mkt/step_5`.
- **`maps.ts`** — собран `esbuild` и прогнан в node: онлайн (пусто/`null`) → `null`,
  `(0,0)` → `null`, только адрес → поиск по адресу, координаты → Яндекс `pt=lon,lat`,
  Google `query=lat,lng`, вне диапазона → `null` (7/7).
- **Headless-стенд** `~/w41/w72-shots.mjs` (статика `dist` + мок Telegram.WebApp и
  `events-api`): 8/8 — две карточки, у офлайн-события блок `#map-links`, у онлайн
  ссылок нет, клик уходит в `Telegram.WebApp.openLink`, порядок координат
  lon,lat (Ташкент). Скриншоты light/dark.
- `npm run build` (tsc + vite) — зелёный; офлайн-проверки: секреты чисто,
  тексты 254/0, команды 0, агенты 0, `prototypes/check.mjs` OK.

## Журнал

- **2026-09-23** — взятие пакета, ветка `w72-map-links`.
- **2026-09-23** — issue называет `reg-start` «корректным», но это не так:
  `step_9`/`step_14` читают `Number(inputs.lat)` из `ev.lat || ''`, а `Number('') === 0`
  и диапазонная проверка пропускает `0` — для онлайн-события карточка онбординга
  получала ссылку на 0,0. Это ровно то, что требует Expected behavior («chat
  onboarding card never links to 0,0»), поэтому починены оба шага, а не только
  `reg-profile` из п.6. В `reg-profile`/`reg-consent-mkt` баг уже закрыт W76
  (issue #128) — там guard `str(ev.lat) !== '' && … && !(lat===0&&lon===0)`.
- **2026-09-23** — домен Яндекс.Карт — `yandex.uz` (решение владельца по #130 п.3),
  как в чате. Форматы Mini App — по issue: Яндекс `?pt=LON,LAT&z=16&l=map`,
  Google `?api=1&query=LAT%2CLON`; без координат — поиск по адресу.
- **2026-09-23** — `events-api` отдаёт `lat`/`lon` строкой (`columns` — externalId
  полей `EKEX5zyhKo3WChz5ZquY0`/`Br2f0wjLugSGIS2kjfoFE`); онлайн-событие — пустые,
  Mini App решает сам (`maps.ts`).
- **2026-09-23** — публикация после heads-up в #124; экспорт снят сразу после
  `ap_lock_and_publish` (MCP, `source: mcp`), `migrations w72-01/02`.
- **2026-09-23** — **ревью круг 1: одно «важно»** — W72, заменяя guard в
  `reg-start`, потерял проверку диапазона (`lat=141` снова давал ссылку). Вернул
  `lat∈[-90,90] && lon∈[-180,180]` в `reg-start/step_9`/`step_14` и, для
  единообразия, в `reg-profile/step_4`/`reg-consent-mkt/step_5` (там guard завёл
  W76 без диапазона). Три флоу перепубликованы: `reg-start` `48A9iUqGxbg4PDAbzhjOB`
  (откат `f7Ruj775L2rgdwmRQOA0r`), `reg-profile` `kGGIzKuw3jCHObSyJrEQ8` (откат
  `TVBVDJy4pGCIxAYyPzZxs`), `reg-consent-mkt` `KFtEE9nMhsd2Evm9pdZQc` (откат
  `Lo4XdDMjJ91DFl5g0tcbb`); экспорт снят сразу после публикации, `migrations w72-03…05`.
  Четыре «на будущее» закрыты: расхождение с прототипом названо ниже, атрибуция
  каталога исправлена, «онлайн vs адрес» — [Q63](../../docs/OPEN-QUESTIONS.md#q63),
  состав манифеста (`ChatBot`, `zz-*`) — хвост отдельного пакета.
- **2026-09-23** — **расхождение с прототипом-эталоном (ADR-0027), осознанное.**
  Прототип у адреса рисует только пин (`prototypes/app.js` `eventCardEl`,
  `ticketRow`), превью-карта и «Открыть на карте» удалены вердиктом 2026-09-18.
  W72 по issue #124 добавляет в каталог и билет две кнопки-ссылки — это и есть
  требование задачи; прототип не правится, как и в W90.

## Ревью

- **Ревьюер**: независимый ревьюер (open-code, `deepseek-v4.1-flash`) · **Дата**: 2026-09-23 · **Вердикт**: есть замечания

Проверено живьём через MCP `app-flow-events-dev`: `events-api/step_1.columns`
содержит оба externalId (`EKEX5zyhKo3WChz5ZquY0`, `Br2f0wjLugSGIS2kjfoFE`),
`step_2` отдаёт `lat`/`lon` строкой; `reg-start/step_9`/`step_14` несут
исправленный guard; `ap_validate_flow` — 4/4 и 21/21; `ap_export_flow` даёт
`id == publishedVersionId` (`hJyGxfWMj3WGtihDMtfJV` / `f7Ruj775L2rgdwmRQOA0r`,
`state: LOCKED`), экспорт, каталог и живой проект совпадают. Живой `curl`
`events-api/sync`: офлайн-событие `lat=41.341407`/`lon=69.335264`, второе
(без адреса и координат) — пустые, не `0`. Стенд `~/w41/w72-shots.mjs`
перепрогнан ревьюером — 8/8 (в т.ч. клик через `Telegram.WebApp.openLink`,
порядок lon,lat у Яндекса и lat,lng у Google); `maps.ts` пересобран esbuild и
прогнан — 10/10, включая диапазон и запятую-разделитель. Офлайн-проверки:
секреты чисто, тексты 254/0, команды 0, агенты 0, `prototypes/check.mjs` OK,
`npm run build` зелёный. `migrations` w72-01/02 совпадают с манифестом;
`tools/check-migrations.py` не прогнан — нет ключа платформы (состав манифеста
с `ap_list_flows` сверен вручную).

### Замечания

1. **важно** — W72 заменил в `reg-start/step_9` и `step_14` прежний guard
   (`isFinite(lat) && isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180`)
   на `str(inputs.lat) !== '' && str(inputs.lon) !== '' && isFinite(lat) && isFinite(lon) && !(lat === 0 && lon === 0)`.
   Пустой ввод и `(0,0)` закрыты, но **потеряна проверка диапазона**: до W72
   координата-опечатка вне диапазона (например `lat=141`) ссылку не давала,
   теперь даёт. `maps.ts` диапазон проверяет (`Math.abs(la) <= 90`,
   `Math.abs(lo) <= 180`), то есть чат и Mini App расходятся, а эталон
   `catalog/snippets/event-card.md` (строка 66) диапазон требует. Починить:
   вернуть `lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180` в `hasGeo`
   `step_9`/`step_14` (та же правка уместна и в `reg-profile/step_4`,
   `reg-consent-mkt/step_5`, где guard идентичен). Локальный прогон «6/6» в
   журнале этот случай не покрывал — проверялись только пустой/`(0,0)`/валидные.
   - *Исправлено*: вернул `lat∈[-90,90] && lon∈[-180,180]` в `hasGeo`
     `reg-start/step_9`/`step_14`, а для единообразия — в `reg-profile/step_4` и
     `reg-consent-mkt/step_5`; три флоу перепубликованы, локальный прогон расширен
     случаем `lat=141` (8/8). (2026-09-23)

2. **на будущее** — расхождение с прототипом-эталоном не названо в журнале
   (чек-лист 3a, [ADR-0027](../../docs/adr/0027-prototype-as-target-reference.md)):
   прототип у адреса рисует только пин (`prototypes/app.js` `eventCardEl`,
   `ticketRow`, `previewCard`; `prototypes/proto.css:623` — превью-карта и
   «Открыть на карте» удалены вердиктом 2026-09-18), W72 добавляет в каталог и
   билет две кнопки. Расширение осознанное (issue #124), но по прецеденту W90
   (замечание 3) его надо назвать в журнале с причиной и зафиксировать, что
   прототип не правится.
   - *Исправлено*: расхождение названо в «Журнале» (причина — требование issue
     #124, прототип не правится). (2026-09-23)

3. **на будущее** — `flows/_manifest.json` не содержит живой флоу `ChatBot`
   (`Ap06RmygApT4oFAylYfpu`, ENABLED/published) и два диагностических
   (`zz-access-check-delete-me`, `zz-diag-skip-primitive`), которые есть на
   инстансе, — значит `tools/check-migrations.py` (инвариант A) сейчас не
   пройдёт.    W72 это не вносил (то же на `main`), ключа платформы у ревьюера нет;
   нужен отдельный пакет/запись в OPEN-QUESTIONS.
   - *Исправлено*: вынесено в хвосты журнала как отдельный пакет (не W72);
     это про состав манифеста/инстанса, не про продуктовое решение. (2026-09-23)

4. **на будущее** — «онлайн-событие без ссылок» держится тем, что у
   онлайн-события пуст `address`: `mapLinks` при пустых координатах, но непустом
   адресе отдаёт поиск по адресу (`miniapp/src/lib/maps.ts`). Отдельного признака
   «онлайн» в таблице `events` нет. Пока у онлайн-событий адрес пуст, требование
   выполняется; появится онлайн-событие с адресом — ссылки появятся вопреки
   ожидаемому. Записать в OPEN-QUESTIONS.
   - *Исправлено*: заведён [Q63](../../docs/OPEN-QUESTIONS.md#q63). (2026-09-23)

5. **на будущее** — `catalog/flows/reg-profile.md` и `catalog/flows/reg-start.md`
   приписывают проверку в `reg-consent-mkt` к W72/#124, тогда как там она
   добавлена W76 (#128). Уточнить атрибуцию (на поведение не влияет).
   - *Исправлено*: в `reg-profile.md`/`reg-start.md` guard атрибутирован W76,
     проверка диапазона — W72. (2026-09-23)

### Круг 2

- **Ревьюер**: независимый ревьюер (open-code, `deepseek-v4.1-flash`) · **Дата**: 2026-09-24 · **Вердикт**: замечаний нет

Круг 1 закрыт:

1. **важно (диапазон координат) — закрыто.** Живой `ap_read_step_code` по
   `reg-start/step_9`/`step_14`, `reg-profile/step_4`, `reg-consent-mkt/step_5`
   несёт полный guard (`str(lat) !== '' && str(lon) !== '' && isFinite(lat) &&
   isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
   !(lat === 0 && lon === 0)`); код побайтово совпадает с `flows/reg-start.json`,
   `flows/reg-profile.json`, `flows/reg-consent-mkt.json` и с каталогом.
   Независимый локальный прогон кода из экспорта — 12/12: пусто, `null`,
   `undefined`, `(0,0)`, `lat=141`, `lon=999`, `lat=-91`, `lon=-181`, только
   `lat`/только `lon` → ссылки нет; валидный Ташкент и отрицательные координаты
   → ссылка есть.
2. **на будущее (прототип) — закрыто.** Расхождение названо в «Журнале» с
   причиной; сверил `prototypes/app.js` — `eventCardEl`/`ticketRow`/`previewCard`
   рисуют только пин, ссылок нет.
3. **на будущее (состав манифеста) — закрыто.** `ChatBot` (`Ap06RmygApT4oFAylYfpu`)
   и два `zz-*` действительно есть на инстансе (`ap_list_flows`) и отсутствуют в
   `_manifest.json`; вынесено в хвост отдельным пакетом, W72 не при чём (то же на
   `main`).
4. **на будущее (онлайн/адрес) — закрыто.** [Q63](../../docs/OPEN-QUESTIONS.md#q63)
   заведён, формулировка соответствует `maps.ts` и комментарию `Manage.tsx`.
5. **на будущее (атрибуция) — закрыто.** В `reg-profile.md`/`reg-start.md` guard
   атрибутирован W76, проверка диапазона — W72.

Обязательная перепроверка (независимо):

- живой `curl` `events-api/sync` → `200`, `ok:true`; офлайн-событие
  `lat=41.341407`/`lon=69.335264`, онлайн — пустые строки, не `0`;
- `ap_validate_flow`: `events-api` 4/4, `reg-start` 21/21, `reg-profile` 40/40,
  `reg-consent-mkt` 10/10;
- `ap_export_flow` по всем четырём: `id` == `publishedVersionId` манифеста
  (`hJyGxfWMj3WGtihDMtfJV`, `48A9iUqGxbg4PDAbzhjOB`, `kGGIzKuw3jCHObSyJrEQ8`,
  `KFtEE9nMhsd2Evm9pdZQc`), `state: LOCKED` — значит тестовых прогонов после
  публикации не было (иначе версия была бы `DRAFT`, гоча 14);
- `migrations` w72-01…05 сверены живьём: `version_id`/`object_id` совпадают с
  манифестом; `tools/check-migrations.py` не запускается без ключа платформы
  (проверено — код 2), состав манифеста с `ap_list_flows` сверен вручную;
- офлайн: секреты чисто, тексты 254/0, команды 0, агенты 0,
  `prototypes/check.mjs` OK, `cd miniapp && npm run build` зелёный;
- стенд `~/w41/w72-shots.mjs` — 8/8, console-ошибок 0;
- `git diff main...w72-map-links` — только ожидаемые файлы (4 флоу-экспорта,
  каталог, манифест, `i18n/ru.json`, 6 файлов Mini App, доки); регрессов нет.

AppSec: `events-api` публичный, но `step_2` отдаёт только поля карточки (`id`,
`title`, `address`, `lat`, `lon`, даты, `status`, `registerLink`) — ПД
(телефон, `telegram_id`, `staff_id`) в ответ не попадают. `openExternal`
вызывается только с URL, собранных из константы и `encodeURIComponent`/чисел
(`lat`/`lon` после `isFinite`), произвольный URL из данных не открывается;
фолбэк `window.open(url, '_blank', 'noopener')`.

Наблюдение (не замечание, не блокирует): каталог `reg-consent-mkt.md`
описывает guard как «только при валидных координатах, не `(0,0)`», не
перечисляя диапазон, как `reg-profile.md`/`reg-start.md`; утверждение верно и
поведению не противоречит — косметическая асимметрия формулировок. Guard во
флоу сравнивает `str(v) !== ''` без `.trim()` (в `maps.ts` — с `.trim()`),
т.е. whitespace-only координата прошла бы как `0`; на `NUMBER`-колонках
недостижимо, унаследовано от W76.

## Хвосты и блокеры

- Живая проверка на телефоне и Telegram Desktop (клик по обеим ссылкам,
  пин в Ташкенте) — на владельца.
- `tools/check-migrations.py` без ключа платформы — на W15.
- `flows/_manifest.json` не содержит флоу `ChatBot` и два `zz-*` с инстанса —
  `check-migrations.py` (инвариант A) не пройдёт; не W72 (то же на `main`),
  нужен отдельный пакет.
- Открытый вопрос [Q63](../../docs/OPEN-QUESTIONS.md#q63): «онлайн без ссылок»
  держится пустым адресом, а не признаком «онлайн».
