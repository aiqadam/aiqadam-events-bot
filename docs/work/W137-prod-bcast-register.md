# W137. Перенос W135 на prod: кнопка «Зарегистрироваться» вместо «Отписаться»

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W135 (готов на dev) — ✅
- **Начат**: 2026-10-05 · **Закрыт**: 2026-10-05

## Цель

Перенести W135 (кнопка «Зарегистрироваться» по адресату вместо «Отписаться»,
[ADR-0054](../adr/0054-broadcast-register-instead-of-unsubscribe.md)) с dev на prod
отдельным пакетом. Режим — **жёсткий cut** (решение владельца 2026-10-05): флоу
`bcast-unsub` и маршрут `bcast:unsub:` снимаются сразу; старые кнопки в уже
доставленных сообщениях становятся no-op (колбэк всё равно ack'ается
`bcast-step/step_1`, спиннер не висит). Только запись через MCP
`app-flow-events-prod`; канон — dev ([ADR-0042](../adr/0042-two-environments-one-repo.md)).

## Что построено

| Артефакт | dev-эталон (canon) | prod (куда переносим) |
|----------|--------------------|------------------------|
| flow `reg-start` | `furNEp5R3KFZ2jdSni2Eu` (v `gTi3MohEeu7fZ9Wcy01zU`) | `FkxtgayOK5QubyqqMd9q4` |
| flow `tg-router` | `5rpOArwaUifCX6IYF4IEQ` (v `E9QmgGVf18ZwYR5FxZ04S`) | `nyaBzgKGG8TTTsryjc9tW` |
| flow `bcast-run` | `By03Fpx1pPqJTdaQlhYsQ` (v `wHIJkUy7uU8VzvogyjO61`) | `ABjmnym2NRGldfGeHoGbN` |
| flow `bcast-step` | `uQDds2PUMYH8Kc1mLhN15` (v `NsRndSr3YGtNYyRZetpsW`) | `Sr1e3imXkI8sN0lXyROtA` |
| flow `bcast-unsub` | удалён (был `WVEZojRTZfntv22NA5geM`) | `eymcIde00G3SNlhaBvAbB` — удалить |
| flow `reg-profile` (callee) | не менялся W135 | `5U3Kv0cSrnvDTrbictA4L` (только цель вызова) |
| connection | — | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |
| таблица `migrations` (prod) | — | `NCZNGuWh6PFs1JZXRPNTE` |

`flows/*.json` и `catalog/flows/*.md` **не трогаем** — канон dev (ADR-0042);
prod-ids живут только в `catalog/environments.md`.

## Чек-лист готовности

- [x] нет running-рассылки на prod на момент наката
- [x] снапшот prod снят (`ap_export_flow` по 5 флоу) + `publishedVersionId` записаны
- [x] `reg-start`: `step_3` (dev-эталон, +`direct` во входе), ветка `register_direct`, шаги `step_21`/`step_22`
- [x] `tg-router`: `step_10` (dev-эталон), ветка `reg_go` вместо `bcast_unsub`, ack + `callFlow reg-start` (`direct=true`)
- [x] `bcast-run`: `step_53`/`step_54` (новые чтения, `logOutput:false`), `step_25` (per-recipient `markup`), `step_28`/`step_36` → `item.markup`
- [x] `bcast-step`: `step_57`/`step_58`/`step_59`, `step_28` gate, `step_30` → `step_59.markup`
- [x] `bcast-unsub`: строка `migrations` `delete`, затем `ap_delete_flow`
- [x] мёртвые ключи `bcast.btn.unsubscribe`/`unsub.*` удалены на prod (после удаления флоу)
- [x] `ap_validate_flow` ×4 — 0 `invalid`; `ap_read_step_code`/`ap_flow_structure` read-back
- [x] `catalog/environments.md` обновлён (W135 применён; `bcast-unsub` на prod удалён)
- [x] строка `migrations` на **prod** формата `YYYY-MM-DD-W137-NN`
- [x] независимое ревью, вердикт «замечаний нет»

## Детали исполнения

Предпосылки: `ap_list_runs` prod — нет `running`; снапшот `ap_export_flow` по
`tg-router` `nyaBzg…`, `reg-start` `Fkxt…`, `bcast-run` `ABjm…`, `bcast-step`
`Sr1e…`, `bcast-unsub` `eymc…` + `publishedVersionId`.

Порядок (publish — только после всех правок флоу; правки одного флоу строго
последовательны, гоча 16; вложенные `texts`/`body.data`/`values` — целиком,
гоча 12):

