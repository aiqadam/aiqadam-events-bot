# W143. Перенос W142 на prod: сегмент рассылки «согласие без регистрации» (`no_reg`) (хотфикс ADR-0042)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W142 (готов на dev) — ✅
- **Начат**: 2026-10-09 · **Закрыт**: —

## Цель

Перенести [W142](W142-bcast-no-registration-segment.md)
([ADR-0057](../adr/0057-broadcast-no-registration-segment.md), SPEC OWN-9 п. 5)
на prod: пятый сегмент рассылки `no_reg`. Правки — только через MCP
`app-flow-events-prod`; `flows/*.json` и `catalog/flows/*.md` не трогаются
(dev-канон). Прод-таблица `broadcasts` получает опцию `no_reg` у поля `segment`.

**Решение владельца 2026-10-09:** делать **без UI** (агент, только MCP), несмотря
на то что добавление опции в UI было бы неразрушающим. Ниже — рунбук и его риски.

## Что построено

| Артефакт (prod) | id | published до | published после |
|-----------------|----|--------------|-----------------|
| flow `bcast-step` | `Sr1e3imXkI8sN0lXyROtA` | `N8KLtU4GwTKBdZNIw1lu1` | **`x5ibzsxeuXo3q0fRw673P`** |
| flow `bcast-run` | `ABjmnym2NRGldfGeHoGbN` | `5SsKz3nTsIq0fZdoOhYR0` | **`6tcOI2Wd96byeIg86VbHI`** |

| Поле prod | было | стало |
|-----------|------|-------|
| `broadcasts.segment` | int `VLW4nkzkcUnS5hRoCUuxu` / ext `6rmHz7Lc1djdjFpjAmO5V`, 4 опции | int `h4TOLRsureQXgr0yIzlea` / ext **`cNZjcArfDnRwLIR7F1h6w`**, 5 опций |

Правки шагов (имена совпали с dev-эталоном): `bcast-step` `step_7` (клавиатура
+ текст, +2 ключа `texts`), `step_14` (`segValid` + `no_reg`), `step_21`
(`segValid` + ветка `no_reg`), `step_9`/`step_23` (перепривязка на
`cNZjcArfDnRwLIR7F1h6w`); `bcast-run` `step_4` (`segValid` + `no_reg`),
`step_13` (ветка `no_reg`). i18n `bcast.btn.seg_no_reg`, `bcast.segment.no_reg`
(ru/uz/en) импортированы. Connection `KIbxO5kYo3RsU5PNGPz9l` — без изменений.

## Предусловия (сняты 2026-10-09)

- **Пины.** `ap_validate_flow` prod: `bcast-step` 60/60, `bcast-run` 55/55 —
  **без предупреждений о недоступных пинах** → `ap_update_step` правит PIECE-шаги
  **на месте** (в отличие от dev, где шаги на `tables@0.4.5` пришлось пересоздавать).
- **Данные.** `broadcasts` prod: 10 строк, **ни одной `running`** (4 `draft`,
  4 `failed`, 2 `done`) → прямо сейчас нет риска «resume читает пустой `segment`».
- **Поле.** `broadcasts.segment` prod несёт те же ids, что dev до W142
  (`VLW4nkzkcUnS5hRoCUuxu` / `6rmHz7Lc1djdjFpjAmO5V`), опции 4.
- **i18n.** Ключи `bcast.btn.seg_no_reg`, `bcast.segment.no_reg` (ru/uz/en) на prod
  ещё не импортированы — импорт `ap_upsert_translations` **до** публикации
  (иначе `TranslationKeyNotFoundError` валит шаг, I18N-2).

## План (без UI, только MCP `app-flow-events-prod`)

1. **Снапшот.** `ap_find_records` `broadcasts` (id/segment/status) ×10; `ap_export_flow`
   ×2 (для отката). Зафиксировать в журнал.
2. **Проверить, что нет `running`-рассылки** (иначе отложить до тихого момента).
3. **Найти шаги, пишущие `segment`** — по ключу-`externalId` `6rmHz7Lc1djdjFpjAmO5V`
   в `values` (ожидаются аналоги dev `step_9` «create draft row» и `step_23`
   «save segment»; подтвердить по живому экспорту).
