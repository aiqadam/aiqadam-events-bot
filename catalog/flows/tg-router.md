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
| trigger | `@aiqadam/qadam-telegram-bot : new_telegram_message` | вебхук бота (единственный на токен) | `update_types = [message, callback_query]` |
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
| step_14 | ROUTER «делегирование обработчику» | пока единственная (fallback) ветка — обработчиков ещё нет | `{{step_13['output'].kind}}` |
| step_16 (fallback) | CODE «намерение без обработчика» | след в логе: апдейт классифицирован, но не обработан | `{{step_13['output']}}` |

## Зависимости

- **Таблицы**: `users` (`z5PX9B8mTQC9Q6Dfuj5dM`), `sessions` (`tL4fbi1GisDwA8UJ9zSod`, только чтение)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)
- **Store**: ключи `upd:<update_id>`, scope `COLLECTION`, без TTL — чистит `dedup-sweep` (W12b, ADR-0003)

## Заметки

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
- **`fn-parse-start` в этот пакет НЕ включён** — см. «Хвосты и блокеры» в
  [журнале пакета](../../docs/work/W04-tg-router.md) и
  [ARCHITECTURE](../../docs/ARCHITECTURE.md#callflow-с-данными-через-mcp-не-настраивается-проверено-на-инстансе-2026-09-09):
  `flowProps` (payload, передаваемый вызываемому subflow) не удаётся записать
  через MCP ни одним из проверенных способов, хотя выбор самого флоу по
  `externalId` проходит. Роутер классифицирует `/start` с payload как
  `start_payload` и отдаёт `startPayload` сырой строкой — разбор `kind`/`eventId`/
  `sig` остаётся будущему пакету, который заодно повторно проверит `callFlow`.
- **Обработчиков (`registration`, `checkin-deeplink`, `staff-accept`) в проекте
  ещё нет** (W5, W10, W11 не начаты) — ветка `step_14` единственная и всегда
  фолбэк. Следующий пакет добавляет `ap_add_branch` на `step_14` по мере готовности
  обработчиков; менять `tg-router` при этом не обязательно.
