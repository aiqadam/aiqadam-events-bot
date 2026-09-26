# W105. Mini App: две среды (dev/prod), конфиг на сборке

- **Статус**: готов (независимое ревью круг 2 — «замечаний нет»)
- **Владелец**: агент
- **Волна**: вне волн (пре-приёмка W15)
- **Зависит от**: [ADR-0042](../adr/0042-two-environments-one-repo.md) — принят
- **Начат**: 2026-09-26 · **Закрыт**: 2026-09-26

## Цель

Развести Mini App по двум средам: dev — из `main`, prod — из ветки `prod`
(решение владельца 2026-09-26, [ADR-0042](../adr/0042-two-environments-one-repo.md)),
чтобы действия prod-пользователей не уходили в dev. Код один, среда — на сборке.

## Зачем (найденный дефект)

`miniapp/src/lib/api.ts` жёстко зашивал `https://app.flow.aiqadam.org` (dev) и 9 webhook-`flowId`.
`MINIAPP_URL` prod указывал на ту же dev-статику, поэтому кнопки prod-бота открывали dev-Mini App,
и запросы шли в dev. Живой случай: `delete_account` пользователя `322876545` (прогон
`goaRirAkrsj2KHZLPVxWq`, dev) **удалил аккаунт в dev**, тогда как в prod он остался.

## Что построено

| Артефакт | Файл |
| --- | --- |
| Конфиг API из окружения | `miniapp/src/lib/api.ts` (`VITE_API_BASE`, `VITE_FLOW_IDS`) |
| Типы env | `miniapp/src/vite-env.d.ts` |
| Конфиги сред | `miniapp/.env.dev`, `miniapp/.env.prod` |
| Скрипты сборки | `miniapp/package.json` (`build:dev`, `build:prod`) |
| dev-деплой | `.github/workflows/pages.yml` (`build:dev`) |
| prod-деплой | репо `aiqadam/aiqadam-events-bot-prod`, workflow `pages-prod.yml` |
| Инструкция | `miniapp/deploy/README.md` |

Репозиторий **prod-Pages**: <https://github.com/aiqadam/aiqadam-events-bot-prod> —
тонкий (только workflow): собирает `aiqadam-events-bot@prod` режимом `build:prod`.
Pages включён, первый деплой зелёный: <https://aiqadam.github.io/aiqadam-events-bot-prod/>.

## Чек-лист готовности

- [x] Код параметризован; в бандл попадает конфиг одной среды
- [x] `npm run build:dev` и `npm run build:prod` проходят; prod-бандл без dev-хоста
- [x] dev-деплой переведён на `build:dev`
- [x] prod-Pages репозиторий создан, Pages включён, деплой проверен
- [x] ветка `prod` в `aiqadam-events-bot` создана (bootstrap из текущей работы)
- [x] prod-домен `miniapp-prod.events.aiqadam.org` (CNAME → `aiqadam.github.io`, DNS-only) + привязан к prod Pages, HTTPS работает
- [x] `MINIAPP_URL` prod → prod-домен (владелец)
- [x] BotFather не требуется (боковая кнопка не нужна); `web_app`-кнопка на prod-домен принята Telegram (`sendMessage` 200)
- [x] `catalog/environments.md` — домены сред
- [ ] независимое ревью

## Как проверено

- `npm run build:dev` → OK; `npm run build:prod` → OK; в prod-бандле
  встречается только `app-prod.flow.aiqadam.org`, dev-хоста нет.

## Журнал

- **2026-09-26** — пакет взят. Решение владельца: вариант 1 (два деплоя/домена),
  релиз prod — из ветки `prod` в GitHub. GitHub Pages даёт один кастомный домен на
  репозиторий → prod-Pages — отдельный репозиторий; в этом (dev) шаблон prod-деплоя
  лежит вне `.github/workflows/` и не активируется.
- **2026-09-26** — карты `flowId` в `.env.dev`/`.env.prod` пока совпадают (prod — копия
  dev); развести после пересборки dev.
- **2026-09-26** — prod-Pages репозиторий `aiqadam/aiqadam-events-bot-prod` создан,
  Pages включён, деплой зелёный. Домен `miniapp-prod.events.aiqadam.org` заведён в
  Cloudflare (CNAME → `aiqadam.github.io`, DNS-only) и привязан к prod Pages;
  HTTPS отдаёт 200, ассеты и `i18n/ru.json` — 200, в бандле только `app-prod`.
  Прод-домен не трогал dev: `miniapp.events.aiqadam.org` остаётся за dev.
