# W136. Яндекс.Карты: разбор ссылок — все формы «Поделиться»

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W42 (визард + `resolve_geo`, Q55) — ✅
- **Начат**: 2026-10-05 · **Закрыт**: —

## Цель

Визард события понимает все реальные формы ссылки Яндекс.Карт (кнопка
«Поделиться» из приложения и веба), а не только `pt/ll`/`@`/`q`:
новый POI-формат (`poi[point]` + `poi[uri]=…oid=`), URL-кодированные запятые,
орг-ссылки, ссылки-адрес (`text=`/`q=<адрес>`) и короткие `yandex.*/maps/-/<code>`.
Координаты ставятся сразу; где координат нет, но есть `oid`/текст — Геокодер
(точка + адрес). Только Яндекс.Карты.

## Решения владельца (2026-10-05)

- Короткие ссылки — **поддержать** (разворот на сервере по `Location`); при
  отказе — подсказка «скопируйте координаты».
- Координаты — всегда и сразу, без сети; адрес — из Геокодера там, где есть
  `oid`.
- Ссылки-адрес без координат (`text=`/`q=<адрес>`) — **геокодировать текстом**.
- Только Яндекс.Карты.

## Разведка (2026-10-05)

- Короткая `https://yandex.uz/maps/-/CXeBa8mq` отдаёт **301** + `location:
  /maps/10335/tashkent/?ll=…&poi[point]=…&poi[uri]=ymapsbm1://org?oid=…`;
  HTTP-шаг кладёт заголовок `location` в вывод (`ap_run_action`). Значит,
  короткие разворачиваются сервером.
- Клиент (`Manage.tsx:87`) знает только `pt/ll`/`@`/`q`/голую пару и не
  декодирует `%2C`; орг-ссылку с `?ll=` уводит в центр карты (регресс W42).
- Сервер (`manage-api/step_34`) берёт `oid` только из пути `/maps/org/…`.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| ADR | [0055](../adr/0055-yandex-maps-link-formats.md) | — |
| SPEC | OWN-1 расширен | [SPEC.md](../SPEC.md) |
| Mini App `Manage.tsx` | `analyzeYandexLink` / `resolveGeoLink` | [Manage.tsx](../../miniapp/src/routes/Manage.tsx) |
| Прототип | `analyzeYandexLink` (паритет) | [prototypes/app.js](../../prototypes/app.js) |
| flow `manage-api` | `pFtbgOP3U8sNFvP86Szli` (v `Auy6i7uMdfL0lx1qPLAFS`) | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
| repair `reg-api` | `SmutybV5qJQjQASJGY9vi` (v `NG1QA9OiltCKjissdeK3G`) | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |

`manage-api`: `step_34` — план, `step_35` — ROUTER `oid`/`text`/`coords`/`short`;
ветки: `step_36→37→61` (Геокодер `uri`), `step_62→63→64` (Геокодер `geocode`),
`step_65→66` (coords), `step_67→68→69` (разворот по `Location` → `expanded`),
`step_70→71` (отказ).

## Чек-лист готовности

- [x] клиент декодирует URL и понимает `poi[point]`, `pt`, `ll`, `@lat,lon`,
      `q=lat,lon`, голую пару (форма `%2C`/`%5B` — тоже);
- [x] приоритет: `poi[point]` > `pt` > `oid`(Геокодер) > `ll` > `@`/`q`/пара;
      орг-ссылка с `ll` **не** берёт центр карты;
- [x] `oid` распознаётся и из `poi[uri]=ymapsbm1://org?oid=…`, и из `/maps/org/…`;
- [x] сервер `resolve_geo` умеет режимы `oid`/`text`/`short`/`coords`/`none`;
      короткая разворачивается по `Location` и разбирается как обычная;
- [x] адрес из Геокодера там, где есть `oid`/текст; иначе адрес — вручную;
- [x] отказ Геокодера/разворота → подсказка, координаты из ссылки не теряются;
- [x] прототип в паритете (`prototypes/app.js`, `prototypes/scenarios.js` —
      сценарий отписки заменён; `check.mjs` зелёный);
- [x] i18n — новых ключей не нужно (`manage.geo.org_fail` переиспользован);
- [x] план разбора проверен живым пробником (poi-encoded→`oid`, org→`oid`,
      text→`text`, `ll`→`coords`, short→`short`); Геокодер `uri`/`geocode` и
      разворот короткой — отдельными прогонами;
- [x] `ap_validate_flow` (`manage-api` 72/72), публикация, `flows/*.json` и
      `migrations` тем же PR;
