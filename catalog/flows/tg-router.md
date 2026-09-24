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
3. `/start s<eventId>-<token>` (валидный, `kind='s'`) → `staff-accept` (W10,
   OWN-14): приём инвайта контролёра. `/start c…` (`kind='c'`) → `Otherwise`
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
   `bcast-draft` (staff-гейт внутри, не-staff уходит в тишину). С W79 (#131)
   туда же уходит **фото без подписи** (анонс спикера часто без текста);
   альбомный апдейт без подписи (`mediaGroupId`) не берётся — Part 2.
6a. Колбэк меню (W68, #120; ack — W99): префикс `menu:` (кнопка «Как сделать
    рассылку», `menu:bcast_help`) → `menu_cb` — ветка подтверждает колбэк
    (`answer_callback_query`) и только затем вызывает `menu`. Не команда,
    ADR-0025 не затронут.
6b. Колбэк викторины (W103, [ADR-0041](../../docs/adr/0041-quiz-in-chat-not-a-page.md)):
    префикс `qz:` (кнопка «Викторина», `qz:start`) → `quiz` (вход).
    Префикс колбэка, не команда — ADR-0025 не затронут. Свободный текст при
    активной сессии `scenario=quiz`, шаг `q_await_*` → `quiz_answer`
    (`quiz-answer`); проверка стоит **до** меню-фолбэка W73, иначе ответ ушёл бы
    в меню.
7. Сессии `scenario` = `event_create`/`event_edit` (остатки чатового
   визарда в `sessions`) обработчика не имеют: их колбэки и нетекстовые
   апдейты уходят в `Otherwise` молча. Обычный текст отвечает меню по п. 8 —
   мёртвая сессия текстовому ответу не мешает.
8. **Обычный текст без команды, без колбэка и без пересылки** (W73, #125):
   `command === '' && callbackData === '' && !forwarded && text.trim() !== ''`
   и это не свободный ввод на шаге `ob_await_*` → `menu` с
   `fallback=true`. Гость получает короткую меню-карточку с преамбулой
   `menu.fallback_text` (не «напишите нам» — тексты, обещавшие обратное,
   переписаны). Фото и стикеры без текста, старые колбэки `myreg:*`/`reg:*`,
   `/start c…` и чужие тексты вне формы сюда не попадают — остаются молча.
9. Иначе, если есть активная сессия (`sessions`, не протухшая `>24ч`,
   `scenario/step` не `-`) со `scenario='registration'`:
    - колбэк с префиксом `reg:pdn:` → `reg_pdn`; `reg:mkt:` → `reg_mkt`;
      любой другой `reg:*` → **ничего** (не угадываем обработчик);
    - колбэк с префиксом `ob:` → `reg_profile` (онбординг C, W50);
    - текст без колбэка на шаге `ob_await_*` → `reg_profile` (свободный ввод
      имени/работы/города) — эта ветка срабатывает раньше п. 8 и потому
      перекрывает его; чужие тексты — в `Otherwise` молча.
10. Иначе — `Otherwise`, лог «намерение без обработчика» (checkin-deeplink — W9 не будет, Q41; `staff-accept` с W10 обрабатывается выше).

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | приём апдейтов (`message`, `callback_query`) |
| step_1 | CODE «normalize update» | разбор `message`/`callback_query`/`contact`, команда+payload, `dedupKey`, `messageId` входящего сообщения; пересылка: `forwarded` + `fwdText` (`text‖caption`); `hasPhoto`/`photoFileId`; `mediaGroupId` (альбом, W79) |
| step_2 | `@aiqadam/qadam-store : put_if_absent` | атомарный захват `upd:<update_id>` (IDM-4); окно дедупликации — сутки |
| step_3 | CODE «gate» | `proceed`/`reason` (`bad_update`/`duplicate`/`from_bot`/`non_private_chat`) |
| step_4 | ROUTER: `proceed` / `Otherwise` (лог) | |
| step_6 | `tables-upsert-records users` | апсерт по `telegram_id`, снимает `blocked_bot` |
| step_7→8 | `tables-find-records sessions` → CODE «pick session» | freshest, не `-`, не старше 24ч |
| step_9 | `callFlow fn-parse-start` (`inline`, `waitForResponse: true`) | разбор `/start`-payload |
| step_10 | CODE «routing decision» | вычисляет `route` по команде/`callbackData`/сессии: `/start` — четыре исхода (deep link / **продолжение онбординга по событию** / меню / молчание), любая другая команда — `menu` (ADR-0025); **голый `/start` при активной сессии `registration` с шагом `ob_*` и непустым `eventId` уходит в `reg_start`, а не в `menu`** — иначе меню перетирает сессию черновиком без `eventId` и онбординг по диплинку теряет событие (ADR-0034 п.4); колбэки регистрации — **по префиксу `reg:pdn:` / `reg:mkt:`**, онбординга — **`ob:`**, свободный ввод — по шагу `ob_await_*` в сессии; колбэки рассылок — по префиксу `bcast:` (`bcast:unsub:` отдельно), пересылка без команды — `bcast_draft` (**W79, #131:** и фото без подписи — `hasPhoto`, если апдейт не альбомный, `mediaGroupId === ''`); **колбэки меню — по префиксу `menu:`** (W68, #120; W99: маршрут `menu_cb`, ack до входа в меню). Проверки рассылок и меню стоят **до** командной цепочки, чтобы не сравнивать `route` ни с чем, кроме `'start'` (`check-commands.py`); **обычный текст вне формы → `menu` с `fallback=true`** (W73, #125), свободный ввод `ob_await_*` перекрывает его (п. 9 контракта) |
| step_11 | ROUTER по `route`: `reg_start`/`reg_pdn`/`reg_mkt`/`reg_profile`/`menu`/`menu_cb`/`bcast_draft`/`bcast_step`/`bcast_unsub`/`quiz`/`quiz_answer`/`Otherwise` | |
| step_12→14 | `callFlow reg-start`/`reg-consent-pdn`/`reg-consent-mkt` (`inline`, `waitForResponse: false`) | делегирование обработчику регистрации; все три получают `sessionDraft`; `reg-start` — плюс `firstName`/`lastName` для эвристики (W50) |
| step_20 | `callFlow reg-profile` (`inline`, `waitForResponse: false`) | онбординг C: `callbackData`/`messageText`/`messageId`/`sessionDraft`/`callbackQueryId` + имена (W50) |
| step_21 | `callFlow staff-accept` (`inline`, `waitForResponse: false`) | приём инвайта контролёра (W10): `token`/`eventId` из разбора `s`-payload + `chatId`/`telegramId` |
| step_15 | `callFlow menu` (`inline`, `waitForResponse: false`) | меню-хаб: голый `/start`, любая незнакомая команда (ADR-0025), обычный текст (W73, #125); получает `chatId`, `firstName`, `badPayload`, `fallback`, `telegramId`, `callbackData`, `callbackQueryId` |
| step_22→23 | `answer_callback_query` (`continueOnFailure`) → `callFlow menu` (`inline`, `waitForResponse: false`) | ветка `menu_cb`: ack колбэка `menu:*` (W99) и то же меню-хаб, но по колбэку организатора (W68, #120) |
| step_26 | `answer_callback_query` (`continueOnFailure`) | ветка `quiz`: ack колбэка `qz:start` **до** вызова `quiz` (W103; тот же приём, что W99 у `menu_cb`) — иначе Telegram держит «часики» на кнопке |
| step_24 | `callFlow quiz` (`inline`, `waitForResponse: false`) | ветка `quiz`: вход викторины, `qz:start` (W103, ADR-0041) |
| step_25 | `callFlow quiz-answer` (`inline`, `waitForResponse: false`) | ветка `quiz_answer`: приём свободного ответа викторины (W103, ADR-0041) |
| step_17→19 | `callFlow bcast-draft`/`bcast-step`/`bcast-unsub` (`queue`, `waitForResponse: false`) | делегирование рассылкам (W14); payload — обёртка `{"payload": {...}}` |
| step_16 | CODE «намерение без обработчика» | лог (`Otherwise` от `step_11`) |
| step_5 | CODE «апдейт пропущен — почему» | лог (`Otherwise` от `step_4`, гейт) |

## Зависимости

- **Таблицы**: `users` (`xHhYjhwqKdONkrYJGcBsz`), `sessions` (`toTKgngMTqDNJWDpQMh4d`, чтение)
- **Флоу**: `fn-parse-start`, `reg-start`, `reg-consent-pdn`, `reg-consent-mkt`,
  `menu`, `bcast-draft`, `bcast-step`, `bcast-unsub`, `staff-accept`,
  `quiz`, `quiz-answer` —
  делегирование, не subflow-функции (ADR-0015 п. 4)
- **Переменные**: —
- **Store**: `upd:<update_id>`, `COLLECTION`, `ttl_seconds: 86400`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`flowProps` у каждого `callFlow` — обёртка `{"payload": {<поля callee>}}`**,
  не плоские именованные поля (см. CLAUDE.md, Gotchas Qadam Flow, п. 7a).
  Без обёртки вызов проходит `ap_validate_flow` и прогон формально успешен,
  но callee получает пустые поля — тихий отказ, не ошибка вызова. Callee
  читает поля плоско: `{{trigger['output'].data.<field>}}`.
- **Голый `/start` во время онбординга по диплинку не теряет событие (W59).**
  `step_10` при активной сессии `registration` с шагом `ob_*` и непустым
  `eventId` из черновика маршрутизирует `/start` в `reg-start` с этим
  `eventId`/`utm` (ADR-0034 п.4). Без этого ветка `menu.needs_onboard`
  перезаписывала сессию черновиком `eventId: ''`, и финал становился
  `finish_no_event` — регистрация на событие не создавалась.   Условие `ob_*`
  намеренно не покрывает `await_marketing`: завершивший профиль и ждущий
  ответа о рассылке голым `/start` в регистрацию не возвращается.
- **Обычный текст — короткий ответ меню, а не тишина (W73, #125).** Тексты
  бота звали «напишите боту снова / напишите нам», а бот молчал. Теперь
  текст вне формы маршрутизируется в `menu` (`fallback=true`), и меню
  отвечает преамбулой `menu.fallback_text` теми же кнопками, что `/start`.
  Исключение ровно одно — свободный ввод на шаге `ob_await_*` (там текст
  это ответ на вопрос, а не запрос меню). Проверка стоит после пересылок и
  до сессионной ветки: мёртвые сессии `event_create`/`event_edit` ответу не
  мешают. Признак «это ответ формы» — шаг `ob_await_*` в `sessions`, а не
  сама активная сессия (ADR-0034).
- **Гейт `step_3` отбивает четыре причины одним полем `reason`**: `bad_update`,
  `duplicate`, `from_bot`, `non_private_chat` — порядок именно такой (от
  «апдейт нечитаем» к «пользователь не тот»).
- **Вызовы касаний (`callFlow` из веток `step_11`) — `executionMode: inline`,
  кроме `bcast-*` (`step_17`/`18`/`19` — `queue`).** `inline` синхронен
  независимо от `waitForResponse`: роутер ждёт весь вызванный флоу, включая
  отправку сообщений Bot API (~0,7–0,9 с каждое). Для `reg-*`, `menu` и
  `staff-accept` это принято (решение владельца, [ADR-0040](../../docs/adr/0040-inline-for-touch-callflow.md));
  `fn-parse-start` на `step_9` — `inline`, потому что ответ обязателен для
  маршрутизации.
- **`bcast-*` остаются `queue` не по стилю, а по запрету платформы.** Инлайн
  запрещён, если вызываемый флоу делает паузу (Delay, Human Input/Approval,
  собственный queue-`callFlow`). `bcast-step` содержит `callFlow bcast-run`, а
  `bcast-run` — `Delay` и самовызов `callFlow bcast-run` в `queue`; инлайн
  сломал бы рассылку чанками. У остальных получателей (`reg-*`, `menu`,
  `staff-accept`) пауз нет.
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
- **Колбэк `menu:*` ведёт в `menu` через ветку `menu_cb` (W68, #120; W99).**
  Кнопка «Как сделать рассылку» в меню организатора шлёт `menu:bcast_help`;
  `step_10` ловит префикс `menu:` до командной цепочки и ставит
  `route: menu_cb`, `step_11` идёт в ветку `menu_cb`: `step_22` подтверждает
  колбэк (`answer_callback_query`), затем `step_23` вызывает меню с
  `callbackData`/`callbackQueryId`. Меню отдаёт инструкцию `bcast.howto.*`.
  `step_22`/`step_23` — `inline`, как остальные касания (ADR-0040).
  Различающий прогон: колбэк `menu:bcast_help` → `step_10` `route: menu_cb`,
  `step_11` ветка `menu_cb`, ack и инструкция.
  Раньше ack жил первым шагом в самом `menu` и срабатывал на каждом входе —
  на `/start` и обычном тексте `callbackQueryId` пуст, и шаг делал холостой
  вызов Bot API с `400` (W99).
- **Анонс спикера — фото без подписи тоже черновик (W79, #131).** `step_10`
  заводит `bcast_draft` для пересланного сообщения, если есть текст/подпись
  **или** фото (`hasPhoto`) и это не альбомный апдейт (`mediaGroupId === ''`).
  Альбомы — Part 2: без этого guard'а овнер получил бы по вопросу на каждое
  фото альбома. Источник для `copyMessage` — `chatId` + `messageId` входящего
  сообщения; они уже уезжают в `bcast-draft` (payload `messageId`), менять
  `step_17` не потребовалось.
- **Викторина (W103, ADR-0041).** Два новых маршрута в `step_10`/`step_11`:
  колбэк `qz:*` → `quiz` (`step_24`) и свободный текст при сессии
  `scenario=quiz`/шаг `q_await_*` → `quiz_answer` (`step_25`). Обе ветки —
  `inline`, как прочие касания (ADR-0040); пауз внутри callee нет. Ветка текста
  стоит **до** меню-фолбэка W73 (иначе ответ уходил бы в меню), колбэк — рядом с
  `menu:`. Кнопка живёт в `menu` и видна только в окне викторины; команды не
  заведены — префиксы колбэка, ADR-0025 не затронут. Различающие прогоны:
  `qz:start` → `route: quiz`, ветка `quiz`, вызов `quiz`; текст в сессии
  викторины → `route: quiz_answer`, ветка `quiz_answer`, вызов `quiz-answer`;
  фото на том же шаге → `Otherwise` (ответом не считается). Ack колбэка
  `qz:start` — `step_26` в ветке `quiz`, до вызова `quiz` (тот же приём, что
  W99 у `menu_cb`).
