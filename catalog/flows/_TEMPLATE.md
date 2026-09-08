# Flow: <Display Name>

- **Статус**: DRAFT | ENABLED | DISABLED
- **Триггер**: <cron `*/5 * * * *` / webhook / app event> — <детали>
- **Назначение**: <одно предложение>
- **Flow ID (MCP)**: <id из ap_list_flows — для справки>

## Шаги

> Снимай через `ap_flow_structure`. Для CODE-шагов — `ap_read_step_code`.

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | @aiqadam/... | <что триггерит> | — |
| step_1 | @aiqadam/... : <action> | <что делает> | `{{trigger['output'].field}}` |
| step_2 | ... | ... | `{{step_1['output'].id}}` |

## Зависимости

- **Таблицы**: <список или —>
- **Переменные**: <список или —>
- **Connections**: <тип/назначение или —>

## Заметки

- <edge cases, мьютексы, gotchas, почему так сделано>
