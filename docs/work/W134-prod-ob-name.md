# W134. Перенос W133 на prod: имя текстом без кнопки (хотфикс ADR-0042)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W133 (готов на dev) — ✅
- **Начат**: 2026-10-03 · **Закрыт**: —

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

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

- нет

## Хвосты и блокеры

- живой e2e в Telegram на prod — на владельца;
- `tools/check-migrations.py` по prod — нужен ключ платформы (иначе хвост на W15, как у других пакетов).
