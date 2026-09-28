# W123. Сообщение о проблеме из продукта — экран `#/report`

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (пакет-кандидат, назначен владельцем 2026-09-28)
- **Зависит от**: [Q62](../OPEN-QUESTIONS.md#q62) (отвечен 2026-09-28), [W41](../work/W41-prototypes-e2e.md) (прототип, готов)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Дать участнику и организатору способ сообщить о **клиентской** проблеме
(вёрстка, тема, i18n, «кнопка не реагирует», пустой экран при успешном ответе
API) — то, что не видно в прогонах. Форма и место зафиксированы пакетом:
экран `#/report`, таблица `reports`, флоу `report-api`; без `reports-digest`
и без чат-ветки в `tg-router`. Подробности — [BACKLOG.md](../BACKLOG.md#w123-сообщение-о-проблеме-из-продукта-q62--экран-mini-app).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `report-api` | `R8GgSVXgHsmLSKdEdzygp` (внутр. externalId `U9da0ciAfDrcA2N71qt6r`) | [catalog/flows/report-api.md](../../catalog/flows/report-api.md) |
| таблица `reports` | внешний `LKEqlq1X7RuWz5WC4zkov`, внутр. `XIJdKUVMYUwdbdTqqrZqZ` | [catalog/tables/reports.md](../../catalog/tables/reports.md) |
| SPA-роут `#/report` | `miniapp/src/routes/Report.tsx` | [catalog/overview.md](../../catalog/overview.md) |
| вход из «Профиля» | `miniapp/src/routes/Events.tsx` (`ProfileTab`) | — |
| вход из меню | `menu/step_11` (`web_app` `#/report?from=menu`) — flow `rV2ymkl6ET11uMjbywU4D` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| ADR | [ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md) | [adr/README](../../docs/adr/README.md) |
| SPEC | [PAR-12](../../docs/SPEC.md) | — |

## Чек-лист готовности

> Скопировано из [BACKLOG.md](../BACKLOG.md#w123-сообщение-о-проблеме-из-продукта-q62--экран-mini-app).

- [x] ADR шестого роута `#/report` принят — [ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md); плюс SPEC [PAR-12](../../docs/SPEC.md);
- [x] таблица `reports` заведена; ключ не объявлен (несколько сообщений
      от одного человека легальны, ADR-0003/ADR-0047);
- [x] флоу `report-api` собран, `ap_validate_flow` чист; живые прогоны:
      валидный `initData` → 200 и строка, невалидный → 401, staff-гейта нет;
- [x] страница `#/report` в SPA, вход из «Профиля» и `web_app`-кнопки;
      тексты — `i18n/*.json` (I18N-2), `tools/check-texts.py` чист;
- [x] `tools/check-commands.py` чист (новой команды нет);
- [x] `catalog/` обновлён (флоу, таблица, overview, menu), строки `migrations` записаны;
- [ ] независимое ревью, вердикт «замечаний нет»;
- [x] `catalog/` совпадает с живым проектом.

## Как проверено

**Негатив — `curl` по опубликованному `/sync`** (флоу с побочным эффектом,
gotcha 11), заголовок `ap-parent-run-locale: ru`:

```
POST .../webhooks/R8GgSVXgHsmLSKdEdzygp/sync  {"initData":"bogus",...}
→ HTTP 401 {"ok":false,"text":"Данные Mini App устарели — переоткройте приложение","error":"invalid_init_data"}
```

**Позитив — валидный `initData`, подписанный временным флоу-подписантом**
(выбор владельца; флоу `zz-w123-initdata-mint`, `WjicJeOvohCIrCdRWsclQ`,
собран на `crypto/hmac-signature` с `{{variables['BOT_TOKEN']}}`, прогнан
`ap_test_flow`, **удалён**; тестовые строки из `reports` **удалены**).

Прогон подписанта `w6CglCPhrdRIUMTrT2Ox5`: `data_check_string`
`auth_date=1790598869\nquery_id=AAH1790598869\nuser={"id":999000000001,...}`,
`hash=16f31c3d…9f9f`, `initData` собран из трёх полей + `hash`.

| Проба (curl, published) | Результат |
|---|---|
| валидный `initData`, `kind=broken`, текст | `HTTP 200 {"ok":true,"text":"Сообщение отправлено"}` |
| пустой `text` | `HTTP 422 {"ok":false,"error":"validation","text":"Опишите проблему — хотя бы коротко.","fields":{"text":"report.error.text"}}` |
| `kind=hack` | `HTTP 422 {…"fields":{"kind":"report.error.kind"}}` |
| `ap-parent-run-locale: uz`, валидный | `HTTP 200 {"ok":true,"text":"Xabar yuborildi"}` |
| `ap-parent-run-locale: en`, битый `initData` | `HTTP 401 {"text":"Mini App data is stale — reopen the app"}` |

**Строка в `reports`** после валидного прогона (`ap_find_records`), затем
удалена (`ap_delete_records`, ids `I0OMxKp6kStiNLtqZki6o`, `PX2m9EvZ2XX2zlTd1pHfh`):

```
source=miniapp  created_at=2026-09-28T12:34:46.493Z  context={"lang":"ru"}
status=new  telegram_id=999000000001  kind=broken
text=Не сохраняется компания в профиле  route=profile  app_version=8.0  event_id=(empty)
```

**Офлайн-проверки** (все код 0): `tools/check-export-secrets.sh` (ссылок
`BOT_TOKEN` — 9, `EXPECTED_BOT_TOKEN` поднят 8→9), `tools/check-texts.py`
(31 флоу, 287 ссылок `$t`, 0 расхождений), `tools/check-commands.py`
(0 нарушений), `node prototypes/check.mjs` (ключи резолвятся, сценарии
целы), `npm run build:dev` (tsc + vite, чанк `Report` 3,7 КиБ).

## Журнал

- **2026-09-28** — пакет взят по указанию владельца («W123 го»).
- **2026-09-28** — флоу `report-api` собран зеркалом `feedback-api`:
  `fn-hmac-init-data` → ROUTER `invalid/valid` → CODE-валидация →
  ROUTER `reject/ok` → `tables-create-records` → `200`. Умышленные отличия:
  **нет** `fn-find-registration` и staff-гейта (Q62, ADR-0050 п. 3),
  **`tables-create-records`** вместо `upsert` (несколько жалоб легальны).
- **2026-09-28** — `ap_update_step` по `menu/step_11`: `sourceCode` заменён
  целиком, `texts` передан полной картой с новым `menu.btn.report`
  (gotcha 12); после — `ap_validate_flow` и `ap_lock_and_publish`.
- **2026-09-28** — экспорт `flows/report-api.json` и `flows/menu.json` снят
  через `ap_export_flow` **сразу после** публикаций; ключа платформы на
  машине нет, поэтому MCP-снимок (`source: mcp`) — легитимный путь ADR-0021.
- **2026-09-28** — `.env.prod` **не трогался**: решение владельца — пакет
  только dev, перенос на prod отдельным шагом. **Исправлено по ревью (важно 1):**
  без ключа `report` в `.env.prod` сборка `build:prod` **проходит** (код шага не
  исполняется), но рантайм падал бы — `endpoint('report')` вызывался на верхнем
  уровне `api.ts` и ронял **весь SPA на старте**. Теперь `report` резолвится
  лениво (`reportApi()` в `api.ts`, вызов внутри `submit` `Report.tsx` с
  try/catch): отсутствие ключа деградирует до ошибки на одном экране `#/report`.
  При promote ключ `report` в `.env.prod` обязателен (иначе экран недоступен).
- **2026-09-28** — расхождения с прототипом (ADR-0027), названы сознательно:
  1. В тексте экрана `report.lead`/`report.done` прототип обещал «сообщение
     увидят организаторы»; Q62 называет читателя — **владельца продукта**, без
     уведомления организатору. Обещать организаторов было бы неправдой —
     продукт говорит «мы». Прототип приведён к тому же тексту.
  2. Кнопка в меню бота (`#/report?from=menu`) — её в прототипе нет (там
     только вход из «Профиля»), но требует форма пакета в BACKLOG; команда
     WebApp не является, ADR-0025 не задет.
  3. Выбор вида — брендовые `.chip-row` (продуктовый аналог `.segmented.wrap`
     из прототипа, W77) вместо класса эталона; поведение и подписи совпадают.
  4. **Классы кнопок/контейнера — по конвенции продуктовых форм (уточнено по
     ревью, «на будущее» 2):** выбор вида `btn btn-outline` в `.chip-row` против
     `btn-secondary btn-sm` в прототипе; вход из «Профиля» `btn-secondary
     btn-block` против `btn-outline`; отправка в `.app-actions` против
     `.sticky-actions`. Состав, поведение и подписи совпадают; конвенция та же,
     что у `Feedback.tsx`/`Manage.tsx` (W45/W77), не самовольная правка эталона.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: review-agent (независимый, чистый контекст, opencode/deepseek-v4.1-flash) · **Дата**: 2026-09-28 · **Вердикт**: есть замечания (блокеров нет; одно «важно» — формулировка prod-хвоста; далее «на будущее»)
- **Ревьюер (круг 2, повторное ревью после `fcc27cd`)**: review-agent (независимый, чистый контекст, opencode/deepseek-v4.1-flash) · **Дата**: 2026-09-28 · **Вердикт**: замечаний нет (всё по кругу 1 закрыто, новых нет)

### Чем проверено

**Живой проект (`app-flow-events-dev`, MCP).**
- `ap_flow_structure report-api` (`R8GgSVXgHsmLSKdEdzygp`, `includeInput=true`) —
  12 шагов, все `configured`; `ap_validate_flow` — `12/12 valid`. Цепочка ровно
  как в каталоге: `trigger` → `step_1 callFlow fn-hmac-init-data` (externalId
  `TIZvQYTCBVJMsMWNC5EbK`, `maxAgeSeconds 300`, обёртка `{"payload":{…}}`, gotcha 7a) →
  ROUTER `step_2` (`invalid`/`valid`) → `step_3`/`step_4` (401) и `step_11` (fallback) /
  `step_5` → ROUTER `step_6` (`reject`/`ok`) → `step_7` (401/422), `step_8
  tables-create-records`, `step_9` (200) и `step_10` (fallback).
- `ap_read_step_code` по `step_3` и `step_5` — **чистые функции**: без сети, без
  обращения к БД. `telegram_id` берётся **только** из `inputs.hmac.telegramId`
  (`{{step_1['output'].data.telegramId}}`), тело запроса на него не влияет; форма
  `^\d{1,20}$` (иначе `outcome:'invalid'`, 401). `kind` — только из набора
  `broken|text|message|other`; `text` обязателен и ≤2000; `eventId` нормализуется
  к `^[A-Za-z0-9_]{1,64}$` и в невалидном виде пишется пустым (отказа нет — это
  не гейт). `created_at` — `new Date().toISOString()` (UTC, OWN-3).
- **Staff-гейта нет намеренно** (ADR-0050 п. 3, Q62): ни одного чтения прав/участия
  на `event_id`; `event_id` только пишется в контекст. Шагов отправки в Telegram
  во флоу **нет** (нет qadam `telegram-bot`); `text` только сохраняется.
- **`initData` отсекается до таблицы.** `step_1` (fn-hmac-init-data) → `step_2`
  ROUTER: `invalid` = `valid != true`, `valid` = `valid == true`, третий — fallback.
  fn (`ap_read_step_code` `step_2`/`step_3`) считает `valid = hashValid && fresh`,
  `telegramId` отдаёт только при `valid`; HMAC — `node:crypto`, сравнение
  constant-time, `auth_date` с окном (`maxAgeSeconds`, cap 43200, skew 300).
  Прогоны это подтверждают: `8O1iJylopm82i9RALrbCu` и `h8lRa82pJEhtwmtWUUTuV`
  (`initData:"bogus"`) → `step_2.Otherwise evaluation:false` → `step_3` 401
  (`report.error.init`, ru/en). До `step_5`/`step_8` дело не доходит.
- **Оба структурных фолбэка недостижимы** (reachable-анализ по прогонам):
  `step_2.Otherwise` — обе ветки вместе исчерпывают булево `valid`;
  `step_6.Otherwise` — `outcome` из `step_5` всегда ∈ `{invalid,validation,ok}`.
  В прогонах `Otherwise`/`ok`-ветки дают `evaluation:false`. Даже при
  достижимости оба фолбэка fail-closed (401/500).
- **Успех — различающий прогон прочитан** (`uzyLod0STBfiNYj9Lh2hQ`): валидный
  `initData` (`valid:true, hashValid:true, fresh:true`) → `step_5` `outcome:'ok'` →
  `step_8` создал строку (`telegram_id 999000000001`, `source miniapp`, `kind broken`,
  `route profile`, `app_version 8.0`, `event_id` пусто, `status new`, UTC) →
  `step_9` 200 `"Сообщение отправлено"`. Локаль `uz` в успешном прогоне (журнал)
  и `en` в 401 (`h8lRa82…`) резолвятся платформенными переводами. Отдельно
  `n5gmnYrmXsynDLUHPSukr` (`kind:"hack"`) → `report.error.kind` 422,
  `KlXxmeNBcGbrdeZrMH3nw` (`text:"   "`) → `report.error.text` 422.
- **Таблица `reports` (`XIJdKUVMYUwdbdTqqrZqZ`)** — `0 records` (тестовые удалены);
  `ap_export_table`: поля/типы и options совпадают с `catalog/tables/reports.md`,
  **уникальный ключ не объявлен** (`keyFields` в экспорте нет) — обосновано ADR-0047
  (несколько жалоб одного человека легальны), пишет `tables-create-records`, не upsert.
- **`menu/step_11` (`rV2ymkl6ET11uMjbywU4D`)** — `ap_flow_structure` + `ap_read_step_code`:
  `reportBtn = web_app #/report?from=menu` всем ролям **последней строкой** (у овнера
  порядок W52 не сдвинут), `ap_validate_flow` — `15/15 valid`. Карта `texts` —
  **17 ключей** (было 16): `menu.btn.report` добавлен, ни один прежний ключ не
  потерян (gotcha 12 не сработала); в живом и закоммиченном экспорте `step_11.input.texts`
  совпадают.
- **`tg-router` не тронут**: в дифе `main...HEAD` его нет, `_manifest` без изменений,
  ссылок на `report` в нём нет.
- **`migrations` (`NCZNGuWh6PFs1JZXRPNTE`)** — 5 строк `package W123`,
  `commit 6436905…` (= HEAD `6436905`): `table:reports` `create`; `flow:report-api`
  `create` + `publish` (`version_id plaa2GTA8W2dToANOUmZW`); `flow:menu` `update` +
  `publish` (`version_id 2hFzN2UlxECze9iHLk37q`). Обе версии совпали с
  `ap_export_flow` (`state: LOCKED`) и с `flows/_manifest.json`.
- **Экспорт репозитория = живая опубликованная версия.** `flows/report-api.json`
  побайтово сверен с живым `ap_export_flow` по структуре и всем CODE/input
  (совпадение); `flows[0].id` живого = `plaa2GTA8W2dToANOUmZW` = манифест.
  `flows/menu.json` — новый `step_11` + `menu.btn.report`. Обе записи `source: mcp`,
  что допустимо для снимка сразу после `ap_lock_and_publish` (ADR-0021).

**Офлайн (запущено мной).** `tools/check-export-secrets.sh` — exit 0 (0 токен/hex,
9× `BOT_TOKEN`, 2× `QR_SIGNING_KEY`, 0 значений `auth`); `tools/check-texts.py i18n/ru.json
flows/*.json` — 31 флоу / 287 ссылок `$t` / 0 расхождений; `tools/check-commands.py
i18n/*.json flows/*.json` — самопроверка ok, 0 нарушений; `node prototypes/check.mjs`
— OK (те же 6 прежних предупреждений `ask-name`/`user-name`); `npm run build:dev`
в `miniapp/` — `tsc -b && vite build` exit 0, чанк `Report` 3.74 КиБ (≈ overview 3.7 КиБ).
Ключей платформы нет (`QADAM_API_KEY`/Keychain), поэтому `tools/check-migrations.py`
**не выполнялся** (упал fail-closed) — сверка `манифест ↔ ap_list_flows ↔ migrations`
сделана точечно по трём объектам пакета (`report-api`, `reports`, `menu`) и составу
флоу (32 = 31 своих + `ChatBot`). `ap_list_translations` в наборе инструментов
отсутствует — живые платформенные переводы `report.*` подтверждены **косвенно**
(прогоны рендерят `report.error.init`/`kind`/`text`/`ok`; ключи есть в
`i18n/{ru,uz,en}.json`).

**Каталог ↔ реальность.** `catalog/flows/report-api.md`, `catalog/tables/reports.md`,
`catalog/flows/menu.md`, `catalog/overview.md`, `docs/DATA-MODEL.md#reports`,
`docs/SPEC.md` (PAR-12), `docs/MINIAPP-UX.md` п. 1, `docs/adr/README.md` —
согласованы с живым проектом; пересчёт overview (32 флоу / 18 таблиц / 16 доменных)
сходится с `ap_list_flows`/`ap_list_tables`. `i18n/*.json`: паритет наборов `report.*`
в ru/uz/en.

**Продукт ↔ прототип (ADR-0027).** `prototypes/app.js renderReport` сверен с
`miniapp/src/routes/Report.tsx` по коду: заголовок, лид, 4 вида, подпись/плейсхолдер
текста, helper контекста, кнопка отправки, экран успеха (`sheet-success`, иконка,
`report.done_title`/`done`, ссылка на `#/events`) и тексты — совпадают. Три названных
в журнале расхождения подтверждаю (текст «мы» вместо «организаторы» — прототип
приведён к `report.lead`; вход из меню; `.chip-row` вместо `.segmented.wrap`).
Прототип после правки берёт те же ключи `report.*` из `i18n` (check.mjs зелёный).

### Замечания

1. **важно** — prod-хвост назван с **неверным механизмом отказа** и недооценённым
   радиусом. Журнал («Журнал», 2026-09-28, `.env.prod`) и «Хвосты» говорят: «иначе
   `build:prod` упадёт на `endpoint('report')`». Это неверно: `npm run build:prod`
   (`tsc -b && vite build --mode prod`) код шага не исполняет и **завершится
   успешно**; падение — **в рантайме**. `miniapp/src/lib/api.ts:90` вызывает
   `endpoint('report')` на верхнем уровне модуля, а `endpoint()` (там же, стр. 63–69)
   кидает `Mini App: не задан конфиг вебхука "report"`; все девять вызовов и
   инлайновая карта `VITE_FLOW_IDS` попадают в **entry-чанк** `index-*.js`
   (проверено на `miniapp/dist/assets/index-…js`: `Rt("report")` и строка ошибки —
   в главном чанке, не в ленивом `Report-*.js`). Значит prod-сборка без ключа
   `report` роняет **всё приложение на старте**, а не только `#/report`, и сборка
   этого **не поймает**. Пакет сознательно dev-only, и действие «добавить ключ
   при promote» названо верно — но запись обязана описывать реальное последствие
   (иначе promote доверится сборке), а в идеале `endpoint()` стоит сделать ленивым,
   чтобы отсутствующий ключ деградировал до одного экрана. Где:
   `docs/work/W123-report-screen.md` («Журнал» и «Хвосты»); при желании — ADR-0050
   п. «Следствия» (prod-промоушен).
   - *Исправлено*: `report` резолвится лениво — `reportApi()` в `miniapp/src/lib/api.ts`,
     вызов внутри `submit` (`Report.tsx`) в try/catch; отсутствие ключа в среде
     теперь роняет только экран `#/report`, не SPA. Формулировка в журнале и
     ADR-0050 приведена к реальному последствию (сборка проходит, падал рантайм;
     радиус — всё приложение). (2026-09-28)

2. **на будущее** — в сверке с прототипом остались **неназванные** расхождения по
   классам (не по составу/поведению). Выбор вида в продукте — `btn btn-outline`
   в `.chip-row` (`Report.tsx:155–171`), в прототипе — `btn-secondary btn-sm`
   в `.segmented.wrap`; вход из «Профиля» в продукте — `btn-secondary btn-block`
   (`Events.tsx:1015`), в прототипе — `btn-outline`; кнопка отправки в продукте
   в `.app-actions` (`Report.tsx:199`), в прототипе — в `.sticky-actions`.
   Названо журналом только `.chip-row` vs `.segmented`; остальное — из той же
   категории «продуктовый аналог/конвенция». Это совпадает с уже принятой
   конвенцией продукта (`Feedback.tsx` использует `btn-outline` и `.app-actions`),
   поэтому не блокер, но ADR-0027 требует назвать **каждое** отличие — дополнить
   список расхождений одной строкой («классы кнопок/контейнера — по конвенции
   продуктовых форм, W45/W77»).
   - *Исправлено*: пункт 4 списка расхождений в «Журнале» называет классовые
     отличия и конвенцию явно. (2026-09-28)

3. **на будущее** — `report-api` сохраняет в run-логи **полный `initData`**
   (`trigger` output: `user.id`, `first_name`, `username`, `language_code`) и текст
   жалобы (`step_5` output, `logInput/logOutput` = true). Это не регресс: все
   вебхук-флоу Mini App ведут себя так же, а W112 цензурировал только триггер
   `tg-router` и шаги с полной строкой `users`/`registrations`/`staff_invites`.
   Но если направление W112 продолжается, `report-api` — очевидный кандидат на
   `logOutput:false` для триггера/`step_5` (там и так видны `telegram_id` и текст).
   Записать кандидатом в бэклог, сейчас не чинить.
   - *Записано*: [Q65](../OPEN-QUESTIONS.md#q65) — кандидат на `logOutput:false`
     для триггера/`step_5` `report-api` в духе W112; не чиним в этом пакете. (2026-09-28)

4. **на будущее** — поверхность злоупотребления: вебхук открыт (`authType: none`),
   гейта нет, `tables-create-records` без ключа и без rate-limit, поэтому любой
   пользователь с валидным `initData` может набить таблицу произвольным числом
   строк и сжечь прогоны. ADR-0050 выбрал «пожаловаться может любой» осознанно,
   но предела/флага/dedup нет вовсе. Кандидат в OPEN-QUESTIONS/бэклог (лимит или
   пометка частых отправителей) — не дефект пакета.
   - *Записано*: [Q65](../OPEN-QUESTIONS.md#q65) — предел злоупотребления
     открытым вебхуком `report-api`; осознанный выбор ADR-0050, лимита нет. (2026-09-28)

5. **на будущее** — ключ `report.retry` заведён в `i18n/{ru,uz,en}.json`
   (`"Повторить"`), но `Report.tsx` его не читает (кнопка повтора — та же
   `report-submit`). `check-texts.py` сторожит только флоу, поэтому мёртвая строка
   проходит незамеченной; мелкая чистка вместе с ревизией архива ключей.
   - *Исправлено*: ключ `report.retry` удалён из `i18n/{ru,uz,en}.json`. (2026-09-28)

**Снято без замечаний (для протокола).** Деление «несколько жалоб одного человека
легальны» (ADR-0047) — подтверждено: ключ не объявлен, `tables-create-records`.
Инъекции: `text` не уходит в Telegram и не рендерится в SPA (только пишется в таблицу) —
SQL/HTML не Applicable; CSV-инъекция возможна лишь на ручной выгрузке владельца из UI
платформы и в границах пакета не решается. Секретов нет (офлайн-проверка + диф).
`docs/STATUS.md`, `docs/BACKLOG.md` (W123) и журнал согласованы; временный флоу-подписант
`zz-w123-initdata-mint` из живого проекта удалён, но доказательство сохранено в
сохранённых прогонах самого `report-api` (valid/invalid читаются), поэтому gotcha 11
ущерба не нанесла — на будущее: доказывающие флоу держать до вердикта.

### Круг 2 — повторное ревью после правок (`fcc27cd`)

Проверено по живому репозиторию (ветка `w123-report-screen`, `fcc27cd`) и bash-сборкой;
живой инстанс не перепроверялся целиком — правки клиентские/документальные, и это
подтверждено (ниже). Все замечания круга 1 сняты, новых нет.

- **«важно» 1 (prod-хвост) — закрыто.** В `miniapp/src/lib/api.ts` больше нет
  верхнеуровневого `endpoint('report')`: вместо него `export function reportApi()`,
  внутри которой и вызывается `endpoint('report')`. Все верхнеуровневые
  `endpoint(...)` теперь только для ключей, присутствующих в **обеих** картах
  (`.env.dev` — 9 «старых» ключей + `report`; `.env.prod` — 9 «старых», без
  `report`). В `Report.tsx` endpoint резолвится внутри `submit` в `try/catch`
  (при отсутствии ключа — `report.error.server`, падает только экран). Доказано
  на свежем `npm run build:dev` (exit 0): в главном чанке
  `dist/assets/index-*.js` вызов имеет вид `function lp(){return Rt("report")}` —
  **внутри функции**, тогда как остальные `Rt("…")` остались на верхнем уровне;
  в ленивом `Report-*.js` обращений к endpoint нет. `grep` по `miniapp/src`:
  `reportApi` — определение в `api.ts` и единственный вызов в `Report.tsx`.
- **«на будущее» 2 — закрыто.** В «Журнале» появился пункт 4 списка расхождений
  с прототипом: `btn btn-outline` в `.chip-row` vs `btn-secondary btn-sm`
  в `.segmented.wrap`; вход из «Профиля» `btn-secondary btn-block` vs
  `btn-outline`; отправка в `.app-actions` vs `.sticky-actions` — с ссылкой на
  конвенцию продуктовых форм `Feedback.tsx`/`Manage.tsx` (W45/W77).
- **«на будущее» 5 — закрыто.** `report.retry` удалён из `i18n/{ru,uz,en}.json`
  (`grep -rn report.retry` по живому коду/i18n/каталогу/флоу — пусто; остаётся
  только в тексте круга 1 этого журнала). Паритет наборов сохранён: `report.*` —
  25/25/25 в ru/uz/en, полных расхождений `missing`/`extra` нет.
- **«на будущее» 3 и 4 — записаны.** Новая `Q65` (`docs/OPEN-QUESTIONS.md`, индекс
  + секция): `logOutput:false` для триггера/`step_5` `report-api` и предел
  злоупотребления открытым вебхуком; оба помечены как осознанные следствия
  ADR-0050, не чинятся в пакете.
- **Ответы владельца** — под каждым из пяти замечаний («Исправлено»/«Записано»).
- **Ложного утверждения про `build:prod` в текущем тексте нет.** «Журнал»
  (2026-09-28, `.env.prod`) и «Хвосты» теперь говорят: `build:prod` **проходит**,
  падал рантайм, радиус старого бага — весь SPA; ADR-0050 («Следствия») приведён
  к тому же («отсутствие ключа ломает только экран `#/report`»). Старая неверная
  формулировка осталась лишь **цитатой** внутри замечания круга 1 — это история
  ревью, а не действующее утверждение.
- **Живой инстанс не менялся.** `ap_export_table reports` — 0 записей, схема и
  отсутствие ключа те же; `ap_find_records migrations package=W123` — те же 5 строк,
  `commit 6436905…`, `report-api publish plaa2GTA8W2dToANOUmZW`,
  `menu publish 2hFzN2UlxECze9iHLk37q`; `flows/_manifest.json` не менялся;
  `fcc27cd` не трогает `flows/` и `catalog/`. Правки клиентские и документальные —
  переопубликации не требуют.
- **Офлайн — все exit 0:** `check-export-secrets.sh`, `check-texts.py i18n/ru.json
  flows/*.json` (31 флоу, 287 ссылок, 0 расхождений), `check-commands.py
  i18n/*.json flows/*.json`, `node prototypes/check.mjs`; `npm run build:dev` — OK
  (чанк `Report` 3.82 КиБ).

**Итог круга 2: замечаний нет.** Пакет может переходить в `готов` (после действий
владельца: статус и коммит вердикта — за ним; живой вход в Telegram и prod-promote
остаются названными хвостами).

## Хвосты и блокеры

- **prod — отдельный шаг** (решение владельца): создать `reports` и
  `report-api` в `events-prod`, добавить id в `miniapp/.env.prod`, опубликовать,
  строки `migrations` на prod. До этого `.env.prod` без ключа `report`; благодаря
  ленивому `reportApi()` это ломает только экран `#/report` (раньше уронило бы
  весь SPA), а промоушен обязан добавить ключ.
- **`check-migrations.py`** (нужен ключ платформы, сеть) — прогнать на ревью/приёмке.
- **Живой вход из меню и «Профиля» в Telegram** (клик по кнопке `web_app`) —
  на владельца; серверный путь доказан curl'ом.