- **2026-09-26** — владелец: BotFather-Mini-App-URL у prod-бота **не нужен** (боковая
  кнопка не заводится), `MINIAPP_URL` prod переставлен на prod-домен. Проверено живым
  `send_text_message` через prod-connection: Telegram принял `web_app`-кнопку на
  `miniapp-prod.events.aiqadam.org` (200, `message_id` 5571) — домен у бота разрешён,
  правки Bot Settings → Domain не нужны.

## Ревью

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-26 · **Вердикт**: **есть замечания** — дефектов кода и деплоя не найдено (код и prod-деплой проверены живьём/извне и чисты); замечания «важно» касаются только каталога, остальное — «на будущее». После правки документации пакет может идти в `готов`.

### Замечания

1. **важно** — **`catalog/environments.md` неполон/устарел** (файл заведён этим пакетом, коммит `a3d64aa`): project id prod — «уточнить» (ADR-0042 п.4 требует его в карте сред); строка `MINIAPP_URL` prod всё ещё «скопирован dev-адресом — должен указывать на prod-сборку», хотя чек-лист пакета и журнал фиксируют, что владелец переставил его на `miniapp-prod.events.aiqadam.org`, и таблица Mini App в том же файле это подтверждает. Противоречие внутри одного файла. — `catalog/environments.md`.
2. **на будущее** — `catalog/overview.md` §Mini App всё ещё описывает единственный деплой (`pages.yml` → `npm ci && npm run build`) и не упоминает prod-сборку/`build:dev`/`build:prod`. — `catalog/overview.md`.
3. **на будущее** — `api.ts` `endpoint()` при отсутствии `VITE_API_BASE`/ключа молча возвращает `''` (в лог — только `console.error`): неверная сборка не падает заметно, а шлёт POST на URL текущей страницы. Стоит сделать отказ явным — ровно чтобы «собрали не в ту среду/без env» не было бесшумным (исходный дефект, который пакет чинил, был именно бесшумным). — `miniapp/src/lib/api.ts`.
4. **на будущее** — карты `flowId` в `.env.dev`/`.env.prod` пока совпадают (prod — копия); после пересборки dev обновить `.env.dev` и карту в `catalog/environments.md` тем же пакетом (ADR-0042 п.7). Журнал это уже отмечает.

### Исправлено владельцем (2026-09-26)

1. **`catalog/environments.md` неполон/устарел** — *исправлено*: prod project id и `MINIAPP_URL` prod заполнены (см. W104 п.5).
2. **`overview.md` §Mini App** — *исправлено*: описаны `build:dev`/`build:prod`, prod-репозиторий и ветка `prod`.
3. **`endpoint()` молчаливый `''`** — *исправлено*: теперь бросает `Error` (громкий отказ при сборке без `.env` среды); `build:dev`/`build:prod` проходят.
4. **карты `flowId` совпадают** — *принято хвостом*: обновить `.env.dev` после пересборки dev.

### Что проверено

- **Код**: `grep` по `miniapp/` — жёстких `app.flow.aiqadam.org` и `flowId` вне `.env.dev`/`.env.prod` не осталось; `index.html` — `%VITE_API_BASE%` (Vite подставил: проверено на живом prod-HTML); `base: './'`; `package.json` — `build:dev`/`build:prod`; `pages.yml` → `build:dev`; `.gitignore` ре-инклюдит `.env.dev`/`.env.prod` (оба в git). Карта `.env.dev` сверена с живым dev — все 9 `flowId` совпадают с `ap_list_flows`.
- **Деплой (проверен извне, GitHub API + HTTPS)**: репо `aiqadam/aiqadam-events-bot-prod` существует (публичный, `has_pages: true`), в нём `CNAME` = `miniapp-prod.events.aiqadam.org` и `.github/workflows/pages-prod.yml`, идентичный шаблону в репо; ветка-источник `aiqadam-events-bot@prod` существует (`e18c279`, содержит `build:prod` и `.env.prod`). Живой `https://miniapp-prod.events.aiqadam.org/` — 200: `preconnect` и бандл `index-BLy1jhF8.js` содержат только `app-prod.flow.aiqadam.org`, вхождений `app.flow.aiqadam.org` — 0, все 9 `flowId` на месте. CNAME берётся из prod-репозитория; dev-источник (CNAME = `miniapp.events.aiqadam.org`) не подтягивается.
- **Границы**: UI-экраны и тексты пакет не менял — сверка с прототипом (п.3a), голос и бренд «не относятся». AppSec: страница ключей не хранит и прав не решает (только собирает URL), секретов/`initData` в изменениях нет, в `.env.*` — публичные хост и `flowId`.
- **Офлайн**: `check-export-secrets.sh` — чисто; `check-texts.py` — 0 расхождений; `check-commands.py` — 0. `check-migrations.py` не прогнан (нет ключа).

