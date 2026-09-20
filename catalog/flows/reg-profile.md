# Flow: reg-profile

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  (ветка `reg_profile`): колбэки `ob:*` и свободный ввод на шагах `ob_await_*`
  (ADR-0015: одно касание flows, ADR-0016: одинаковые по устройству шаги делят флоу)
- **Назначение**: онбординг C первого касания (PAR-8, [ADR-0032](../../docs/adr/0032-onboarding-first-touch-profile.md),
  [ADR-0034](../../docs/adr/0034-onboarding-any-first-touch.md)):
  зачем → согласие → имя (эвристика) → работа → город → «Всё верно?» → запись.
  Диалог общий для входа по диплинку события (`draft.eventId` заполнен —
  запись создаёт регистрацию) и для голого `/start` (`eventId` пуст — пишется
  только профиль, регистрировать не на что). Повторное касание (`ob:register`)
  — только создание регистрации, всегда с событием.
- **Flow ID (MCP)**: `5U3Kv0cSrnvDTrbictA4L` · **externalId**: `bEd0cScLAymIT44Dmtnxu`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | `callbackData`, `messageText`, `messageId`, `sessionDraft`, `callbackQueryId`, `firstName`, `lastName`, `chatId`, `telegramId` |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack колбэка; текстовый путь (пустой id) — мимо, без останова |
| step_3 | CODE «ob step: parse + route» | разбор draft/входа, эвристика имени (порядок ADR-0032), `action` + `regId`; `ob:decline` — только на шагах `ob_consent`/`ob_details`, иначе `ignore`; чужое — `ignore` |
| step_2 | `tables-find-records events` | событие по `id` из draft (после парсинга — ссылка вперёд невозможна) |
| step_4 | CODE «render ob card» | текст + кнопки + план записи (`writeKind`, `draftJson`, `profile`); тексты — вход `texts` (ADR-0014) |
| step_5 | ROUTER по `writeKind` | `ignore` / `card` / `consent` / `declined` / `finish` / `finish_lite` / `finish_no_event` / `Otherwise` |
| step_6 (`ignore`), step_7 (`Otherwise`) | CODE noop | чужой вход — тишина |
| step_8→12 (`card`) | upsert сессии → `edit card` (+ фолбэк новым сообщением с перепиской draft) | обычные шаги диалога |
| step_13→18 (`consent`) | upsert `consent_pdn` → upsert сессии → `edit card` (+ фолбэк) | согласие пишется до вопросов профиля |
| step_19→21 (`declined`) | clear сессии → `edit card` (+ фолбэк) | отказ без согласия |
| step_22→28 (`finish`) | upsert `users` (профиль + consent) → upsert `registrations` → сессия `await_marketing` → `edit done+mkt` (+ фолбэк) | «Всё верно?» с событием — регистрация первого касания |
| step_29→33 (`finish_lite`) | upsert `registrations` → сессия закрыта сентинелом `-` → `edit done` (+ фолбэк) → `send ticket` | повторное касание (W60): `users` не трогаем (профиль не затираем пустым); согласие на рассылку уже дано/отклонено при первом заполнении профиля — вопрос не повторяем, билет уходит сразу вторым сообщением |
| step_35→40 (`finish_no_event`) | upsert `users` (профиль + consent) → сессия `await_marketing` → `edit done+mkt` (+ фолбэк) | ADR-0034: «Всё верно?» без события (голый `/start`) — регистрацию создавать не на что, `registrations` не трогаем; хвост `await_marketing` тот же, `reg-consent-mkt` сам решает по пустому `eventId`, что показать |

## Зависимости

- **Таблицы**: `events` (чтение), `users` (запись профиля), `registrations` (запись), `sessions` (запись)
- **Флоу**: вызывается из `tg-router` (`queue`); хвост `await_marketing` забирает `reg-consent-mkt`
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **`step_3` парсит шаг диалога из `draft.step` внутри JSON `sessions.draft`,
  а не из колонки `sessions.step`.** `draftOf`/фолбэк-шаги (`step_11/17/27/33`)
  обязаны класть `step` в этот JSON при каждой записи — раньше параметр
  принимался, но не попадал в объект, поэтому каждый колбэк видел пустой шаг
  и уходил в `ignore`.
- **`writeKind` эвристики имени — `'consent'`, не `'card'`.** Ветка ROUTER
  `consent` (запись `users.consent_pdn` сразу по «Согласен», до вопросов
  профиля — PAR-1) была недостижима: код никогда не выставлял это
  значение, согласие фиксировалось только в `finish`.
- **Эвристика подозрительного имени — регексп с явным флагом `u`
  (`/regex/u.test(...)`), не `/regex/.u.test(...)`.** Оторванная точка перед
  флагом превращала его в обращение к несуществующему свойству — падение на
  любом «чистом» имени (ровно на канонических примерах ADR-0032).
