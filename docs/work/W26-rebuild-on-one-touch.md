# W26. Пересборка `events-dev` по ADR-0015 (+ W11 визард, слит 2026-09-13)

- **Статус**: на проверке
- **Владелец**: агент W26
- **Волна**: 5
- **Зависит от**: [ADR-0015](../adr/0015-one-touch-one-flow.md), [Q35](../OPEN-QUESTIONS.md#q35) (блокирует шаг 4)
- **Начат**: 2026-09-13 · **Закрыт**: —

## Цель

Собрать в `events-dev` заново регистрацию, чекин и визард ивента — по
касаниям, как требует ADR-0015 — и привести каталог в соответствие
с построенным. Подробности и порядок — [BACKLOG W26](../BACKLOG.md#w26-пересборка-events-dev-по-adr-0015).

**2026-09-13, решение владельца в процессе работы:** пакет W11 (визард
ивента, OWN-1…OWN-5) слит в W26 — инстанс и так пуст, откладывать пересборку
до отдельного пакета смысла не было. Одновременно принят
[ADR-0016](../adr/0016-shared-flow-for-same-shaped-touches.md), уточняющий
ADR-0015 для последовательности структурно одинаковых вопросов (визард — шесть
почти одинаковых полей подряд), и закрыт [Q36](../OPEN-QUESTIONS.md#q36)
(уведомление OWN-5 — узкий нетроттленый цикл по регистрациям своего ивента,
не полноценная интеграция с W14). Регистрация и чекин (изначальная область
W26) к этому моменту уже собраны, проверены (включая живой прогон с реальным
Telegram-клиентом) и не переделываются — визард добавляется поверх.

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
| Флоу `event-wizard-start` | `hlteuRDfyahnfcHHip15E` | [flows/event-wizard-start.md](../../catalog/flows/event-wizard-start.md) |
| Флоу `event-wizard-edit-start` | `aPZHkBfShDwwjIcYKq6Tf` | [flows/event-wizard-edit-start.md](../../catalog/flows/event-wizard-edit-start.md) |
| Флоу `event-wizard-field` | `iOtIXWIIX1lgtz6RQUPVN` | [flows/event-wizard-field.md](../../catalog/flows/event-wizard-field.md) |
| Флоу `event-wizard-photo` | `mGUl0dCEyJQjjN3VtyjAN` | [flows/event-wizard-photo.md](../../catalog/flows/event-wizard-photo.md) |
| Флоу `event-wizard-geo` | `sAJFoscopo3EgwQlDfaA7` | [flows/event-wizard-geo.md](../../catalog/flows/event-wizard-geo.md) |
| Флоу `event-wizard-publish` | `4nbqCqBrSRZXertysDp7v` | [flows/event-wizard-publish.md](../../catalog/flows/event-wizard-publish.md) |

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
- [x] STF-2 различающим прогоном: не-контролёр/контролёр чужого ивента —
      `403` (реальный `initData` `@binali_beelab`, `eventId: "other-event"`);
      отозванный — `403` (тот же контролёр, `event_staff.revoked_at` временно
      проставлен, затем восстановлено удалением и созданием заново); настоящий
      — `200` (живой прогон, см. журнал). Все четыре — на реальной подписи
      Telegram, не на синтетике
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

### Чек-лист W11 (визард, добавлен при слиянии в W26)

> Скопирован из [BACKLOG.md#w11](../BACKLOG.md#w11-визард-ивента).

- [x] ввод дат трактуется как Asia/Tashkent и пишется в UTC (OWN-3) —
      `event-wizard-field`, ручной парсер `ДД.ММ.ГГГГ ЧЧ:ММ`, проверен на
      границах (`starts_at`/`ends_at`/`reg_deadline_at`)
- [x] гео принимается сообщением-локацией — `event-wizard-geo`, только
      `message.location`, не текст с координатами
- [x] правка опубликованного шлёт уведомление зарегистрированным **только** при
      изменении полей из [notify-on-change](../DATA-MODEL.md#notify-on-change),
      с перечнем «было → стало» — `event-wizard-publish`, проверено правкой
      реального тестового ивента (см. журнал)
- [x] состояние визарда переживает рестарт воркера (лежит в `sessions`) —
      то же устройство, что и у регистрации (каждое касание — отдельный
      `callFlow`, состояние только в таблице, не в памяти прогона)
- [x] авторизация правки — только `events.owner_id == telegram_id` инициатора —
      `event-wizard-edit-start`, различающий прогон `not_owner`/`not_found`/`ok`
- [x] `event-wizard-field` (ADR-0016) проверен на все шесть полей, включая
      границы валидации каждого

## Как проверено

> Чем именно, а не «протестировано». Фикстуры, отрицательные сценарии, что видел на экране.

Сводно (доказательства с run id — в «Журнале» ниже, по шагам сборки):

- **STF-2** (`checkin-api`): 4 сценария на реальной подписи Telegram —
  не-контролёр/чужой ивент/отозванный → `403`, настоящий → `200`.
- **IDM-2** (`checkin-api/step_8`): `only_if: checked_in_at not_exists` —
  повторный чекин даёт `409`, время не переписывается (проверено и синтетикой,
  и живым прогоном владельца).
- **IDM-4** (`tg-router`): тот же `update_id` дважды → вторая попытка
  `duplicate`, до `users` не доходит.
- **PAR-1/PAR-2** (`reg-consent-pdn`/`reg-consent-mkt`): раздельные прогоны
  `pdn:yes`+`mkt:no` — `consent_marketing` не тронут согласием на ПД и наоборот.
- **Авторизация правки визарда** (`event-wizard-edit-start`): `ok`/`not_found`/
  `not_owner` — три различающих прогона, реальная доставка сообщений.
- **Даты и границы валидации** (`event-wizard-field`): все шесть полей,
  включая `ends_at ≤ starts_at` и `reg_deadline_at > starts_at`.
- **Diff-уведомление** (`event-wizard-publish`): правка реального тестового
  ивента с одной регистрацией — диф посчитан верно, уведомление доставлено,
  `published_at` не переписан при правке.
- **Маршрутизация `tg-router`**: все десять маршрутов (четыре касания
  регистрации + шесть визарда) подтверждены прогонами с реальными
  Telegram-апдейтами.
- **ADR-0014 (`inputs.texts`)**: после ревью — все 12 текстонесущих флоу
  пакета переведены на `texts`-вход, каждое значение сверено скриптом
  построчно с `i18n/ru.json` (см. журнал, раздел «Ответ на ревью»).

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
- **2026-09-13 — живой прогон владельцем, STF-2/IDM-2 закрыты по-настоящему.**
  Регистрация `@return_void_0` (`322876545`) → согласие ПД → согласие
  рассылки → телефон → QR, затем чекин `@binali_beelab` (`8255904812`,
  назначен staff на `demo` через `event_staff`) — два скана.
  **Обнаружен и исправлен блокер, не связанный с флоу:** статические страницы
  `miniapp/index.html` и `miniapp/ticket.html` указывали на **старые,
  добитые до-очистки** `flowId` `checkin-api`/`my-qr-api` — GitHub Pages
  раздавал их без изменений с самого начала пакета, потому что W26 работал
  веткой, а Pages деплоится только с `main`. Плюс новый `my-qr-api` отвечал
  другой формой (`{status,...}`), чем ждёт `ticket.html` (`{ok,error,text,payload}`
  — форма, унаследованная от исходного `my-qr-api`, которую я не сверил перед
  сборкой). Оба флоу переведены на контракт, который уже понимают
  задеплоенные страницы (`checkin-api`: `unauthorized→invalid_init_data`;
  `my-qr-api`: `{ok,error,text,payload}`), URL в статике поправлены отдельным
  PR [#35](https://github.com/aiqadam/aiqadam-events-bot/pull/35) — **смёржен
  напрямую в `main` по прямому разрешению владельца** (не через ветку W26:
  GitHub Pages деплоится только с `main`, а тест шёл вживую) и затем влит
  обратно в ветку W26 (`git merge origin/main`). Урок на будущее: перед сборкой
  API, у которого есть готовый клиент (сюда же годится любой будущий эндпоинт
  визарда, если появится Mini App-сторона), сверять форму ответа с клиентским
  кодом **до**, а не после публикации.
  Оба скана прошли на реальной подписи Telegram (`hashValid:true`,
  `ageSeconds` в единицах секунд) и реальном `QR_SIGNING_KEY`
  (`aIxmwbnzb_` для `(demo, 322876545)` — то самое историческое значение):
  первый скан → `ok`, `checked_in_at` записан атомарно; второй → `already`,
  время «18:41» (Tashkent, из `13:41:37Z` — UTC+5 подтверждён), `checked_in_at`
  **не переписан** (IDM-2 на боевых данных, не только на синтетическом
  стенде). STF-2 подтверждён тем же прогоном: `event_staff`-фильтр по
  `(event_id, telegram_id)` нашёл ровно назначенную запись.
- **2026-09-13 — найдена и исправлена латентностная проблема в `tg-router`:
  `executionMode: inline` блокирует родителя независимо от
  `waitForResponse`.** Обнаружено по прямой жалобе владельца («реакция на
  start долгая»): сравнение шагов показало, что сумма собственных шагов
  `tg-router` (1-11) — ~0,6 с, а шаг вызова касания (`waitForResponse: false`,
  `executionMode: inline`) — 1,4–2,1 с, то есть **вся** длительность
  вызванного флоу (включая отправку сообщений Bot API, ~0,7–0,9 с каждое).
  Это отменяет предположение W17/W20, что `inline` + `waitForResponse: false`
  даёт настоящий fire-and-forget — не даёт: `inline` синхронен по построению
  («runs it synchronously in the same engine process»), `waitForResponse`
  влияет только на то, забирается ли возврат, не на то, ждать ли завершения.
  Все четыре вызова касаний в `tg-router` (`reg-start`, `reg-consent-pdn`,
  `reg-consent-mkt`, `reg-phone`) переведены на `executionMode: queue` —
  единственный режим, где `waitForResponse: false` действительно не ждёт.
  Проверено дифференцирующим прогоном одного и того же вызова: `inline` —
  1442 мс, `queue` — 0,1 мс. Собственная длительность `tg-router` упала
  с 1,7–2,1 с до 0,5–0,6 с на всех четырёх касаниях (живые прогоны после
  фикса, реальные Telegram-апдейты). Вызовы `fn-*`, где родителю
  действительно нужен ответ (`fn-parse-start` внутри `tg-router`, все
  `fn-*` внутри `checkin-api`/`my-qr-api`/касаний), остаются `inline` —
  там ожидание неизбежно, и `inline` делает его дешёвым (Q35: ~96 мс/хоп).
  **Правило на будущее:** `queue` для «передал и не жду ответа», `inline`
  только когда ответ обязателен.
- **2026-09-13 — STF-2 добит различающими прогонами без повторного участия
  владельца**, переиспользовав реальный `initData` `@binali_beelab`,
  захваченный в трейсе живого прогона (свежесть 24ч, `maxAgeSeconds: 86400` —
  ещё в окне). `eventId: "other-event"` (нет строки `event_staff`) → `403`;
  тот же контролёр с временно проставленным `event_staff.revoked_at` → `403`
  (запись восстановлена удалением и повторной вставкой без `revoked_at` —
  очистить `DATE` пустой строкой нельзя, см. известный трюк с сентинелом,
  здесь пересоздание проще). Вместе с положительным контролем из живого
  прогона (`200 ok`) все четыре сценария STF-2 закрыты на настоящей подписи.
- **2026-09-13, решение владельца в процессе работы: W11 (визард ивента)
  слит в W26.** Принят [ADR-0016](../adr/0016-shared-flow-for-same-shaped-touches.md)
  (уточняет ADR-0015: последовательность структурно одинаковых вопросов
  делит один флоу, а не плодит копии) и закрыт
  [Q36](../OPEN-QUESTIONS.md#q36) (уведомление OWN-5 — узкий нетроттленый
  цикл, не интеграция с W14). `STATUS.md`, `BACKLOG.md#w11` обновлены,
  чек-лист W11 скопирован в этот журнал отдельным разделом. Дальше — сборка
  визарда по плану из ADR-0016 (`event-wizard-start`, `event-wizard-field`,
  `event-wizard-photo`, `event-wizard-geo`, `event-wizard-preview`,
  `event-wizard-publish`).
- **2026-09-13 — визард собран, шесть флоу (состав уточнён по факту сборки,
  см. [обновление ADR-0016](../adr/0016-shared-flow-for-same-shaped-touches.md#обновление-2026-09-13-w26-по-факту-сборки-event-wizard-preview-не-отдельный-флоу-добавлен-event-wizard-edit-start)):
  `event-wizard-start`, `event-wizard-edit-start`, `event-wizard-field`,
  `event-wizard-photo`, `event-wizard-geo`, `event-wizard-publish`. `preview`
  не стал отдельным флоу — складка внутри `event-wizard-field` после
  последнего поля; взамен появился `event-wizard-edit-start` (не был в
  исходном плане ADR-0016), потому что вход в правку несёт отдельную
  обязанность — проверку `owner_id` и построение `draft._orig` для diff.
  `tg-router` дополнен шестью ветками ROUTER (`wiz_start`/`wiz_edit_start`/
  `wiz_field`/`wiz_photo`/`wiz_geo`/`wiz_publish`), все вызовы — `callFlow`
  `executionMode: queue` (тот же вывод, что и для касаний регистрации) с
  обязательной обёрткой `flowProps: {"payload": {...}}`.
  **Найдена и закрыта платформенная ловушка `LOOP_ON_ITEMS`** (используется в
  `event-wizard-publish` для рассылки уведомления по OWN-5): обращение к
  текущему элементу цикла из дочернего шага — `{{loopStepName['output'].item}}`,
  не `{{loopStepName['output']}}` (голый) и не `{{loopStepName.currentItem}}`.
  Обе неверные формы проходят `ap_validate_flow` и даже прогон с нулевыми
  итерациями (пустой список адресатов уведомления при создании ивента) —
  падают `INTERNAL_ERROR` без детализации по шагам только когда в цикле
  реально есть ≥1 элемент. Найдено на прогоне правки реального тестового
  ивента `emtzwkv2mdtus` (одна регистрация → непустой цикл). Диагностировано
  изолированным одноразовым стендом `w26-scratch-loop-test` (перебор трёх
  синтаксисов, каждый по одному, потому что `ap_update_step` мёржит input,
  а не заменяет) — удалён после нахождения причины. Исправлено, republish,
  повторный прогон правки прошёл целиком: диф посчитан верно, уведомление
  доставлено реальному зарегистрированному, `published_at` не переписан.
  Факт внесён в CLAUDE.md (Gotchas Qadam Flow, п. 9) и в карточку
  `event-wizard-publish.md`.
  **Проверено `ap_test_flow` на каждый флоу отдельно** (все ветки CODE-шагов,
  границы валидации всех шести полей, cancel/noop/publish-create/
  publish-edit-with-changes/publish-edit-no-changes) **и интеграционно через
  `tg-router`** — все шесть маршрутов подтверждены различающими прогонами с
  реальными Telegram-апдейтами (id прогонов — в `catalog/flows/tg-router.md`
  и карточках самих флоу), включая `not_found`/`not_owner` для
  `event-wizard-edit-start` (реальная доставка сообщения в обоих случаях).
  Тестовые фикстуры визарда (`events.id = emtzwkv2mdtus` и его регистрация)
  удалены после проверки — в отличие от `demo` (нужен постоянно для STF-2
  `checkin-api`), эта фикстура ревьюеру не нужна: он создаёт свой ивент через
  `/newevent`. Тестовая сессия (`sessions` для `telegram_id 322876545`)
  сброшена в `scenario='-', step='-'` после последнего интеграционного
  прогона. Карточки шести флоу заведены в `catalog/flows/`, `catalog/overview.md`
  и `catalog/README.md` обновлены (12 → 18 флоу), `tg-router.md` дополнен
  описанием новых маршрутов и id прогонов.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: независимый агент (свежий контекст) · **Дата**: 2026-09-13 · **Вердикт**: есть замечания

Проверено через `ap_list_flows`/`ap_list_tables` (18 флоу, 10 таблиц — совпадает
с заявленным), `ap_flow_structure` + `ap_read_step_code` по всем 18 флоу,
read-only REST-экспорт (`GET /flows/<id>/template`) по всем 18 флоу для
конфигурации PIECE-шагов (`callFlow` `executionMode`/`flowProps`,
`tables-find-records` фильтры, `only_if`, `errorHandlingOptions`,
короткая/длинная форма `{{variables[...]}}`), `ap_list_runs`/`ap_get_run` —
реальные `PRODUCTION`/`TESTING`-прогоны с `SUCCEEDED`. Позитив, который стоит
явно назвать: STF-2 (`checkin-api/step_3`, фильтр `event_id` + `telegram_id`
+ `revoked_at not_exists`), IDM-2 (`step_8`, `only_if: checked_in_at
not_exists`, реальный `409` на повторе), IDM-4 (`tg-router`, дедуп
`put_if_absent`, прогон `h59E2gDMOTjHXEtEEFdZM` перепроверен), PAR-1/PAR-2
(`reg-consent-pdn/step_4` и `reg-consent-mkt/step_3` пишут разные поля
`users`, ни один не трогает поле другого), авторизация правки
(`event-wizard-edit-start/step_2`, сравнение `owner_id == telegramId`),
даты в `event-wizard-field/step_1` (ручной парсер, `UTC = Tashkent − 5ч`,
`ends_at > starts_at`, `reg_deadline_at <= starts_at` — все проверены),
diff/уведомление в `event-wizard-publish` (поля `notify-on-change` без
`description`/`photo_file_id`, `LOOP_ON_ITEMS` через `{{step_11['output'].item}}`,
`continueOnFailure: true` на шаге рассылки, фильтр регистрантов по
`event_id` целевого ивента), крипто-цепочки `fn-hmac-init-data`/`fn-sign-qr`/
`fn-verify-qr` (HMAC через `node:crypto`, canonical `dataCheckString`,
constant-time сравнение, `sig` — срез по длине строки, не `split('-')`),
`callFlow` `flowProps` — везде обёрнуто в `{"payload": {...}}`, ни одной
короткой формы `{{VAR}}` ни в одном из 18 экспортов, `executionMode` верный
у всех вызовов (`queue` для передачи касания без ожидания, `inline` для
`fn-*` и межфлоуных вызовов с ответом) — всё это подтвердилось и претензий
не вызвало. Замечания ниже — не об этом, а о том, что осталось непроверенным
или незамеченным при сборке.

### Замечания

1. **важно** — `checkin-api` и `my-qr-api` линейны (без `ROUTER`, все шаги —
   прямая цепочка `next`), поэтому при **невалидном** `initData` шаги всё
   равно выполняются безусловно: `checkin-api/step_3` (`tables-find-records`
   на `event_staff`), `step_4` (`callFlow` → `fn-verify-qr`), `step_5`
   (`callFlow` → `fn-find-registration`), `step_6` (чтение имени участника) —
   все отрабатывают до того, как `step_7` («decide result») вообще
   посмотрит на `hmacValid`. То же в `my-qr-api` (`step_2`, `step_3`
   выполняются раньше проверки `hmacValid` в `step_4`). Это прямое нарушение
   явного пункта чек-листа (REVIEW-CHECKLIST 4.5: «невалидный `initData`
   должен отсекаться первым шагом, до обращений к таблицам») и одноимённого
   требования в CLAUDE.md — вебхук публичный, и мусорный запрос сейчас стоит
   столько же ресурсов (2 запроса к `tables` + 3 `callFlow`-хопа), сколько
   легитимный. Утечки данных нет (ответ по-прежнему решается только в
   `step_7`, до него ничего не возвращается), это вопрос устойчивости
   (нагрузки), а не авторизации. Исправление — либо `ROUTER` сразу после
   `step_1`/`step_2` (`my-qr-api`), либо явный ранний `return_response` при
   `!hmacValid`, ценой которого будет отход от «линейного без ROUTER» стиля,
   выбранного в этом пакете.

2. **важно** — Конвенция [ADR-0014](../adr/0014-russian-only-until-platform-i18n.md)
   («Тексты живут во входе того CODE-шага... проп `texts: {ключ: строка}»,
   эталон [`catalog/snippets/ru-texts.md`](../../catalog/snippets/ru-texts.md))
   не применена **ни в одном** из 18 флоу пакета. Все русские строки зашиты
   литералом прямо в тело CODE-шага — например, `checkin-api/step_7`:
   `'Данные Mini App устарели — переоткройте приложение'`,
   `'Нет прав на чекин этого ивента'`; `event-wizard-field/step_1`: тексты
   вопросов и все формулировки ошибок валидации; `event-wizard-publish/step_7`:
   `ownerConfirmText`/`changeSummaryText`. Ни один CODE-шаг пакета не принимает
   `inputs.texts`. Следствие: [`tools/check-texts.py`](../../tools/check-texts.py) —
   принятое как ревью W24 смягчение цены «два источника правды на текст» —
   для всего пакета W26 не проверяет вообще ничего (ищет проп `texts` в
   `settings.input`, не находит его нигде, `checked: 0`). Бот по-прежнему
   говорит только по-русски, поведение не сломано, но конвенция и
   единственный механизм аудита текста молча потеряны на 18 новых флоу.

3. **важно** — `catalog/snippets/*.md` (`hmac-init-data.md`, `hmac-qr.md`,
   `parse-start.md`, `find-registration.md`, `fmt-time.md`, `event-card.md`,
   `i18n-resolve.md`, `ru-texts.md`) не обновлён пакетом W26, хотя пакет
   переписал ровно те флоу, которые в них перечислены. Таблицы «Встраивают»
   во всех файлах ссылаются на несуществующие сущности: флоу `registration`
   (удалён вместе с очисткой инстанса), старые `checkin-api`
   (`CUKqiby1PoHiQiiCQy24V`), `my-qr-api` (`I5nd8ggKH4wkQLaww9Dkl`),
   `tg-router` (`Y1dNon2V2EhjWM0aYwdQi`) и номера шагов от 40+-шаговых версий
   этих флоу — их больше нет ни под этими id, ни в таком виде. Ни один из
   новых флоу пакета не добавлен ни в одну из этих таблиц, хотя минимум три
   независимые копии форматирования времени в Asia/Tashkent появились заново
   (`checkin-api/step_7`, `event-wizard-field/step_1`,
   `event-wizard-publish/step_7`) и не сверены побайтово ни с одним эталоном
   (в основном потому, что находка 2 означает, что эталон `ru-texts`/
   `fmt-time` в новых флоу вообще не используется в задуманном виде). Это
   прямое нарушение REVIEW-CHECKLIST п. 2a и собственного правила
   [`snippets/README.md`](../../catalog/snippets/README.md) («список
   встраивающих флоу... если он устарел, это дефект каталога, а не мелочь»).
   Пакет заявляет «`catalog/` совпадает с живым проектом» — верно для
   `catalog/flows/`, `catalog/tables/`, `catalog/overview.md`, но не для
   `catalog/snippets/`, который в эту сверку, похоже, не попал.

4. **на будущее** — [`catalog/tables/events.md`](../../catalog/tables/events.md)
   утверждает: «Подставлять дефолт [`overbook_pct = 40`] обязан визард
   (W11)», но `event-wizard-publish/step_8` (`write event`) ни разу не пишет
   поле `overbook_pct` — оно остаётся `null` у всех ивентов, созданных
   визардом. Не критично функционально: `reg-start/step_3` независимо
   дефолтит `overbook = 40` при чтении, если поле пусто, поэтому лимит
   регистрации (OWN-15) считается верно. Но заметка в каталоге приписывает
   визарду поведение, которого в коде нет — стоит либо поправить заметку,
   либо (раз уж поле в `events` для этого и заведено) добавить явную запись
   `overbook_pct: 40` в `step_8`, чтобы значение было видно в сырых данных
   и будущем экспорте (OWN-8), а не только в производном расчёте `reg-start`.

5. **на будущее** — Таблица «Что построено» в этом журнале (раздел выше)
   перечисляет 10 таблиц и 12 флоу (`fn-*`, `reg-*`, `tg-router`,
   `checkin-api`, `my-qr-api`), но не шесть флоу визарда
   (`event-wizard-start`, `event-wizard-edit-start`, `event-wizard-field`,
   `event-wizard-photo`, `event-wizard-geo`, `event-wizard-publish`) —
   они появляются только в прозе «Журнала» ниже по тексту, без строки с
   id. Раздел «Как проверено» пуст (как и отмечено в задании на ревью) —
   вся доказательная база размазана по «Журналу» вместо сводного раздела,
   что осложняет проверку по чек-листу. Не блокирует приёмку, но стоит
   дописать таблицу и/или раздел «Как проверено» при следующей правке
   журнала, а не оставлять как есть.

6. **на будущее** — В `tg-router` вызовы `step_12`–`step_15`
   (`reg-start`/`reg-consent-pdn`/`reg-consent-mkt`/`reg-phone`) несут в
   `flowProps` одновременно обёртку `payload` **и** дублирующие плоские поля
   верхнего уровня (`utm`, `chatId`, `eventId`, `telegramId` и т. п.) —
   судя по всему, остаток шага 5 (готча 7a): плоские поля были там до
   фикса, `payload` добавили поверх, старое не убрали. Функционально
   безвредно (callee читает только `payload`, платформа игнорирует лишние
   ключи `flowProps`), но захламляет экспорт и может ввести в заблуждение
   будущего ревьюера — тем более что шесть более поздних вызовов
   (`event-wizard-*`, `step_17`–`step_22`) этого мусора уже не содержат,
   то есть это именно недочищенный переходный артефакт одного шага сборки,
   а не текущий паттерн команды.

### Ответ владельца пакета

1. **Исправлено.** `checkin-api` и `my-qr-api` пересобраны: `ROUTER` сразу
   после проверки `initData` (`step_1`/`step_2`), ветка `Otherwise`
   (невалиден) отвечает `401` немедленно, ни один `tables-find-records`/`callFlow`
   больше не выполняется на мусорном `initData`. **Платформенная ловушка,
   найденная по пути и стоившая отдельной попытки и отката**: `ap_add_step`
   с `ROUTER` через `AFTER` на уже связанный шаг не гейтит старое продолжение —
   обе цепочки выполняются параллельно (см. CLAUDE.md, гочa #10). Рабочий
   путь — удалить старую цепочку (`ap_delete_step` по одному шагу, каждый
   реиспользует settings соседнего) и пересобрать её заново **внутри**
   нужной ветки. Пересборка проверена прогоном реального `garbage initData`
   (короткий путь, 4 шага вместо 9) и replay реального прод-прогона
   (idентичный результат `already`/`403` и т.д. до и после).
2. **Исправлено.** Все 12 текстонесущих флоу пакета (`reg-start`,
   `reg-consent-pdn`, `reg-consent-mkt`, `checkin-api`, `my-qr-api`,
   `event-wizard-start`, `event-wizard-edit-start`, `event-wizard-field`,
   `event-wizard-photo`, `event-wizard-geo`, `event-wizard-publish`) переведены
   на `inputs.texts`; `reg-phone`/`reg-consent-mkt` уже были в конвенции
   (не подпадали под замечание). Каждое значение проверено построчно против
   `i18n/ru.json` (см. ниже). Добавлены отсутствовавшие ключи
   (`wizard.edit.ask_title`, `wizard.edit.not_found`, `wizard.edit.not_owner`,
   `wizard.err.title_length`, `wizard.err.address_length`,
   `wizard.err.photo_expected`, `wizard.preview.*`, `wizard.publish.*`) и
   поправлены три расходившихся с реальным поведением (`wizard.hint.datetime`/
   `wizard.err.datetime` — формат дат ДД.ММ.ГГГГ, а не ISO; `wizard.ask.geo`/
   `wizard.err.geo_expected` — с явным упоминанием пропуска через `-`).
   Каждый затронутый флоу переопубликован и перепроверен `ap_test_flow` —
   позитивный путь и (где применимо) путь ошибки, с реальной доставкой
   сообщений там же, где это делалось при сборке.
3. **Исправлено.** `catalog/snippets/hmac-init-data.md`, `hmac-qr.md`,
   `parse-start.md`, `find-registration.md` переписаны: три из четырёх
   больше не описывают дублирование (криптография и разбор теперь в
   единственном `fn-*`, копий нет — таблицу «Встраивают» вести не для чего);
   `hmac-qr.md` оставлена с двумя записями (`fn-sign-qr`/`fn-verify-qr` —
   сознательное исключение ADR-0015 п. 5). `fmt-time.md` и `event-card.md`
   отмечены устаревшими для W26: многоязычный батч-эталон и раздельный
   резолвер были нужны до ADR-0014, сейчас каждый флоу форматирует время и
   тексты инлайн — списки «Встраивают» заменены на честное «копии не
   идентичны, байтовая сверка неприменима» вместо ложных записей о мёртвых
   флоу. `ru-texts.md` дополнен разделом про более лёгкий вариант W26.
   `snippets/README.md` приведён в соответствие: Q35 закрыт, `fn-*` собраны,
   секция «что изменится после Q35» переписана в прошедшем времени.
4. **Исправлено.** `catalog/tables/events.md`: заметка про `overbook_pct`
   больше не приписывает визарду запись дефолта — сказано прямо, что поле
   остаётся пустым, дефолт учитывает только `reg-start` при расчёте лимита.
5. **Исправлено.** Таблица «Что построено» дополнена шестью флоу визарда.
   Раздел «Как проверено» заполнен сводкой (была пустой строкой «—»).
6. **Не исправлено, осознанно отложено.** Лишние плоские ключи в `flowProps`
   четырёх вызовов `tg-router` (`reg-start`/`reg-consent-pdn`/
   `reg-consent-mkt`/`reg-phone`) убрать не удалось: `ap_update_step` не
   умеет удалять под-поля DYNAMIC-пропа, только перезаписывать (см. описание
   инструмента) — а владельцу пакета `settings.input` этих шагов через MCP
   не виден вовсе (ADR-0006, REST — только у ревьюера). Функционально
   безвредно, задокументировано как хвост; чинится либо ревьюером (есть
   REST-доступ), либо полной пересборкой этих четырёх шагов, что не
   оправдано ради косметики.

## Хвосты и блокеры

- **Q35** — закрыт (шаг 3), см. журнал.
- **Q36** — закрыт [ADR-0016](../adr/0016-shared-flow-for-same-shaped-touches.md), см. журнал.
- **STF-2** — закрыт всеми четырьмя сценариями на реальной подписи, см. журнал.
  Больше не блокер.
- **Единственное, что осталось** перед статусом «готов» — независимое ревью
  (не запущено). Пакет теперь покрывает и исходную область W26 (регистрация,
  чекин), и слитый W11 (визард ивента) одним ревью.
- **Тестовая фикстура оставлена намеренно**, не для продакшена: таблица
  `events` содержит `id: demo` («Демо-ивент W26», `status: published`,
  `capacity: 2`, `owner_id: 322876545`), `registrations` — одну строку
  `demo-322876545` (`status: registered`, `checked_in_at` пуст). Оставлена,
  чтобы реальному прогону STF-2 (см. выше) было на чём проверяться без
  пересборки окружения; ревьюер или владелец может удалить после приёмки.