### Круг 2 (2026-09-26)

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-26 · **Вердикт**: **замечаний нет** по коду, деплою и каталогу в объёме пакета. Отдельно: prod-инстансная часть (значение `MINIAPP_URL` в проекте prod, приём `web_app`-кнопки Telegram) живьём не проверена — prod-MCP недоступен (см. W104, круг 2, замечание 1); вердикт по ней не выдаётся.

#### Что закрыто из круга 1

- **п.1 (`catalog/environments.md`)** — закрыто (см. W104, п.5): prod project id и `MINIAPP_URL` prod заполнены, внутреннее противоречие снято.
- **п.2 (`overview.md` §Mini App)** — закрыто: описаны `build:dev`/`build:prod`, prod-репозиторий и ветка `prod`.
- **п.3 (`endpoint()` молчаливый `''`)** — закрыто: `endpoint()` теперь бросает `Error`; строка «сборка без .env среды» присутствует в локальном бандле; `npm run build:dev` и `npm run build:prod` проходят (EXIT=0).
- **п.4 (карты flowId совпадают)** — остаётся хвостом, как и договорено: развести после пересборки dev.

#### Новых замечаний нет

#### Что проверено в круге 2

- **Сборки**: `npm run build:dev` → EXIT=0; `npm run build:prod` → EXIT=0. В prod-бандле (`dist/assets/index-CEp6hLuy.js`) только `app-prod.flow.aiqadam.org`, dev-хоста нет; guard-строка на месте. Обе карты `VITE_FLOW_IDS` содержат все 9 ключей, которые использует `api.ts` (`myQr`, `checkin`, `manage`, `events`, `reg`, `feedback`, `staffEvents`, `checkinCounter`, `staffInvite`), — import-time бросок на валидной сборке не срабатывает. `VITE_API_BASE` — dev/prod правильно; все 9 `flowId` в обоих `.env` совпадают с живым dev (ожидаемо: prod — копия).
- **Исходники**: вне `.env.dev`/`.env.prod` жёстких `app.flow.aiqadam.org`/`app-prod.flow.aiqadam.org` и `flowId` нет (`grep` по `miniapp/`); `index.html` — `%VITE_API_BASE%`; `pages.yml` → `build:dev`; `miniapp/deploy/pages-prod.yml` собирает `build:prod` из ветки `prod` и берёт `CNAME` из prod-репозитория.
- **Внешне (prod-Pages, не инстанс)**: репо `aiqadam/aiqadam-events-bot-prod` публичный, `has_pages: true`, `CNAME` = `miniapp-prod.events.aiqadam.org`, workflow `pages-prod.yml`; ветка `prod` = `e18c279`, `.env.prod` на ней. Живой `https://miniapp-prod.events.aiqadam.org/` → 200 (у GitHub Pages `<домен>/CNAME` отдаёт 404 — это не показатель, CNAME сверен через API), бандл `index-BLy1jhF8.js` содержит только `app-prod…` и все 9 `flowId`. Опубликованный prod-бандл собран из ветки `prod` (`e18c279`) и **ещё не содержит** правку `endpoint()` из `d217de7` — ожидаемо (прод обновится при promote ветки), на пакет не влияет.
- **Границы**: UI/экраны/тексты/бренд пакет не менял — п.3a «не относится»; AppSec — новых поверхностей нет (страница ключей не хранит, решений о правах не принимает; в `.env.*` только публичные хост и `flowId`).
- **Офлайн**: `check-export-secrets.sh` — 0; `check-texts.py i18n/ru.json flows/*.json` — 31 флоу, 265 пар, 0 расхождений; `check-commands.py i18n/*.json flows/*.json` — 0; `check-agents.py` — 0.

## Хвосты и блокеры

- Домены и prod-репозиторий — решение/шаги владельца.
- `dist/` не в git (в `.gitignore`), в артефакт Pages собирается в CI.