1. `reg-start`: `step_3` (sourceCode = dev + `direct` во входе) → `step_4`
   добавить ветку `register_direct` → `step_21`/`step_22` (`callFlow reg-profile`
   prod `5U3Kv…`, inline) → publish.
2. `tg-router`: `step_10` (sourceCode = dev) → `ap_delete_branch` `bcast_unsub`
   (idx 6; если шаг `step_19` не удалился — `ap_delete_step`, затем ветка) →
   `ap_add_branch` `reg_go` → ack (`answer_callback_query`, auth `KIbx…`) +
   `callFlow reg-start` (`direct=true`, prod `Fkxt…`) → publish.
3. `bcast-run`: вставить `step_53` (read registrations, проекция `telegram_id`,
   `logOutput:false`) и `step_54` (read event) перед `step_25` → `step_25`
   sourceCode + полная карта `texts` (без `bcast.btn.unsubscribe`,
   +`regRecords`/`eventRecords`, `event.card.btn_register`) → `step_28`/`step_36`
   `body.data.reply_markup` = `{{step_26['output'].item.markup}}` (полное
   `body.data`) → publish.
4. `bcast-step`: вставить `step_57`/`step_58`/`step_59` после `step_27` →
   `step_28` sourceCode+input (без unsubscribe) → `step_30` `reply_markup` =
   `{{step_59['output'].markup}}` → publish.
5. `bcast-unsub`: строка `migrations` `delete` → `ap_delete_flow` `eymc…`.
6. i18n prod: `ap_delete_translation` `bcast.btn.unsubscribe` и `unsub.*`
   (после удаления флоу; инструмент покажет, если что-то ещё ссылается).
7. `ap_validate_flow` ×4; `ap_list_runs` prod — после публикаций нет новых FAILED.

На prod **не запускать** `ap_test_step`/`ap_test_flow` (гоча 11 — шлют сообщения).

Откат: по снапшотам (MCP не умеет revert к версии); держать до вердикта ревью.

## Как проверено

- **Негативный/пред\-условие:** `ap_list_runs` prod по `bcast-run` — нет
  `running` (последняя рассылка `bm…` завершена 2026-10-05 03:50).
- **Read\-back живого prod** (`ap_flow_structure includeInput`, `ap_read_step_code`):
  - `reg-start` — `step_4` ветки … `register_direct`(4), `Otherwise`(5);
    `step_3` несёт `direct`, `step_21`→`step_22` (`callFlow` `bEd0cSc…`,
    inline);
  - `tg-router` — `step_11` без `bcast_unsub`, `reg_go`(11);
    `step_19` ack → `step_28` `callFlow` `HGX7…` с `direct=true`;
  - `bcast-run` — `step_53`(`LOG OFF: output`)/`step_54` → `step_25` читает
    `step_53`/`step_54` и `registerBtnText`; `step_28`/`step_36`
    `reply_markup={{step_26['output'].item.markup}}`;
  - `bcast-step` — `step_57`/`step_58`(`LOG OFF: output`)/`step_59`;
    `step_28` без `bcast.btn.unsubscribe`; `step_30`
    `reply_markup={{step_59['output'].markup}}`;
  - `bcast-unsub` удалён (не в `ap_list_flows`).
- **Версии qadam'ов:** новые tables\-шаги на prod получили пин `tables@0.4.6`
  (dev-эталон `0.5.0`) — вход совместим (проекция `columns`, фильтры по имени
  поля), публикация прошла. `subflows@0.4.14`/`telegram-bot@0.9.0` совпали.
- **`ap_validate_flow` ×4** — `0 invalid` (23/29/55/60 шагов).
- **Экспорт/снапшот** (`ap_export_flow`): `publishedVersionId` —
  `reg-start jHj9ZJjUr9dW5ClOntXP1`, `tg-router ZWPehcAjwM1879dtLDYou`,
  `bcast-run 5SsKz3nTsIq0fZdoOhYR0`, `bcast-step N8KLtU4GwTKBdZNIw1lu1`,
  `bcast-unsub` (до удаления) `nUxv8R2Rbovz68DNjIMpB`.
- **Переводы:** `bcast.btn.unsubscribe`/`unsub.already`/`unsub.done` удалены;
  инструмент не нашёл ссылающихся флоу.
- **`ap_list_runs` prod после публикаций** — новых `FAILED` нет (последние
  `FAILED` — 2026-09-24…26).
- **Строки `migrations` (prod)** — `2026-10-05-w137-01…06`.
- **Не проверено живьём:** тест себе из prod\-бота (кнопка `reg:go:<eventId>`),
  реальная рассылка с кнопкой, тап старой кнопки `bcast:unsub:` — на владельца
  (на prod `ap_test_step/flow` не запускаются, гоча 11).

## Журнал

