# Flow: fn-verify-init-data

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: валидация Telegram `initData` по HMAC токена бота + свежесть `auth_date` (STF-2).
- **Flow ID (MCP)**: `YEGaCp6uwKEtI2p4W9FIL` · **externalId (для `callFlow`)**: `cJAZDvJxj1mM0s1sWzOIi`

## Контракт

**Вход:** `{ initData: string, maxAgeSeconds?: number }` — `86400` (24ч, SECURITY.md)
одновременно дефолт **и потолок**: вызывающий может окно сузить, но не расширить.

**Выход:**

| Поле | Смысл |
|------|-------|
| `valid` | `hashValid && fresh` — только это даёт право работать |
| `hashValid` | подпись сошлась |
| `fresh` | `auth_date` в окне `[-300s, maxAgeSeconds]` |
| `reason` | `''` \| `malformed` \| `too_long` \| `bad_hash_format` \| `bad_hash` \| `expired` |
| `telegramId` | `user.id` строкой, **только при `valid`**, иначе `''` |
| `user` | объект `user` из initData, **только при `valid`**, иначе `null` |
| `authDate`, `authDateIso`, `ageSeconds`, `maxAgeSeconds` | для диагностики и ответа Mini App |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «parse initData» | разбор query string, `data_check_string` | `{{trigger['output'].data.initData}}` |
| step_2 | `@aiqadam/qadam-crypto : hmac-signature` | `secret_key = HMAC("WebAppData", bot token)` | `secretKey` = `WebAppData`, `secretKeyEncoding` = `utf-8`, `method` = `sha256`, `text` = `{{variables['BOT_TOKEN']}}` (**с 2026-09-09, W8** — было `{{connections['TZTlXaCEO2hEvimUowbSA']}}`, см. заметки), `outputEncoding` = **`hex`** |
| step_3 | `@aiqadam/qadam-crypto : hmac-signature` | `expected = HMAC(secret_key, data_check_string)` | `secretKey` = `{{step_2['output']}}`, `secretKeyEncoding` = **`hex`**, `text` = `{{step_1['output'].dataCheckString}}`, `outputEncoding` = `hex` |
| step_4 | CODE «constant-time compare + auth_date» | сравнение и свежесть | `expected` = `{{step_3['output']}}`, `maxAgeSeconds` = `{{trigger['output'].data.maxAgeSeconds}}` |
| step_5 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_4['output']}}` |

## Зависимости

- **Таблицы**: — · **Переменные**: `BOT_TOKEN` (с 2026-09-09, W8)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — **больше не используется
  этим флоу**; токен здесь читается из Variable (см. заметки, [ADR-0008](../../docs/adr/0008-bot-token-as-variable-not-connection-template.md))

## Заметки

- **Токен бота с 2026-09-09 читается из `{{variables['BOT_TOKEN']}}`, не из
  `{{connections['<externalId>']}}`.** До этой правки `text` шага `step_2`
  ссылался на connection, и это считалось рабочим (W2 подтвердил механику
  цепочки на синтетических пробниках) — **до тех пор, пока W8 не прогнал
  настоящий `initData` от живого Telegram-клиента**: `hashValid: false`,
  хотя алгоритм и токен по отдельности были верны (`getMe` через ту же
  connection подтвердил правильный бот). Решающая проверка — HMAC от **реального**
  токена, посчитанный владельцем бота **локально** (не через MCP — секрет платформа
  не отдаёт), не совпал со значением, которое давал шаблон `{{connections[...]}}`.
  После переключения `text` на `{{variables['BOT_TOKEN']}}` тот же самый `initData`
  дал `hashValid: true` тем же прогоном, без других изменений. Значит
  `{{connections['<id>']}}`, использованный как обычные данные (не как `auth`
  PIECE-шага), не гарантированно даёт тот же байт-в-байт секрет, что использует
  внутренняя авторизация того же connection для настоящих API-вызовов. Подробности,
  что перепробовано и как исключены другие причины (алфавит `data_check_string`,
  порядок аргументов HMAC, экранирование `photo_url`) —
  [ADR-0008](../../docs/adr/0008-bot-token-as-variable-not-connection-template.md).
- Секрет не попадает в репозиторий ни в одном варианте — но **это не значит,
  что он защищён**: и токен (входы шага 2), и производный от него ключ (вывод шага 2)
  лежат открытым текстом в логе каждого прогона, а кто читает логи — подделывает
  `initData` для любого `telegram_id`. Цена названа в
  [ADR-0005](../../docs/adr/0005-secrets-visible-in-run-logs.md) и в
  [SECURITY.md](../../docs/SECURITY.md#логи-прогонов--тоже-секрет-adr-0005);
  ограничивается только доступом к проекту и к логам — риск одинаков для
  connection и Variable.
- **Семантика аргументов qadam'а проверена отдельно**: `ap_run_action` с
  `secretKey = "WebAppData"`, `text = "PROBE-W2"`, `outputEncoding = hex` даёт
  `5a2b099b41154ee663ad6753f999940b02ae5fba122a8592adef108769343e8b` — это
  HMAC(key=`WebAppData`, msg=`PROBE-W2`), и **не** обратная ориентация
  (`4469d2c2e3e24b893b41b726a09bb3d7b3b6391f85de813060a11a88207367cc`).
  То есть `secretKey` — ключ, `text` — сообщение. Значение воспроизводится любым
  внешним HMAC; id прогона не приводится, потому что `ap_run_action` не сохраняется
  как flow run.
- **Конфигурация шагов подтверждена read-only REST-экспортом**
  ([ADR-0006](../../docs/adr/0006-rest-read-only-for-review.md), снимал ревьюер —
  владельцу REST не разрешён): у `step_2` `secretKey: "WebAppData"`,
  `text: "{{connections['TZTlXaCEO2hEvimUowbSA']}}"`, `secretKeyEncoding: "utf-8"`;
  у `step_3` `secretKey: "{{step_2['output']}}"`, `secretKeyEncoding: "hex"`.
  Значит токен подставлен именно в `text`, ориентация верна и hex-ключ второго шага
  собран как задумано — это **факт, а не вывод из поведения**. На момент W2 это
  считалось достаточным; W8 показал, что факта о конфигурации мало, если сам
  источник данных (`connections` vs `variables`) может резолвиться по-разному —
  см. запись про `BOT_TOKEN` выше.
- **[Q16](../../docs/OPEN-QUESTIONS.md#q16) закрыт W8, 2026-09-09**: два независимых
  захвата `initData` от живого клиента Telegram дали `hashValid: true` после
  переключения на `{{variables['BOT_TOKEN']}}` — прогон `zVsliGe9MlO6cfXpjcwbT`.
  До этой правки те же данные давали `hashValid: false` (прогон `tlUVYMNIT4M5x3lffPPtN`,
  через боевой вызов `checkin-api` — `Xs2d24lqPNqaSb0ohaDjS`) — не «не хватало
  прогона», а реальный баг конфигурации, который этот прогон и нашёл.
- **Цепочка двух HMAC собрана штатно, без своей криптографии.** Ключ второго шага —
  hex-вывод первого при `secretKeyEncoding = hex`; платформа трактует его как
  двоичный ключ. Сверено независимо: для `data_check_string`
  `auth_date=1789047720\nquery_id=AAF\nuser={"id":555000111,"first_name":"Test"}`
  и ключа из шага 1 внешний расчёт HMAC-SHA256 дал ровно `632d6a78…59e9` — то же,
  что вернул шаг 3. Значит алгоритм — телеграмовский, а не «похожий».
- `data_check_string` — все поля кроме `hash`, **декодированные**, отсортированы по
  ключу, склеены `\n`. Порядок полей во входной строке не важен: проверено переставленным
  `initData` — та же подпись.
- **Сравнение constant-time**, XOR-аккумулятор по всей длине.
- **`telegramId` и `user` отдаются только при `valid === true`.** Подмена `user`
  на чужой id проверена: `hashValid: false`, `telegramId: ''`. Это и есть
  «`telegram_id` берётся только из проверенного `initData`» (STF-2).
  Изначально они отдавались уже при `hashValid`, и просроченный на сутки `initData`
  всё равно нёс годный `telegramId`: вызывающему достаточно было посмотреть не на то
  поле, чтобы получить авторизацию. Исправлено по ревью W2 — прогон
  `5Lajtk7X2fFsbmV7938t7`: `hashValid: true`, `reason: 'expired'`, `telegramId: ''`.
- **`maxAgeSeconds` ограничен сверху 24 часами внутри функции.** Пока вызывающие свои,
  параметр безопасен; в момент, когда значение поедет из запроса Mini App, окно
  свежести отключалось бы одним числом. Проверено тем же прогоном: вход
  `999999999` вернулся как `maxAgeSeconds: 86400`, и суточный `initData` остался
  `expired`.
- **Окно 24 часа выбрано сознательно** (SECURITY.md): `initData` выдаётся один раз при
  открытии Mini App и сам не обновляется, а сканер контролёра открыт весь вечер.
  Просроченный `initData` даёт `reason: 'expired'` при `hashValid: true` — по этому
  коду страница просит переоткрыть Mini App, а не молчит.
- Мусор на входе (`initData` без `=`, без `hash`, длиннее 8192) не валит прогон:
  `step_1` подставляет заглушку `dataCheckString = 'x'` (поле `text` у qadam'а
  обязательное), а `step_4` всё равно возвращает `valid: false`.
- **Поле `signature`** (Ed25519 для сторонней валидации) в `data_check_string`
  включается наравне с остальными: исключается только `hash`, как в документации Telegram.
