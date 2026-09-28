# Flow: feedback-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` (sync, `authType: none`) —
  `POST /api/v1/webhooks/2Ixa3uGUnKgYO4Lrg317n/sync`
- **Назначение**: сервер формы отзыва роут `#/feedback` SPA
  (`miniapp/src/routes/Feedback.tsx`), [ADR-0028](../../docs/adr/0028-feedback-screen-fifth-miniapp-page.md),
  [Q53](../../docs/OPEN-QUESTIONS.md#q53): проверяет `initData` и факт
  участия (регистрация с чекином) **на конкретный `eventId`**, принимает
  оценку 1–5 и необязательный комментарий, отдаёт уже сохранённый отзыв при
  повторном открытии. Основной риск — IDOR: чужой `eventId`, на котором
  вызывающий не был, отвечает тем же отказом, что и полное отсутствие
  регистрации.
- **Flow ID (MCP)**: `2Ixa3uGUnKgYO4Lrg317n`

## Вход

`POST` тела: `{ initData, eventId, action, rating, comment }`.

| Поле | Что |
|---|---|
| `initData` | `Telegram.WebApp.initData` страницы |
| `eventId` | событие, о котором отзыв (из query-параметра `#/feedback?event_id=`) |
| `action` | `load` — отдать уже сохранённый отзыв (если есть); `submit` — записать/перезаписать |
| `rating` | только при `submit`: целое 1–5 |
| `comment` | только при `submit`: строка, необязательна, обрезается до 2000 символов |

## Шаги

ROUTER сразу после проверки `initData` (`step_2`) — тот же приём, что в
`my-qr-api`: невалидный `initData` отвечает `401` без обращения к таблицам.
Второй ROUTER (`step_7`) разводит `submit`/`load`/отказ одного CODE-шага
решения.

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | приём POST |
| step_1 | `callFlow fn-hmac-init-data` | HMAC `initData`, окно **300 c** (страница читает `initData` один раз при открытии) |
| step_2 | ROUTER: `invalid` / `valid` | `{{step_1['output'].data.valid}}` |
| step_3 (invalid) | CODE «invalid init data response» | `checkin.unauthorized`, `httpStatus: 401` |
| step_4 (invalid) | `return_response` (`stop`) | ответ `401` |
| step_14 (invalid, фолбэк ROUTER'а) | `return_response` (`stop`) | тот же `401` — структурный фолбэк, недостижим по логике (см. «Заметки») |
| step_5 (valid) | `callFlow fn-find-registration` | регистрация вызывающего на `eventId` |
| step_6 (valid) | CODE «decide: attended? valid rating?» | гейт участия (found && checkedIn) + валидация `rating` при `submit`; `outcome` = `forbidden` / `validation` / `submit` / `load` |
| step_7 (valid) | ROUTER: `forbidden_or_validation` / `submit` / `load` | по `{{step_6['output'].outcome}}` |
| step_8 (forbidden_or_validation) | `return_response` (`stop`) | `403` / `422` из `step_6` |
| step_9 (submit) | `tables-upsert-records feedback` | ключ — `event_id`+`telegram_id` (Q53): повтор перезаписывает, не дублирует |
| step_10 (submit) | `return_response` (`stop`) | `200 {ok:true, text}` |
| step_11 (load) | `tables-find-records feedback` | своя строка по `event_id`+`telegram_id`, `limit: 1` |
| step_12 (load) | CODE «shape load response» | `given`/`rating`/`comment` из найденной строки или пустые |
| step_13 (load) | `return_response` (`stop`) | `200 {ok:true, given, rating, comment}` |
| step_15 (submit/load ROUTER, фолбэк) | `return_response` (`stop`) | `500` — структурный фолбэк, недостижим по логике |

### Контракт ответа (согласован с `#/feedback` SPA)

| Ситуация | HTTP | Тело |
|---|---|---|
| `initData` невалиден/просрочен | 401 | `{ok:false, error:"invalid_init_data", text}` |
| не был на событии (нет регистрации или нет чекина на этот `eventId`) | 403 | `{ok:false, error:"forbidden", text}` |
| `submit` с `rating` вне 1–5 | 422 | `{ok:false, error:"validation", text, fields:{rating:"feedback.err.rating"}}` |
| `submit` успех | 200 | `{ok:true, text}` |
| `load` успех | 200 | `{ok:true, given, rating, comment}` — `given:false` и пустые поля, если отзыва ещё нет |

## Зависимости

- **Таблицы**: `feedback` (`GgGUQEHp6g076nDb2XddP`, чтение/upsert),
  `registrations` (чтение через `fn-find-registration`)
- **Флоу**: `fn-hmac-init-data`, `fn-find-registration`
- **Переменные**: `BOT_TOKEN` (ADR-0008)
- **Connections**: —

## Заметки

- **Участие проверяется через `fn-find-registration`, не отдельным
  запросом**: `found && checkedIn` — тот же критерий присутствия, что у
  `reg-afterword` (непустой `checked_in_at`), и тот же эталон, с которым не
  может разойтись счётчик `manage-api`/`participants`. Чужой `eventId` (на
  который вызывающий не регистрировался или не пришёл) даёт `found:false`
  или `checkedIn:false` — тот же `403`, что и полное отсутствие участия;
  разбирать причины отдельно незачем ([SECURITY](../../docs/SECURITY.md)).
- **`tables-upsert-records` с ключом по паре `event_id`+`telegram_id`** —
  решение [Q53](../../docs/OPEN-QUESTIONS.md#q53): второй `submit` от того же
  человека на тот же событие обновляет ту же запись (`action: "updated"`,
  тот же `record id`), а не создаёт вторую. Проверено различающим прогоном:
  первый `submit` → `created`; второй `submit` с другой оценкой/комментарием
  → `updated`, тот же `record id`, значения перезаписаны.
- **`callFlow`'s `flowProps` — обёртка `{"payload": {...}}`** в обоих вызовах
  ветки `valid` (CLAUDE.md, Gotchas Qadam Flow, п. 7a).
- **Оба ROUTER'а имеют структурный фолбэк-ответ** (`step_14`, `step_15`):
  платформа требует непустую последнюю ветку router'а даже когда остальные
  ветки логически исчерпывающие (`{{valid}} == 'true'` / `!= 'true'` не
  оставляет третьего исхода для строкового сравнения; то же для
  `forbidden_or_validation` / `submit` / `load`). Эти ветки недостижимы в
  нормальной работе — их наличие не сигнал незавершённой логики, а требование
  платформы к структуре ROUTER'а (см. CLAUDE.md, Gotchas Qadam Flow, о
  фолбэк-ветке `ap_add_branch`).
- **Окно `initData` — 300 c**, как у `my-qr-api`: страница читает `initData`
  один раз при открытии, короткого окна достаточно.
- **Комментарий не экранируется под Markdown/HTML** — он не отправляется в
  Telegram (уведомления организатору нет, Q53), а читается только через
  `#/manage` как обычный текст (React экранирует JSX-интерполяцию сама).
