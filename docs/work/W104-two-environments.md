# W104. Две среды в одном репозитории; prod-хотфикс после копии; пересборка `events-dev`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (пре-приёмка W15, шаг 0.6 — cutover на Meetup #3)
- **Зависит от**: [ADR-0042](../adr/0042-two-environments-one-repo.md) — принят
- **Начат**: 2026-09-26 · **Закрыт**: —

## Цель

Ввести среду как first-class объект репозитория ([ADR-0042](../adr/0042-two-environments-one-repo.md)),
починить обе среды после переноса dev→prod копией и очистить/пересобрать `events-dev`.
Prod остаётся «as is» — замороженной копией; структурно его не пересобираем, только
перепривязываем мёртвый connection и правим переменные.

## Контекст (как есть)

- 2026-09-26 владелец поднял `app-prod.flow.aiqadam.org` **копией** dev-базы и заменил
  connection на `Events-Prod` (`KIbxO5kYo3RsU5PNGPz9l`).
- Прежний dev-connection `TZTlXaCEO2hEvimUowbSA` **удалён**, но остался в шагах обеих
  сред. Движок резолвит `{{connections[...]}}` в любом `auth` шага (включая мёртвый
  `auth` на `callFlow`, у которого пропа `auth` нет вовсе) и **роняет шаг**:
  прод-прогон `bKKe0P1y5KnKTrWTIwwhQ` (26.09 10:54, `/start` владельца) упал на
  `step_15` — `ConnectionNotFound: TZTlXaCEO2hEvimUowbSA`.
- `ap_validate_flow` битую ссылку на connection **не ловит**.

## Инвентарь мёртвых ссылок (prod, скан живого)

17 флоу, 72 шага с `auth = {{connections['TZTlXaCEO2hEvimUowbSA']}}`; у `tg-router`
триггер уже на `KIbx…`.

| flow | шаги с `auth` |
| --- | --- |
| bcast-draft | step_7, step_9 |
| bcast-run | step_7, step_18, step_22, step_28, step_36, step_52 |
| bcast-step | step_1, step_11, step_12, step_24, step_25, step_26, step_30, step_34, step_35, step_36, step_43, step_46, step_53, step_55 |
| bcast-unsub | step_1, step_5, step_7 |
| dedup-report | step_7 |
| manage-api | step_15, step_17, step_27 |
| menu | step_5, step_12 |
| quiz | step_9, step_10 |
| quiz-answer | step_9, step_13, step_14 |
| reg-afterword | step_10 |
| reg-consent-mkt | step_1, step_7, step_8, step_9 |
| reg-consent-pdn | step_1, step_8, step_10, step_11, step_17 |
| reg-profile | step_1, step_9, step_10, step_15, step_16, step_20, step_21, step_25, step_26, step_31, step_32, step_33, step_37, step_38 |
| reg-start | step_6, step_8, step_10, step_16, step_19 |
| reminders | step_9 |
| staff-accept | step_6, step_9, step_11 |
| tg-router | step_15, step_22, step_26 (триггер — уже `KIbx…`) |

## Чек-лист готовности

- [x] [ADR-0042](../adr/0042-two-environments-one-repo.md) — модель сред
- [x] `catalog/environments.md` — карта сред
- [x] `docs/ARCHITECTURE.md` §Окружения, `docs/adr/README.md` — обновлены
- [ ] prod: все 72 шага перепривязаны `TZTl…` → `KIbx…`
- [ ] prod: 17 флоу опубликованы; живой прогон входа подтверждён
- [ ] prod: владелец задал в UI `BOT_TOKEN`, `QR_SIGNING_KEY`, `BOT_USERNAME`, `MINIAPP_URL`
- [ ] dev: очистка + пересборка графа из `flows/*.json` + каталога (вариант «а»), на `Events-QA-Bot`
- [ ] `catalog/environments.md` — id dev обновлены после пересборки
- [ ] `catalog/` совпадает с живым проектом (dev)
- [ ] независимое ревью

## Как проверено

- prod-падение `bKKe0P1y5KnKTrWTIwwhQ` — `ConnectionNotFound` на `step_15` (до фикса).
- скан живого prod (`ap_flow_structure includeInput`) — 72 шага, один мёртвый id.

## Журнал

- **2026-09-26** — пакет взят. Решения владельца: prod «as is» (копия), dev очищаем и
  пересобираем целиком (вариант «а» — новый граф, новые id). Скан мёртвых ссылок —
  двумя read-only агентами по живому prod.
- **2026-09-26** — обнаружено и подтверждено прогоном: `auth` на `callFlow` **не
  безвреден**, хотя у `callFlow` пропа `auth` нет — движок резолвит ссылку и валит шаг.
  Перепривязываем все 72 шага, включая `callFlow`.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- **До cutover dev может ещё обслуживать живую ссылку** (STATUS 0.6). Порядок:
  prod-хотфикс → cutover → очистка dev. Очистку dev не начинать раньше cutover.
- Mini App под prod (две сборки, `VITE_*`) — отдельный пакет после решения владельца.