4. **Импорт i18n** `ap_upsert_translations` (2 ключа × ru/uz/en).
5. **Пересоздать поле** `segment`: `ap_delete_field` + `ap_add_field` с 5 опциями
   (`all_consent/registered/attended/no_show/no_reg`) → новый `externalId`
   (зафиксировать). Опции на месте через MCP не правятся (платформенный тикет #842).
6. **Перепривязать шаги** `ap_update_step` (полная карта `values`, ключ старый→новый).
7. **Восстановить `segment`** у 10 строк (`ap_update_record`) — сразу после шага 5.
8. **Валидация/публикация** `ap_validate_flow` ×2 → `ap_lock_and_publish` ×2.
9. **`migrations` (prod)** `2026-10-09-w143-01…`; **`catalog/environments.md`** —
   раздел «Хотфиксы prod после W122».
10. **Живой e2e prod-бота** (владелец) → независимое ревью.

## Риски

- **Окно пустого `segment`** между удалением и восстановлением поля: любой
  `running`-resume в этот момент прочитает пустой сегмент и остановится. Нужен
  тихий момент; шаги 5 и 7 — подряд, без пауз.
- **Смена `externalId`**: любой забытый референс (в `bcast-step`/`bcast-run`)
  приведёт к тихой потере записи `segment`. Шаг 3 ищет **все** вхождения.
- **Откат** = снова пересоздать поле и восстановить строки (снапшот шага 1).
- **UI безопаснее**: добавление опции в UI сохраняет field id, `externalId` и
  значения строк, без перепривязки и без окна. Если найдётся хоть один лишний
  референс или появится `running`-рассылка — предпочесть UI.

## Чек-лист готовности

- [x] снапшот prod-строк (10 × id/segment/status) и экспортов ×2 снят и записан;
- [x] нет `running`-рассылки на момент правки (проверено дважды: до и в начале);
- [x] найдены все шаги, пишущие `segment` (только `bcast-step/step_9`/`step_23`; `bcast-draft` поля не читает);
- [x] i18n-ключи импортированы на prod;
- [x] поле `segment` пересоздано с опцией `no_reg`; 10 строк восстановлены (сверено со снапшотом, 10/10);
- [x] шаги перепривязаны на новый `externalId`; `0 invalid` ×2; publish ×2;
- [x] `migrations` (prod) `w143-01…03`; `catalog/environments.md` обновлён;
- [x] живой e2e prod-бота — на prod отработали 2 строки `no_reg` (`test_sent_at 2026-10-09T19:17Z`, найдены ревьюером); отдельного подтверждения владельца не запрашивалось — пакет влит по его команде;
- [x] независимое ревью, вердикт «замечаний нет» (коммит `e11025d`).

## Как проверено

- **Снапшот (до правки).** `broadcasts` prod — 10 строк, `status` ∈ {draft×4,
  failed×4, done×2}, ни одной `running`. `segment`: `registered`×3,
  `all_consent`×7. Экспорты `bcast-step`/`bcast-run`/`bcast-draft` сняты.
- **Дельта prod→dev — ровно W142.** Скриптом сверил деревья prod-экспорта и
  dev-эталона `flows/*.json`: отличия только в `step_7` (клавиатура/текст +
  2 ключа `texts`), `step_14`/`step_21` (`segValid`/ветка `no_reg`),
  `step_4`/`step_13` (`bcast-run`), и ключе-`externalId` в `step_9`/`step_23`;
  всё прочее — `IDENTICAL`. `bcast-draft` поля `segment` не читает/не пишет.
- **Валидация/публикация.** `ap_validate_flow` ×2 → «ready to publish», 0
  `invalid` (60/60 и 55/55). `ap_lock_and_publish` ×2. `ap_export_flow` ×2 →
  `flows[0].id` = `x5ibzsxeuXo3q0fRw673P` / `6tcOI2Wd96byeIg86VbHI`.
- **Структура.** `ap_flow_structure` `bcast-step`: `step_7.texts` несёт
  `bcast.btn.seg_no_reg`/`bcast.segment.no_reg`, `step_9`/`step_23` — ключ
  `cNZjcArfDnRwLIR7F1h6w`.
- **Данные.** `ap_find_records` после правки: `segment` 10/10 совпал со
  снапшотом (`registered`×3, `all_consent`×7), `status` не изменился.
- **Хвост.** Живой e2e prod-бота (кнопка «Не записались» в карточке рассылки)
  — за владельцем; независимое ревью — после.

## Журнал

- **2026-10-09** — пакет заведён по решению владельца: перенос W142 на prod **без UI**.
  Сняты предусловия (пины prod доступны, 10 строк, ни одной `running`).
- **2026-10-09** — реализация на prod: i18n ×2 ключа; поле `segment`
  пересоздано (ext `6rm…` → `cNZjcArfDnRwLIR7F1h6w`); 7 шагов обновлены
  последовательно; 10 строк восстановлены; `0 invalid` ×2; publish ×2;
  `ap_export_flow` ×2 (version id сняты). Окно пустого `segment` — секунды,
  `running`-рассылок не было.
- **2026-10-10** — независимое ревью: «замечаний нет» (все чтения живого prod
  через MCP + офлайн; вердикт — в разделе «Ревью»). На prod уже отработали 2
  строки `no_reg` (`test_sent_at 2026-10-09T19:17Z`) — свидетельство живого
  прогона сегмента. Пакет закрыт `готов` и влит в `main` по команде владельца.

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash) · **Дата**: 2026-10-10 · **Вердикт**: замечаний нет

