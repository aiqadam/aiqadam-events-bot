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
2. Голый `/start` (payload пустой или неразобранный, `kind` пуст) → `menu`;
   `badPayload=true` доезжает до меню и меняет преамбулу.
3. `/start` с валидным, но не `e` payload (`kind='c'`/`'s'`) → `Otherwise`
   молча: чекин — только сканером (Q41).
4. **Любая другая команда** (`/menu`, `/help`, `/events`, `/myregs`,
   `/newevent`, `/editevent`, `/manage`, любое неизвестное) не исполняется
   и отвечает `menu` ([ADR-0025](../../docs/adr/0025-start-only-commands-ban.md)).
   Команд, кроме `/start`, у бота нет; правило держит
   `tools/check-commands.py` (хук + CI).
5. Колбэки `myreg:*` сняты (W43, Q57): «Мои билеты» — экран
   `#/events?tab=mine`, отмена — на экране билета; старые кнопки уходят
   в `Otherwise` молча.
6. Рассылки (W14): колбэк `bcast:unsub:*` → `bcast-unsub` (без staff-гейта,
   получатель — гость); любой другой `bcast:*` → `bcast-step`;
   пересланное сообщение без команды и с непустым текстом/подписью →
   `bcast-draft` (staff-гейт внутри, не-staff уходит в тишину).
7. Сессии `scenario` = `event_create`/`event_edit` (остатки чатового
     визарда в `sessions`) обработчика не имеют: их сообщения уходят в
   `Otherwise` молча.
8. Иначе, если есть активная сессия (`sessions`, не протухшая `>24ч`,
   `scenario/step` не `-`) со `scenario='registration'`:
    - колбэк с префиксом `reg:pdn:` → `reg_pdn`; `reg:mkt:` → `reg_mkt`;
      любой другой `reg:*` → **ничего** (не угадываем обработчик);
    - колбэк с префиксом `ob:` → `reg_profile` (онбординг C, W50);
    - текст без колбэка на шаге `ob_await_*` → `reg_profile` (свободный ввод
      имени/работы/города); чужие тексты — в `Otherwise` молча.
    Сообщений без колбэка в рамках `registration` вне онбординга нет.
9. Иначе — `Otherwise`, лог «намерение без обработчика» (checkin-deeplink/staff-accept — W9/W10, вне области W26).

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | приём апдейтов (`message`, `callback_query`) |
| step_1 | CODE «normalize update» | разбор `message`/`callback_query`/`contact`, команда+payload, `dedupKey`, `messageId` входящего сообщения; пересылка: `forwarded` + `fwdText` (`text‖caption`) |
| step_2 | `@aiqadam/qadam-store : put_if_absent` | атомарный захват `upd:<update_id>` (IDM-4); окно дедупликации — сутки |
| step_3 | CODE «gate» | `proceed`/`reason` (`bad_update`/`duplicate`/`from_bot`/`non_private_chat`) |
| step_4 | ROUTER: `proceed` / `Otherwise` (лог) | |
| step_6 | `tables-upsert-records users` | апсерт по `telegram_id`, снимает `blocked_bot` |
| step_7→8 | `tables-find-records sessions` → CODE «pick session» | freshest, не `-`, не старше 24ч |
| step_9 | `callFlow fn-parse-start` (`inline`, `waitForResponse: true`) | разбор `/start`-payload |
| step_10 | CODE «routing decision» | вычисляет `route` по команде/`callbackData`/сессии: `/start` — три исхода (deep link / меню / молчание), любая другая команда — `menu` (ADR-0025); колбэки регистрации — **по префиксу `reg:pdn:` / `reg:mkt:`**, онбординга — **`ob:`**, свободный ввод — по шагу `ob_await_*` в сессии; колбэки рассылок — по префиксу `bcast:` (`bcast:unsub:` отдельно), пересылка без команды — `bcast_draft`. Проверки рассылок стоят **до** командной цепочки, чтобы не сравнивать `route` ни с чем, кроме `'start'` (`check-commands.py`) |
| step_11 | ROUTER по `route`: `reg_start`/`reg_pdn`/`reg_mkt`/`reg_profile`/`menu`/`bcast_draft`/`bcast_step`/`bcast_unsub`/`Otherwise` | |
| step_12→14 | `callFlow reg-start`/`reg-consent-pdn`/`reg-consent-mkt` (`queue`, `waitForResponse: false`) | делегирование обработчику регистрации; все три получают `sessionDraft`; `reg-start` — плюс `firstName`/`lastName` для эвристики (W50) |
| step_20 | `callFlow reg-profile` (`queue`, `waitForResponse: false`) | онбординг C: `callbackData`/`messageText`/`messageId`/`sessionDraft`/`callbackQueryId` + имена (W50) |
| step_15 | `callFlow menu` (`queue`, `waitForResponse: false`) | меню-хаб: голый `/start` и любая незнакомая команда (ADR-0025); получает `chatId`, `firstName`, `badPayload`, `telegramId` |
| step_17→19 | `callFlow bcast-draft`/`bcast-step`/`bcast-unsub` (`queue`, `waitForResponse: false`) | делегирование рассылкам (W14); payload — обёртка `{"payload": {...}}` |
| step_16 | CODE «намерение без обработчика» | лог (`Otherwise` от `step_11`) |
| step_5 | CODE «апдейт пропущен — почему» | лог (`Otherwise` от `step_4`, гейт) |

