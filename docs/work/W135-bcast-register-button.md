# W135. Рассылка: кнопка «Зарегистрироваться» вместо «Отписаться»

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W14 (рассылки), W43/W50 (регистрация) — ✅
- **Начат**: 2026-10-05 · **Закрыт**: —

## Цель

В массовом сообщении — не более одной инлайн-кнопки, по адресату:
«Зарегистрироваться» (`reg:go:<eventId>`, один тап → регистрация и билет) тому,
кто ещё не зарегистрирован и на кого регистрация открыта; иначе кнопки нет.
Кнопка «отписаться» из массовых сообщений снимается
([ADR-0054](../adr/0054-broadcast-register-instead-of-unsubscribe.md),
SPEC OWN-13).

## Решения владельца (2026-10-05)

- **Заменить полностью**: «отписаться» уходит из массовых сообщений; в описанном
  кейсе — «Зарегистрироваться», иначе кнопки нет. → правка SPEC OWN-13 + ADR-0054.
- **Один тап**: колбэк `reg:go:<eventId>`; при заполненном профиле и данном
  `consent_pdn` — регистрация и билет сразу (как финал повторного касания);
  иначе — существующий онбординг (согласие/профиль), потом билет.
- **Тест себе** — как получателю: та же кнопка по тем же правилам.
- **Условие** — правило «регистрация открыта» (`reg-start/step_3`,
  `reg-api/step_9`): `published`, `reg_deadline_at` не прошёл, места есть.
- **Проверять по получателю** в любом сегменте, а не выводить из сегмента.
- **Подпись**: `bcast.btn.register` = «Зарегистрироваться».

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| ADR | [0054](../adr/0054-broadcast-register-instead-of-unsubscribe.md) | — |
| SPEC | OWN-13 переписан | [SPEC.md](../SPEC.md) |
| flow `bcast-run` | `By03Fpx1pPqJTdaQlhYsQ` (v `358ZAaoHMNh6gppThgfQK`) | [catalog/flows/bcast-run.md](../../catalog/flows/bcast-run.md) |
| flow `bcast-step` | `uQDds2PUMYH8Kc1mLhN15` (v `vrzJFcrK1mO0jtxMUL1p8`) | [catalog/flows/bcast-step.md](../../catalog/flows/bcast-step.md) |
| flow `reg-start` | `furNEp5R3KFZ2jdSni2Eu` (v `gTi3MohEeu7fZ9Wcy01zU`) | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `tg-router` | `5rpOArwaUifCX6IYF4IEQ` (v `E9QmgGVf18ZwYR5FxZ04S`) | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `bcast-unsub` | удалён (`WVEZojRTZfntv22NA5geM`) | — |

Дизайн: кнопка собирается в `bcast-run/step_25` (CODE) по регистрациям
(`step_53`) и событию (`step_54`); `step_28`/`step_36` шлют `item.markup`.
Тест себе — `bcast-step/step_57`/`step_58`/`step_59` и `step_30`.
Регистрация — `reg-start` ветка `register_direct` (`step_21`→`step_22`),
зовётся из `tg-router` ветки `reg_go` (`step_19` ack → `step_28` callFlow).

## Чек-лист готовности

- [x] `bcast-run`: `reg:go:<eventId>` получателю без живой регистрации при
      открытой регистрации, иначе `reply_markup` пуст; условие по получателю
      (не по сегменту);
- [x] `bcast-step`: тест себе — та же кнопка по тем же правилам;
- [x] `tg-router` + касание регистрации: `reg:go:<eventId>` → один тап при
      профиле+`consent_pdn`, иначе онбординг; `consent_pdn` не обходится;
- [x] кнопка «отписаться» снята; `bcast:unsub:`/`bcast-unsub` выведены;
- [x] i18n (использован существующий `event.card.btn_register`; мёртвые
      `bcast.btn.unsubscribe`/`unsub.*` удалены из i18n и платформы);
      `check-texts.py`/`check-commands.py`/`check-export-secrets.sh` зелёные;
