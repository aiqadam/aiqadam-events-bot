# Flow: my-regs

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`
  на команду `/myregs` (ADR-0015: касание = один вход)
- **Назначение**: мои регистрации (PAR-4) — список с QR-кнопками и кнопками
  отмены там, где отмена ещё доступна.
- **Flow ID (MCP)**: `R3KaUIk4M9e01npCxeu3n` · **externalId**: `K4RS16MdhW0pf8UnYZueu`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `callbackData`, `callbackQueryId` | — |
| step_1 | `answer_callback_query` (`continueOnFailure`) | ack — падает на пустом `callback_query_id` при входе командой, это ожидаемо | `{{trigger['output'].data.callbackQueryId}}` |
| step_2 | `tables-find-records registrations` | мои регистрации (`telegram_id eq …`, проекция `event_id`, `status`, `checked_in_at`, `registered_at`), `limit 50` | `{{trigger['output'].data.telegramId}}` |
| step_3 | `tables-find-records events` | опубликованные ивенты для названий и дат (проекция `id`, `title`, `starts_at`, `status`), `limit 50` | фильтр `status eq published` |
| step_4 | CODE «render my regs» | джойн по `event_id`, статусные подписи, кнопки: QR (`web_app`) + отмена только при `now < starts_at` | `{{step_2['output']}}`, `{{step_3['output']}}`, `{{variables['MINIAPP_URL']}}`, `texts: myreg.*, reg.qr.button` |
| step_5 | `send_text_message` | список (пустой `reply_markup` не отправляется вовсе) | `{{step_4['output'].text}}`, `{{step_4['output'].reply_markup}}` |

## Зависимости

- **Таблицы**: `registrations`, `events` (чтение)
- **Переменные**: `MINIAPP_URL` (кнопка QR)
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **Статусная подпись:** `cancelled` → «отменена»; иначе непустой
  `checked_in_at` → «был на ивенте»; иначе «зарегистрирован». Источник истины —
  поле `status`, не `cancelled_at` (его нельзя очистить, см. DATA-MODEL).
- **Кнопка отмены рисуется только при `now < starts_at`.** Это видимая часть
  PAR-5; серверная проверка живёт в `my-reg-cancel` (`cancel.too_late`) и
  прикрывает гонку между показом списка и нажатием.
- **QR — `web_app`-кнопкой** на `ticket.html?event_id=…`, как в `reg-phone`
  (ADR-0007 — QR не отправляется файлом). У отменённых строк кнопок нет вовсе.
- **Проекция обязана покрывать не только фильтр, но и любое поле, которое
  читает код.** `step_3` отдаёт `status`, потому что постфильтр
  `status = published` читает его же; `step_2` отдаёт `registered_at`,
  потому что по нему схлопываются дубли. Отсутствующая колонка не валит шаг:
  поле приезжает пустым, и отбор молча вырождается (все строки выброшены
  постфильтром / порядок дублей становится произвольным).
- **Тексты — во входе `texts`** (ADR-0014); значения сверены с `i18n/ru.json`.
- Дубли на `(event_id, telegram_id)` схлопываются до самой ранней по
  `registered_at` — канон ADR-0003 (как `fn-find-registration`), а не до первой
  в порядке выдачи таблицы, у которой порядка нет.
