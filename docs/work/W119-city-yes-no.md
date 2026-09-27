# W119. Город в онбординге: «Вы из Ташкента?» вместо списка городов

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W107 / ADR-0043 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: —

## Цель

Городской шаг онбординга (`reg-profile`) спрашивает да/нет вместо списка
городов: «Вы из Ташкента?» кнопками «Да»/«Нет», на «Нет» — свободный ввод
города. Решение — [ADR-0046](../../docs/adr/0046-city-question-yes-no-tashkent.md),
ТЗ — правка [SPEC PAR-8](../../docs/SPEC.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| ADR | [0046](../../docs/adr/0046-city-question-yes-no-tashkent.md) | — |
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w119-город-в-онбординге-вы-из-ташкента-вместо-списка-городов).

- [x] `reg-profile/step_4`: карточка города — `onb.ask_city` («Вы из Ташкента?»)
      с кнопками `common.btn.yes`/`common.btn.no` → `ob:city:yes`/`ob:city:no`;
- [x] `reg-profile/step_3`: `ob:city:yes` → `finish` с городом `Ташкент`;
      `ob:city:no` → `show_ask_city` → `ob_await_city` → текст-город → `finish`;
      старые `ob:city:Tashkent/Almaty/write` — алиасы на один релиз;
- [x] тексты `onb.ask_city` (ru/uz/en) и новый `onb.ask_city_input` импортированы
      в платформенные переводы до публикации (плюс `common.btn.yes`/`common.btn.no`);
- [x] различающие прогоны: «Да» → `finish`/`finish_no_event` с `Ташкент`,
      «Нет» → карточка ввода → текст → `finish` с городом;
- [x] SPEC PAR-8, ADR-0046, `catalog/flows/reg-profile.md` и прототип
      синхронизированы;
- [x] `tools/check-texts.py`, `check-commands.py`, `check-export-secrets.sh`,
      `prototypes/check.mjs` — зелёные;
- [x] `catalog/` совпадает с живым проектом;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

Различающие прогоны MCP на `events-dev` (обёртка `{"data":{...}}`, гоча №13),
тестовые `telegram_id` 888888901–906, диагностические строки `users`/`sessions`
удалены после проверки, `registrations` по ним пуста.

1. `step_3`, `ob:city:yes`, `draft.step=ob_city` (`keCdqCVSRJNB3H9OKm6hY`) →
   `action:'finish'`, `city:'Ташкент'`.
2. Полный прогон, `ob:city:yes`, `eventId:''` (`EqG6L9AkNpKaqgUgmJZGo`) →
   `step_4 writeKind:'finish_no_event'`, `profile.city:'Ташкент'`; ROUTER —
   ветка `finish_no_event`; `step_35` записал `users` (`city='Ташкент'`,
   `consent_pdn=true`, `lang='ru'`, `profile_completed_at`), `step_36` — сессию
   `await_marketing`; отправки дали `400 chat not found` (синтетический чат) —
   ожидаемо, после записи.
3. `step_3`, `ob:city:no` (`WEoHwrF55foiFEeTepXnB`) → `action:'show_ask_city'`.
4. Полный прогон, `ob:city:no` (`RgDb3WiVlmFOL6nFNul74`) → `step_4
   writeKind:'card'`, `cardText:'Напишите ваш город.'` (`onb.ask_city_input`),
   `nextStep:'ob_await_city'`; сессия — шаг `ob_await_city`.
5. Полный прогон, текст `Бишкек`, `draft.step=ob_await_city`
   (`lSNyOVVlpczchgMVZDuEI`) → `step_3 action:'finish'`, `city:'Бишкек'`;
   `step_4 finish_no_event`; `users.city='Бишкек'`.
6. Алиас `ob:city:write` (`RYzDMU9OFKx8FdkqMuAK9`) → `show_ask_city` (обратная
   совместимость старой карточки).

**Гоча тестирования:** `ap_test_step` по `step_4` возвращал `writeKind:'ignore'`
(`obWXgrnUYzWepy8ee5VRr`, `jI778NLR0WsqgfOKti8di`), хотя отдельный прогон
`step_3` давал `finish` — инструмент брал сохранённый sample выхода `step_3`, а
не свежий. Доказательство маршрута — только полные `ap_test_flow` (пп. 2, 4, 5);
`ap_test_step` на downstream-шаге для флоу с ветвлением не показателен.

**Офлайн:** `check-texts.py` — 31 флоу / 286 ссылок `$t` / 0; `check-commands.py`
— 0; `check-export-secrets.sh` — чисто; `check-agents.py` — 0;
`prototypes/check.mjs` — OK (6 предупреждений `ask-name`/`user-name` — прежние,
не от этой правки).

**Публикация и экспорт:** `ap_validate_flow` — 40/40 valid; `ap_lock_and_publish`
→ версия `2VZri7RTv01XC0yZLB0so` (LOCKED); экспорт MCP
(`tools/export-flow-mcp.py`) обновил `flows/reg-profile.json` и
`flows/_manifest.json`; строка `migrations` `2026-09-27-w119-01`.

## Журнал

- **2026-09-27** — Пакет взят по прямому запросу владельца (предложение в чате,
  без предварительного пакета BACKLOG — как W107). Решение — ADR-0046;
  городской шаг ADR-0043 уточнён, остальное не трогается.
- **2026-09-27** — Реализация на dev: `reg-profile/step_3` (маршрут `ob:city:*`),
  `step_4` (карточка да/нет + `onb.ask_city_input`), `i18n/{ru,uz,en}.json`,
  платформенные переводы (`onb.ask_city` обновлён; добавлены `onb.ask_city_input`,
  `common.btn.yes`, `common.btn.no` — их на платформе не было, хотя ключи есть в
  корпусе). Старые `ob:city:Tashkent`/`Almaty`/`write` оставлены алиасами: карточка,
  отправленная до правки, может ещё лежать в переписке, а необработанный колбэк дал
  бы молчание. `onb.btn.write` стал архивным ключом (в `i18n` оставлен, как
  `onb.review`).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Перенос на prod — отдельным хотфиксом (ADR-0042).
- Живой прогон в Telegram — за владельцем.
