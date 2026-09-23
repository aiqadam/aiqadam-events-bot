# W79. Phase 2: анонс спикера — фото + форматирование, вариант A (#131 Part 1)

- **Статус**: на проверке
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
| flow `bcast-step` | `Sr1e3imXkI8sN0lXyROtA` (published `mUBsgkhFz8Z5jv7uToQ80`, откат `liNopuoGXBZNzqvbFIeBL`) | [catalog/flows/bcast-step.md](../../catalog/flows/bcast-step.md) |
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
  `body.data` и `url`-объектом.** Читаемое доказательство — временный флоу
  `zz-w79-copytest` (`7eGhh8t9fXGwcXxUnX4EM`, **оставлен до вердикта**, гоча 11):
  прогон `Ib4ldE0LjRdZsF69fvKAE` — `step_2` `status:200`,
  `body:{ok:true,result:{message_id:2586}}`; копия фото с caption и кнопкой
  дошла до тестового чата владельца. (Первый такой прогон был удалён вместе с
  флоу до вердикта — исправлено, см. ревью круг 1, замечание 2.)
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
- **2026-09-23 — ревью круг 1: два «важно».** (1) `step_7` потерял ключ
  `bcast.btn.seg_noshow` из `texts` — гоча 12 (частичная карта при
  `ap_update_step`), поймано ревью, а не `check-texts.py`; вернул полную карту,
  переопубликовал `bcast-step` (`mUBsgkhFz8Z5jv7uToQ80`), обновил экспорт и
  строку `migrations` w79-04. (2) доказывающий прогон был удалён вместе с флоу
  (гоча 11) — пересоздал `zz-w79-copytest` и оставил до вердикта, читаемый
  прогон `Ib4ldE0LjRdZsF69fvKAE`. Попутно убрал дубль гейта в `step_28`.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: review-agent · **Дата**: 2026-09-23 · **Вердикт**: есть замечания

### Проверено живьём (MCP `app-flow-events-dev`)

- `ap_list_flows` — все четыре флоу `ENABLED`/`published`; `zz-w79-copytest` в
  проекте нет (удалён).
- `ap_export_flow` по каждому — `state: LOCKED`, `flows[0].id` совпадает с
  `flows/_manifest.json`: `tg-router` `GEPAAsgSlLkjmgFJ2dbsy`,
  `bcast-draft` `sC3UsgphXjZhQZXwEsCZ6`, `bcast-step` `RQqYWpueNdOJvdZyrg586`,
  `bcast-run` `MwHBzL1LroVRG4UHkeArN`.
- `ap_flow_structure` (bcast-step, bcast-run) + `ap_read_step_code`:
  - `tg-router/step_1` отдаёт `mediaGroupId`/`hasPhoto`; `step_10` — условие
    `forwarded && (fwdText!=='' || (hasPhoto && mediaGroupId===''))`; остальные
    маршруты (команды, `bcast:*`, `menu:*`, `reg:*`, текст-фолбэк) не тронуты.
  - `bcast-draft/step_5` кладёт `mediaChatId`/`mediaMessageId` в `draft`;
    `bcast-step/step_7` их читает и пускает фото без подписи (тело пусто при
    непустом источнике); `step_9` пишет в `broadcasts` по externalId
    `0KCxjpZONVc1URjFBBlvr`/`QkMPuoMtVWmQhWMpfflFC` (сверено с каталогом).
  - `bcast-run/step_28` снова **внутри цикла** `step_26` (родитель `step_27`),
    `step_36` — после `step_35` в ветке `retry429`; `step_29` читает
    `{{step_28['error']}}`, `step_37` — `{{step_36['error']}}`;
    `bcast-step/step_30` — первым в ветке `ok` от `step_29`, `step_31` читает
    `{{step_30['error']}}`.
  - Все три — `custom_api_call` с `url: {"url": "/copyMessage"}`,
    `body: {"data": {…}}`, явным `reply_markup`, `from_chat_id`/`message_id` из
    источника; `auth` — `{{connections['TZTlXaCEO2hEvimUowbSA']}}`, токена в
    URL нет.
  - `continueOnFailure: true` на `step_28/30/36` — по экспорту, снятому с той же
    версии (`ap_flow_structure` его не отдаёт).
- Гейты `created_by`/staff/сегмента не ослаблены (диф + живая структура):
  `step_7`/`step_28` (bcast-step) и `step_4` (bcast-run) сохранили проверки;
  кнопка «Отписаться» — в тесте и в массовой отправке.
- `ap_find_records migrations` — 5 строк `2026-09-23-w79-01…05`, `version_id` =
  версии манифеста, `commit f82cf34`.
- `ap_get_piece_props custom_api_call` — `failsafe` = «No Error on Failure»;
  `url` DYNAMIC, `body` DYNAMIC с подключом `data`.

### Проверено по экспорту/дифу/офлайн

- `check-export-secrets.sh` exit 0 (значений нет), `check-texts.py` 48/0,
  `check-commands.py` 0, `check-agents.py` 0, `prototypes/check.mjs` OK.
- `check-migrations.py` не запускался (нет ключа платформы) — сверка
  `migrations` ↔ `_manifest.json` ↔ `ap_list_flows` сделана вручную.
- Каталог `catalog/flows/*.md`, `catalog/tables/broadcasts.md`,
  `docs/DATA-MODEL.md` совпадают со структурой/полями.

### Замечания

