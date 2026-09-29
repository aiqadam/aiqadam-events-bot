# W131. Онлайн-событие: UX без QR

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: не в волне (хвост W67)
- **Зависит от**: W67 — ✅ 2026-09-29
- **Начат**: 2026-09-29 · **Закрыт**: —

## Цель

Убрать QR-язык с онлайн-событий и лишнюю кнопку из напоминания. Подробности —
[BACKLOG.md](../BACKLOG.md#w131-онлайн-событие-ux-без-qr), дизайн —
[ADR-0053](../adr/0053-online-event-no-qr-wording.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `events-api` | `7MSsiJX1OJM9jcvZoU7g5` | [catalog/flows/events-api.md](../../catalog/flows/events-api.md) |
| flow `reminders` | `5JiN4gJgdh8ItkzUqVnTf` | [catalog/flows/reminders.md](../../catalog/flows/reminders.md) |
| flow `reg-api` | `SmutybV5qJQjQASJGY9vi` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| flow `reg-start` | `furNEp5R3KFZ2jdSni2Eu` | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| flow `reg-consent-mkt` | `uOKODGfZjyhNbED320cjz` | [catalog/flows/reg-consent-mkt.md](../../catalog/flows/reg-consent-mkt.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w131-онлайн-событие-ux-без-qr).

- [ ] `reminders/step_8`: онлайн — одна кнопка; текст без ссылки не обещает кнопку;
- [ ] `format` в публичном `events-api`; карточка и «Мои билеты» без «Показать QR»;
- [ ] билет-сообщение и `reg.already` на онлайне без QR;
- [ ] экран билета на онлайне без карты/адреса, заголовок/ошибки без QR;
- [ ] офлайн-проверки и сборка зелёные;
- [ ] `catalog/` совпадает; экспорт и `migrations` тем же PR;
- [ ] независимое ревью, «замечаний нет».

## Как проверено

> Чем именно, а не «протестировано».

- <проверка> → <результат>

## Журнал

- **2026-09-29** — пакет взят. Аудит UX (жалоба владельца): (1) `reminders/step_8`
  на онлайне кладёт и «Открыть билет», и «Открыть трансляцию»; (2) QR-язык на
  онлайне в карточке каталога и «Моих билетах» (`Events.tsx`), шите регистрации,
  билет-сообщении (`reg-profile`, `reg-consent-mkt`), `reg.already`
  (`reg-start`, `reg-api`), заголовке/ошибках `Ticket.tsx`. Корень для
  Mini App — `events-api` не отдаёт `format`.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- живой прогон в Telegram (владелец);
- очистка ячеек (`clear_columns`) — хвост W67, отдельный пакет;
- посещаемость онлайна — [Q71](../OPEN-QUESTIONS.md#q71).
