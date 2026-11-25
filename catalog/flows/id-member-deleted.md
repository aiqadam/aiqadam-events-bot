# Flow: id-member-deleted

- **Статус**: ENABLED (published). Подключён в ID QA 2026-11-25 (`module_delete_url_events`), после ворот
  ADR-0059; сквозная проверка — [W145](../../docs/work/W145-id-switch-prep.md)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/DnYhfp9irbV993MtLbIsh/sync`; `authType: none`, авторизация — подпись ID.
  Тело — конверт ID `{type, module, ts, request_id, signature, body: {telegram_id}}`
  ([ID ADR-0017](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0017-deletion-fanout-mechanics.md),
  [ID ADR-0018](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0018-id-to-module-signature-direction-tag.md)).
  `logOutput: false`: в теле `telegram_id`; прогон поэтому не ретраится (AGENTS.md, гоча 21), повторяет ID
- **Назначение**: приёмник события ID «человек удалён» (`id.member-deleted.v1`): проверить подпись и
  удалить в боте всё о человеке через [`fn-delete-person`](fn-delete-person.md)
  ([ADR-0059](../../docs/adr/0059-id-switch-prep-deletion-and-delivery-state.md) §3)
- **Flow ID (MCP)**: `DnYhfp9irbV993MtLbIsh`

## Шаги

Код `step_1` — байт-в-байт эталон [`snippets/id-event-verify.md`](../snippets/id-event-verify.md).

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `catch_webhook` | конверт ID; `logOutput: false` |
| step_1 | CODE — verify (`node:crypto`) | подпись с тегом направления ключом `id_module_key`, тип, модуль, окно `ts`; флаг тела; ввод и вывод выключены |
| step_2 | ROUTER — signature | `verified` (`ok` true) / `Otherwise` |
| step_3 | `store put_if_absent` | *(verified)* `idrq:<request_id>`, TTL 360 с, `COLLECTION`; только после верной подписи |
| step_4 | CODE — gate | `stored` false → `replay`; тело плохое → `bad_body`; иначе `delete` |
| step_5 | ROUTER — route | `delete` / `replay` / `Otherwise` |
| step_6 | `callFlow` `fn-delete-person` | *(delete)* `inline`, ждёт ответ; `{telegramId, refuseIfAuthor: false}`; `logInput` off; `continueOnFailure` |
| step_8 | ROUTER — outcome | *(step_6 успех)* `done` (`done` и `deleted`) / `author` (`author_of_events`, `deleted`, не `done`) / `Otherwise` |
| step_9 | `return_response` | `200 {done: true}` |
| step_10 | `return_response` | `200 {done: false, reason: "author_of_events"}` — ID не засчитывает |
| step_11 | `return_response` | `500 {done: false, reason: "error"}` — ответ подфлоу не распознан |
| step_7 | `return_response` | *(step_6 упал)* `500 {done: false, reason: "error"}` |
| step_12 | `return_response` | *(replay)* `409 {done: false, reason: "replay"}` |
| step_13 | `return_response` | *(bad_body)* `400 {done: false, reason: "bad_body"}` |
| step_14 | `return_response` | *(подпись не прошла)* `401 {done: false, reason}`: `not_configured`, `bad_type`, `unknown_module`, `malformed`, `expired`, `skew`, `bad_signature` |

## Зависимости

- **Флоу**: `fn-delete-person` (`inline`)
- **Переменные**: `id_module_key` (не логируемый вход `step_1`)
- **Store**: `idrq:<request_id>` (TTL 360 с)
- **Таблицы**: напрямую — нет; всё через подфлоу

## Заметки

- **`done` в ответе — литерал, не шаблон.** ID засчитывает только `200` и `body.done === true`
  строго; каждый ответ — свой шаг, как в QA-заглушке ID.
- **Заявка на повтор — только после верной подписи.** Запрос без подписи не трогает Store и не сжигает
  `request_id`. Повтор ID после сбоя идёт с новым `request_id` (`fn-notify-module`), поэтому `409`
  его не задевает.
- **Приёмник никогда не вызывает ID** — петли нет (ID ADR-0032 §5).
- **Логи:** триггер и `step_1` — `**REDACTED**`; `step_6` — только `done`, `deleted`, `reason`,
  счётчики; в Store-ключе — `request_id`, не id человека.
- **Время.** На QA: человек со строками — 5,3 с от запроса до ответа, повтор — 1,5 с, автор — 2,9 с,
  отказы — 0,3–0,9 с. Предел ID — 15 с.
