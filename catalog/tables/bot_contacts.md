# Table: bot_contacts

- **Назначение**: состояние доставки бота: язык, блокировка бота, последний контакт
  ([ADR-0059](../../docs/adr/0059-id-switch-prep-deletion-and-delivery-state.md) §2). Данные модуля, в
  AI Qadam ID не уходят. Заменяет эти поля в `users`, когда `users` уйдёт (ID ADR-0032 §1).
- **externalId таблицы**: `JLPfHt5KW4PpanBBWX4V6` · **внутренний id**: `lXsWetfliAWCaKwnDiOuA`
- **Ключ (`keyFields`)**: `telegram_id`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `rN5Cjn1XGBsHvUKzeACwQ` | `xQEnKvjdFvIrk4MaJMMCW` | ключ (DAT-1), строкой |
| lang | TEXT | `DnY9yMa61wvgvXH85kMlt` | `H41kCRRNXWJPgZTx9gZ2j` | `ru` \| `uz` \| `en`, язык интерфейса бота |
| blocked_bot | BOOLEAN | `IgTi6gAA3SR3iyGnKIQ9c` | `OVEOt9QXi0rQRDq4pMUmg` | ставит `bcast-run` на ответ Telegram 403 |
| last_contact_at | DATE | `lCmw3bJRA2hjdM8lqQXAW` | `5giDwLp3WKRX0BnTReteT` | последний апдейт от человека, UTC |

## Заметки

- **Пока пустая.** Создана в W145. Писать в неё начинает пакет переключения: `tg-router` вместо
  `users`, `bcast-run` для `blocked_bot`. Начальные значения переносятся из `users` одним прогоном
  перед переключением, с отчётом только из чисел.
- **Удаляется подфлоу [`fn-delete-person`](../flows/fn-delete-person.md).**
- **`blocked_bot` — BOOLEAN** по ADR-0059 §2, в отличие от `STATIC_DROPDOWN` в `users`. Перенос из
  `users` переводит значение.
