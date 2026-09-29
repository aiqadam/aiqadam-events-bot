# W132. Перенос dev→prod: W67, W131 (+хотфикс), Mini App W127–W129 (хотфикс ADR-0042)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W67, W131, W127, W128, W129 (все `готов` на dev); W126 (предыдущий синк, влит в `prod`)
- **Начат**: 2026-09-29 · **Закрыт**: —

## Цель

Догнать `events-prod` до `events-dev` по пакетам, применённым на dev после
переноса W126 (W123/W124/W125). Prod — замороженная копия, меняется только
осознанным хотфиксом через MCP `app-flow-events-prod` (ADR-0042 п. 2).
Запрос владельца 2026-09-29: «зальем обновление на prod».

## Объём (dev `main` vs ветка `prod`: 28 коммитов)

| Пакет | Слой | Точки на prod |
|-------|------|---------------|
| W67 | инстанс | поля `events.online_url` + `events.format` (+бэкфилл — dev-only, на prod данных те же 4 события нет: проверить); флоу `manage-api`, `my-qr-api`, `reminders`; переводы (ключи онлайна) |
| W131 + хотфикс `qwbiAdfsdfZKj7rxZYQOF` | инстанс | флоу `events-api`, `reminders`, `reg-api`, `reg-start`, `reg-profile`, `reg-consent-mkt`; ключ `reg.qr.button`; переводы |
| W127, W128, W129 | только Mini App | merge `main`→`prod`, `build:prod`, деплой `pages-prod` |

## Чек-лист готовности

- [ ] сверка dev↔prod до правки зафиксирована (что именно расходится);
- [ ] поля `events.online_url`/`events.format` на prod (без ключа — проверить наличие/значения);
- [ ] каталог переводов на prod — ключи W67+W131 (ru/uz/en);
- [ ] 8 флоу портированы, `ap_validate_flow` valid, опубликованы (LOCKED);
- [ ] нормализованный диф dev↔prod по 8 флоу — 0 семантических расхождений;
- [ ] живой smoke prod (`/sync`: `events-api` 200 с `format`, `my-qr-api`/`report-api` 401 с переводом);
- [ ] Mini App prod: `main`→`prod`, `build:prod` зелёный, запушено, `pages-prod` success, бандл проверен;
- [ ] строки `migrations` на prod (`2026-09-29-w132-…`);
- [ ] `catalog/environments.md` отражает состояние (если менялось);
- [ ] офлайн-проверки зелёные;
- [ ] независимое ревью — «замечаний нет».

## Как проверено

- **Переводы**: 24 новых ключа (W67+W131+Mini App W127–W129) × ru/uz/en залиты
  `ap_upsert_translations` — все приняты (`{{$t[...]}}` резолвится).
- **Схема**: поля `events.online_url` (TEXT, int `KkMoC2mC…`, ext `XKetQH8z…`) и
  `events.format` (STATIC_DROPDOWN online/offline, int `UQJPGbIB…`, ext
  `JMI0Ec14…`) созданы. Маппинг dev→prod: `lang` ext `5bvPj31…`→`6UVLXYAb…`
  (int `wkJRAt…`→`U0UzI9…`); остальные поля/таблицы совпадают.
- **`events-api`** (`wEdKdE4R…`): `step_1` колонки +`format`/`lang` (prod-extId),
  `step_2` код с `format` (хотфикс `filter(isPast)`); valid 4/4; тестовый прогон
  `S1YABeAXhs1fLjGUPY1YV` SUCCEEDED (200, пустые срезы — в prod нет
  published/finished); опубликован `gH5ELg3aWARzG09OvEZud` (LOCKED).
- **`my-qr-api`** (`WYmnxVM4…`): `step_9` добавлен `ap_add_step` AFTER `step_3` —
  цепочка перелинковалась сама (`step_3→step_9→step_4`, гоча 10 — только про
  ROUTER); `step_5` код+вход, `step_6` вход; `step_9` pin 0.4.6 +
  `continueOnFailure`; valid 10/10; `step_5` сверен `ap_read_step_code`
  побайтово с dev; тест невалидного пути `Go0rJjukO3af4EjK2zkVY` SUCCEEDED
  (401 с переводом); опубликован `tQFCoEZoqXNzgZubp6wfY` (LOCKED). Валидный путь
  (step_9→step_5) — хвост на владельца (нужен живой initData).
