# W134. Перенос W133 на prod: имя текстом без кнопки (хотфикс ADR-0042)

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W133 (готов на dev) — ✅
- **Начат**: 2026-10-03 · **Закрыт**: 2026-10-03

## Цель

Перенести фикс W133 (петля `ob_name`) с dev на prod отдельным пакетом. Бот живой — только CODE-правки, строго последовательно, без тестовых прогонов с побочками.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `tg-router` (prod) | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `reg-profile` (prod) | `5U3Kv0cSrnvDTrbictA4L` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |

## Чек-лист готовности

- [ ] сверка dev↔prod до правки зафиксирована (расходится только W133, два шага)
- [ ] prod `tg-router/step_10`: текст при `sessionStep = ob_name` ведёт в `reg_profile`, остальное без изменений
- [ ] prod `reg-profile/step_3`: текст на `ob_name` возвращает `text_name`, остальное без изменений
- [ ] `ap_validate_step_config` обоих кодов до применения + `ap_read_step_code` read-back после
- [ ] локальная матрица логики (позитив + мусор + регресс W73-меню)
- [ ] `ap_validate_flow` обоих флоу, публикации prod, строки `migrations` prod
- [ ] `catalog/` совпадает (логика общая по ADR-0042 — правок карточек не требуется сверх W133)
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

- сверка до правки: prod `tg-router/step_10` и `reg-profile/step_3` — дословно dev до W133 (нет `obTextStep`, нет `ob_name → text_name`); остальной код идентичен dev;
- `ap_validate_step_config` (CODE) обоих новых кодов до применения — valid 2/2;
- правки строго последовательно (гоча 16): сначала callee `reg-profile/step_3`, затем caller `tg-router/step_10`;
- `ap_read_step_code` после каждого `ap_update_step` — оба шага лежат побайтово как отправлено (ханки W133 на месте, входы шагов не тронуты, усечений нет);
- логическая матрица на точных копиях кода (`node`, 10 кейсов, все PASS): текст на `ob_name` → `reg_profile` + `text_name` (фикс); текст на `ob_await_name`/`ob_await_work`/`ob_await_city`, колбэки `ob:fixname`/`ob:lang`/`ob:city`, меню-фолбэк W73 на `ob_consent` и без сессии — как раньше;
- `ap_validate_flow` prod: `reg-profile` 40/40 valid, `tg-router` 28/28 valid;
- публикации prod по одной (callee→caller): `reg-profile`, затем `tg-router` — обе `published and enabled`;
- живой трафик после публикаций: последние 10 прогонов prod `tg-router` — все SUCCEEDED, 1.3–2.1 с (норма, без FAILED);
- табличные шаги не тронуты (пины tables на prod живые — предупреждений нет); переводы не тронуты (новых ключей нет); `flows/*.json` не тронуты (канон — dev, ADR-0042);
- офлайн-проверки: `check-texts.py` — 0 расхождений, `check-commands.py` — 0 нарушений, `check-export-secrets.sh` — чисто.

## Журнал

- **2026-10-03** — пакет взят по просьбе владельца («накатить на prod отдельным пакетом, ботом могут пользоваться»). Сверка: prod `tg-router/step_10` и `reg-profile/step_3` — дословно dev до W133 (нет `obTextStep` / `ob_name → text_name`). Пины tables на prod живые (предупреждений нет, в отличие от dev) — табличные шаги не трогаем вообще, только два CODE-шага. План деликатности: правки строго последовательно (гоча 16), сначала `reg-profile` (callee), затем `tg-router` (caller); между ними `validate`; публикация каждой — сразу `read-back`; никаких `ap_test_step`/`ap_test_flow` на prod (флоу шлют сообщения); smoke — только чтением структур, живой e2e — хвост на владельца.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: review-agent · **Дата**: 2026-10-03 · **Вердикт**: замечаний нет

Проверено живым проектом через MCP `app-flow-events-prod` (слову владельца не верил):

- `ap_flow_structure` обоих флоу: `tg-router` (28 шагов) и `reg-profile` (40 шагов) —
  все `configured`, ни одного `invalid`/заглушки; состав шагов совпадает с каталогом;
  оба флоу `ENABLED | published`; auth — ссылки `{{connections[...]}}`, табличные
  шаги с `key_columns`/`eventIdOrNone`-фильтрами на месте, не тронуты;
- `ap_read_step_code` обоих шагов против dev-эталона (`app-flow-events-dev`:
  `5rpOArwaUifCX6IYF4IEQ/step_10`, `bEz2bKyL82zlIwckxqvxc/step_3`) — код и входы
  совпадают дословно, включая комментарии W133: `obTextStep = starts(sessionStep,
  'ob_await_') || sessionStep === 'ob_name'` в роутере и
  `if (step === 'ob_await_name' || step === 'ob_name') return out('text_name')`
  в `reg-profile`. Диф против состояния до пакета — только ханк W133;
- оба шага — чистые функции (ветвление + эвристика имени, ни сетевых вызовов,
  ни записи в БД);
- `ap_validate_flow`: `reg-profile` 40/40 valid, `tg-router` 28/28 valid;
- прогоны prod: последние 10 `tg-router` — все SUCCEEDED (1.3–2.1 с);
  FAILED по `tg-router` — только старые (26.09, 24.09, 13.09, все до публикаций),
  после публикаций 03.10 отказов нет; последние 10 `reg-profile` — все SUCCEEDED;
- каталог: `tg-router.md` (п. 8–9 контракта, W133) и `reg-profile.md` (шаг `step_3`,
  заметка W133) уже описывают новую логику, расхождений с живым prod нет;
  Flow ID в карточках — dev-канон по ADR-0042, `flows/*.json` не тронуты — верно;
- офлайн-проверки прогнаны самому: `check-texts.py` — 305 ссылок, 0 расхождений;
  `check-commands.py` — 0 нарушений; `check-export-secrets.sh` — чисто;
- AppSec: авторизация не менялась (маршрут по-прежнему требует активную сессию
  `registration` + шаг `ob_name`/`ob_await_*`, новых входов из непроверенных
  источников нет); инъекции — путь `text_name` переиспользует валидацию кнопочного
  пути, рендер идёт через `esc()` в `step_4` (проверено чтением кода prod `step_4`,
  все пользовательские данные экранируются); криптография/утечки/устойчивость —
  не относится (шаги не тронуты, новых внешних вызовов нет).
- Не проверено: сверка `migrations` ↔ prod через `tools/check-migrations.py` —
  нет ключа платформы (системный хвост на W15, как у других пакетов; в журнале
  отмечен). Живой e2e в Telegram — хвост на владельце, отмечен в журнале.

### Замечания

- нет

## Хвосты и блокеры

- живой e2e в Telegram на prod — на владельца;
- `tools/check-migrations.py` по prod — нужен ключ платформы (иначе хвост на W15, как у других пакетов).
