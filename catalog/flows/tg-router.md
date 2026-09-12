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
| step_2 | `@aiqadam/qadam-store : get` | читает `upd:<update_id>` | `key = {{step_1['output'].dedupKey}}`, `defaultValue = __absent__`, scope `COLLECTION` |
| step_3 | CODE «gate: свежий апдейт?» | решает `proceed` по `ok`/`seen`/`isBot`/`isPrivate` | `{{step_2['output']}}`, `{{step_1['output']}}` |
| step_4 | ROUTER «обрабатываем только свежий апдейт» | ветка 0 = `proceed`, fallback = «Otherwise» | `{{step_3['output'].proceed}}` |
| step_5 (ветка Otherwise) | CODE «апдейт пропущен — почему» | след в логе: `duplicate` / `bad_update` / `from_bot` / `non_private_chat` | `{{step_3['output'].reason}}` |
| step_6 (ветка 0) | `@aiqadam/qadam-store : put` | пишет `upd:<update_id>` **до** любых побочных эффектов | `key`, `value = {{step_1['output'].now}}` |
| step_7 | `@aiqadam/qadam-tables : tables-find-records` | `users` по `telegram_id` | `table_id = z5PX9B8mTQC9Q6Dfuj5dM`, фильтр `eq` |
| step_8 | CODE «выбрать каноническую строку users» | детерминированный выбор при дублях (ADR-0003), решает язык (не перетирает выбор пользователя) | `{{step_7['output']}}` |
| step_9 | ROUTER «users: обновить или завести» | ветка 0 = `exists`, ветка 1 = иначе | `{{step_8['output'].exists}}` |
| step_10 (ветка 0) | `@aiqadam/qadam-tables : tables-update-record` | обновляет имя/username/lang, **снимает `blocked_bot`** | `record_id = {{step_8['output'].recordId}}` |
| step_11 (ветка 1) | `@aiqadam/qadam-tables : tables-create-records` | заводит строку `users` | `values.values[0]` |
| step_12 | `@aiqadam/qadam-tables : tables-find-records` | активная сессия визарда | `table_id = tL4fbi1GisDwA8UJ9zSod`, фильтр `telegram_id eq` |
| step_13 | CODE «классификация апдейта» | вычисляет `kind` и собирает выходной контракт | `{{step_1['output']}}`, `{{step_8['output']}}`, `{{step_12['output']}}` |
| step_14 | ROUTER «делегирование обработчику» | ветка 0 = `start_payload`, ветка 1 = продолжение `registration`, fallback = ещё не подключено | `{{step_13['output'].kind}}`, `{{step_13['output'].session.scenario}}` |
| step_15 (ветка 0) | `callFlow → fn-parse-start` | разбор `start`-payload на `kind`/`eventId`/`utm`/… | `start = {{step_13['output'].startPayload}}` |
| step_17 (ветка 0) | ROUTER «по kind разобранной ссылки» | ветка 0 = `kind = 'e'` → `registration`, fallback = `c`/`s`/пусто (W10/W11, ещё не подключены) | `{{step_15['output'].data.kind}}` |
| step_18 (ветка 0 → 0) | `callFlow → registration` (`action: start`) | делегирование в W5, `waitForResponse: false` (fire-and-forget — тяжёлая цепочка внутри `registration`, роутеру её результат не нужен) | `eventId`/`utm` из `{{step_15['output'].data}}`, `telegramId/chatId/lang` из `{{step_13['output']}}` |
| step_19 (ветка 0 → fallback) | CODE «start-payload разобран, обработчика для kind ещё нет» | след в логе для `c`/`s`/невалидных payload'ов | `{{step_15['output'].data.kind}}`, `.valid` |
| step_20 (ветка 1) | `callFlow → registration` (`action: continue`) | продолжение визарда — вызывается, когда `session.scenario = 'registration'` (клик по кнопке согласия, контакт, пропуск), `waitForResponse: false` | `kind`/`callbackData`/`contactPhone`/… + `sessionStep`/`sessionDraft`/`sessionRecordId` из `{{step_13['output'].session}}` |
| step_16 (fallback) | CODE «намерение без обработчика» | след в логе: апдейт классифицирован, но не обработан (`checkin-deeplink`/`staff-accept` — W10/W11) | `{{step_13['output']}}` |

## Зависимости

- **Таблицы**: `users` (`z5PX9B8mTQC9Q6Dfuj5dM`), `sessions` (`tL4fbi1GisDwA8UJ9zSod`, только чтение)
- **Subflow'ы**: `fn-parse-start` (`9H027DdckYSgu7Yp1LQRS`), `registration` (`RId6eBcN8T4oo8pkkWB7b`, W5)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Store**: ключи `upd:<update_id>`, scope `COLLECTION`, без TTL — чистит `dedup-sweep` (W12b, ADR-0003)

## Заметки

- **Апдейты приходят long-polling'ом, а не вебхуком** — проверено на живом
  инстансе 2026-09-12 (W19, [Q26](../../docs/OPEN-QUESTIONS.md#q26)):
  `POST /api/v1/webhooks/Y1dNon2V2EhjWM0aYwdQi` отвечает `409 «This flow receives
  events by polling»`, а `getWebhookInfo` у dev-бота отдаёт `url: ""`. Это следствие
  обновления образа платформы ([qadam-flow#393](https://github.com/aiqadam/qadam-flow/pull/393)),
  а не наша настройка: у триггера нет пропа, которым это переключается.
  Практические следствия: публичного ingress у бота нет (аутентифицировать
  вебхук нечем и незачем), а интервал опроса добавляет неизмеренную задержку
  на пути «пользователь написал → бот ответил».
- **`store put` идёт раньше апсерта `users`**, а не после: если апдейт дошёл до step_6,
  повтор того же `update_id` обязан быть отбит на следующей доставке независимо от
  того, что случится дальше в этом прогоне (упадёт ли `users`-шаг). Порядок «put
  до побочных эффектов» — это и есть механизм IDM-4 (ADR-0003, «обработчики пишутся
  так, чтобы повтор был безвреден»).
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
