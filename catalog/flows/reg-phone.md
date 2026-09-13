# Flow: reg-phone

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows : callableFlow` — вызывается из `tg-router`,
  когда `session.step = await_phone`
- **Назначение**: опциональный телефон (DAT-2) — контакт или пропуск. Прибирает
  ленту, замораживает карточку итогом и выдаёт **билет отдельным сообщением**.
- **Flow ID (MCP)**: `Cx7U4wKXLwmBCtb4FR5AW` · **externalId**: `vHduLOLdbcdT0wZDeexJx`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход: `telegramId`, `chatId`, `eventId`, `kind`, `contactPhone`, `contactIsOwn`, `sessionDraft`, `userMessageId` |
| step_1 | CODE «decide phone/skip + разбор draft» | `hasContact`, `phoneToSave`, `cardMessageId`, `promptMessageId`, `userMessageId` |
| step_2 | `tables-upsert-records users` | телефон, если он есть |
| step_5 | `tables-upsert-records sessions` | сессия закрыта сентинелом `-` |
| step_3 | `delete_message` (`continueOnFailure`) | убирает транзиентный вопрос о телефоне |
| step_4 | `delete_message` (`continueOnFailure`) | убирает ответ гостя (контакт или «Пропустить») |
| step_6 | `tables-find-records events` | название, дата, адрес для финальной карточки |
| step_7 | CODE «тексты: финальная карточка и билет» | два текста сразу |
| step_8 | `edit_message_text` (`continueOnFailure`) | карточка → итог диалога, кнопок нет |
| step_9 | `send_text_message` | **билет** + кнопка `web_app` на `ticket.html?event_id=…` |

## Зависимости

- **Таблицы**: `users`, `sessions` (запись), `events` (чтение)
- **Переменные**: `MINIAPP_URL`
- **Connections**: `AI Qadam Events (dev)` (`TZTlXaCEO2hEvimUowbSA`)

## Заметки

- **DAT-2**: телефон сохраняется только из `request_contact` и только свой
  (`contactIsOwn`), а не пересланный чужой. Любой другой апдейт — пропуск.
- **Билет уходит новым сообщением, а не редактированием карточки.** Правило
  ADR-0017: состояние диалога редактируется, факт, к которому вернутся,
  отправляется. Практический смысл — билет оказывается **внизу** ленты,
  а не наверху, где висит карточка начала диалога.
- **У финального редактирования нет ветки On failure, и это намеренно.**
  Если карточку не отредактировать, билет всё равно уходит и диалог завершён.
  Фолбэк нужен там, где диалог **продолжается**; на терминальном шаге он
  добавлял бы шум вместо надёжности.
- **Оба `delete_message` — с `continueOnFailure`.** Повторный прогон, уже
  удалённое сообщение или `message_id = 0` дают `400 «message to delete not
  found»`; это ожидаемо и не должно ронять выдачу билета. Бот удаляет и свои
  сообщения, и входящие сообщения гостя в личном чате.
- **QR не отправляется файлом** (ADR-0007) — рисуется клиентским JS в Mini App
  из подписанного payload, который отдаёт `my-qr-api`.
- **Пустая строка не очищает поле** ни в `tables-upsert-records`, ни в
  `tables-update-record`. Сессия закрывается сентинелом `-`, а не пустой строкой.
