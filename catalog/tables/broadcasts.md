# Table: broadcasts

- **Назначение**: рассылки, их сегмент, прогресс и курсор возобновления (OWN-9…OWN-13).
- **externalId таблицы**: `XrygYF5Q4EUOKkaBFallb` · **внутренний id**: `DrFrwV10gtJzCP02ifz0I`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `AXQRMe7knv8NFDCckziRD` | `8XG5IRicIHlg8a9Up2Fgd` | |
| event_id | TEXT | `vGB2xSw6CWfuMilj0wAlH` | `0beSoF4qBuW2kb7cyrXnQ` | пусто для сегмента «все с consent» |
| segment | STATIC_DROPDOWN | `6rmHz7Lc1djdjFpjAmO5V` | `VLW4nkzkcUnS5hRoCUuxu` | `all_consent` / `registered` / `attended` / `no_show` |
| body | TEXT | `YF9ryxUV0d3RK74xPjZkq` | `GxrPGLmTZd5hFC8KMPaVx` | текст сообщения |
| parse_mode | TEXT | `bU9nqeQ2wZo2bMr2kBnNj` | `hsG8r74WOjNE9W6FPYN0l` | |
| created_by | TEXT | `AQs7BEfN0hZ3OjPZXZNsc` | `1ETU0y7eoYD0uNvs8WMUX` | |
| test_sent_at | DATE | `7BP3OXd4mJxqrkodJMm3i` | `dZ94NSVx8WB6K5zabDTpe` | **пусто → отправка запрещена** (OWN-10) |
| status | STATIC_DROPDOWN | `6ITY7K1B8OgqL0lm2Idbg` | `HjQnjB1rFQJx57V7En9El` | `draft` / `running` / `done` / `failed` |
| total | NUMBER | `YGr4kZEcE1b8zdZE3eqcV` | `DYrvulwTq4HH2qwOcLRXa` | |
| sent | NUMBER | `ltKozKZzGOMZegnWFHmPU` | `3mzc4WCBPo5dUcfSiWRiF` | |
| failed_count | NUMBER | `zSTccFLKPqYSbEqrEL2Gl` | `GmATFUvwQScsa7GdT3PNg` | |
| cursor | NUMBER | `MNy5oYhMX34dDj5x6JLd7` | `cVRqZm5ErYVDii1IRWG6y` | индекс в списке получателей |
| started_at | DATE | `GEb4WuGSUofCWNtAz8uBs` | `pQpEcjvWDoZ3VIhmOJXfg` | UTC |
| finished_at | DATE | `yevE4jElXPvczO4LTt2Yj` | `nr4uLO3Mz3F5tCznJNGXy` | UTC |

## Заметки

- `test_sent_at` — предохранитель OWN-10, проверяется **перед** стартом рассылки.
  Пустое значение читается как `null`, ловится `not_exists`.
- `cursor` — `NUMBER`, и это единственный тип, по которому диапазонные фильтры
  (`gt`/`lt`) заведомо работают.
