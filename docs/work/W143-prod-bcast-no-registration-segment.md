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
- [ ] живой e2e prod-бота подтверждён владельцем;
- [ ] независимое ревью, вердикт «замечаний нет».

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

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Решение «без UI» повышает риск (окно пустого `segment`, churn `externalId`);
  при любом сомнении на шаге 3/7 — остановиться и вернуться к UI.
