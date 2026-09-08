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

Оркестрация, версионируется как экспортированный JSON в `flows/`. Список и разбор — [FLOWS.md](FLOWS.md).

Инвариант: **вебхук бота принадлежит ровно одному флоу** (`tg-router`), который дальше
разводит апдейты по типам и по состоянию визарда. Два флоу на один `setWebhook` не живут.

### Состояние диалогов

Никакой памяти процесса — воркеры платформы горизонтальны и рестартуются.
Шаг визарда owner'а и черновик ивента лежат в таблице `sessions`
([DATA-MODEL.md](DATA-MODEL.md)). Каждый апдейт — это «прочитать состояние → шаг → записать».

### Данные

Qadam Flow Tables — [DATA-MODEL.md](DATA-MODEL.md).
Даёт ли Tables уникальные индексы и атомарный upsert — критично для идемпотентности
(IDM-1…IDM-4) и должно быть проверено на живом инстансе **до** сборки флоу
([Q2](OPEN-QUESTIONS.md#q2)). Запасной механизм — `store` с ключом-идемпотентности.

### Mini App — исключение из «0 кода»

Статическая страница: `showScanQrPopup()`, экран результата, один `fetch` в webhook-флоу
`checkin-api` с `initData` в теле запроса. Без бэкенда, без сборки, без фреймворка.

Требование STF-1 «сканер не закрывается между людьми» — ограничение именно этой страницы:
результат рисуется поверх сканера, попап не переоткрывается на каждого человека.

**Хостинг: GitHub Pages из этого репозитория** (решено), каталог `miniapp/`,
адрес `https://aiqadam.github.io/aiqadam-events-bot/` — он же прописывается
в BotFather как Mini App URL. Деплой пушем в `main`, HTTPS из коробки.

Отсюда вытекает: страница на одном origin, а `checkin-api` — на
`app.flow.aiqadam.org`, то есть запрос **кросс-доменный**. Нужны CORS-заголовки
на стороне вебхука Qadam Flow — проверить до сборки W7 ([Q11](OPEN-QUESTIONS.md#q11)).

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
4. **Секреты** (bot token, HMAC-ключ подписи QR) живут в connections платформы,
   а не в `.env` репозитория. Ротация — процедура в UI.
