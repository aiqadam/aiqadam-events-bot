# W142. Рассылка: сегмент «согласие без регистрации» (`no_reg`) — обкатка на dev

- **Статус**: в работе
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
| flow `bcast-step` | `uQDds2PUMYH8Kc1mLhN15` | [catalog/flows/bcast-step.md](../../catalog/flows/bcast-step.md) |
| flow `bcast-run` | `By03Fpx1pPqJTdaQlhYsQ` | [catalog/flows/bcast-run.md](../../catalog/flows/bcast-run.md) |
| таблица `broadcasts` | `XrygYF5Q4EUOKkaBFallb` | [catalog/tables/broadcasts.md](../../catalog/tables/broadcasts.md) |

## Чек-лист готовности

> Скопирован из [BACKLOG.md](../BACKLOG.md#w142-рассылка-сегмент-согласие-без-регистрации-no_reg--обкатка-на-dev).

- [ ] `broadcasts.segment` (dev) получает опцию `no_reg` (`STATIC_DROPDOWN`);
- [ ] `bcast-step/step_7` — кнопка сегмента и строка перечня в тексте вопроса;
- [ ] `bcast-step/step_14` — `no_reg` в списке допустимых сегментов;
- [ ] `bcast-step/step_21` — ветка `no_reg` в подсчёте превью;
- [ ] `bcast-run/step_4` — `no_reg` в списке допустимых сегментов;
- [ ] `bcast-run/step_13` — та же ветка `no_reg` в материализации;
- [ ] i18n ru/uz/en: `bcast.btn.seg_no_reg`, `bcast.segment.no_reg`;
- [ ] `catalog/snippets/resolve-segment.md` — `no_reg` в `SEGMENTS` и в логике;
- [ ] различающий прогон на dev (см. «Как проверено»);
- [ ] `ap_validate_flow`, публикация, `flows/*.json` и `migrations` тем же PR;
- [ ] `catalog/` совпадает; офлайн-проверки чисты;
- [ ] независимое ревью, вердикт «замечаний нет».

## План работ

1. **Документы** (этот коммит): ADR-0057, SPEC OWN-9 п. 5, DATA-MODEL,
   BACKLOG W142, журнал, STATUS.
2. **i18n**: добавить `bcast.btn.seg_no_reg` («Не записались»),
   `bcast.segment.no_reg` («Согласились, но не записались») в `i18n/{ru,uz,en}.json`;
   импорт переводов на инстанс **до** публикации флоу (I18N-2,
   `TranslationKeyNotFoundError` иначе валит шаг) — `ap_upsert_translations`.
3. **Таблица**: `ap_manage_fields` не меняет опции `STATIC_DROPDOWN`
   существующего поля; опция добавляется пересозданием поля
   (`ap_delete` поля + `ap_add` с тем же именем) — проверить, что значения
   существующих строк (`all_consent/registered/attended/no_show`) не пострадают;
   иначе — правка через UI владельцем. **Проверить поведение до правки** (риск
   потери значений). Если пересоздание опасно — вариант: сегмент не хранить
   опцией, а валидировать кодом (но OWN-9/каталог ждут опцию) → решить по факту.
4. **`bcast-step`** (последовательно, [гоча 16](../AGENTS.md)):
   `step_7` (клавиатура + текст), `step_14` (список сегментов),
   `step_21` (превью для `no_reg`).
5. **`bcast-run`**: `step_4` (список сегментов), `step_13` (материализация).
6. **Snippet** `catalog/snippets/resolve-segment.md` — синхронизировать.
7. **Проверка** (см. ниже) → `ap_validate_flow` → публикация → экспорт
   `flows/*.json` → каталоги → `migrations` (`2026-10-09-w142-*`).
8. Commit feature-ветка → PR → независимое ревью.

**Ключевые факты для правок (сняты с dev):**

- `bcast-step/step_2` (parse callback) не ограничивает charset сегмента —
  `no_reg` проходит (нужно только `arg != ''`).
- `step_14` — гейт сегмента (`SEGVALID`) и контекст (`creatorOk`);
- `step_21` — превью; получает `consentRecords` (`step_20`, `consent_marketing = true`,
  `limit 500`) и `regRecords` (`step_17`, `status = registered`) — обоих хватает
  для `no_reg` = consent − registered;
- `bcast-run/step_4` — гейт фазы (список сегментов + `no_show`-время);
- `bcast-run/step_13` — материализация; получает `consentRecords` (`step_10`) и
  `regRecords` (`step_9`) — симметрично превью;
- `registered` в обоих флоу берётся как `status = registered`, поэтому
  `no_reg` + `registered` = consent-база (без пересечения).

## Как проверено

> Заполняется по ходу. Ниже — план различающих проверок (юнит-тестов в проекте нет).

- **правило сегмента (главная проверка):** на dev-данных сегмент `no_reg`
  показывает только незарегистрированных с согласием; зарегистрированный в него
  не попадает — превью и материализация дают одно и то же число;
- **отменивший** (строка `status = cancelled`) — попадает; **заблокировавший**
  (`blocked_bot = true`) — исключён;
- **гейты целы:** `test_sent_at`-требование до отправки (OWN-10), кнопка
  «Зарегистрироваться» по адресату (ADR-0054) для незарегистрированного
  получателя, `no_show`-замок не задет;
- офлайн: `check-texts.py`, `check-commands.py`, `check-export-secrets.sh`.

## Журнал

- **2026-10-09** — пакет заведён по обращению владельца; обкатка на dev, prod —
  отдельно. Написан [ADR-0057](../adr/0057-broadcast-no-registration-segment.md),
  правлен SPEC OWN-9 (п. 5) и DATA-MODEL. Сняты точки правки: `bcast-step`
  `step_7/14/21`, `bcast-run` `step_4/13`, таблица `broadcasts`, i18n, snippet.

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Opció `no_reg` у `STATIC_DROPDOWN broadcast.segment` — способ добавления
  (пересоздание поля vs UI) решается по факту, см. план п. 3.
- Вопрос «слать ли отменившим регистрацию» — оставлен как «включаем»;
  смена — фильтр в двух CODE-шагах, по итогам обкатки.
