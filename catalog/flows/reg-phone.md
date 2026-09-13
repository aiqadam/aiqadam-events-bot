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

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **DAT-2**: телефон сохраняется только из `request_contact` (`contactIsOwn=true`,
  то есть контакт принадлежит самому отправителю, а не переслан чужой).
  Любой другой апдейт (текст, команда) в этом состоянии — пропуск, без отдельной
  кнопки/ключа i18n.
- **QR не отправляется файлом** — кнопка `web_app` на `{{variables['MINIAPP_URL']}}ticket.html?event_id=...`,
  сам QR рисуется клиентским JS в Mini App из подписанного `payload`, который
  отдаёт `my-qr-api` (ADR-0007). `fn-sign-qr` здесь не вызывается — он не нужен:
  `eventId` уже известен, подпись нужна только внутри `my-qr-api`.
- **Пустая строка не очищает поле** ни в `tables-upsert-records`, ни в
  `tables-update-record` (`TEXT`, не только `DATE`). При пропуске (`phone`
  не указан) сессия закрывается сентинелом `-`, а не пустой строкой
  (см. `reg-consent-pdn.md`).
