# Flow: event-wizard-field

- **Статус**: ENABLED (published)
- **Триггер**: `callableFlow` — вызывается из `tg-router` (`route: wiz_field`,
  текстовый ответ при активной сессии `event_create`/`event_edit` и
  `sessions.step` одно из `title`/`description`/`address`/`starts_at`/`ends_at`/`reg_deadline_at`)
- **Назначение**: **ядро [ADR-0016](../../docs/adr/0016-shared-flow-for-same-shaped-touches.md)** —
  один флоу на все шесть структурно одинаковых полей визарда вместо шести
  флоу-копий. Ветвится не по тому, какой вопрос, а по смыслу ответа (валиден/невалиден/это
  последнее поле), как того требует ADR-0015.
- **Flow ID (MCP)**: `iOtIXWIIX1lgtz6RQUPVN` · **externalId**: `LzaoK8PdbMq5wOvt68pxc`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `callableFlow` | приём вызова |
| step_1 | CODE «validate + advance» | таблица правил по `sessionStep` (см. ниже); валидация, обновление `draft`, решение `outcome` |
| step_2 | ROUTER: `error`/`next`/`Otherwise` (=preview) | |
| step_3 (error) | `send_text_message` | текст ошибки валидации, сессия не двигается — участник отвечает на тот же вопрос |
| step_4 (next) | `tables-upsert-records sessions` | `draft`, `step=nextStep` |
| step_6 | `send_text_message` | следующий вопрос цепочки |
| step_5 (preview, Otherwise) | `tables-upsert-records sessions` | `draft`, `step='preview'` |
| step_7 | `send_text_message` | сводка черновика + inline-кнопки «Опубликовать»/«Отмена» (`wiz:publish`/`wiz:cancel`) |

### Таблица полей (`step_1`, CODE)

| `sessionStep` | Валидация | `nextStep` |
|---|---|---|
| `title` | 2–200 символов | `description` |
| `description` | без валидации, `"-"` → `''` (пропуск) | `photo` (передаёт эстафету `event-wizard-photo`) |
| `address` | 2–300 символов | `geo` (эстафета `event-wizard-geo`) |
| `starts_at` | формат `ДД.ММ.ГГГГ ЧЧ:ММ`, Asia/Tashkent → UTC, **должно быть в будущем** | `ends_at` |
| `ends_at` | то же + должно быть позже `starts_at` | `reg_deadline_at` |
| `reg_deadline_at` | то же + не позже `starts_at` + **должно быть в будущем** | `preview` (исход `Otherwise`/preview) |

## Зависимости

- **Таблицы**: `sessions` (`toTKgngMTqDNJWDpQMh4d`)
- **Флоу**: вызывается из `tg-router`; сам никого не вызывает (эстафета
  `photo`/`geo` идёт через `sessions.step`, а не `callFlow` — маршрутизация
  следующего касания решается заново в `tg-router`)
- **Переменные**: —
- **Connections**: `AI Qadam Events (dev)`

## Заметки

- **Тексты — через `inputs.texts`**, не литералом в коде (ADR-0014); значения сверены с `i18n/ru.json`, механизм — [`ru-texts.md`](../snippets/ru-texts.md).
- **Почему один флоу, а не шесть**: пять из шести полей отличаются только
  тем, *какой* валидатор и *какой* следующий вопрос — само устройство касания
  (текстовое сообщение → провалидировать → записать → спросить дальше)
  идентично. ADR-0015 велит одно касание = один флоу, но здесь касания
  структурно одинаковы; ADR-0016 разрешает такой случай делить один флоу
  с диспетчеризацией по `session.step` внутри одного CODE-шага, а не
  плодить копии.
- **Даты — Asia/Tashkent на входе, UTC в хранении (OWN-3)**: парсер в CODE
  вручную конвертирует `ДД.ММ.ГГГГ ЧЧ:ММ` через `Date.UTC(...,
  minute - 300)` (300 = 5ч смещения Ташкента, без DST). `Intl.DateTimeFormat`
  с `timeZone: 'Asia/Tashkent'` используется в обратную сторону — для
  сборки текста превью.
- **`preview` не отдельный флоу** — сборка превью естественно продолжает
  обработку последнего поля (`reg_deadline_at`) тем же CODE-шагом; отдельный
  флоу добавил бы касание там, где реального нового вопроса пользователю нет.
- **`starts_at`/`reg_deadline_at` в прошлом отклоняются** (`wizard.err.starts_at_past`/
  `wizard.err.deadline_past`), а не создают неработающий ивент: без этой
  проверки визард молча пропускал прошедшую дату дальше, и созданный ивент
  либо сразу отдавал участнику `reg.deadline_passed`, либо (для `starts_at`)
  никогда не появлялся в разделе «будущие» списка (PAR-3). `ends_at` такой
  проверки не требует — уже покрыт условием «позже `starts_at`».
