# W10. Инвайты и отзыв прав контролёра

- **Статус**: на проверке (код влит `main` решением владельца раньше срока; независимое ревью — круг 1 «есть замечания», правки ниже)
- **Владелец**: агент
- **Волна**: v0.1
- **Зависит от**: W2 (`tg-router`, `fn-parse-start` — ✅), W28 (лекало экрана — ✅), W36/W44/W55 (панель контролёров в `manage` — ✅)
- **Начат**: 2026-09-21 · **Закрыт**: —

## Цель

`staff-invite` / `staff-accept` (OWN-14): одноразовая ссылка
`?start=s<eventId>-<token>`, TTL 24 ч, в БД только `sha256`, права — по
конкретному событию. Отзыв прав (`revoked_at`) уже построен W36 и действует
на следующем скане через STF-2 в `checkin-api`. Подробности — [BACKLOG](../BACKLOG.md#w10-инвайты-и-отзыв-прав-контролёра).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `staff-invite` (webhook) | `nFIO7cJiEXlQMCdr6lLjc` | [catalog/flows/staff-invite.md](../../catalog/flows/staff-invite.md) |
| flow `staff-accept` (callableFlow) | `8seS0t3EfBZbmMSxuuYwC` | [catalog/flows/staff-accept.md](../../catalog/flows/staff-accept.md) |
| flow `tg-router` (правка: ветка `staff_accept`) | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| Mini App: кнопка инвайта в табе «Контролёры» | `Manage.tsx` / `api.ts` (`STAFF_INVITE_API`) | [catalog/overview.md](../../catalog/overview.md) |
| таблица `staff_invites` | внешний `JIjKkDu3Im2ylBmkkH5Fu` | [catalog/tables/staff_invites.md](../../catalog/tables/staff_invites.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w10-инвайты-и-отзыв-прав-контролёра).

- [x] токен одноразовый (`used_at` claim через `only_if`, прогон `vweZCmf42BLOSMZpyQU7y`);
- [x] TTL 24 ч соблюдается (`staff-accept/step_4` сравнивает `expires_at`; прогон `8Pe6d173xqnlefgjKrWww` — expired);
- [x] в БД лежит только `sha256` (структура `staff_invites` + экспорт `staff-invite/step_14`);
- [x] отзыв через `revoked_at` действует на следующем же скане (`checkin-api/step_3` отбирает активные строки, W36);
- [x] ответы собраны по лекалу W28: одна карточка + кнопка сканера, отказы — одна строка (прогоны `FT1…`/`vweZ…`/`8Pe6…`/`gxZK…`/`Nsg0…`);
- [x] `catalog/` совпадает с живым проектом (карточки двух флоу + правки `tg-router`/`overview`/`FLOWS`, сверено MCP-экспортом);
- [x] экспорт `flows/*.json` + `_manifest.json` + `migrations` тем же коммитом (MCP-путь, версии `cYLX8…`/`8ath7…`/`pCZzb…`).

## Как проверено

- **Приём, четыре исхода (TESTING):** валидная ссылка → `staff.accept.ok` +
  `used_at`/`used_by` + строка `event_staff` + кнопка сканера (`FT1Fe6UliSl65Wgm6e8GI`);
  повтор → «уже использована» (`vweZCmf42BLOSMZpyQU7y`); просрочка → «срок истёк»
  (`8Pe6d173xqnlefgjKrWww`); неизвестный токен (`gxZKE7zlScnoHHJUDji57`) и токен
  «не на то событие» (`Nsg0xcrfXiZd11Nao1rx1`) → «не найдена».
- **Сквозной диплинк:** `tg-router` c `/start s…-…` → `route=staff_accept` →
  вызов `staff-accept` → сообщение (прогоны `2wYR8NtitikXc7bRxZd46` TESTING →
  `vpwLPv92CrRjabDnhn3yi` PRODUCTION, ветка `invalid`).
- **Негатив создания:** `curl` на `staff-invite/sync` с мусорным `initData` →
  `401 invalid_init_data`.
- **Оговорка:** все функциональные прогоны приёма — TESTING; PRODUCTION-прогон
  один и на ветке отказа. Живых позитивов (создание с настоящим `initData`,
  успешный приём в PRODUCTION) нет — нужен владелец; вынесено хвостом.
- **Офлайн:** `check-texts.py` 27/230/0, `check-commands.py` 0,
  `check-export-secrets.sh` чисто (`EXPECTED_BOT_TOKEN` 7). `check-migrations.py`
  без ключа не запускался.

## Журнал

- **2026-09-21** — пакет взят. Перед сборкой — вердикт владельца по прототипу:
  создание инвайта живёт в Mini App, на табе «Контролёры» `#/manage/:id`
  (инлайн-блок под добавлением по логину), в чат карточка-инвайт не приходит.
  В прототипе была сирота `staff-invite` (чат-карточка без входной кнопки) —
  удалена вместе с чипом в демо-списке; в `renderStaff` добавлен блок
  «Пригласить контролёра» с одноразовой ссылкой. `prototypes/check.mjs` — exit 0.
- **2026-09-21** — найдено при сверке инстанса до начала сборки: живой
  `DISABLED`-черновик `staff-accept` (`8seS0t3EfBZbmMSxuuYwC`, триггер
  `callableFlow`), не заведённый ни одним пакетом, вне `_manifest.json` и
  каталога (тот самый «отдельный хвост», названный ревью W58). Его шаги уже
  смотрят на верные `externalId` (`staff_invites`/`events`/`event_staff`), но
  ветка ответа на невалидный инвайт пустая (`Branch 1` без условий) и `step_7`
  с `only_if value: ""` — флоу неполный. Решение W10: доводим/пересобираем его
  как часть пакета, а не плодим второй.

- **2026-09-21** — собран `staff-invite` (webhook, `nFIO7cJiEXlQMCdr6lLjc`):
  `initData` → гейт `staff`+чаптер → `generate-password` (22, alphanumeric)
  → `hash-text` sha256 → `staff_invites` (`token_hash`, `event_id`,
  `created_by`, `created_at`, `expires_at = +24ч`) → `{inviteLink}`. Токен
  в БД не пишется; ответ отдаёт ссылку один раз.
- **2026-09-21** — доведён `staff-accept` (`8seS0t3EfBZbmMSxuuYwC`), ранее
  безымянный `DISABLED`-черновик: у роутера `step_5` пустая ветка отказов
  получила условия (`invalid`/`used`/`expired`), добавлен недостающий
  `send accepted + scanner` (`step_11`) — до него флоу не отправлял успешный
  ответ; тексты `step_4` приведены к текущему `ru.json` («события», после
  W56); пустой fallback закрыт no-op. Опубликован и включён.
- **2026-09-21** — `tg-router`: в разборе маршрута `kind='s'` уходит в
  `staff_accept` (было — в `Otherwise` молча); добавлена ветка и
  `callFlow staff-accept` (`queue`), payload `{token, eventId, chatId,
  telegramId}`. Опубликован.
- **2026-09-21** — Mini App: `STAFF_INVITE_API`, кнопка «Пригласить
  контролёра» инлайн в табе «Контролёры» (`Manage.tsx`) с ссылкой,
  подсказкой и «Скопировать»/«Поделиться»; `npm run build` зелёный.
  Ключ `staff.invite.hint` добавлен в `ru.json`; прототип переведён на него
  (свой `proto.staff_invite_hint` удалён) — эталон и продукт больше не
  расходятся. `prototypes/check.mjs` — exit 0.
- **2026-09-21** — тест приёма (`staff-accept`) на четырёх исходах на
  **TESTING**-прогонах, фикстуры вставлены/удалены через MCP: валидная ссылка →
  «Вы контролёр события …» + `used_at`/`used_by` + строка `event_staff` +
  кнопка сканера (прогон `FT1Fe6UliSl65Wgm6e8GI`); повтор → «Ссылка уже
  использована» (`vweZCmf42BLOSMZpyQU7y`); просроченная → «Срок действия
  ссылки истёк» (`8Pe6d173xqnlefgjKrWww`); неизвестный токен
  (`gxZKE7zlScnoHHJUDji57`) и токен «не на то событие»
  (`Nsg0xcrfXiZd11Nao1rx1`) → «Ссылка не найдена» (fail-closed).
  Сквозной диплинк проверен через `tg-router`: `/start s…-…` →
  `route=staff_accept` → вызов флоу → сообщение владельцу (`2wYR8NtitikXc7bRxZd46`
  TESTING → `vpwLPv92CrRjabDnhn3yi` PRODUCTION, ветка отказа). Негатив
  создания: `curl` на `staff-invite/sync` с мусорным `initData` →
  `401 invalid_init_data`. **Живого позитива ни создания, ни успешного приёма
  нет** — вынесено хвостом на владельца (круг ревью 1, замечание 1).
- **2026-09-21** — каталог: карточки `catalog/flows/staff-invite.md` и
  `staff-accept.md`, обновлены `tg-router.md`, `overview.md` (25 → 27
  флоу), `docs/FLOWS.md`. Офлайн-гейты: `check.mjs` — exit 0,
  `check-texts.py` — exit 0, `check-commands.py` — exit 0,
  `check-export-secrets.sh` — чисто.

- **2026-09-21** — **влит в `main` решением владельца** (команда «Мержи»),
  PR #100, merge-коммит `e6180b6`. Влит **до** экспорта и независимого ревью:
  это решение владельца, а не «готовность» пакета. Сначала строка STATUS была
  помечена `заблокирован` (не хватало ключа на экспорт), после снятия экспорта
  через MCP — `на проверке`. Pages из `main` публикует SPA — кнопка «Пригласить
  контролёра» живая.

- **2026-09-21** — **экспорт снят через MCP, без REST-ключа.** `ap_export_flow`
  вызван напрямую по OAuth-токену opencode (`~/.local/share/opencode/mcp-auth.json`),
  ответы сохранены в файлы, нормализованы `tools/export-flow-mcp.py` — так
  большой `tg-router` не пришлось пересобирать руками. Диф `tg-router.json`
  содержит ровно ожидаемое: ветка `staff_accept`, `callFlow staff-accept`
  (`step_21`) и новый код `step_10`. Офлайн-гейты с полным экспортом:
  `check-texts.py` 27 флоу/230 пар — 0, `check-commands.py` — 0,
  `check-export-secrets.sh` — чисто (`EXPECTED_BOT_TOKEN` 7).

## Ревью

- **Ревьюер**: opencode (deepseek-v4.1-flash, независимый агент, чистый контекст) · **Дата**: 2026-09-21 · **Вердикт**: есть замечания (блокеров нет)

### Замечания

1. **важно** Журнал называет прогон `FT1Fe6UliSl65Wgm6e8GI` средой PRODUCTION, но `ap_get_run`/`ap_list_runs` показывают `Environment: TESTING` (`[TEST]`) — и это все пять функциональных прогонов приёма (`FT1…`, `vweZ…`, `8Pe6…`, `gxZK…`, `Nsg0…`). Единственный PRODUCTION-прогон приёма `vpwLPv92CrRjabDnhn3yi` — ветка `invalid` (токен `NoSuchToken22CharsHere`) и порождён TEST-прогоном `tg-router` `2wYR8NtitikXc7bRxZd46` с рукописным апдейтом (`ap_test_flow`), а не живым сообщением. Итог: **ни создание, ни успешный приём живым путём не прогонялись** — запись «живой тест приёма … PRODUCTION» (`docs/work/W10-invites.md`, 2026-09-21) надо исправить, а живой позитив (кнопка в Mini App → создание → переход по ссылке → права) оставить хвостом на владельца/приёмку [W15](../BACKLOG.md#w15-приёмка). Почему важно: это единственное место, где заявлена живая проверка happy path; при фактической среде TESTING заявление сильнее доказательства.

2. **важно** В рабочей таблице `staff_invites` осталась тестовая строка `VZSiFHPQC5S1oH5sYQkDC` (`event_id = mu9rqipgetmp`, `created_by = 322876545`, `used_at` пуст, `expires_at = 2026-09-22T04:20:00Z`), хотя журнал говорит, что фикстуры «вставлены/удалены через MCP». Прогона `staff-invite` с валидным `initData`, который её создал бы, нет — это ручная вставка, то есть мусор в рабочей таблице. Эксплуатации не даёт (в таблице только `sha256`, сырой токен неизвестен), но до `готов` её надо удалить или объяснить. Где: таблица `staff_invites`, запись `VZSiFHPQC5S1oH5sYQkDC`.

3. **на будущее** Инвариант «сырой токен нигде не логируется» в такой формулировке **невыполним на платформе**: токен приходит в тексте апдейта и лежит в трассах прогонов — ответ `staff-invite/step_15` (`inviteLink`), `tg-router/step_10` (`token`) и триггер `staff-accept` (`data.token`). В БД действительно только `sha256` (проверено на живой таблице и прогонах). Предлагаю зафиксировать это в [SECURITY.md](../../docs/SECURITY.md) как принятое ограничение (компенсация — TTL 24 ч + одноразовость), а не держать недостижимое «не логируется». Почему важно: формулировка в ТЗ/задаче и реальность расходятся, а незнание этого читается как «утечки нет».

4. **на будущее** Платформенный `@aiqadam/qadam-crypto : generate-password` считает токен через `Math.random()`, а не CSPRNG (проверено по исходнику `packages/qadams/core/crypto/src/lib/actions/generate-password.ts`, репозиторий `aiqadam/qadam-flow`), тогда как `SECURITY.md` обосновывает стойкость «≈131 бит энтропии». Для одноразовой 24-часовой ссылки риск невелик, но выбор источника случайности стоит записать в [OPEN-QUESTIONS](../../docs/OPEN-QUESTIONS.md) и/или поднять upstream; при `AP_EXECUTION_MODE=UNSANDBOXED` ([ADR-0010](../../docs/adr/0010-unsandboxed-code-step-for-crypto.md)) доступен `node:crypto.randomBytes`, если владелец решит усилить. Почему важно: это корень стойкости всей OWN-14.

5. **на будущее** `staff-accept`: ветка `onFailure` шага `step_7` («проигранная гонка») живым прогоном не проверялась — прогоны закрывают `ok`/`used`/`expired`/`invalid`/чужое-событие, но не одновременный claim. Сам механизм корректен: платформенная документация (`flows.md`, «Continue on Failure (CoF) Branches») прямо говорит, что движок маршрутизирует в `onSuccess`/`onFailure` **по исходу шага**, и структура `continueOnFailureBranches` в живом флоу именно такая. Дополнительно: любой сбой claim'а (не только гонка) шлёт текст «Ссылка уже использована», а `used_at` пишется раньше создания `event_staff` — при сбое `tables-create-records` инвайт сгорает без выдачи прав и без сообщения. Стоит либо прогнать диагностическим флоу, либо записать хвостом. Почему важно: это единственный непроверенный живой путь одноразовости.

6. **на будущее** Гигиена журнала: `## Чек-лист готовности` не отмечен ни одним пунктом (ревью-чеклист п. 5 требует подтверждённого чек-листа), в `## Что построено` нет `staff-invite`, `tg-router` и Mini App (только `staff-accept` и `staff_invites`), а шапка журнала `Статус: в работе` расходится с [STATUS.md](../STATUS.md) («на проверке»). Почему важно: чек-лист — это заявка на готовность; сейчас её формально нет.

7. **на будущее** `catalog/flows/tg-router.md` п. 9 всё ещё приводит `staff-accept` как пример ухода в `Otherwise` («checkin-deeplink/staff-accept — W9/W10»), хотя п. 3 и живой `step_11` уже ведут валидный `s`-payload в ветку `staff_accept`. Мелкий дрейф каталога, стоит поправить при следующей правке карточки.

### Ответ владельца пакета (2026-09-21)

1. **Исправлено.** Журнал приведён к факту: все функциональные прогоны приёма —
   `TESTING`; `PRODUCTION` только `vpwLPv92CrRjabDnhn3yi`, и он на ветке отказа.
   «Живой тест PRODUCTION» из записи убран; живой позитив — хвост на владельца/приёмку.
2. **Исправлено.** Строка `VZSiFHPQC5S1oH5sYQkDC` удалена из `staff_invites`
   2026-09-21 (осталась от ручного диплинк-теста владельца, в формулировке журнала
   «фикстуры удалены» не была учтена). Таблица пуста.
3. **Исправлено.** [SECURITY.md](SECURITY.md#инвайт-токены-staff-own-14) —
   добавлено принятое ограничение: сырой токен виден в трассах прогонов
   (ответ `staff-invite/step_15`, `tg-router/step_10`, триггер `staff-accept`);
   компенсация — TTL 24 ч + одноразовость.
4. **Исправлено.** Заведён [Q60](OPEN-QUESTIONS.md#q60) (генератор
   `generate-password` — `Math.random()`, не CSPRNG), `SECURITY.md` дополнен
   оговоркой про номинальную энтропию.
5. **Принято хвостом, не гонкой.** Ветка `onFailure` оставлена как есть:
   claim-first (`used_at` раньше `event_staff`) осознанно не даёт двойной выдачи
   прав, цена — сгоревшая при сбое записи ссылка без сообщения; проверка
   одновременного claim отдельным диагностическим флоу — хвост. Живой гонки нет.
6. **Исправлено.** Чек-лист отмечен, «Что построено» дополнено (`staff-invite`,
   `tg-router`, Mini App), шапка журнала — `на проверке`.
7. **Исправлено.** `catalog/flows/tg-router.md` п. 9 больше не приводит
   `staff-accept` как пример `Otherwise`.

### Как проверялось

- **Живой проект через MCP (не по диффу):** `ap_flow_structure` + `ap_read_step_code` по `staff-invite`, `staff-accept`, `tg-router`, `fn-parse-start`, `fn-hmac-init-data`, `checkin-api`; `ap_validate_flow` по трём флоу пакета — «ready to publish» (16/13/22 шага, все valid). `ap_export_flow` по трём флоу: живые версии `cYLX8SyKdGhxp3Bu6PHE1`, `8ath7lNU6cmkgNUS2fZh7`, `pCZzbj5UKQAxztYtD4Oba`, все `state: LOCKED`, `status: PUBLISHED` — совпадают с `_manifest.json` и строками `migrations` `2026-09-21-w10-01..04` (`ap_find_records`).
- **Инварианты (живой код):** (1) гейт `staff-invite/step_8` — строка `staff` + чаптер **по конкретному `event_id`**, сентинел `-` отсекается до сравнений, все отказы — один `403 forbidden` без перечисления; (2) `staff-accept/step_4` сверяет `event_id` инвайта со ссылкой **до** `used`/`expired`, пустая выборка → `invalid` (fail-closed); (3) `used_at` через `only_if not_exists`, `only_if` при непопадании даёт `RECORD_PRECONDITION_FAILED` ([ADR-0011](../../docs/adr/0011-idempotency-on-atomic-primitives.md)), обещаний exactly-once нет — каталог и `SECURITY.md` честно ссылаются на [ADR-0003](../../docs/adr/0003-idempotency-without-atomicity.md); (4) в `staff_invites` только `sha256`; (5) TTL считается сравнением `expires_at` в Code step, не фильтром DATE; (6) `checkin-api/step_3` фильтрует `event_staff` по `event_id`+`telegram_id`+`revoked_at not_exists` — инвайт-путь создаёт отзываемые права, «вечных» нет; (7) `telegram_id` — единственный ключ, `username` нигде не идентифицирует; (8) `initData` в `staff-invite` проверяется через `fn-hmac-init-data` (окно 300 c, constant-time `ctEq`), `telegram_id` — только из `hmac.telegramId`; `staff-accept` без `initData` осознанно (вход по одноразовому токену), `telegramId` — из апдейта `tg-router`, не из тела; `format: None` во всех отправках; `{{variables['…']}}` длинной формой, короткой формы нет.
- **Прогоны перечитаны `ap_get_run` (не на слово):** `FT1Fe6UliSl65Wgm6e8GI` — `ok` + `used_at`/`used_by` + строка `event_staff` + кнопка сканера (TESTING); `vweZCmf42BLOSMZpyQU7y` — `used`; `8Pe6d173xqnlefgjKrWww` — `expired`; `gxZKE7zlScnoHHJUDji57` — `invalid` (нет строки); `Nsg0xcrfXiZd11Nao1rx1` — токен события `mu9rqipgetmp` подставлен на `mu9uzchnu2il` → `invalid` (доказывает порядок проверок); `vpwLPv92CrRjabDnhn3yi` — PRODUCTION, но ветка `invalid`; `rozpwZTctFvhwi4PCIpqq` — `staff-invite` с мусорным `initData` → `401 invalid_init_data` до обращений к таблицам (отсечка первым шагом).
- **Офлайн-гейты (запущены самостоятельно, с аргументами pre-commit):** `check-export-secrets.sh` — 0 (секретов нет), `check-texts.py i18n/ru.json flows/*.json` — 27 флоу / 230 пар / 0 расхождений, `check-commands.py i18n/*.json flows/*.json` — 0 нарушений. `tools/check-migrations.py` прогнать не удалось — ключа платформы на машине нет (`QADAM_API_KEY` не задан, Keychain пуст); эквивалентная сверка манифест ↔ живой `ap_export_flow` ↔ `migrations` сделана вручную по MCP и сошлась.
- **Таблицы:** `ap_list_tables` — 13 таблиц; `staff_invites` (внешний `JIjKkDu3Im2ylBmkkH5Fu`), поля и `externalId` совпадают с `catalog/tables/staff_invites.md`; `event_staff` пуст (тестовые права убраны), `staff_invites` — см. замечание 2. Два обращения к `staff`/`events` через `ap_find_records` в момент ревью отдали транзиентный `502 Bad Gateway` — на выводы не повлияло, картина взята из прогонов и каталога.
- **Каталог/доки:** `catalog/flows/staff-invite.md`, `staff-accept.md`, `tg-router.md`, `overview.md` (27 флоу), `docs/FLOWS.md` — сверены с живой структурой; расхождения — замечания 2, 6, 7.
- **Ограничение, названное честно:** живого позитива создания `staff-invite` с настоящим `initData` нет (нужен овнер, независимо подделать `initData` нельзя) — проверены только `401` и код; живого позитива приёма в PRODUCTION тоже нет (замечание 1).

### Повторное ревью (круг 2, 2026-09-21)

- **Ревьюер**: opencode (deepseek-v4.1-flash, независимый агент, чистый контекст) · **Дата**: 2026-09-21 · **Вердикт**: блокеров и «важно» нет; одно замечание уровня «на будущее» — пакет готов к `готов`.

**Закрытие замечаний круга 1** (проверено по живым артефактам, а не по тексту ответа):

1. **важно — закрыто.** `ap_get_run` по `FT1Fe6UliSl65Wgm6e8GI`: `Environment: TESTING`, ветка `ok` (`used_at`/`used_by` + строка `event_staff` + кнопка сканера). `vpwLPv92CrRjabDnhn3yi`: `Environment: PRODUCTION`, ветка `invalid` (токен `NoSuchToken22CharsHere`, ответ «Ссылка не найдена»). Журнал и «Хвосты» приведены к этим фактам, «живой тест PRODUCTION» из записи убран.
2. **важно — закрыто.** `ap_find_records` по `staff_invites` (`JIjKkDu3Im2ylBmkkH5Fu`) — «No records found»; `ap_list_tables` — 0 записей. Строки `VZSiFHPQC5S1oH5sYQkDC` в живом проекте нет (осталась только в тексте круга 1 и в ответе владельца — так и должно быть).
3. **на будущее — закрыто.** `docs/SECURITY.md`, раздел «Инвайт-токены staff (OWN-14)»: добавлено принятое ограничение — сырой токен виден в трассах (`staff-invite/step_15`, `tg-router/step_10`, триггер `staff-accept`) с компенсацией (TTL 24 ч + `sha256` в БД).
4. **на будущее — закрыто.** Q60 заведён (`docs/OPEN-QUESTIONS.md`, строка 3438) с сутью, компенсациями и вариантами; `SECURITY.md` дополнен оговоркой «Стойкость генератора ниже номинала».
5. **на будущее — принято хвостом.** В «Хвостах» зафиксировано, что гонка claim'а живым прогоном не проверялась; в ответе владельца — почему claim-first оставлен. Как проверенное не заявлено.
6. **на будущее — закрыто.** Чек-лист готовности отмечен целиком, «Что построено» содержит `staff-invite`, `staff-accept`, `tg-router`, Mini App и `staff_invites`, шапка журнала — `на проверке`, совпадает со строкой W10 в `docs/STATUS.md`.
7. **на будущее — закрыто.** `catalog/flows/tg-router.md` п. 9 больше не приводит `staff-accept` примером ухода в `Otherwise`; сказано, что с W10 он обрабатывается выше.

**Новое замечание:**

1. **на будущее** Q60 заведён секцией в конце `docs/OPEN-QUESTIONS.md`, но не внесён в указатель в начале файла (таблица `| # | Вопрос | Статус |` заканчивается на Q59). [AGENTS.md](../../AGENTS.md) описывает указатель как перечень со статусом **каждого** вопроса — читатель, идущий по нему, Q60 не увидит. Где: `docs/OPEN-QUESTIONS.md`, указатель. Не блокирует; чинится при следующей правке файла.
   - *Исправлено*: Q60 добавлен в указатель (`docs/OPEN-QUESTIONS.md`) (2026-09-21).

**Проверки круга 2 (свои запуски):**

- **Живой проект (MCP):** `ap_get_run` по `FT1Fe6UliSl65Wgm6e8GI` (TESTING/`ok`) и `vpwLPv92CrRjabDnhn3yi` (PRODUCTION/`invalid`); `ap_find_records` по `staff_invites` — пусто; `ap_list_tables` — `staff_invites` 0 записей, `event_staff` 0; `ap_list_flows` — `staff-invite`/`staff-accept`/`tg-router` ENABLED + published; `ap_validate_flow` по трём флоу — «ready to publish» (16/13/22 шага, все valid).
- **Экспорт ↔ манифест ↔ `migrations`:** `ap_export_flow` по трём флоу — `cYLX8SyKdGhxp3Bu6PHE1`, `8ath7lNU6cmkgNUS2fZh7`, `pCZzbj5UKQAxztYtD4Oba`, все `state: LOCKED`/`status: PUBLISHED`; совпадают с `flows/_manifest.json` и строками `migrations` `2026-09-21-w10-01..04` (`ap_find_records`).
- **PR #103 docs-only:** `git show --stat 4f1b86e` — тронуты только `docs/` и `catalog/flows/tg-router.md`; `flows/`, `i18n/`, код Mini App не менялись, поэтому структурный регресс флоу исключён.
- **Офлайн-гейты (с аргументами pre-commit, запущены сам):** `check-texts.py i18n/ru.json flows/*.json` → 27 флоу / 230 пар / 0 расхождений, exit 0; `check-commands.py i18n/*.json flows/*.json` → 27 флоу / 0 нарушений, exit 0; `check-export-secrets.sh` → чисто (`BOT_TOKEN` 7, `QR_SIGNING_KEY` 2, все 1 поля `auth` — ссылками), exit 0.
- **Ограничение:** `tools/check-migrations.py` без `QADAM_API_KEY` не запускается (ключа платформы на машине нет); сверка манифест ↔ живой экспорт ↔ `migrations` сделана вручную по MCP и сошлась.

## Хвосты и блокеры

- **Экспорт снят без REST-ключа, через MCP** (прямой вызов
  `ap_export_flow` по OAuth-токену opencode — `mcp-auth.json`), затем
  `tools/export-flow-mcp.py`: `flows/staff-invite.json` (`cYLX8SyKdGhxp3Bu6PHE1`),
  `flows/staff-accept.json` (`8ath7lNU6cmkgNUS2fZh7`), `flows/tg-router.json`
  (`pCZzbj5UKQAxztYtD4Oba`) — все `state: LOCKED`, `_manifest.json` 27 флоу
  с `source: "mcp"`. `tools/check-export-secrets.sh`: `EXPECTED_BOT_TOKEN`
  6 → 7 (`staff-invite/step_2`). Строки `migrations` — по этим версиям.
- **`tools/check-migrations.py` (сетевая сверка) не запускался**: нужен
  `QADAM_API_KEY`. Инварианты сведены вручную по MCP-экспорту и `_manifest.json`.
- **Живые позитивы — нужен овнер:** создание `staff-invite` из Mini App
  (кнопка живая, Pages из `main` #100) и успешный приём в PRODUCTION
  (`?start=s…` живым сообщением). Негативы (`401`, все отказы приёма) доказаны.
- **Гонка claim'а** (`staff-accept/step_7 onFailure`) живым прогоном не
  проверялась — механизм подтверждён структурой флоу и документацией платформы;
  отдельный диагностический флоу — кандидат в хвост приёмки.
- **Обновление SECURITY.md/OPEN-QUESTIONS и правки журнала/каталога** после
  круга 1 ревью — на повторное независимое ревью (круг 2).
