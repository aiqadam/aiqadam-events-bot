# Table: events

- **Назначение**: ивенты, их время, место и жизненный цикл (OWN-2…OWN-4, OWN-15).
- **externalId таблицы**: `R4aSQpLZvw7d3u6DVOSjH` · **внутренний id**: `bVtxmEkqb3dPwZ2FKljqk`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `39qJ4o2MYyNYsT2VtxfcK` | `fnvGRZ5dTFES29pqSCu3Q` | slug `A-Za-z0-9_`, влезает в deep link |
| owner_id | TEXT | `6KqxIPre6r76ycWhCX8uU` | `C9RTZG5cBrYYzoiYlqPZR` | → `users.telegram_id`, роль owner (DAT-3) |
| chapter_id | TEXT | `Femtgz8bh7N8jSOMUHfRt` | `FLG7wUpIdITkTd4wSUU5Y` | → `chapters.id`, логики пока нет (Q8) |
| title | TEXT | `tQEzfGR3hYG0ztG50Po00` | `GZkI8QmdKsUEaHAFzo3sh` | |
| description | TEXT | `8PdNUVtOvTuwRzJFQDgfy` | `7WeqSNfx6MNzB8gIVPjN3` | |
| photo_file_id | TEXT | `hfpenYm4IZ5apFOt6cIgD` | `cxblz5YPWPPMfXAadROMf` | Telegram `file_id`, не URL |
| address | TEXT | `kSRM3ouou0Owj2yDYk92W` | `cS62NQgXQgmB5LNDuBFfE` | адрес текстом |
| lat | NUMBER | `EKEX5zyhKo3WChz5ZquY0` | `1Q8tRDqMP8pT7q1Ssx6mS` | для `sendVenue` (OWN-2) |
| lon | NUMBER | `Br2f0wjLugSGIS2kjfoFE` | `vUjQ80W4oqe2YQ8kByUUS` | |
| starts_at | DATE | `8me4o2U2wj6cyrv8lfJv9` | `SBg2C3f2Mj6axkPQoYEHY` | UTC |
| ends_at | DATE | `zIA6xEHm7y1bwkajoYDQn` | `MPxJsawgCgyOdHSL4mVms` | UTC, по нему автопереход в `finished` (OWN-4) |
| reg_deadline_at | DATE | `j4BZ0Z6VMwWbHc5RlTBfB` | `cPbEh2PR0nWqLq0cM7Cl2` | UTC |
| status | STATIC_DROPDOWN | `iUPI69WFE2B8w3BBHdrak` | `Ia0fI5cUGnI4VH7iXsEbv` | `draft` / `published` / `cancelled` / `finished` |
| capacity | NUMBER | `tVHurK8WamXGJZNCzWHGE` | `gdS990dKszDq93IdXqRLU` | пусто = без лимита |
| overbook_pct | NUMBER | `SjLUFfn2RhsADnLE0wWw3` | `asK197MVeFolrZm9Chvyd` | дефолт 40 (OWN-15), ставит визард |
| published_at | DATE | `TH7QDW3lLW7KHUP4LE2ra` | `vhfxjnMEzbe7q2yOcba0y` | |
| cancelled_at | DATE | `9bwuaZzPNqmutUMLVIpOO` | `IDiqCP3it8CRD2fRgJYNK` | |
| finished_at | DATE | `Xtzz8LHOpBTVk2hTDYJvL` | `gYWyiIAjpoghrZFFLxnCM` | |

## Заметки

- Ссылки на Я.Карты в таблице нет — генерируется из `lat`/`lon` (OWN-2).
- Дефолт `overbook_pct = 40` таблицей **не** обеспечивается: `NUMBER` без значения
  читается как `null`. Подставлять дефолт обязан визард (W11) и расчёт лимита (W5).
- Значение `status` платформой не валидируется (см. [README.md](README.md)) —
  допустимость проверяет флоу.
