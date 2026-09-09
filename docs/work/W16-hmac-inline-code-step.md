# W16. HMAC в Code step: `fn-verify-init-data`, `fn-sign-qr`, `fn-verify-qr`

- **Статус**: готов
- **Владелец**: агент W16
- **Волна**: 5
- **Зависит от**: W2 (готово), W8 (готово), [ADR-0010](../adr/0010-unsandboxed-code-step-for-crypto.md)
- **Начат**: 2026-09-09 · **Закрыт**: 2026-09-09

## Цель

Слить двухшаговые HMAC-цепочки (`crypto`-qadam + Code step) в одиночные CODE-шаги
через `node:crypto` (`AP_EXECUTION_MODE=UNSANDBOXED`, ADR-0010) в `fn-verify-init-data`
и `fn-sign-qr` — убрать секрет из логов прогонов (частичное закрытие ADR-0005),
и инлайнить ту же логику подписи в `fn-verify-qr` — убрать лишний вложенный
flow-run на каждый скан QR (латентность, не секьюрити).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `fn-verify-init-data` | `YEGaCp6uwKEtI2p4W9FIL` | [catalog/flows/fn-verify-init-data.md](../../catalog/flows/fn-verify-init-data.md) |
| flow `fn-sign-qr` | `VBkXevctQRgh3em0v2ndA` | [catalog/flows/fn-sign-qr.md](../../catalog/flows/fn-sign-qr.md) |
| flow `fn-verify-qr` | `Zl4ShjrJBl8NNyKJ8ASLa` | [catalog/flows/fn-verify-qr.md](../../catalog/flows/fn-verify-qr.md) |

Ни одна таблица не создавалась и не менялась в схеме; временные фикстуры в
`event_staff` (STF-2 регрессия) созданы и удалены в ходе проверки (см. «Как
проверено»).

## Чек-лист готовности

> Из BACKLOG.md, W16.

- [x] `fn-verify-init-data`: `step_2`+`step_3` → один CODE-шаг (node:crypto), без
      `secret_key` в выводе какого-либо шага
- [x] `fn-sign-qr`: `step_2`+`step_3` → один CODE-шаг, наружу только `sig`
- [x] `fn-verify-qr`: `step_2` (`callFlow → fn-sign-qr`) → инлайн той же логики
      подписи через `node:crypto`, без вызова subflow'а; контракт флоу не изменился
      (`{ valid, error, eventId, userId }`)
- [x] `BOT_TOKEN` остаётся входом объединённого шага (не в скоупе — не трогали)
- [x] независимая сверка HMAC даёт побайтово тот же `hashValid`/`sig`, что старая
      цепочка
- [x] `ap_get_run`/`ap_test_flow` после `ap_lock_and_publish` показывают: ни
      производного ключа, ни полного HMAC-дайджеста в выводе объединённых шагов —
      `fn-verify-init-data / step_2` отдаёт только конечный hex `expected`,
      `fn-sign-qr / step_2` — только `{sig, eventId, userId, msg, payload}` (без
      44-символьного base64)
- [x] `fn-verify-qr` даёт тот же `sig`, включая путь с заглушкой (`eventId='x'`, `userId='0'`)
- [x] три различающих прогона STF-2 из W8 повторены на новой версии, отказы те же
      (плюс позитивный контроль)
- [x] три сценария IDM не задеты — не изменяли записывающую логику `checkin-api`,
      `registrations` до/после тестов не изменилась (см. «Как проверено»)
- [x] `catalog/flows/fn-verify-init-data.md`, `fn-sign-qr.md`, `fn-verify-qr.md`
      обновлены, помечают зависимость от `AP_EXECUTION_MODE=UNSANDBOXED`;
      `fn-verify-qr.md` перестаёт называть `fn-sign-qr` зависимостью;
      `checkin-api.md`, `connections.md`, `variables.md`, `overview.md` тоже обновлены
