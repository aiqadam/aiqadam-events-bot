# W102. Аудит `eq`-фильтров с необязательным значением (хвост W101)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн — хвост W101, решение владельца «добей хвосты» 2026-09-24
- **Зависит от**: W101 (та же причина — платформенный fail-closed на пустом `eq`)
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

Платформа fail-closed отклоняет пустое значение `eq` в `tables-find-records`
(`Filter #N: the "eq" operator on field "<f>" requires a value`). W101 закрыл
`reg-api`; остались другие флоу с тем же классом. Пройтись по всем
`tables-find-records` и убрать пустые значения фильтров там, где они
достижимы, не меняя поведение при непустых данных.

## Аудит

Полный обход `flows/*.json` (87 фильтров). Итог:

| Класс | Шаги | Вердикт |
|---|---|---|
| Публичный вебхук, `body.eventId` не валидируется | `checkin-api/step_3`, `checkin-api/step_13`, `checkin-counter-api/step_3`, `checkin-counter-api/step_4` | **чинить** |
| Публичный вебхук, нет валидности `parse` | `checkin-api/step_6` (`userId` из `fn-parse-start`) | **чинить** |
| Публичный вебхук, нет гейта `initData` | `staff-events-api/step_2` | **чинить** |
| Внутренний, no-event онбординг | `reg-profile/step_2` (`eventId:''` из draft — штатный путь menu) | **чинить** |
| Внутренний, `continueOnFailure=true` (смягчено) | `reg-consent-pdn/step_6`, `reg-consent-mkt/step_4` | **чинить** |
| Crafted callback (недостижим без bot token) | `bcast-step/step_5,13,27,37` | принято (не чиним) |
| Теоретический `valid=true` без `user` (недостижим) | все `telegram_id eq data.telegramId` после гейта | принято (не чиним) |
| Уже безопасно (сентинелы) | `fn-find-registration`, `bcast-run`, `lifecycle`, `reminders`, `reg-api`, `manage-api`, `staff-invite`, `reg-afterword` | не трогаем |
| Значение не может быть пустым | `menu`, `reg-start`, `staff-accept`, `tg-router`, `bcast-draft`, `bcast-unsub`, `events-api`, `feedback-api` (гейт `load`) | не трогаем |

## Правка

Приём тот же, что в W101: непустой sentinel `__none__` из Code-шага;
`register`/непустые пути не меняются (`sentinel === value`).

1. `checkin-api` — новый CODE `step_14` после `step_1` (`eventIdOrNone`) и
   CODE `step_15` после `step_2` (`userIdOrNone`); фильтры `step_3`/`step_13`
   → `eventIdOrNone`, `step_6` → `userIdOrNone`.
2. `checkin-counter-api` — новый CODE `step_9` после `step_1`; фильтры
   `step_3`/`step_4` → `eventIdOrNone`.
3. `staff-events-api` — новый CODE `step_6` после `step_1`; фильтр `step_2`
   → `telegramIdOrNone`.
4. `reg-profile` — `step_3` отдаёт `eventIdOrNone`; фильтр `step_2` → он же.
5. `reg-consent-pdn` — `step_2` отдаёт `eventIdOrNone`; фильтр `step_6` → он же.
6. `reg-consent-mkt` — `step_2` отдаёт `eventIdOrNone`; фильтр `step_4` → он же.

## Что построено

| flow | version id (publish) | Что изменено |
|------|----------------------|--------------|
| `checkin-api` (`rKoDYtiIVdbzlW59b57uH`) | `u3Owwfcc9NltCLlLiCfd9` | +CODE `step_14` (`eventIdOrNone`), +CODE `step_15` (`userIdOrNone`); фильтры `step_3`/`step_13`/`step_6` |
| `checkin-counter-api` (`lm9S9cRuSZOpVAgl2h44R`) | `2xKbbF8UFnMG6ajKBTg5M` | +CODE `step_9` (`eventIdOrNone`); фильтры `step_3`/`step_4` |
| `staff-events-api` (`Ok7iXvrnJUUzNcR5OwH8x`) | `B3QZyGQCC9RtlYT3noUtg` | +CODE `step_6` (`telegramIdOrNone`); фильтр `step_2` |
| `reg-profile` (`5U3Kv0cSrnvDTrbictA4L`) | `HAeSmWAMGEqsf0M1uiVqu` | `step_3` отдаёт `eventIdOrNone`; фильтр `step_2` |
| `reg-consent-pdn` (`vQJDQ8NecB1PleIFrq07O`) | `M5IVJfolzEGQ5p5QGqvRC` | `step_2` отдаёт `eventIdOrNone`; фильтр `step_6` |
| `reg-consent-mkt` (`3gLF6TcbpFObHONATQ64N`) | `uqCr7IxmvvhJrYe8nyYuH` | `step_2` отдаёт `eventIdOrNone`; фильтр `step_4` |

