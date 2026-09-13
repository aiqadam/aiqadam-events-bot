# Table: sessions

- **Назначение**: состояние визардов (создание/правка ивента, составление рассылки).
  Памяти процесса у флоу нет.
- **externalId таблицы**: `toTKgngMTqDNJWDpQMh4d` · **внутренний id**: `tzixKefYefWplc5n5Omz2`
- Пересоздана в [W26](../../docs/work/W26-rebuild-on-one-touch.md) 2026-09-13
  после очистки инстанса 13.09.2026. Идентификаторы ниже — новые.

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `N8CdPxcdxLX9vFCINvZbL` | `NQCV96F1iQgOSQi7ntlzl` | одна активная сессия на человека |
| scenario | TEXT | `ESthrMwpn29JLvE2BNIj4` | `FpAsiafLe6APhBXurlKJx` | `event_create` / `event_edit` / `broadcast` / `registration` (W5) |
| step | TEXT | `IdGimBh539UlGSz6L0Pyo` | `pfFyCjoe7not79rhQHEdC` | текущий шаг визарда |
| draft | TEXT | `sctBFEsMf10UobeFgzsVt` | `aaZyIkqW6yOoblRu30hQx` | **JSON строкой** — своего типа нет |
| updated_at | DATE | `U9P3zTZHcFdAAtzLVVSYn` | `fMTYEUr2NmK4YOehfJLx3` | сессии старше 24ч протухли |

## Заметки

- `draft` проверен на round-trip: строка с `"кавычками"`, `\n`, кириллицей,
  вложенным массивом и `null` вернулась байт в байт. `JSON.parse` в Code step
  разбирает её без оговорок.
- `scenario` оставлен `TEXT`, а не dropdown: список сценариев меняется чаще,
  чем хочется править схему, и валидации от dropdown всё равно нет.
