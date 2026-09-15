# W32. Права `staff` по чаптеру, окна `initData` по флоу, афиша выведена временно

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: 3 (v0.1)
- **Зависит от**: W33 (✅ сдан)
- **Начат**: 2026-09-15 · **Закрыт**: —

## Цель

Создавать **и править** ивенты вправе только `staff` своего чаптера
([ADR-0024](../adr/0024-staff-by-chapter-event-staff-checkin.md)); окна свежести
`initData` становятся **по флоу** (`manage`/`ticket` 300 c, `checkin` 12 ч);
афиша временно выводится из использования. Подробности — [BACKLOG W32](../BACKLOG.md#w32-owner-ы-по-списку-initdata-5-минут-афиша-снята),
дублировать не надо.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| таблица `staff` | externalId `PnDy6gw9tlLUqTGk2EOUn`, внутренний `5i6S4oXMalV0dGII7GNxt` | [catalog/tables/staff.md](../../catalog/tables/staff.md) |
| таблица `chapters` (строка `1`) | `mVrBhRUlmLzyZEQlkaQd0` | [catalog/tables/chapters.md](../../catalog/tables/chapters.md) |
| flow `manage-api` | `CcGPwuW4ws5hkcaOPerEG` (шаг `step_18`, авторизация в `step_7`) | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` (`step_1` читает `staff`) | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| flow `reg-start` | `FkxtgayOK5QubyqqMd9q4` (`step_12` удалён) | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `fn-hmac-init-data` | `3iQO67hpGHq1HNGt1T84X` (`MAX_AGE_CAP` 43200) | [catalog/flows/fn-hmac-init-data.md](../../catalog/flows/fn-hmac-init-data.md) |
| flow `checkin-api` | `rKoDYtiIVdbzlW59b57uH` (`maxAgeSeconds` 43200) | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| flow `my-qr-api` | `WYmnxVM4xPAWZA1IvNZok` (`maxAgeSeconds` 300) | [catalog/flows/my-qr-api.md](../../catalog/flows/my-qr-api.md) |
| SPA `Manage.tsx` | `401` → `manage.err.stale`; плитка «Афиша» снята | `miniapp/src/routes/Manage.tsx` |

Все шесть флоу опубликованы (`ap_lock_and_publish`), `flows/*.json` обновлены
**тем же коммитом** (снимок из существующих REST-файлов + дельты, `auth` сохранён;
ключ платформы в Keychain на машине агента не найден, `tools/export-flows.sh`
запустить нельзя — см. «Хвосты»).

> `tg-router` пакет **не трогает** (правило v0.1; фото-разбор в нём остаётся мёртвым).

## Чек-лист готовности

- [ ] не-staff с валидным `initData` при создании **и** правке → `403`; staff
      того же чаптера → `200` (различающие прогоны `curl`) — **заблокировано:
      нужен свежий `initData`**; логика доказана локальным харнессом (12 сценариев);
- [ ] staff другого чаптера → `403` (фикстуры `chapter_id='2'`) — **там же**;
- [x] `menu` показывает «Создать ивент» staff без ивентов, гостю — нет
      (локальный харнесс `step_4`, 3 сценария);
- [x] окна `initData`: локальный харнесс `fn-hmac-init-data/step_3`
      (10 сценариев) + значения в живых шагах (`manage`/`my-qr` 300,
      `checkin` 43200, cap 43200), подтверждено `ap_flow_structure`/MCP-экспортом;
- [ ] `#/manage` (SPA) при `401` показывает «откройте заново»; headless-прогон
      — **не выполнялся** (код готов, сборка SPA зелёная);
- [x] `/start e<id>` не отправляет `send_media`: шаг `step_12` удалён из
      `reg-start` (структура флоу), карточка без афиши;
- [x] `staff` и `chapters` (id=1) в каталоге и DATA-MODEL; `events.staff_id`
      вместо `owner_id`; `photo_file_id` помечен «временно не используется»;
      мёртвый фото-код сохранён намеренно (Q7);
- [x] `flows/` обновлён тем же коммитом, `check-export-secrets.sh` и
      `check-texts.py` чистые; строки в `migrations` — этим пакетом;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

> Заполняется по ходу. Доказателен только прогон **после** `ap_lock_and_publish`;
> у флоу с побочными эффектами негативные проверки — `curl`'ом на `/sync`.

- **Права `manage-api/step_7` — локальный харнесс (детерминированно, как W31
  делал для валидации).** Код шага скопирован из живой версии побайтово и
  прогнан на 12 сценариях: нет строки `staff` → 403; staff чаптера 1 на ивент
  чаптера 1 → 200; staff чаптера 2 на ивент чаптера 1 → 403; staff с пустым
  `chapter_id` → 200 на любой чаптер; ивента нет → 403; создание со свободным
  `newId` → 200 (`staffId`, `chapterId=1`); `newId`, занятый ивентом чужого
  чаптера → 403; повтор своего `newId` → 200 как правка; staff с пустым
  `chapter_id` при создании → `chapterId=1`; staff правит чужой ивент своего
  чаптера → 200; сентинел `-` → 403; пустой `telegramId` → 403. Все зелёные.
- **Окна `fn-hmac-init-data/step_3` — тот же приём, 10 сценариев:** 300 c:
  4 мин → свежо, 6 мин → просрочено; 43200 c: 6 мин и 11 ч → свежо, 13 ч →
  просрочено; `maxAgeSeconds=999999` обрезается до 43200; пустое окно → cap;
  `auth_date` из будущего в пределах/вне skew. Все зелёные.
- **`menu/step_4` — локальный харнесс, 3 сценария:** staff без ивентов →
  кнопка «Создать ивент» есть; гость → нет; event_staff на будущий ивент →
  кнопка сканера с `#/scan?event_id=demo`.
- **Живой проект:** `ap_flow_structure` по всем шести флоу (структура цепочек,
  значения `maxAgeSeconds`, `step_18` между `step_5` и `step_6`, отсутствие
  `step_12`); `ap_validate_flow` зелёный (manage-api 19/19, menu 6/6,
  reg-start 14/14, fn-hmac-init-data 5/5); MCP-экспорт всех шести после
  `ap_lock_and_publish` (версии см. `flows/_manifest.json`).
- **Данные:** `staff` создана и наполнена (`322876545`/`chapter_id=1`);
  `chapters.id=1` заведён; всем шести ивентам проставлен `chapter_id=1`;
  поле `owner_id` переименовано в `staff_id` с сохранением `externalId`
  `6KqxIPre6r76ycWhCX8uU`.
- **SPA:** `npm ci && npm run build` — зелёный.
- **Офлайн-проверки:** `tools/check-export-secrets.sh` (ok, 26 полей `auth`
  сохранены), `tools/check-texts.py` (112 пар, 0 расхождений).
- **Что осталось непроверенным вживую:** негативные/позитивные `curl` на
  опубликованный `/sync` (нужен валидный `initData`, см. «Хвосты») и
  headless-прогон `#/manage`; `tools/check-migrations.py` — тоже требует
  ключа платформы.

## Журнал

- **2026-09-15** — пакет взят. Перед началом пройдены открытые вопросы вокруг
  W32, решения владельца:
  - окна `initData` **по флоу**: `manage`/`my-qr` 300 c, `checkin` 12 ч;
    `fn-hmac-init-data/MAX_AGE_CAP` 86400 → 43200 (иначе потолок обрезал бы
    12 ч до 300) — [Q49](../OPEN-QUESTIONS.md#q49);
  - `checkin-api` нужно длинное окно, потому что `Telegram.WebApp.initData` —
    статичный снимок на открытие WebView, а `scan` живёт часами: с окном 300 c
    сканер встал бы через пять минут (главный путь v0.1);
  - при `401` на сохранении `#/manage` показываем «откройте форму заново»,
    введённое теряется — цена принята, хранилища черновика нет;
  - чаптер `chapters.id = 1` («AI Qadam Uzbekistan») и строка `staff`
    `322876545` (`return_void_0`), шаг человека 0.8; контролёр в v0.1 — тот же
    аккаунт, гость `8255904812`;
  - `menu` показывает «Создать ивент» по строке в `staff` даже без ивентов
    (видимость, не авторизация);
  - **ADR-0024 пересмотрел модель прав:** глобальная таблица `staff`
    (`telegram_id`, `chapter_id`, `note`, `added_at`) даёт **создание и правку**
    ивентов своего чаптера (`chapter_id` пусто = все); `events.owner_id`
    переименован в `staff_id` — авторство, не гейт; чекин остаётся `event_staff`
    (STF-2); коллизия `newId` в рамках чаптера — идемпотентная правка;
  - от `owners`-как-allow-list отказались: почему отдельная таблица, а не флаг
    в `users` — `users` машинно-ведомая и несёт ПД/согласия, флаг ролей запрещён
    духом ADR-0002, и организатора нельзя внести до его первого `/start`;
  - афиша выводится **минимально**: `reg-start/step_12` + `manage.hint.photo`;
    остальной фото-код сохраняется намеренно — фото вернётся в v0.2
    [Q50](../OPEN-QUESTIONS.md#q50), пакет [W39](../BACKLOG.md#w39-возврат-афиши-в-mini-app-форма-и-доставка).

- **2026-09-15** — реализация. Заведены `staff` (externalId
  `PnDy6gw9tlLUqTGk2EOUn`) и чаптер `1`; `events.chapter_id='1'` всем шести
  ивентам; поле `owner_id` → `staff_id` (externalId сохранён). В `manage-api`
  добавлен `step_18` (чтение `staff`) между `step_5` и `step_6`, `step_7`
  переписан на права по `staff`+чаптеру; `step_11` пишет `staff_id` и
  `chapter_id`. `menu.step_1` читает `staff`. Из `reg-start` удалён `step_12`.
  Окна: `MAX_AGE_CAP` 43200, `manage`/`my-qr` 300, `checkin` 43200. SPA: `401`
  → `manage.err.stale`, плитка «Афиша» снята. Шесть флоу опубликованы,
  `flows/*.json` и `_manifest.json` обновлены тем же коммитом. Доказательства
  — «Как проверено»; живые `curl`-прогоны ждут свежего `initData` (см. «Хвосты»).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- **Живые различающие `curl`-прогоны (403/200, окна `initData`) не выполнены.**
  Окно `manage-api` — 300 c, а свежего `initData` у агента нет: последние
  продакшн-прогоны (`my-qr-api` 2026-09-14 ~20:24 UTC) старше 12 ч и потолка.
  Валидный `initData` добывается из лога свежего прогона — нужен вход живого
  Telegram-аккаунта (`322876545`/`8255904812`) в Mini App либо запуск
  `tools/export-flows.sh` владельцем ключа. Пока это не сделано — статус
  остаётся `в работе`, не `на проверке`.
- **Экспорт `flows/` снят дельта-методом из существующих REST-файлов**, не
  `tools/export-flows.sh`: ключа платформы в Keychain машины агента нет
  (`aiqadam-events-bot:qadam-flow-api` не найден), а MCP-выгрузка обедняет
  снимок (вычищает `auth` из шагов). Содержимое взято из MCP-экспорта живой
  версии + сохранённые REST-поля (`auth`), формат сверен с `jq -S --indent 2`
  побайтово. Владельцу/ревьюеру с ключом: перегнать `tools/export-flows.sh` и
  сверить — расхождений быть не должно.
- `tg-router` в v0.1 не трогается; возврат афиши — отдельный пакет v0.2 (W39).
