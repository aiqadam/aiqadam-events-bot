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
| Статус | пересобран из репозитория (W106, 2026-09-26) — новые id | догнан до dev буквально (W122 + [W126](../docs/work/W126-prod-sync.md), 2026-09-28); flowId — прежние |

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

## Хотфиксы prod после W122

- **W134 (2026-10-03)** — W133: имя текстом на шаге `ob_name` (dev→prod).
- **W137 (2026-10-05)** — W135, [ADR-0054](../docs/adr/0054-broadcast-register-instead-of-unsubscribe.md):
  кнопка «Зарегистрироваться» вместо «Отписаться». Режим — жёсткий cut.
  - `reg-start`: ветка `register_direct` (`step_3` + `direct`, `step_21`/`step_22`
    → `reg-profile`);
  - `tg-router`: маршрут `bcast_unsub` снят; `reg:go:<eventId>` → ветка `reg_go`
    (`answer_callback_query` + `callFlow reg-start` c `direct=true`);
  - `bcast-run`: `step_53`/`step_54` (чтение `registrations`/`events`) → `step_25`
    строит `reply_markup` по адресату; `step_28`/`step_36` доставляют
    `{{step_26['output'].item.markup}}`;
  - `bcast-step`: `step_57`/`step_58`/`step_59` — тест себе показывает ту же
    кнопку; `step_30` доставляет `{{step_59['output'].markup}}`;
  - `bcast-unsub` удалён; ключи `bcast.btn.unsubscribe`, `unsub.already`,
    `unsub.done` сняты.
  - **Версии qadam'ов на prod отличаются от dev.** В `tg-router` сверялся
    dev-эталон (смержены W133+W135). Новые tables-шаги `step_53`/`step_54`
    (`bcast-run`) и `step_57`/`step_58` (`bcast-step`) на prod пин **`0.4.6`**,
    на dev — `0.5.0`; вход (проекция `columns`, фильтры по имени поля) совместим.
    `subflows`/`telegram-bot` на prod те же версии, что и в dev-эталоне
    (`0.4.14`/`0.9.0`).

- **W140 (2026-10-08)** — W139, имена участников на 200+ пользователях
  (`users` на prod = 210). `manage-api`: широкие чтения `users`
  (`step_40`/`step_45`/`step_49`/`step_52`) заменены узким join
  `telegram_id in <idsCsv>`; добавлены CODE-шаги `name ids`
  (`step_61`…`step_64`) и чтение `step_65`; ветка feedback перестроена
  (`step_49` → чтение `registrations`, `step_50.userRows` ← `step_65`).
  **Имена этих шагов на prod иные, чем в dev:** на prod нет W136, там
  auto-нумерация дала `step_61…65`, тогда как на dev W136 занял `step_61…71`
  и W139 добавил `step_72…76` (`catalog/flows/manage-api.md` описывает dev —
  канон). Правка read-only, Mini App не менялся. published
  `VX2IszoIhTr4DdVcM3rNo`; строка `migrations` `2026-10-08-w140-01`.
  Хвост: живой сквозной прогон Mini App «Участники» — на владельце.

Хотфиксы правили только инстанс prod через MCP `app-flow-events-prod`;
`flows/*.json` и `catalog/flows/*.md` не трогали — канон dev (ADR-0042).

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
| table_id / field_id | без изменений, **кроме трёх полей `events`** (ниже) | совпадают с dev, кроме `lang`/`online_url`/`format` |

> **Исключение (W132, 2026-09-29).** Три поля `events` созданы в средах
> независимо и несут разные id: `lang` (dev int `wkJRAt…`/ext `5bvPj31…`,
> prod int `U0UzI9…`/ext `6UVLXYAb…`), `online_url` (dev `Albc…`/`ko1bekd…`,
> prod `KkMoC2mC…`/`XKetQH8z…`), `format` (dev `JJtphc…`/`8bBZDy…`, prod
> `UQJPGb…`/`JMI0Ec14…`). При переносе шагов, читающих/пишущих эти поля,
> id маппятся по имени поля, а не копируются.
| `migrations` | история dev + строки W106 | унаследована от dev |

Новые dev-`flowId` и `externalId` — в карточках [flows/](flows/) и в
`miniapp/.env.dev`. Старые id из `miniapp/.env.prod` принадлежат prod — их не менять.
