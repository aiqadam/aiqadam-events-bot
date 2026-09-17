# Table: feedback

- **Назначение**: отзывы участников об ивенте — оценка и необязательный
  комментарий ([ADR-0028](../../docs/adr/0028-feedback-screen-fifth-miniapp-page.md),
  [Q53](../../docs/OPEN-QUESTIONS.md#q53)). Без анонимности, без модерации.
  Одна пара `event_id`+`telegram_id` — одна строка: повторная отправка
  перезаписывает прежний отзыв (`tables-upsert-records`, ключ по этой паре),
  а не создаёт вторую.
- **externalId таблицы**: `GgGUQEHp6g076nDb2XddP` · **внутренний id**: `Nu5P11H78lrHMdbA2DAY5`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| event_id | TEXT | `A5njEy7i4BUwpG0kh5omn` | `Lce4fZlGgpdZtAUzc96Fd` | часть ключа |
| telegram_id | TEXT | `Due6SRYplDMqO1qZzcy0N` | `SCqi5nQ8eQnRSC8T5u3Lh` | часть ключа (DAT-1) |
| rating | NUMBER | `cnYI6knHrlgOfdBKC5vxO` | `QuP7syY4d8KWYjfD4xt40` | 1–5, целое |
| comment | TEXT | `RmCFLTUyhfGDOCA4Wawu6` | `kKQEKyw257Q2PZBL7kCvz` | необязателен, ≤2000 символов |
| submitted_at | DATE | `KUEqEFHPtKa4ebT1k1ESj` | `cpRZQKchBwhOIdYRmivsx` | UTC, последней отправки |

## Заметки

- **Уникальность ключа не гарантирована БД** ([ADR-0003](../../docs/adr/0003-idempotency-without-atomicity.md)):
  `tables-upsert-records` матчит `event_id`+`telegram_id` на своей стороне.
  Проверено различающим прогоном ([feedback-api.md](../flows/feedback-api.md)):
  первый `submit` — `action: created`; повторный `submit` той же пары —
  `action: updated`, тот же `record id`, значения перезаписаны, дублей нет.
- **Доступ на чтение — только автору/staff ивента**, та же граница прав, что
  у списков участников ([manage-api.md](../flows/manage-api.md), действие
  `feedback_list`); отзывы не видны никому, кроме организаторов своего чаптера.
- **Пишет только `feedback-api`** — после проверки `initData` и факта участия
  (регистрация с чекином) на конкретный `event_id`; страница решений о правах
  не принимает.
- **Ни email/username, ни модерации, ни уведомления организатору отдельным
  сообщением** — вне пакета [W45](../../docs/BACKLOG.md#w45-послесловие-благодарность-и-форма-отзыва)
  ([Q53](../../docs/OPEN-QUESTIONS.md#q53)): отзывы смотрят через экран.
