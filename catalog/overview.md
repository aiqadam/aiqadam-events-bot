# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

## ⏳ Состояние на 2026-09-13: пересборка по W26 в процессе

Владелец проекта **очистил инстанс `events-dev` 13.09.2026** (0 флоу, 0 таблиц).
[W26](../docs/work/W26-rebuild-on-one-touch.md) взят в работу тем же днём и
восстанавливает проект по [ADR-0015](../docs/adr/0015-one-touch-one-flow.md).
Проверено через MCP/UI:

| Что | Сколько | Чем проверено |
|---|---|---|
| Флоу | **18** — пять `fn-*`, четыре касания регистрации, `tg-router`, `checkin-api`, `my-qr-api`, шесть флоу визарда ивента (W11, слит в W26) | `ap_list_flows`, карточки в [flows/](flows/) |
| Таблицы | **10** — все из [DATA-MODEL.md](../docs/DATA-MODEL.md), пересозданы W26 | `ap_list_tables`, карточки в [tables/](tables/) обновлены с новыми `externalId` |
| Connections | **1** — `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`, ACTIVE) | `ap_list_connections` |
| Variables | все четыре на месте (`QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`, `MINIAPP_URL`) | проверено в UI владельцем 2026-09-13 (агент W26 не имел доступа к браузеру) |

Все 18 флоу собраны и опубликованы: пять `fn-*`, четыре касания регистрации,
`tg-router`, `checkin-api`, `my-qr-api`, шесть флоу визарда ивента
(`event-wizard-start`, `event-wizard-edit-start`, `event-wizard-field`,
`event-wizard-photo`, `event-wizard-geo`, `event-wizard-publish` —
[ADR-0016](../docs/adr/0016-shared-flow-for-same-shaped-touches.md)) —
карточки в [flows/](flows/).
Регистрация, чекин (со всеми четырьмя сценариями STF-2 на реальной подписи
Telegram) и визард ивента (маршрутизация, все шесть полей, авторизация
правки, уведомление на изменение) проверены сквозными прогонами, включая
реальную доставку в Telegram владельца — подробности в
[docs/work/W26-rebuild-on-one-touch.md](../docs/work/W26-rebuild-on-one-touch.md).

**Важное открытие W26:** `callFlow`'s `flowProps` теперь резолвится в
единственное поле `payload` (`OBJECT`), а не в плоские именованные поля —
без обёртки `{"payload": {...}}` вызов формально успешен, но callee получает
пустые поля. Подробности — `catalog/flows/tg-router.md` и CLAUDE.md
(готча 7a). Касается каждого нового `callFlow` в проекте, включая будущие
W9/W10/W11/W14.

### Заодно: почему это не только про очистку

Каталог разошёлся с реальностью **до** очистки, пока инстанс ещё работал
(найдено 13.09.2026 при челлендже каталога). На тот момент здесь было написано
«вызовов между флоу ровно один» — их было пять; «`event-wizard` ещё не собран» —
он был собран, 66 шагов, ENABLED; шестым флоу назван чужой бенчмарк
[Q34](../docs/OPEN-QUESTIONS.md#q34) — его уже не было. Правило синхронизации
из [README.md](README.md#правило-синхронизации) не выдержало нагрузки при живом
инстансе, и это отдельная проблема, которую очистка не создала, а обнажила.
W26 обязан ответить, чем её лечить, а не просто переписать файл заново.

## Что пережило очистку и остаётся в силе

К инстансу не привязано, идентификаторов не содержит, при пересборке
экономит круги ревью:

| Документ | Что в нём |
|---|---|
| [flows/README.md](flows/README.md) | 13 проверенных фактов про MCP, subflow'ы и логи прогонов. Пункты 1–4 (вход в `trigger['output'].data`, форма ответа `callFlow`, «callee публикуется раньше вызывающего», «callee исполняется в PRODUCTION при тесте вызывающего») снова стали горячими: ADR-0015 возвращает `fn-*`. Пункты 10–12 куплены полутора кругами ревью W2 |
| [tables/README.md](tables/README.md) | два namespace'а идентификаторов, ловушка `cells[<fieldId>].value`, рецепт пересборки схемы |
| [flows/README.md](flows/README.md#соглашения-унаследованные-сниппетами) | сентинелы `-` / `!no-key`, постфильтр прав в коде поверх фильтра чтения (страховка от [#382](https://github.com/aiqadam/qadam-flow/issues/382)), проекция колонок |
| [snippets/](snippets/) | **код** эталонов. Обоснование в [snippets/README.md](snippets/README.md) устарело — см. ниже |
| [variables.md](variables.md), [connections.md](connections.md) | имена Variables и требуемые connections; connection очистку пережил |
| [tables/*.md](tables/) | схемы полей — актуальны как спека, идентификаторы в них мертвы |

**Оговорка по `snippets/README.md`:** раздел «Почему так, а не subflow» стоит
на замерах от 12.09.2026 (`callFlow` ≈ 1,0–1,2 с, CODE-шаг ≈ 0,06 с). Оба числа
сняты **до** апстрим-фиксов [#412](https://github.com/aiqadam/qadam-flow/issues/412)
и [#417](https://github.com/aiqadam/qadam-flow/issues/417) от 13.09, и цифра для
CODE-шага расходится с замеренной после них (2–5 мс) в 12–30 раз. Перемер
заведён как [Q35](../docs/OPEN-QUESTIONS.md#q35) и блокирует пункт 5 ADR-0015.

## Flows

**Нет ни одного.** Как читать каталог, когда они появятся, и проверенные факты
про subflow'ы — [flows/README.md](flows/README.md). Целевой состав по ADR-0015 —
[BACKLOG W26](../docs/BACKLOG.md#w26-пересборка-events-dev-по-adr-0015).

## Таблицы

**10 таблиц, все пусты.** Пересозданы [W26](../docs/work/W26-rebuild-on-one-touch.md)
2026-09-13 по схеме [docs/DATA-MODEL.md](../docs/DATA-MODEL.md); идентификаторы —
новые, записаны в карточках [tables/](tables/), рецепт — [tables/README.md](tables/README.md).

`strings` пересоздана вместе с остальными, но пуста осознанно: `i18n-sync`
(флоу, который её наполнял) не входит в область W26 и восстанавливается
[W25](../docs/BACKLOG.md#w25-возврат-i18n-на-платформенном-механизме). Источник
правды для неё не тронут — `i18n/*.json` в репозитории.

## Переменные

См. [variables.md](variables.md). Проверены в UI владельцем проекта 2026-09-13
(первый пункт W26): `QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`,
`MINIAPP_URL` — все четыре на месте. Агент W26 не проверял их сам: браузерное
расширение недоступно в его сессии, MCP их не перечисляет.

## Connections

См. [connections.md](connections.md). `AI Qadam Events (dev)`
(`@aiqadam/qadam-telegram-bot`) очистку пережил, статус ACTIVE — проверено
`ap_list_connections` 13.09.2026.

## Схема потоков данных

Целевая схема описана в [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои)
и [FLOWS.md](../docs/FLOWS.md). Заполняется здесь по мере сборки.
