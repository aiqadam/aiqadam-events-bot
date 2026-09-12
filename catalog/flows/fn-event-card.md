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
| `status`, `ownerId`, `chapterId` | **чем вызывающий делает гейт** — карточка сама не авторизует |
| `startsAtFmt`, `endsAtFmt`, `regDeadlineAtFmt` | ташкентское время (через `fn-fmt-time`) |
| `startsAt`, `endsAt`, `regDeadlineAt`, `capacity`, `overbookPct`, `photoFileId` | сырые поля для логики вызывающего |
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

Все десять запрашиваемых ключей **есть в `strings` во всех трёх языках** (W3 залил
их 2026-09-08): `event.card.header`, `event.card.description`, `event.card.when`,
`event.card.ends`, `event.card.where`, `event.card.deadline`, `event.card.map_link`,
`event.card.btn_map`, `event.card.btn_register`, `event.card.not_found`.

Проверено прогонами `I9WYG1H88Xq2kTqtawg4u` (ru) и `aqYwbQZPH8Vjfmbw4NJtY` (uz):
`missing: []`, `buttons` содержит две кнопки («Открыть на карте» и
«Зарегистрироваться»), а при `found: false` в `text` уходит человеческая строка
(`Kartochkani koʻrsatib boʻlmadi: bunday tadbir yoʻq.`), а не сырой ключ.
Прежнее ограничение «функцию нельзя ставить в пользовательский путь» снято.

Механика `has()` остаётся: если ключ однажды исчезнет из `strings`, кнопка
не нарисуется вовсе — вместо кнопки с ключом вместо подписи.

Ключи `event.card.seats_left`, `event.card.seats_unlimited`, `event.card.status`
сознательно **не** используются: свободные места считаются с овербукингом по
`registrations` (OWN-15, W5), а `status` нуждается в переводе значения — это дело
вызывающего флоу, а не карточки.

## Заметки

- **Три вызова `fn-fmt-time` свёрнуты в один батч** (12.09.2026, W20/[Q28](../../docs/OPEN-QUESTIONS.md#q28)).
  `step_4` передаёт карту `{starts, ends, deadline}` и получает `data.texts.*`;
  `step_5`/`step_6` удалены. Шагов 10 → 8, вызовов subflow 4 → 2,
  прогон 6,7 с → **4,5 с** (`g4z9XAJENujsa2F9ZN9ra`).
  Причина — [Q28](../../docs/OPEN-QUESTIONS.md#q28): вызов `callFlow` стоит
  1,2–1,9 с даже inline, а тело `fn-fmt-time` — миллисекунды.
- **Три ключа карточки используют один плейсхолдер `{when}`** —
  `event.card.when`, `event.card.ends`, `event.card.deadline`. Различаются они
  только через `varsByKey` у `fn-t` (`step_7`), который перекрывает общие
  подстановки для конкретного ключа. Тронешь `varsByKey` — все три времени
  станут одинаковыми, и ни один тест на «сообщение отправилось» этого не поймает.

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
- **W17 (2026-09-11) — `step_4`/`step_5`/`step_6`/`step_7` (все четыре вложенных
  `callFlow`) переведены на `executionMode: "inline"`** ([qadam-flow#363](https://github.com/aiqadam/qadam-flow/issues/363),
  раскатано на инстансе): ребёнок исполняется в engine-процессе родителя, без
  BullMQ-джобы/снапшота/waitpoint-резюма. Было 12–13 с на прогон при ≈2 с суммы
  шагов (накладные расходы четырёх хопов ≈10–11 с) — после публикации прогон
  `82VoWEXcjRZJKSaD6aQlP` (TESTING, `eventId: "demo"`) дал 6,7 с при сумме шагов
  ≈6,6 с: «пауза» упала почти до нуля. Подробности и метод — [W17](../../docs/work/W17-inline-callflow.md),
  [ADR-0009](../../docs/adr/0009-hot-path-latency-budget-and-order.md).
- Отрицательный сценарий проверен: несуществующий `eventId` → `found: false`,
  ни `venue`, ни кнопок, прогон не падает.
- **Авторизации и гейта по `status` здесь нет — и это обязанность вызывающего.**
  Карточка рисуется для ивента в **любом** статусе, включая `draft` и `cancelled`:
  `step_2` фильтрует только по `id`. А `events.id` — короткий slug (≤12 символов,
  `A-Za-z0-9_`), то есть угадываемый. Вызывающий, забывший проверить
  `status = 'published'` (или `ownerId` для режима правки), покажет посторонним
  чужой черновик.
  **`status`, `ownerId` и `chapterId` действительно возвращаются наружу** —
  проверено прогоном `I9WYG1H88Xq2kTqtawg4u`: `ownerId: "999000111"`.
  На первом ревью этот абзац обещал `owner_id`, которого в выходе не было; поле
  добавлено в `step_3` и `step_8` по замечанию A второго ревью. Обещать
  вызывающему поле, по которому он построит гейт, и не отдавать его — хуже, чем
  честно написать «проверяй сам».
