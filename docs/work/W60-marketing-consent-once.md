# W60. Согласие на рассылку — спрашивать один раз, не при каждой регистрации

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне BACKLOG — прямое решение владельца в чате
- **Зависит от**: W59 (`finish_lite` — та же ветка, что чинится здесь)
- **Начат**: 2026-09-20 · **Закрыт**: —

## Цель

Владелец сообщил: после регистрации на очередное событие бот снова спрашивает
«Присылать анонсы?», даже если согласие (да или нет) уже было дано при первом
касании. `finish_lite` (повторная регистрация, `ob:register`) достижима только
когда `users.profile_completed_at` уже заполнен (`reg-start/step_3`, гейт
«профиль заполнен → register»), а заполнение профиля в любом из трёх путей
(`finish`/`finish_no_event`/`registered_profile` в `reg-api`) невозможно без
прохождения `await_marketing` хотя бы раз — то есть к моменту `finish_lite`
ответ на вопрос о рассылке уже существует. Переспрашивать не нужно: сразу
финальная карточка + билет, без вопроса и без новой сессии-ожидания.

Второе: если пользователь один раз отказался, а потом передумал — он должен
мочь включить рассылку сам, без выхода на бота. Добавляется галочка «Присылать
анонсы других событий» в таб «Профиль» Mini App (`#/events?tab=profile`).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-profile` | `5U3Kv0cSrnvDTrbictA4L` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| flow `reg-api` | `SiYL8m6k4oy4YunAdZ1W7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| SPA `Events.tsx` (`ProfileTab`) | — | `miniapp/src/routes/Events.tsx` |

## Чек-лист готовности

- [x] `finish_lite` не показывает вопрос о рассылке: сразу финальная карточка
      без кнопок + билет вторым сообщением, сессия закрывается сентинелом
- [x] Таб «Профиль» показывает и позволяет включить/выключить
      `consent_marketing` независимо от регистрации на событие
- [x] `catalog/` совпадает с живым проектом
- [x] Валидация (`ap_validate_flow`), публикация, экспорт `flows/`, миграции
- [x] Офлайн-чекеры (`check-texts.py`, `check-commands.py`,
      `check-export-secrets.sh`), сборка Mini App
- [ ] Независимое ревью

## Как проверено

- **`reg-profile` живым прогоном на инстансе `events-dev`** (`ap_test_flow`,
  `{"data": {...}}`, гоча CLAUDE.md №13; `telegram_id: 888888888`,
  `callbackData: 'ob:register'`, `sessionDraft.step: 'ob_register'`,
  `eventId: 'evtest1'`):
  - `step_3` → `action: 'finish_lite'`;
  - `step_4` → `writeKind: 'finish_lite'`, `cardText` без строки-вопроса и
    без `replyMarkup`, `nextStep: ''`, `ticketText`/`ticketReplyMarkup`
    построены (кнопка «Открыть билет» на `#/ticket?event_id=evtest1` с
    `MINIAPP_URL` из переменной проекта);
  - `step_5` (ROUTER) → ветка `finish_lite` (`evaluation: true`);
  - `step_29` создал строку `registrations` (`evtest1-888888888`, `registered`);
  - `step_30` записал `sessions` сентинелом (`scenario: '-'`, `step: '-'`) —
    до отправки карточки, а не после;
  - `step_31`/`step_32` упали на `chat not found` (диагностический
    `telegram_id` не существует в Telegram) — ожидаемо для фейкового ID,
    подтверждает только доходимость до шага отправки. `step_33` (`send
    ticket`) в этом прогоне не выполнился: судя по трассе, `continueOnFailure`
    на `step_31` продолжает цепочку, только если её собственная
    `on_failure_branch` (`step_32`) не падает сама — двойной отказ (и edit,
    и фолбэк) останавливает прогон раньше, чем доходит до `step_33`. Тот же
    риск уже есть в `reg-consent-mkt/step_7→8/9` (эталон, с которого списан
    приём) и с реальным `chat_id` не воспроизводится: фолбэк `send_text_message`
    в реальный существующий чат почти всегда успешен. Структура (`step_33`
    как `nextAction` шага `step_31`, тот же `continueOnFailure`) сверена
    `ap_flow_structure` — побайтово тот же приём, что в `reg-consent-mkt`.
    Живой позитив с реальным `chat_id` — хвост на владельца (тот же уровень
    доказательности, что закрывал живые прогоны W32/W37 и другие).
  - Тестовые строки (`registrations` `evtest1-888888888`, `sessions`
    `telegram_id: 888888888`) удалены после прогона.
