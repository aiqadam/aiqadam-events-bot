# Flow: fn-fmt-time

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: ISO-время UTC → строка в `Asia/Tashkent` на языке пользователя (OWN-3).
- **Flow ID (MCP)**: `5Hctxr9SnbhxGxow0Xgxu` · **externalId (для `callFlow`)**: `4SXvBYqphN7BxwtS1CvBt`

## Контракт

**Вход:** `{ iso: string, lang?: 'ru'|'uz'|'en', format?: 'datetime'|'date'|'time' }`

**Выход:** `{ valid, error, text, date, time, datetime, iso, epochMs, tz, lang }`

- `text` = `date` при `format = 'date'`, `time` при `'time'`, иначе `datetime`;
- `error`: `''` \| `empty` \| `bad_date`;
- `tz` всегда `Asia/Tashkent`; неизвестный `lang` молча становится `ru`.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «format» | `Intl.DateTimeFormat` | `iso`/`lang`/`format` ← `{{trigger['output'].data.*}}` |
| step_2 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_1['output']}}` |

## Зависимости

- **Таблицы**: — · **Переменные**: — · **Connections**: —

## Заметки

- Ручного расчёта смещения UTC+5 нет: в песочнице полный ICU, `Asia/Tashkent` и `uz-UZ`
  работают. Локали: `ru → ru-RU`, `uz → uz-UZ`, `en → en-US`.
- **Строка без суффикса зоны дополняется `Z`.** `DATE` в Tables — это текст, и запись
  без зоны иначе трактовалась бы как локальное время песочницы. Смещение вида `+05:00`
  сохраняется и учитывается.
- Формат даты не хардкодится в i18n-строках (I18N.md): строки получают уже готовое
  `{when}`/`{time}`.
- Часы — `hourCycle: h23`, поэтому `13:42` не превращается в `1:42 PM` даже в `en`.
