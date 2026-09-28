# Окружения

Карта сред проекта. Логика работы — [ADR-0042](../docs/adr/0042-two-environments-one-repo.md).
Здесь — **чем среды отличаются**; что одинаково, описано в карточках флоу и таблиц.

## Сводка

| | `events-dev` | `events-prod` |
| --- | --- | --- |
| Роль | канон, вся разработка | замороженная копия dev |
| Инстанс | `app.flow.aiqadam.org` | `app-prod.flow.aiqadam.org` |
| MCP-сервер | `app-flow-events-dev` | `app-flow-events-prod` |
| project id | `vZXlkfz60dx6kX97yICx7` | `vZXlkfz60dx6kX97yICx7` (совпадает с dev — копия) |
| Telegram connection | `Oct3laLPiavfizCJagLcM` (`Events-QA-Bot`) | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |
| Бот | `@aiqadam_events_qa_bot` (id `8106260912`) | `@aiqadam_events_dev_bot` (id `8762958531`) — исторический dev-бот, оставшийся prod |
| `MINIAPP_URL` | `https://miniapp.events.aiqadam.org/` | `https://miniapp-prod.events.aiqadam.org/` |
| Статус | пересобран из репозитория (W106, 2026-09-26) — новые id | догнан до dev буквально (W122, 2026-09-28); flowId — прежние |

## Mini App

Один код (`miniapp/`), среда — на сборке ([W105](../docs/work/W105-miniapp-two-envs.md)).

| | dev | prod |
| --- | --- | --- |
| Источник | `aiqadam-events-bot@main` | `aiqadam-events-bot@prod` |
| Конфиг | `miniapp/.env.dev` | `miniapp/.env.prod` |
| Деплой | `pages.yml` (этот репозиторий) | репо `aiqadam/aiqadam-events-bot-prod`, `pages-prod.yml` |
| Адрес | `miniapp.events.aiqadam.org` | `miniapp-prod.events.aiqadam.org` |
| API-база | `app.flow.aiqadam.org` | `app-prod.flow.aiqadam.org` |

## Синхронизация prod с dev (W122, 2026-09-28)

Хотфикс [ADR-0042](../docs/adr/0042-two-environments-one-repo.md): prod догнал
dev по всем пакетам, применённым на dev после копии 2026-09-26. Логика флоу prod
пошагово совпадает с dev (`ap_export_flow` обеих сред, 30 общих флоу, 0
расхождений шагов), id сред по-прежнему разные.

- **W109/W112/W113b/W121** (средовые механики): `__clear`/`cancelled_at` на 5
  шагах, `logOutput:false` (25 точек), `DECLARE_KEY` на 7 таблицах,
  `dedup-report` удалён.
- **i18n (W25/W27)**: на prod залит каталог платформенных переводов
  (`i18n/{ru,uz,en}.json`, 441 ключ), выставлен `project.defaultLocale = ru`,
  `texts` во всех пользовательских флоу переведены на `{{$t[...]}}`.
- **W114/W116 (язык), W119/W120 (город)**: `tg-router` `step_27` +
  `localeSource`, карточка `ob:lang`, `set_lang`, город «Вы из Ташкента?».
- **Mini App prod**: ветка `prod` догнала `main` (W122), собрана `build:prod`
  и задеплоена из репо `aiqadam/aiqadam-events-bot-prod`.

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
- **dev**: граф пересобран заново из репозитория на `Events-QA-Bot` (W106) —
  каждый telegram-шаг и `callFlow`-шаг несёт `auth`/`flow` на connection среды;
  живого `TZTl…` в dev нет.

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

После пересборки dev (W106) id сред **разошлись**: dev получил новые `flowId` и
`externalId`, prod сохранил прежние (он — замороженная копия). `table_id`/`field_id`
таблиц не менялись (таблицы dev сохранены как есть). Это **текущее состояние,
а не гарантия**.

| Сущность | dev | prod |
| --- | --- | --- |
| flowId / externalId | новые (W106) — в [flows/](flows/) | прежние, копия до пересборки |
| table_id / field_id | без изменений | совпадают с dev |
| `migrations` | история dev + строки W106 | унаследована от dev |

Новые dev-`flowId` и `externalId` — в карточках [flows/](flows/) и в
`miniapp/.env.dev`. Старые id из `miniapp/.env.prod` принадлежат prod — их не менять.
