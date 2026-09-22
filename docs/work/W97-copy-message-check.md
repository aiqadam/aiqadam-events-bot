# W97. Копирование сообщения с фото (copyMessage)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: Phase 0 ([issue #149](https://github.com/aiqadam/aiqadam-events-bot/issues/149))
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Выяснить, может ли платформа скопировать сообщение с фото (`copyMessage`)
и что переживает копию. Разблокирует #131 (анонс спикера с фото), #132, #147.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| — (эксперимент через `ap_run_action`, временного флоу не потребовалось) | — | — |

Отличие от плана issue: вместо временного флоу `tmp-copy-test` все вызовы
сделаны через `ap_run_action` (`custom_api_call`, `send_text_message`) —
одноразовые прогоны действий не создают флоу и не требуют записи в
`migrations`. Живых флоу (`bcast-*`, `tg-router`) не трогал.

## Чек-лист готовности

- [x] Все 7 пунктов отвечены
- [x] Временных артефактов не осталось (флоу не создавался), `migrations` не требуется
- [ ] #131 обновлён по выводу
- [ ] `catalog/` совпадает с живым проектом

## Ответы (#149)

1. **Действие копирования в piece.** `copy_message` в
   `@aiqadam/qadam-telegram-bot` **нет**. Есть `forward_message` (форвард),
   `send_media` (caption + `format` + `reply_markup`), `send_media_group` и
   `custom_api_call` — произвольный вызов Bot API. Копирование делается
   `custom_api_call` (`/copyMessage`, `/copyMessages`).
2. **Прямой вызов Bot API.** Работает. `custom_api_call` подставляет токен из
   connection сам (проверено `GET /getMe`), тело — `{"data": {…}}`
   (обязательная обёртка DYNAMIC-пропа `body`). `http : send_request` с
   `{{variables['BOT_TOKEN']}}` тоже сработал бы, но вписывает токен в URL
   шага и прогонные логи (ADR-0005) — для `copyMessage` не нужен.
3. **Что переживает копию** (`copyMessage` 2533/2549/2551 → 2534/2550/2552):
   фото ✅, caption ✅, **жирный** ✅, ссылка под словом (`text_link`) ✅.
   Ссылка-превью отдельно не проверялась (в тесте была `text_link`-сущность,
   а не голый URL).
4. **Кнопка на скопированном фото — по умолчанию теряется.** `copyMessage`
   без параметра `reply_markup` снял инлайн-клавиатуру (2533 → 2534, 2551 →
   2552: фото/текст на месте, кнопки нет). С **явным** `reply_markup` в
   `copyMessage` кнопка появляется (2551 → 2553, проверено владельцем).
5. **Альбом (`copyMessages`).** Три фото (2535–2537, `media_group_id`
   `14320874955709274`) после `copyMessages` пришли **тремя отдельными
   сообщениями** (2538–2540), не одним альбомом.
6. **Что приходит в `tg-router` при форварде фото с подписью.**
   Различающий прогон на живом форварде (update `24020470`, прогон
   `Vy1QBuvtUrqeSZyzn5keI`): `message_id` ✅ (2541), `chat.id` ✅,
   `photo[]` ✅ (три размера, file_id), `caption` ✅, `caption_entities` ✅
   (в т.ч. `bold`, `text_link`, `custom_emoji`, `blockquote`),
   `forward_origin` ✅. `media_group_id` в одиночном фото отсутствует
   (появляется у альбомов; на стороне отправки `sendMediaGroup` поле
   наблюдалось). `tg-router/step_1` уже достаёт `hasPhoto`/`photoFileId`
   (берёт старший размер), но `bcast-draft` в payload передаёт только
   `fwdText` — фото теряется на этом шаге, это и есть работа #131.
7. **`web_page_preview: false` работает.** Проп называется «**Disable** Web
   Page Preview»: `true` → `link_preview_options.is_disabled=true` (превью
   нет), `false` → `link_preview_options.url` (превью есть). То есть
   превью в `reg-start`/`bcast-*` при `web_page_preview:false` — ожидаемое
   поведение пропа, а не дефект; «починка» #130 item 3 — выставить `true`.

**Вывод для #131 (Part 1, одиночное фото):** вариант A выполним через
`custom_api_call /copyMessage` с **обязательным явным `reply_markup`** —
иначе кнопка «Отписаться» теряется. Альтернатива — `sendPhoto` по
`photoId` из форварда + `caption` (форматирование переносится сущностями).
Альбом (Part 2) через `copyMessages` одним альбомом не собрать — потребуется
`sendMediaGroup` с повторной отправкой.

## Как проверено

- `ap_research_pieces` + `ap_get_piece_props` — состав действий и пропов.
- `ap_run_action` `custom_api_call GET /getMe` — токен подставляется из
  connection (run `z3YLnziIQvJ2SW17248JR`).
- `ap_run_action` `custom_api_call POST /sendPhoto` — фото по URL +
  `caption` HTML + `reply_markup` (run `0ZpMpiGKnlvsyYWOoOjvH`, msg 2533).
- `copyMessage` без `reply_markup` → фото/текст есть, кнопки нет
  (runs `71qMgLS7xYJOKSw8cq5pd` msg 2534; `doHwz3Xu0Y83c9EAzPVgQ` msg 2552).
- `copyMessage` с явным `reply_markup` → кнопка есть (run
  `qNVPAXk9zqrxxmG9zmTim`, msg 2553).
- `sendMediaGroup` + `copyMessages` → три отдельных сообщения (runs
  `8BlXOwPaKlvouM86KPsPb` msgs 2535–2537; `ASJOvRrW4DAz75pjW2Bhz` msgs
  2538–2540).
- `send_text_message` с `web_page_preview: true`/`false` — ответ Bot API
  показал `link_preview_options.is_disabled=true` / `.url`
  (runs `lLBkUSNLkVI32erWc54Tn`, `gjr4jWjO1c47ongVls8vY`).
- Форвард фото с подписью владельцем — живой прогон `tg-router`
  `Vy1QBuvtUrqeSZyzn5keI`.
- Визуальную сверку «оригинал/копия» делал владелец в своём чате
  (тестовый получатель — его собственный аккаунт, не сторонние люди).

## Журнал

- **2026-09-23** — пакет взят; `ap_research_pieces` сразу показал, что
  `copy_message` в piece нет, но есть `custom_api_call`.
- **2026-09-23** — `custom_api_call` body — DYNAMIC с обязательным
  подключом `data`; без обёртки `{"body":{"data":{…}}}` тело уходит пустым
  (`400 there is no photo in the request`). Это же объясняет, почему
  `send_media` не годится для фото по URL: у её `media` только file-upload
  или `photoId`.
- **2026-09-23** — первая визуальная сверка дала ложный «фото пропало»
  (владелец смотрел не то сообщение в зашумлённом чате); чистый
  изолированный тест 2549→2550 подтвердил, что фото переживает копию.
  Урок: просить сверку по конкретным номерам сообщений.
- **2026-09-23** — владелец прислал тестовые сообщения в свой чат; после
  эксперимента остались сообщения 2533–2553 (оригиналы и копии). Не удалял —
  это материал для сверки; при необходимости бот может удалить их
  `deleteMessage`.

## Ревью

> Заполняет независимый ревьюер по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

## Хвосты и блокеры

- Визуальные проверки зависят от владельца (у агента нет доступа к Telegram).
- Ссылка-превью при копировании и `media_group_id` у форварда альбома
  отдельно не проверялись — для Part 1 (#131, одиночное фото) не требуется.
