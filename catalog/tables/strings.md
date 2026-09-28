# Table: strings

- **Назначение (архив)**: рабочая копия старого i18n-обвеса (W3). Источник строк
  был `i18n/{ru,uz,en}.json`, сюда их заливал `i18n-sync`.
- **Таблица пуста и читаться не будет.** С 2026-09-27 i18n вернулся на
  платформенном механизме [ADR-0045](../../docs/adr/0045-i18n-on-platform-dollar-t.md)
  (W25): строки живут в **платформенных переводах** `{{$t['ключ']}}`, куда
  импортируются из `i18n/*.json`; `i18n-sync` не воскрешается. Таблица
  пересоздана в W26 намеренно, но остаётся пустой.
- **externalId таблицы**: `9swx5NlpR0mbK6jXjIG15` · **внутренний id**: `9SzXJ9oW0avbN1Wmbo0EU`
- Строк — 0.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| key | TEXT | `KAoFYsn9t6NjSRoJBCNkq` | `de8oVIFJI6uHDH1CcFNCN` | ключ i18n |
| lang | TEXT | `ExEOFCN9yoOiGTKXCes6o` | `mwnPyF5jXzyuAkElrOKJx` | `ru` / `uz` / `en` |
| value | TEXT | `nY1nVle7xHNdDPLQBGgJD` | `m6OdlmXL7kDaWpoRkJBZG` | строка |

## Заметки

- **Кто пишет:** никто. `i18n-sync` не воскрешается
  ([ADR-0045](../../docs/adr/0045-i18n-on-platform-dollar-t.md)); источник
  строк — `i18n/*.json`, рабочая копия — платформенные переводы проекта.
- Актуальная механика локализации — [I18N.md](../../docs/I18N.md).
