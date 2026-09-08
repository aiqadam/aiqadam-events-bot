# Connections

Проектные connections (auth к qadam'ам). Заводятся в UI, привязываются к шагам
по `externalId` (`ap_list_connections` → поле `auth`). Секреты — только в UI.

AI-провайдеры платформенные (общие на всю платформу), connections — проектные.

| Connection | Qadam | Тип auth | Назначение |
|------------|-------|----------|-----------|
| `events-bot` | `@aiqadam/qadam-telegram-bot` | Bot Token | **отдельный бот-аккаунт** только под ивенты (Q4) |

Один вебхук на бот-токен: описание триггера `new_telegram_message` говорит прямо —
«One trigger per bot token». Поэтому токен существующего `aiqadam-telegram-bot`
сюда не подходит.

На 2026-09-08 в проекте connections нет — бот ещё не заведён у BotFather.
