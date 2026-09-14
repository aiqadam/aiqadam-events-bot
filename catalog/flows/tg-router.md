# Flow: tg-router

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-telegram-bot / new_telegram_message` (`update_types: message, callback_query`),
  connection `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Назначение**: единственная точка входа бота — дедуп по `update_id` (IDM-4),
  апсерт `users`, классификация апдейта, делегирование одному из касаний
  регистрации (ADR-0015), спискам/отмене или входу на страницу `manage`.
- **Flow ID (MCP)**: `nyaBzgKGG8TTTsryjc9tW` · **externalId**: — (не subflow)

## Контракт

Роутер сам ничего не отвечает пользователю. Правило маршрутизации (`step_10`):

1. `/start e<id>-<utm>` (валидный `fn-parse-start`, `kind='e'`) → `reg-start`,
   **независимо от активной сессии** — новый вход по deep link перекрывает
   недоведённый диалог.
2. `/newevent`, `/editevent <id>`, `/manage [<id>]` → `manage_open` —
   кнопка на страницу `manage` (форма ивента в Mini App, ADR-0017 п. 3),
   **независимо от активной сессии**, тем же принципом, что и `/start`.
   `commandArgs` уходит в `manage-open` как есть: пусто — новый ивент,
   иначе — id для правки.
2a. `/events` → `events-list`; `/myregs` → `my-regs` (W06) — команды
   перекрывают активную сессию, как в пп. 1–2.
2b. Колбэки `ev:list:upcoming` / `ev:list:past` → `events-list`;
   `myreg:cancel:*` / `myreg:yes:*` / `myreg:no` → `my-reg-cancel` (W06) —
   по префиксу `callbackData`, до проверок сессий.
3. Сессии `scenario` = `event_create`/`event_edit` (остатки чатового
   визарда в `sessions`) обработчика не имеют: их сообщения уходят в
   `Otherwise` молча.
4. Иначе, если есть активная сессия (`sessions`, не протухшая `>24ч`,
   `scenario/step` не `-`) со `scenario='registration'`:
   - колбэк с префиксом `reg:pdn:` → `reg_pdn`; `reg:mkt:` → `reg_mkt`;
     любой другой `reg:*` → **ничего** (не угадываем обработчик);
   - сообщение без колбэка при `step='await_phone'` → `reg_phone`
     (телефон — единственное касание регистрации, отвечающее сообщением).
5. Иначе — `Otherwise`, лог «намерение без обработчика» (checkin-deeplink/staff-accept — W9/W10, вне области W26).

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | приём апдейтов (`message`, `callback_query`) |
| step_1 | CODE «normalize update» | разбор `message`/`callback_query`/`contact`, команда+payload, `dedupKey`, `messageId` входящего сообщения |
| step_2 | `@aiqadam/qadam-store : put_if_absent` | атомарный захват `upd:<update_id>` (IDM-4); окно дедупликации — сутки |
| step_3 | CODE «gate» | `proceed`/`reason` (`bad_update`/`duplicate`/`from_bot`/`non_private_chat`) |
| step_4 | ROUTER: `proceed` / `Otherwise` (лог) | |
| step_6 | `tables-upsert-records users` | апсерт по `telegram_id`, снимает `blocked_bot` |
| step_7→8 | `tables-find-records sessions` → CODE «pick session» | freshest, не `-`, не старше 24ч |
| step_9 | `callFlow fn-parse-start` (`inline`, `waitForResponse: true`) | разбор `/start`-payload |
| step_10 | CODE «routing decision» | вычисляет `route`; колбэки регистрации — **по префиксу `reg:pdn:` / `reg:mkt:`**, а не по `sessions.step` |
| step_11 | ROUTER по `route`: `reg_start`/`reg_pdn`/`reg_mkt`/`reg_phone`/`events_list`/`my_regs`/`my_reg_cancel`/`manage_open`/`Otherwise` | |
| step_12→15 | `callFlow reg-start`/`reg-consent-pdn`/`reg-consent-mkt`/`reg-phone` (`queue`, `waitForResponse: false`) | делегирование обработчику регистрации; все четыре получают `sessionDraft`, `reg-phone` дополнительно `userMessageId` |
| step_23→25 | `callFlow events-list`/`my-regs`/`my-reg-cancel` (`queue`, `waitForResponse: false`) | делегирование спискам и отмене (W06) |
| step_26 | `callFlow manage-open` (`queue`, `waitForResponse: false`) | кнопка на страницу `manage` по `/newevent`, `/editevent`, `/manage`; получает `chatId`, `telegramId`, `commandArgs` |
| step_16 | CODE «намерение без обработчика» | лог (`Otherwise` от `step_11`) |
| step_5 | CODE «апдейт пропущен — почему» | лог (`Otherwise` от `step_4`, гейт) |