- **`reminders`** (`HJvh8nEh…`): `step_1` колонки +`online_url`/`format`,
  `step_2`/`step_4` код (online/onlineUrl/mapsUrl), `step_8` код + 9 ключей
  `texts`; valid 11/11; `step_8` сверен `ap_read_step_code`; опубликован
  `nSo5U6QmXwOyKV5be1c4X` (LOCKED). Прогон не делался (отправка сообщений);
  живой e2e — хвост на владельца.
- **`manage-api`** (`CcGPwuW4…`): `step_7` код+вход (41 ключ `texts`), `step_11`
  upsert +`format`/`online_url` (prod-extId); valid 61/61; `step_7` сверен
  `ap_read_step_code` с dev; опубликован `VsdhuEi5Fg81i8krk8oQY` (LOCKED);
  экспорт проверен субагентом: `step_11` — 19 ключей, 3 маппинга точны, `step_7`
  — `normFormat` + `online_url` в `EVENT_KEYS`. Save-путь живьём — хвост на
  владельца (нужен живой initData staff).
- **`reg-api`** (`SiYL8m6k…`): `step_8` колонки +`format`, `step_9` код+вход
  (20 ключей `texts`); valid 46/45+1 skipped (`step_12`, W60); `step_9` сверен
  `ap_read_step_code` построчно (по пути поймана и исправлена своя ошибка
  транскрипции: `deadline_passed`/`too_late` — см. журнал); опубликован
  `Rb7bbeoW9LedMwlyinfYI` (LOCKED), экспорт проверен субагентом.
- **`reg-start`** (`FkxtgayO…`): `step_3` код+вход, `step_7` код+вход (4 ключа),
  `step_8` вход (auth KIbx виден во входе шага в живом `ap_flow_structure` —
  telegram-шаги несут auth внутри input, экспорт его зачищает); valid 21/21;
  опубликован `FF9ueU6ECgXvUV4tL3FUb` (LOCKED), экспорт сверен.
- **`reg-profile`** (`5U3Kv0cS…`): `step_2` колонки +`format`, `step_4` код+вход
  (38 ключей); valid 40/40; `step_4` сверен `ap_read_step_code`; опубликован
  `WLYauRql1cnoNrNFHTduo` (LOCKED), экспорт проверен субагентом.
- **`reg-consent-mkt`** (`3gLF6Tcb…`): `step_4` колонки +`format`, `step_5`
  код+вход (12 ключей); valid 11/11; `step_5` сверен `ap_read_step_code`;
  опубликован `umKDENNz63nFu5S4K6aNd` (LOCKED), экспорт сверен.
- **Бэкфилл**: 2 живые записи prod `events` → `format=offline` (Meetup #3 с
  адресом; тест «Кладдадд» без ссылки — поведение сохранено, оба cancelled).
- **`migrations` prod**: 11 строк `2026-09-29-w132-01…11` (2 поля, переводы,
  8 публикаций с version_id).
- **Нормализованный диф**: все портированные шаги сверены read-back/экспортом
  с dev; auth/connection и callFlow-ссылки prod не тронуты (проверено в
  экспортах: `KIbx…`, `VzXoy…`/`Q3iGnx…`/`VvSckb…` на месте).
- **Живой smoke prod** (`/sync`, 2026-09-29): `events-api` → 200
  `{"ok":true,"past":[],"upcoming":[]}` (новый код с `format`, без 500);
  `my-qr-api` с пустым initData → 401 `invalid_init_data` с русским переводом
  (`$t` на prod резолвится).
