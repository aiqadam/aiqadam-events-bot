# W142. Рассылка: сегмент «согласие без регистрации» (`no_reg`) — обкатка на dev

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (расширение OWN-9; [ADR-0057](../adr/0057-broadcast-no-registration-segment.md))
- **Зависит от**: W135/[ADR-0054](../adr/0054-broadcast-register-instead-of-unsubscribe.md) — учтено
- **Начат**: 2026-10-09 · **Закрыт**: —

## Цель

Пятый сегмент рассылки `no_reg` — адресаты с `consent_marketing = true`, у которых
нет активной регистрации на событие рассылки. Превью и материализация считают одно
множество; кнопка «Зарегистрироваться» (ADR-0054) остаётся по адресату. Обкатка на
**dev**; prod — отдельным пакетом по [ADR-0042](../adr/0042-two-environments-one-repo.md).

Определение ([ADR-0057](../adr/0057-broadcast-no-registration-segment.md)):
consent-база (`consent_marketing = true`) минус те, у кого есть строка события со
`status = registered`. Отменившие (нет активной регистрации) — **включаются**.
`blocked_bot` исключается. Временнóго гейта нет (в отличие от `no_show`).

## Что построено

| Артефакт (dev) | ID / имя | Каталог |
|----------|----------|---------|
| flow `bcast-step` | `uQDds2PUMYH8Kc1mLhN15` · published `6w7wT7y3zsuP8qM7JMA6p` | [catalog/flows/bcast-step.md](../../catalog/flows/bcast-step.md) |
| flow `bcast-run` | `By03Fpx1pPqJTdaQlhYsQ` · published `uW3697fl9VtqGdecmMYUv` | [catalog/flows/bcast-run.md](../../catalog/flows/bcast-run.md) |
| поле `broadcasts.segment` | externalId `TwQYOml3ytGeQ5Mw1uGxg` · field id `epycnKJbADZ2aMxJ87zGA` | [catalog/tables/broadcasts.md](../../catalog/tables/broadcasts.md) |
| i18n `bcast.btn.seg_no_reg`, `bcast.segment.no_reg` | ru/uz/en | `i18n/*.json` |
| диагностический флоу `zz-w142-diag` | `8MjT3LxfN6PSw47T4yP36` (не удалять до вердикта ревью) | — |

Правки: `bcast-step` `step_7` (клавиатура + текст + карта `texts`), `step_14`
(список сегментов), `step_21` (превью); `bcast-run` `step_4` (список сегментов),
`step_13` (материализация). `step_9`/`step_23` в `bcast-step` переприбиты к
`@aiqadam/qadam-tables@0.5.1` ради записи нового externalId `segment`.

## Чек-лист готовности

