# Table: users

- **Назначение**: люди, которых бот видел, их язык и согласия (DAT-1, PAR-1, PAR-2).
- **externalId таблицы**: `xHhYjhwqKdONkrYJGcBsz` · **внутренний id**: `gyMqrk23KWlFQweY3qDU0`

## Поля

> `externalId` — ключ в `values` у `tables-create-records` / `tables-update-record`.
> `field id` — ключ в `cells` при чтении (`tables-find-records`, `tables-get-record`).
> Оба namespace'а разные, это не опечатка — см. [tables/README.md](README.md).

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| telegram_id | TEXT | `JtylZU291K7TuMn9c9F2t` | `wXNExrKuctrBdtrX5IHEC` | единственный ключ пользователя (DAT-1), строкой |
| first_name | TEXT | `nWPJjEcVpqMUaMwdEpPX5` | `1Q944fmm16kJUSM9Aa6df` | из апдейта |
| last_name | TEXT | `yd5CbkPctz2GXmBabZeVV` | `Q0Jc5p5zp4k3Za1FcBuDk` | может отсутствовать |
| username | TEXT | `QCFLn2jRQPxB4RpMKxAKH` | `HeXQlTD8AgLnMvXAYtC4i` | справочно, связей по нему нет |
| phone | TEXT | `U05XVnW62T9q9IkZw1W3N` | `uLDyHJxawdUNwKZnBUrKv` | не заполняется: телефон в регистрации не спрашивается, писателей нет (DAT-2); в старых строках значения могут оставаться |
| lang | TEXT | `wW12TT5X2kFgLryWbnnm5` | `XzWbggBmUBAYSMxGkaTYs` | `ru` / `uz` / `en` |
| consent_pdn | STATIC_DROPDOWN | `KtdV8plfevjdnKlLko08q` | `mtWROpZrIW5v1Aqv3dM5U` | `true` / `false` — согласие на обработку данных (PAR-1) |
| consent_pdn_at | DATE | `LeY6BeUOzWIyEtUFfKNbI` | `tw8cz1KCjEp91HhCTvIGS` | когда дано, UTC |
| profile_first_name | TEXT | `SVQHL3bEpU9x9mMe5vuwV` | `SVQHL3bEpU9x9mMe5vuwV` | имя из онбординга (PAR-8, W50); отдельно от `first_name` — то перезаписывается апдейтами |
| profile_last_name | TEXT | `B0bP8keR2vuyH0G4p1HYv` | `B0bP8keR2vuyH0G4p1HYv` | фамилия из онбординга (имена решены W50, Q58) |
| position | TEXT | `uey0e0Uv13EGEwIqo3kod` | `uey0e0Uv13EGEwIqo3kod` | должность из онбординга |
| company | TEXT | `DJw9ie9ZMuVvX6V3CHefm` | `DJw9ie9ZMuVvX6V3CHefm` | компания, может отсутствовать |
| city | TEXT | `WUxzEvTHUI2IHcAGEGiG0` | `WUxzEvTHUI2IHcAGEGiG0` | город из онбординга |
| profile_completed_at | DATE | `LTv6dhg23SgfyzTpIRGkT` | `LTv6dhg23SgfyzTpIRGkT` | когда профиль заполнен; гейт повторного касания |
| consent_marketing | STATIC_DROPDOWN | `FpWznk9Fgl8wUXXUKolRu` | `p5kwWMUyrOXRvQx4oTH29` | `true` / `false` — отдельное согласие (PAR-2) |
| consent_marketing_at | DATE | `3t75byELQCZ1ejfTADsvp` | `43TyWVNELRXBlud9Iuziy` | |
| blocked_bot | STATIC_DROPDOWN | `ja2S7DwVun5AKs3Jk7jK6` | `9u6qoAhEOXOp00K5AjshG` | `true` / `false` — ставится при `403` (OWN-12) |
| created_at | DATE | `TS1eYS5hUJOWx8CBlNMDx` | `EKvitZWz6m3tsDLIX2njA` | |

## Заметки

- Все три dropdown'а — `true` / `false` **плюс пустое значение** (его добавляет платформа).
  Пусто ≠ `false`: непроставленный `consent_marketing` читается как `null`, и это
  тоже «нет согласия» (PAR-2), но фильтр `eq false` его **не** найдёт — только `not_exists`.
- Уникальности по `telegram_id` БД не даёт (ADR-0003), запись идёт через find-then-write.
