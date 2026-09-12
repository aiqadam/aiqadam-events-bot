# ADR

Записи архитектурных решений. Одно решение — один файл, нумерация сквозная.
Формат: контекст → решение → следствия. Решение не редактируется задним числом:
если передумали, пишется новый ADR со статусом `Supersedes NNNN`.

| # | Решение | Статус |
| --- | --- | --- |
| [0001](0001-qadam-flow-as-carrier-stack.md) | Qadam Flow как несущий стек, 0 кода | Принято |
| [0002](0002-roles-as-tables.md) | Роли таблицами, а не флагами | Принято |
| [0003](0003-idempotency-without-atomicity.md) | Идемпотентность без атомарных примитивов | Принято |
| [0004](0004-catalog-instead-of-flow-export.md) | Агентский каталог вместо экспорта флоу | Принято |
| [0005](0005-secrets-visible-in-run-logs.md) | Секреты и ПД видны в логах прогонов — цена ADR-0001 | Принято |
| [0006](0006-rest-read-only-for-review.md) | REST только на чтение, только ревьюеру | Принято |
| [0007](0007-qr-rendered-in-miniapp.md) | QR участника рендерится в Mini App, файлом не отправляется | Принято |
| [0008](0008-bot-token-as-variable-not-connection-template.md) | Токен бота для HMAC — из Variable, не из `{{connections[...]}}` | Принято |
| [0009](0009-hot-path-latency-budget-and-order.md) | Латентность горячего пути: бюджеты и порядок ускорения | Принято |
| [0010](0010-unsandboxed-code-step-for-crypto.md) | `node:crypto` в Code step разрешён узко, для трёх HMAC-цепочек | Принято |
| [0011](0011-idempotency-on-atomic-primitives.md) | Идемпотентность на атомарных примитивах (сужает 0003) | Принято |
| [0012](0012-end-to-end-flows-instead-of-subflow-functions.md) | End-to-end флоу вместо subflow-функций (сужает 0001, отменяет локальность крипты 0010) | Принято |
