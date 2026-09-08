# Flow: fn-t

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-subflows / callableFlow` (mode `advanced`)
- **Назначение**: перевод по ключу i18n из таблицы `strings` с подстановками (I18N-2).
- **Flow ID (MCP)**: `f8ZRXjQ2Ndk88lMlMOv1i` · **externalId (для `callFlow`)**: `kMAFskaHsm5S1jSfH0Kya`

## Контракт

**Вход:**

| Поле | Тип | Смысл |
|------|-----|-------|
| `key` | string | один ключ |
| `keys` | string[] \| «a,b,c» | несколько ключей за один вызов |
| `lang` | `ru` \| `uz` \| `en` | неизвестное значение → `ru` |
| `vars` | object | общие подстановки `{name}` |
| `varsByKey` | object | подстановки для конкретного ключа, **перекрывают** `vars` |

`key` и `keys` можно передавать вместе; порядок результата — `key`, затем `keys`,
дубликаты убираются.

**Выход:** `{ lang, text, texts, resolvedLang, missing, fellBack, keys }`

- `text` — перевод **первого** ключа (совместимость с вызовом на один ключ);
- `texts[key]` — перевод каждого ключа;
- `resolvedLang[key]` — на каком языке нашлось (`''` = не нашлось);
- `missing` — ключи, для которых вернулся сам ключ;
- `fellBack` — ключи, отданные из `ru` вместо запрошенного языка.

**Порядок разрешения** (I18N.md): `(key, lang)` → `(key, 'ru')` → сам `key` как текст.

## Шаги

| Step | Piece / Action | Назначение | Ключевые inputs / refs |
|------|----------------|-----------|------------------------|
| trigger | `@aiqadam/qadam-subflows : callableFlow` | вход subflow'а | — |
| step_1 | CODE «normalize keys» | список ключей, язык, строка для фильтра `in` | `{{trigger['output'].data.key}}`, `...keys`, `...lang` |
| step_2 | `@aiqadam/qadam-tables : tables-find-records` | `strings` по `key in (...)`, `limit 200` | `table_id` = `qi6bBTL7plRGBgFUfli8w`, поле `key` (externalId `xpNgdNnrNy0iftelqDjeN`), `value` = `{{step_1['output'].queryList}}` |
| step_3 | CODE «resolve + substitute» | язык → фолбэк → ключ; подстановка `{var}` | `records` = `{{step_2['output']}}`, `vars`/`varsByKey` из trigger |
| step_4 | `@aiqadam/qadam-subflows : returnResponse` | ответ | `{{step_3['output']}}` |

## Зависимости

- **Таблицы**: `strings` (наполняет `i18n-sync`, пакет W3) · **Переменные**: — · **Connections**: —

## Заметки

- **Один запрос на любое число ключей** — фильтр `in` с запятыми, а не N выборок.
  Отсюда ограничение: **ключ не может содержать запятую** — такой ключ молча
  выбрасывается из запроса и попадёт в `missing`.
- **Пустой список ключей валит шаг**: `The "in" operator on field "key" requires at
  least one value`. Строка из пробела не помогает — обрезается. Поэтому сентинел
  `!no-key`: `!` невозможен в ключе i18n, выборка гарантированно пуста, ответ — `text: ''`.
- **`varsByKey` нужен из-за реального набора строк W3**: `event.card.when`,
  `event.card.ends` и `event.card.deadline` все используют `{when}`, но с разным
  значением. Один вызов с общими `vars` их различить не может.
- **Отсутствующий перевод отдаёт сырой ключ, а не пустоту** — на экране это видно,
  и `missing` даёт вызывающему шанс не рисовать элемент вовсе (так делает
  `fn-event-card` с подписями кнопок).
- **Дубли `(key, lang)` БД не запрещает** (ADR-0003): берётся первая непустая строка
  выборки. Проверено практикой: собственные фикстуры W2 легли рядом со строками
  `i18n-sync` и не вытеснили их.
- Источник правды строк — `i18n/{ru,uz,en}.json` в репозитории; таблица — рабочая копия.
  Правка в таблице живёт до следующего `i18n-sync`.
