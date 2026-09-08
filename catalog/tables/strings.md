# Table: strings

- **Назначение**: рабочая копия локализации на инстансе (I18N-2). Источник правды —
  `i18n/{ru,uz,en}.json` в репозитории, сюда их заливает `i18n-sync` (W3).
- **externalId таблицы**: `qi6bBTL7plRGBgFUfli8w` · **внутренний id**: `6965qPeAeAWTWJtna835A`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| key | TEXT | `xpNgdNnrNy0iftelqDjeN` | `BGFe8PIJ9bZaAAedTUvIc` | ключ i18n |
| lang | TEXT | `dFCeM83JXGNwClISgpRW8` | `LwFE3MkKaYdBAVEjRyRJp` | `ru` / `uz` / `en` |
| value | TEXT | `3iwUGJRHESFDjIYIyguTP` | `3L8PW7E3ziYurH5hMrJ8z` | строка |

## Заметки

- Уникальность `(key, lang)` — соглашение `i18n-sync`; БД её не держит.
- Отсутствующий перевод должен падать в `ru` (правило W3), а не в пустую строку.
