# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

**Состояние на 2026-09-09:** 10 таблиц (W1), **12 флоу** — девять
subflow-«функций» `fn-*` (W2), `i18n-sync` (W3), `tg-router` (W4) и
`registration` (W5), один connection (шаг 0.2). Остальные флоу-маршрутизаторы
(`checkin-api`, `event-wizard`, …) ещё не собраны. Все двенадцать флоу описаны
файлами в [flows/](flows/).

## Flows

Как читать, два namespace'а id и проверенные факты про subflow'ы —
[flows/README.md](flows/README.md).

| Flow | Триггер | Назначение | Файл |
|------|---------|-----------|------|
| `fn-t` | `subflows / callableFlow` | перевод по ключу i18n из `strings` (I18N-2) | [fn-t.md](flows/fn-t.md) |
| `fn-parse-start` | `subflows / callableFlow` | разбор `start`-payload deep link'а (PAR-6) | [fn-parse-start.md](flows/fn-parse-start.md) |
| `fn-sign-qr` | `subflows / callableFlow` | подпись QR участника, `crypto` qadam (PAR-6) | [fn-sign-qr.md](flows/fn-sign-qr.md) |
| `fn-verify-qr` | `subflows / callableFlow` | constant-time проверка подписи QR | [fn-verify-qr.md](flows/fn-verify-qr.md) |
| `fn-verify-init-data` | `subflows / callableFlow` | валидация Telegram `initData` (STF-2) | [fn-verify-init-data.md](flows/fn-verify-init-data.md) |
| `fn-fmt-time` | `subflows / callableFlow` | UTC → `Asia/Tashkent` на языке пользователя (OWN-3) | [fn-fmt-time.md](flows/fn-fmt-time.md) |
| `fn-resolve-segment` | `subflows / callableFlow` | получатели рассылки по сегменту (OWN-9) | [fn-resolve-segment.md](flows/fn-resolve-segment.md) |
| `fn-event-card` | `subflows / callableFlow` | карточка ивента, venue и ссылка на карты (OWN-2) | [fn-event-card.md](flows/fn-event-card.md) |
| `fn-find-registration` | `subflows / callableFlow` | чтение `registrations` с выбором самой ранней (ADR-0003) | [fn-find-registration.md](flows/fn-find-registration.md) |
| `i18n-sync` | cron `0 4 * * *` (Asia/Tashkent) | заливает `i18n/*.json` из `main` в таблицу `strings` (W3) | [i18n-sync.md](flows/i18n-sync.md) |
| `tg-router` | `@aiqadam/qadam-telegram-bot / new_telegram_message` | единственный вход бота: дедуп `update_id` (IDM-4), апсерт `users`, классификация апдейта, делегирование в `registration` (W4, доработан W5) | [tg-router.md](flows/tg-router.md) |
| `registration` | `subflows / callableFlow` | регистрация участника: места/овербукинг, согласия PAR-1/PAR-2, QR (W5) | [registration.md](flows/registration.md) |

Строки `fn-*` ведёт пакет W2, строку `i18n-sync` — W3: так два владельца
не правят одни и те же строки.

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
| `strings` | рабочая копия i18n (I18N-2) | `qi6bBTL7plRGBgFUfli8w` | [strings.md](tables/strings.md) |

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