Проверено по живому prod через MCP `app-flow-events-prod` (все чтения — только
`ap_export_flow` / `ap_flow_structure` / `ap_read_step_code` / `ap_validate_flow` /
`ap_find_records` / `ap_list_tables` / `ap_list_flows`), плюс офлайн-проверки
репозитория. Ничего в проекте и репозитории не менялось.

**Флоу.** `ap_export_flow`: `bcast-step` — `flowId Sr1e3imXkI8sN0lXyROtA`,
`flows[0].id x5ibzsxeuXo3q0fRw673P`, `state LOCKED`, `valid true`; `bcast-run` —
`flowId ABjmnym2NRGldfGeHoGbN`, `flows[0].id 6tcOI2Wd96byeIg86VbHI`, `state LOCKED`,
`valid true` — совпадают с `migrations.w143-01/02`. `ap_validate_flow` ×2 →
«ready to publish», 60/60 и 55/55, `invalid` нет.

**Сверка с dev-эталоном.** Полное сравнение деревьев prod-экспорта и
`flows/bcast-step.json` / `flows/bcast-run.json`: набор шагов и **топология**
(родитель/ветка/порядок) совпадают побайтово-структурно (60/60 и 55/55;
`bcast-step` шаги `step_7/14/21/9/23`, `bcast-run` `step_4/13`). Все
`sourceCode.code` CODE-шагов идентичны эталону. Единственные различия —
средовые id: значение `broadcasts.segment` в `step_9`/`step_23`
(prod `cNZjcArfDnRwLIR7F1h6w` ↔ dev `TwQYOml3ytGeQ5Mw1uGxg`) и
`flow.externalId` у `callFlow` (`step_44/45` в `bcast-step`, `step_23/48` в
`bcast-run`). `logInput`/`logOutput`/`skip` — различий с dev нет. Шаги **не
пересоздавались**: их пины `step_9/23` = `tables@0.4.5` (на dev после W142 —
`0.5.1` именно потому, что там пересоздавали), `bcast-run step_53/54` = `0.4.6`
(dev `0.5.0`).

**Поле и данные.** `broadcasts` prod (`DrFrwV10gtJzCP02ifz0I`): поле `segment`
внутр. `h4TOLRsureQXgr0yIzlea`, 5 опций `all_consent/registered/attended/no_show/no_reg`;
старого `6rmHz7Lc1djdjFpjAmO5V` нет **нигде** (ни в prod-экспортах, ни в
репозитории), новый `cNZjcArfDnRwLIR7F1h6w` — ровно 2 вхождения, оба в
`bcast-step` (`step_9`/`step_23`). `ap_find_records`: 10 исходных строк с
`segment` (`registered`×3, `all_consent`×7) и `status` (`draft`×4, `failed`×4,
`done`×2) на месте, пустых `segment` нет; плюс 2 строки `no_reg`, созданные
`2026-10-09 19:17Z` (после публикации `19:09Z`) — более поздняя активность, не
искажающая восстановление снапшота.

