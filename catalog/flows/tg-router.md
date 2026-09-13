# Flow: tg-router

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-telegram-bot / new_telegram_message` (`update_types: message, callback_query`),
  connection `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Назначение**: единственная точка входа бота — дедуп по `update_id` (IDM-4),
  апсерт `users`, классификация апдейта, делегирование одному из касаний
  регистрации (ADR-0015) или визарда ивента (W11, слит в W26, ADR-0016).
- **Flow ID (MCP)**: `nyaBzgKGG8TTTsryjc9tW` · **externalId**: — (не subflow)

## Контракт

Роутер сам ничего не отвечает пользователю. Правило маршрутизации (`step_10`):

1. `/start e<id>-<utm>` (валидный `fn-parse-start`, `kind='e'`) → `reg-start`,
   **независимо от активной сессии** — новый вход по deep link перекрывает
   недоведённый диалог.
2. `/newevent` → `wiz_start`; `/editevent <id>` → `wiz_edit_start` —
   **независимо от активной сессии**, тем же принципом, что и `/start`.
3. Иначе, если активная сессия — визард (`scenario` = `event_create`/`event_edit`):
   по `sessions.step` → `wiz_photo` (`step='photo'`), `wiz_geo` (`step='geo'`),
   `wiz_publish` (`step='preview'`, обычно вместе с `callback_query`), иначе
   (`title`/`description`/`address`/`starts_at`/`ends_at`/`reg_deadline_at`) →
   `wiz_field` — один флоу на все шесть текстовых полей (ADR-0016).
4. Иначе, если есть активная сессия (`sessions`, не протухшая `>24ч`,
   `scenario/step` не `-`) со `scenario='registration'`: по `step`
   (`await_pdn`/`await_marketing`/`await_phone`) → соответствующее касание.
5. Иначе — `Otherwise`, лог «намерение без обработчика» (checkin-deeplink/staff-accept — W9/W10, вне области W26).

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | приём апдейтов (`message`, `callback_query`) | — |
| step_1 | CODE «normalize update» | разбор `message`/`callback_query`/`contact`, команда+payload, `dedupKey` | `{{trigger['output']}}` |
| step_2 | `@aiqadam/qadam-store : put_if_absent` | атомарный захват `upd:<update_id>` (IDM-4) | `ttl_seconds: 86400`, `store_scope: COLLECTION` |
| step_3 | CODE «gate» | `proceed`/`reason` (`bad_update`/`duplicate`/`from_bot`/`non_private_chat`) | |
| step_4 | ROUTER: `proceed` / `Otherwise` (лог) | | |
| step_6 | `tables-upsert-records users` | апсерт по `telegram_id`, снимает `blocked_bot` | |
| step_7→8 | `tables-find-records sessions` → CODE «pick session» | freshest, не `-`, не старше 24ч | |
| step_9 | `callFlow fn-parse-start` (`inline`, `waitForResponse: true`) | разбор `/start`-payload | `flowProps.payload.start` |
| step_10 | CODE «routing decision» | вычисляет `route` (см. выше) | |
| step_11 | ROUTER по `route`: `reg_start`/`reg_pdn`/`reg_mkt`/`reg_phone`/`wiz_start`/`wiz_edit_start`/`wiz_field`/`wiz_photo`/`wiz_geo`/`wiz_publish`/`Otherwise` | | |
| step_12→15 | `callFlow reg-start`/`reg-consent-pdn`/`reg-consent-mkt`/`reg-phone` (`queue`, `waitForResponse: false`) | делегирование обработчику регистрации | |
| step_17→22 | `callFlow event-wizard-start`/`event-wizard-edit-start`/`event-wizard-field`/`event-wizard-photo`/`event-wizard-geo`/`event-wizard-publish` (`queue`, `waitForResponse: false`) | делегирование обработчику визарда | |
| step_16 | CODE «намерение без обработчика» | лог (`Otherwise` от `step_11`) | |
| step_5 | CODE «апдейт пропущен — почему» | лог (`Otherwise` от `step_4`, гейт) | |

## Зависимости

- **Таблицы**: `users` (`xHhYjhwqKdONkrYJGcBsz`), `sessions` (`toTKgngMTqDNJWDpQMh4d`, чтение)
- **Флоу**: `fn-parse-start`, `reg-start`, `reg-consent-pdn`, `reg-consent-mkt`, `reg-phone`,
  `event-wizard-start`, `event-wizard-edit-start`, `event-wizard-field`,
  `event-wizard-photo`, `event-wizard-geo`, `event-wizard-publish` — делегирование,
  не subflow-функции (ADR-0015 п. 4)
