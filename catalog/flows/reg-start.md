# Flow: reg-start

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на `/start e<eventId>-<utm>` (ADR-0015: касание = один вопрос/вход)
- **Назначение**: вход участника по deep link. Проверяет доступность мест (OWN-15),
  читает профиль (`users.profile_completed_at`) и разводит: заполнен —
  **регистрация в один тап** (`register`, PAR-8, повторное касание без consent),
  нет — **вход в онбординг** (`onboard`, why-карточка + `Дальше`). Карточка-экран
  дальше редактируется на месте ([ADR-0017](../../docs/adr/0017-screen-not-message.md)).
  Старый путь `new` (согласие ПД на каждое касание) снят W50.
- **Flow ID (MCP)**: `FkxtgayOK5QubyqqMd9q4` · **externalId**: `HGX7KPhFsyFrapBRvlIAT`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `eventId`, `utm`, `telegramId`, `chatId`, `firstName`, `lastName` (имена — для эвристики онбординга, W50) |
| step_1 | `tables-find-records events` | событие по `id` |
| step_2 | `tables-find-records registrations` | регистрации события — кормят и подсчёт занятости, и поиск своей строки |
| step_12 | `tables-find-records users` | строка пользователя: `profile_completed_at`, `consent_pdn`, имя/должность (W50) |
| step_3 | CODE «decide outcome» | `existing` / `onboard` / `register` / `declined` (семь причин, включая `internal_error`); гейт профиля: заполнен → `register` со строкой профиля, иначе `onboard` |
| step_4 | ROUTER по `outcome` | `declined` / `existing` / `onboard` / `register` / `Otherwise` |
| step_5→6 (`declined`) | CODE текст по причине → `send_text_message` | вежливый отказ, регистрация не создаётся |
| step_7→8 (`existing`) | CODE `reg.already` → `send_text_message` + кнопка `web_app` | второе подтверждение не шлём (IDM-1) |
| step_9 (`onboard`) | CODE «build ob entry card» | карточка события + `onb.why` + `Дальше` (`ob:continue`); согласие переспрашиваем: старый объём покрывал регистрацию, а не поля профиля; ссылка «Открыть на карте» — только при непустых координатах (W72) |
| step_10 (`onboard`) | `send_text_message` | отправка входной карточки |
| step_15 (`onboard`) | CODE «draft JSON + cardMessageId» | черновик сессии (шаг — в `step_11`) |
| step_11 (`onboard`) | `tables-upsert-records sessions` | `scenario=registration`, `step=ob_consent` |
| step_14 (`register`) | CODE «build card: событие + профиль + регистрация» | факты + строка «Имя · должность» + `Зарегистрироваться` (`ob:register`); ссылка на карту — та же проверка, что в `step_9` (W72) |
| step_16 (`register`) | `send_text_message` | отправка карточки повторного касания |
| step_17 (`register`) | CODE «draft JSON (ob_register)» | черновик сессии |
| step_20 (`register`) | `tables-upsert-records sessions` | `scenario=registration`, `step=ob_register` |
| step_18→19 (`onboard`, отказ `step_11`) | CODE текст сбоя → `send_text_message` | запись сессии не удалась — «попробуйте ещё раз» вместо тишины |
| step_13 (`Otherwise`) | CODE «unexpected outcome» | noop-заглушка, если `outcome` не совпал ни с одной веткой |

## Зависимости

