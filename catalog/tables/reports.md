# Table: reports

- **Назначение**: сообщения о клиентских проблемах из Mini App `#/report`
  ([ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md), [Q62](../../docs/OPEN-QUESTIONS.md#q62),
  W123). Без staff-гейта: пожаловаться может любой с валидным `initData`.
- **externalId таблицы**: `LKEqlq1X7RuWz5WC4zkov` · **внутренний id**: `XIJdKUVMYUwdbdTqqrZqZ`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `wiYzzqiHQP9vfWgDgQ9ki` | `FivBuVkkfbxAGYnqTS9Oy` | автор, из проверенного `initData` (DAT-1) |
| source | TEXT | `BlWlLNDJBPyPWzV4ZHDpE` | `0sITyKaWBFdeski7VGmIw` | канал: `miniapp` (ставит флоу, не клиент) |
| kind | STATIC_DROPDOWN | `l9s5a9h6Z7pFnksSRfZ0t` | `KkhDAjbMEBdYaxD1sEDHY` | `broken` / `text` / `message` / `other` |
| text | TEXT | `2pkq2z4UxPaBOpkFrNcxZ` | `HYO8qnouoNgcSy458xELa` | сообщение, ≤2000 символов |
| route | TEXT | `s786ml5lOzEbw02nC0pHk` | `l6WQSYi5s4Cn984UrAp4K` | откуда открыли форму: `profile` / `menu` / `report` |
| event_id | TEXT | `O7synV9WJ1iBxu7FSiCia` | `ueJOjFT94yF3VzQDBOdZD` | событие в контексте; пусто, если не открыто |
| app_version | TEXT | `yiqF3pdUMkj3hqwCGUip9` | `QdbGUMU3fSjZMI7vOmW4z` | версия клиента Telegram (`tb.version`) |
| context | TEXT | `UEqoFiL14RSnsOHW711lF` | `aMSo8OdT1L6iLtGg0pnfn` | JSON-строкой: `lang`, `platform`, `version` |
| status | STATIC_DROPDOWN | `S1uNdyJE9CeC0qsHMiM6Y` | `AZpSHnRiWP9diDejD6Vpv` | `new` / `in_progress` / `resolved`; при записи — `new` |
| created_at | DATE | `suhwdR7GjaLmSdzUIogjm` | `AlKXASi7NN07kBgjkQvFj` | UTC, ставит флоу |

## Заметки

- **Уникальный ключ не объявлен** ([ADR-0047](../../docs/adr/0047-unique-keys-and-types-after-audit.md) п. 1):
  несколько сообщений от одного человека легальны, объявлять ключ по паре
  `telegram_id`+что-то нельзя — это запретило бы вторую жалобу.
- **Пишет только `report-api`** — после проверки `initData` и валидации;
  страница решений о правах не принимает, `event_id` — контекст, не гейт.
- **Читает инбокс владелец вручную** (Q62): автоуведомлений организатору
  события и `reports-digest` нет; `status` правится в таблице вручную.
- **`context` — JSON-строкой в `TEXT`**, как `sessions.draft`: тип `JSON`
  в проекте не мигрировался ([ADR-0044](../../docs/adr/0044-platform-novelties-sep-2026.md)).