- **Переменные**: —
- **Store**: `upd:<update_id>`, `COLLECTION`, `ttl_seconds: 86400`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Открытие W26, критично для всех будущих `callFlow`: `flowProps` теперь
  резолвится в единственное поле `payload` (тип `OBJECT`), а не в плоские
  именованные поля, как было задокументировано в
  [flows/README.md](README.md#проверенные-факты-про-subflowы-2026-09-08-пакет-w2)
  и работало в W2–W22.** Без обёртки вызов проходит validate и **прогон
  формально успешен**, но callee получает пустые поля — тихий отказ, не
  ошибка (найдено на `chat_id is empty` при попытке `reg-start` без обёртки).
  **Правильная форма:** `flowProps: {"payload": {<реальные поля callee>}}`;
  callee по-прежнему читает их плоско, `{{trigger['output'].data.<field>}}` —
  платформа разворачивает `payload` обратно на стороне callee. Проверено
  различающим прогоном (без обёртки → `chat_id is empty`, с обёрткой →
  сообщение доставлено) на `reg-start` (`FkxtgayOK5QubyqqMd9q4`) и
  `fn-parse-start`. **Все будущие `callFlow` в проекте (`checkin-api`,
  `my-qr-api`, W11, W14) обязаны использовать обёртку `payload`.**
- **Гейт `step_3` отбивает четыре причины одним полем `reason`**: `bad_update`,
  `duplicate`, `from_bot`, `non_private_chat` — порядок именно такой (от
  «апдейт нечитаем» к «пользователь не тот»).
- **`executionMode: queue` на всех четырёх вызовах касаний, не `inline`.**
  Открытие 2026-09-13 (по жалобе владельца на медленную реакцию на `/start`):
  `inline` синхронен независимо от `waitForResponse` — родитель ждёт **всю**
  длительность вызванного флоу (включая отправку сообщений Bot API,
  ~0,7–0,9 с каждое), а не только диспетчеризацию. `waitForResponse: false`
  влияет лишь на то, забирается ли возврат, не на то, ждать ли завершения.
  Это отменяет предположение W17/W20, что `inline` + `waitForResponse: false`
  — fire-and-forget; в этом движке fire-and-forget даёт только `queue`.
  Различающий прогон одного и того же вызова: `inline` — 1442 мс, `queue` —
  0,1 мс. Собственная длительность `tg-router` упала с 1,7–2,1 с до 0,5–0,6 с.
  **Правило:** `queue` для «передал и не жду ответа» (как здесь), `inline`
  только когда родителю нужен ответ (`fn-parse-start` на `step_9` — inline,
  и это правильно: Q35 даёт ~96 мс/хоп, а результат обязателен для маршрутизации).
- **Апсерт `users` не пропускает запись при отсутствии изменений** (в отличие
  от исторической W22-оптимизации) — упрощение ради читаемости флоу
  (ADR-0015); латентность не в приоритете (Q35: дорогая статья — отправка
  сообщений, не запись в таблицу, ~25–70 мс).
- **Проверено 2026-09-13, все маршруты и все три причины отказа, включая
  различающие прогоны**: fresh `/start` → `reg_start` (`ngMVQePrlkSmxLXMTnRo4`,
  событие найдено, карточка+сессия+вопрос о ПД доставлены); callback
  `reg:pdn:yes` при активной сессии `await_pdn` → `reg_pdn`
  (`3NJLHxB7dlyerTH247eyz`, сессия продвинута до `await_marketing` —
  подтверждено чтением таблицы); `reg:mkt:yes` → `reg_mkt`
  (`05PkuQZBaVnNYllI80VF3`, `await_phone`); контакт → `reg_phone`
  (`hUfyXSls06ZQkDn8BPGq1`). **IDM-4**: тот же `update_id` повторно →
  `stored:false, reason:duplicate`, до `users` не дошёл
  (`h59E2gDMOTjHXEtEEFdZM`). **Гейты**: групповой чат → `non_private_chat`
  (`LWqkk9yosJcD6o2UMqbqw`); отправитель-бот → `from_bot`
  (`lCQDAfncbjrTSwQklumMF`).
- **Маршруты визарда (W11, слит в W26) проверены тем же способом — все шесть**:
  `/newevent` → `wiz_start` (`QHnZ4y2RbuE2QcK6M37e6`); `/editevent <id>` →
  `wiz_edit_start`, включая перебивание стуковавшей сессии `event_create`
  (`m8eygtY7u3NkPlxc8AidP`); текст при `sessions.step='title'` → `wiz_field`
  (`Lop1K9edGNX6ByDgQJA75`); фото-сообщение при `step='photo'` → `wiz_photo`
  (`OeYdh1MyrrOii97K96XSC`); гео-сообщение при `step='geo'` → `wiz_geo`
  (`DxSoEcujIrNUfdUQQSQc8`); `callback_query` `wiz:cancel` при `step='preview'`
  → `wiz_publish` (`txh7HK0Zo0mXlPRQD0D9j`).