- **2026-10-05** — пакет заведён. Разведка prod через MCP `app-flow-events-prod`:
  4 флоу в состоянии до-W135 (`tg-router/step_11` ветка `bcast_unsub` → `step_19`
  call bcast-unsub; `bcast-run/step_28` и `bcast-step/step_30` несут `unsubMarkup`;
  в `input.texts` — `bcast.btn.unsubscribe`). W133 на prod уже есть (W134),
  поэтому `tg-router/step_10` и `reg-profile/step_3` **смержить** (dev-эталон
  содержит W133+reg_go), а не копировать вслепую: под cut копия dev-`step_10`
  корректна — она уже без маршрута `bcast:unsub:`.
- **2026-10-05** — живое состояние prod: последняя боевая рассылка
  `bmuuplzp77h` (`done`, 2026-10-05 03:48–03:50, 81 sent), ранее
  `bmurvzfksv1` (2026-10-03). running-рассылок нет. Решение владельца — cut,
  grace-окно не заводим.
- **2026-10-05** — пакет выполнен на prod. Правки флоу только через MCP
  `app-flow-events-prod`, каждое — с read-back и `ap_validate_flow` (после
  каждой правки одного флоу публикация, гоча 16). Порядок: `reg-start` →
  `tg-router` → `bcast-run` → `bcast-step` → удаление `bcast-unsub` →
  переводы. **Внимание к версиям:** dev-эталон собирался на `tables@0.5.0`, на
  prod `ap_add_step` пиновал `tables@0.4.6` — входы (`columns`, фильтры по
  имени поля) совместимы, отличаются только пины (отражено в
  `catalog/environments.md`). Публикации создали новые версии (см. «Как
  проверено»); `metadata.externalId` флоу стабилен (callFlow ссылается на
  него). `flows/*.json`/`catalog/flows/*.md` не трогали (канон dev).

## Ревью

- **Ревьюер**: review-agent (чистый контекст, deepseek-v4.1-flash) · **Дата**: 2026-10-05
- **Вердикт**: **замечаний нет** (блокеров и «важно» нет; остаточные наблюдения «на будущее» — ниже)

### Что проверено (живой проект через MCP `app-flow-events-prod` + офлайн)

- `ap_list_flows` prod: 30 флоу, `bcast-unsub` (`eymcIde00G3SNlhaBvAbB`) отсутствует; висячих ссылок нет — `ap_resolve_property_options` (проп `flow` у `callFlow`) не предлагает `bcast-unsub`, ни один шаг на него не ссылается.
- `ap_flow_structure` (includeInput) ×4 — живое состояние совпадает с журналом и `catalog/environments.md`:
  - `reg-start`: `step_3` несёт `direct`; `step_4` — ветка `register_direct`(4) → `step_21` → `step_22` (`callFlow` reg-profile);
  - `tg-router`: ветки `bcast_unsub` нет; `reg_go`(11) → `step_19` ack → `step_28` `callFlow reg-start` c `direct=true`;
  - `bcast-run`: `step_53`/`step_54` → `step_25`; `step_28`/`step_36` `reply_markup={{step_26['output'].item.markup}}` (полное `body.data`);
  - `bcast-step`: `step_57`/`step_58`/`step_59`; `step_28` без `bcast.btn.unsubscribe`; `step_30` `reply_markup={{step_59['output'].markup}}` (полное `body.data`).
- **CallFlow-цели резолвятся**: `reg-profile` `bEd0cScLAymIT44Dmtnxu` (прод-`externalId`, не dev-`sXX6…`), `reg-start` `HGX7KPhFsyFrapBRvlIAT` — маппинг сред выполнен верно, а не скопирован из dev вслепую.
- **Побайтовая сверка CODE с dev-эталоном**: `bcast-run/step_25`, `bcast-step/step_28`/`step_59`, `reg-start/step_3`/`step_21`, `tg-router/step_10` — `flows/*.json` (dev) и живой prod совпадают посимвольно.
- **Пины qadam**: prod `bcast-run/step_53`/`step_54` и `bcast-step/step_57`/`step_58` — `tables@0.4.6`; формат входа идентичен уже работающим на prod шагам `tables@0.4.5` (проекция `columns` внешними id, фильтры `field` строкой — как `bcast-run/step_9`), поэтому совместим. `subflows@0.4.14`, `telegram-bot@0.9.0`, `store@0.7.0` — как в dev-эталоне.
- **AppSec**:
  - IDOR нет: `telegram_id` — из апдейта (`tg-router/step_1`), в `reg-start` — из `trigger.output.data`, не из callback. Ветка `register_direct` — не обход гейтов: `step_3` проверяет `existing`/`cancelled`/`finished`/`not_published`/`deadline`/`capacity` **до** `profileDone`+`consent_pdn`; `consent_pdn` — обязательная предпосылка (PAR-1), `consent_marketing` не трогается (PAR-2).
  - `reg:go:` разбирается **до** сессионных `reg:*` (`step_10`); старый `bcast:unsub:` уходит по префиксу `bcast:` в `bcast-step`, где `step_1` ack'ает колбэк, `step_2` его не парсит (`op=''`) → `Otherwise` `step_56` (silent), побочных эффектов нет.
  - Инъекций в разметке нет: текст кнопки — статичный `{{$t['event.card.btn_register']}}` (ru/uz/en есть), `eventId` — серверный SLUG и попадает в `callback_data`, а не в разметку.
  - Секретов в живом экспорте нет (значения connections/variables не отдаются, только ссылки).
