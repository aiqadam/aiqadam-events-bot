# Table: mig_test_users

- **Назначение**: выдуманные люди для репетиции переноса в AI Qadam ID (`id-migrate`, режимы `test` и
  `dry-test`, [ADR-0058](../../docs/adr/0058-id-migrate-users-to-id.md)). Повторяет поля `users`.
  Только id тестового диапазона `9000000000000000`+; настоящих людей здесь не бывает.
- **externalId таблицы**: `icZc8j3POKiAwys100RfC` · **внутренний id**: `dPiHO4jTUG2N4U31krOS2`

## Поля

| Field | Type | externalId | field id |
|-------|------|-----------|----------|
| telegram_id | TEXT | `dG3RUi82Vmus1NJJeesgv` | `Lh5jbak4CSM2O33UVgLPf` |
| first_name | TEXT | `AHnNaAgDImGz2R9tx4hqe` | `vr8SIuzdjiVC4s6wHhIYS` |
| last_name | TEXT | `nT1XWhvWvnKlml7Sx61Hs` | `EzWnv7mrDOSq5LnZvEvLo` |
| username | TEXT | `MxlDenytnYHXeQTibMD2v` | `dTsx7Gc9KbsQZ9Y9G3Lx5` |
| phone | TEXT | `19zOOMDYasqzxUXlv7005` | `p8m3EeATlDS5sjszy9ESt` |
| lang | TEXT | `0BXQWOMZy2v4MlzZ4LYSr` | `rG0xtqkHO1bz4b3DKKznz` |
| consent_pdn | STATIC_DROPDOWN | `jvB4ZszWoAxihFZiWclvb` | `SqXQdRRutfxMElJhZu7em` |
| consent_pdn_at | DATE | `Q0qBLYNo0shkxBLvnIbcL` | `7Sy2zwF6YcI51tQP66cD5` |
| profile_first_name | TEXT | `Uh8st3mk875Zng6qw0v2r` | `KTXuMK4C6kIVnTqiMetpV` |
| profile_last_name | TEXT | `J37rKNtt2TWi8RBQSXD97` | `5hD7nr0RSSkDdwwRfH5O4` |
| position | TEXT | `yuhIspJkhzdbfwVfNUJUm` | `hu9set0l9yVKiuHvSgdXJ` |
| company | TEXT | `hOPzP10GSWis8qbrkDfWq` | `HMTr4ItWOHFi2GMiad1Jw` |
| city | TEXT | `bgJyu1l8CRZQvrYRHGBGe` | `2hc7cuwnIU1paSeUEhcLK` |
| profile_completed_at | DATE | `eVDJoDPuJlBuwldb5uf3f` | `RlZO4ZB5R6jJDoS9LXrdb` |
| consent_marketing | STATIC_DROPDOWN | `5QsdAFcp1UnlDbF8xmTJ6` | `M2KqX2cfbAp7gjpl6gYYi` |
| consent_marketing_at | DATE | `IUMRkwVKEzRojn3dKm4aF` | `N5yyzVVl7We8CHk7TbO6g` |
| blocked_bot | STATIC_DROPDOWN | `2oAovuC9oOb8UxfyEawtH` | `A9HTecd7b74CPxYUu1jxV` |
| created_at | DATE | `hM2A7CI9K1YRRj1uY8scK` | `xLmHuMrrg1qAv1b33R9XU` |

## Заметки

- 13 строк: 12 разных id (один совпадающий дубль), 11 с `consent_pdn = true`, 2 с рассылкой. Удаляется
  после приёмки переноса.