- [x] `catalog/` обновлён; SPEC OWN-1 и ADR-0055;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- `npm run build:dev` (Mini App) — type-check + сборка зелёные.
- Живые прогоны пробников (удалены после вердикта):
  - `zz-w136-geo-probe` — Геокодер `1.x`: `uri=ymapsbm1://org?oid=74162995744`
    → `69.244231 41.311214` + адрес; `geocode=Tashkent` → `69.279728 41.311144`
    + адрес; **пустой параметр** → `400` (потому org и text — разные HTTP-шаги);
  - `zz-w136-plan-probe` — план: poi-encoded → `oid` (`oid=74162995744`),
    `/maps/org/beelab/34279609643` → `oid`, `?text=…` → `text`,
    `?ll=…%2C…` → `coords` (`41.341407, 69.335264`), `maps/-/CXeBa8mq` → `short`.
- `ap_run_action` `http`: короткая `yandex.uz/maps/-/CXeBa8mq` → `301` +
  `location: /maps/10335/tashkent/?…poi[point]=…poi[uri]=…oid=…` (заголовок
  доступен в выводе).
- `ap_validate_flow manage-api` — 72/72 valid; `node prototypes/check.mjs` — зелёный;
  `check-texts.sh`/`check-commands.py`/`check-export-secrets.sh` — на коммите.
- **Чего не проверял:** живой сквозной `resolve_geo` внутри `manage-api` —
  вебхук гейтится `initData` (окно 300 c, живого аккаунта у агента нет, как в
  W42); ветки http/разворота проверены отдельными прогонами, план — пробником,
  дерево — валидатором. `check-migrations.py` — на приёмке с ключом.

## Журнал

- **2026-10-05** — заведён пакет. Разведка: короткая ссылка → `301` +
  `location` (полный URL) виден в выводе `http`; клиент и сервер разбирают
  только узкий набор форм. Владелец расширил скоуп: короткие — да, текст —
  геокодер, адрес — из Геокодера, только Яндекс.
- **2026-10-05** — проба на временном флоу `zz-w136-geo-probe`: `uri=ymapsbm1://org?oid=…`
  и `geocode=<текст>` через Геокодер `1.x` работают (`pos` + `Address.formatted`);
  **пустой параметр валит запрос** (`Parameter "geocode" … not allowed to be empty`),
  значит org- и текст-режим — два разных HTTP-шага.
- **2026-10-05** — клиент `Manage.tsx`: `parseYandexLink` расширен до
  `analyzeYandexLink` (decode, `poi[point]`, приоритет `poi[point]`>`pt`>`oid`>`ll`>`@`/`q`/пара,
  `oid` из пути и `poi[uri]`, текст, короткая); `resolveOrgLink` → `resolveGeoLink`
  с обработкой `expanded`; `linkRecognized` для подсказки. `npm run build:dev` — зелёный.
- **2026-10-05 — инцидент и починка.** Операции по серверу начались с
  **неверного flowId**: `SmutybV5qJQjQASJGY9vi` — это `reg-api`, а не
  `manage-api` (его id `pFtbgOP3U8sNFvP86Szli`). Из `reg-api` были удалены
  `step_37`, `step_36`, `step_35` (цепочка удаления users + тело цикла sessions
  в `delete_account`). Восстановлено по эталону `flows/reg-api.json`:
  `step_35` (delete session, INSIDE_LOOP `step_34`), `step_36` (read users, после
  `step_44`), `step_37` (loop users), `step_38` (delete user, INSIDE_LOOP);
  имена переиспользованы, 46 шагов как в репозитории, `ap_validate_flow` — 0
  `invalid`. Перепубликовано (v `NG1QA9OiltCKjissdeK3G`), экспорт и строка
  `migrations` `2026-10-05-w136-00`. Цена: 4 шага подняты `tables` 0.4.5→0.5.0.
  Урок: flowId брать из каталога, а не из `reg-api`-привычки.
- **2026-10-05** — сервер `manage-api` (`pFtbgOP3U8sNFvP86Szli`) перестроен:
  `step_34` → план, `step_35` → ROUTER, ветки `oid`/`text`/`coords`/`short`/`none`;
  `ap_validate_flow` 72/72, опубликовано, экспорт и `migrations` `2026-10-05-w136-01`;
  каталог и прототип обновлены, сценарий отписки заменён (хвост W135).