- **Mini App prod**: `main`→`prod` мерж `79d224e` (без конфликтов, `report`
  в `.env.prod` сохранён), `build:prod` зелёный (96 модулей, чанк `Report`,
  `dist/i18n/ru.json` — 491 ключ), запушено; деплой `pages-prod` run
  `36554987716` success; живой `miniapp-prod…` отдаёт `index-DptZRk5_.js`,
  `i18n/ru.json` — 491 ключ, все новые на месте.

## Журнал

- **2026-09-29** — пакет взят по запросу владельца «давай зальем обновление на prod».
  Инвентарь: `git log prod..main` — 28 коммитов (W127, W128, W129, W67, W131+хотфикс).
  `ap_list_flows`: dev — 32 (31 наш + чужой `ChatBot`), prod — 31, все published/ENABLED.
  Id сред разошлись после W106 (карта — `catalog/environments.md`).

- **2026-09-29** — инстанс готов: 8 флоу опубликованы, бэкфилл и 11 строк
  `migrations` на prod. Урок: при ручном переносе CODE-кода легко внести
  ошибку в «правдоподобную» строку (`reason: 'no_seats'` вместо
  `'deadline_passed'`, подмена `too_late`-ветки) — валидатор её не видит;
  ловится только построчной сверкой read-back с dev-файлом. Для оставшихся
  шагов сверка делалась построчно, больше расхождений нет.

## Ревью

- **Ревьюер**: независимый review-agent · **Дата**: 2026-09-29 · **Вердикт**: замечаний нет (круг 3)

Круг 1 — «есть замечания» (важно: переводы; на будущее: auth). Круг 2 —
«есть замечания» (важно осталось: у ревьюера нет `ap_list_translations`;
на будущее закрыто). Круг 3 — «замечаний нет»: множество 12 flow-ссылок
пересчитано ревьюером скриптом (сошлось), `ap_validate_flow` prod по всем 8
флоу valid (счётчики сошлись с журналом), остальные 12 проверены
Mini-App-only по живым входам всех 8 флоу (`includeInput`). Подробности —
в вердиктах выше.

Проверен живой prod через MCP, репозиторий и живой Mini App: 8 версий LOCKED
совпадают с `migrations`, изменённые шаги несут логику dev, нетронутое не
тронуто (`checkin-api` опубликован 2026-09-28, callFlow/connection на месте),
схема и бэкфилл верны, AppSec чист, Mini App prod (мерж `79d224e`, бандл
`index-DptZRk5_.js`, 491 ключ), офлайн 305/0. Полный разбор — у ревьюера;
ниже замечания и ответы.

### Ответы владельца пакета (круг 2, 2026-09-29)

1. **важно (переводы)** — ограничение харнесса обойдено декомпозицией
   (посчитано скриптом по `flows/*.json`, снапшоты сверены с живым prod
   read-back/экспортом): из 24 ключей флоу ссылаются ровно на 12
   (`field.format`, `field.online_url`, `format.offline`/`online`,
   `manage.err.online_url`, `reg.already_online`, `remind.24h/2h_online` +
   `*_pending`, `remind.btn.stream`, `ticket.hint_online`). Все 8
   `ap_validate_flow` прошли **после** заливки переводов, а валидатор
   называет отсутствующий ключ (прецедент W131: `reg.qr.button`) —
   значит, эти 12 на prod есть. Остальные 12 — Mini-App-only (флоу их не
   читают, `TranslationKeyNotFoundError` невозможен); их наличие доказано
   прямым листингом `ap_list_translations` в сессии владельца (инструмент
   есть у владельца, нет у ревьюера) и живым `i18n/ru.json` prod
   (491 ключ, пропусков нет).
2. **на будущее (опечатка «шаговговариваний»)** — исправлено.

## Хвосты и блокеры

- Живой сквозной e2e в Telegram (онлайн-событие → билет/напоминание) — за владельцем
  (хвост W67/W131, на prod тем более).
- `clear_columns`/сведение признака к `format` — хвосты W67/W131, не входят в синк.
- [Q71](../OPEN-QUESTIONS.md#q71) (посещаемость онлайна) — не входит.
