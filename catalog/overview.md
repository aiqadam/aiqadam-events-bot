# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

**Состояние на 2026-09-13 (после W24):** 10 таблиц (W1), **5 флоу проекта**, из
них `i18n-sync` — **DISABLED**; один connection (шаг 0.2).

> «Пять флоу» — это флоу **проекта**, а не всё, что лежит в `events-dev`.
> `ap_list_flows` на 2026-09-13 отдаёт шесть: шестой,
> `bench-421-loop-code-final`, — чужой замер к
> [qadam-flow#421](https://github.com/aiqadam/qadam-flow/issues/421), заведён
> не этим репозиторием и в каталоге намеренно не описан
> ([Q34](../docs/OPEN-QUESTIONS.md#q34)). Разница найдена ревью W18.

**Локализации в проекте больше нет** — только русский
([ADR-0014](../docs/adr/0014-russian-only-until-platform-i18n.md), возврат
привязан к [qadam-flow#420](https://github.com/aiqadam/qadam-flow/issues/420),
milestone v2.0.0). Из горячего пути ушли 16 чтений `strings` и два чтения языка
пользователя; тексты лежат во входе шага, который формирует сообщение
(эталон [`ru-texts`](snippets/ru-texts.md)). Таблица `strings` и файлы
`i18n/*.json` **не тронуты** — они нужны для импорта при возврате.

Девять subflow-«функций» `fn-*` **удалены в W22**: после [W21](../docs/work/W21-end-to-end-flows.md)
их не вызывал никто, а [ADR-0012](../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)
запретил их как практику. Канон переиспользуемой логики теперь живёт **только**
в [snippets/](snippets/) — включая `resolve-segment`, который не был встроен
никуда и был бы потерян вместе с флоу.

Остальные флоу (`event-wizard`, `checkin-deeplink`, `staff-invite`/`staff-accept`,
рассылки) ещё не собраны. Статические страницы Mini App собраны в W7: сканер
`miniapp/index.html` (`showScanQrPopup`, STF-1, бьёт в `checkin-api`) и выдача QR
`miniapp/ticket.html` (W5, [ADR-0007](../docs/adr/0007-qr-rendered-in-miniapp.md));
обе тянут собственные надписи с того же GitHub Pages из `i18n/<lang>.json` (Q19).

## Flows

Как читать, два namespace'а id и проверенные факты про subflow'ы —
[flows/README.md](flows/README.md).

| Flow | Триггер | Назначение | Файл |
|------|---------|-----------|------|
| `tg-router` | `@aiqadam/qadam-telegram-bot / new_telegram_message` | единственный вход бота: дедуп `update_id` (IDM-4), апсерт `users` **только при изменениях** (W22), классификация апдейта, делегирование в `registration` | [tg-router.md](flows/tg-router.md) |
| `registration` | `subflows / callableFlow` | регистрация участника: места/овербукинг, согласия PAR-1/PAR-2, QR | [registration.md](flows/registration.md) |
| `checkin-api` | `@aiqadam/qadam-webhook / catch_webhook` (sync) | чекин: `initData` контролёра, членство в `event_staff` этого `event_id` (STF-2), подпись QR, запись `checked_in_at` (IDM-2) | [checkin-api.md](flows/checkin-api.md) |
| `my-qr-api` | `@aiqadam/qadam-webhook / catch_webhook` (sync) | подписанный `payload` QR для `miniapp/ticket.html` (ADR-0007) | [my-qr-api.md](flows/my-qr-api.md) |
| `i18n-sync` | cron `0 4 * * *` (Asia/Tashkent) — **DISABLED с 2026-09-13** | заливал `i18n/*.json` из `main` в таблицу `strings`; выключен по ADR-0014, включается при возврате i18n | [i18n-sync.md](flows/i18n-sync.md) |

**Вызовов между флоу ровно один**: `tg-router` → `registration` (`callFlow`,
`executionMode: inline`). Больше `callFlow` в проекте нет.

## Таблицы

Заведены в W1. Идентификаторы, dropdown-значения и рецепт пересборки —
[tables/README.md](tables/README.md).

| Таблица | Назначение | externalId | Файл |
|---------|-----------|-----------|------|
| `users` | люди, язык, согласия (DAT-1, PAR-1, PAR-2) | `z5PX9B8mTQC9Q6Dfuj5dM` | [users.md](tables/users.md) |
| `events` | ивенты, время, место, статус (OWN-2…OWN-4) | `kVLg1FSfDBtsP32FGPk3P` | [events.md](tables/events.md) |
| `chapters` | чаптеры, заведена под будущее (Q8) | `yRaGKY6Rhmn6m3SKUBmOV` | [chapters.md](tables/chapters.md) |
| `registrations` | регистрации и чекины (IDM-1, IDM-2) | `PNuChoFG0tIBTND86yzDL` | [registrations.md](tables/registrations.md) |
| `event_staff` | права контролёра на конкретный ивент (STF-2) | `CyW6KjJ2BdwQEph2KEqTt` | [event_staff.md](tables/event_staff.md) |
| `staff_invites` | одноразовые инвайты staff на 24ч (OWN-14) | `TrHzP09CQTbpU14FPBZLQ` | [staff_invites.md](tables/staff_invites.md) |
| `broadcasts` | рассылки, прогресс, курсор (OWN-10…OWN-13) | `RtlPCu8KxBRPHCX62ifhc` | [broadcasts.md](tables/broadcasts.md) |
| `broadcast_targets` | снимок получателей рассылки | `lg5rQmGCnNrbAJSAQOUfX` | [broadcast_targets.md](tables/broadcast_targets.md) |
| `sessions` | состояние визардов, `draft` — JSON строкой | `tL4fbi1GisDwA8UJ9zSod` | [sessions.md](tables/sessions.md) |
| `strings` | рабочая копия i18n — **никем не читается с 2026-09-13** (ADR-0014), сохранена для импорта при возврате | `qi6bBTL7plRGBgFUfli8w` | [strings.md](tables/strings.md) |

Данные в таблицах: `strings` наполняется флоу `i18n-sync` (W3) и содержит
**по одной строке на каждую пару `(key, lang)` из `i18n/*.json`** — на
2026-09-08 это 203 `ru` + 202 `uz` + 202 `en`. Точное число здесь сознательно
не фиксируется: оно меняется с каждым добавленным ключом, а сверять его нужно
не с каталогом, а с файлами репозитория — так делает и сам `i18n-sync`.
Остальные девять таблиц пусты: фикстуры W1 и W2 удалены после проверок.
Актуальные `rowCount` смотрите через `ap_list_tables`.

## Переменные

См. [variables.md](variables.md).

## Connections

См. [connections.md](connections.md).

## Схема потоков данных

Целевая схема описана в [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои)
и [FLOWS.md](../docs/FLOWS.md). Заполняется здесь по мере сборки.