## Зависимости

- **Таблицы**: `users` (`xHhYjhwqKdONkrYJGcBsz`), `sessions` (`toTKgngMTqDNJWDpQMh4d`, чтение)
- **Флоу**: `fn-parse-start`, `reg-start`, `reg-consent-pdn`, `reg-consent-mkt`, `reg-phone`,
  `events-list`, `my-regs`, `my-reg-cancel`, `manage-open` — делегирование, не subflow-функции (ADR-0015 п. 4)
- **Переменные**: —
- **Store**: `upd:<update_id>`, `COLLECTION`, `ttl_seconds: 86400`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`flowProps` у каждого `callFlow` — обёртка `{"payload": {<поля callee>}}`**,
  не плоские именованные поля (см. CLAUDE.md, Gotchas Qadam Flow, п. 7a).
  Без обёртки вызов проходит `ap_validate_flow` и прогон формально успешен,
  но callee получает пустые поля — тихий отказ, не ошибка вызова. Callee
  читает поля плоско: `{{trigger['output'].data.<field>}}`.
- **Гейт `step_3` отбивает четыре причины одним полем `reason`**: `bad_update`,
  `duplicate`, `from_bot`, `non_private_chat` — порядок именно такой (от
  «апдейт нечитаем» к «пользователь не тот»).
- **Все вызовы касаний (`step_12→15`, `step_23→26`) — `executionMode: queue`,
  не `inline`.** `inline` синхронен независимо от `waitForResponse` — родитель
  ждёт всю длительность вызванного флоу, включая отправку сообщений Bot API
  (~0,7–0,9 с каждое). `queue` — единственный режим, дающий настоящий
  fire-and-forget. Правило: `queue` для «передал и не жду ответа» (как здесь),
  `inline` только когда родителю нужен ответ (`fn-parse-start` на `step_9` —
  inline, результат обязателен для маршрутизации).
- **Апсерт `users` (`step_6`) не пропускает запись при отсутствии изменений** —
  упрощение ради читаемости флоу (ADR-0015); латентность записи в таблицу не
  в приоритете (дорогая статья — отправка сообщений, не запись в таблицу).
- **`sessionDraft` уходит всем четырём касаниям регистрации, а не только
  `reg-consent-pdn`.** В нём живёт `cardMessageId` — без него касание не знает,
  какое сообщение редактировать, и каждый шаг диалога начинал бы новую карточку
  ([ADR-0017](../../docs/adr/0017-screen-not-message.md)).
- **`userMessageId` нужен только `reg-phone`** — чтобы убрать из ленты ответ
  гостя на транзиентный вопрос о телефоне.
- **`exampleData` в пропе `flow` у `callFlow` должен совпадать с тем, что
  отдаёт `ap_resolve_property_options`.** Добавили поле в схему триггера
  callee — обновите и `exampleData` у вызова, иначе форма вызова и форма
  приёма разъезжаются (CLAUDE.md, Gotchas, п. 7).
- **Колбэки регистрации маршрутизируются по префиксу, а не по `sessions.step`.**
  Гость может держать в ленте несколько живых карточек (два входа по deep
  link), и кнопка старой карточки обязана попасть в свой обработчик.
  Маршрутизация по шагу давала чужому колбэку побочный эффект: `reg:pdn:yes`
  при `await_marketing` уходил в `reg-consent-mkt` и записывал
  `consent_marketing`, которого гость не видел и на который не отвечал —
  прямое нарушение PAR-2. Зеркальные случаи того же класса: `reg:mkt:*`
  при `await_phone` завершал диалог и выдавал билет без вопроса о телефоне.