- **`logOutput`**: `bcast-run/step_53` и `bcast-step/step_58` — выключены (`[LOG OFF: output]`), как заявлено; `tg-router/trigger` — тоже `logOutput:false`.
- **`ap_validate_flow` ×4** — `0 invalid` (23/29/55/60).
- **`publishedVersionId` сверен живым `ap_export_flow`**: `reg-start jHj9ZJjUr9dW5ClOntXP1`, `tg-router ZWPehcAjwM1879dtLDYou`, `bcast-run 5SsKz3nTsIq0fZdoOhYR0`, `bcast-step N8KLtU4GwTKBdZNIw1lu1` — совпадают с журналом и `migrations`; более поздних `publish` по этим флоу в `migrations` нет.
- **`migrations` prod**: 6 строк `2026-10-05-w137-01…06` (`publish` ×4 с теми же `version_id`, `delete flow:bcast-unsub`, `delete translations`).
- **Предусловие**: `broadcasts.status=running` — 0; свежих `FAILED` (после 2026-09-26) нет.
- **Офлайн** (перезапущено ревьюером): `check-texts.py` — 30 флоу, 302 ссылки, 0 расхождений; `check-commands.py` — 30 флоу, 0 нарушений, самопроверка ok; `check-export-secrets.sh` — 0 совпадений.
- **Каталог**: `catalog/environments.md` (раздел «Хотфиксы prod после W122», W137) описывает живое состояние точно; `flows/*.json`/`catalog/flows/*.md` не трогались — канон dev ([ADR-0042](../../docs/adr/0042-two-environments-one-repo.md)), для W137 верно.

### Замечания

Замечаний нет. Остаточные наблюдения «на будущее» (вердикт не меняют):

1. **на будущее.** Живого исполнения новых prod-путей нет — и в рамках правила «на prod `ap_test_step`/`ap_test_flow` не запускать» (гоча 11) быть не может: ни `step_53`/`54`/`25`, ни `step_57`/`58`/`59`, ни ветки `register_direct`/`reg_go` на prod не прогонялись. Совместимость `tables@0.4.6` доказана косвенно (идентичный вход работающих `0.4.5`-шагов, резолв callFlow-целей, корректные `columns`/фильтры). Закрытие — «тест себе» и первая боевая рассылка на владельце (в журнале уже заявлено как хвост).
2. **на будущее (наследие W135).** `logOutput:false` на `step_53`/`step_58` не убирает `telegram_id` из логов прогона полностью: `bcast-run/step_25` (лог включён) отдаёт `items[].telegramId`, а `logInput` `step_59` ссылается на вывод `step_58` (при материализации вывода в лог). Это не регресс W137 — класс отмечен в W135 #5; при желании свести политику логов к единой.
3. **на будущее.** Локаль подписи кнопки берётся из локали прогона `bcast-run` (наследует локаль отправителя), а не получателя; у рассылки нет per-recipient локали. Унаследовано из W135 #6, для текущего объёма приемлемо.
4. **на будущее (процесс).** Чек-лист готовности в журнале не отмечен (`[ ]`), хотя все пункты, кроме последнего (это ревью), выполнены и подтверждены в «Как проверено». Косметика, но при закрытии пакета стоит проставить отметки.
5. **на будущее (хвост окружения).** `tools/check-migrations.py` по prod не прогонялся (нет ключа платформы); состав манифеста и `object_id`/`version_id` сверены вручную через MCP и совпали. Как в W134.

## Хвосты и блокеры

- живой e2e в Telegram на prod — на владельца («тест себе» из prod-бота: копия
  с кнопкой `reg:go:<eventId>`; тап → регистрация и билет);
- `tools/check-migrations.py` по prod — известный хвост (нет ключа платформы /
  инструмент заточен под dev-манифест), как в W134.
