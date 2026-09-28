# Flow: report-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/R8GgSVXgHsmLSKdEdzygp/sync`
- **Назначение**: сервер формы сообщения о проблеме, роут `#/report` SPA
  (`miniapp/src/routes/Report.tsx`), [ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md),
  [Q62](../../docs/OPEN-QUESTIONS.md#q62): проверяет `initData`, валидирует вид
  и текст, пишет строку в `reports` и отвечает `200`. Staff-гейта и проверки
  участия нет — пожаловаться может любой, у кого валидный `initData`;
  `telegram_id` берётся только из проверенного `initData`.
- **Flow ID (MCP)**: `R8GgSVXgHsmLSKdEdzygp`

## Вход

`POST` тела: `{ initData, kind, text, route, eventId, appVersion, context }`.

| Поле | Что |
|---|---|
| `initData` | `Telegram.WebApp.initData` страницы |
| `kind` | вид проблемы: `broken` \| `text` \| `message` \| `other` |
| `text` | сообщение, обязательное, ≤2000 символов |
| `route` | откуда открыли форму: `profile` \| `menu` \| `report` (обрезается до 200) |
| `eventId` | событие в контексте; пусто, если не открыто; иначе — только форма slug `A-Za-z0-9_` |
| `appVersion` | версия клиента Telegram (обрезается до 64) |
| `context` | JSON-строка: `lang`, `platform`, `version` (обрезается до 2000) |

## Шаги

ROUTER сразу после проверки `initData` (`step_2`) — тот же приём, что в
`feedback-api`/`my-qr-api`: невалидный `initData` отвечает `401` без обращения
к таблицам. Второй ROUTER (`step_6`) разводит отказ валидации и успех.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём POST |
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData`, окно **300 c** (страница читает `initData` один раз при открытии) |
| step_2 | ROUTER: `invalid` / `valid` | `{{step_1['output'].data.valid}}` |
| step_3 (invalid) | CODE «invalid init data response» | `report.error.init`, `httpStatus: 401` |
| step_4 (invalid) | `return_response` (`stop`) | ответ `401` |
| step_11 (invalid, фолбэк ROUTER'а) | `return_response` (`stop`) | тот же `401` — структурный фолбэк, недостижим по логике (см. «Заметки») |
| step_5 (valid) | CODE «validate report» | `telegram_id` из HMAC, вид/текст, нормализация контекста; `outcome` = `invalid` / `validation` / `ok` |
| step_6 (valid) | ROUTER: `reject` / `ok` | по `{{step_5['output'].outcome}}` |
| step_7 (reject) | `return_response` (`stop`) | `401` / `422` из `step_5` |
| step_8 (ok) | `tables-create-records reports` | строка сообщения (`status: new`) |
| step_9 (ok) | `return_response` (`stop`) | `200 {ok:true, text}` |
| step_10 (valid ROUTER, фолбэк) | `return_response` (`stop`) | `500 report.error.server` — структурный фолбэк, недостижим по логике |

### Контракт ответа (согласован с `#/report` SPA)

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен | 401 | `{ok:false, error:"invalid_init_data", text}` |
| `kind` вне набора | 422 | `{ok:false, error:"validation", text, fields:{kind:"report.error.kind"}}` |
| `text` пуст / длиннее 2000 | 422 | `{ok:false, error:"validation", text, fields:{text:"…"}}` |
| успех | 200 | `{ok:true, text}` |

## Зависимости

- **Таблицы**: `reports` (`LKEqlq1X7RuWz5WC4zkov`, запись)
- **Флоу**: `fn-hmac-init-data`
- **Переменные**: `BOT_TOKEN` (ADR-0008)
- **Connections**: —

## Заметки

- **Staff-гейта и проверки участия нет намеренно** ([ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md) п. 3):
  сообщение о проблеме — о продукте, а не отзыв о событии; доступ к событию
  не проверяется. `event_id` идёт только контекстом и на права не влияет.
- **`telegram_id` — из `{{step_1['output'].data.telegramId}}`**, то есть из
  проверенного `initData`, а не из тела запроса ([SECURITY](../../docs/SECURITY.md));
  CODE-шаг дополнительно проверяет форму (`^\d{1,20}$`), иначе `401`.
- **`event_id` нормализуется по форме slug** (`A-Za-z0-9_`, ≤64): чужой мусор
  в контекстную колонку не попадает; невалидный — пишется пустым, отказ не
  выдаётся (это не гейт).
- **`source` ставит флоу** (`miniapp`), не клиент: канал доверенный.
- **Нет уникального ключа и нет upsert** — `tables-create-records`, а не
  `upsert`: каждый повтор создаёт новую строку, и это правильно (несколько
  жалоб от одного человека легальны, [ADR-0003](../../docs/adr/0003-idempotency-without-atomicity.md)).
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** (AGENTS.md, Gotchas
  Qadam Flow, п. 7a).
- **Оба ROUTER'а имеют структурный фолбэк-ответ** (`step_10`, `step_11`):
  платформа требует непустую последнюю ветку router'а даже когда остальные
  ветки логически исчерпывающие. Эти ветки недостижимы — их наличие не сигнал
  незавершённой логики, а требование платформы к структуре ROUTER'а.
- **Тексты — через `{{$t[...]}}`** ([ADR-0045](../../docs/adr/0045-i18n-on-platform-dollar-t.md)):
  ключи `report.error.*` и `report.ok` живут в платформенных переводах,
  источник — `i18n/*.json`.
- **Ключ `report.error.server` переиспользуется клиентом** для той же ситуации
  «сервер ответил не-JSON» — одна формулировка в двух слоях.
