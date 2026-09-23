# W72. Phase 2: ссылки на карты в Mini App + фикс 0,0

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: P2 ([#124](https://github.com/aiqadam/aiqadam-events-bot/issues/124))
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

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
  локально: пустые и `('0','0')` → ссылки «Открыть на карте» в тексте нет;
  реальные координаты → есть (6/6). Ссылка: `yandex.uz/maps/?ll=69.335264%2C41.341407…`.
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

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

## Хвосты и блокеры

- Живая проверка на телефоне и Telegram Desktop (клик по обеим ссылкам,
  пин в Ташкенте) — на владельца.
- `tools/check-migrations.py` без ключа платформы — на W15.
