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

### Ревью (круг 1)

- **Ревьюер**: независимый агент-ревьюер (opencode, `deepseek-v4.1-flash`) ·
  **Дата**: 2026-10-09 · **Вердикт**: есть замечания (1 `важно`, 1 `на будущее`;
  блокеров нет)

#### Что проверено (живой dev через MCP `app-flow-events-dev` + репозиторий)

- **Валидация.** `ap_validate_flow` ×2: `bcast-step` 60/60 valid, `bcast-run`
  55/55 valid, **0 invalid**. Предупреждения «PINNED VERSION UNAVAILABLE» по
  `tables@0.4.5` (гоча 24) — не отказ; `step_9`/`step_23` в списке недоступных
  пинов **отсутствуют** — обе на `@aiqadam/qadam-tables@0.5.1` (подтверждено
  структурой и экспортом).
- **Порядок веток.** `bcast-step`: `step_9` — parent `step_8`, branch 0 `ok`,
  `step_10` — after parent `step_9`; `step_23` — parent `step_22`, branch 0 `ok`,
  `step_24` — after parent `step_23`. Порядок сохранён.
- **CODE-шаги** (`ap_read_step_code` ×5), побайтово совпали с `flows/*.json`:
  - `bcast-step/step_7` — `kb` из 5 кнопок сегментов (`registered`, `attended`,
    `no_show`, `all_consent`, `no_reg`) + `cancel`; текст перечня из 5 строк;
    карта `texts` несёт `bcast.btn.seg_no_reg` и `bcast.segment.no_reg`;
  - `bcast-step/step_14` — `segValid` включает `no_reg`;
  - `bcast-step/step_21` — ветка `no_reg`: consent-база (`consent_marketing=true`,
    `telegram_id != ''`) минус `registeredIds` (строки события со
    `status=registered`), плюс исключение `blocked_bot`; отменившие (нет активной
    регистрации) включаются — совпадает с ADR-0057;
  - `bcast-run/step_4` — `no_reg` в белом списке сегментов; для `no_reg` событие
    обязательно (`!ev && seg !== 'all_consent'` → stop);
  - `bcast-run/step_13` — та же ветка `no_reg` (consent-база минус
    `registeredIds`, минус `blocked`).
  Правило превью (`step_21`) и материализации (`step_13`) **идентично**
  (различия — только имена локальных переменных `members`/`ids`,
  `attendedIds`/`attended` и взаимный порядок не связанных веток
  `attended`/`no_show`); дедуп `seen` и финальный `!blocked` есть в обеих.
- **Экспорт.** `ap_export_flow` ×2 → `flows[0].id` = `6w7wT7y3zsuP8qM7JMA6p`
  (`bcast-step`) и `uW3697fl9VtqGdecmMYUv` (`bcast-run`), `state: LOCKED`,
  `valid: true`. Прогнал живой ответ через нормализацию `tools/export-flow-mcp.py`
  (`walk` + `DROP_*`) — **побайтово совпал** с `flows/bcast-step.json` и
  `flows/bcast-run.json`; `_manifest.json` совпал (`source: mcp`,
  `publishedVersionId` те же). `ap_list_flows` — 30 published-флоу, состав
  манифеста (30) совпал; `zz-w142-diag` — DISABLED/draft, в манифест не входит.
- **Таблица.** `broadcasts.segment` (`ap_list_tables`) — поле
  `epycnKJbADZ2aMxJ87zGA`, опции `all_consent`/`registered`/`attended`/`no_show`/
  `no_reg`. `ap_find_records` по 9 строкам: `registered` ×5, `all_consent` ×4 —
  прежние значения восстановлены. `catalog/tables/broadcasts.md` и
  `catalog/tables/README.md` описывают ровно это (externalId
  `TwQYOml3ytGeQ5Mw1uGxg`, field id `epycnKJbADZ2aMxJ87zGA`).
- **migrations (dev `NCZNGuWh6PFs1JZXRPNTE`).** Ровно 3 строки
  `2026-10-09-w142-01…03`: `-01` `publish` `flow:bcast-step` `6w7w…`, `-02`
  `publish` `flow:bcast-run` `uW36…`, `-03` `update` `table:broadcasts`,
  `commit 959dac3`; строк с `applied_at` позже нет, строк с `package=W142` иных
  нет. Версии совпали с живыми.
