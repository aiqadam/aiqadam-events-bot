# Flow: fn-id-refresh

- **Статус**: DISABLED (published, выключен 2026-11-26 по блокеру ревью W146 до исправления)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow`. Вход: `{telegramId, firstName, lastName,
  username}` — поля Telegram из апдейта
- **Назначение**: дневное обновление имени и `username` в AI Qadam ID
  ([ADR-0060](../../docs/adr/0060-id-switch-flows-to-id-api.md) §5). `profile-upsert` с
  `update_only: true`; отсутствующие `last_name`, `username` очищаются (ID ADR-0034 §4).
- **Кто вызывает**: `tg-router` фоном (`waitForResponse: false`) после `put_if_absent` ключа
  `idr:<telegram_id>` — после переключения (следующий пакет). Сейчас не вызывает никто.
- **Зовёт**: [`fn-id-call`](fn-id-call.md) — исключение из запрета цепочек,
  [ADR-0061](../../docs/adr/0061-fn-id-refresh-may-call-fn-id-call.md)
- **Flow ID (MCP)**: `uzlehhnJBmtUCcyQ7k4ML` · **externalId (для `callFlow`)**: `6Zjwm4Et4U0PH5oSoMt8e`

## Шаги

Код `step_1` — байт-в-байт эталон [`id-refresh-body`](../snippets/id-refresh-body.md).

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | вход; `logOutput: false` |
| step_1 `body` | CODE | тело `profile-upsert`: `update_only: true`, `first_name`, присутствующие `last_name`/`username`, остальные в `clear`; плохой id или нет имени → шаг падает, в ID ничего не уходит; ввод и вывод выключены |
| step_2 `call ID` | `callFlow` `fn-id-call` (`inline`, ждёт ответ) | `{api: "profile-upsert", body}`; ввод и вывод выключены |
| step_3 `outcome` | CODE | **в логе**: `ok`, `status`, `reason`, `written` |
| step_4 `respond` | `returnResponse` | то же |

## Ответ

`{ok, status, reason, written}`. Вызывающий его не ждёт; ответ нужен для проверки и лога.

| Случай | Ответ |
|---|---|
| профиль есть, согласия в силе | `ok: true, status: 200, written: true` |
| профиля нет в ID | `ok: true, status: 200, written: false` (ID ADR-0032 §3) |
| сбой ID | `ok: false`, `status` и `reason` из `fn-id-call` |

## Зависимости

- **Подфлоу**: `fn-id-call`
- **Переменные**, **таблицы**, **Store**, **Connections**: — (ключ `idr:` ставит `tg-router`,
  удаляет `fn-delete-person` — следующий пакет)

## Заметки

- Повтор при сбое не нужен: ключ `idr:` живёт до полуночи UTC, назавтра будет новая попытка (ADR-0060 §5).
