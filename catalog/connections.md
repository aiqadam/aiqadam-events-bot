# Connections

Проектные connections (auth к qadam'ам). Заводятся в UI, привязываются к шагам
по `externalId` (`ap_list_connections` → поле `auth`). Секреты — только в UI.

AI-провайдеры платформенные (общие на всю платформу), connections — проектные.

| Connection | Qadam | Тип auth | Назначение |
|------------|-------|----------|-----------|
| `AI Qadam Events (dev)` | `@aiqadam/qadam-telegram-bot` | Bot Token | **отдельный бот-аккаунт** только под ивенты (Q4); `externalId` `TZTlXaCEO2hEvimUowbSA` |

Один вебхук на бот-токен: описание триггера `new_telegram_message` говорит прямо —
«One trigger per bot token». Поэтому токен существующего `aiqadam-telegram-bot`
сюда не подходит.

Заведён 2026-09-08. Фактическое имя connection в UI — `AI Qadam Events (dev)`,
а не `events-bot`, как планировалось: привязка к шагам идёт по `externalId`,
поэтому имя ни на что не влияет, но здесь оно записано так, как в инстансе.
