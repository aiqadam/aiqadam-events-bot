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
| Бот | `@aiqadam_events_qa_bot` (id `8106260912`) | `@aiqadam_events_dev_bot` (id `8762958531`) — исторический dev-бот, оставшийся prod |
| `MINIAPP_URL` | `https://miniapp.events.aiqadam.org/` | скопирован dev-адресом — **должен указывать на prod-сборку** |
| Статус | очищается и пересобирается из репозитория | копия dev на 2026-09-26, «as is» |

## Копия инсталляции (2026-09-26)

prod поднят восстановлением дампа dev. Две ловушки копии, обе уже пройдены:

1. Секреты зашифрованы ключом **исходной** инсталляции. Если `ENCRYPTION_KEY` копии
   другой, `{{variables[...]}}` валит прогон `INTERNAL_ERROR` без списка шагов
   (`ERR_OSSL_BAD_DECRYPT`). Лечение — совпадающий `ENCRYPTION_KEY` или перезапись
   всех переменных на копии (сделано: переменные перезаданы владельцем).
   Гоча — [AGENTS.md](../AGENTS.md) №20.
2. Ссылки на удалённый connection не резолвятся и роняют шаг (`ConnectionNotFound`),
   причём и мёртвый `auth` на `callFlow` (у которого пропа `auth` нет) — движок
   резолвит любую `{{connections[...]}}` во входе. Сделано: перепривязка шагов.

## Мёртвая ссылка на connection

Прежний dev-connection `TZTlXaCEO2hEvimUowbSA` удалён, но оставался в шагах:
`tg-router` (`step_15` — мёртвый `auth` на `callFlow`, `step_22`, `step_26`),
`menu` (`step_5`, `step_12`), всего по последнему экспорту — 17 флоу.

- **prod**: 72 шага перепривязаны на `KIbx…`, 17 флоу опубликованы (W104).
- **dev**: снимается пересборкой графа на `Events-QA-Bot` (в работе).

`ap_validate_flow` битую ссылку на connection **не ловит** (отвечает «ready»),
поэтому это чинится только адресно — сканом живого.

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
