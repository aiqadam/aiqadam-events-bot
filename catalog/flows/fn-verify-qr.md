# Flow: fn-verify-qr

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: проверка подписи QR — constant-time сравнение с `fn-sign-qr`.
- **Flow ID (MCP)**: `Zl4ShjrJBl8NNyKJ8ASLa` · **externalId (для `callFlow`)**: `UCfTLGgAjh8y9oSxEGQsc`

## Контракт

**Вход:** `{ eventId, userId, sig }` — уже разобранные части payload'а
(разбор — `fn-parse-start`, так же, как в [FLOWS.md](../../docs/FLOWS.md#checkin-api--основной-путь-чекина-mini-app),
шаг 3 `checkin-api`: сначала `fn-parse-start`, потом `fn-verify-qr`).

**Выход:** `{ valid, error, eventId, userId }`, `error`: `''` \| `bad_input` \|
`no_expected_sig` \| `bad_signature`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize input» | валидация формы, подстановка заглушек | `{{trigger['output'].data.*}}` |
| step_2 | CODE «expected sig = HMAC(QR_SIGNING_KEY, msg) inline (node:crypto, ADR-0010, было callFlow → fn-sign-qr)» | подпись мусорной/реальной пары `(eventId, userId)` инлайн, без вызова subflow'а | `signEventId`/`signUserId` = `{{step_1['output'].signEventId}}`/`...signUserId`, `qrSigningKey` = `{{variables['QR_SIGNING_KEY']}}`; возвращает `{ sig }` |
| step_3 | CODE «constant-time compare» | XOR-аккумулятор без раннего выхода | `signed` = `{{step_2['output']}}`, ожидаемая подпись в `signed.sig` |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_3['output']}}` |

**С 2026-09-09 (W16, [ADR-0010](../../docs/adr/0010-unsandboxed-code-step-for-crypto.md),
мотив — латентность, не секьюрити):** старый `step_2` (`callFlow → fn-sign-qr`)
заменён на инлайн той же логики подписи через `node:crypto` — убран целый
вложенный flow-run на каждый скан QR. Логика подписи (`msg = "c:" + eventId +
":" + userId`, HMAC-SHA256, base64url, срез до 10) **дублирует** `fn-sign-qr`,
а не переиспользует его — в модели «0 кода» без общих JS-модулей это ожидаемая
цена (ADR-0010), не новый костыль. **Работает только при
`AP_EXECUTION_MODE=UNSANDBOXED`** на инстансе (обратимая настройка).
**`fn-sign-qr` больше не зависимость этого флоу** — вызов убран, subflow
продолжает обслуживать выдачу QR (`registration`, `my-qr-api`).

## Зависимости

- **Subflow'ы**: — (до 2026-09-09 был `fn-sign-qr`, `uQ1m96xr6s66C7KopPnBE`; убран W16)
- **Таблицы**: — · **Переменные**: `QR_SIGNING_KEY` (с 2026-09-09, W16 — раньше
  косвенно через `fn-sign-qr`, теперь напрямую) · **Connections**: —

## Заметки

- **W16, 2026-09-09**: `callFlow → fn-sign-qr` заменён инлайном той же подписи
  (`node:crypto`, ADR-0010). Параллельность с `fn-sign-qr` проверена на тех же
  входах: валидный `eventId=meetup01, userId=123456789, sig=NBqSKT4StU` дал
  `valid: true` (прогон `iOP95ACfI3EIcYOWh6SSs`); подмена последнего символа
  подписи дала `bad_signature` (прогон `Aa3eAimqvri6RLusJ2hjr`); мусорный вход
  (`eventId=''`, `userId='not-a-number'`, `sig='!!!'`) прошёл **один** путь
  исполнения (заглушка `x`/`0`, шаг подписи не пропущен, не ветвится) и дал
  `bad_input`, при этом инлайн-подпись стаба (`Roafqu7eao`, прогон
  `xQTunY5qsdfxUTZpFtPmG`) байт-в-байт совпала с тем, что `fn-sign-qr` дал на
  тех же `eventId=x, userId=0` независимым прогоном (`MV7L4myiJhYsZLTuxthZG`,
  см. `fn-sign-qr.md`) — дублированная логика не разошлась. Латентность:
  тёплый прогон полного успешного пути `checkin-api` (одно сканирование) дал
  сумму шагов ≈4,9 с при полной длительности 22,8 с (прогон `cCXetqX6VPVmPpe3s1p5G`) —
  «пауза» ≈17,9 с против ≈19,9 с в эталоне до правки (`EFIxi7F09xHzQEmQRKsl0`,
  [Q22](../../docs/OPEN-QUESTIONS.md#q22)); эффект в ожидаемую сторону (снят
  целый вложенный flow-run), но на одном прогоне не заявляется как точная
  экономия — разброс метода тот же, что и раньше. Подробности —
  [W16](../../docs/work/W16-hmac-inline-code-step.md).
- **Сравнение constant-time**: `diff = len(a) ^ len(b)`, затем XOR по всем позициям
  без `return` внутри цикла. Раннего выхода нет — по времени ответа нельзя
  восстановить префикс подписи.
- **Мусорный вход не ветвится и не падает.** При невалидной форме `step_1` подставляет
  заглушку (`eventId = 'x'`, `userId = '0'`), инлайн-подпись считает HMAC от неё,
  а `step_3` возвращает `bad_input`. Путь исполнения один для всех входов: нет ветки,
  в которой проверку можно случайно пропустить. Цена — один лишний HMAC на мусор.
- **Подпись сама себя не авторизует.** `valid: true` означает «payload не подделан»,
  и ничего больше: членство контролёра в `event_staff` этого `event_id` и наличие
  регистрации проверяет `checkin-api` (STF-2).
- Проверено отрицательными сценариями: подмена последнего символа подписи, подпись
  другого пользователя при том же `eventId`, `sig` с пробелами и кавычками.
