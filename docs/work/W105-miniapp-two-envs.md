# W105. Mini App: две среды (dev/prod), конфиг на сборке

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (пре-приёмка W15)
- **Зависит от**: [ADR-0042](../adr/0042-two-environments-one-repo.md) — принят
- **Начат**: 2026-09-26 · **Закрыт**: —

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
| prod-деплой (шаблон) | `miniapp/deploy/pages-prod.yml` |
| Инструкция | `miniapp/deploy/README.md` |

## Чек-лист готовности

- [x] Код параметризован; в бандл попадает конфиг одной среды
- [x] `npm run build:dev` и `npm run build:prod` проходят; prod-бандл без dev-хоста
- [x] dev-деплой переведён на `build:dev`
- [x] Шаблон prod-деплоя и инструкция
- [ ] Владелец: prod-Pages репозиторий, ветка `prod`, домены, BotFather URL
- [ ] `MINIAPP_URL` prod → prod-домен
- [ ] `catalog/environments.md` — зафиксировать домены сред
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

## Хвосты и блокеры

- Домены и prod-репозиторий — решение/шаги владельца.
- `dist/` не в git (в `.gitignore`), в артефакт Pages собирается в CI.
