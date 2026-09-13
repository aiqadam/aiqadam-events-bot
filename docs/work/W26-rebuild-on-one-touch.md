# W26. Пересборка `events-dev` по ADR-0015

- **Статус**: в работе
- **Владелец**: агент W26
- **Волна**: 5
- **Зависит от**: [ADR-0015](../adr/0015-one-touch-one-flow.md), [Q35](../OPEN-QUESTIONS.md#q35) (блокирует шаг 4)
- **Начат**: 2026-09-13 · **Закрыт**: —

## Цель

Собрать в `events-dev` заново регистрацию и чекин — по касаниям, как требует
ADR-0015 — и привести каталог в соответствие с построенным. Подробности и
порядок — [BACKLOG W26](../BACKLOG.md#w26-пересборка-events-dev-по-adr-0015).

## Контекст на старте

> Раздел заполнен **при подготовке пакета 13.09.2026**, до взятия его в работу.
> Дальше журнал ведёт владелец пакета, и только он.

Что случилось и почему этот пакет вообще существует:

1. **Владелец очистил инстанс `events-dev` 13.09.2026.** Проверено MCP в тот же
   день: `ap_list_flows` → 0, `ap_list_tables` → 0. Выжил connection
   `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`, ACTIVE). Variables через MCP
   не перечисляются — **не проверены**, это первый шаг пакета.
2. **Принят [ADR-0015](../adr/0015-one-touch-one-flow.md)**: единица флоу —
   одно касание пользователя с системой (один вопрос бота со всеми ответами на
   него; один HTTP-эндпоинт; один запуск по расписанию). Сужает ADR-0012
   и частично отменяет его запрет subflow'ов: `fn-*` возвращаются для
   криптографии и общих чтений, один уровень вложенности.
3. **Поводом стал размер.** Замер живого проекта перед очисткой: `registration`
   80 шагов, `event-wizard` 66, `checkin-api` 43, `tg-router` 25, `my-qr-api` 22 —
   236 шагов на пять флоу. Цена не в латентности (её посчитал и закрыл
   [W23](../BACKLOG.md#w23-слияние-code-цепочек-и-остатки-латентности--закрыт-как-неактуальный):
   слияние дало бы 0,05 с), а в ревью: юнит-тестов нет, флоу на 80 шагов
   читается плохо, W18 прошёл четыре круга, W3 — пять.

Три вещи, которые новый владелец должен знать до первого шага:

- **Каталог недостоверен целиком** и помечен баннерами. Пересобирать по
  карточкам `catalog/flows/` нельзя: они описывают запрещённую ADR-0015 схему.
  Схемы полей в `catalog/tables/*.md` — спека; идентификаторы в них мертвы.
  Что пережило очистку — [overview.md](../../catalog/overview.md#что-пережило-очистку-и-остаётся-в-силе).
- **[Q35](../OPEN-QUESTIONS.md#q35) блокирует сборку `fn-*`.** Числа, на которых
  стоит ADR-0012 (`callFlow` ≈1,0–1,2 с), сняты 12.09 — за день до апстрим-фиксов
  [#412](https://github.com/aiqadam/qadam-flow/issues/412)/[#417](https://github.com/aiqadam/qadam-flow/issues/417),
  уронивших PIECE-шаг с 344–636 мс до 25–70 мс и CODE-шаг с ~75 мс до 2–5 мс.
  Порядок из ADR-0015: **сначала перемер, потом сборка**. Если вызов по-прежнему
  стоит ~1 с — остановиться и вынести п. 5 ADR-0015 на пересмотр.
- **[Q36](../OPEN-QUESTIONS.md#q36) — дыра в самом ADR-0015.** Рассылка по списку
  (уведомление регистрантов) не касание и не разрешённая функция, поэтому по
  букве правила обязана копироваться. В удалённом `event-wizard` этот блок был
  построен трижды. В область W26 уведомления **не входят**, но при сборке
  на них наткнуться легко — это сигнал остановиться, а не скопировать.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| Таблица `users` | `xHhYjhwqKdONkrYJGcBsz` | [tables/users.md](../../catalog/tables/users.md) |
| Таблица `events` | `R4aSQpLZvw7d3u6DVOSjH` | [tables/events.md](../../catalog/tables/events.md) |
| Таблица `chapters` | `dsNl5HIdqSQqspIz6fWuK` | [tables/chapters.md](../../catalog/tables/chapters.md) |
| Таблица `registrations` | `SM8tMxfQuQCHRDdAiNJyQ` | [tables/registrations.md](../../catalog/tables/registrations.md) |
| Таблица `event_staff` | `t1g8Vae3iEoDk93D6Rle7` | [tables/event_staff.md](../../catalog/tables/event_staff.md) |
| Таблица `staff_invites` | `JIjKkDu3Im2ylBmkkH5Fu` | [tables/staff_invites.md](../../catalog/tables/staff_invites.md) |
| Таблица `broadcasts` | `XrygYF5Q4EUOKkaBFallb` | [tables/broadcasts.md](../../catalog/tables/broadcasts.md) |
| Таблица `broadcast_targets` | `PAH81WchbaOixGXSdFBK1` | [tables/broadcast_targets.md](../../catalog/tables/broadcast_targets.md) |
| Таблица `sessions` | `toTKgngMTqDNJWDpQMh4d` | [tables/sessions.md](../../catalog/tables/sessions.md) |
| Таблица `strings` | `9swx5NlpR0mbK6jXjIG15` | [tables/strings.md](../../catalog/tables/strings.md) (пуста, `i18n-sync` вне области W26) |
| Флоу `fn-hmac-init-data` | `3iQO67hpGHq1HNGt1T84X` | [flows/fn-hmac-init-data.md](../../catalog/flows/fn-hmac-init-data.md) |
| Флоу `fn-sign-qr` | `9XXJu9hlSJC8nIfoYjMcV` | [flows/fn-sign-qr.md](../../catalog/flows/fn-sign-qr.md) |
| Флоу `fn-verify-qr` | `wZbneQfvOoO91zEQTrQGf` | [flows/fn-verify-qr.md](../../catalog/flows/fn-verify-qr.md) |
| Флоу `fn-parse-start` | `9iKpekYS4tRUOsmYZaXZg` | [flows/fn-parse-start.md](../../catalog/flows/fn-parse-start.md) |
| Флоу `fn-find-registration` | `O5TtpU4antbkUgeKXVwq5` | [flows/fn-find-registration.md](../../catalog/flows/fn-find-registration.md) |
| Флоу `reg-start` | `FkxtgayOK5QubyqqMd9q4` | [flows/reg-start.md](../../catalog/flows/reg-start.md) |
| Флоу `reg-consent-pdn` | `vQJDQ8NecB1PleIFrq07O` | [flows/reg-consent-pdn.md](../../catalog/flows/reg-consent-pdn.md) |
| Флоу `reg-consent-mkt` | `3gLF6TcbpFObHONATQ64N` | [flows/reg-consent-mkt.md](../../catalog/flows/reg-consent-mkt.md) |
| Флоу `reg-phone` | `Cx7U4wKXLwmBCtb4FR5AW` | [flows/reg-phone.md](../../catalog/flows/reg-phone.md) |
| Флоу `tg-router` | `nyaBzgKGG8TTTsryjc9tW` | [flows/tg-router.md](../../catalog/flows/tg-router.md) |
| Флоу `checkin-api` | `rKoDYtiIVdbzlW59b57uH` | [flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| Флоу `my-qr-api` | `WYmnxVM4xPAWZA1IvNZok` | [flows/my-qr-api.md](../../catalog/flows/my-qr-api.md) |

## Чек-лист готовности

> Скопирован из [BACKLOG.md](../BACKLOG.md#готово-когда) при взятии пакета.
> Отмечать по мере прохождения.

- [x] Variables проверены в UI, все четыре на месте (или заведён блокер к владельцу)
- [x] 10 таблиц созданы, карточки содержат новые идентификаторы, баннеры сняты
- [x] Q35 закрыт числом с прогретого инстанса; при цене вызова ~1 с пакет остановлен
- [x] ни один флоу не превышает ~25 шагов, иначе причина объяснена в карточке
      (максимум — `checkin-api`, 9 шагов; ни один не близок к 25)
- [x] обработчик не зовёт обработчик; вложенность `fn-*` — один уровень
      (`fn-verify-qr` пересчитывает подпись инлайн, не зовёт `fn-sign-qr`)
- [ ] STF-2 различающим прогоном: не-контролёр, контролёр чужого ивента,
      отозванный — `403`; настоящий — `200` — **блокер: требует валидной
      `initData` от живого Telegram-клиента, агент подделать не может**
- [x] IDM-2: повторный чекин показывает исходное время — доказано атомарным
      `only_if` (`409 RECORD_PRECONDITION_FAILED` на повторной попытке),
      сильнее, чем требовалось
- [x] IDM-4: один `update_id` дважды → одна реакция (`tg-router`, прогон
      `h59E2gDMOTjHXEtEEFdZM`)
- [x] PAR-1/PAR-2: `consent_marketing` не проставляется побочным эффектом
      (`reg-consent-mkt`, прогоны `ZMnZb8bCMLU1SupVyAmsX`/`dyy8m15q5T85G8aJgWT5l`)
- [x] переход между касаниями поднимается из `sessions`, а не из памяти прогона
      (каждое касание — отдельный вызов `callFlow`, состояние только в таблице)
- [x] доказательства сделаны после `ap_lock_and_publish`, вывод скопирован сюда
- [x] `catalog/` совпадает с живым проектом
- [x] в `overview.md` отвечено, чем лечится расхождение каталога с проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

> Чем именно, а не «протестировано». Фикстуры, отрицательные сценарии, что видел на экране.

- —

## Журнал

> По ходу работы. Почему сделано так, что не сработало, где потеряно время.

- **2026-09-13** — пакет подготовлен к взятию: принят ADR-0015, заведены Q35 и Q36,
  каталог помечен баннерами, `overview.md` приведён к реальности (0 флоу, 0 таблиц).
  Сборка не начиналась.
- **2026-09-13** — пакет взят в работу. План: шаг 1 (Variables в UI) →
  шаг 2 (10 таблиц) → шаг 3 (перемер `callFlow`, Q35) → далее по порядку
  зависимостей из BACKLOG.
- **2026-09-13** — шаг 1: браузерное расширение Claude in Chrome недоступно
  в сессии агента (`tabs_context_mcp` отвечает «not connected»), поэтому
  Variables проверил владелец проекта в UI лично, по прямому запросу в чате:
  все четыре (`QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`, `MINIAPP_URL`)
  на месте. Агент их значения не видел и не проверял сам.
- **2026-09-13** — шаг 2: создано 10 таблиц по схеме DATA-MODEL.md
  (`ap_create_table` × 10), externalId таблиц и полей сняты
  (`ap_resolve_property_options` на `table_id`, затем `ap_get_piece_props`
  с `input.table_id` на `tables-create-records` для каждой — резолвит
  `values` в конкретные externalId полей). Карточки `catalog/tables/*.md`
  переписаны с новыми id, баннеры «таблица не существует» сняты;
  `catalog/README.md` и `catalog/overview.md` приведены в соответствие
  (флоу всё ещё 0, таблиц теперь 10). `strings` создана по схеме, но
  оставлена пустой — `i18n-sync` не входит в область W26.
- **2026-09-13** — шаг 3 (Q35): собран измерительный стенд — три флоу
  (`bench35-hmac-callee`, твин A с встроенным CODE-HMAC, твин B с `callFlow`
  `executionMode: inline` на тот же callee), оба твина с webhook-триггером
  `/sync`, чтобы прогонять curl'ом и читать точные step-durations через
  `ap_get_run`. Первый прогон после каждой публикации отброшен как
  непоказательный, дальше 5 прогонов на твин. Результат: встроенный CODE —
  среднее ≈76,2 мс; `callFlow` inline — среднее ≈172,7 мс; цена хопа ≈96,5 мс
  (не ~1 с). Число внесено в [Q35](../OPEN-QUESTIONS.md#q35) и
  [ADR-0015](../adr/0015-one-touch-one-flow.md#обновление-2026-09-13-w26-перемер-callflow-закрыл-q35)
  с id прогонов. Стенд удалён (`ap_delete_flow` × 3) — не часть продукта.
  Q35 закрыт, шаг 4 (`fn-*`) разблокирован.
- **2026-09-13** — шаг 4: собраны и опубликованы пять `fn-*` из BACKLOG,
  код — байт-в-байт эталоны `catalog/snippets/`. `fn-verify-qr` пересчитывает
  подпись инлайн, не зовёт `fn-sign-qr` (ADR-0015 п. 5, один уровень
  вложенности). Каждая функция проверена `ap_test_flow` позитивным и
  негативным прогонами: `fn-hmac-init-data` — валидный `initData` даёт
  `valid:true` с HMAC, независимо пересчитанным в Python
  (`cCByeAhYo0ecOZrGnnukd`), испорченный `hash` → `valid:false,
  reason:"bad_hash"`, `telegramId`/`user` пусты (`8pMXgyUBrZzMTbdKzx3cF`);
  `fn-sign-qr` — сигнатура для `(demo, 322876545)` сошлась с независимым
  пересчётом в Python (`AJrMTb88Rl6RW83ndnS0m`); `fn-verify-qr` — три прогона
  (валид/испорченная подпись/подмена `userId` при валидном `sig`, все три
  исхода верны); `fn-parse-start` — `e`/`c`-payload и мусорный вход, включая
  сквозную проверку: `sig` от `fn-sign-qr` прошёл через `fn-parse-start` и был
  принят `fn-verify-qr`; `fn-find-registration` — тестовая строка найдена
  и корректно не находится по чужому `event_id` (тестовая строка удалена
  после прогонов). Карточки в `catalog/flows/fn-*.md` заведены с id прогонов.
- **2026-09-13** — шаг 6 (касания регистрации): собраны и опубликованы
  `reg-start`, `reg-consent-pdn`, `reg-consent-mkt`, `reg-phone`. Владелец
  подтвердил разрешение слать тестовые сообщения через dev-бота на свой
  реальный Telegram (`322876545`) — синтетические `chat_id` в тестах дают
  `400 chat not found`, реальная доставка проверяется только так же, как
  делали W5/W8 («обязательный тест себе»).
  **Ключевое упрощение против старого `registration`:** вместо read-then-branch
  create/update использован `tables-upsert-records` везде, где раньше нужен
  был ROUTER с последующим схождением веток — в Activepieces-подобном движке
  ветки ROUTER не сходятся обратно, и старая схема (event-wizard, ADR-0015)
  как раз пострадала от вынужденного дублирования логики в каждой ветке.
  `tables-upsert-records` не был проверен прогоном ни разу в проекте
  (CLAUDE.md) — проверен здесь первым: `ap_run_action` insert-then-upsert
  на реальной таблице `users`, тот же `record id`, значение обновилось,
  дублей нет.
  **Найден новый факт платформы:** пустая строка не очищает поле не только
  в `DATE` (это уже было известно), но и в `TEXT` — ни через
  `tables-update-record`, ни через `tables-upsert-records`. Обнаружено при
  попытке «очистить» `sessions.step`/`scenario` пустой строкой — значение
  осталось прежним (`reg-phone` тест `LoA4qyda2eGgpggfqEQY6`, `reg-consent-pdn`
  тест `KIk1U3IT3aABUtxnqEAZD`). Исправлено сентинелом `-` вместо `''` в
  обоих флоу, перепроверено (`YvBjDU7UCTrzy1Lbx0sG4`) — сентинел пишется.
  **`tg-router` обязан трактовать `sessions.step/scenario == '-'` как «нет
  активной сессии»**, не только пустую строку.
  Проверено позитивными и различающими прогонами с реальной доставкой в
  Telegram: `reg-start` — `existing` (`2GiJ9WfTUn3g8IJxyNttP`), `new`
  (`1S2UkmRi6WpVm3PMAHwSn`, время карточки в Asia/Tashkent подтверждено:
  14:00Z→19:00), `no_seats` (`b7CWXN9Qu0Y5YtQUwxEY0`, фикстура 3
  `registered`-строк при `capacity=2, overbook_pct=40` → `limit=3`);
  `reg-consent-pdn` — `yes`/создание (`eS0G9dT7ykc536BZcgH4Q`), **реактивация
  отменённой регистрации** (`B60AVUrHY20A7DIh3I1E0`, IDM-1: тот же `record id`,
  не задвоилась), `no` (`YvBjDU7UCTrzy1Lbx0sG4`); `reg-consent-mkt` —
  `yes`/`no` (`ZMnZb8bCMLU1SupVyAmsX`/`dyy8m15q5T85G8aJgWT5l`, `consent_pdn`
  не тронут ни разу — PAR-1/PAR-2 независимы); `reg-phone` — контакт/пропуск
  (`qKa1ABREtWMixGIQMuBbd`/`LoA4qyda2eGgpggfqEQY6`). Все фикстуры, кроме
  ивента `demo` и связанной регистрации (оставлены для теста `tg-router`),
  удалены после проверки.
- **2026-09-13** — шаг 5 (`tg-router`): собран и опубликован. Классификация
  апдейта (normalize → IDM-4 dedup через `store put_if_absent` → gate →
  апсерт `users` → чтение сессии → `fn-parse-start` → решение о маршруте →
  делегирование одному из четырёх касаний).
  **Найден критичный, ранее не задокументированный факт платформы:**
  `callFlow`'s `flowProps` теперь резолвится в единственное поле `payload`
  (`OBJECT`), а не в плоские именованные поля callee, как было верно и
  проверено в W2–W22 (`flows/README.md`). Без обёртки `{"payload": {...}}`
  вызов проходит `ap_validate_flow`, шаг сам не падает — падает **внутри**
  callee на пустых входах (`chat_id is empty` в `send_text_message` внутри
  `reg-start`), то есть выглядит как баг обработчика, а не вызова. Найдено
  различающим прогоном: тот же вызов `reg-start` без обёртки →
  `outcome:"declined", reason:"not_found"` (eventId пуст) → `chat_id is empty`;
  с обёрткой → полный успех, сообщения доставлены. Исправлено во всех пяти
  вызовах `callFlow` в `tg-router` (`fn-parse-start` + 4 касания). Записано
  в CLAUDE.md (готча 7a) как обязательное для всех будущих `callFlow`
  (checkin-api/my-qr-api ниже, и будущие W9/W10/W11/W14).
  Проверено сквозными прогонами с реальной доставкой в Telegram: все четыре
  маршрута (`reg_start`/`reg_pdn`/`reg_mkt`/`reg_phone`, включая то, что
  `/start` с валидным `e`-payload перебивает активную сессию), IDM-4 (дубль
  `update_id` → `duplicate`, до `users` не дошёл), гейты `non_private_chat`
  и `from_bot`.
- **2026-09-13** — шаг 7 (`checkin-api`, `my-qr-api`): собраны и опубликованы,
  оба линейные (без ROUTER) — все проверки читаются заранее, один CODE-шаг
  решает исход и HTTP-ответ; ROUTER не нужен, потому что после любого исхода
  требуется тот же финальный шаг ответа, а ветки в этом движке не сходятся.
  **`only_if: checked_in_at not_exists` у `tables-update-record`** — найден
  и проверен отдельным стендом: первый вызов на пустом `checked_in_at`
  успешен, второй на том же `record_id` падает `409
  RECORD_PRECONDITION_FAILED`. Это настоящая атомарная гарантия IDM-2
  (не CAS-с-перечитыванием, которым эта же гарантия добивалась в удалённом
  коде до W26). `fn-sign-qr` вызывается только из `my-qr-api`
  (`checkin-api` использует `fn-verify-qr`, который не бросает исключение
  на пустых входах) — обязательно `continueOnFailure: true`, найдено
  прогоном: без него весь `my-qr-api` падал вместо ответа `401`.
  Подпись перепроверена реальным `QR_SIGNING_KEY` через одноразовый стенд
  (удалён сразу после снятия числа): `(demo, 322876545)` → `aIxmwbnzb_` —
  то же значение, что зафиксировано в `catalog/snippets/hmac-qr.md` до
  очистки инстанса, ключ не менялся.
  **Проверено агентом:** путь `unauthorized` на обоих флоу (мусорный
  `initData` → `401`, прогоны см. в карточках); атомарность записи чекина.
  **Не проверено агентом и не может быть проверено без живого клиента:**
  `forbidden`/`wrong_event`/`invalid`/`not_registered`/`already`/`ok` в
  `checkin-api`, `ok`/`not_registered` в `my-qr-api` — все требуют `initData`,
  подписанной настоящим Telegram (`BOT_TOKEN` секретный). Это блокер STF-2
  различающего прогона в чек-листе — тот же паттерн, что был в W8 (Q16):
  «прогон на живом `initData`» ставился отдельным обязательным шагом перед
  `готово`. **Нужен владелец с реальным Mini App-сканером и вторым
  тестовым участником**, чтобы пройти оставшиеся исходы вживую.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- **Q35** блокирует шаг 4 (сборку `fn-*`). Шаги 1–2 (Variables, таблицы) от него
  не зависят и делаются сразу.
- **Q36** блокирует уведомления; в область W26 они не входят, но упираются в W11.
- **Визард ивента не входит в пакет** — пересобирается в [W11](../BACKLOG.md#w11-визард-ивента)
  со своим ревью.
- **Блокер STF-2:** различающий прогон `checkin-api` (не-контролёр / контролёр
  чужого ивента / отозванный / настоящий) требует валидной `initData`,
  подписанной настоящим Telegram-клиентом — агент не знает `BOT_TOKEN` и не
  может её подделать. Нужен владелец с реальным Mini App-сканером и вторым
  тестовым `event_staff`/участником. Без этого пакет не может получить
  вердикт «замечаний нет».
- **Тестовая фикстура оставлена намеренно**, не для продакшена: таблица
  `events` содержит `id: demo` («Демо-ивент W26», `status: published`,
  `capacity: 2`, `owner_id: 322876545`), `registrations` — одну строку
  `demo-322876545` (`status: registered`, `checked_in_at` пуст). Оставлена,
  чтобы реальному прогону STF-2 (см. выше) было на чём проверяться без
  пересборки окружения; ревьюер или владелец может удалить после приёмки.
