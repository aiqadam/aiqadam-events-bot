# Table: sessions

- **Назначение**: состояние многошаговых диалогов в чате (сейчас — регистрация; рассылка — W14).
  Памяти процесса у флоу нет.
- **externalId таблицы**: `toTKgngMTqDNJWDpQMh4d` · **внутренний id**: `tzixKefYefWplc5n5Omz2`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `N8CdPxcdxLX9vFCINvZbL` | `NQCV96F1iQgOSQi7ntlzl` | одна активная сессия на человека |
| scenario | TEXT | `ESthrMwpn29JLvE2BNIj4` | `FpAsiafLe6APhBXurlKJx` | `registration` (W5); `broadcast` (W14, не построен); `event_create` / `event_edit` — остатки удалённого чатового визарда, обработчика нет, протухают за 24 ч |
| step | TEXT | `IdGimBh539UlGSz6L0Pyo` | `pfFyCjoe7not79rhQHEdC` | текущий шаг диалога |
| draft | TEXT | `sctBFEsMf10UobeFgzsVt` | `aaZyIkqW6yOoblRu30hQx` | **JSON строкой** — своего типа нет |
| updated_at | DATE | `U9P3zTZHcFdAAtzLVVSYn` | `fMTYEUr2NmK4YOehfJLx3` | сессии старше 24ч протухли |

## Заметки

- `draft` проверен на round-trip: строка с `"кавычками"`, `\n`, кириллицей,
  вложенным массивом и `null` вернулась байт в байт. `JSON.parse` в Code step
  разбирает её без оговорок.
- `scenario` оставлен `TEXT`, а не dropdown: список сценариев меняется чаще,
  чем хочется править схему, и валидации от dropdown всё равно нет.
