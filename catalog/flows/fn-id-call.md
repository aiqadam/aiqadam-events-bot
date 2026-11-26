# Flow: fn-id-call

- **Статус**: DISABLED (published, выключен 2026-11-26 по блокеру ревью W146 до исправления)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается `inline` с ожиданием ответа.
  Вход: `{api, body}`
- **Назначение**: единственная дверь бота в AI Qadam ID
  ([ADR-0060](../../docs/adr/0060-id-switch-flows-to-id-api.md) §1). Подписывает тело модульным ключом
  (ID ADR-0012), отправляет на вебхук ID этого `api`, отдаёт ответ в одной форме. Ничего не повторяет:
  что делать с ответом, решает вызывающий (ADR-0060 §6).
- **Кто вызывает**: [`fn-id-refresh`](fn-id-refresh.md) (исключение из запрета цепочек —
  [ADR-0061](../../docs/adr/0061-fn-id-refresh-may-call-fn-id-call.md)); обработчики — после
  переключения (ADR-0060 §4, следующий пакет)
- **Flow ID (MCP)**: `91jUjK1KZAQajF4uVkNoc` · **externalId (для `callFlow`)**: `4RfJjWReJ5hqBWAZtpOOY`
- **Зависит от `node:crypto`** (ADR-0010, шестое место по ADR-0060): шаг `sign`.

## Вход

| Поле | Значение |
|---|---|
| `api` | `profile-get` \| `profile-upsert` \| `profile-batch` \| `consent-set` \| `account-delete` |
| `body` | объект — тело запроса ID API (ID `docs/SPEC.md`, API-1…5) |

Пример `flowProps`: `{payload: {api: "profile-get", body: {telegram_id: "<id>"}}}`.

## Шаги

Код `step_1` и `step_3` — байт-в-байт эталоны [`id-call-sign`](../snippets/id-call-sign.md) и
[`id-call-result`](../snippets/id-call-result.md). Ввод и вывод выключены на всех шагах, кроме
`trace` (ADR-0005): в них ключ, тело с данными человека, подпись, ответ ID.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | вход; `logOutput: false` |
| step_1 `sign` | CODE | адрес по `api` из переменной, только `https://app.flow.aiqadam.org/api/v1/webhooks/<id>/sync`; конверт `{module: "events", ts, request_id, signature, body}`; отказ → `url: ''` |
| step_2 `send` | `@aiqadam/qadam-http` `send_request` | `POST` `step_1.url`, тело JSON `step_1.envelope`; `timeout: 10` с, `followRedirects: false`, `failureMode: continue_all`, `continueOnFailure` |
| step_3 `result` | CODE | `{ok, status, body, reason}` из выхода `step_2`; сеть, таймаут, не JSON, отказ `sign` → `ok: false, status: 0` |
| step_4 `trace` | CODE | **в логе**: только `api` (из пяти, иначе `other`), `status`, `reason` |
| step_5 `respond` | `returnResponse` | `{ok, status, body, reason}`; `logInput: false` |

## Ответ

Вызывающий читает `step_N['output'].data.ok`, `.data.status`, `.data.body`, `.data.reason`.

| Случай | `ok` | `status` | `body` | `reason` |
|---|---|---|---|---|
| `2xx`, тело `ok: true` | `true` | код | тело ID | `ok` |
| `4xx`, `5xx` с JSON (`401`, `403 no_consent`, `409 base_required` и т. п.) | `false` | код | тело ID (`reason` ID внутри) | `http_<код>` |
| таймаут, сеть, тело не JSON, защита платформы от частных адресов | `false` | `0` | `{}` | `no_json` / `network` |
| неизвестный `api`, нет ключа или адреса, тело не объект | `false` | `0` | `{}` | `bad_api` / `not_configured` / `bad_body` |

Подфлоу не падает ни на одном из этих случаев. Ответ несёт данные человека: у шага `callFlow`
вызывающего выключены ввод и вывод.

## Зависимости

- **Переменные**: `id_module_key` (секрет), `id_url_profile_get`, `id_url_profile_upsert`,
  `id_url_profile_batch`, `id_url_consent_set`, `id_url_account_delete` ([variables](../variables.md))
- **Таблицы**: —
- **Store**: — (защита от повтора — на стороне ID, `rq:events:<request_id>`)
- **Connections**: —

## Заметки

- **Формы выхода `send_request`** (`@aiqadam/qadam-http` 0.13.0), сняты на QA пробой в W146:
  `2xx` → `{status, headers, body}`; `4xx`/`5xx` → `{response: {status, body}}`; таймаут →
  `{response: {status: 500}}` без тела; частный или зарезервированный адрес → `{response: {status:
  403, body: "<строка>"}}`; пустой адрес и сеть → шаг `FAILED` (сама qadam падает с `TypeError:
  error.errorMessage is not a function`), `continueOnFailure` держит прогон. Текст этой ошибки — в логе
  шага; данных человека в нём нет.
- **Хост закреплён в коде `sign`.** Переменная с чужим хостом, `http://`, асинхронным вебхуком
  без `/sync` или query-строкой даёт `not_configured`, и подписанное тело никуда не уходит. Смена хоста
  ID — правка эталона.
- **Повторов нет.** Повтор того же конверта ID отвергнет (`409 replay`); новый вызов — новый
  `request_id`.
- Задержка на QA: подфлоу около 0,15 с до отправки, ID 0,6–1,2 с, `account-delete` около 3,4 с
  (рассылка события модулям).
