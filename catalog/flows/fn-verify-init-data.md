# Flow: fn-verify-init-data

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: валидация Telegram `initData` по HMAC токена бота + свежесть `auth_date` (STF-2).
- **Flow ID (MCP)**: `YEGaCp6uwKEtI2p4W9FIL` · **externalId (для `callFlow`)**: `cJAZDvJxj1mM0s1sWzOIi`

## Контракт

**Вход:** `{ initData: string, maxAgeSeconds?: number }` (дефолт `86400` — 24ч, SECURITY.md)

**Выход:**

| Поле | Смысл |
|------|-------|
| `valid` | `hashValid && fresh` — только это даёт право работать |
| `hashValid` | подпись сошлась |
| `fresh` | `auth_date` в окне `[-300s, maxAgeSeconds]` |
| `reason` | `''` \| `malformed` \| `too_long` \| `bad_hash_format` \| `bad_hash` \| `expired` |
| `telegramId` | `user.id` строкой, **только при `hashValid`**, иначе `''` |
| `user` | объект `user` из initData, **только при `hashValid`**, иначе `null` |
| `authDate`, `authDateIso`, `ageSeconds`, `maxAgeSeconds` | для диагностики и ответа Mini App |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «parse initData» | разбор query string, `data_check_string` | `{{trigger['output'].data.initData}}` |
| step_2 | `@aiqadam/qadam-crypto : hmac-signature` | `secret_key = HMAC("WebAppData", bot token)` | `secretKey` = `WebAppData`, `secretKeyEncoding` = `utf-8`, `method` = `sha256`, `text` = `{{connections['TZTlXaCEO2hEvimUowbSA']}}`, `outputEncoding` = **`hex`** |
| step_3 | `@aiqadam/qadam-crypto : hmac-signature` | `expected = HMAC(secret_key, data_check_string)` | `secretKey` = `{{step_2['output']}}`, `secretKeyEncoding` = **`hex`**, `text` = `{{step_1['output'].dataCheckString}}`, `outputEncoding` = `hex` |
| step_4 | CODE «constant-time compare + auth_date» | сравнение и свежесть | `expected` = `{{step_3['output']}}`, `maxAgeSeconds` = `{{trigger['output'].data.maxAgeSeconds}}` |
| step_5 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_4['output']}}` |

## Зависимости

- **Таблицы**: — · **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`) — **как значение, а не как auth шага**

## Заметки

- **Токен бота читается из connection шаблоном `{{connections['<externalId>']}}`
  и подставляется в `text`, а не в `auth`.** Проверено: `crypto` qadam'у auth не нужен,
  а токен нужен как данные. Так секрет остаётся в платформе (SECURITY.md: bot token —
  connection, не Variable).
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
- **`telegramId` не отдаётся, пока подпись не сошлась.** Подмена `user` на чужой id
  проверена: `hashValid: false`, `telegramId: ''`. Это и есть «`telegram_id` берётся
  только из проверенного `initData`» (STF-2).
- **Окно 24 часа выбрано сознательно** (SECURITY.md): `initData` выдаётся один раз при
  открытии Mini App и сам не обновляется, а сканер контролёра открыт весь вечер.
  Просроченный `initData` даёт `reason: 'expired'` при `hashValid: true` — по этому
  коду страница просит переоткрыть Mini App, а не молчит.
- Мусор на входе (`initData` без `=`, без `hash`, длиннее 8192) не валит прогон:
  `step_1` подставляет заглушку `dataCheckString = 'x'` (поле `text` у qadam'а
  обязательное), а `step_4` всё равно возвращает `valid: false`.
- **Поле `signature`** (Ed25519 для сторонней валидации) в `data_check_string`
  включается наравне с остальными: исключается только `hash`, как в документации Telegram.
