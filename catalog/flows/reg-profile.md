# Flow: reg-profile

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  (ветка `reg_profile`): колбэки `ob:*` и свободный ввод на шагах `ob_await_*`
  (ADR-0015: одно касание flows, ADR-0016: одинаковые по устройству шаги делят флоу)
- **Назначение**: онбординг C первого касания (PAR-8, [ADR-0032](../../docs/adr/0032-onboarding-first-touch-profile.md)):
  зачем → согласие → имя (эвристика) → работа → город → «Всё верно?» → регистрация.
  Повторное касание (`ob:register`) — только создание регистрации
- **Flow ID (MCP)**: `5U3Kv0cSrnvDTrbictA4L` · **externalId**: `bEd0cScLAymIT44Dmtnxu`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `callbackData`, `messageText`, `messageId`, `sessionDraft`, `callbackQueryId`, `firstName`, `lastName`, `chatId`, `telegramId` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack колбэка; текстовый путь (пустой id) — мимо, без останова |
| step_3 | CODE «ob step: parse + route» | разбор draft/входа, эвристика имени (порядок ADR-0032), `action` + `regId`; `ob:decline` — только на шагах `ob_consent`/`ob_details`, иначе `ignore`; чужое — `ignore` |
| step_2 | `tables-find-records events` | событие по `id` из draft (после парсинга — ссылка вперёд невозможна) |
| step_4 | CODE «render ob card» | текст + кнопки + план записи (`writeKind`, `draftJson`, `profile`); тексты — вход `texts` (ADR-0014) |
| step_5 | ROUTER по `writeKind` | `ignore` / `card` / `consent` / `declined` / `finish` / `finish_lite` / `Otherwise` |
| step_6 (`ignore`), step_7 (`Otherwise`) | CODE noop | чужой вход — тишина |
| step_8→12 (`card`) | upsert сессии → `edit card` (+ фолбэк новым сообщением с перепиской draft) | обычные шаги диалога |
| step_13→18 (`consent`) | upsert `consent_pdn` → upsert сессии → `edit card` (+ фолбэк) | согласие пишется до вопросов профиля |
| step_19→21 (`declined`) | clear сессии → `edit card` (+ фолбэк) | отказ без согласия |
| step_22→28 (`finish`) | upsert `users` (профиль + consent) → upsert `registrations` → сессия `await_marketing` → `edit done+mkt` (+ фолбэк) | «Всё верно?» — единственное место создания регистрации первого касания |
| step_29→34 (`finish_lite`) | upsert `registrations` → сессия `await_marketing` → `edit done+mkt` (+ фолбэк) | повторное касание: `users` не трогаем (профиль не затираем пустым) |

## Зависимости

- **Таблицы**: `events` (чтение), `users` (запись профиля), `registrations` (запись), `sessions` (запись)
- **Флоу**: вызывается из `tg-router` (`queue`); хвост `await_marketing` забирает `reg-consent-mkt`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Эвристика — только роутинг** (ADR-0032 п.4): `too_short` → цифра → эмодзи →
  мусор → длинное; регресс — 7 примеров в журнале W50 (включая `Oʻzbek` чисто).
  Подозрительное имя убирает кнопку «Это я», ручной ввод остаётся.
- **Недозаполненное — сессия, не регистрация** (PAR-8): строка в `registrations`
  появляется только в `finish`/`finish_lite`; `profile_completed_at` — в том же
  апсерте, что и поля (атомарности нет — см. ниже).
- **Разделение `finish`/`finish_lite` — защита от затирания**: lite-ветка не
  пишет `users` вовсе, потому что в её draft профиля нет, а пустые строки
  через upsert не отличить от «очистить». Цена — дублированная цепочка шагов.
- **Без атомарности**: между upsert `users` и `registrations` провал оставляет
  профиль без регистрации — повторный `/start` ведёт в `register` (профиль
  заполнен) и дооформляет; между записью и отправкой — IDM-1 в `reg-consent-mkt`.
- **Должность и компания — одним сообщением** (Q58 закрыт W50): разбор по первой
  запятой, компания опциональна; имена полей `profile_first_name`/`profile_last_name`.
- **Позитив живым чатом не прогнан** — хвост на W15: матрица 17/17 локально,
  негатив (`ignore`) — там же; живого `initData` у агента нет.
