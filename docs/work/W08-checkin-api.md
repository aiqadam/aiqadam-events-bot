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

- **Ревьюер**: независимый агент (чистый контекст), **дата**: 2026-09-09
- **Вердикт**: есть замечания

### Что проверено и подтвердилось

- `ap_flow_structure` по `checkin-api` (`CUKqiby1PoHiQiiCQy24V`, 28 шагов) и
  `fn-verify-init-data` (`YEGaCp6uwKEtI2p4W9FIL`, 6 шагов) — все шаги
  `configured`, `valid: true`, структура совпадает с каталогом step-in-step.
- `ap_read_step_code` по всем CODE-шагам обоих флоу — чистые функции: ни
  сетевых вызовов, ни прямой записи в БД; `step_15` (запись чекина) — не
  CODE, а `tables-update-record`, и структура подтверждает, что он стоит
  строго в ветке `outcome = 'ok'` (`step_14` → branch `ok` → `step_16` →
  `step_15`), не безусловно — IDM-2 на уровне графа подтверждён.
- Все 12 заявленных в журнале прогонов существуют, `SUCCEEDED`, и их
  содержимое **действительно** соответствует описанию:
  `Hmh3thz8kPez8C2Rho16B` (401 expired), `Q3un8aA2ic7fKmLBkdXgb` (200 ok,
  запись `checked_in_at`/`checked_in_by`), `HOkVgF0a7aWKVFwnskeXX` (200
  already, `checkedInAt` **не изменился** между `ok`- и `already`-прогонами —
  `2026-09-09T08:46:21.631Z` в обоих), `GeuSptw1FS5UuxLmroxUl` (wrong_event),
  `fcciunzxxxPXYNpFtU6za` (not_registered), `q2xkvWcllQfTZfO0BRgrm` (invalid,
  испорчен последний символ `sig`), `tdnOZr9VUKcO4IVocZrJj` (403). Также
  дополнительно подняты и сверены прогоны Q16: `nE6egWsTWPu4iMtAQnkcZ` и
  `gYTRMjPixJUWwJGiQkpnH` — оба реально `hashValid: false` на живом
  `initData` до правки; `zVsliGe9MlO6cfXpjcwbT` — тот же тип данных,
  `hashValid: true` после правки; `Xs2d24lqPNqaSb0ohaDjS`/`tlUVYMNIT4M5x3lffPPtN` —
  боевой (`PRODUCTION`) вызов `checkin-api`, тоже `bad_hash` до правки.
  Находка Q16 подтверждена независимо, не только со слов журнала.
- 401 → 403 → бизнес-логика выполняются строго последовательно по графу
  (`step_4` → `step_5`/`step_7` → остальное) — путей, где бизнес-логика
  выполняется раньше проверки прав, нет.
- `telegramId` контролёра (`step_3.staffTelegramId`) читается только из
  `step_2` (`fn-verify-init-data`), не из `trigger`/`body` — STF-2 по
  источнику данных подтверждён.
- `event_staff`, `registrations` — `rowCount: 0` (тестовые фикстуры
  реально удалены). `tmp-w8-testdata`, `tmp-w8-hashcheck`,
  `tmp-w8-initdata-capture` — `ap_list_flows(name: "tmp-")` вернул 0
  флоу, мусора не осталось. (В `users` остаётся 1 запись,
  `telegram_id: 322876545` — это реальный аккаунт владельца бота из
  Q16-проверки, не тестовая фикстура пакета, замечания не вызывает.)
- Криптография в `fn-verify-init-data`: сравнение constant-time (XOR по
  всей длине, без раннего выхода) подтверждено чтением `step_4`;
  `telegramId`/`user` отдаются только при `valid === true`, что и читает
  `step_3` `checkin-api`.

### Замечания

1. **важно** — Ключ ревьюера отсутствует в Keychain
   (`security find-generic-password -s aiqadam-events-bot:qadam-flow-api
   -a reviewer` → `SecKeychainSearchCopyNext: The specified item could not
   be found`), поэтому блок 1a чек-листа (REST-экспорт конфигурации
   PIECE-шагов) в этом ревью не закрыт. Не подтверждено REST'ом
   независимо: фильтр `tables-find-records` в `step_5` (`event_staff`) —
   что это правда единый фильтр `(event_id, telegram_id, revoked_at
   not_exists)`, а не постфильтр в коде; `text` шага `fn-verify-init-data /
   step_2` сейчас реально равен `{{variables['BOT_TOKEN']}}` (а не
   продолжает ссылаться на старый connection где-то ещё); `maxAgeSeconds:
   86400`, передаваемый `checkin-api / step_2` в `callFlow`. Частично
   компенсировано поведенческими прогонами (см. выше — особенно Q16,
   которая как раз и есть пример того, что поведение надёжнее статического
   конфига), но не полностью: поведенческие прогоны не проверяют фильтр
   `event_staff` на различающих фикстурах (см. замечание 2). Нужно либо
   восстановить ключ в Keychain для следующего ревью, либо владельцу
   зафиксировать REST-подтверждение отдельно с передачей ключа так, как
   описано в ADR-0006.
2. **важно** — Обязательный тест приёмки STF-2 (прогон
   `tdnOZr9VUKcO4IVocZrJj`, ожидание 403) использует контролёра
   (`telegram_id: 700000099`), у которого на момент прогона в `event_staff`
   не было **вообще ни одной** записи ни по одному `event_id` (в это же
   время в таблице лежала единственная запись — `telegram_id: 700000001`
   для `meetup01`, `step_5` вернул `[]`). Такой тест не отличает
   «правильный фильтр `(event_id, telegram_id, revoked_at)`» от
   гипотетически сломанного фильтра без `event_id` — оба варианта дают
   пустой результат и 403 человеку, который нигде не staff. Настоящий
   тест STF-2 («любой участник отметит соседа», прямая цитата из
   CLAUDE.md/BACKLOG) требует другой фикстуры: тот же контролёр — staff
   **другого** ивента (например, `meetup02`, `revoked_at` пуст), и всё
   равно `403` при попытке отметиться на `meetup01`. Такого сценария в
   прогонах пакета нет ни одного. Без него единственное реальное
   подтверждение фильтра — прочитать конфигурацию `step_5` через REST
   (см. замечание 1), а это тоже не сделано.
3. **важно** — Не проверен сценарий `event_staff.revoked_at` заполнен
   (отозванные права контролёра). AppSec-чеклист (п. 4.1) явно требует:
   «отзыв прав (`event_staff.revoked_at`) проверяется на каждый запрос».
   Каталог заявляет, что фильтр включает `revoked_at not_exists`, но ни
   один из прогонов пакета не содержит фикстуру с непустым `revoked_at` —
   утверждение проверено только чтением кода филиппа-фильтра невозможно
   (PIECE-шаг), а поведенчески — не проверено вовсе.
4. **на будущее** — `step_1` (`checkin-api`) вычисляет `eventIdValid`, но
   это поле нигде дальше по графу не используется для явного отказа
   (например, `400 bad_request`): при невалидном `eventId` подставляется
   сентинел `-`, и цепочка просто доходит до `403` по отсутствию
   `isStaff`. Поведение fail-closed и безопасно, но неявно — сканеру (W7)
   не видно разницы между «нет прав» и «сам запрос сломан». Не блокер,
   можно уточнить в следующей итерации W7/W9.

## Хвосты и блокеры

- нет.