- **`step_22` пишет шесть колонок профиля (`profile_first_name`,
  `profile_last_name`, `position`, `company`, `city`, `profile_completed_at`)
  по `externalId`, не по `id` поля.** Как и в `reg-start/step_12`: `values`
  на запись молча отбрасывает ключ, не совпадающий ни с одним `externalId`
  таблицы — вызов возвращает успех, поля остаются `null`.
- **Экранирование MarkdownV2 в `step_4` — тот же эталон и та же гоча лишнего
  `\`, что в `reg-start`**: `\\-=` вместо `\-=` валило `SyntaxError` на
  каждом действии, кроме `ignore`.
- **Эвристика — только роутинг** (ADR-0032 п.4): `too_short` → цифра → эмодзи →
  мусор → длинное; регресс — 7 примеров в журнале W50 (включая `Oʻzbek` чисто).
  Подозрительное имя убирает кнопку «Это я», ручной ввод остаётся.
- **Недозаполненное — сессия, не регистрация** (PAR-8): строка в `registrations`
  появляется только в `finish`/`finish_lite`; `profile_completed_at` — в том же
  апсерте, что и поля (атомарности нет — см. ниже).
- **Разделение `finish`/`finish_lite` — защита от затирания**: lite-ветка не
  пишет `users` вовсе, потому что в её draft профиля нет, а пустые строки
  через upsert не отличить от «очистить». Цена — дублированная цепочка шагов.
- **`finish_no_event` (ADR-0034) — та же логика, что `finish`, минус
  создание регистрации.** Разводит их `step_4`: `action === 'finish'` при
  пустом `draft.eventId` даёт `writeKind = 'finish_no_event'`, а не
  `'finish'`; текст карточки берёт `profile.saved(.header)` вместо
  `reg.done(.header)`. Цена та же, что у `finish`/`finish_lite` — ещё одна
  дублированная цепочка шагов, а не условный шаг внутри одной ветки
  (ROUTER — единственный способ на платформе безопасно пропустить один
  шаг посреди цепочки).
- **Без атомарности**: между upsert `users` и `registrations` провал оставляет
  профиль без регистрации — повторный `/start` ведёт в `register` (профиль
  заполнен) и дооформляет; между записью и отправкой — IDM-1 в `reg-consent-mkt`.
- **Должность и компания — одним сообщением** (Q58 закрыт W50): разбор по первой
  запятой, компания опциональна; имена полей `profile_first_name`/`profile_last_name`.
- **Позитив живым чатом не прогнан** — хвост на W15: матрица 17/17 локально,
  негатив (`ignore`) — там же; живого `initData` у агента нет.
- **`show_consent` и вход `reg-start`/`menu` используют разные ключи текста
  на кнопку.** Обе карточки-предшественницы (`reg-start/step_9`, `menu/step_4`)
  показывают нейтральную «Дальше» (`onb.btn.continue`, ведёт на саму карточку
  согласия), а сама карточка согласия — «Согласен» (`onb.btn.agree`, ведёт на
  `ob:agree`, то есть на фактическое согласие). Общий ключ на обе кнопки был
  бы неверен в одном из двух мест — «Согласен» до показа текста согласия
  либо «Дальше» на кнопке, которая и есть согласие.
- **`finish_lite` не переспрашивает согласие на рассылку (W60).** Ветка
  достижима только когда `users.profile_completed_at` уже заполнен
  (`reg-start/step_3`, гейт «профиль заполнен → register»), а заполнение
  профиля в любом из путей (`finish`/`finish_no_event`/`registered_profile`
  в `reg-api`) невозможно без прохождения `await_marketing` хотя бы раз —
  ответ на вопрос о рассылке уже есть. `step_4` для `finish_lite` строит
  финальную карточку без кнопок и без строки-вопроса и сразу же тексты
  билета (`ticketText`/`ticketReplyMarkup`, та же форма, что в
  `reg-consent-mkt/step_5`); `step_31` (`continueOnFailure`) ведёт на
  `step_33` («send ticket») тем же приёмом, что `reg-consent-mkt/step_7→9`
  (продолжение исполняется независимо от ветки отказа, CLAUDE.md гоча №15).
  Сессия закрывается сентинелом `-` до отправки карточки (`step_30`), а не
  после: следующего колбэка не предполагается, обновлять `cardMessageId`
  незачем — тот же приём, что в ветке `declined`.
  Изменить решение (снова спрашивать) пользователь может табом «Профиль»
  Mini App — переключатель пишет `consent_marketing` напрямую через `reg-api`.
- **Отказ (`declined`) различает диплинк и голый `/start` по `eventId`**:
  `reg.consent_pdn.declined` («откройте ту же ссылку ещё раз») — только когда
  ссылка была; `reg.consent_pdn.declined_no_link` — когда онбординг начался
  без неё (ADR-0034), иначе текст ссылался на несуществующую ссылку.
