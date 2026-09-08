# Проект

Идентичность проекта в Qadam Flow. Без секретов — только публичные ID и URL.

- **Название**: AI Qadam Events Bot
- **Назначение**: ивенты, регистрация участников, QR-чекин и сегментные рассылки в Telegram
- **Qadam Flow UI**: <https://app.flow.aiqadam.org>
- **MCP endpoint**: <https://app.flow.aiqadam.org/mcp> (OAuth 2.1, проект выбирается на экране согласия)
- **Владелец / команда**: AI Qadam
- **Репозиторий**: <https://github.com/aiqadam/aiqadam-events-bot>

## Окружения

| Env | project_id | Заметки |
|-----|-----------|---------|
| dev | `vZXlkfz60dx6kX97yICx7` | текущий проект инстанса; на 2026-09-08 пуст |
| prod | не заведён | создаётся в UI, см. [Q12](../docs/OPEN-QUESTIONS.md#q12) |

Проект в MCP выбирается на экране OAuth-согласия, поэтому второе окружение —
это второй сервер в `.mcp.json` с тем же URL и другим выбором проекта.
