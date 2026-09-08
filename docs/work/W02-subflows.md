# W2. Subflow-«функции»

- **Статус**: на проверке
- **Владелец**: агент W2 (Claude Code, сессия barustamov)
- **Волна**: 2
- **Зависит от**: W1, шаги 0.1–0.3
- **Начат**: 2026-09-08 · **Закрыт**: —

## Цель

Собрать девять переиспользуемых subflow-«функций» (`fn-*`) в проекте `events-dev`
([ARCHITECTURE](../ARCHITECTURE.md#subflowы-вместо-библиотеки)).

## Что построено

Девять флоу, все published + ENABLED. Контракты, шаги и заметки — в каталоге;
там же оба идентификатора (flowId для MCP, externalId для `callFlow`).

| Артефакт | flowId | externalId | Каталог |
|----------|--------|-----------|---------|
| flow `fn-t` | `f8ZRXjQ2Ndk88lMlMOv1i` | `kMAFskaHsm5S1jSfH0Kya` | [fn-t.md](../../catalog/flows/fn-t.md) |
| flow `fn-parse-start` | `KmUrHSoKEPDo02J8mKAn6` | `9H027DdckYSgu7Yp1LQRS` | [fn-parse-start.md](../../catalog/flows/fn-parse-start.md) |
| flow `fn-sign-qr` | `VBkXevctQRgh3em0v2ndA` | `uQ1m96xr6s66C7KopPnBE` | [fn-sign-qr.md](../../catalog/flows/fn-sign-qr.md) |
| flow `fn-verify-qr` | `Zl4ShjrJBl8NNyKJ8ASLa` | `UCfTLGgAjh8y9oSxEGQsc` | [fn-verify-qr.md](../../catalog/flows/fn-verify-qr.md) |
| flow `fn-verify-init-data` | `YEGaCp6uwKEtI2p4W9FIL` | `cJAZDvJxj1mM0s1sWzOIi` | [fn-verify-init-data.md](../../catalog/flows/fn-verify-init-data.md) |
| flow `fn-fmt-time` | `5Hctxr9SnbhxGxow0Xgxu` | `4SXvBYqphN7BxwtS1CvBt` | [fn-fmt-time.md](../../catalog/flows/fn-fmt-time.md) |
| flow `fn-resolve-segment` | `eJ41KArb4vGQYhWSMzUgh` | `jFSgzFx50CT2Vqi7Kgu2a` | [fn-resolve-segment.md](../../catalog/flows/fn-resolve-segment.md) |
| flow `fn-event-card` | `L1l2LOngDtxPHFSdRp5fE` | `PR1wt0HDy0wih7gAT1OaD` | [fn-event-card.md](../../catalog/flows/fn-event-card.md) |
| flow `fn-find-registration` | `OkjryrJdcdZQNAWYamZgr` | `tpvo5a6wLoUAR7SAgl5bw` | [fn-find-registration.md](../../catalog/flows/fn-find-registration.md) |

Таблиц и переменных не создавалось. Схема W1 не менялась. Фикстуры (7 строк
`registrations`, 2 `events`, 3 `users`, 12 `strings`) вставлены для проверок и удалены —
на момент сдачи все таблицы, кроме `strings`, пусты; `strings` наполнена пакетом W3.

## Чек-лист готовности

- [x] `fn-parse-start` корректно разбирает `c…`-payload, где **`sig` содержит дефис**
      (последние 10 символов — подпись, не `split('-')`)
- [x] отбивается payload длиннее 64 символов и с символами вне `A-Za-z0-9_-`
- [x] `fn-sign-qr` использует `crypto` qadam (`sha256`, `outputEncoding = base64`),
      а Code step только переводит base64 → base64url и режет до 10 символов
- [x] `fn-verify-init-data` собран цепочкой из двух `hmac-signature`,
      где ключ второго — hex-вывод первого
- [x] `fn-find-registration` при нескольких строках на `(event_id, telegram_id)`
      возвращает самую раннюю (ADR-0003)
- [x] `fn-verify-qr` и `fn-verify-init-data` сравнивают **constant-time**
- [x] `fn-verify-init-data` проверён на реальном `initData` и отвергает подделанный `hash`
      (оговорка про «реальный» — ниже, в «Как проверено»)
- [x] `fn-fmt-time` отдаёт ташкентское время для UTC-входа (OWN-3)
- [x] `catalog/` совпадает с живым проектом
- [ ] пройдено независимое ревью, вердикт «замечаний нет»

## Как проверено

Все прогоны — `ap_test_flow` на инстансе; отрицательные сценарии прогонялись
как отдельные запуски, а не читались глазами по коду.

### `fn-parse-start`

- `cmeetup01-555000111-x6-XmQ2T8R` — **реальная** подпись из `fn-sign-qr`, в которой
  есть дефис → `eventId=meetup01`, `userId=555000111`, `sig=x6-XmQ2T8R`.
  Наивный `split('-')` дал бы `sig="x6"` — ловушка воспроизведена, а не постулирована.
- `cmeetup01-123456789-Ab-cd_efGhXXXX…` (65 символов) → `too_long`.
- `emeetup01-tg ads!` → `bad_charset`.
- `emeetup01-tg_ads_2026` → `kind=e`, `utm=tg_ads_2026`.
- `smeetup01-Ab3kZ9qLm2Xy7Pw1Rt5Nc0` → `kind=s`, токен 22 символа.
- `cmeetup01-abc-Ab-cd_efGh` → `bad_user_id`; `cmeetup01-123456789-Abcd_efGh`
  (подпись 9 символов) → `bad_qr_payload`; `""` → `empty`.

### `fn-sign-qr`

- `meetup01` + `123456789` → base64 `NBqSKT4StU…CHf0=` → `sig=NBqSKT4StU`,
  `payload=cmeetup01-123456789-NBqSKT4StU`.
- `555000111` → base64 `x6+XmQ2T8R…` → base64url `x6-XmQ2T8R…`: видно, что
  конвертация `+`→`-` реально срабатывает, а не «должна».
- Пустой `eventId` → прогон **падает** на первом шаге с `fn-sign-qr: bad eventId`.
  Так и задумано: подпись от `c::` опаснее падения.
- **Ключ не пустой.** HMAC-SHA256 с пустым ключом от `c:meetup01:123456789` даёт
  `hXO+doL7M4yot0XfX6zoJrukAfHxavZuiZ8csDvmspw=` (посчитано вне платформы),
  инстанс вернул `NBqSKT4StUDQQa8yVXWZqarAYGLe3OEynv6mcR6CHf0=`. Расходятся →
  `{{variables['QR_SIGNING_KEY']}}` подставился. Без этой сверки «успешный прогон»
  ничего не доказывает: опечатка в имени переменной тоже даёт успешный прогон.

### `fn-verify-qr`

- Валидная подпись с дефисом → `valid: true`.
- Последний символ подписи изменён (`…T8Q`) → `bad_signature`.
- Подпись пользователя `555000111` предъявлена за `123456789` → `bad_signature`
  (подпись привязана к паре, а не только к ивенту).
- `sig = "'; DROP TABLE"` → `bad_input`, прогон не падает; лишний HMAC от заглушки
  посчитан — цена одного пути исполнения.

### `fn-verify-init-data`

Оговорка честности: `initData` **от живого клиента Telegram у агента нет**.
Проверено иначе, и это сильнее, чем «прогнал один пример»:

1. **Алгоритм сверен с внешней реализацией.** Для `data_check_string`
   `auth_date=1789047720\nquery_id=AAF\nuser={"id":555000111,"first_name":"Test"}`
   шаг 3 вернул `632d6a78…59e9`; независимый расчёт HMAC-SHA256 с ключом из шага 1
   дал ровно то же значение. Значит цепочка — телеграмовская, включая трактовку
   hex-ключа второго HMAC как двоичного.
2. **Подпись делает сам бот-токен.** Шаг 2 вернул значение, отличное от
   HMAC(`WebAppData`, `""`) = `e2a4475b…dee1`, то есть `{{connections['…']}}`
   раскрылся в непустой токен.
3. **Положительный сценарий.** `initData` с корректным `hash` (посчитан ключом,
   который выдал шаг 2 — тем же токеном бота) и свежим `auth_date` → `valid: true`,
   `telegramId: 555000111`, `ageSeconds: 40`.
4. **Подделанный `hash`** (`0000…`) → `valid: false`, `reason: bad_hash`,
   `telegramId: ''`.
5. **Подмена `user`** на `{"id":999,"first_name":"Evil"}` при валидном чужом `hash`
   → `bad_hash`, `telegramId: ''`. Именно этот сценарий и есть STF-2.
6. **Порядок полей не важен**: тот же `initData` с полями в другом порядке →
   `valid: true` (сортировка по ключу работает).
7. **Просроченный, но правильно подписанный** `initData` (`auth_date` на 27 ч раньше)
   → `hashValid: true`, `fresh: false`, `reason: expired`. Это тот код, по которому
   Mini App просит переоткрыться.
8. **Мусор** `not a query string at all` → `reason: malformed`, прогон не падает.

### `fn-fmt-time`

- `2026-09-10T14:00:00Z`, `ru` → `10 сентября 2026 г. в 19:00` (UTC+5 — верно).
- `2026-09-10T13:42:00Z`, `ru`, `format=time` → `18:42` — ровно та строка,
  что стоит примером в ТЗ («уже отмечен в 18:42»).
- `2026-09-10T14:00:00` (**без зоны**), `uz` → `10-sentabr, 2026, 19:00`:
  дополнение `Z` работает, узбекская локаль на месте.
- `2026-09-10T13:42:00+05:00`, `lang=de` → `13:42`, `lang` вернулся `ru` (фолбэк).
- `not-a-date` → `valid: false`, `error: bad_date`.

### `fn-find-registration`

Фикстура: три строки на `(meetup01, 555000111)` — `registered` (рег. 01.09, чекин 13:42),
`cancelled` (03.09), `registered` (05.09, чекин 13:55) — плюс строка другого
пользователя и строка другого ивента.

- → `duplicates: 3`, `recordId` = строка от 01.09, `registration.source = first_link`,
  `checkedInAt = 13:42` (**самый ранний**, не последний — IDM-2), чужие строки
  не попали.
- Пустой `eventId` → выборка пуста (`inputOk: false`), а не «все регистрации юзера».
- Существующая пара без регистрации → `found: false`, `inputOk: true`.

### `fn-resolve-segment`

Фикстура: `meetup01` (заканчивается 10.09, в будущем), `past01` (закончился 01.09);
пользователи Bek (consent, не заблокирован), Anna (consent, `blocked_bot = true`),
NoConsent (`consent_marketing` не задан).

- `all_consent` → `["555000111"]`, `blockedExcluded: 1`, `noConsentExcluded: 1`.
  «Не задано» отсеклось наравне с `false`.
- `registered` + `meetup01` → `["555000111"]` из трёх его строк (дедуп) и без Anna
  (заблокирована), `blockedExcluded: 1`.
- `no_show` + `meetup01` (ивент ещё не кончился) → `allowed: false`,
  `reason: too_early`, `opensAt: 2026-09-10T16:00:00.000Z` (OWN-9).
- `no_show` + `past01` (закончился) → `["777000222"]`; пришедший `555000111` исключён.
- `segment: everyone` → `bad_segment`.

### `fn-event-card`

- `meetup01`, `uz` → карточка целиком на узбекском из **реальных** строк W3:
  `Qachon: 10-sentabr, 2026, 18:00`, `Tugashi: 21:00`, `Qayerda: …`,
  `Roʻyxatdan oʻtish: … gacha`, `Xaritada ochish: <url>`; `venue` с `lat`/`lon`,
  `registerDeepLink = https://t.me/aiqadam_events_dev_bot?start=emeetup01`
  (значит `BOT_USERNAME` подставился).
- Три разных `{when}` в трёх ключах различаются — за это отвечает `varsByKey`.
- Несуществующий `eventId` → `found: false`, без `venue` и кнопок, прогон не падает.
- `missing` = `event.card.btn_map` / `btn_register` / `not_found` — этих ключей в
  `strings` пока нет, поэтому кнопок нет **вместо** литералов на кнопках.

## Журнал

- **2026-09-08** — пакет взят, ветка `w02-subflows`.
- **2026-09-08** — **главный сюрприз дня: вход subflow'а лежит не там, где кажется.**
  `ap_test_flow` с плоскими `triggerTestData` проходил, а первый реальный вызов через
  `callFlow` упал: `callFlow` передаёт `{ data: <payload>, callbackUrl: … }`, то есть
  ссылка `{{trigger['output'].eventId}}` даёт `undefined`. Пришлось переписать
  ссылки во всех уже собранных флоу на `{{trigger['output'].data.*}}` и перепубликовать.
  Ответ `callFlow` тоже завёрнут: `{ status, data: <тело respond> }` — из-за этого
  `fn-verify-qr` сначала вернул `no_expected_sig` при валидной подписи.
  Оба факта записаны в [flows/README.md](../../catalog/flows/README.md), чтобы
  следующие пакеты не платили за них второй раз.
- **2026-09-08** — вложенный subflow исполняется в **PRODUCTION**, даже когда
  вызывающий гоняется в TESTING: ошибка внутри callee не видна в отчёте теста,
  только по ссылке на его собственный run.
- **2026-09-08** — callee обязан быть published + ENABLED, иначе его нет в dropdown'е
  `flow`. Отсюда порядок сборки: сначала листья (`fn-t`, `fn-fmt-time`, `fn-sign-qr`),
  потом вызывающие.
- **2026-09-08** — вместо ROUTER'а везде выбран **один путь исполнения**: невалидный
  вход нормализуется в Code step, а отказ выдаёт последний Code step. Причина не
  в лени: ветка — это место, где проверку можно случайно обойти, и на канвасе это
  не видно. Цена — лишний HMAC на мусорном входе в `fn-verify-qr`.
- **2026-09-08** — пустой фильтр в `tables-find-records` пришлось закрывать
  сентинелами. `event_id eq ""` вернул бы чужие строки; фильтр `in` по пустому списку
  вообще валит шаг (`requires at least one value`), а строка из пробела обрезается —
  поэтому `!no-key`.
- **2026-09-08** — **столкновение с параллельным пакетом W3.** Для проверки `fn-t`
  и `fn-event-card` были вставлены собственные строки `event.card.*`; прогон показал
  чужие значения — W3 к этому моменту залил в `strings` реальный набор ключей
  (573 строки). Свои фикстуры удалены (это территория W3), а `fn-event-card`
  переписан под **фактические** ключи W3 (`header`, `description`, `when`, `ends`,
  `where`, `deadline`, `map_link`). Побочный вывод: дубли `(key, lang)` `fn-t`
  переживает — берёт первую непустую строку.
- **2026-09-08** — из-за того, что W3 использует `{when}` сразу в трёх ключах
  с разным смыслом, в контракт `fn-t` добавлено поле `varsByKey` (подстановки
  для конкретного ключа, перекрывают общие `vars`). Расширение аддитивное: вызовы
  с одним `vars` не сломались.
- **2026-09-08** — `ap_validate_flow` считает `{{variables['NAME']}}` битой ссылкой.
  Ложное срабатывание (прогон подставляет значение), но полезный урок наоборот:
  валидатор **не** поймает опечатку в имени переменной, потому что опечатка даёт
  пустую строку. Единственная надёжная проверка — сверка результата с контрольным
  значением, посчитанным вне платформы.
- **2026-09-08** — `ap_delete_records` работает в пределах одной таблицы за вызов:
  список из 12 id по трём таблицам удалил только 7 строк, остальное потребовало
  отдельных вызовов. Если чистить фикстуры «одним списком» — часть останется.
- **2026-09-08** — `ap_test_step` на шаге в середине цепочки не всегда переигрывает
  предшественников: предыдущие шаги вернули `{}`, и шаг посчитал мусор.
  Для сквозных проверок использовался только `ap_test_flow`.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

1. **W3 не хватает трёх ключей i18n**, которые уже запрашивает `fn-event-card`:
   `event.card.btn_map`, `event.card.btn_register`, `event.card.not_found`.
   Пока их нет — кнопок в карточке нет, а «ивент не найден» показывается сырым ключом.
   Флоу править не нужно: ключи появятся в `strings` — кнопки появятся сами.
   Свои значения для них W2 **не** заводил сознательно: `i18n/*.json` — территория W3,
   а строка, вписанная мимо репозитория, живёт до следующего `i18n-sync`.
2. **`fn-resolve-segment` читает `users` целиком, без лимита.** Иначе нельзя достоверно
   вычесть `blocked_bot`. На фикстурах шаг занимал ~0.4 с; **на больших таблицах
   не проверено**. Перемерить до W14 вместе с [Q13](../OPEN-QUESTIONS.md#q13).
3. **`fn-event-card` — 12–13 с на прогон** при ~2 с суммы шагов: остальное —
   накладные расходы четырёх вложенных `callFlow`. В синхронный вебхук
   (`TRIGGER_TIMEOUT_SECONDS = 60`) такую цепочку без замера закладывать нельзя.
   Для `checkin-api` карточка не нужна, но W5/W11 это касается напрямую.
4. Sample data у триггеров `fn-find-registration`, `fn-resolve-segment` и
   `fn-event-card` ссылается на удалённые фикстуры (`meetup01`, `555000111`).
   На исполнение это не влияет — это только пример схемы в редакторе.