- **`reg-api`** — код `step_9`/`step_22`/`step_20`/`step_21`/`step_23`
  прочитан и проверен статически (симметричен уже работающему полю
  `consentValue`/`register`); живой прогон невозможен без валидной подписи
  `initData` (нужен реальный бот-токен и открытая Mini App) — тот же
  известный предел, что у всех прежних пакетов, трогавших `reg-api`
  (например W32, W50): требует `initData` от владельца.
- **Обе публикации** — `ap_validate_flow` зелёный (`reg-profile` 40/40,
  `reg-api` 24/24), `ap_lock_and_publish`, экспорт `ap_export_flow` сразу
  после публикации (снимок `LOCKED`, без правок после — гоча №14).
- **Офлайн**: `check-texts.py` — 25 флоу, 222 пары, 0 расхождений;
  `check-commands.py` — самопроверка ok, 0 нарушений; `check-export-secrets.sh`
  — чисто; `cd miniapp && npm ci && npm run build` — зелёно (tsc + vite).
- **`migrations`**: 2 строки (`reg-profile`/`reg-api`, `action: publish`,
  `version_id` из `flows/_manifest.json`, `commit: 07bcf8a`).

## Журнал

- **2026-09-20** — Пакет взят. Диагностика: `reg-profile/step_4` безусловно
  ставил `nextStep = 'await_marketing'` для `writeKind` `finish`/`finish_lite`,
  не проверяя, отвечал ли пользователь раньше. У этой сессии впервые за
  несколько пакетов есть рабочий MCP-доступ (`ap_list_tables` и др. отвечают),
  поэтому чиню напрямую, а не статическим разбором экспорта.
- **2026-09-20** — `reg-profile`: ветка `finish_lite` переписана в `step_4`
  (карточка без вопроса, `ticketText`/`ticketReplyMarkup` тем же приёмом, что
  `reg-consent-mkt/step_5`, требует `MINIAPP_URL` — добавлен во вход шага),
  `step_30` — сентинел `-`/`-` вместо `await_marketing` (тот же приём, что
  `declined`), старые фолбэк-шаги `step_33`/`step_34` (перезапись
  `cardMessageId` — больше не нужна, следующего колбэка нет) удалены
  `ap_delete_step` по одному от листа к корню, новый `step_33` («send
  ticket») добавлен `AFTER` на `step_31` — та же форма, что
  `reg-consent-mkt/step_7→step_9`. Первая попытка `ap_update_step` на
  `step_4` провалилась компиляцией: `sourceCode` был по ошибке передан как
  JSON-объект `{"code":...}` (форма `ap_read_step_code`), а не как чистый
  текст, которого просит `ap_update_step` — перевыпущено правильной формой.
- **2026-09-20** — `reg-api`: `step_9` (`profile_get`/`profile_save`) отдаёт
  и принимает `consentMarketing`, `step_22` пишет `consent_marketing`/
  `consent_marketing_at` (всегда, тем же приёмом, что и остальной код с
  PAR-2), `step_20`/`step_21`/`step_23` возвращают поле в теле ответа
  (`ap_update_step` заменяет вложенный объект `fields.body` целиком —
  отправлена полная карта, гоча CLAUDE.md №12).
- **2026-09-20** — Mini App: `ProfileTab` — чекбокс `reg.mkt.label`/
  `reg.mkt.hint` (переиспользованы ключи шита регистрации — то же согласие,
  тот же текст), `profileMkt` — отдельный `useState`, не часть объекта
  `profile`: тот же объект спредится в `sheetProf` шита регистрации, класть
  туда `mkt` было бы лишним полем не по месту. `npm run build` зелёный.
- **2026-09-20** — MCP-сервер платформы дважды на короткое время отключался
  и переподключался в процессе работы (видно по системным уведомлениям
  харнесса) — после каждого реконнекта `ap_validate_flow`/`ap_flow_structure`
  подтверждали, что состояние черновика не пострадало.
