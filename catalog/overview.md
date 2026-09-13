# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

## Состояние

Собрано пакетом [W26](../docs/work/W26-rebuild-on-one-touch.md) по
[ADR-0015](../docs/adr/0015-one-touch-one-flow.md) («одно касание = один
флоу») и [ADR-0016](../docs/adr/0016-shared-flow-for-same-shaped-touches.md)
(последовательность структурно одинаковых вопросов делит один флоу), плюс
пакет [W06](../docs/work/W06-lists-cancel.md) (списки и отмена участника).
W26 закрыт («готов», независимое ревью, три круга).

| Что | Сколько | Карточки |
|---|---|---|
| Флоу | 21 | [flows/](flows/) |
| Таблицы | 10 | [tables/](tables/) |
| Connections | 1 — `AI Qadam Events (dev)` | [connections.md](connections.md) |
| Variables | 4 — `QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`, `MINIAPP_URL` | [variables.md](variables.md) |

## Flows

| Группа | Флоу |
|---|---|
| Точка входа бота | [tg-router](flows/tg-router.md) |
| Регистрация участника | [reg-start](flows/reg-start.md), [reg-consent-pdn](flows/reg-consent-pdn.md), [reg-consent-mkt](flows/reg-consent-mkt.md), [reg-phone](flows/reg-phone.md) |
| Списки и отмена участника (W06) | [events-list](flows/events-list.md), [my-regs](flows/my-regs.md), [my-reg-cancel](flows/my-reg-cancel.md) |
| Визард ивента (создание/правка, ADR-0016) | [event-wizard-start](flows/event-wizard-start.md), [event-wizard-edit-start](flows/event-wizard-edit-start.md), [event-wizard-field](flows/event-wizard-field.md), [event-wizard-photo](flows/event-wizard-photo.md), [event-wizard-geo](flows/event-wizard-geo.md), [event-wizard-publish](flows/event-wizard-publish.md) |
| Mini App API | [checkin-api](flows/checkin-api.md), [my-qr-api](flows/my-qr-api.md) |
| Функции (один уровень вложенности, ADR-0015 п. 5) | [fn-hmac-init-data](flows/fn-hmac-init-data.md), [fn-sign-qr](flows/fn-sign-qr.md), [fn-verify-qr](flows/fn-verify-qr.md), [fn-parse-start](flows/fn-parse-start.md), [fn-find-registration](flows/fn-find-registration.md) |
| Не построено, будущий пакет | [i18n-sync](flows/i18n-sync.md) — [W25](../docs/BACKLOG.md#w25-возврат-i18n-на-платформенном-механизме) |

Как читать карточки, проверенные факты про MCP/subflow'ы — [flows/README.md](flows/README.md).

## Таблицы

Все 10 из [DATA-MODEL.md](../docs/DATA-MODEL.md), схема и `externalId` —
в [tables/](tables/), рецепт пересборки — [tables/README.md](tables/README.md).
`strings` создана по схеме, но пуста осознанно: наполняющий её `i18n-sync`
не построен (см. Flows выше); источник правды для строк —
`i18n/*.json` в репозитории.

В `events`/`registrations`/`event_staff` намеренно оставлена фикстура
`demo` — нужна ревьюеру и последующим прогонам, чтобы проверять STF-2
(права контролёра) без пересборки окружения. Подробности —
[checkin-api.md](flows/checkin-api.md).

## Переменные и Connections

[variables.md](variables.md), [connections.md](connections.md).

## Схема потоков данных

Целевая схема — [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои) и
[FLOWS.md](../docs/FLOWS.md).
