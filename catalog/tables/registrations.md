# Table: registrations

- **Назначение**: регистрации и чекины (IDM-1, IDM-2, OWN-6, OWN-7, OWN-9).
- **externalId таблицы**: `PNuChoFG0tIBTND86yzDL` · **внутренний id**: `9l2eoVI3ld9owKlOMDCpE`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `p0Pt1eWNqqgdMlFz4CHV4` | `NZNeqVRZcH8wBZtbWgFRU` | |
| event_id | TEXT | `6mRpFdqphYL2PtfQwBFEr` | `DGWEwF6lyKyM9bfsCF04X` | → `events.id` |
| telegram_id | TEXT | `kfw8Et1Msb0Qiki6GMs9b` | `fySgoL1hW6dHhW1zRBmgn` | → `users.telegram_id` |
| status | STATIC_DROPDOWN | `w9pIRgtcpaeM6eAXTqUho` | `U1AoqOM9asCLkIoCklHPh` | `registered` / `cancelled` |
| source | TEXT | `hDeWfkCVu90QvIylwBMkG` | `hUxbtOwa7p1IgDvpclFte` | utm из `?start=e<id>-<utm>` (OWN-6) |
| registered_at | DATE | `pHRVL3VU8Uih8q5eXuawV` | `GmlNdAzzStyym5hlXIEOi` | UTC |
| cancelled_at | DATE | `5LoVUHd08e58i0bXZFYJk` | `iqJfR9QuvWIfNc7Pi0YGX` | UTC |
| checked_in_at | DATE | `O0STb7ZZjuwQcPNtsn0Kk` | `xZj5TTD3xaHr6JbPgrycC` | пусто = не пришёл; пишется один раз (IDM-2) |
| checked_in_by | TEXT | `jbRXjpizQvLwrSImNcqO1` | `AF70drdJ1vMjSksx2BnbT` | `telegram_id` контролёра |

## Заметки

- **Уникальность `(event_id, telegram_id)` — соглашение флоу, не БД.** Проверено:
  три строки с одной парой вставляются подряд без жалоб. Чтение — только через
  `fn-find-registration`, который берёт самую раннюю (ADR-0003).
- «Не пришёл» ищется фильтром `checked_in_at not_exists`: проверено, он
  ловит и `null`, и пустую строку.
