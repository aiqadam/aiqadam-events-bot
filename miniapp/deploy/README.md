# Деплой Mini App: две среды

Контекст — [ADR-0042](../../docs/adr/0042-two-environments-one-repo.md), пакет W105.
Код один; среду задаёт **сборка** (`miniapp/.env.dev` / `miniapp/.env.prod`).

| | dev | prod |
| --- | --- | --- |
| Ветка-источник | `main` | `prod` |
| Конфиг | `.env.dev` | `.env.prod` |
| Сборка | `npm run build:dev` | `npm run build:prod` |
| Workflow | `.github/workflows/pages.yml` | `miniapp/deploy/pages-prod.yml` (шаблон) |
| Pages-репозиторий | этот | отдельный (один кастомный домен на репозиторий) |

## Порядок

- **dev**: пуш в `main` при изменениях `miniapp/**` или `i18n/**` → `pages.yml` собирает
  `build:dev` и публикует на dev-домен.
- **prod**: слияние проверенного `main` в ветку `prod` (в prod-репозитории) → `pages-prod.yml`
  собирает `build:prod` и публикует на prod-домен. Прод-фронт не собирается из `main`
  автоматически — только осознанным promote.

## Что владелец заводит один раз

1. Отдельный репозиторий prod-Pages (иначе второй кастомный домен не получить).
2. В нём — ветка `prod` и `miniapp/deploy/pages-prod.yml` в `.github/workflows/`,
   свой `miniapp/CNAME` (prod-домен).
3. В BotFather: Mini App URL у **prod**-бота — на prod-домен; у dev-бота — на dev.
4. Variable `MINIAPP_URL` в проекте каждой среды — на свой домен.

## Договорённость по картам flowId

`.env.dev` и `.env.prod` содержат карту webhook-`flowId`. Пока prod — копия dev,
карты совпадают. После пересборки dev (или prod) карты **разводятся**: dev-сборка
получает `flowId` dev-проекта, prod-сборка — prod-проекта.
