# Table: staff_invites

- **Назначение**: одноразовые инвайты контролёров на 24 часа (OWN-14).
- **externalId таблицы**: `JIjKkDu3Im2ylBmkkH5Fu` · **внутренний id**: `mCWqjNUo7jiSaIN8aKpdw`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| token_hash | TEXT | `lBOKZnQ8VSnNlRb16ph9Q` | `q5XzWiPrU7MS7RtBK8jDl` | SHA-256 от токена; сам токен не хранится |
| event_id | TEXT | `90B7lnyMZnViDUXRFi8vI` | `JV7mFtOPUVf4cLgtodIJp` | |
| created_by | TEXT | `fKQAjYvMBW5ZbGWX8AYgx` | `0f4ZuF91FGysjExg3ZeCG` | |
| created_at | DATE | `It8AmKquq3YtTjOHIhX7a` | `qCxxhm726WqIQK8DC32RL` | UTC |
| expires_at | DATE | `Ue4bS4nXOkN15qNd4IQo3` | `F1L9r9PaN4yuSjV3HQai5` | `created_at + 24ч` |
| used_at | DATE | `iS3DRXdiPZIDyCB3ruCdz` | `Rp926Yyv5g7dg4haUcK5W` | пусто = не использован |
| used_by | TEXT | `wSLuGfXNArBIdIUlIXenV` | `GvpwzhT97Eif4MOrMyoZS` | |

## Заметки

- Токен в таблице отсутствует по замыслу: утечка дампа не даёт готовых инвайтов.
- Срок жизни проверяет флоу сравнением с `expires_at` в Code step, а не фильтром:
  диапазонные фильтры по `DATE` не подтверждены ([Q15](../../docs/OPEN-QUESTIONS.md#q15)).
