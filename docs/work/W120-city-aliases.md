# W120. Снять алиасы `ob:city:Tashkent/Almaty/write`

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W119 (готов)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Убрать обратную совместимость со старыми кнопками города, заведённую W119 «на
один релиз»: в `reg-profile/step_3` остаются только `ob:city:yes`/`ob:city:no`,
мёртвый ключ `onb.btn.write` уходит из входов `step_4`, каталог и ADR-0046
больше не называют алиасы живыми.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` (версия `9T98glHpVp81w44xff36q`) | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

Изменено ровно: `step_3.sourceCode` (ветка `city:*` — только `yes`/`no`),
`step_4.texts` (убран `onb.btn.write`, 38→37 ключей). Документы: каталог,
ADR-0046 (обновление п. 4), BACKLOG/STATUS. `i18n/*.json` не тронуты —
`onb.btn.write` остаётся архивом корпуса (ADR-0046).

## Чек-лист готовности

- [x] в `reg-profile/step_3` остались только `ob:city:yes`/`ob:city:no`;
- [x] `catalog/flows/reg-profile.md` и `docs/adr/0046-…` больше не называют
      алиасы живыми;
- [x] различающий прогон: `ob:city:Tashkent` → `ignore` (алиаса нет);
- [x] `catalog/` совпадает с живым проектом;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

Различающие прогоны MCP на `events-dev`, `ap_test_step` по `step_3` с
обёрткой `{"data": {...}}` (гоча №13), `sessionDraft` со `step:"ob_city"`,
синтетические `telegram_id` 888888911–915:

| Вход (`callbackData`) | Прогон | `step_3.action` |
|---|---|---|
| `ob:city:Tashkent` | `WRMCSLYTQZ6nSjWfNI8ZD` | `ignore` |
| `ob:city:Almaty` | `oMty4qXoa4yXLsa2FNAje` | `ignore` |
| `ob:city:write` | `m8o3nYkTjsaz0cpufAbZj` | `ignore` |
| `ob:city:yes` | `iSWDlt4xRhpo85dwK5lDg` | `finish`, `city: 'Ташкент'` |
| `ob:city:no` | `PZojBimTJT1EFGxBTvGhT` | `show_ask_city` |

- **Живой экспорт.** `ap_export_flow` (после `ap_lock_and_publish`) отдал
  `flows[0].id = 9T98glHpVp81w44xff36q`, `state: LOCKED`; нормализованный снимок
  записан `tools/export-flow-mcp.py` в `flows/reg-profile.json`, диф к базе —
  ровно снятые алиасы в `step_3` и строка `onb.btn.write` в `step_4.texts`.
- **Валидация.** `ap_validate_flow` — 40/40 valid.
- **Офлайн.** `check-texts.py` — 0 расхождений; `check-commands.py` — 0;
  `check-export-secrets.sh` — чисто; `check-agents.py` — 0;
  `prototypes/check.mjs` — OK (6 прежних предупреждений `ask-name`/`user-name`).

## Журнал

- **2026-09-28** — `step_3` правился целиком через `sourceCode` (гоча №16:
  частичный код усекает шаг), `step_4.texts` — **всей картой** (гоча №12:
  частичный `input` заменяет вложенный объект, а не мержит). После правок —
  `ap_validate_flow`, затем `ap_test_step` (5 различающих), затем
  `ap_lock_and_publish` и экспорт **сразу** после публикации (гоча №14).
- **2026-09-28** — по ревью W119 алиасы жили «на один релиз»; снятие сделано
  отдельным пакетом, без правки `i18n` (архив) и без касания `reg-start`/`menu`
  (город живёт только в `reg-profile`).
- **2026-09-28** — события тестовых прогонов (синтетические `telegram_id`)
  проверены и удалены из `users`/`sessions`/`registrations`.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Перенос на prod — отдельным хотфиксом (ADR-0042), как и W119.
- Живой прогон в Telegram — за владельцем.