- **Различающий прогон.** `ap_get_run` `5tjyqArxs3J4pGgAFW8VE` (TESTING,
  SUCCEEDED): consent-база `{1,2,3}` + `4` без согласия + `6` consent+blocked,
  регистрации `{2:registered, 5:registered}`; `no_reg` → `members ["1","3"]`,
  `count 2` — зарегистрированный (2), без согласия (4), заблокированный (6)
  исключены, незарегистрированные с согласием (1,3) включены. Прогон —
  **различающий** (в одном входе и включения, и исключения по всем четырём
  условиям). Код диагностического шага сверен с фактическими `step_21`/`step_13`
  и несёт то же правило.
- **Инварианты и AppSec.** PAR-2: `no_reg` строится на `consent_marketing=true`,
  без согласия не шлёт (подтверждено различающим прогоном и чтением кода). OWN-12:
  `blocked_bot` исключён в обеих копиях (и через карту `blocked`, и явно в
  фильтре). Авторизация/IDOR не затронуты: `step_21` по-прежнему требует
  `created_by == sender` и staff-доступ к чаптеру, `step_7` — статус события +
  staff; `bcast-run` вызывается только после гейтов `bcast-step`. Секретов в
  экспорте нет (`auth` — ссылки, значения variables — только `{{variables[…]}}`).
- **Репозиторий.** `git diff main --stat` — 18 файлов, ровно ожидаемый набор;
  `git grep`/Grep по `6rmHz7Lc1djdjFpjAmO5V` (старый externalId `segment`) — **0
  совпадений** в репозитории. `catalog/flows/bcast-step.md`,
  `catalog/flows/bcast-run.md`, `catalog/tables/{broadcasts,README}.md` сверены с
  живыми структурами — совпадают. `docs/SPEC.md` OWN-9 п.5, `docs/DATA-MODEL.md`,
  `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/adr/0057-*`, `docs/adr/README.md`
  на месте.
- **Офлайн.** `check-texts.py i18n/ru.json flows/*.json` — 305 ссылок, 0
  расхождений; `check-commands.py i18n/*.json flows/*.json` — 0 нарушений;
  `check-export-secrets.sh` — rc=0; `check-agents.py` — 0.
- **Не проверено живьём:** платформенные переводы (`ap_list_translations` в
  наборе MCP-инструментов не экспонируется; MCP-ресурсов сервер не отдаёт) —
  проверены только `i18n/*.json` и `check-texts.py`; e2e в Telegram dev-бота —
  за владельцем (гейт перед `готов`), как и указано в журнале.

#### Замечания

1. **важно** — `catalog/snippets/resolve-segment.md` объявляет «Встраивают:
   `bcast-step/step_21`, `bcast-run/step_13`», но **ни один из этих шагов не
   совпадает с эталоном побайтово**: в эталоне — шесть шагов и входы
   `inputs.consentUsers`/`inputs.registrations`/`inputs.blockedUsers`, возврат
   `{allowed, reason, recipients, blockedExcluded, …}`; в живых шагах — один
   CODE-шаг с входами `consentRecords`/`regRecords`/`usersByIdsRecords` и
   возвратом `{verdict, count, text, replyMarkup}` (шаг `step_14` и вовсе без
   эталонного аналога). По `catalog/snippets/README.md` (правило 1) копия обязана
   совпадать с эталоном побайтово, механическая сверка — блок 2a чек-листа
   ревьюера; здесь она невозможна. Плюс прямое противоречие: тот же
   `catalog/snippets/README.md` (W142 его не трогал) по-прежнему пишет
   «*resolve-segment — по-прежнему не встроен никем, ждёт W14*». Расхождение
   `no_reg` в эталоне и в копиях пока **семантическое**, продукт работает верно
   (логика `no_reg` в `step_21` и `step_13` идентична), но эталон перестаёт
   ловить дрейф копий. — `catalog/snippets/resolve-segment.md` (таблица
   «Встраивают», §«Шаг 6») и `catalog/snippets/README.md` (строка про
   `resolve-segment`). Два варианта починки: (а) привести эталон к фактическому
   коду (`ap_read_step_code` `step_21`/`step_13`) и переписать
   `catalog/snippets/README.md`; либо (б) пометить `resolve-segment` как
   не-встраиваемый исторический рецепт (как `event-card`/`i18n-resolve`) и снять
   строки из «Встраивают».

2. **на будущее** — `docs/FLOWS.md` §«broadcast-runner» (стр. 220–244) всё ещё
   описывает до-W14 архитектуру (`call-flow fn-resolve-segment`, `fn-resolve-segment`
   удалён в W22) и не знает пятого сегмента. Документ устарел не из-за W142 (это
   дрейф с W14/W22), но именно он читается как «как устроена рассылка», поэтому
   при следующей правке раздела его стоит либо переписать под `bcast-step`/
   `bcast-run`, либо отправить в архив. Не чинить в этом пакете.
