# Flow: fn-event-card

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: карточка ивента — локализованный текст, параметры `sendVenue` и ссылка
  на Я.Карты из `lat`/`lon` (OWN-2).
- **Flow ID (MCP)**: `L1l2LOngDtxPHFSdRp5fE` · **externalId (для `callFlow`)**: `PR1wt0HDy0wih7gAT1OaD`

## Контракт

**Вход:** `{ eventId: string, lang?: 'ru'|'uz'|'en' }`

**Выход (главное):**

| Поле | Смысл |
|------|-------|
| `found` | ивент найден; при `false` `text` = перевод `event.card.not_found` |
| `text`, `lines` | готовый текст карточки и его строки |
| `parseMode` | всегда `''` — карточку слать **без разметки** |
| `venue` | `{latitude, longitude, title, address}` для `sendVenue` или `null` |
| `mapsUrl` | ссылка на Я.Карты, собранная из `lat`/`lon` |
| `buttons`, `labels` | inline-кнопки и их подписи — **только если ключи подписей есть в `strings`** |
| `registerDeepLink` | `https://t.me/<BOT_USERNAME>?start=e<eventId>` |
| `startsAtFmt`, `endsAtFmt`, `regDeadlineAtFmt` | ташкентское время (через `fn-fmt-time`) |
| `startsAt`, `endsAt`, `regDeadlineAt`, `status`, `capacity`, `overbookPct`, `photoFileId` | сырые поля для логики вызывающего |
| `missing` | ключи i18n, которых не нашлось |

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize input» | форма `eventId`, язык, сентинел `-` | `{{trigger['output'].data.*}}` |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | `events` по `id`, `limit 5` | `table_id` = `kVLg1FSfDBtsP32FGPk3P` |
| step_3 | CODE «extract event fields» | плоские поля, `mapsUrl`, deep link | `{{step_2['output']}}`, `{{variables['BOT_USERNAME']}}` |
| step_4 | `callFlow → fn-fmt-time` | `starts_at`, `format = datetime` | `{{step_3['output'].startsAt}}` |
| step_5 | `callFlow → fn-fmt-time` | `ends_at`, `format = time` | `{{step_3['output'].endsAt}}` |
| step_6 | `callFlow → fn-fmt-time` | `reg_deadline_at`, `format = datetime` | `{{step_3['output'].regDeadlineAt}}` |
| step_7 | `callFlow → fn-t` | 10 ключей одним вызовом, `varsByKey` для `{when}` | `{{step_4/5/6['output'].data.text}}` |
| step_8 | CODE «assemble card» | сборка строк, кнопок, venue | `{{step_3['output']}}`, `{{step_7['output']}}` |
| step_9 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_8['output']}}` |

## Зависимости

- **Subflow'ы**: `fn-fmt-time` (`4SXvBYqphN7BxwtS1CvBt`), `fn-t` (`kMAFskaHsm5S1jSfH0Kya`)
- **Таблицы**: `events` (и `strings` косвенно через `fn-t`)
- **Переменные**: `BOT_USERNAME` · **Connections**: —

## Ключи i18n

Используются существующие ключи W3: `event.card.header`, `event.card.description`,
`event.card.when`, `event.card.ends`, `event.card.where`, `event.card.deadline`,
`event.card.map_link`.

Дополнительно запрашиваются и **пока отсутствуют** в `strings`:
`event.card.btn_map`, `event.card.btn_register`, `event.card.not_found`.
Пока их нет — `buttons` и `labels` пустые, а `text` при `found: false` показывает
сырой ключ. Как только W3 добавит их в `i18n/*.json`, кнопки появятся сами,
без правки флоу.

Ключи `event.card.seats_left`, `event.card.seats_unlimited`, `event.card.status`
сознательно **не** используются: свободные места считаются с овербукингом по
`registrations` (OWN-15, W5), а `status` нуждается в переводе значения — это дело
вызывающего флоу, а не карточки.

## Заметки

- **`{when}` в трёх ключах означает три разных времени**, поэтому `fn-t` вызывается
  с `varsByKey`: `event.card.when` → начало, `event.card.ends` → конец,
  `event.card.deadline` → дедлайн. Без этого все три показали бы одно значение.
- **Строк UI в коде нет** (I18N-2): Code step склеивает готовые переводы и контент
  ивента (`title`/`description`/`address` — данные, а не интерфейс).
- **`parseMode: ''` — требование безопасности, а не стиль.** `title`/`description`
  вводит owner; с `Markdown`/`HTML` его текст может сломать сообщение или подделать
  его вид. Кто будет слать карточку — обязан либо не задавать `parse_mode`, либо
  экранировать сам.
- **Ссылка на Я.Карты не хранится** (OWN-2), собирается как
  `https://yandex.uz/maps/?ll=<lon>%2C<lat>&z=17&pt=<lon>%2C<lat>`; при отсутствии или
  некорректных `lat`/`lon` (`NUMBER` читается строкой, пустое — `''`, а не `0`)
  ни ссылки, ни `venue` не будет.
- **Флоу небыстрый: 12–13 с на прогон** при том, что все шаги вместе — около 2 с.
  Разница — накладные расходы четырёх вложенных `callFlow`. Для `checkin-api`
  (`TRIGGER_TIMEOUT_SECONDS = 60`) карточка не нужна, но в синхронный вебхук
  такую цепочку закладывать нельзя без замера.
- Отрицательный сценарий проверен: несуществующий `eventId` → `found: false`,
  ни `venue`, ни кнопок, прогон не падает.
- **Авторизации и гейта по `status` здесь нет — и это обязанность вызывающего.**
  Карточка рисуется для ивента в **любом** статусе, включая `draft` и `cancelled`:
  `step_2` фильтрует только по `id`. А `events.id` — короткий slug (≤12 символов,
  `A-Za-z0-9_`), то есть угадываемый. Вызывающий, забывший проверить
  `status = 'published'` (или `owner_id` для режима правки), покажет посторонним
  чужой черновик. `status` и `owner_id` возвращаются наружу именно для этой проверки,
  а не «на всякий случай».
- **Пока в `strings` нет ключа `event.card.not_found`, эту функцию нельзя ставить
  в пользовательский путь**: при `found: false` в `text` уедет сырой ключ, и его
  увидит человек. Как разовый фолбэк это допустимо по [I18N.md](../../docs/I18N.md),
  но показывать его участнику — нет.
