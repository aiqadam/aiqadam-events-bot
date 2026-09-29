# W131. Онлайн-событие: UX без QR

- **Статус**: на проверке
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

- [x] `reminders/step_8`: онлайн — одна кнопка; текст без ссылки не обещает кнопку;
- [x] `format` в публичном `events-api`; карточка и «Мои билеты» без «Показать QR»;
- [x] билет-сообщение и `reg.already` на онлайне без QR;
- [x] экран билета на онлайне без карты/адреса, заголовок/ошибки без QR;
- [x] офлайн-проверки и сборка зелёные;
- [x] `catalog/` совпадает; экспорт и `migrations` тем же PR;
- [ ] независимое ревью, «замечаний нет».

## Как проверено

- **Живой проект (MCP):** `ap_validate_flow` по шести флоу — `reminders`,
  `events-api`, `reg-api`, `reg-start`, `reg-profile`, `reg-consent-mkt` — все
  `valid`, ошибок перевода нет; `ap_lock_and_publish` каждого, экспорт
  `ap_export_flow` сразу после публикации (гоча 14), дерево в экспорте
  (`flows/*.json`) несёт новый код/колонки.
- **Ключ `reg.qr.button`** до импорта отсутствовал в платформенных переводах
  (использовался только в Mini App) — `ap_validate_flow` `reg-start` его
  назвал; импортирован, повторная валидация чистая. Поймано валидатором, а не
  прогоном.
- **Офлайн:** `check-export-secrets.sh` 0; `check-texts.py` 305 ссылок, 0
  расхождений; `check-commands.py` 0; `check-agents.py` 0; `prototypes/check.mjs`
  OK; `miniapp npm run build` OK.
- **Логика напоминания** (по коду): онлайн со ссылкой → одна кнопка «Открыть
  трансляцию»; онлайн без ссылки → одна «Открыть билет» и текст
  `remind.*_online_pending`; офлайн → «Открыть билет» + «Как добраться».
- **`check-migrations.py`** без ключа платформы не гоняется (шаг 0.7) — сверку
  манифест↔инстанс↔`migrations` по шести флоу делает ревьюер.
- **Хвост:** живой e2e в Telegram (владелец) — на онлайне со ссылкой и без неё,
  карточка каталога, «Мои билеты», билет-сообщение.

## Журнал

- **2026-09-29** — пакет взят. Аудит UX (жалоба владельца): (1) `reminders/step_8`
  на онлайне кладёт и «Открыть билет», и «Открыть трансляцию»; (2) QR-язык на
  онлайне в карточке каталога и «Моих билетах» (`Events.tsx`), шите регистрации,
  билет-сообщении (`reg-profile`, `reg-consent-mkt`), `reg.already`
  (`reg-start`, `reg-api`), заголовке/ошибках `Ticket.tsx`. Корень для
  Mini App — `events-api` не отдаёт `format`.

- **2026-09-29** — реализация. `reminders/step_8` — одна кнопка на онлайн, тексты
  `remind.*_online_pending`; `events-api` — `format` в проекции и в `item`;
  `reg-api/step_8` (+колонка) и `step_9` — `reg.already_online`; `reg-start`
  `step_3` (+`format` в вывод), `step_7` (текст и надпись кнопки), `step_8`
  (надпись из `step_7`); `reg-profile/step_2` (+колонка) и `step_4`
  (`ticket.hint_online`); `reg-consent-mkt/step_4` (+колонка) и `step_5` (то же).
  Mini App: `Events.tsx` (тип `format`, карточка, «Мои билеты», шит регистрации),
  `Ticket.tsx` (заголовок, скрытие карты/адреса на онлайне). Шесть публикаций,
  экспорт MCP, шесть строк `migrations`.
- **2026-09-29** — `texts` CODE-шагов шлются полной картой: частичная замена
  стирает остальные ключи (гоча 12). Проверял сверкой живого экспорта с
  `i18n/ru.json` — `check-texts.py` 305/0.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- живой прогон в Telegram (владелец);
- очистка ячеек (`clear_columns`) — хвост W67, отдельный пакет;
- посещаемость онлайна — [Q71](../OPEN-QUESTIONS.md#q71).
