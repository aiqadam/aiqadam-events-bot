# Окружения

Карта сред проекта. Логика работы — [ADR-0042](../docs/adr/0042-two-environments-one-repo.md).
Здесь — **чем среды отличаются**; что одинаково, описано в карточках флоу и таблиц.

## Сводка

| | `events-dev` | `events-prod` |
| --- | --- | --- |
| Роль | канон, вся разработка | замороженная копия dev |
| Инстанс | `app.flow.aiqadam.org` | `app-prod.flow.aiqadam.org` |
| MCP-сервер | `app-flow-events-dev` | `app-flow-events-prod` |
| project id | `vZXlkfz60dx6kX97yICx7` | уточнить |
| Telegram connection | `Oct3laLPiavfizCJagLcM` (`Events-QA-Bot`) | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |
| Бот | Events-QA-Bot | Events-Prod |
| `MINIAPP_URL` | `https://miniapp.events.aiqadam.org/` | скопирован dev-адресом — **должен указывать на prod-сборку** |
| Статус | очищается и пересобирается из репозитория | копия dev на 2026-09-26, «as is» |

## Мёртвая ссылка в шагах обеих сред

Обе среды унаследовали от старых прогонов ссылки на **удалённый** connection
`TZTlXaCEO2hEvimUowbSA`:

- `tg-router` — `step_15` (мёртвый `auth` на `callFlow`), `step_22`, `step_26`;
- `menu` — `step_5`, `step_12`;
- по последнему экспорту dev такой `connectionIds` у 17 флоу — полный список
  даёт скан живого проекта.

`ap_validate_flow` битую ссылку на connection **не ловит** (отвечает «ready»),
поэтому это чинится только адресно.

## Переменные: чем среды обязаны отличаться

| Переменная | Читают флоу | Требование |
| --- | --- | --- |
| `BOT_TOKEN` | 8 вебхук-флоу (`reg-api`, `my-qr-api`, `checkin-api`, `checkin-counter-api`, `staff-events-api`, `staff-invite`, `manage-api`, `feedback-api`) | у prod — токен **prod**-бота; копия несёт dev-токен |
| `QR_SIGNING_KEY` | `my-qr-api`, `checkin-api` | у prod — свой (SECURITY.md), не dev-ключ |
| `MINIAPP_URL` | 8 флоу | у prod — адрес prod-сборки Mini App |
| `BOT_USERNAME` | голос бота | у prod — имя prod-бота |
| `YANDEX_GEOCODER_API_KEY` | геокодер адреса | может быть общей |

## Id сред (карта dev↔prod)

На 2026-09-26 id флоу, таблиц и полей **совпадают** — prod сделан копией dev.
Это **текущее состояние, а не гарантия**: очистка и пересборка dev меняет id dev,
и карту нужно обновить тем же пакетом работ.

| Сущность | dev | prod |
| --- | --- | --- |
| flowId (все флоу) | совпадают | совпадают |
| table_id / field_id | совпадают | совпадают |
| `migrations` | история dev | унаследована от dev |