## Зависимости

- **Таблицы**: `users` (`xHhYjhwqKdONkrYJGcBsz`), `sessions` (`toTKgngMTqDNJWDpQMh4d`, чтение)
- **Флоу**: `fn-parse-start`, `reg-start`, `reg-consent-pdn`, `reg-consent-mkt`,
  `menu`, `bcast-draft`, `bcast-step`, `bcast-unsub` — делегирование, не
  subflow-функции (ADR-0015 п. 4)
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
- **Все вызовы касаний (`callFlow` из веток `step_11`) — `executionMode: queue`,
  не `inline`.** `inline` синхронен независимо от `waitForResponse` — родитель
  ждёт всю длительность вызванного флоу, включая отправку сообщений Bot API
  (~0,7–0,9 с каждое). `queue` — единственный режим, дающий настоящий
  fire-and-forget. Правило: `queue` для «передал и не жду ответа» (как здесь),
  `inline` только когда родителю нужен ответ (`fn-parse-start` на `step_9` —
  inline, результат обязателен для маршрутизации).
- **Апсерт `users` (`step_6`) не пропускает запись при отсутствии изменений** —
  упрощение ради читаемости флоу (ADR-0015); латентность записи в таблицу не
  в приоритете (дорогая статья — отправка сообщений, не запись в таблицу).
- **`sessionDraft` уходит всем трём касаниям регистрации, а не только
  `reg-consent-pdn`.** В нём живёт `cardMessageId` — без него касание не знает,
  какое сообщение редактировать, и каждый шаг диалога начинал бы новую карточку
  ([ADR-0017](../../docs/adr/0017-screen-not-message.md)).
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
  прямое нарушение PAR-2.
- **Единственные команды — `/start` и `/start <payload>` из диплинка.**
  По решению владельца ([ADR-0025](../../docs/adr/0025-start-only-commands-ban.md))
  других команд у бота нет: незнакомая команда не исполняется, а отвечает
  карточкой меню. Правило держит `tools/check-commands.py` (хук + CI):
  он валит коммит при любой команде, кроме `start`, — в тексте, в коде
   или в сравнении с командной переменной. Остатки callback-кнопок
   (`reg:*`) — не команды и остаются; кнопки списков ушли вместе
   с их флоу (`ev:list:*` — W38, `myreg:*` — W43).
- **Вход в создание события — кнопка «Новое событие» в карточке меню**
  (`web_app` на `#/manage`), не команда. Правка существующего события
  появится списком в `#/manage` (W37); до W37 её нет — цена ADR-0025.
