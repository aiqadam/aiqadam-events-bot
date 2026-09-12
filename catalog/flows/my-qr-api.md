# Flow: my-qr-api

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
через `fn-t` (общие с `checkin-api` — семантика совпадает; Q19). `ticket.html`
показывает серверный `text`, свой словарь для этих исходов не держит.

`telegram_id` берётся **только** из проверенного `initData` (аналог STF-2) — тело
запроса не может задать чужой `telegram_id`, только `eventId`.

## Шаги

> Снято `ap_flow_structure` + `ap_read_step_code` после публикации (W7).

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | вход Mini App | — |
| step_1 | CODE «parse + validate input» | форма `eventId` (`[A-Za-z0-9_]{1,12}`, как у `fn-sign-qr`) | `{{trigger['output'].body}}` |
| step_2 | `@aiqadam/qadam-subflows : callFlow` → `fn-verify-init-data` | HMAC токена бота + свежесть | `{{step_1['output'].initData}}` |
| step_3 | CODE «combine validity» | `valid`, `telegramId`, `reason` | `{{step_2['output'].data}}`, `{{step_1['output'].eventIdValid}}` |
| step_4 | ROUTER «initData+eventId валидны?» | `valid` (branchIndex 0) / `Otherwise` (branchIndex 1 → `invalid_init_data`) | `{{step_3['output'].valid}}` |
| step_18 (branch 1) | `callFlow → fn-t` | `checkin.unauthorized`, `lang: ru` | — |
| step_13/14 (branch 1) | CODE + `return_response` | `{ ok:false, error:"invalid_init_data", reason, text }`, статус `200` | `{{step_18['output'].data.text}}`, `{{step_3['output'].reason}}` |
| step_5 (branch 0) | `callFlow` → `fn-find-registration` | регистрация участника на `eventId` | `eventId`, `telegramId` из step_1/step_3 |
| step_6 | CODE «decide outcome» | `ok` только если `registration.registered` | `{{step_5['output'].data}}` |
| step_7 | ROUTER «outcome?» | `ok` (branchIndex 0) / `Otherwise` (branchIndex 1 → `not_registered`) | `{{step_6['output'].outcome}}` |
| step_8 (branch `ok`) | `callFlow` → `fn-sign-qr` | подпись `payload` | `eventId`, `userId = telegramId` |
| step_9/10 (branch `ok`) | CODE + `return_response` | `{ ok: true, payload }`, статус `200` | `{{step_8['output'].data}}` |
| step_15 (branch `not_registered`) | `tables-find-records users` | строка участника → язык (только в этой ветке, ок-путь `users` не читает); **проекция колонок**: только `lang` | `table_id = z5PX9B8mTQC9Q6Dfuj5dM` |
| step_16 (branch `not_registered`) | CODE «resolve user lang» | `lang` (фолбэк `ru`) | `{{step_15['output']}}` |
| step_17 (branch `not_registered`) | `callFlow → fn-t` | `checkin.not_registered`, `lang: {{step_16['output'].lang}}` | — |
| step_11/12 (branch `not_registered`) | CODE + `return_response` | `{ ok:false, error:"not_registered", text }`, статус `200` | `{{step_17['output'].data}}` |

## Зависимости

- **Subflow'ы**: `fn-verify-init-data`, `fn-find-registration`, `fn-sign-qr`, `fn-t`
- **Таблицы**: `users` (чтение языка, опционально) — только через qadam'а; остальное через subflow'ы
- **Переменные**: — · **Connections**: — (токен бота читается внутри `fn-verify-init-data` из Variable)

## Заметки

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