> Скопирован из [BACKLOG.md](../BACKLOG.md#w142-рассылка-сегмент-согласие-без-регистрации-no_reg--обкатка-на-dev).

- [x] `broadcasts.segment` (dev) получает опцию `no_reg` (`STATIC_DROPDOWN`);
- [x] `bcast-step/step_7` — кнопка сегмента и строка перечня в тексте вопроса;
- [x] `bcast-step/step_14` — `no_reg` в списке допустимых сегментов;
- [x] `bcast-step/step_21` — ветка `no_reg` в подсчёте превью;
- [x] `bcast-run/step_4` — `no_reg` в списке допустимых сегментов;
- [x] `bcast-run/step_13` — та же ветка `no_reg` в материализации;
- [x] i18n ru/uz/en: `bcast.btn.seg_no_reg`, `bcast.segment.no_reg`;
- [x] `catalog/snippets/resolve-segment.md` — `no_reg` в `SEGMENTS` и в логике;
- [x] различающий прогон на dev (см. «Как проверено»);
- [x] `ap_validate_flow`, публикация, `flows/*.json` и `migrations` тем же PR;
- [x] `catalog/` совпадает; офлайн-проверки чисты;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- **Валидация/публикация:** `ap_validate_flow` ×2 → 0 invalid (`bcast-step` 60/60,
  `bcast-run` 55/55; предупреждения «PINNED VERSION UNAVAILABLE» по старым
  `tables@0.4.5` — известная гоча 24, не отказ). `ap_lock_and_publish` ×2 →
  `6w7wT7y3zsuP8qM7JMA6p` / `uW3697fl9VtqGdecmMYUv`.
- **Различающий прогон правила (диагностический флоу `zz-w142-diag`
  `8MjT3LxfN6PSw47T4yP36`, прогон `5tjyqArxs3J4pGgAFW8VE`):** дано consent-база
  `{1:consent,2:consent,3:consent,4:нет consent,6:consent+blocked}` и
  регистрации `{2:registered,5:registered}` (событие `e1`). `no_reg` вернул
  `members = ["1","3"]`, `count = 2` — зарегистрированный (2), без согласия (4) и
  заблокированный (6) исключены. Прогон `SUCCEEDED`.
- **Те же данные на всех ветках:** превью `bcast-step/step_21` и материал
  `bcast-run/step_13` несут идентичную логику `no_reg` (`consent_marketing` минус
  `registeredIds`, минус `blocked_bot`) — правило одно, как и для прочих сегментов.
- **Экспорт:** `ap_export_flow` ×2 (LOCKED) → `tools/export-flow-mcp.py` →
  `flows/bcast-step.json`, `flows/bcast-run.json`, `_manifest.json` (`source: mcp`).
- **Офлайн:** `check-texts.py` 305 ссылок/0, `check-commands.py` 0,
  `check-export-secrets.sh` чисто.

**Не проверено живьём:** e2e в Telegram dev-бота (создать рассылку с сегментом
«Не записались», сверить счётчик превью, кнопка «Зарегистрироваться») — за
владельцем; `ap_test_step` не годится (гоча 11).

## Журнал

- **2026-10-09** — пакет заведён по обращению владельца; обкатка на dev, prod —
  отдельно. Написан [ADR-0057](../adr/0057-broadcast-no-registration-segment.md),
  правлены SPEC OWN-9 (п. 5) и DATA-MODEL. Сняты точки правки: `bcast-step`
  `step_7/14/21`, `bcast-run` `step_4/13`, таблица `broadcasts`, i18n, snippet.
- **2026-10-09 — опция `STATIC_DROPDOWN` только пересозданием.** У поля
  `broadcasts.segment` опцию через MCP добавить нечем: `ap_manage_fields UPDATE`
  меняет только имя, не `options`; необъявленное значение сервер режет
  (`valueNotInOptions`). Пересоздание поля (`DELETE`+`ADD`) меняет и внутренний
  id, и **externalId**. Сделано: сняты 9 строк `segment`, поле пересоздано с
  пятью опциями (`TwQYOml3ytGeQ5Mw1uGxg`), значения строк восстановлены
  (`ap_update_record` ×9). Ссылки во флоу — `values`-ключи `step_9`/`step_23`.
- **2026-10-09 — пины `tables@0.4.5` блокируют `ap_update_step`.** Обновить input
  этих двух PIECE-шагов напрямую не вышло: `qadam_metadata_not_found` (пин
  `0.4.5` установке недоступен, гоча 24; CODE-шаги правились свободно). Ссылок на
  выходы `step_9`/`step_23` нет — пересозданы `ap_delete_step`+`ap_add_step`
  (ветка и имя `step_N` сохранились, новые взяли доступную `@aiqadam/qadam-tables@0.5.1`).
- **2026-10-09** — различающий прогон на `zz-w142-diag` (прогон
  `5tjyqArxs3J4pGgAFW8VE`) подтвердил правило; флоу оставлен до вердикта ревью.

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- **e2e в Telegram dev-бота** — за владельцем (создать рассылку `no_reg`, сверить
  превью и кнопку).
- `zz-w142-diag` не удалять до вердикта ревью.
- Перенос на prod — отдельным пакетом по [ADR-0042](../adr/0042-two-environments-one-repo.md).
- Вопрос «слать ли отменившим регистрацию» — оставлен как «включаем»; смена —
  фильтр в двух CODE-шагах, по итогам обкатки.
