# W17. Inline execution mode для `callFlow` на горячем пути

- **Статус**: в работе
- **Владелец**: агент W17
- **Волна**: 5
- **Зависит от**: W8, W5, W16
- **Начат**: 2026-09-11 · **Закрыт**: —

## Цель

Применить `executionMode: "inline"` (upstream [qadam-flow#363](https://github.com/aiqadam/qadam-flow/issues/363),
раскатано на инстансе) к синхронным `callFlow`-цепочкам горячего пути
(`checkin-api`, `registration`, `fn-event-card`) и перемерить латентность
тем же методом, что [Q22](../OPEN-QUESTIONS.md#q22)/W16 — before/after на
опубликованной версии. Подробности и чек-лист — [BACKLOG.md#w17](../BACKLOG.md#w17-inline-execution-mode-для-callflow-на-горячем-пути).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-api` | `CUKqiby1PoHiQiiCQy24V` | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| flow `registration` | `vfVfIngczCKA2DpUgcevP` | [catalog/flows/registration.md](../../catalog/flows/registration.md) |
| flow `fn-event-card` | `L1l2LOngDtxPHFSdRp5fE` | [catalog/flows/fn-event-card.md](../../catalog/flows/fn-event-card.md) |

## Чек-лист готовности

- [x] схема `executionMode` подтверждена через `ap_get_piece_props`
  (`@aiqadam/qadam-subflows : callFlow`, `STATIC_DROPDOWN`, `queue`/`inline`, дефолт `queue`)
- [x] `fn-event-card`: 4 callFlow-шага переведены на `inline`, опубликовано
- [x] `checkin-api`: 10 callFlow-шагов переведены на `inline`, опубликовано
- [x] `registration`: 22 callFlow-шага переведены на `inline` (кроме `tg-router → registration`), опубликовано
- [x] after-прогон снят на `fn-event-card`/`registration`, числа записаны в ADR-0009/Q22
- [ ] **`checkin-api`: after-прогон на реальном подписанном `initData`/QR** — по
  решению владельца пакета не снимался синтетической fixture-цепочкой этим
  агентом; владелец проверяет вживую сам
- [ ] три различающих прогона STF-2 + позитивный контроль повторены на `checkin-api` — не выполнено, см. выше
- [ ] IDM-1 (повторный `/start`) повторён на `registration` — не выполнено
- [x] `catalog/` совпадает с живым проектом (`checkin-api.md`, `registration.md`, `fn-event-card.md`)
- [ ] независимое ревью, вердикт «замечаний нет» — не запущено, пакет не доведён

## Как проверено

- `fn-event-card` (прогон `82VoWEXcjRZJKSaD6aQlP`, TESTING, `eventId: "demo"`,
  опубликованная версия с inline): 6,7 с полная длительность, ≈6,6 с сумма
  шагов — против эталона 12–13 с при ≈2 с шагов (пауза была ≈10–11 с, стала ≈0,1 с).
- `registration` `/start`, ветка `new` (прогон `fGqdXXeslOT5TAtbW53TR`, TESTING,
  `telegramId: 8255904812`, реальный self-test аккаунт владельца, реальные
  Telegram-сообщения включая `sendVenue`, опубликованная версия с inline):
  17,1 с полная длительность, ≈16,9 с сумма шагов — против эталона 34,2 с
  (`JYWkDu2jBXX9BDd3kHna3`, пауза была ≈26,4 с, стала ≈0,2 с). Тестовая строка
  `sessions` (`lDF2FW1pUiZeBE4BvSA1y`) удалена после прогона; реальной строки
  `registrations` не появилось (прогон остановился на `await_pdn`, до создания
  регистрации).
- `checkin-api` — переведён на `inline` и опубликован (`ap_validate_flow` чист),
  но живой after-прогон с реальными `initData`/QR этим пакетом не снят.

## Журнал

- **2026-09-11** — пакет взят. Контекст: команда qadam-flow закрыла
  [issue #363](https://github.com/aiqadam/qadam-flow/issues/363) и раскатала
  `executionMode: "inline"` на `callFlow` (PR upstream #365, milestone v2.0.0).
  Это прямой ответ на [Q22](../OPEN-QUESTIONS.md#q22) — «пауза» между хопами
  была объявлена платформой фиксированной архитектурной стоимостью синхронного
  `callFlow` (до 3 циклов BullMQ-джобы + снапшот/resume), inline её убирает,
  исполняя ребёнка в engine-процессе родителя без джобы/снапшота/waitpoint.
  Из финального комментария в issue — жёсткое ограничение: inline-ребёнок
  никогда не должен паузиться (Delay/Human Input/вложенный `queue`-`callFlow`
  с ожиданием). Ни один subflow горячего пути такого не делает — все чистые
  CODE/tables-цепочки, проверено по каталогу перед стартом.
- **2026-09-11** — `ap_get_piece_props` подтвердил схему (`executionMode`,
  `STATIC_DROPDOWN`, дефолт `queue`). `ap_update_step` с частичным `input`
  (только `{executionMode: "inline"}`) подтверждённо **мержит**, а не заменяет
  весь input шага — после первой правки (`fn-event-card` `step_4`)
  `ap_validate_flow` показал только старую известную issue про
  `{{variables...}}`, остальные поля (`flow`/`mode`/`flowProps`/`waitForResponse`)
  сохранились.
- **2026-09-11** — `fn-event-card` (4 шага), `checkin-api` (10 шагов),
  `registration` (22 шага) переведены на `inline` и опубликованы по очереди.
  В `registration` `step_43` на первой попытке `ap_update_step` дал
  `step_validity: invalid` при валидации — повторный идентичный вызов прошёл
  чисто; похоже на транзиент платформы, а не системную проблему (остальные 21
  шаг того же флоу прошли с первого раза).
- **2026-09-11** — after-прогоны на `fn-event-card`/`registration` сняты и
  сравнены с эталоном (см. «Как проверено»); ADR-0009 и Q22 обновлены числами.
  Владелец пакета решил не строить синтетическую fixture-цепочку (`initData`+QR
  через временный флоу с `crypto : hmac-signature`) для `checkin-api` —
  проверит вживую сам. Регресс-прогоны STF-2/IDM-2 тоже оставлены владельцу.
  Статус пакета остаётся **в работе**, не `на проверке` — чек-лист не пройден
  целиком.
- **2026-09-11 — регрессия найдена и исправлена живым прогоном владельца.**
  Владелец гонял `registration` вживую (`return_void_0` регистрируется через
  реальный `/start edemo`). Прогон `vJTyTL3qX0klGVpOXN7EK` упал на `step_44`
  (`send_text_message`) с `400 Bad Request: message text is empty`: `step_43`
  («перевод reg.done», `callFlow → fn-t`) вернул `texts: {}, keys: []` —
  **пустой список ключей**, хотя должен был запросить `key: "reg.done"`.
  Причина — та самая транзиентная история из первой сессии: `step_43` — единственный
  из 22 переведённых на `inline` шагов, которому потребовалась **вторая** попытка
  `ap_update_step` (первая дала `step_validity: invalid`). Вторая попытка передавала
  только `{executionMode: "inline"}` и `ap_validate_flow` после неё показал `valid`,
  но, как выяснилось, при этом молча очистилось `flowProps.payload` (сам `key`/`vars`
  для `fn-t`) — структурная валидация это не ловит, потому что схема `callFlow`
  не проверяет содержимое `flowProps` рантаймом. **Читать `flowProps.payload` через
  MCP нельзя** ([ARCHITECTURE.md](../ARCHITECTURE.md#subflowы-на-практике--проверено-на-инстансе-2026-09-08-w2),
  ADR-0006), поэтому восстановить исходный `payload` пришлось не чтением, а
  реконструкцией по документации `registration.md` (`reg.done`, `{title}` из
  `{{step_39['output'].eventTitle}}`, `lang` из `{{step_1['output'].lang}}`) и
  проверкой на изолированном `fn-t` (`ap_test_flow` с теми же `key`/`vars` —
  прогон `whJ80F7sZI0m7WXbRLCCG`, `text: "Вы зарегистрированы на «AI Qadam Demo
  Meetup»."`, корректно). `ap_update_step` с восстановленным `flowProps.payload`
  + `executionMode: "inline"`, `ap_validate_flow` чист, опубликовано.
  **Урок:** если `ap_update_step` на PIECE-шаге с DYNAMIC-полем (`flowProps`,
  `response`) требует повторной попытки после `step_validity: invalid` —
  это сигнал проверить не только структурную валидность после повтора, но и
  содержимое DYNAMIC-подполей живым прогоном того же шага/callee, а не полагаться
  на «`ap_validate_flow` зелёный → всё цело». Остальные 21 переведённых шага
  `registration` (и все 10 в `checkin-api`, 4 в `fn-event-card`) прошли
  `ap_update_step` с первой попытки — риск точечный, но непроверенные вживую
  ветки (`declined`, `existing`, `mkt_answer`, `phone_answer`) стоит пройти
  тем же вниманием, прежде чем ставить `готов`.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

## Хвосты и блокеры

- `checkin-api` уже переведён на `inline` и опубликован, но **не проверен
  прогоном**: нужен after-замер латентности (реальный `initData`/QR) и повтор
  трёх различающих прогонов STF-2 + позитивного контроля — владелец делает
  это вживую отдельно от этой сессии.
- IDM-1 (повторный `/start` → ветка `existing`) на `registration` после
  изменений не перепроверен.
- **Найдена и исправлена одна регрессия** (`step_43`, пустой `flowProps.payload`
  после повторного `ap_update_step` — см. журнал 2026-09-11). Ветки
  `registration`, которые живой прогон владельца ещё не коснулся —
  `declined` (`step_9…12`), `existing`/IDM-1 (`step_13…18`), `mkt_answer`
  (`step_52…63`), `phone_answer` (`step_64…76`) — стоит пройти вживую тем же
  вниманием: ни один из этих шагов не требовал повторной попытки при переводе
  на `inline`, но раз один случай уже нашёлся, полагаться на `ap_validate_flow`
  без живой проверки текста сообщений — рискованно.
- Независимое ревью не запускалось — статус `на проверке` рано ставить, пока
  открыты пункты выше.
