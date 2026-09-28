# W126. Перенос dev→prod: W123, W124, W125 (хотфикс ADR-0042)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W123, W124, W125 (все `готов` на dev)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Догнать `events-prod` до `events-dev` по пакетам, применённым на dev после
переноса [W122](W122-prod-sync.md) (W109–W121 + i18n). Prod — замороженная копия,
меняется только осознанным хотфиксом через MCP `app-flow-events-prod`
(ADR-0042 п. 2). Запрос владельца 2026-09-28: «переноси все».

## Объём (сверка `ap_export_flow` dev↔prod, нормализация по id сред)

| Пакет | Что | Точки на prod |
|-------|-----|---------------|
| W123 | экран `#/report`: таблица `reports`, flow `report-api`, запись в меню | `reports` `L3ext9iaAfky3hQowtHP3`; `report-api` `ugkIwo9IHF5x6pMLR5yGT`; `menu` |
| W125 | язык контента: поле `events.lang`, показ в карточке | `events.lang` `U0UzI9xrhnQj1oOgIy1wy`; `manage-api`, `events-api`, `reg-start` |
| W124 | Mini App: язык при холодном запуске | только сборка `prod` (инстанс не трогается) |
| i18n | 28 новых ключей (`report.*`, `menu.btn.report`, `event.card.lang`, `field.lang`) | каталог переводов prod |

## Что применено на prod

- **Данные**
  - таблица `reports` (10 полей, `STATIC_DROPDOWN` `kind`/`status`, без объявленного ключа);
  - поле `events.lang` (TEXT), дефолт `ru` — на уровне флоу.
- **Переводы**: 28 ключей × ru/uz/en залиты `ap_upsert_translations` (prod-MCP
  инструменты переводов в сессии недоступны — вызваны прямым JSON-RPC к
  `app-prod.flow.aiqadam.org/mcp`, тем же MCP).
- **Флоу**: `events-api`, `manage-api`, `menu`, `reg-start` — dev-входы изменённых
  шагов с переносом `lang`/`reports`-`externalId` dev→prod; `report-api` создан из
  dev-шаблона `ap_import_flow` с заменой `flow.externalId` `fn-hmac-init-data` и
  `externalId` полей `reports`. Все пять `ap_validate_flow` valid и опубликованы.
  Ссылки на connection/`callFlow` не трогались: у затронутых шагов их нет, prod
  `report-api` — `callFlow` на prod-`fn-hmac-init-data` `VzXoy80RWnX7pM4dm8eor`.
- **Mini App**: `main` → ветка `prod`, `report` добавлен в `.env.prod`, `build:prod`
  зелёный, ветка запушена; деплой — workflow `pages-prod` репо
  `aiqadam/aiqadam-events-bot-prod`.

## Как проверено

- **Диф dev↔prod по экспортам** (30 общих флоу): до правки — расхождения только в
  `events-api`/`manage-api`/`menu`/`reg-start` (`texts`, `lang`, `columns`,
  `sourceCode`); после — семантических расхождений нет (остаются лишь `flow.externalId`
  и id полей таблиц, у сред разные by design).
- **`ap_validate_flow`** на пяти флоу — все `valid` (4/61/15/21/12 шагов); ошибка
  `unknown translation key` снялась после заливки 28 ключей.
- **`ap_export_flow report-api` prod** — 12 шагов, `table_id` и `values` указывают
  на prod-`reports`, `callFlow` — на prod-`fn-hmac-init-data`.

## Журнал

- **2026-09-28** — пакет взят по запросу владельца. Инвентарь: prod уже догнан
  W122 (W109–W121 + i18n), неперенесёнными остаются W123/W124/W125.
- **2026-09-28** — prod: таблица `reports`, поле `events.lang`, 28 переводов,
  правки 4 флоу, создан `report-api` (импорт dev-шаблона), пять публикаций.
- **2026-09-28** — Mini App prod: `main`→`prod`, `report` в `.env.prod`,
  `build:prod`, деплой `pages-prod`.

## Хвосты и блокеры

- Prod-MCP в сессии не отдаёт `ap_list/upsert_translations` — использован прямой
  JSON-RPC; при следующем переносе проверить, не появились ли инструменты.
- Живой сквозной e2e в Telegram (экран `#/report`, сохранение языка события в
  `#/manage`) — за владельцем: у агента нет валидного `initData`/телефона.
- Строки `migrations` на prod — 9 строк `2026-09-28-w126-01…09`
  (`reports`/`events.lang` create/update, публикации пяти флоу, каталог переводов).

## Ревью

- Ожидается независимое ревью.