Каталоги — `catalog/flows/<name>.md`; экспорт — `flows/*.json` + `_manifest.json`.

## Чек-лист готовности

- [x] `ap_validate_flow` чист по каждому из 6 флоу
- [x] пустой `eventId`/`userId` больше не валит шаг (живой/различающий прогон)
- [x] непустые пути без регресса
- [x] `flows/*.json` + `_manifest.json` перегенерены тем же коммитом
- [x] `catalog/flows/*.md` отражают живой проект; гоча в `AGENTS.md` (W101) дополнена
- [x] строки `publish` в `migrations`
- [x] офлайн-проверки зелёные
- [x] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

- **`checkin-api`** (живой `curl /sync`, `initData` владельца, окно 12 ч):
  - `eventId: ""`, `payload: "c demo-1-x"` → `403 forbidden` (было `500`);
  - `eventId: "demo"`, `payload: "notaqr"` → `403 forbidden`, прогон
    `q0XPjE3xoRmoxf9ifJmBW`: `step_14.eventIdOrNone="demo"`,
    `step_2.data.userId=""`, `step_15.userIdOrNone="__none__"`,
    `step_3=[]`, `step_6=[]` (**без падения**), `step_13=[]`.
- **`checkin-counter-api`**: `initData` валиден, `eventId: ""` → `403 forbidden`
  (было `500`).
- **`staff-events-api`**: `initData: "garbage"` → `401 {ok:false}`
  (было `500`); `step_6.telegramIdOrNone="__none__"` → `step_2=[]` →
  `step_4` отдаёт `401`, как задумано.
- **`reg-profile` / `reg-consent-pdn` / `reg-consent-mkt`**: фильтр
  `events.id eq __none__` → `[]`, `events.id eq mu9rqipgetmp` → строка
  (`ap_run_action`); код шагов и структура сверены, `ap_validate_flow` чист.
  Живой онбординг требует Telegram-пользователя — хвост.
- **Регресс**: `checkin-api` с непустым `eventId` (`step_3`/`step_13`
  получили `eventIdOrNone === eventId`); `register`/`cancel`/`mine` `reg-api`
  не трогались.

## Журнал

- **2026-09-24** — аудит `flows/*.json` (explore-агент) + ручная сверка
  подозрительных мест через MCP. Подтверждён штатный путь поломки
  `reg-profile/step_2` (онбординг без события из menu, `draft.eventId:''`).
  Приняты как недостижимые без bot token: crafted `callback_data` в
  `bcast-step` и подписанный `initData` без `user` (фильтры по
  `data.telegramId` после гейта) — записаны в хвост.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- **Живой онбординг без события** (`reg-profile` → `reg-consent-*`) не
  прогнан end-to-end: нужен Telegram-пользователь без профиля (онбординг
  запускается из чата). Логика закрыта чтением кода, `ap_validate_flow` и
  различающим `ap_run_action` по фильтру; живой позитив — хвост на W15.
- **Принято как недостижимое без bot token:** crafted `callback_data` в
  `bcast-step` (`step_5/13/27/37`); `valid=true` без `user` в подписанном
  `initData` (фильтры по `data.telegramId` после гейта в `manage-api`,
  `reg-api`, `checkin-api`, `checkin-counter-api`). Пользователь не может
  подделать `callback_data`, а подписанный `initData` без `user` требует
  bot token — не чиним.
- `tools/check-migrations.py` без ключа платформы в среде — сверка
  manifest ↔ `ap_export_flow` ↔ `migrations` вручную; автопроверка — на W15.
