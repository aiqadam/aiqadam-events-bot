# Архитектура: всё на Qadam Flow

Несущий стек — [Qadam Flow](https://github.com/aiqadam/qadam-flow), форк Activepieces
(MIT-ядро, enterprise-код вырезан). Инстанс: <https://app.flow.aiqadam.org>.

## Главное ограничение

> **Цель — 0 кода. Всё на Qadam Flow, максимум — Code steps внутри флоу.**

Из этого следует, чего в проекте **нет**:

- нет отдельного бот-процесса (aiogram / grammY / что угодно ещё);
- нет кастомного qadam'а в `packages/qadams/custom/` и, значит, нет форка платформы,
  сборки, публикации и релизного цикла под нас;
- нет своего API-сервиса, своей БД, своего деплоя.

Всё, что есть: **флоу + встроенные Code steps + core-qadam'ы + Tables**.
Артефакт проекта — экспортированные JSON'ы флоу и схема таблиц, а не приложение.

Единственное исключение — Mini App (см. ниже): `showScanQrPopup()` физически требует
статической HTML-страницы с Telegram WebApp JS. Это ~одна страница, и она клиентская.

## Что даёт платформа

| Что | Где | Зачем нам |
| --- | --- | --- |
| **Code step** | встроен в редактор (`engine/src/lib/core/code`) | TypeScript в песочнице, npm-зависимости, вход = выход предыдущих шагов |
| **Telegram Bot** qadam | `qadams/community/telegram-bot` | 20 actions: `sendMessage`, `sendLocation`, `sendMedia`, `sendPoll`, `editMessageText`, `answerCallbackQuery`, `getChat`, … + триггер `new-message` |
| **Tables** | `qadams/core/tables` | встроенная БД: `create-records`, `find-records`, `get-record`, `update-record`, `delete-record`, `download-table` + триггеры на новую/изменённую/удалённую запись |
| **Crypto** | `qadams/core/crypto` | **`hmac-signature`**, `hash-text`, `base64-encode/decode` — подпись QR и проверка `initData` без единой строчки своего кода |
| **Subflows** | `qadams/core/subflows` | `callable-flow` (триггер) + `call-flow` + `respond` — наши переиспользуемые «функции» |
| **Webhook** | `qadams/core/webhook` | входящая точка для Mini App |
| **Schedule** | `qadams/core/schedule` | крон: напоминания, автоперевод в `finished` |
| **Store** | `qadams/core/store` | KV: дедуп `update_id`, курсор рассылки, TTL-токены |
| **CSV / QR / HTTP / Delay / Date-helper / Text-helper** | `qadams/core/*` | экспорт, генерация QR, вызовы Bot API, троттлинг, таймзоны |

Терминология: **qadam** = piece в терминах Activepieces.

## Песочница Code step — проверено на инстансе 2026-09-08

Прогон пробного флоу на <https://app.flow.aiqadam.org> дал жёсткую картину.
**Code step — это чистый ECMAScript плюс `Intl`, и больше ничего:**

| Что | Результат пробы |
| --- | --- |
| `Intl.DateTimeFormat` с `Asia/Tashkent` | ✅ `2026-09-08T14:00:00Z` → `8 сент. 2026 г., 19:00` |
| Локаль `uz-UZ` | ✅ `Sentabr` |
| `node:crypto` | ❌ `Not supported` |
| `fetch` | ❌ `undefined` |
| `Buffer` | ❌ `undefined` |
| `btoa` / `TextEncoder` / `crypto.subtle` | ❌ отсутствуют |
| npm-зависимости через `packageJson` | ❌ `require is not defined` |
| `process` | ❌ отсутствует; таймзона песочницы — UTC |

Отсюда три следствия, и все они в нашу пользу:

1. **«Code step — чистая функция» больше не соглашение, а физика.** Сети из шага нет,
   обойти правило нечем.
2. **HMAC обязан идти через `crypto` qadam** — своей реализации просто не из чего собрать.
   Ровно то, что уже записано в правилах.
3. **`fn-fmt-time` реализуется штатно**: полный ICU на месте, `Asia/Tashkent` и `uz-UZ`
   работают, ручной расчёт смещения UTC+5 не нужен.

Что это меняет в мелочах: base64url получается **строковым преобразованием** вывода
`crypto` qadam'а в base64 (`+`→`-`, `/`→`_`, срезать `=`) — без `Buffer` это единственный
путь. Случайные токены — `crypto / generate-password` (`alphanumeric`, до 256 символов).

## Известные лимиты платформы (проверены по исходникам)

| Лимит | Значение | Где | Что означает для нас |
| --- | --- | --- | --- |
| `FLOW_TIMEOUT_SECONDS` | `600` | `server/api/src/app/helper/system/system.ts:46` | одна рассылка ≤ 10 минут прогона → при 25 msg/s это ≤ 15 000 сообщений за run; всё равно бьём на чанки ради возобновляемости |
| `TRIGGER_TIMEOUT_SECONDS` | `60` | там же, `:47` | вебхук-ответ для Mini App должен укладываться в минуту — чекин обязан быть коротким синхронным флоу |
| `TRIGGER_HOOKS_TIMEOUT_SECONDS` | `180` | там же, `:49` | |

## Слои

```
┌─ Mini App (единственная статика) ──────────────────────────────┐
│  сканер staff: WebApp.showScanQrPopup(), не закрывается        │
│  POST → webhook флоу checkin-api, initData передаётся как есть │
└───────────────────────┬────────────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────────┐
│  Флоу-маршрутизаторы:  tg-router · checkin-api · reminders ·   │
│                        lifecycle · broadcast-runner            │
└───────────────────────┬────────────────────────────────────────┘
                        │ call-flow
┌───────────────────────▼────────────────────────────────────────┐
│  Subflow-«функции»:  t · parse-start · sign-qr · verify-qr ·   │
│  verify-init-data · resolve-segment · fmt-time · event-card    │
└───────────────────────┬────────────────────────────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────────┐
│  Tables (данные)  ·  Store (KV/идемпотентность)                │
└────────────────────────────────────────────────────────────────┘
```

### Subflow'ы вместо библиотеки

Раз своего пакета нет, переиспользование строится на `subflows`: каждая общая
операция — отдельный флоу с триггером `callable-flow`, который вызывается через
`call-flow` и отдаёт результат через `respond`.

| Subflow | Вход | Выход | Чем реализован |
| --- | --- | --- | --- |
| `fn-t` | `key`, `lang`, `vars` | строка | Tables `strings` + Code step (подстановка `{var}`) |
| `fn-parse-start` | `start` payload | `{kind, eventId, userId, utm, token, sig}` | Code step (чистый парсинг) |
| `fn-sign-qr` | `eventId`, `userId` | `sig` (10 симв.) | **crypto `hmac-signature`** + Code step (base64url + обрезка) |
| `fn-verify-qr` | payload | `valid: bool` | `fn-sign-qr` + Code step (constant-time сравнение) |
| `fn-verify-init-data` | `initData` | `{valid, telegramId, authDate}` | crypto `hmac-signature` ×2 + Code step (разбор и сортировка полей) |
| `fn-resolve-segment` | `segment`, `eventId` | список `telegram_id` | Tables `find-records` + Code step (фильтры, вычитание `blocked_bot`) |
| `fn-fmt-time` | ISO UTC, `lang` | строка в Asia/Tashkent | Code step (`Intl.DateTimeFormat`) |
| `fn-event-card` | `eventId`, `lang` | текст + кнопки + venue-параметры | Tables + `fn-t` + `fn-fmt-time` |

Правило: **Code step — только чистая функция.** Никаких сетевых вызовов и записей в БД
внутри Code step: HTTP делает `http`/`telegram-bot` qadam, запись — `tables`.
Так шаг остаётся отлаживаемым и переигрываемым, а в логе прогона видно каждое обращение вовне.

Второе правило: **криптографию не пишем руками.** HMAC берём из `crypto` qadam'а,
Code step рядом только кодирует/сравнивает.

### Флоу-маршрутизаторы

Оркестрация. Строится через MCP, а в git версионируется как **агентский каталог**
`catalog/flows/*.md` ([ADR-0004](adr/0004-catalog-instead-of-flow-export.md)).
Целевой список и разбор — [FLOWS.md](FLOWS.md).

Инвариант: **вебхук бота принадлежит ровно одному флоу** (`tg-router`), который дальше
разводит апдейты по типам и по состоянию визарда. Два флоу на один `setWebhook` не живут.

### Состояние диалогов

Никакой памяти процесса — воркеры платформы горизонтальны и рестартуются.
Шаг визарда owner'а и черновик ивента лежат в таблице `sessions`
([DATA-MODEL.md](DATA-MODEL.md)). Каждый апдейт — это «прочитать состояние → шаг → записать».

### Данные

Qadam Flow Tables — [DATA-MODEL.md](DATA-MODEL.md).

**Проверено 2026-09-08, и ответ неудобный:** уникальных индексов в Tables нет.
Три записи с одинаковым ключом вставились подряд без единой жалобы. Типы полей —
только `TEXT`, `NUMBER`, `DATE`, `STATIC_DROPDOWN`; ни boolean, ни JSON.
Действия qadam'а: create / update / get / find / delete / clear — **upsert'а нет**.
У `store put` нет ни режима «только если ключа нет», ни TTL.

Значит, **атомарного примитива на платформе нет вообще**, и идемпотентность
(IDM-1…IDM-4) не может опираться на БД. Как мы с этим живём —
[ADR-0003](adr/0003-idempotency-without-atomicity.md).

### Вебхуки: проверенные факты

```
POST https://app.flow.aiqadam.org/api/v1/webhooks/<flowId>/sync
```

- суффикс **`/sync`** даёт синхронный ответ — это адрес `checkin-api`;
- **preflight `OPTIONS` обрабатывает платформа сама** (204, `access-control-allow-origin: *`),
  прогон флоу на него не тратится;
- `webhook / return_response` задаёт `status`, произвольные `headers` и JSON-тело —
  коды `401`/`403` для Mini App реализуются штатно;
- у триггера `catch_webhook` есть встроенная авторизация (`none` / basic / header /
  **HMAC Signature**) — мы её не используем, потому что проверяем `initData` сами,
  но знать полезно.

### Mini App — исключение из «0 кода»

Статическая страница: `showScanQrPopup()`, экран результата, один `fetch` в webhook-флоу
`checkin-api` с `initData` в теле запроса. Без бэкенда, без сборки, без фреймворка.

Требование STF-1 «сканер не закрывается между людьми» — ограничение именно этой страницы:
результат рисуется поверх сканера, попап не переоткрывается на каждого человека.

**Хостинг: GitHub Pages из этого репозитория** (решено), каталог `miniapp/`,
адрес `https://aiqadam.github.io/aiqadam-events-bot/` — он же прописывается
в BotFather как Mini App URL. Деплой пушем в `main`, HTTPS из коробки.

Кросс-доменный запрос со страницы в `checkin-api` **проверен боем 2026-09-08
и работает** ([Q11](OPEN-QUESTIONS.md#q11)): preflight отвечает платформа,
`Content-Type: application/json` проходит, подгонять запрос под «простой» не нужно.

### Окружения

Два проекта внутри одного инстанса: **`events-dev`** и **`events-prod`**
(решено, [Q7](OPEN-QUESTIONS.md#q7)). Разные боты, разные таблицы, разные connections.
Правки обкатываются в `events-dev`; в `events-prod` едет только экспортированный флоу.
Прямая правка боевого флоу «на живую» особенно опасна для рассылок — там ошибка
уходит людям и не отзывается.

## Цена решения — принимаем осознанно

Честный список того, что «0 кода» стоит. Это не возражения, а то, что нельзя обнаружить на проде:

1. **Рассылка на 25 msg/s** внутри Code step упирается в 600-секундный таймаут флоу и в то,
   что шаг не может сам себя перезапустить. Решение — чанки + курсор в `store`
   + `schedule`-флоу, догоняющее очередь. Разложено в [FLOWS.md](FLOWS.md#broadcast).
2. **Визард создания ивента** на канвасе — это ветвление по `sessions.step`.
   Читается хуже, чем FSM в коде; компенсируем тем, что каждый шаг однотипен.
3. **Нет юнит-тестов** в привычном виде. Проверяемость — на фикстурах прогонов
   и на чек-листах приёмки в [BACKLOG.md](BACKLOG.md).
4. **Секреты** живут в платформе, а не в `.env` репозитория: bot token — connection,
   `QR_SIGNING_KEY` — project Variable. Ротация — процедура в UI.
5. **Версионирование — через каталог, а не через выгрузку файлов.** Значит,
   автоматического отката нет и синхронность каталога держится на дисциплине
   (ADR-0004).