- **Таблицы**: `events`, `registrations`, `users` (чтение), `sessions` (запись)
- **Флоу**: вызывается из `tg-router`; продолжает `reg-profile` (ветки `onboard`/`register`)
- **Переменные**: `MINIAPP_URL` (кнопка QR в ветке `existing`)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Экранирование MarkdownV2 в `step_9`/`step_14` — эталон
  [`catalog/snippets/markdown-v2.md`](../snippets/markdown-v2.md), побайтово.**
  Отклонение (лишний `\` в классе символов — `\\-=` вместо `\-=`) валит
  регулярку `SyntaxError` при загрузке шага: карточка входа в онбординг и
  карточка повторного касания не отправлялись вовсе, ветки `onboard`/`register`
  падали целиком. `declined`/`existing` этой функции не используют
  (`format: None`) и не были задеты.
- **`step_15`/`step_17` кладут `step` внутрь JSON `sessions.draft`
  (`ob_consent`/`ob_register`), не только в колонку `sessions.step`.**
  `reg-profile` читает текущий шаг диалога из `draft.step`, а не из колонки
  таблицы; без этого поля в JSON каждый колбэк `ob:*` не находил свой шаг и
  уходил в `ignore` — онбординг выглядел как «повисшая» кнопка.
- **Ссылка «Открыть на карте» строится только при валидных координатах.**
  `step_9`/`step_14` читают `lat`/`lon` из `step_3` (`ev.lat || ''`) и проверяют
  `str(lat) !== '' && str(lon) !== '' && isFinite && lat∈[-90,90] && lon∈[-180,180]
  && !(lat === 0 && lon === 0)`: `Number('') === 0` иначе давал ссылку на точку 0,0
  в Атлантике, а без проверки диапазона — на произвольную «координату». Guard в
  `reg-profile`/`reg-consent-mkt` завёл W76 (без диапазона), диапазон восстановлен
  W72 (#124) — как и здесь.
- **`step_12` читает профиль по `externalId` полей `users`, не по `id`.**
  У каждого поля таблицы два идентификатора (гоча CLAUDE.md №1): `columns`
  на чтении терпит `id` молча (отдаёт `null`), `values` на записи — нет.
  Профильные колонки, добавленные W50, до сверки читались/писались по `id`.
- **Онбординг C (PAR-8, W50)**: `step_12` читает профиль до решения; `step_3`
  отдаёт `onboard` всем без `profile_completed_at` (даже с `consent_pdn=true` —
  старые регистрации) и `register` с готовой строкой профиля. Старые сессии
  `await_pdn` дорабатывают прежние `reg-consent-pdn`/`reg-consent-mkt` — флоу
  оставлены намеренно, новые касания туда не попадают.
- **`cardMessageId` живёт в JSON внутри `sessions.draft`, а не отдельной колонкой.**
  Схема таблиц заморожена с W1, а срок жизни поля равен сроку жизни сессии.
  Читают его `reg-consent-pdn`, `reg-consent-mkt` — каждый через
  `sessionDraft`, который прокидывает `tg-router`.
- **Порядок «состояние раньше экрана» здесь нарушен намеренно и единственный раз**:
  `cardMessageId` невозможно записать до отправки карточки, потому что его
  выдаёт сам Telegram. Во всех остальных флоу гостевого среза сначала пишется
  состояние, потом рисуется экран.
- **Афиша временно выведена из OWN-1** ([Q46](../../docs/OPEN-QUESTIONS.md#q46),
  [Q50](../../docs/OPEN-QUESTIONS.md#q50)): шаг `send_media` удалён из флоу,
  карточка текстовая. `step_3` по-прежнему отдаёт `photoFileId`, разбор фото в
  `tg-router` и `photo_file_id` в `events` **сохранены намеренно** — афиша
  вернётся пакетом [W39](../../docs/BACKLOG.md#w39-возврат-афиши-в-mini-app-форма-и-доставка) (v0.1).
- **Разметка `MarkdownV2`,** экранирование — эталон
  [`catalog/snippets/markdown-v2.md`](../snippets/markdown-v2.md). `format`
  задан явно в каждом шаге отправки: умолчание пропа — `MarkdownV2`, и шаг
  без явного `format` меняет разметку молча.
- **Ветки `declined` и `existing` остались на `format: None`** и обычной
  отправкой: это одноразовые ответы, а не состояние диалога, редактировать
  там нечего.
- **Лимит мест** — `capacity × (1 + overbook_pct/100)`, округление вверх.
  Пустой `overbook_pct` читается как **40**, пустой `capacity` — как «лимита нет».
- **Ветка `existing` проверяется раньше состояния события**: у уже
  зарегистрированного участника отменённое или завершённое событие всё равно
  даёт `existing` с кнопкой QR, а не отказ.
- **Страховка от молчаливой потери тапа** ([Q32](../../docs/OPEN-QUESTIONS.md#q32)).
  `step_1`/`step_2` — `continueOnFailure`; `step_3` читает их `error` и, если
  чтение упало, декларирует `reason: 'internal_error'` — уходит в уже
  существующую ветку `declined`, где `keyByReason` не находит ключ и берёт
  `common.err.generic`. Один разговорный текст вместо полной тишины **и**
  вместо двух противоречащих сообщений (первая версия страховки — отдельная
  ветка отказа на каждом шаге — дублировала сообщение с тем, что реально
  решает `step_3`; убрана). `step_11` (запись сессии, лист ветки `new`, после
  того как карточка уже отправлена) — `continueOnFailure` с собственной
  веткой отказа: карточка при этом уже показана, второе сообщение
  «попробуйте ещё раз» — не дубль, а честная реакция на реальный сбой записи.
