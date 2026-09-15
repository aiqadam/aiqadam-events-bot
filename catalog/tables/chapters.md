# Table: chapters

- **Назначение**: чаптеры сообщества. Ограничивают доступ `staff` к ивентам
  ([ADR-0024](../../docs/adr/0024-staff-by-chapter-event-staff-checkin.md));
  сегменты рассылок по чаптеру пока не режутся ([Q8](../../docs/OPEN-QUESTIONS.md#q8)).
- **externalId таблицы**: `dsNl5HIdqSQqspIz6fWuK` · **внутренний id**: `mVrBhRUlmLzyZEQlkaQd0`

## Поля

| Field | Type | externalId | field id | Назначение |
|-------|------|-----------|----------|-----------|
| id | TEXT | `TrV3x3YRrOEG7xGThTNlM` | `90n6mTPouZ6VJN7lYiem0` | slug |
| title | TEXT | `YPyX2yBoWaeW8L8OpJKQb` | `KU4m5KH0xjHIetjCmE4C5` | |
| created_at | DATE | `QX8RaKkaNkv50bQreQNmJ` | `uzi1isH3chZNG3d8HRxjr` | |

## Заметки

- **Заведена строка `id = 1`** («AI Qadam Uzbekistan») — общий чаптер v0.1;
  из неё `manage-api` берёт `chapter_id` нового ивента, когда у staff он пуст,
  и по ней же сверяет доступ. Заводится [W32](../../docs/work/W32-owners-initdata.md).
- Второго чаптера нет; выбор чаптера в форме (OWN-1) не появляется — его
  определит `staff` (ADR-0024).
