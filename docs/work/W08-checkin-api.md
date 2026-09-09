# W8. `checkin-api`

- **Статус**: на проверке
- **Владелец**: агент W8
- **Волна**: 4
- **Зависит от**: W2, W5
- **Начат**: 2026-09-09 · **Закрыт**: —

## Цель

Флоу `checkin-api` ([FLOWS.md](../FLOWS.md#checkin-api--основной-путь-чекина-mini-app)):
webhook, вызываемый Mini App-сканером, проверяет `initData` контролёра,
членство в `event_staff` конкретного `event_id`, подпись QR участника,
и либо отмечает чекин, либо возвращает один из исходов STF-4.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-api` (новый) | `CUKqiby1PoHiQiiCQy24V`, 27 шагов, webhook sync | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| правка flow `fn-verify-init-data` | `step_2.text` → `{{variables['BOT_TOKEN']}}` | [catalog/flows/fn-verify-init-data.md](../../catalog/flows/fn-verify-init-data.md) |
| Variable `BOT_TOKEN` (новая) | дубликат токена бота для HMAC | [catalog/variables.md](../../catalog/variables.md) |
| ADR-0008 | `{{connections[...]}}` как данные не даёт байт-в-байт токен — токен для HMAC живёт в Variable | [docs/adr/0008-bot-token-as-variable-not-connection-template.md](../adr/0008-bot-token-as-variable-not-connection-template.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w8-checkin-api).

- [x] `initData` валидируется по HMAC токена бота, `telegram_id` берётся **только** оттуда (STF-2)
- [x] прогон на `initData` от живого клиента Telegram (переехал из W2, [Q16](../OPEN-QUESTIONS.md#q16)) — выполнено, нашло и исправило реальный баг (см. «Как проверено»)
- [x] проверяется членство в `event_staff` **именно этого** `event_id` — участник получает `403`, а не возможность отметить соседа
- [x] повторный скан не меняет `checked_in_at` и показывает исходное время (IDM-2)
- [x] чужой QR даёт `wrong_event`, отменённая/отсутствующая регистрация — `not_registered`
- [x] ответ укладывается в `TRIGGER_TIMEOUT_SECONDS = 60` (4–22 с в `TESTING`, с запасом)
- [x] `catalog/` совпадает с живым проектом (`checkin-api.md` новый, `overview.md` обновлён)

## Как проверено

> Сквозные прогоны на **опубликованной** версии (после `ap_lock_and_publish`),
> с настоящей криптографией — не моками. `initData` контролёра посчитан временным
> флоу с той же HMAC-цепочкой, что в `fn-verify-init-data`, на реальном токене бота;
> `payload` QR получен прогоном самого `fn-sign-qr` на реальном `QR_SIGNING_KEY`.
> Фикстуры (`event_staff`/`registrations`/`users`) вставлены на время проверки и
> удалены сразу после. Подробности и id прогонов — в
> [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md), раздел «Заметки».

- `401 invalid_init_data` (просроченный `initData`) → прогон `Hmh3thz8kPez8C2Rho16B`
- `200 ok` (чекин записан, имя в ответе) → прогон `Q3un8aA2ic7fKmLBkdXgb`
- `200 already` (повторный скан, время **не изменилось**) → прогон `HOkVgF0a7aWKVFwnskeXX`
- `200 wrong_event` (QR другого ивента) → прогон `GeuSptw1FS5UuxLmroxUl`
- `200 not_registered` (валидный QR, регистрации нет) → прогон `fcciunzxxxPXYNpFtU6za`
- `200 invalid` (подделанная подпись) → прогон `q2xkvWcllQfTZfO0BRgrm`
- `403 forbidden` — **обязательный тест приёмки**: валидный `initData`, но не
  контролёр этого `event_id` → прогон `tdnOZr9VUKcO4IVocZrJj`

**Прогон на живом `initData` (Q16).** Владелец бота открыл Mini App в Telegram
дважды и передал `initData`: первый раз через `copy()` в консоли, второй —
прямым `fetch()` из самого Mini App на временный webhook-приёмник
(`tmp-w8-initdata-capture`, удалён после проверки) — оба способа исключают
ручное искажение строки. Оба раза `fn-verify-init-data` вернула `hashValid: false`
(прогоны `nE6egWsTWPu4iMtAQnkcZ`, `gYTRMjPixJUWwJGiQkpnH`), в том числе на
**боевом** вызове самого `checkin-api` (`Xs2d24lqPNqaSb0ohaDjS` →
`tlUVYMNIT4M5x3lffPPtN`) — не тестовый артефакт.

Проверено и исключено: бот в connection — тот самый (`GET /getMe` → `username:
"aiqadam_events_dev_bot"`); алгоритм сверен построчно с
`core.telegram.org/bots/webapps` (все поля кроме `hash`, включая `signature`);
перебраны все комбинации полей/экранирования — ни одна не даёт нужный хэш.
Решающая проверка: владелец бота посчитал `HMAC("WebAppData", bot_token)`
**локально**, с реальным токеном из BotFather (`/mybots` → API Token, без
ротации) — значение не совпало с тем, что давал шаг через
`{{connections['TZTlXaCEO2hEvimUowbSA']}}`.

Правка: `fn-verify-init-data / step_2.text` → `{{variables['BOT_TOKEN']}}`
(новая Variable, токен продублирован туда через UI). Тот же самый `initData`,
на котором раньше было `hashValid: false`, дал `hashValid: true` тем же
прогоном (`zVsliGe9MlO6cfXpjcwbT`), без других изменений в цепочке. Подробности —
[ADR-0008](../adr/0008-bot-token-as-variable-not-connection-template.md).

## Журнал

- **2026-09-09** — пакет взят в работу.
- **2026-09-09** — изучены существующие subflow'ы (`fn-verify-init-data`,
  `fn-parse-start`, `fn-verify-qr`, `fn-find-registration`, `fn-fmt-time`) и
  таблицы (`event_staff`, `registrations`, `users`) — контракты полностью
  покрывают потребности `checkin-api`, писать новую логику проверки подписи или
  HMAC не потребовалось.
- **2026-09-09** — собран флоу через `ap_create_flow` + `ap_add_step` (не
  `ap_build_flow` одним вызовом — нужны вложенные ROUTER'ы с ветками, которые
  `ap_build_flow` не описывает декларативно). На каждом ROUTER'е (`step_4`,
  `step_7`, `step_14`) платформа сама заводила служебную нулевую ветку — удалена
  `ap_delete_branch` после добавления реальных условий, как документировано в
  `my-qr-api`/README.
- **2026-09-09** — для сквозной проверки понадобился реальный `initData`:
  собран временный subflow `tmp-w8-testdata` (та же HMAC-цепочка, что в
  `fn-verify-init-data`, но в обратную сторону — не проверяет, а **строит**
  `hash`). Первая попытка использовала `auth_date` на несколько дней вперёд
  от факта — платформа справедливо вернула `reason: "expired"` (тест `auth_date`
  оказался в будущем от `now` на инстансе); подобран `auth_date`, отстоящий от
  наблюдаемого `ageSeconds` на безопасный интервал, и ошибка ушла. Временный флоу
  и все фикстуры удалены сразу после последнего прогона.
- **2026-09-09** — публикация → шесть сквозных прогонов (все исходы STF-4) →
  `403`-тест приёмки STF-2 → фикстуры и временный флоу удалены → каталог обновлён.
- **2026-09-09** — владелец бота (человек) передал живой `initData` дважды
  (см. «Как проверено») — `fn-verify-init-data` вернула `hashValid: false` оба
  раза, включая боевой вызов `checkin-api`. Проверены и исключены: неверный бот
  в connection (`getMe` подтвердил), ошибка алгоритма (сверено с документацией
  Telegram построчно), варианты сборки `data_check_string` (перебор комбинаций
  полей). Решающий тест — HMAC от реального токена, посчитанный владельцем бота
  локально, не совпал со значением через `{{connections[...]}}`. Токен продублирован
  в Variable `BOT_TOKEN`, `fn-verify-init-data` переключён на неё — тот же
  `initData` прошёл (`hashValid: true`). Задокументировано
  [ADR-0008](../adr/0008-bot-token-as-variable-not-connection-template.md);
  исправление затрагивает все вызывающие `fn-verify-init-data`, не только W8.
- **2026-09-09** — все пункты чек-листа выполнены, пакет переведён `на проверке`.

## Ревью

> Заполняет независимый ревьюер.

## Хвосты и блокеры

- нет.
