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
| step_2 | `@aiqadam/qadam-subflows : callFlow` | вызов `fn-sign-qr`, `waitForResponse = true` | `payload` = `{eventId: {{step_1['output'].signEventId}}, userId: ...signUserId}` |
| step_3 | CODE «constant-time compare» | XOR-аккумулятор без раннего выхода | `signed` = `{{step_2['output']}}`, ожидаемая подпись в `signed.data.sig` |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_3['output']}}` |

## Зависимости

- **Subflow'ы**: `fn-sign-qr` (`uQ1m96xr6s66C7KopPnBE`)
- **Таблицы**: — · **Переменные**: — (косвенно `QR_SIGNING_KEY` через `fn-sign-qr`) · **Connections**: —

## Заметки

- **Сравнение constant-time**: `diff = len(a) ^ len(b)`, затем XOR по всем позициям
  без `return` внутри цикла. Раннего выхода нет — по времени ответа нельзя
  восстановить префикс подписи.
- **Мусорный вход не ветвится и не падает.** При невалидной форме `step_1` подставляет
  заглушку (`eventId = 'x'`, `userId = '0'`), `fn-sign-qr` считает подпись от неё,
  а `step_3` возвращает `bad_input`. Путь исполнения один для всех входов: нет ветки,
  в которой проверку можно случайно пропустить. Цена — один лишний HMAC на мусор.
- **Подпись сама себя не авторизует.** `valid: true` означает «payload не подделан»,
  и ничего больше: членство контролёра в `event_staff` этого `event_id` и наличие
  регистрации проверяет `checkin-api` (STF-2).
- Проверено отрицательными сценариями: подмена последнего символа подписи, подпись
  другого пользователя при том же `eventId`, `sig` с пробелами и кавычками.