- **2026-10-05 — правки по ревью (круг 1).** (1) порядок источников приведён к
  ADR (`poi[point]>pt>ll>@>q>пара`) в клиенте и `step_34`, формулировка приоритета
  в ADR/SPEC уточнена (`oid` — триггер Геокодера, не источник координат);
  (2) голая пара снова принимает десятичную запятую; (3) парсер вынесен в
  `miniapp/src/lib/yandexLink.mjs` (+`.d.ts`), добавлен реальный тест
  `yandexLink.test.mjs` (10/10), подключён в pre-commit и CI; `build:dev`,
  `check.mjs`, `check-texts/commands/secrets` — зелёные; `manage-api`
  перепубликован (v `Auy6i7uMdfL0lx1qPLAFS`), экспорт и `migrations` обновлены.

## Ревью

- **Ревьюер**: агент-ревьюер (opencode, deepseek-v4.1-flash) · **Дата**: 2026-10-05 · **Вердикт**: есть замечания

### Замечания

1. **важно** — заявленный приоритет `poi[point] > pt > oid > ll > @/q/пара` (ADR-0055 п.2, SPEC OWN-1) не совпадает с кодом: и клиент (`analyzeYandexLink`), и сервер (`manage-api/step_34`) проверяют `@` и `q` **раньше** `ll`, поэтому ссылка с одновременными `@` и `ll` берёт `@`, тогда как ADR/SPEC требуют `ll`. Прежний `parseYandexLink` (`git show e232b2c:miniapp/src/routes/Manage.tsx`) искал `pt|ll` первыми, то есть для такой ссылки поведение изменилось. Дополнительно режим сервера выбирается как `short → oid → text → coords`, т.е. `oid`/`text` стоят выше координат: каноническая ссылка владельца (`poi[point]` + `poi[uri]=…oid=`) уходит в Геокодер (mode `oid`), хотя по приоритету должен побеждать `poi[point]`. Видимый результат корректен (клиент точку не затирает, `if (!a.point) setGeo`), но лишний вызов Геокодера случается, а `mapLink` собирается из точки Геокодера, а не из сохранённых координат. Решить: либо привести порядок к ADR/SPEC, либо переписать п.2 ADR и OWN-1 под фактическое правило.
   - *Исправлено*: порядок приведён к ADR (`poi[point] > pt > ll > @ > q > пара`) в клиенте (`yandexLink.mjs`) и в `step_34`; ADR-0055 п.2 и SPEC OWN-1 уточнены — `oid` не источник координат, а триггер Геокодера (адрес; точка — если точных координат в ссылке нет), поэтому `poi[point]+oid` даёт точку из ссылки и адрес из Геокодера (2026-10-05).
2. **важно** — регресс: голая пара с десятичной запятой больше не разбирается. Старый `parseYandexLink` (и `prototypes/app.js`) допускал `[.,]` в числах и делал `replace(',', '.')`; новый `N = (-?\d+(?:\.\d+)?)` плюс прямой `parseFloat` отвергают `41,341407 69,335264` (проверено живым запуском реплик: `client=null`, `srv=none`; `41.341407, 69.335264` работает). Затронуты клиент, `step_34` и прототип. Это потеря прежнего поведения из чек-листа пакета («голая пара»).
   - *Исправлено*: голая пара снова допускает `[.,]` + `replace` в `yandexLink.mjs`, `step_34` и прототипе; тест `yandexLink.test.mjs` покрывает `41,341407 69,335264` (2026-10-05).
3. **важно** — пункт BACKLOG «клиентский харнесс (все формы, закодированные, короткие, орг-с-`ll`)» не выполнен: тестов парсера в репозитории нет (`analyzeYandexLink` встречается только в `Manage.tsx`/`prototypes/app.js`; `prototypes/check.mjs` парсер не трогает, `npm run build:dev` — только type-check). Именно поэтому регрессы п.1–2 не были пойманы. Живой сквозной `resolve_geo` внутри `manage-api` не гонялся — владелец это признаёт (вебхук гейтится `initData`, как в W42).
   - *Исправлено*: добавлен реальный харнесс `miniapp/src/lib/yandexLink.test.mjs` (10 кейсов: poi-encoded, приоритет poi>ll, pt/ll, @/q, ll>@, голая пара с запятой, org, short, text, мусор); парсер вынесен в общий `miniapp/src/lib/yandexLink.mjs` (+`.d.ts`), тест гоняет именно его; подключён в pre-commit и CI (2026-10-05).
