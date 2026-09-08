# Table: staff_invites

- **Назначение**: одноразовые инвайты контролёров на 24 часа (OWN-14).
- **externalId таблицы**: `TrHzP09CQTbpU14FPBZLQ` · **внутренний id**: `jkomdSZUOorlO0kGZanuv`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| token_hash | TEXT | `VBAr3TnYB9ZBw9kSvf8bx` | `KlFFWIwaxcDvoTqUukq5g` | SHA-256 от токена; сам токен не хранится |
| event_id | TEXT | `wKu1xRU8t6NgtNm51QxLu` | `C2rU7Xa9skVZNIK2vHSKK` | |
| created_by | TEXT | `7E9wD05egP44UTQ6hxz4V` | `OLN9WHMYih3V2aUBrsW5C` | |
| created_at | DATE | `alwTu2JHYegKfrJUoQ0jx` | `HomcvGr0McejQ39tEKqoS` | UTC |
| expires_at | DATE | `6U4j20SCHz3uymnqFmwNv` | `H9vM0VB3xeHsZ1FV7bgSf` | `created_at + 24ч` |
| used_at | DATE | `wyURyqdfuSXlxMoo6jFep` | `jdVvmqtvvAmG6ZXM6pbsN` | пусто = не использован |
| used_by | TEXT | `Km2MBDin7LHtF0Ay5S90u` | `KTWm5CfHvGUiXBRKKqsu4` | |

## Заметки

- Токен в таблице отсутствует по замыслу: утечка дампа не даёт готовых инвайтов.
- Срок жизни проверяет флоу сравнением с `expires_at` в Code step, а не фильтром:
  диапазонные фильтры по `DATE` не подтверждены ([Q15](../../docs/OPEN-QUESTIONS.md#q15)).