- [x] SPEC OWN-13, ADR-0054, каталог; `flows/*.json` и `migrations` тем же PR;
- [ ] `catalog/` совпадает с живым проектом (сверка на ревью);
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- `ap_validate_flow` всех четырёх правленых флоу: `0 invalid` (остаются
  предупреждения о `tables@0.4.5`, общие для проекта, — свежие прогоны
  `reg-start` от 30.09 успешны, пин исполняется; новые табличные шаги взяли
  актуальную версию `0.5.0`).
- `ap_validate_step_config` нового `bcast-run/step_25`: «Valid CODE configuration».
- Офлайн-проверки (pre-commit): `check-texts.py` — 30 флоу, 301 ссылка `$t`,
  0 расхождений; `check-commands.py` — 0 нарушений; `check-export-secrets.sh` —
  экспорт чист.
- Экспорт `flows/*.json` снят MCP сразу после публикаций
  (`export-flow-mcp.py`, `source: mcp`), манифест — 30 флоу без `bcast-unsub`.
- **Живые различающие прогоны — хвост.** Кнопка «Зарегистрироваться» появляется
  только в реальном массовом сообщении, а её нажатие — только колбэком из Telegram;
  честный e2e требует устройства владельца. `TESTING` на dev сломан (W133), а
  у `tables@0.4.5`-шагов `ap_update_step` отказывает (`qadam_metadata_not_found`),
  из-за чего правка свелась к добавлению новых шагов и CODE. Это предъявлено
  ревьюеру.

## Журнал

- **2026-10-05** — заведён пакет. Разведка живого проекта: кнопка отписки
  собирается в `bcast-run/step_25` (CODE «prep chunk», `unsubMarkup`, уходит
  в `step_28` и ретрай `step_36` — `/copyMessage`) и в `bcast-step/step_28`
  (CODE «test gate», уходит в `step_30`). Материализация `bcast-run/step_13`
  уже читает `regRecords`; target-строки флага регистрации не хранят.
  Правило «регистрация открыта» — `reg-start/step_3` и `reg-api/step_9`.
  Черновик всегда пишет `event_id` (`bcast-step/step_9`), для `all_consent`
  допускается отсутствие события в `bcast-run/step_4`.
- **2026-10-05** — платформенная гойча: `ap_update_step` по шагу, прибитому к
  `@aiqadam/qadam-tables@0.4.5`, падает `qadam_metadata_not_found` (метаданные
  0.4.5 на инсталляции больше не резолвятся), хотя прогоны этих шагов успешны.
  Поэтому **старые табличные шаги не трогались**: чтение регистраций/события
  вынесено в новые шаги (они берут актуальную версию `0.5.0`), а `step_25`/`step_28`
  (CODE) и шаги отправки (telegram 0.9.0) правились штатно. Кнопка «отписки»
  собиралась в `bcast-run/step_25` и `bcast-step/step_28`; новая кнопка — в тех же
  точках, но `reply_markup` берётся из item (per-recipient), а не одинаков для чанка.
- **2026-10-05** — `reg-start` получил вход `direct`: ветка `register_direct`
  (`step_21`/`step_22`) при заполненном профиле и `consent_pdn` пишет сессию
  `ob_register` и зовёт `reg-profile` (переиспользована ветка `finish_lite` —
  регистрация + билет), иначе падаем в существующие `register`/`onboard`. Так
  «один тап» не дублирует код окончания регистрации и не обходит согласие ПД.
- **2026-10-05** — `bcast-unsub` удалён: сначала строка `migrations` `delete`,
  затем `ap_delete_flow`; маршрут `bcast:unsub:` снят из `tg-router` (`bcast:*`
  целиком уходит в `bcast-step`, чужая команда тихо игнорируется). Мёртвые ключи
  удалены из i18n и платформенных переводов после публикации флоу.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Перенос на prod — после приёмки на dev (хотфикс ADR-0042).
- Живой e2e в Telegram — владелец.
