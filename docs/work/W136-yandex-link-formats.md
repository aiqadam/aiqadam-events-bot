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
| flow `manage-api` | `pFtbgOP3U8sNFvP86Szli` (v `OajdZfYsM6d7ty0YhyHuf`) | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
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
- **2026-10-05** — сервер `manage-api` (id `pFtbgOP3U8sNFvP86Szli`) ещё не
  перестроен: впереди — `geo plan` + роутер режимов `oid`/`text`/`coords`/`short`.
- **2026-10-05** — сервер `manage-api` (`pFtbgOP3U8sNFvP86Szli`) перестроен:
  `step_34` → план, `step_35` → ROUTER, ветки `oid`/`text`/`coords`/`short`/`none`;
  `ap_validate_flow` 72/72, опубликовано (v `OajdZfYsM6d7ty0YhyHuf`), экспорт,
  строка `migrations` `2026-10-05-w136-01`. Каталог и прототип обновлены;
  сценарий отписки в прототипе заменён (хвост W135), `check.mjs` зелёный.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Квота Геокодера (1000/сутки) — с расширением форм расход растёт; цена Q55.
