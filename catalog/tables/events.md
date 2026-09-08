# Table: events

- **Назначение**: ивенты, их время, место и жизненный цикл (OWN-2…OWN-4, OWN-15).
- **externalId таблицы**: `kVLg1FSfDBtsP32FGPk3P` · **внутренний id**: `9Hw8OsZkAV3zspM6w756N`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `V1uVUJxRiBTNRsnsjXXUY` | `ckvC2yBajIHxv9hNgvl8t` | slug `A-Za-z0-9_`, влезает в deep link |
| owner_id | TEXT | `6TmwIHPX0UaPnNxvdnrrk` | `tov8ei9S9JVXot5eCVm1N` | → `users.telegram_id`, роль owner (DAT-3) |
| chapter_id | TEXT | `ItYAJqBiO55ABxz3Su60C` | `k08kr0RtRqqVYqcp1NVW4` | → `chapters.id`, логики пока нет (Q8) |
| title | TEXT | `LOIQ9plnkxPH4jXB1oNeD` | `MqrO6G1FGbnt050clWSY4` | |
| description | TEXT | `WjLeekyT9WYU0rGUwcafu` | `Hc1t6roLZYQTvcQc5vaui` | |
| photo_file_id | TEXT | `DZH1o5aw6MhsyiYwA2vrI` | `x5lFXyLrWsUwwHQaKrb2Z` | Telegram `file_id`, не URL |
| address | TEXT | `T7B6BnXIUCJDwlzzo1Nsl` | `aqyOUBNXHWEL23Fdhic3V` | адрес текстом |
| lat | NUMBER | `6WkKTgc8gbJuw4CVVkFns` | `CklnFDhIFl7niX768YTUe` | для `sendVenue` (OWN-2) |
| lon | NUMBER | `MzIthWahR00RPRn9N1akr` | `MgkSbFNlvXoWywK7hIsxv` | |
| starts_at | DATE | `A5ZcLrSEIzBEXT5uesrhT` | `gcIaSyicrZYP40vsGdl7G` | UTC |
| ends_at | DATE | `TUxiWLoriJmOJb1dMMT7B` | `lwNowgYzGAig6dAyBuGyY` | UTC, по нему автопереход в `finished` (OWN-4) |
| reg_deadline_at | DATE | `7k5oXNbYn0umuLNHKetTS` | `b7JGv8sRPi0sLPwXg8Rt3` | UTC |
| status | STATIC_DROPDOWN | `HSfxXr33rkOZpqNSOtUA2` | `xVBVMi1h5jjXwNBAdrJUn` | `draft` / `published` / `cancelled` / `finished` |
| capacity | NUMBER | `Dlr2qj1qXxfeZ9TCSOUrr` | `eyxtLr2MvicIcHrocfbf9` | пусто = без лимита |
| overbook_pct | NUMBER | `KZK3DiIsYOzCPywUUyZp3` | `nkrKP4oeTbnRPCduooTfS` | дефолт 40 (OWN-15), ставит визард |
| published_at | DATE | `O9JaaeAt1kvnpy6Yxgrxw` | `m1NGGzA5lDu9HPafZ3U84` | |
| cancelled_at | DATE | `mi5YkgxedVCHdh5BSgXpt` | `01ZXuEGEn4fYzBEcplYsh` | |
| finished_at | DATE | `EpAtyKS5NUw3gBBSnifEu` | `Onp9M5NP7nPgyW6Wj5K9Y` | |

## Заметки

- Ссылки на Я.Карты в таблице нет — генерируется из `lat`/`lon` (OWN-2).
- Дефолт `overbook_pct = 40` таблицей **не** обеспечивается: `NUMBER` без значения
  читается как `null`. Подставлять дефолт обязан визард (W11) и расчёт лимита (W5).
- Значение `status` платформой не валидируется (см. [README.md](README.md)) —
  допустимость проверяет флоу.
