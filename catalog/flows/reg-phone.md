# Flow: reg-phone

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_phone`
- **Назначение**: опциональный телефон (DAT-2) — контакт или пропуск (любой
  другой апдейт), затем выдача ссылки на QR через Mini App и завершение визарда.
- **Flow ID (MCP)**: `Cx7U4wKXLwmBCtb4FR5AW`

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `eventId`, `kind`, `contactPhone`, `contactIsOwn` | — |
| step_1 | CODE «decide phone/skip» | `hasContact = kind=='contact' && contactIsOwn`; `phoneToSave`/`textKey` | |
| step_2 | `tables-upsert-records users` | `phone = phoneToSave` (пусто при пропуске — платформа не пишет пустую строку поверх старой, но для новой строки это и есть «нет телефона», см. заметку) | |
| step_3 | CODE `reg.phone.saved`/`reg.phone.skipped` | | |
| step_4 | `send_text_message` | подтверждение + кнопка `web_app` на `ticket.html?event_id=<eventId>` (ADR-0007 — QR не файлом) | |
| step_5 | `tables-upsert-records sessions` | `scenario='-'`, `step='-'` — визард завершён | |

## Зависимости

- **Таблицы**: `users`, `sessions`
- **Переменные**: `MINIAPP_URL`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **DAT-2**: телефон сохраняется только из `request_contact` (`contactIsOwn=true`,
  то есть контакт принадлежит самому отправителю, а не переслан чужой).
  Любой другой апдейт (текст, команда) в этом состоянии — пропуск, без отдельной
  кнопки/ключа i18n.
- **QR не отправляется файлом** — кнопка `web_app` на `{{variables['MINIAPP_URL']}}ticket.html?event_id=...`,
  сам QR рисуется клиентским JS в Mini App из подписанного `payload`, который
  отдаёт `my-qr-api` (ADR-0007). `fn-sign-qr` здесь не вызывается — он не нужен:
  `eventId` уже известен, подпись нужна только внутри `my-qr-api`.
- **Открытие W26: пустая строка не очищает поле** ни в `tables-upsert-records`,
  ни (по прежним записям) в `tables-update-record` — не только для `DATE`,
  как считалось раньше, но и для `TEXT`. Для сессии это значит: «очистка»
  через `''` не работает, нужен сентинел `-` (см. `reg-consent-pdn.md`,
  тот же фикс применён здесь).
- **Проверено 2026-09-13, реальная доставка в Telegram владельца (`322876545`)**:
  контакт (`qKa1ABREtWMixGIQMuBbd`) — `phone` сохранён, сообщение
  «Номер сохранён.» + кнопка QR доставлены; пропуск
  (`LoA4qyda2eGgpggfqEQY6`) — «Хорошо, без номера.» + та же кнопка, `phone`
  не тронут (см. заметку выше про пустую строку).
