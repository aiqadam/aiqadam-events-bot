# W101. Прод-инцидент: пустой `eventId` в фильтрах `reg-api`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн — инцидент в проде, решение владельца 2026-09-24
- **Зависит от**: —
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

Экран каталога `#/events` («Мои билеты» и таб «Профиль») отдаёт ошибку всем
пользователям. Причина — в `reg-api`: `tables-find-records` с `eq` по пустому
значению теперь падает fail-closed, а `step_7`/`step_8` фильтруют по
`{{step_2.eventId}}`, который пуст для действий `mine`, `profile_get`,
`profile_save`, `delete_account`. Убрать зависимость фильтра от пустой
строки, не меняя поведение `register`/`cancel`.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-api` | `SiYL8m6k4oy4YunAdZ1W7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |

Инстанс: изменён `reg-api` (draft → publish). Таблицы, переменные, другие
флоу не тронуты.

## Причина (разбор)

- Платформа начала **fail-closed отклонять пустое значение `eq`** в
  `tables-find-records`: `Filter #1: the "eq" operator on field "<f>" requires
  a value` (`filters.js:213`, `toScalarValue`). Раньше пустое значение
  проглатывалось.
- `reg-api` был построен в расчёте на старое поведение: `step_7` (чтение
  регистраций события) и `step_8` (чтение самого события) выполняются
  линейно для **всех** действий, но `eventId` непустой только у
  `register`/`cancel`. Для `mine`, `profile_get`, `profile_save`,
  `delete_account` фильтр получал `''` и валил прогон.
- Прогон-свидетель (владелец, `@return_void_0`): `DqQeHS8hgl7cT2SOZw7rP`
  (08:30 UTC) — `profile_get`, падение на `step_7`. Тот же отказ на всех
  прогонах `reg-api` с ~07:19 до постановки пакета.
- Проверено прямым `ap_run_action` `tables-find-records` с `value: ""` —
  та же ошибка; с непустым sentinel `__none__` — `[]` без ошибки.

## Правка

Приём уже принят в проекте (`lifecycle`, `bcast-step`): Code-шаг отдаёт
непустой sentinel, когда значение пусто. Здесь:

1. `step_2` (CODE «normalize request») дополнительно отдаёт
   `eventIdOrNone = eventId !== '' ? eventId : '__none__'`. Поле `eventId`
   остаётся как есть (его читает `step_9`).
2. `step_7` и `step_8` фильтруют по `{{step_2['output'].eventIdOrNone}}`
   вместо `{{step_2['output'].eventId}}`.

`__none__` не совпадает ни с одним реальным `event_id`/`id`, поэтому для
`mine`/`profile_*`/`delete_account` чтения возвращают `[]` (семантика
«события нет»), а `step_9` решает как раньше. Для `register`/`cancel`
`eventIdOrNone === eventId` — поведение не меняется.

## Чек-лист готовности

- [ ] `ap_validate_flow reg-api` — чисто
- [ ] `mine` и `profile_get` на живом `initData` — `200 {ok:true}` (пустой `eventId`)
- [ ] `register`/`cancel` (непустой `eventId`) — без регресса
- [ ] `flows/reg-api.json` перегенерён из LOCKED-версии тем же коммитом
- [ ] `catalog/flows/reg-api.md` отражает живой проект; платформенная гоча — в `AGENTS.md`
- [ ] строка `publish` в таблице `migrations` + `catalog/tables/migrations.md`
- [ ] офлайн-проверки (`check-export-secrets.sh`, `check-texts.py`, `check-commands.py`) — зелёные
- [ ] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

- Диагностика: `ap_get_run DqQeHS8hgl7cT2SOZw7rP` — `step_7` ❌
  `the "eq" operator on field "event_id" requires a value`;
  `ap_run_action tables-find-records` с `value:""` — та же ошибка,
  с `value:"__none__"` — `[]`.
- После правки: <заполнить — прогоны на драфте, живой `curl /sync`>.

## Журнал

- **2026-09-24** — инцидент воспроизведён по прогонам `reg-api`; причина —
  смена поведения платформы (пустой `eq` → fail-closed), а не правка флоу.
  Владелец выбрал полный пакет с независимым ревью вместо хотфикса.
  Правка внесена в драфт; публикация — после вердикта ревью (решение
  владельца: прод меняется только после ревью).

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: <агент> · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Живая проверка `delete_account` (разрушительное действие) на реальном
  аккаунте не выполняется — проверяется кодом и драфт-прогоном до чтений.