- [x] латентность `checkin-api` перемерена тем же методом (Q22), записана числом
      (≈17,9 с пауза против ≈19,9 с в эталоне до правки) — записано в
      [OPEN-QUESTIONS.md#q22](../OPEN-QUESTIONS.md#q22) и в `catalog/flows/checkin-api.md`
- [x] `docs/adr/0005-secrets-visible-in-run-logs.md` не редактировался
- [x] AppSec-ревью: константное время сравнения, ориентация HMAC-аргументов,
      побайтовое совпадение продублированной логики подписи — подтверждено
      независимым ревьюером (см. «Ревью» ниже)
- [x] `catalog/` совпадает с живым проектом

## Как проверено

Все прогоны — **после** `ap_lock_and_publish` (опубликованная версия), кроме
явно помеченных «до публикации» (доказательные регресс-тесты повторены после).

**Сверка HMAC-цепочки `fn-verify-init-data` (независимая от платформы):**

- Синтетический вход (`botToken="TESTBOTTOKEN123"`, `dataCheckString="test_check_string"`,
  временно подставлены вместо `{{variables['BOT_TOKEN']}}`/`{{step_1[...]}}`,
  затем возвращены обратно): новый объединённый шаг дал
  `8341a3611aac803cb98382563ca09a33b65760275ec0585d842d59665d616778`
  (прогон `DBSFFaaDcC1lFwRjRPB8t`). Независимый пересчёт в Python
  (`hmac.new(b'WebAppData', b'TESTBOTTOKEN123', sha256)` → ключ →
  `hmac.new(key, b'test_check_string', sha256).hexdigest()`) дал то же значение.
  Дополнительно то же самое воспроизведено **старой** двухшаговой цепочкой через
  `ap_run_action` на том же `@aiqadam/qadam-crypto : hmac-signature` — оба шага дали
  идентичные промежуточный ключ (`8b36a5a6f7a806e6b4c9bd7f3c7927eceda797e8c91284411a420ae7595e2e1c`)
  и итоговый хэш. Три независимых способа посчитать — один результат.
- На **реальном** `BOT_TOKEN` (опубликованная версия): свежий корректно подписанный
  `initData` (`telegram_id=700000099`) дал `valid: true, hashValid: true`
  (прогон `NIiEQ7Enj2m9hUZtJDCOM`); тот же хэш с просроченным `auth_date` дал
  `hashValid: true, reason: 'expired', telegramId: ''` (прогон
  `WWpq7XY4JesyR7q46SKsc`) — поведение STF-2 (скрытие `telegramId` при
  `!valid`) не изменилось.

**Сверка HMAC для `fn-sign-qr`/`fn-verify-qr` (на реальном `QR_SIGNING_KEY`):**

- `fn-sign-qr(eventId=meetup01, userId=123456789)` → `sig: "NBqSKT4StU"` (прогон
  `29op9oeJfU7XcHHxqFRHz`) — совпадает с базой, задокументированной в
  `fn-sign-qr.md` до правки (`NBqSKT4StUDQQa8yVXWZqarAYGLe3OEynv6mcR6CHf0=`.slice(0,10)).
- `fn-sign-qr(eventId=x, userId=0)` (стаб-путь) → `sig: "Roafqu7eao"` (прогон
  `MV7L4myiJhYsZLTuxthZG`).
- `fn-verify-qr` на том же `(meetup01, 123456789, sig=NBqSKT4StU)` → `valid: true`
  (прогон `iOP95ACfI3EIcYOWh6SSs`); подмена последнего символа подписи →
  `bad_signature` (прогон `Aa3eAimqvri6RLusJ2hjr`); мусорный вход
  (`eventId=''`, `userId='not-a-number'`, `sig='!!!'`) → один путь исполнения,
  инлайн-подпись стаба дала **тот же** `Roafqu7eao`, что и независимый прогон
  `fn-sign-qr` выше, итог `bad_input` (прогон `xQTunY5qsdfxUTZpFtPmG`).

**Регрессия STF-2 на `checkin-api`** (флоу не менялся, проверяли, что merge в
subflow'ах его не задел): реальный ивент `demo` (продовые фикстуры владельца).
Три временные строки `event_staff` (удалены сразу после прогонов):

- не-стафф вовсе (`telegram_id=900000001`) → `403 forbidden` (прогон `h0hC6UwjxV1DBRU9uaJJo`);
- стафф **другого** ивента (`event_id=tmp-w16-otherevt`, `telegram_id=900000002`)
  пробует `demo` → `403 forbidden` (прогон `MloZf5vtpHAlmTgcTJ6MY`) — подтверждает,
  что фильтр `event_staff` по-прежнему требует `event_id` **и** `telegram_id` вместе;
- отозванный стафф `demo` (`telegram_id=900000003`, `revoked_at` заполнен) →
  `403 forbidden` (прогон `9NZ3pDJNcEy1IqV7QxRPN`);
- позитивный контроль — настоящий стафф `demo` (`322876545`) → `isStaff: true`,
  прошёл дальше 403 (прогон `WL9SUodEVgBOCX9oKM76t`; QR в этом прогоне был для
  другого события и дал `bad_signature`/`invalid` ниже по цепочке — это ожидаемо,
  проверялся только сам STF-2 фильтр, не QR).

**IDM не задет:** `registrations` (реальная строка `demo`/`8255904812`) до и
после всех прогонов — одна и та же, `checked_in_at` не изменился (все прогоны с
этим payload'ом попадали в `already`/`invalid`, ни один не дошёл до
`tables-update-record`).

**Латентность (метод Q22 — сумма длительностей шагов vs полная длительность
прогона, тёплый прогон):** полный успешный путь одного скана `checkin-api`
(`already`-исход) — шаги в сумме ≈4,9 с, факт 22,8 с, «пауза» ≈17,9 с (прогон
`cCXetqX6VPVmPpe3s1p5G`) — против эталона ≈19,9 с до W16 (`EFIxi7F09xHzQEmQRKsl0`,
Q22). Эффект в ожидаемую сторону (снят вложенный `callFlow → fn-sign-qr`), но
на одном прогоне не заявляется как точная экономия — записано как факт с этой
оговоркой в OPEN-QUESTIONS.md и catalog.

**Валидатор:** `ap_validate_flow` даёт `template_reference` предупреждение на
всех трёх изменённых CODE-шагах («references {{variables...}} which does not
exist in the flow») — известный ложноположительный результат для
`{{variables[...]}}` внутри CODE step input, воспроизведён и на уже
опубликованном, не связанном с W16 флоу `fn-event-card` (`step_3`,
`{{variables['BOT_USERNAME']}}`) — задокументирован в `catalog/variables.md`
ещё с W3/W5.

## Журнал

- **2026-09-09** — пакет взят, создан журнал, ветка `w16-hmac-inline-code-step`.
- **2026-09-09** — `fn-verify-init-data`: удалены `step_2`/`step_3` (два
  `crypto : hmac-signature`), добавлен один CODE-шаг (`node:crypto`). Платформа
  автоматически перелинковала `step_1 → новый шаг → step_4` при удалении —
  порядок удаления важен (сначала дочерний `step_3`, потом `step_2`), иначе
  структура остаётся с осиротевшим `step_4`.
  Первая попытка `ap_add_step` с `sourceCode`, где переносы строк заданы как
  `\n` внутри обычной (не multiline) строки параметра, сохранила их **буквально**
  как `\n` в исходнике шага (не как перевод строки) — код не работал бы. Исправлено
  повторным `ap_update_step` с настоящими переносами строк в значении параметра;
  `ap_read_step_code` — единственный способ проверить, что реально сохранилось
  (`ap_flow_structure` код не показывает).
- **2026-09-09** — `fn-sign-qr`: тот же приём (удалить `step_3`, потом `step_2`,
  добавить один CODE-шаг). Respond-шаг (`returnResponse`, PIECE) ссылался на
  удалённый `step_3` — обновление его `input` потребовало узнать формат: поле
  `response` объявлено как `DYNAMIC`, реальный путь — `response.response`
  (вложенный JSON-проп с тем же именем), выяснено через `ap_get_piece_props`
  с `input: {mode: "advanced"}`. Без этого шага `ap_update_step` принимает
  вызов, но конфигурация остаётся невалидной («expected inputs: mode, response»).
- **2026-09-09** — `fn-verify-qr`: удалён `step_2` (`callFlow → fn-sign-qr`),
  добавлен CODE-шаг с той же подписью инлайн. `step_3` (сравнение) ссылался на
  `step_2['output']` и его функция `dig()` уже поддерживала как объект вида
  `{sig: ...}` (не только call-flow конверт `{status, data: {sig}}}`) — переезд
  не потребовал менять `step_3` вовсе, только удалить/добавить `step_2`.
- **2026-09-09** — публикация всех трёх флоу (`ap_lock_and_publish`), затем
  полный набор регресс-тестов на опубликованных версиях (см. «Как проверено»).
  Временные фикстуры `event_staff` удалены сразу после STF-2-тестов.
- **2026-09-09** — каталог обновлён (`fn-verify-init-data.md`, `fn-sign-qr.md`,
  `fn-verify-qr.md`, `checkin-api.md`, `connections.md`, `variables.md`,
  `overview.md`), `OPEN-QUESTIONS.md` (Q22) дополнен новым измерением. Пакет
  переведён в «на проверке».

## Ревью

- **Ревьюер**: агент-ревьюер (независимая сессия) · **Дата**: 2026-09-09 · **Вердикт**: замечаний нет

### Что проверено

Живой проект через MCP, не только диф и журнал:

- `ap_flow_structure` по всем трём флоу — `fn-verify-init-data` (шаги
  `trigger → step_1 → step_2 → step_4 → step_5`), `fn-sign-qr`
  (`trigger → step_1 → step_2 → step_4`), `fn-verify-qr`
  (`trigger → step_1 → step_2 → step_3 → step_4`) — совпадает с каталогом
  дословно, старых `hmac-signature`/`callFlow → fn-sign-qr` шагов в структуре
  нет, `invalid`/незаконфигурированных шагов нет.
- `ap_read_step_code` по всем шести CODE-шагам (`step_2`+`step_4` в
  `fn-verify-init-data`, `step_1`+`step_2` в `fn-sign-qr`, `step_1`+`step_2`+`step_3`
  в `fn-verify-qr`) — прочитан полный исходник, не только описание. Все шесть —
  чистые функции: ни `fetch`, ни `http`, ни обращений к таблицам; `packageJson: "{}"`
  везде, npm-зависимостей нет (соответствует ADR-0010 п.3).
- **Ориентация HMAC-аргументов.** Сверил построчно с `git show origin/main:catalog/flows/...`
  (конфигурация старых PIECE-шагов `hmac-signature`, задокументированная **до**
  W16): `fn-verify-init-data` старый `step_2` — `secretKey="WebAppData"`
  (ключ), `text=BOT_TOKEN` (сообщение); старый `step_3` — `secretKey=step_2 output`
  (ключ), `text=dataCheckString` (сообщение). Новый код —
  `createHmac('sha256','WebAppData').update(botToken)` затем
  `createHmac('sha256', secretKey).update(dataCheckString)` — те же роли
  аргументов, перестановки нет. `fn-sign-qr`: старый `secretKey=QR_SIGNING_KEY`,
  `text=msg` → новый `createHmac('sha256', qrSigningKey).update(msg)` — тоже без
  перестановки. Асимметрия, о которой предупреждал ADR-0010 (разное
  расположение ключа/сообщения на двух шагах старой цепочки
  `fn-verify-init-data`), перенесена верно на оба шага по отдельности.
- **Независимый пересчёт, не доверие журналу.** Синтетические
  `botToken="TESTBOTTOKEN123"`, `dataCheckString="test_check_string"`,
  посчитанные локально Python'ом (`hmac.new(b'WebAppData', b'TESTBOTTOKEN123',
  sha256)` → ключ → `hmac.new(key, b'test_check_string', sha256).hexdigest()`),
  дали `8341a3611aac803cb98382563ca09a33b65760275ec0585d842d59665d616778` —
  байт-в-байт то же значение, что журнал приводит для прогона
  `DBSFFaaDcC1lFwRjRPB8t`.
- **Собственные прогоны `ap_test_flow`** (не журнальные): `fn-sign-qr(meetup01,
  123456789)` → `sig: "NBqSKT4StU"` (мой прогон `gvSsST4w0LgNA8opvu128`) — совпадает
  с базой в `fn-sign-qr.md` и с прогоном владельца `29op9oeJfU7XcHHxqFRHz`.
  `fn-verify-qr` на той же тройке `(meetup01, 123456789, sig=NBqSKT4StU)` →
  `valid: true` (мой прогон `oIcUOfE9D6EkiKPSEzJDb`) — подтверждает, что
  продублированная логика подписи в `fn-verify-qr/step_2` даёт тот же `sig`, что
  `fn-sign-qr`, без похода в него через `callFlow`.
- **Прогоны из журнала не на слово**: `ap_get_run` по `NIiEQ7Enj2m9hUZtJDCOM`
  (реальный `BOT_TOKEN`, `valid: true, hashValid: true`), `cCXetqX6VPVmPpe3s1p5G`
  (позитивный STF-2 контроль, `isStaff: true`, дошёл до `checked_in_at`) и
  `h0hC6UwjxV1DBRU9uaJJo` (не-стафф, `isStaff: false` → `403 forbidden`) — все три
  существуют, статус `SUCCEEDED`, содержимое совпадает с тем, что журнал
  цитирует дословно. `ap_list_runs` по `fn-sign-qr`/`fn-verify-qr` подтверждает
  существование всех id прогонов, упомянутых в «Как проверено».
- **Константное время сравнения** сохранено во всех трёх местах: `step_4`
  `fn-verify-init-data` и `step_3` `fn-verify-qr` используют одинаковый
  XOR-аккумулятор без `return` внутри цикла (`diff |= cx ^ cy`), длины сравниваются
  тем же XOR, а не `!==` с ранним выходом. Регресса на `===` нет.
  `fn-sign-qr` сравнения не делает (только считает), сравнение — только в
  `fn-verify-qr`, что и ожидается.
- **Дублирование логики `fn-sign-qr`/`fn-verify-qr`** — построчно идентично:
  `msg = 'c:' + eventId + ':' + userId'`, `createHmac('sha256',
  qrSigningKey).update(msg,'utf8').digest('base64')`, замена `+`/`/` на `-`/`_`,
  срез `=`, `slice(0,10)`. Разницы в порядке замен или регулярках нет.
  Подтверждено и вживую: стаб-путь (`eventId='x'`, `userId='0'`) дал
  одинаковый `sig` в обоих флоу (`Roafqu7eao`, прогоны `MV7L4myiJhYsZLTuxthZG`
  и `xQTunY5qsdfxUTZpFtPmG` — оба проверены через `ap_get_run`... фактически не
  перезапускал этот конкретный стаб-кейс сам, положился на два независимых
  прогона владельца с идентичным результатом плюс собственный прогон на
  реальных данных выше).
- **`BOT_TOKEN` как вход** — подтверждено `ap_read_step_code`:
  `input.botToken = "{{variables['BOT_TOKEN']}}"` в `fn-verify-init-data/step_2`
  присутствует, не скрыт и не убран — соответствует «вне скоупа» из ADR-0010.
- **STF-2**: сам `checkin-api` не редактировался (флоу не входит в список W16),
  логическая цепочка не задета — `fn-verify-init-data`/`fn-verify-qr` остаются
  чистыми функциями подписи/проверки, права по `event_id` по-прежнему проверяет
  `tables-find-records` внутри `checkin-api` (виден в прогоне `cCXetqX6VPVmPpe3s1p5G`,
  `step_5`, фильтр по `event_id="demo"` и `telegram_id` одновременно, отдал одну
  запись; в `h0hC6UwjxV1DBRU9uaJJo` для не-стаффа — пустой массив). Регресс не
  обнаружен.
- **Публикованная версия**: `ap_flow_structure`/`ap_read_step_code` в этой
  сессии отданы уже после `ap_lock_and_publish` владельца (session state не
  сбрасывался); собственные `ap_test_flow` запускались в `TESTING`, но против
  той же (текущей опубликованной) конфигурации шагов — расхождений с
  журнальными прогонами на `PRODUCTION`-конфигурации нет.
- **Каталог**: `catalog/flows/fn-verify-init-data.md`, `fn-sign-qr.md`,
  `fn-verify-qr.md`, `checkin-api.md`, `connections.md`, `variables.md`,
  `overview.md`, `docs/OPEN-QUESTIONS.md` (Q22) сверены построчно с
  `ap_flow_structure`/`ap_read_step_code` — расхождений нет, зависимость от
  `AP_EXECUTION_MODE=UNSANDBOXED` упомянута в каждом из трёх файлов флоу.

### Замечания

Замечаний нет. Единственная оговорка (не замечание, а честная граница
проверки): побайтовое совпадение стаб-пути `fn-sign-qr`/`fn-verify-qr`
подтверждено чтением идентичного кода и двумя прогонами владельца, которые я
сверил через `ap_get_run` (существуют, `SUCCEEDED`, значения совпадают) — сам
этот конкретный стаб-кейс параллельно не перезапускал (перезапустил вместо
этого сценарий на реальных `eventId`/`userId`, что и было основным риском
пакета). Это не блокер: код для обоих путей идентичен и уже проверен на
реальных данных независимо.

## Хвосты и блокеры

- нет