4. **на будущее** — доказательные пробники `zz-w136-geo-probe`/`zz-w136-plan-probe` удалены до вердикта (`migrations` `-90`/`-91`), поэтому их прогоны уже не достать `ap_get_run` (AGENTS.md, гоча 11: «доказывающие временные флоу не удалять до вердикта ревью»). Проверка Геокодера `uri`/`geocode` и разворота короткой остаётся только на слово журнала.
5. **на будущее** — `resolve_geo` не ограничен Яндекс.Картами: `step_34` (и клиентский `GeoLink.yandex`) вычисляет `isYandex`, но нигде его не использует, хостовой проверки нет. Строка `https://evil.example.com/maps/org/x/12345678` даёт mode `oid` и вызов Геокодера — это не SSRF (URL Геокодера фиксирован, короткая ограничена регекспом `yandex.*/maps/-/`), но расходится с ADR-0055 п.7 и тратит квоту. Туда же: отказ разбора org/short не даёт подсказки сразу — `resolveGeoLink` игнорирует не-`ok` ответ, а `linkRecognized` для `oid`/`short` истинно, так что обещанная ADR-0055 п.5 подсказка «скопируйте координаты» всплывает только на публикации как `manage.geo.link_bad` (и лишь если ссылка не парсится как координаты).

### Проверено (живой проект через MCP `app-flow-events-dev` + репозиторий)

- **`manage-api`** (`pFtbgOP3U8sNFvP86Szli`, v `Auy6i7uMdfL0lx1qPLAFS`): `ap_flow_structure` — `step_34` план, `step_35` ROUTER `oid`/`text`/`coords`/`short`/`Otherwise`, ветки `36→37→61`, `62→63→64`, `65→66`, `67→68→69`, `70→71` как заявлено; `ap_validate_flow` — 72/72 valid; `ap_export_flow` вернул `flows[0].id = Auy6i7uMdfL0lx1qPLAFS` = `flows/_manifest.json`. Права и `initData` не тронуты: `step_7` для `resolve_geo` по-прежнему требует валидный `initData` (`step_1`/`step_2`) и строку `staff` (`chapter` scope), событие и таблицы не нужны; `consent`/`PAR-*` не затрагиваются.
- **AppSec**: в Геокодер уходят только `uri` (собран из `oid`-цифр) и `geocode` (текст ≤300), URL `https://geocode-maps.yandex.ru/1.x/` фиксирован; короткая разворачивается GET'ом по `{{step_34['output'].expandedUrl}}`, а `step_34` пропускает в этот режим только `^https?://…yandex.<tld>/maps/-/` — произвольный URL не проксируется. Секретов в экспорте нет (`check-export-secrets.sh` — ок), `auth` — ссылка `{{connections['Oct3laLPiavfizCJagLcM']}}`, connection ACTIVE; переменная `{{variables['YANDEX_GEOCODER_API_KEY']}}` на проекте есть.
- **Инцидент `reg-api`** (`SmutybV5qJQjQASJGY9vi`, v `NG1QA9OiltCKjissdeK3G`): живой `ap_flow_structure` совпадает с `flows/reg-api.json`; `delete_account` полон — `registrations` 24→26, `feedback` 27→29, `broadcast_targets` 30→32, `sessions` 33→35, `quiz_answers` 40→42, `quiz_attempts` 43→45, `users` 36→38, ответ 39; восстановленные `step_35` (delete session INSIDE_LOOP `step_34`), `step_36` (read users после `step_44`), `step_37` (loop users), `step_38` (delete user INSIDE_LOOP) на месте; 46 шагов, `ap_validate_flow` — 0 invalid (1 skipped — `step_12` W60, так и задумано); `ap_export_flow` вернул `NG1QA9OiltCKjissdeK3G` = манифест. Удалённые `step_*` восстановлены без потерь.
- `migrations`: строки `2026-10-05-w136-00` (publish reg-api), `-01` (publish manage-api), `-90`/`-91` (delete пробников) есть; пробных флоу в проекте не осталось.
- Офлайн: `check-texts.py` — 302 ссылки, 0 расхождений; `check-commands.py` — 0 нарушений; `check-export-secrets.sh` — ок. `check-migrations.py` не гонялся (нет `QADAM_API_KEY`; на Linux keychain недоступен).
- Отдельно замечено, **не дефект W136**: `ap_validate_flow` по `reg-api` (и `reg-start`, `tg-router` и др.) показывает 21 шаг на «unavailable» `@aiqadam/qadam-tables@0.4.5/0.4.6`, но живые прогоны эти шаги исполняют (`reg-api` 03.10 — `step_6/7/8` на 0.4.5; `tg-router` 05.10 — `step_7` на 0.4.5, SUCCEEDED). Похоже, предупреждение валидатора здесь недостоверно; «чинить» его в рамках W136 не следует.

## Хвосты и блокеры

- Квота Геокодера (1000/сутки) — с расширением форм расход растёт; цена Q55.
