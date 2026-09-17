# Flow: bcast-run

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` — зовёт `bcast-step`
  (кнопка «Отправить») и сам себя (следующий чанк); payload
  `{broadcastId, phase: 'start'|'send', chatId, telegramId}`
- **Назначение**: чанкованный прогон рассылки по 30 получателей с курсором
  (`FLOW_TIMEOUT_SECONDS = 600`), ретраями `429`/`403` и отчётом автору
  ивента (OWN-11, OWN-12, Q18).
- **Flow ID (MCP)**: `ABjmnym2NRGldfGeHoGbN` · **externalId**: `uRUDWnYt303De2TuziKm4`

## Фазы

- `start`/`materialize` (`status='draft'`): серверные гейты (`test_sent_at`,
  сегмент, время `no_show`) → снимок сегмента в `broadcast_targets`
  (`state='pending'`, ключ `broadcast_id+telegram_id`) → `status='running'`,
  `total`, `started_at` → `bcast.started` → самовызов `phase='send'`.
  Пустой сегмент закрывается сразу (`done`, отчёт `bcast.empty_segment`).
- `send` (`status='running'`, новая или повторная — resume): чанк ≤30
  `pending` → цикл (пауза 1 с → отправка → классификация → пометка) →
  пересчёт итогов из состояний → `sent/failed_count/cursor` → pending
  остались → самовызов, иначе `done` + отчёт автору.
- `stop`: `done`/`failed`/пустая строка/провал гейта — тихо или с уведомлением
  инициатору (`needNotify`).

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | `{broadcastId, phase, chatId, telegramId}` |
| step_1→2 | `find broadcasts`, CODE «run context» | `{found, bid, eventId(EventIdOrNone), status}` |
| step_3→4 | `find events`, CODE «decide phase» | `materialize`/`send`/`stop` + серверные гейты OWN-10 и `no_show`-времени |
| step_5 | ROUTER `by action` | `materialize` / `send` / `Otherwise` |
| step_6→8 | ROUTER + `send_text_message` + CODE | ветка `stop`: уведомление или тихий лог |
| step_9→12 | `find` ×3 + CODE | ветка `materialize`: регистрации, consent-база, `memberCsv`, `users in-csv` |
| step_13 | CODE «assemble members» | список по правилу превью (`attended`-множество, дедуп, минус `blocked_bot`); `startedText`, `nowIso` |
| step_14 | ROUTER `empty segment?` | |
| step_15→18 | `upsert broadcasts`, `find events`, CODE, `send_text_message` | пустая ветка: `done`/нули, отчёт `bcast.empty_segment` автору (`events.staff_id`) |
| step_19→21 | `upsert broadcasts`, LOOP, `upsert targets` | `running`/`started_at`/`total`; по одному `pending`-таргету на получателя |
| step_22→23 | `send_text_message`, `callFlow self` | `bcast.started` инициатору; самовызов `phase='send'` очередью |
| step_24→25 | `find pending chunk`, CODE «prep chunk» | ≤30 `pending`, `unsubMarkup` в каждое сообщение |
| step_26 | LOOP `per recipient` | |
| step_27→29 | `delay 1s`, `send_text_message` (`continueOnFailure`), CODE «classify send» | темп ~1 msg/s (замер Q13); разбор конверта ошибки `{message: <JSON>}` |
| step_30 | ROUTER `send outcome` | `sent` / `blocked` / `failed` / `retry429` / иначе-`failed` |
| step_31 | `update-record` | `sent` + `sent_at` |
| step_32→33 | `upsert users`, `update-record` | `blocked_bot='true'` + таргет `blocked` + текст ошибки |
| step_34 | `update-record` | таргет `failed` + текст ошибки |
| step_35→37 | `delay retry_after`, `send` (`continueOnFailure`), CODE «classify resend» | `429`: пауза ровно на `retry_after` (кламп 1…300, дефолт 60) + 1 повтор |
| step_38 | ROUTER `resend outcome` | `sent2` / `blocked2` / иначе-`failed2` |
| step_39→42 | `update-record` / `upsert`+`update` / `update-record` | пометки повтора |
| step_43 | `update-record` | недостижимый фолбэк `Otherwise` (классификатор исчерпывающий) |
| step_44→46 | `find all targets`, CODE «chunk totals», `upsert broadcasts` | итоги чанка **из состояний** (`sent/failed/pending`), `cursor = sent+failed` |
| step_47 | ROUTER `more pending?` | |
| step_48 | `callFlow self` | следующий чанк очередью |
| step_49→52 | `upsert broadcasts`, `find events`, CODE, `send_text_message` | `done` + `finished_at`; отчёт автору (`bcast.finished` / `bcast.empty_segment`) |

## Зависимости

- **Таблицы**: `broadcasts` (`XrygYF5Q4EUOKkaBFallb`), `broadcast_targets`
  (`PAH81WchbaOixGXSdFBK1`), `registrations` (`SM8tMxfQuQCHRDdAiNJyQ`),
  `users` (`xHhYjhwqKdONkrYJGcBsz`), `events` (`R4aSQpLZvw7d3u6DVOSjH`)
- **Флоу**: зовётся из `bcast-step`; самовызов очередью (`executionMode: queue`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Источник правды — `state` таргета, курсор — производная.** Прерванный
  прогон продолжается с `pending` (никому дважды не шлёт); повторный запуск
  бегущей рассылки — resume, не дубль. Параллельные цепочки одного `bid`
  сознательно не сериализуются (примитивов нет, ADR-0003): защита от дублей
  держится на последовательных рестартах, которые и проверены.
- **Ошибка шага отправки приходит конвертом `{message: '<JSON>'}`**, а не
  объектом: классификатор сначала разворачивает `message`. Без развёртки
  `status` читался 0, а в `error` ложился сырой конверт.
- **Ключи `values` — только `externalId`.** Внутренний field id платформа
  молча дропает из записи (без ошибки валидации и прогона): так были потеряны
  `status`/`total`/`sent`/`error` до живого различающего прогона. Проверяется
  чтением строки после записи, а не `ap_validate_flow`.
- **Параллельные правки одного флоу через MCP гонят**: два одновременных
  `ap_update_step` на один флоу теряют одну из правок (проверено на `step_34`).
  Править один флоу строго последовательно.
- **`input.nowIso: "unused"` у `step_13`** — остаток неудалённого входа
  (подключевой мерж не умеет удалять, гоча 12). Рантайм его игнорирует.
- **Темп**: `delay 1s` + ~0,7–0,9 с отправки ≈ 1 msg/s (замер Q13, SPEC OWN-11).
  Чанк 30 ≈ 60–90 с — с запасом под `FLOW_TIMEOUT_SECONDS = 600`.
- **Отчёт автору (`events.staff_id`) — всегда** (Q18, вариант 1): успех
  (`sent/failed`), пустой сегмент, остановка гейтом. Прогресс-карточка не
  редактируется (лишние отправки).
- **Кнопка отписки — в каждом массовом сообщении** (OWN-13), включая тест:
  колбэк `bcast:unsub:<bid>` ведёт в `bcast-unsub`.
