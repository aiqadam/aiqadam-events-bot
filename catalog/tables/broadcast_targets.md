> # ⛔ ТАБЛИЦА НЕ СУЩЕСТВУЕТ
>
> Инстанс `events-dev` очищен владельцем проекта **13.09.2026**: таблиц в проекте
> ноль. Все идентификаторы ниже — и `externalId`, и внутренний `id`, и id полей —
> **мертвы**; при пересборке платформа выдаст новые
> ([tables/README.md](README.md#два-namespaceа-идентификаторов--главная-ловушка)).
>
> **Схема полей ниже актуальна и есть спека для пересборки.** Идентификаторы —
> нет. Пересборка идёт пакетом
> [W26](../../docs/work/W26-rebuild-on-one-touch.md).

# Table: broadcast_targets

- **Назначение**: материализованный список получателей рассылки — снимок сегмента
  на момент старта; защита от двойной отправки при рестарте чанка.
- **externalId таблицы**: `lg5rQmGCnNrbAJSAQOUfX` · **внутренний id**: `0dGx02CIBS2aaIuY6jSCQ`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| broadcast_id | TEXT | `UHrlk5Lx9gUpzl2P6khDj` | `5CGh9OWJQls4I4lMfrtDn` | → `broadcasts.id` |
| telegram_id | TEXT | `NsN3ZBCkU4dt9wLWRhSyE` | `GsvPPBp710eIa4bK5RGQr` | получатель |
| state | STATIC_DROPDOWN | `W9jfC0sHtGgJpRrA79f0F` | `e8UvJzhqiVOrttY48m3Nl` | `pending` / `sent` / `blocked` / `failed` |
| sent_at | DATE | `sHMhdGfMSRMLxkoCmUYpf` | `fHrlJmSJ0Jj1PQx4hCuSz` | UTC |
| error | TEXT | `V6kmTR2H0kfZUWQLLOEwt` | `1AKIEl9iZfTgoJ1mfb9cr` | текст ошибки Telegram |

## Заметки

- Уникальность `(broadcast_id, telegram_id)` — соглашение флоу: снимок собирается
  один раз при старте, повторный сбор не делается.
- «Кому ещё не отправлено» = `state eq pending`, а не арифметика по `cursor`:
  курсор — оптимизация, состояние получателя — источник правды.
