# Flow: my-qr-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook / catch_webhook`, `authType: none`. Синхронный ответ —
  вызывается по `POST /api/v1/webhooks/I5nd8ggKH4wkQLaww9Dkl/sync` (суффикс `/sync`).
- **Назначение**: выдаёт участнику подписанный `payload` QR (PAR-6) для рендера
  в браузере — [ADR-0007](../../docs/adr/0007-qr-rendered-in-miniapp.md). Вызывается
  страницей `miniapp/ticket.html`, не другими флоу.
- **Flow ID (MCP)**: `I5nd8ggKH4wkQLaww9Dkl`

## Контракт

**Вход:** `{ initData: string, eventId: string }` — тело POST-запроса от Mini App.

**Выход:** всегда `HTTP 200`, тело:

| Ситуация | Тело ответа |
| --- | --- |
| Успех | `{ ok: true, payload: "c<eventId>-<userId>-<sig>" }` |
| `initData` невалиден/просрочен или `eventId` не проходит форму | `{ ok: false, error: "invalid_init_data", reason }` |
| Нет активной регистрации на этот `eventId` у этого `telegram_id` | `{ ok: false, error: "not_registered" }` |

`telegram_id` берётся **только** из проверенного `initData` (аналог STF-2) — тело
запроса не может задать чужой `telegram_id`, только `eventId`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | вход Mini App | — |
| step_1 | CODE «parse + validate input» | форма `eventId` (`[A-Za-z0-9_]{1,12}`, как у `fn-sign-qr`) | `{{trigger['output'].body}}` |
| step_2 | `@aiqadam/qadam-subflows : callFlow` → `fn-verify-init-data` | HMAC токена бота + свежесть | `{{step_1['output'].initData}}` |
| step_3 | CODE «combine validity» | `valid = eventIdValid && initDataValid` | `{{step_2['output'].data}}`, `{{step_1['output'].eventIdValid}}` |
| step_4 | ROUTER «валидны?» | `valid` (branchIndex 0) / `Otherwise` (branchIndex 1 → `invalid_init_data`) | `{{step_3['output'].valid}}` |
| step_5 | `callFlow` → `fn-find-registration` | регистрация участника на `eventId` | `eventId`, `telegramId` из step_1/step_3 |
| step_6 | CODE «decide outcome» | `ok` только если `registration.registered` | `{{step_5['output'].data}}` |
| step_7 | ROUTER «outcome?» | `ok` (branchIndex 0) / `Otherwise` (branchIndex 1 → `not_registered`) | `{{step_6['output'].outcome}}` |
| step_8 | `callFlow` → `fn-sign-qr` | подпись `payload` | `eventId`, `userId = telegramId` |
| step_9 | CODE «build success body» | `{ ok: true, payload }` | `{{step_8['output'].data}}` |
| step_10/12/14 | `@aiqadam/qadam-webhook : return_response` | JSON-ответ, `status: 200` всегда | `{{step_N['output']}}` соответствующего билдера |

## Зависимости

- **Subflow'ы**: `fn-verify-init-data`, `fn-find-registration`, `fn-sign-qr`
- **Таблицы**: — (только через subflow'ы) · **Переменные**: — · **Connections**: —
  (токен бота читается внутри `fn-verify-init-data`)

## Заметки

- **Всегда `HTTP 200`, ошибка — в теле.** Страница сама разбирает `ok`/`error`,
  а не HTTP-статус — проще для `fetch()` без обвязки на 4xx/5xx.
- **Не проверяет статус ивента** (`published`/`cancelled`/`finished`) — это
  сознательно: показ уже выданного QR не должен зависеть от того, что случилось
  с ивентом после регистрации. Актуальность на входе проверяет `checkin-api` (STF-2),
  а не эта выдача.
- **Роутеры собраны через `ap_add_step` + `ap_add_branch`.** У свежесозданного
  ROUTER'а платформа сама заводит служебную нулевую ветку («Branch 1») до первого
  `ap_add_branch` — её пришлось удалить `ap_delete_branch`, иначе она перехватывала
  branchIndex 0 у нужного условия. Проверено `ap_flow_structure` после каждого шага.
- **Проверено сквозным прогоном с настоящей криптографией**, не только `ap_test_flow`
  на моках: `initData` для тестового пользователя (`555000111`) посчитан через
  временный флоу с двумя `crypto : hmac-signature` (та же цепочка, что в
  `fn-verify-init-data`) на **реальном** `QR_SIGNING_KEY`/токене бота, вручную
  собранная строка `initData` подана в `my-qr-api` — прошла `hashValid: true`.
  Три ветки подтверждены прогонами: `ok` (реальная регистрация в фикстуре,
  `payload` совпал с `fn-sign-qr`), `not_registered` (тот же `initData`, другой
  `eventId`), `invalid_init_data` (`initData: "garbage"`). Временный флоу и все
  фикстуры (`registrations`) удалены после проверки.
- **Публичный HTTP-эндпоинт проверен напрямую `curl`**, не только через
  `ap_test_flow`: POST с `initData: "garbage"` вернул `{"ok":false,"error":
  "invalid_init_data","reason":"malformed"}`, `HTTP 200`. Отдельно проверен CORS
  preflight (`OPTIONS` с `Origin: https://miniapp.events.aiqadam.org`) — `204`,
  `access-control-allow-origin: *` — платформа отвечает сама (Q11).
