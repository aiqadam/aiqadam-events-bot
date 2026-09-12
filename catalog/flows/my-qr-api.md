# Flow: my-qr-api

> **W24 (2026-09-13): локализация снята, только русский.**
> [ADR-0014](../../docs/adr/0014-russian-only-until-platform-i18n.md). Чтения
> таблицы `strings` удалены, тексты пришли во вход CODE-шагов, которые их
> формируют — эталон [`ru-texts`](../snippets/ru-texts.md). Форма ответа этих
> шагов не изменилась ни на байт, поэтому шаги отправки не трогались.
> Ушли `step_8` и `step_26` (чтения `strings`), а также `step_15`/`step_16` (чтение и разбор языка пользователя — выбирать больше не из чего); флоу **26 → 22 шага**.
> Ниже по тексту упоминания `strings`, `i18n-resolve` и «перевода» относятся к
> состоянию **до** этой даты и сохранены как история.

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook / catch_webhook`, `authType: none`. Синхронный ответ —
  вызывается по `POST /api/v1/webhooks/I5nd8ggKH4wkQLaww9Dkl/sync` (суффикс `/sync`).
- **Назначение**: выдаёт участнику подписанный `payload` QR (PAR-6) для рендера
  в браузере — [ADR-0007](../../docs/adr/0007-qr-rendered-in-miniapp.md). Вызывается
  страницей `miniapp/ticket.html`, не другими флоу.
- **Flow ID (MCP)**: `I5nd8ggKH4wkQLaww9Dkl`

## Контракт

**Вход:** `{ initData: string, eventId: string }` — тело POST-запроса от Mini App.

**Выход:** всегда `HTTP 200`, тело:

| Ситуация | Тело ответа |
| --- | --- |
| Успех | `{ ok: true, payload: "c<eventId>-<userId>-<sig>" }` |
| `initData` невалиден/просрочен или `eventId` не проходит форму | `{ ok: false, error: "invalid_init_data", reason, text }` |
| Нет активной регистрации на этот `eventId` у этого `telegram_id` | `{ ok: false, error: "not_registered", text }` |

`text` — **уже локализованный** текст ошибки для экрана (язык участника из
`users.lang`; для `invalid_init_data` — `ru`, т.к. пользователь не проверен).
Ключи `checkin.not_registered` / `checkin.unauthorized` из таблицы `strings`
разрешаются CODE-шагом по эталону [`i18n-resolve`](../snippets/i18n-resolve.md)
(ключи общие с `checkin-api` — семантика совпадает; Q19). `ticket.html`
показывает серверный `text`, свой словарь для этих исходов не держит.

`telegram_id` берётся **только** из проверенного `initData` (аналог STF-2) — тело
запроса не может задать чужой `telegram_id`, только `eventId`.

## Шаги

> Снято `ap_flow_structure` + `ap_read_step_code` после публикации (W7).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | вход Mini App | — |
| step_1 | CODE «parse + validate input» | форма `eventId` (`[A-Za-z0-9_]{1,12}`) | `{{trigger['output'].body}}` |
| step_19 | CODE «parse initData» | разбор `initData`, `data_check_string` | `{{step_1['output'].initData}}` |
| step_20 | CODE «hmac initData (эталон)» | HMAC-цепочка Telegram, `node:crypto` | `{{variables['BOT_TOKEN']}}` · эталон [`hmac-init-data`](../snippets/hmac-init-data.md) |
| step_21 | CODE «verify initData» | constant-time сравнение + свежесть | `expected` = `{{step_20['output']}}`, `maxAgeSeconds: 86400` |
| step_3 | CODE «combine validity» | `valid`, `telegramId`, `reason` | `{{step_21['output']}}`, `{{step_1['output'].eventIdValid}}` |
| step_4 | ROUTER «initData+eventId валидны?» | `valid` (0) / `Otherwise` (1 → `invalid_init_data`) | `{{step_3['output'].valid}}` |
| step_26 (branch 1) | `tables-find-records strings` | `key in (checkin.unauthorized)` | `table_id = qi6bBTL7plRGBgFUfli8w` |
| step_27 (branch 1) | CODE «resolve i18n unauthorized (эталон)» | `lang: ru` (пользователь не проверен) | `{{step_26['output']}}` · эталон [`i18n-resolve`](../snippets/i18n-resolve.md) |
| step_13/14 (branch 1) | CODE + `return_response` | `{ ok:false, error:"invalid_init_data", reason, text }`, статус `200` | `{{step_27['output']}}`, `{{step_3['output'].reason}}` |
| step_2 (branch 0) | CODE «normalize registration keys» | сентинел `-` вместо пустого фильтра | `{{step_1['output'].eventId}}`, `{{step_3['output'].telegramId}}` |
| step_22 | `tables-find-records registrations` | два `eq`, **без `limit`** | `table_id = PNuChoFG0tIBTND86yzDL` |
| step_23 | CODE «pick earliest registration (ADR-0003)» | каноническая строка | `{{step_22['output']}}` |
| step_6 | CODE «decide outcome» | `ok` только если `registered` | `{{step_23['output']}}` |
| step_7 | ROUTER «outcome?» | `ok` (0) / `Otherwise` (1 → `not_registered`) | `{{step_6['output'].outcome}}` |
| step_5 (branch `ok`) | CODE «canonical msg (эталон)» | `'c:' + eventId + ':' + userId`, **падает** на мусорном входе | `{{step_1['output'].eventId}}`, `{{step_3['output'].telegramId}}` · эталон [`hmac-qr`](../snippets/hmac-qr.md) |
| step_24 (branch `ok`) | CODE «sign QR (эталон)» | HMAC → base64url → первые 10, сборка `payload` | `{{variables['QR_SIGNING_KEY']}}` |
| step_9/10 (branch `ok`) | CODE + `return_response` | `{ ok: true, payload }`, статус `200` | `{{step_24['output']}}` |
| step_15 (branch `not_registered`) | `tables-find-records users` | строка участника → язык; **проекция колонок**: только `lang` | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_16 (branch `not_registered`) | CODE «resolve user lang» | `lang` (фолбэк `ru`) | `{{step_15['output']}}` |
| step_8 (branch `not_registered`) | `tables-find-records strings` | `key in (checkin.not_registered)` | `table_id = qi6bBTL7plRGBgFUfli8w` |
| step_25 (branch `not_registered`) | CODE «resolve i18n not_registered (эталон)» | язык участника | `{{step_8['output']}}`, `{{step_16['output'].lang}}` |
| step_11/12 (branch `not_registered`) | CODE + `return_response` | `{ ok:false, error:"not_registered", text }`, статус `200` | `{{step_25['output']}}` |
## Зависимости

- **Subflow'ы**: **нет ни одного** (W21, [ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md))
- **Таблицы**: `registrations` (чтение), `users` (чтение языка, только в ветке `not_registered`),
  `strings` (чтение: по одному запросу на каждую ветку ошибки; ок-путь `strings` не читает)
- **Переменные**: `BOT_TOKEN` (`step_20`), `QR_SIGNING_KEY` (`step_24`) — обе в длинной форме
- **Connections**: —

## Заметки

- **W21 (2026-09-12) — пять `callFlow` убраны, subflow'ов не осталось.** 19 → 26 шагов.
  `fn-verify-init-data` → `step_19`/`step_20`/`step_21`, `fn-find-registration` →
  `step_2`/`step_22`/`step_23`, `fn-sign-qr` → `step_5`/`step_24`, два вызова `fn-t` →
  по чтению `strings` плюс CODE-шагу разрешения в каждой ветке ошибки.
  - **Здесь чтения `strings` разнесены по веткам намеренно, в отличие от
    `checkin-api`.** Там общее чтение до ветвления выгодно: все ветки после
    аутентификации нуждаются в строках. Здесь строки нужны **только** веткам
    ошибок, а `ok` — горячий путь — не читает `strings` вовсе. Общее чтение до
    `step_4` добавило бы запрос именно туда, где его быть не должно.
- **Сквозная совместимость подписи проверена и сошлась (обязательный пункт W21).**
  `my-qr-api/step_24` выдал `aIxmwbnzb_` для `(demo, 322876545)` — ровно ту
  подпись, которую независимо посчитала и приняла встроенная проверка
  `checkin-api/step_38`. Две независимые копии HMAC, разнесённые по разным флоу,
  сошлись на одном значении. Прогоны `JMAC4mcduVJjKONyTQC2g` и
  `G05GjI12dsGeWssBAwAAt`.
- **Как проверялось перед публикацией (W21).** Тем же приёмом, что и `checkin-api`:
  `initData` синтезировать нельзя ([Q16](../../docs/OPEN-QUESTIONS.md#q16)), поэтому
  ветки за `step_4` прогонялись при временно замкнутом сравнении в черновике
  (`step_21.expected` ← `{{step_19['output'].hash}}`). Замыкание снято до публикации,
  возврат подтверждён различающим прогоном `YlnVABOpteQfT6klKeBFi`: тот же вход,
  что проходил при замыкании, дал `bad_hash`.

  | Исход | Прогон | Ответ | Время |
  |---|---|---|---|
  | `invalid_init_data` | `dAahWRGwDhy9YKkoqf9RG` | `ok:false`, `malformed` | 1,8 с |
  | `ok` | `JMAC4mcduVJjKONyTQC2g` | `payload: cdemo-322876545-aIxmwbnzb_` | 1,7 с |
  | `not_registered` | `vSRdG9HZ7IMlpuIyQCMH4` | `ok:false`, «Нет регистрации» | 2,8 с |

  Ingress после публикации проверен `curl`'ом — `{"ok":false,"error":"invalid_init_data"}`.

- ~~**Все `callFlow`-шаги — `executionMode: inline`** (W20, 2026-09-12).~~
  **Неактуально с W21: `callFlow`-шагов не осталось.** Запись сохранена, потому
  что на ней стоит замер, от которого считается выигрыш.
  Исходный текст: W17
  перевёл на inline `checkin-api`, `registration` и `fn-event-card`, но
  `my-qr-api` тогда не тронул. Проверено прогоном `IkrsFXyLwEoE9m4wvUwX0`
  (ветка `invalid_init_data`, 4,7 с).

- **Всегда `HTTP 200`, ошибка — в теле.** Страница сама разбирает `ok`/`error`,
  а не HTTP-статус — проще для `fetch()` без обвязки на 4xx/5xx.
- **Локализация ошибок — на сервере (Q19, W7).** `step_15`/`step_16` резолвят
  `users.lang` по `telegram_id` из проверенного `initData` (для `not_registered` —
  у участника может не быть регистрации на этот ивент, но язык известен из его
  строки `users`; строки нет — фолбэк `ru`). `invalid_init_data` всегда `ru`:
  пользователь не проверен, как в `401` у `checkin-api`.
- **Чтение `users` — только в ветке `not_registered`.** По замечанию ревью W7 №2
  резолв языка перенесён внутрь этой ветки: успешный `ok`-путь (самый частый —
  каждое открытие тикета) строку пользователя **не читает**, и её полные данные
  (`phone`, `consent_*`) не попадают в логи прогонов на успешных запросах (Q17).
- **Не проверяет статус ивента** (`published`/`cancelled`/`finished`) — это
  сознательно: показ уже выданного QR не должен зависеть от того, что случилось
  с ивентом после регистрации. Актуальность на входе проверяет `checkin-api` (STF-2),
  а не эта выдача.
- **Проверено сквозным прогоном с настоящей криптографией в W5/W8.** В W7
  (2026-09-09) повторно прогнаны **все ветки** на опубликованной версии напрямую
  `curl` (Origin `https://miniapp.events.aiqadam.org`, `access-control-allow-origin: *`
  в ответе): `ok` (зарегистрированный участник, `payload` совпал с `fn-sign-qr`),
  `not_registered` с языком `ru` (`"Нет регистрации"`), `not_registered` с языком
  `en` у другого пользователя (`users.lang = en`, `"Not registered"` — язык берётся
  из `users`, не из `language_code` Telegram), `invalid_init_data` (`"Данные Mini App
  устарели — переоткройте приложение"`). `initData` посчитан временным флоу с двумя
  `crypto : hmac-signature` на реальном `variables['BOT_TOKEN']`; фикстуры удалены
  после проверки, временный флоу удалён.

## Изменения W22 (2026-09-13)

Тела шагов не менялись, кроме одного: CODE-шаг эталона
[`find-registration`](../snippets/find-registration.md) получил **отбор строк
по паре `(event_id, telegram_id)` прямо в коде**, а не только в фильтре чтения.
Это часть общей правки эталона (все копии обновлены одним текстом) и имеет
двойной смысл: латентность (одно широкое чтение может кормить нескольких
потребителей) и страховка от fail-open платформы
([#382](https://github.com/aiqadam/qadam-flow/issues/382),
[Q25](../../docs/OPEN-QUESTIONS.md#q25)) — выпавший фильтр чтения больше не
превращается в выдачу чужой строки.

Здесь читающие фильтры остались **узкими** (два `eq`), поэтому поведение шага
не изменилось: отбор в коде отбрасывает ноль строк. Затронутые шаги:
`step_23`.
