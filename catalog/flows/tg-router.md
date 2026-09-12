# Flow: tg-router

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-telegram-bot / new_telegram_message` (`update_types: message, callback_query`),
  connection `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Назначение**: единственная точка входа бота — дедуп по `update_id` (IDM-4),
  апсерт `users`, классификация апдейта, делегирование обработчику.
- **Flow ID (MCP)**: `Y1dNon2V2EhjWM0aYwdQi` · **externalId**: — (не subflow, `callFlow` его не вызывает)

## Контракт

Роутер сам ничего не отвечает пользователю ([FLOWS.md](../../docs/FLOWS.md#tg-router--единственный-вход-бота)).
На выходе (step_13, «классификация апдейта») — плоский объект:

| Поле | Смысл |
|------|-------|
| `kind` | `start_payload` \| `start` \| `command` \| `callback` \| `contact` \| `wizard_step` \| `text` |
| `command` | имя команды без `/`, `''` если апдейт не команда |
| `startPayload` | сырой payload после `/start ` (или `/start` без пробела), `''` если нет |
| `callbackData`, `callbackQueryId` | из `callback_query` |
| `contactPhone`, `contactIsOwn` | из `message.contact`; `contactIsOwn` — контакт принадлежит отправителю |
| `tgId`, `chatId`, `messageId`, `updateId`, `text` | нормализованные поля апдейта |
| `lang` | язык **из `users.lang`** (после апсерта), не из `language_code` напрямую |
| `userExisted` | была ли строка `users` **до** этого апдейта |
| `session.*` | активная (не протухшая, `< 24ч`) сессия визарда из `sessions`, если есть |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | приём апдейтов бота (единственный потребитель на токен). **Доставка — long-polling, не вебхук** (проверено 2026-09-12, см. заметку ниже) | `update_types = [message, callback_query]` |
| step_1 | CODE «normalize update» | достаёт `message`/`callback_query`/`contact`, парсит `/command payload`, язык из `language_code` | `{{trigger['output']}}` |
| step_2 | `@aiqadam/qadam-store : put_if_absent` | **атомарный захват** `upd:<update_id>` (IDM-4, [ADR-0011](../../docs/adr/0011-idempotency-on-atomic-primitives.md)) | `key = {{step_1['output'].dedupKey}}`, `value = {{step_1['output'].now}}`, scope `COLLECTION`, `ttl_seconds = 86400` |
| step_3 | CODE «gate: свежий апдейт?» | решает `proceed` по `ok`/`seen`/`isBot`/`isPrivate`; `seen` = `stored === false` | `{{step_2['output']}}`, `{{step_1['output']}}` |
| step_4 | ROUTER «обрабатываем только свежий апдейт» | ветка 0 = `proceed`, fallback = «Otherwise» | `{{step_3['output'].proceed}}` |
| step_5 (ветка Otherwise) | CODE «апдейт пропущен — почему» | след в логе: `duplicate` / `bad_update` / `from_bot` / `non_private_chat` | `{{step_3['output'].reason}}` |
| step_7 | `@aiqadam/qadam-tables : tables-find-records` | `users` по `telegram_id` | `table_id = z5PX9B8mTQC9Q6Dfuj5dM`, фильтр `eq` |
| step_8 | CODE «выбрать каноническую строку users» | детерминированный выбор при дублях (ADR-0003), решает язык (не перетирает выбор пользователя) | `{{step_7['output']}}` |
| step_9 | ROUTER «users: обновить или завести» | ветка 0 = `exists`, ветка 1 = иначе | `{{step_8['output'].exists}}` |
| step_10 (ветка 0) | `@aiqadam/qadam-tables : tables-update-record` | обновляет имя/username/lang, **снимает `blocked_bot`** | `record_id = {{step_8['output'].recordId}}` |
| step_11 (ветка 1) | `@aiqadam/qadam-tables : tables-create-records` | заводит строку `users` | `values.values[0]` |
| step_12 | `@aiqadam/qadam-tables : tables-find-records` | активная сессия визарда | `table_id = tL4fbi1GisDwA8UJ9zSod`, фильтр `telegram_id eq` |
| step_13 | CODE «классификация апдейта» | вычисляет `kind` и собирает выходной контракт | `{{step_1['output']}}`, `{{step_8['output']}}`, `{{step_12['output']}}` |
| step_14 | ROUTER «делегирование обработчику» | ветка 0 = `start_payload`, ветка 1 = продолжение `registration`, fallback = ещё не подключено | `{{step_13['output'].kind}}`, `{{step_13['output'].session.scenario}}` |
| step_15 (ветка 0) | `callFlow → fn-parse-start` (`executionMode: inline`) | разбор `start`-payload на `kind`/`eventId`/`utm`/… | `start = {{step_13['output'].startPayload}}` |
| step_17 (ветка 0) | ROUTER «по kind разобранной ссылки» | ветка 0 = `kind = 'e'` → `registration`, fallback = `c`/`s`/пусто (W10/W11, ещё не подключены) | `{{step_15['output'].data.kind}}` |
| step_18 (ветка 0 → 0) | `callFlow → registration` (`action: start`, **`executionMode: inline`** с 12.09.2026) | делегирование в W5, `waitForResponse: false` | `eventId`/`utm` из `{{step_15['output'].data}}`, `telegramId/chatId/lang` из `{{step_13['output']}}` |
| step_19 (ветка 0 → fallback) | CODE «start-payload разобран, обработчика для kind ещё нет» | след в логе для `c`/`s`/невалидных payload'ов | `{{step_15['output'].data.kind}}`, `.valid` |
| step_20 (ветка 1) | `callFlow → registration` (`action: continue`, **`executionMode: inline`** с 12.09.2026) | продолжение визарда — вызывается, когда `session.scenario = 'registration'`, `waitForResponse: false` | `kind`/`callbackData`/`contactPhone`/… + `sessionStep`/`sessionDraft`/`sessionRecordId` из `{{step_13['output'].session}}` |
| step_16 (fallback) | CODE «намерение без обработчика» | след в логе: апдейт классифицирован, но не обработан (`checkin-deeplink`/`staff-accept` — W10/W11) | `{{step_13['output']}}` |

## Зависимости

- **Таблицы**: `users` (`z5PX9B8mTQC9Q6Dfuj5dM`), `sessions` (`tL4fbi1GisDwA8UJ9zSod`, только чтение)
- **Subflow'ы**: `fn-parse-start` (`9H027DdckYSgu7Yp1LQRS`), `registration` (`RId6eBcN8T4oo8pkkWB7b`, W5)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Store**: ключи `upd:<update_id>`, scope `COLLECTION`, **TTL 24 ч** — фоновая уборка (`dedup-sweep`, W12b) больше не нужна ([ADR-0011](../../docs/adr/0011-idempotency-on-atomic-primitives.md))

## Заметки

- **Оба вызова `registration` — `inline`** (с 12.09.2026, решение владельца,
  W20). W17 держал их на `queue`, считая, что inline заставит роутер ждать
  цепочку регистрации. Ждать действительно заставил: прогон роутера вырос с
  3,8 с до 12–15 с. Но сквозное время не изменилось (≈16 с в обоих режимах,
  разброс замеров шире разницы), а ~2 с диспетчеризации исчезли, то есть
  первое сообщение пользователю приходит раньше.
  **Цена:** прогон роутера занимает воркер дольше, и падение `registration`
  теперь роняет прогон роутера. Под нагрузкой не проверено — перепроверить
  до W15.

- **`step_18` пересобран заново** (2026-09-12, W19) и опубликован. Правка одного
  `displayName` вызвала перевалидацию против новой версии
  `@aiqadam/qadam-subflows` и обнажила отсутствие ставшего обязательным пропа
  `executionMode` (его добавил [#363](https://github.com/aiqadam/qadam-flow/issues/363)
  уже после того, как W5 написал этот вход). Восстановлено по контракту
  `registration/step_1`, `executionMode = queue` — как решил W17.
  **Грабли, на которые тут наступили:** значение пропа `flow` — объект
  `{externalId, exampleData}`, а не строка; со строкой шаг валиден, но прогон
  падает `{"message":"Please select a flow"}`. Проверено сквозным прогоном
  `vqvFIl5nt4j4nXhtloWpT` и реальной отправкой в Telegram (прогон `registration`
  `e4eh8kMqSRike8mSMwgQc`).
  `step_20` — в том же состоянии по `executionMode`, но ещё не тронут и
  числится валидным: первая же его правка всплывёт так же.
- **Шаги `tables` и `store` этого флоу не редактируются через MCP напрямую** —
  `qadam_metadata_not_found` ([#411](https://github.com/aiqadam/qadam-flow/issues/411)):
  они пришпилены к версии qadam'а, которой после обновления образа нет. Флоу
  при этом валиден и работает; отказ только на запись. Лечится пересозданием
  шага — новый получает то же имя, ссылки вниз по флоу не ломаются (так сделан
  `step_7`). Перепривязать версию правкой не удаётся даже явным `qadamName`.
- **`step_7` отдаёт только пять колонок `users`** (`created_at`, `lang`,
  `consent_pdn`, `consent_marketing`, `phone`) — ровно то, что потребляет
  `step_8` ([Q17](../../docs/OPEN-QUESTIONS.md#q17)). Имена, `username`,
  `telegram_id`, `blocked_bot` и обе consent-даты в лог прогона больше не
  попадают. Проверено сквозным прогоном `BywBIqJvv6bjW06R6qYBC`.
  **`step_10` при этом по-прежнему логирует строку целиком** — у
  `tables-update-record` проекции колонок нет.
- **Апдейты приходят long-polling'ом, а не вебхуком** — проверено на живом
  инстансе 2026-09-12 (W19, [Q26](../../docs/OPEN-QUESTIONS.md#q26)):
  `POST /api/v1/webhooks/Y1dNon2V2EhjWM0aYwdQi` отвечает `409 «This flow receives
  events by polling»`, а `getWebhookInfo` у dev-бота отдаёт `url: ""`. Это следствие
  обновления образа платформы ([qadam-flow#393](https://github.com/aiqadam/qadam-flow/pull/393)),
  а не наша настройка: у триггера нет пропа, которым это переключается.
  Практические следствия: публичного ingress у бота нет (аутентифицировать
  вебхук нечем и незачем), а интервал опроса добавляет неизмеренную задержку
  на пути «пользователь написал → бот ответил».
- **Дедуп IDM-4 — атомарный захват, а не «прочитать и записать»** (W20,
  [ADR-0011](../../docs/adr/0011-idempotency-on-atomic-primitives.md)).
  Было три шага: `store get` → CODE-гейт → `store put` в ветке 0, и между
  чтением и записью существовало окно. Стало два: `put_if_absent` сам сообщает,
  этот ли прогон занял ключ (`stored: true`) или ключ уже был
  (`stored: false` + `value` = когда заняли впервые). Захват по-прежнему идёт
  **до** любых побочных эффектов — теперь даже раньше, чем проверки
  `isBot`/`isPrivate`, что только усиливает правило.
  Различающий тест: прогоны `s5GJKUXZ13SZeYboS2Bf8` (свежий `update_id` →
  `proceed`) и `GJ6yy0oS0rWOvWjmvnfAi` (тот же `update_id` → `duplicate`,
  `firstSeenAt` = время первого, ноль побочных эффектов, 0,8 с против 2,6 с).
  **TTL 24 ч** выбран под ретенцию самого Telegram: апдейты старше суток он
  не переспрашивает, значит ключ дольше держать незачем.
  Правило ADR-0003 «обработчики пишутся так, чтобы повтор был безвреден»
  остаётся основным — примитив его усиливает, а не заменяет.
- **Гейт step_3 отбивает четыре причины одним полем `reason`**: `bad_update`
  (нет `update_id` или `from.id`), `duplicate`, `from_bot`, `non_private_chat`.
  Порядок проверки: испорченный апдейт раньше дубля, дубль раньше бота/группы —
  так `reason` всегда объясняет самую раннюю причину, а не последнюю.
- **Роутер не различает группы от каналов и супергрупп** — фильтр `isPrivate` рубит
  любой `chat.type !== 'private'`. Ни один флоу W4…W15 не работает с групповыми
  чатами по SPEC.md, поэтому это осознанное сужение, а не недосмотр.
- **Выбор языка не перетирает выбор пользователя** (I18N.md, «Выбор языка»):
  `users.lang` меняется на `language_code` из Telegram только если в строке ещё
  нет валидного `ru`/`uz`/`en` (`langWasSet: false`). Если пользователь однажды
  сменил язык командой (будущий пакет), `tg-router` его не откатит.
- **Активная сессия — самая свежая по `updated_at`, не протухшая (`< 24ч`)**,
  остальные строки на `(telegram_id)` — дубли или хвосты; `session.duplicates`
  наружу отдаётся для `dedup-sweep`, отдельного чтения не блокирует.
- **`fn-parse-start` и `registration` подключены пакетом W5** (2026-09-09). Блокер
  Q20 («`flowProps` не записать через MCP»), из-за которого W4 оставил `tg-router`
  с одной fallback-веткой, оказался не платформенным: причина — форма `input.flow`
  при резолве `ap_get_piece_props` (нужен объект с `exampleData`, а не строка) —
  подробно в [ARCHITECTURE](../../docs/ARCHITECTURE.md#subflowы-на-практике--проверено-на-инстансе-2026-09-08-w2),
  блок «Опровергнуто», и в [OPEN-QUESTIONS Q20](../../docs/OPEN-QUESTIONS.md#q20).
- **`checkin-deeplink` и `staff-accept` (W10/W11) всё ещё не подключены** — payload'ы
  `kind = c`/`s` разбираются `fn-parse-start`, но проваливаются в fallback-ветку
  `step_19` без действия. Следующий пакет добавляет ветку на `step_17` тем же
  приёмом, что и `registration` здесь, не трогая остальной `tg-router`.
- **`waitForResponse: false` на обоих вызовах `registration`** (`step_18`, `step_20`) —
  сознательно: `registration` — тяжёлая цепочка вложенных `callFlow` (~15–30 с,
  как и `fn-event-card` в одиночку), и `tg-router`, синхронно ожидающий вебхук
  бота, не обязан ждать её завершения. Цена — `tg-router` не узнает, упал ли
  `registration` (только из его собственных логов прогонов).
