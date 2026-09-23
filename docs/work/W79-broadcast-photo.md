# W79. Phase 2: анонс спикера — фото + форматирование, вариант A (#131 Part 1)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: P2 (tracking [#117](https://github.com/aiqadam/aiqadam-events-bot/issues/117))
- **Зависит от**: #120 ✅, #149 ✅ (копирование сообщения с фото)
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Пересланный боту пост (одно фото + caption с жирным и ссылкой под словом)
должен доезжать до получателей **как есть**, а не одним caption. Вариант A
(решение владельца 2026-09-23): `copyMessage` без подстановки имени; имя
`{имя}` — Part 2, только для текстовых рассылок. Part 1 = **одно фото**.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `tg-router` | `nyaBzgKGG8TTTsryjc9tW` (published `GEPAAsgSlLkjmgFJ2dbsy`, откат `E5UtwCPjFh5dUFmF0YKg8`) | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `bcast-draft` | `2AUeMeakjrrjUqZ0RuGpL` (published `sC3UsgphXjZhQZXwEsCZ6`, откат `9nWB6uoEbstSF1FkTTsTo`) | [catalog/flows/bcast-draft.md](../../catalog/flows/bcast-draft.md) |
| flow `bcast-step` | `Sr1e3imXkI8sN0lXyROtA` (published `RQqYWpueNdOJvdZyrg586`, откат `liNopuoGXBZNzqvbFIeBL`) | [catalog/flows/bcast-step.md](../../catalog/flows/bcast-step.md) |
| flow `bcast-run` | `ABjmnym2NRGldfGeHoGbN` (published `MwHBzL1LroVRG4UHkeArN`, откат `3KdulYi7KJX5vEMynHwEk`) | [catalog/flows/bcast-run.md](../../catalog/flows/bcast-run.md) |
| таблица `broadcasts` | `DrFrwV10gtJzCP02ifz0I` — +`media_chat_id` (`0KCxjpZONVc1URjFBBlvr`), +`media_message_id` (`QkMPuoMtVWmQhWMpfflFC`) | [catalog/tables/broadcasts.md](../../catalog/tables/broadcasts.md) |

## Чек-лист готовности

> Из issue [#131](https://github.com/aiqadam/aiqadam-events-bot/issues/131), «Definition of done» (Part 1).

- [ ] Анонс «фото + caption с жирным и ссылкой под словом» доходит до получателей нетронутым — код на месте (copyMessage), живой сквозной прогон за владельцем
- [x] Сегмент «Все подписчики анонсов» доступен для анонсов (есть с W14, не менялся)
- [x] «Тест себе» совпадает с тем, что получают участники — и тест, и отправка идут одним `copyMessage`
- [x] Решение владельца A/B записано (комментарий в #131, 2026-09-23)
- [x] Секретов в `flows/*.json` нет (`check-export-secrets.sh`)
- [x] Альбом (2–3 фото) — вынесен в Part 2 (Phase 3), не в этом пакете
- [x] `catalog/` совпадает с живым проектом

## Как проверено

- **Схема таблицы (живой MCP):** `ap_manage_fields` ADD `media_chat_id`,
  `media_message_id` → оба TEXT; `ap_get_piece_props tables-find-records`
  подтвердил externalId (`0KCxjpZONVc1URjFBBlvr`/`QkMPuoMtVWmQhWMpfflFC`).
- **Рискованное место — `copyMessage` с шаблонным `reply_markup` внутри
  `body.data` и `url`-объектом.** Проверено временным флоу `zz-w79-copytest`
  (trigger `callableFlow` → CODE → `custom_api_call /copyMessage`):
  прогон `A1QMj8RGDMe9Dvc7gVD0A` — `step_2` `status:200`,
  `body:{ok:true,result:{message_id:2585}}`; копия фото с caption и кнопкой
  дошла до тестового чата владельца. Флоу удалён после проверки.
- **Валидация:** `ap_validate_flow` — `tg-router` 22/22, `bcast-draft` 11/11,
  `bcast-step` 57/57, `bcast-run` 53/53.
- **Офлайн:** `check-export-secrets.sh` exit 0 (8 `BOT_TOKEN`, 2 `QR_SIGNING_KEY`
  — как ожидалось, значений нет); `check-texts.py` 253/0; `check-commands.py`
  0; `check-agents.py` 0; `prototypes/check.mjs` OK.
- **Живой сквозной e2e и смоук — за владельцем** (пересланное фото → событие →
  сегмент → «Тест себе» → отправка тестовому сегменту).

## Журнал

- **2026-09-23** — взят пакет. Решение владельца: **вариант A** — `copyMessage`
  как есть (фото + caption + жирный + ссылка под словом), без подстановки имени;
  Part 1 — одно фото, альбомы — Part 2. Вводные #149: `copy_message` в piece
  нет, копирование — `custom_api_call` к `/copyMessage` с телом `{"data": {...}}`
  (токен подставляет connection, в URL не писать); `reply_markup` для копии
  нужно передавать **явно** (иначе кнопка «Отписаться» теряется) — и в основной
  отправке (`step_27/28`), и в ретрае после 429 (`step_36`).
- **2026-09-23 — схему `broadcasts` пришлось расширить, и это решение
  владельца.** Источник `copyMessage` (chat + message пересланного поста) надо
  где-то хранить между черновиком и чанкованной отправкой; схема заморожена,
  поэтому владелец отдельно одобрил два поля `media_chat_id`/`media_message_id`
  (вариант «в `parse_mode`» отклонён). Обновлены `DATA-MODEL.md`,
  `catalog/tables/broadcasts.md`.
- **2026-09-23 — отправка переведена на `copyMessage` для текста и фото
  разом.** Ветвить «фото — копией, текст — как раньше» дорого: ветки в этом
  движке не сходятся, и пришлось бы дублировать весь хвост классификации
  ошибок и пометок. `copyMessage` текстового форварда даёт тот же текст, поэтому
  один путь на оба случая. Источник пишется всегда, у нового черновика он есть.
- **2026-09-23 — грабли: `ap_update_step` не умеет менять действие и не чистит
  старые пропы.** Смена `actionName` у `step_30` оставила пропы
  `send_text_message` (`chat_id`, `message`, `format`…), валидатор валит шаг
  «Unknown properties»; `null`/пустая строка ключи не удаляют. Лечение —
  `ap_delete_step` + `ap_add_step` (движок сам перепривязал потомка к
  родителю). Сделано для `bcast-step/step_30`, `bcast-run/step_28` и `step_36`;
  `ap_validate_flow` после — все флоу валидны. `url` DYNAMIC пишется объектом
  `{"url": "/copyMessage"}`, а не строкой.
- **2026-09-23 — фото без подписи поддержано (issue, шаг 1):** гейты «пустое
  тело» в `bcast-step/step_7` и `step_28` расслаблены до «тело пусто **и**
  источника нет»; альбомный апдейт без подписи (`mediaGroupId`) в черновик не
  заводится — Part 2.
- **2026-09-23 — публикация.** Heads-up в #131, затем `ap_lock_and_publish`
  четырёх флоу (`bcast-draft`, `bcast-run`, `bcast-step`, `tg-router`),
  экспорт MCP сразу после (гоча 14).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Альбомы (2–3 фото) — Part 2 (Phase 3), отдельный дизайн (сборка по
  `media_group_id`, лимит подписи 1024, «Отписаться» отдельным сообщением).
- Подстановка `{имя}` (вариант B) — Part 2, только текстовые рассылки.
- Живая рассылка только тестовым аккаунтам; полная рассылка — на владельце.
