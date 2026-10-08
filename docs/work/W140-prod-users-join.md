# W140. Перенос W139 на prod: имена участников (узкий join `telegram_id in <idsCsv>`)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W139 (готов на dev) — ✅
- **Начат**: 2026-10-08 · **Закрыт**: —

## Цель

Перенести W139 (в prod `manage-api` имена участников ломались на 200+
пользователях: широкое чтение `users` с самодельным `limit: 200` в join)
с dev на prod отдельным хотфиксом. Решение владельца 2026-10-08: **только
W139**; W136 (гео-ветка `step_61..71`) на prod не тянем — отдельный хвост.
Правки — только через MCP `app-flow-events-prod`; канон — dev
([ADR-0042](../adr/0042-two-environments-one-repo.md)).

## Что построено

| Артефакт | dev-эталон (canon) | prod (куда переносим) |
|----------|--------------------|------------------------|
| flow `manage-api` | `pFtbgOP3U8sNFvP86Szli` (v `jFYwwKlM25d7xBjxIXiH5`) | `CcGPwuW4ws5hkcaOPerEG` (было `8wizdJdhiOYAg0ab23e6e` → стало `<NEW>`) |
| таблица `users` | `gyMqrk23KWlFQweY3qDU0` (внутр.) | те же id, что у dev (таблицы не пересобирались) |
| таблица `migrations` (prod) | — | `NCZNGuWh6PFs1JZXRPNTE` |
| connection | — | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |

`flows/*.json` и `catalog/flows/*.md` **не трогаем** — канон dev (ADR-0042);
prod-ids живут только в `catalog/environments.md`.

## Дрейф dev↔prod (предусловие)

prod `manage-api` — эпохи W132: в нём **нет W136** (гео-ветка `step_34..37`
вместо dev-овых `step_34..37` + `step_61..71`) и **нет W139**. При этом пять
целевых шагов prod (`step_40`/`step_45`/`step_49`/`step_50`/`step_52`)
**побайтово совпадают** с dev-pre-W139 (`columns`/`table_id`/`filters:{}`/
`limit:200`, `step_50.userRows = step_49`), поэтому дельта W139 ложится чисто
и в гео-ветку не заходит. Правка read-only (участники/поиск/контролёры/отзывы
только читают); i18n-ключей W139 не добавляет; Mini App не меняется.

**Баг на prod живой и различается без засева:** `users` на prod = **210**
строк (>200), поэтому и старая (wide `limit: 200`), и новая (узкий `in`) версии
дают разный результат прямо на боевых данных (на dev строк было 121 и
потребовался засев — см. W139).

## Чек-лист готовности

- [ ] нет `running`-рассылки на prod (предусловие); снапшот prod снят, `publishedVersionId` записан
- [ ] `step_45` ← dev-эталон (фильтр `telegram_id in {{step_72['output'].idsCsv}}`, `limit:500`) + новый `step_72` (CODE) после `step_44`
- [ ] `step_40` ← dev + новый `step_73` (CODE) после `step_39`
- [ ] `step_52` ← dev + новый `step_74` (CODE) после `step_19`
- [ ] `step_49` → чтение `registrations` события + `step_75` (CODE) после `step_49` + `step_76` (чтение `users`) после `step_48` + `step_50.userRows = {{step_76['output']}}`
- [ ] `ap_validate_flow` — 0 `invalid`; read-back живой структуры
- [ ] publish; строка `migrations` на **prod** формата `YYYY-MM-DD-W140-NN`
- [ ] `catalog/environments.md` обновлён (W140 применён; prod `publishedVersionId`)
- [ ] независимое ревью, вердикт «замечаний нет»

## Детали исполнения

Порядок (правки одного флоу строго последовательны, гоча 16; вложенные
`input`/`filters` — целиком, гоча 12; вставка `AFTER` на шаг с потомком —
линейный сплайс, готачи 10/17):

1. `step_45` (`ap_update_step`, полный `input` = dev): `filters` =
   `telegram_id in {{step_72['output'].idsCsv}}`, `limit: 500`; затем
   `ap_add_step` `step_72` (CODE, `regRows={{step_44['output']}}`,
   `logInput:false`, `logOutput:false`) — AFTER `step_44`.
2. `step_40` ← dev (фильтр от `step_73`); `step_73` (CODE:
   `regRows={{step_38['output']}}`, `staffRows={{step_39['output']}}`) AFTER
   `step_39`.
3. `step_52` ← dev (фильтр от `step_74`); `step_74` (CODE:
   `staffRows={{step_19['output']}}`) AFTER `step_19`.
4. `step_49` ← чтение `registrations` события (таблица
   `SM8tMxfQuQCHRDdAiNJyQ`, колонка `mVfpZFCwAZskWXNT7iCuI`, фильтр
   `event_id eq {{step_5['output'].eventId}}`, `limit:200`); `step_75` (CODE:
   `regRows={{step_49['output']}}`) AFTER `step_49`; `step_76` (tables read
   `users`, фильтр от `step_75`, `logOutput:false`) AFTER `step_48`;
   `step_50.input.userRows = {{step_76['output']}}` (полный input).
5. `ap_validate_flow` → read-back (`ap_flow_structure`) → `ap_lock_and_publish`.

`sourceCode`/`input` новых и правленых шагов берём из dev-эталона
`flows/manage-api.json`. На prod **не запускать** `ap_test_step`/`ap_test_flow`
(гоча 11).

Новый tables-шаг `step_76` на prod получит верхний доступный пин `tables`
(existing tables-шаги prod — `0.4.5`; формат входа совместим, как в W137).

Откат: по снапшоту (`ap_export_flow`, версия `8wizdJdhiOYAg0ab23e6e`) —
вернуть 5 `input`'ов + `ap_delete_step` ×5 + повторная публикация; снапшот
держать до вердикта ревью (MCP не умеет revert к версии).

## Как проверено

- <заполняется по ходу>

## Журнал

- **2026-10-08** — пакет заведён по решению владельца (план согласован:
  только W139; старт сразу). Разведка prod через MCP `app-flow-events-prod`:
  `manage-api` `CcGPwuW4ws5hkcaOPerEG`, published `8wizdJdhiOYAg0ab23e6e`
  (2026-10-03), живые прогоны идут (`SUCCEEDED`); `users` = 210 (>200),
  `registrations` = 60, `events` = 3 — баг воспроизводится на боевых данных.
  `running`-рассылок нет. Снапшот prod снят в
  `~/qadam-snapshots/w140/prod-manage-api-8wizdJdhiOYAg0ab23e6e.json`.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: <агент> · **Дата**: YYYY-MM-DD · **Вердикт**: —

## Хвосты и блокеры

- живой сквозной прогон Mini App на prod («Участники» с именами) — на владельце;
- W136 на prod (гео-ветка `step_61..71`) — отдельный хвост, в этот пакет не входит (решение владельца 2026-10-08);
- `tools/check-migrations.py` по prod — известный хвост (нет ключа платформы), как в W134/W137.
