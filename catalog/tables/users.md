# Table: users

- **Назначение**: люди, которых бот видел, их язык и согласия (DAT-1, PAR-1, PAR-2).
- **externalId таблицы**: `z5PX9B8mTQC9Q6Dfuj5dM` · **внутренний id**: `vWhLIDzqSFF0brn7bdF47`

## Поля

> `externalId` — ключ в `values` у `tables-create-records` / `tables-update-record`.
> `field id` — ключ в `cells` при чтении (`tables-find-records`, `tables-get-record`).
> Оба namespace'а разные, это не опечатка — см. [tables/README.md](README.md).

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `EHOxpkEWRZvCqsH2DDUGK` | `yTuZ3TkrJyt6kvwXPAtYv` | единственный ключ пользователя (DAT-1), строкой |
| first_name | TEXT | `Py9jSQQDOrp1QkkYUowAH` | `3dtyQib3P6uuViiJ38nbO` | из апдейта |
| last_name | TEXT | `LAIY5UjBa6pThlMupxk6M` | `i1rfpqHR9H3yOqN1EV5lr` | может отсутствовать |
| username | TEXT | `wkWKhDUfiWM0MCmbBp054` | `DkN1JCEsv1ox31T30Nx1q` | справочно, связей по нему нет |
| phone | TEXT | `q4mHoEshUvxKHjRxI19Tc` | `6BRrwL5m0hgHNJ905wkum` | только из `request_contact` (DAT-2) |
| lang | TEXT | `P3UEfd4v8IigwuGrmeuFJ` | `yA9sS1SuKgjKlRgDMpbGV` | `ru` / `uz` / `en` |
| consent_pdn | STATIC_DROPDOWN | `yV3faVVofnEVjqaYKVfcW` | `tDDeYbTyumJNxUrqM77X1` | `true` / `false` — согласие на обработку данных (PAR-1) |
| consent_pdn_at | DATE | `aPJGrUsxBq5zmfp1BZBC3` | `AGXTt0wbdf98jBMcUUM22` | когда дано, UTC |
| consent_marketing | STATIC_DROPDOWN | `okGBtVrZ2FNPs7ETslHlr` | `ihVOkitsYQ7xHtz8vMs3e` | `true` / `false` — отдельное согласие (PAR-2) |
| consent_marketing_at | DATE | `3PVn3wQKAMsjmlC4W1IkS` | `HhjcIiUVtrIy4cQo5g2uu` | |
| blocked_bot | STATIC_DROPDOWN | `iXD5CZ4WHR29OWcNYDjAv` | `KXgtfvrjsxjvFoHHkZtMF` | `true` / `false` — ставится при `403` (OWN-12) |
| created_at | DATE | `V4lq9yAljXHKxVOFLoCKH` | `UGj2VNSy38dXCyr3PFQcw` | |

## Заметки

- Все три dropdown'а — `true` / `false` **плюс пустое значение** (его добавляет платформа).
  Пусто ≠ `false`: непроставленный `consent_marketing` читается как `null`, и это
  тоже «нет согласия» (PAR-2), но фильтр `eq false` его **не** найдёт — только `not_exists`.
- Уникальности по `telegram_id` БД не даёт (ADR-0003), запись идёт через find-then-write.
