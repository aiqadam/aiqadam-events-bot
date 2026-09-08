# Table: broadcasts

- **Назначение**: рассылки, их сегмент, прогресс и курсор возобновления (OWN-9…OWN-13).
- **externalId таблицы**: `RtlPCu8KxBRPHCX62ifhc` · **внутренний id**: `2kSUjdfCLbymInDj2jiGM`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `VHGnWs1bQnpsYg2u3jOPU` | `iA7NYyZLgGdViGvs3vPQq` | |
| event_id | TEXT | `mlqPt4PJtSUXrrXJMlql7` | `L9q811E7yX5kREHx2jScA` | пусто для сегмента «все с consent» |
| segment | STATIC_DROPDOWN | `qd0jGIIvZ71Il3TF8QcML` | `cyaCW3EDm5fIRTwGyejWh` | `all_consent` / `registered` / `attended` / `no_show` |
| body | TEXT | `try4C8vr2VkueZKMWrNGD` | `YWv8dHCUVeoDnVkpU6nTk` | текст сообщения |
| parse_mode | TEXT | `JHbWl9KskyR4P1vYT5B7z` | `WqdlwCCMiXSXzLgm4EvY3` | |
| created_by | TEXT | `H8sTv1DVQ3MWvE5YzzLNl` | `mVwX9v9Eh4FPJzmPTupa9` | |
| test_sent_at | DATE | `Daaps4ZUUSZuEXxagJHXA` | `DOxchfsiB36RmW197n8I2` | **пусто → отправка запрещена** (OWN-10) |
| status | STATIC_DROPDOWN | `9I5OuPrOmUqTSBDTLHxtW` | `ixhCBd5pMg3wqO319XPaS` | `draft` / `running` / `done` / `failed` |
| total | NUMBER | `WQLce3wXHqJQfslXImxY1` | `rM9uh0MSkC6aD66n07JVk` | |
| sent | NUMBER | `UJmeH1j5F5PsYzDVbnkDg` | `tS1n8pOi0IQbgLyXW3pkN` | |
| failed_count | NUMBER | `4XRAiosauJmzCdICNEwCf` | `hqepUPMkN2EsvR84vsOLb` | |
| cursor | NUMBER | `N6UMf1VPcFO8PZ5uf6wNf` | `i5xkl47y6KS7RgL3UGVJO` | индекс в списке получателей |
| started_at | DATE | `gGBVW8PMn93CG3RS6uVVF` | `mOA0ZctTNdPAZUTdBcxwS` | UTC |
| finished_at | DATE | `zWsgRJWsgINkK4ldcBy0p` | `g1MMIhn9cs1NqTfQJX35o` | UTC |

## Заметки

- `test_sent_at` — предохранитель OWN-10, проверяется **перед** стартом рассылки.
  Пустое значение читается как `null`, ловится `not_exists`.
- `cursor` — `NUMBER`, и это единственный тип, по которому диапазонные фильтры
  (`gt`/`lt`) заведомо работают.