**Кросс-флоу.** Структурно (dev-эталон) таблицу `broadcasts` трогают только
`bcast-step` и `bcast-run`; поле `segment` по `externalId` упоминает только
`bcast-step`. Живой `bcast-draft` (`2AUeMeakjrrjUqZ0RuGpL`,
`ap_flow_structure(includeInput=true)`) ни `segment`, ни `broadcasts` не читает.
Набор флоу prod (30) совпадает с `flows/_manifest.json` (30), лишних/пропавших нет.

**i18n.** Оба ключа (`bcast.btn.seg_no_reg`, `bcast.segment.no_reg`) есть в
`i18n/{ru,uz,en}.json` (источник правды), а в prod-экспорте `step_7.texts`
ссылаются на них через `{{$t[...]}}`. Прямого листинга платформенных переводов
инструментарий не даёт (MCP-тула `ap_list_translations` в этой сессии нет, REST
без ключа недоступен), но ключи **проверены поведенчески**: обе `no_reg`-строки
созданы после публикации, включая одну с `test_sent_at`, — а отсутствующий ключ
валит `step_7`/`step_21` (`TranslationKeyNotFoundError`), значит `$t` на prod
резолвится.

**Migrations (prod, `NCZNGuWh6PFs1JZXRPNTE`) по `package=W143`.** 3 строки:
`2026-10-09-w143-01` (`flow:bcast-step`, `object_id Sr1e3imXkI8sN0lXyROtA`,
`version_id x5ibzsxeuXo3q0fRw673P`, `publish`), `-02` (`flow:bcast-run`,
`ABjmnym2NRGldfGeHoGbN`, `6tcOI2Wd96byeIg86VbHI`, `publish`), `-03`
(`table:broadcasts`, `XrygYF5Q4EUOKkaBFallb`, `update`, `version_id` пуст —
таблицы версией не обладают); `commit 768b877` у всех, как заявлено.

**Офлайн.** `check-export-secrets.sh` — чисто; `check-texts.py i18n/ru.json
flows/*.json` — 305 ссылок, 0 расхождений; `check-commands.py i18n/*.json
flows/*.json` — 0 нарушений. `code/texts/commands` не менялись пакетом:
`git show --stat 768b877` — только `catalog/environments.md`, `docs/STATUS.md`,
журнал (ADR-0042, dev-канон). `flows/*.json` и `catalog/flows/*.md` не тронуты.

**AppSec.** Права сохранены: создатель рассылки проверяется по
`broadcasts.created_by` (`step_7`, `step_21`, `step_4` в `bcast-run`), staff
ивента — по `staff.telegram_id` + сверке `chapter_id` (`step_7`/`step_21`);
`no_reg` — строго **подмножество** `all_consent` (`consent_marketing = true`),
без расширения доступа. Ветки fail-closed: невалидный `segment` даёт `deny`
(`step_14`/`step_21` whitelist из 5 значений, `bcast-run step_4` — то же).
`blocked_bot` исключается и в `step_21`, и в `bcast-run step_13`
(OWN-12). Инъекций нет: `format: "None"` (plain), CSV/`parse_mode` в
пакете не задействованы; новые ветки — чистые функции без сети/записи.
Счётчик превью (`step_21`) и материализация (`step_13`) считаются одним
правилом — как требует ADR-0057 п. 6. Секретов в шагах нет.

**Наблюдения (не замечания).**
1. Хвост, заявленный в журнале: формального подтверждения владельцем живого
   e2e prod-бота в журнале нет. При этом найденные в таблице 2 строки `no_reg`
   (`test_sent_at 2026-10-09T19:17:49Z`) — фактическое свидетельство, что
   сегмент на prod отработал; стоит зафиксировать прогон в журнале.
2. `step_14` (`bcast-step`) вычисляет `creatorOk`/`segValid`, но ни один
   downstream-шаг их не читает (гейт прав стоит в `step_7`/`step_21`). Вредa
   нет, код побайтово совпадает с dev-эталоном и W142 — вне рамок этого переноса.
3. `check-migrations.py` офлайн прогнать не удалось: ключа платформы на этой
   машине нет (Keychain — macOS). Сверка манифест↔инстанс↔`migrations` для prod
   выполнена вручную (п. Migrations выше) и сошлась.

## Хвосты и блокеры

- Решение «без UI» повышает риск (окно пустого `segment`, churn `externalId`);
  при любом сомнении на шаге 3/7 — остановиться и вернуться к UI.
