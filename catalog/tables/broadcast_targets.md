# Table: broadcast_targets

- **Назначение**: материализованный список получателей рассылки — снимок сегмента
  на момент старта; защита от двойной отправки при рестарте чанка.
- **externalId таблицы**: `PAH81WchbaOixGXSdFBK1` · **внутренний id**: `gKdINpCmtuptQqVeQELWL`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| broadcast_id | TEXT | `P9k6Pfcwfn67JQHQHQBle` | `wzouaA5aHwdTJ9UPdUaRl` | → `broadcasts.id` |
| telegram_id | TEXT | `vzeXDhJwTFpXrbt04g5HY` | `CiykPSoBWTBFY8hMklNJS` | получатель |
| state | STATIC_DROPDOWN | `Lb9mpTnwSeth8eDRp0zpU` | `dxitx8NgY3YNitWCaOjEb` | `pending` / `sent` / `blocked` / `failed` |
| sent_at | DATE | `6o1O3MFxgDgruNNadOd8Q` | `OikdhOkKKyoBFkCUCEHkJ` | UTC |
| error | TEXT | `EMpuLvjDfE9xqxnwNzkUK` | `qm6bTMSigribZ2RCbUjgs` | текст ошибки Telegram |

## Заметки

- Уникальность `(broadcast_id, telegram_id)` — соглашение флоу: снимок собирается
  один раз при старте, повторный сбор не делается.
- «Кому ещё не отправлено» = `state eq pending`, а не арифметика по `cursor`:
  курсор — оптимизация, состояние получателя — источник правды.
