# W102. Аудит `eq`-фильтров с необязательным значением (хвост W101)

- **Статус**: в работе
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

## Чек-лист готовности

- [ ] `ap_validate_flow` чист по каждому из 6 флоу
- [ ] пустой `eventId`/`userId` больше не валит шаг (живой/различающий прогон)
- [ ] непустые пути без регресса
- [ ] `flows/*.json` + `_manifest.json` перегенерены тем же коммитом
- [ ] `catalog/flows/*.md` отражают живой проект; гоча в `AGENTS.md` (W101) дополнена
- [ ] строки `publish` в `migrations`
- [ ] офлайн-проверки зелёные
- [ ] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

- <заполнить>

## Журнал

- **2026-09-24** — аудит `flows/*.json` (explore-агент) + ручная сверка
  подозрительных мест через MCP. Подтверждён штатный путь поломки
  `reg-profile/step_2` (онбординг без события из menu, `draft.eventId:''`).

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- <заполнить>