1. **важно** — пропал текст кнопки сегмента «no_show». В `bcast-step/step_7`
   из входа `texts` удалён ключ `bcast.btn.seg_noshow`, а код по-прежнему зовёт
   `t('bcast.btn.seg_noshow')` (fallback `t()` возвращает сам ключ). Овнер на
   экране сегментов увидит кнопку с текстом `bcast.btn.seg_noshow` вместо
   «Не пришедшие». Это регресс, внесённый этим пакетом (в `main` ключ был), и
   нарушение инварианта «текст из `i18n/ru.json`». Похоже на гоча 12
   (частичная карта `texts` при `ap_update_step`). Лечение — вернуть ключ в
   `texts` шага `step_7` (полной картой) и опубликовать `bcast-step`.
   - *Исправлено*: полная карта `texts` (13 ключей, включая
     `bcast.btn.seg_noshow`) возвращена в `step_7`; `bcast-step` переопубликован
     (`mUBsgkhFz8Z5jv7uToQ80`), экспорт и `migrations` обновлены; сверка
     `main`↔`HEAD` по всем четырём флоу — других потерянных ключей `texts` нет.
     (2026-09-23)
2. **важно** — центральное доказательство пакета нечитаемо. Журнал ссылается на
   прогон `A1QMj8RGDMe9Dvc7gVD0A` временного флоу `zz-w79-copytest`, но флоу
   удалён, а `ap_get_run` по id отвечает «Flow run not found» (гоча 11 прямо
   просит не удалять доказывающие флоу до вердикта). Единственное подтверждение,
   что `custom_api_call /copyMessage` с шаблонным `reply_markup` внутри
   `body.data` работает, — свидетельство владельца; независимо перепроверить
   нечем. До сдачи — читаемый прогон (временный флоу оставить) либо закрыть это
   живым e2e владельца.
   - *Исправлено*: временный флоу `zz-w79-copytest` пересоздан
     (`7eGhh8t9fXGwcXxUnX4EM`) и **оставлен**; читаемый прогон
     `Ib4ldE0LjRdZsF69fvKAE` (200, `message_id 2586`) снят через `ap_test_flow`
     и доступен `ap_get_run`. Флоу удалю только после вердикта. (2026-09-23)
3. **на будущее** — в `bcast-step/step_28` гейт продублирован: после
   `if (body==='' && media==='')` идёт `if (media==='')`, из-за чего первая
   проверка мертва, а фактическое условие — «источник обязателен» (а не «тело
   **или** источник», как написано в `catalog/flows/bcast-step.md`). Для
   `copyMessage` источник и правда обязателен, так что поведение верное; но
   строку стоит убрать, а каталог — привести к факту.
   - *Исправлено*: дубль убран, `step_28` теперь проверяет ровно «тело пусто
     **и** источника нет»; каталог (`catalog/flows/bcast-step.md`) уже
     сформулирован как «тело **или** источник» — совпадает. (2026-09-23)
4. **на будущее** — `check-texts.py` не ловит ключи, используемые в CODE, но
   отсутствующие во входе `texts` (замечание 1 прошло мимо него). Стоит
   расширить чекер (разбор `t('…')` из `sourceCode` ↔ ключи `texts`), иначе
   регресс повторится и снова будет найден только ревью.
   - *Ответ*: принято как «на будущее»; расширение `check-texts.py` — отдельная
     правка инструмента, не в этом пакете (сейчас чекер сверяет только
     присутствующие пары). (2026-09-23)
5. **на будущее** — конверт ошибки `custom_api_call` для `429`/`403` живьём не
   подтверждён (унаследованный хвост W14: «живой 429/403 не ловился»). Разбор
   `step_29`/`step_37` соответствует документированному конверту (`status`,
   `responseBody.error_code/description`), но что тот же конверт даёт именно
   `custom_api_call`, не доказано; при форме `{message: <JSON-строка>}` без
   `status` разобранное тело читается не полностью, и `429`/`403` деградируют в
   `failed` (OWN-12 молча не сработает). Проверить различающим прогоном при
   первой возможности.
   - *Ответ*: принято как «на будущее», унаследованный хвост W14. Конверт 400
     от `custom_api_call` проверен живьём (несёт `status` и
     `responseBody.error_code`), так что разбор `step_29/37` совпадает по форме;
     живой 429/403 — при первой возможности. (2026-09-23)
6. **на будущее** — альбом с подписью молча становится черновиком из одного
   фото: guard `mediaGroupId === ''` отсекает только апдейты без подписи, а
   первый апдейт альбома с caption уходит в `bcast_draft`. Для Part 1 это
   ожидаемо, но помнить при взятии Part 2 (иначе `copyMessage` разошлёт одно
   фото из альбома).
   - *Ответ*: принято как «на будущее»; для Part 2 обязательно (альбомы и так
     идут отдельным пакетом). (2026-09-23)

### Не проверено

- Живой Telegram e2e (пересланное фото → «Тест себе» → отправка тестовому
  сегменту) — на владельце, как и заявлено в журнале.
- Живые `429`/`403` через `custom_api_call` (см. замечание 5).
- `ap_get_run` по прогону `A1QMj8RGDMe9Dvc7gVD0A` — «not found»
  (замечание 2).

## Хвосты и блокеры

- Альбомы (2–3 фото) — Part 2 (Phase 3), отдельный дизайн (сборка по
  `media_group_id`, лимит подписи 1024, «Отписаться» отдельным сообщением).
- Подстановка `{имя}` (вариант B) — Part 2, только текстовые рассылки.
- Живая рассылка только тестовым аккаунтам; полная рассылка — на владельце.
