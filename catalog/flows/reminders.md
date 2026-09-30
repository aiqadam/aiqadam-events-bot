# Flow: reminders

- **Статус**: ENABLED (published)
- **Триггер**: cron `*/15 * * * *`, `Asia/Tashkent` (`@aiqadam/qadam-schedule : cron_expression`)
- **Назначение**: напоминания `24h` / `2h` до `starts_at` (OWN-16, IDM-3).
- **Flow ID (MCP)**: `5JiN4gJgdh8ItkzUqVnTf`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-schedule : cron_expression` | каждые 15 мин, Asia/Tashkent |
| step_1 | `tables-find-records events` | только `published`; колонки включают `lat`/`lon` (карта), `format` и `online_url` (онлайн) |
| step_2 | CODE «due windows» | `dt = starts_at - now`; окно `24h` / `2h`; `when` словами Asia/Tashkent; `dueIdsCsv` + сентинел; `online` (по `format`), `onlineUrl`; `mapsUrl` из валидных `lat`/`lon` (у онлайна пусто) |
| step_3 | `tables-find-records registrations` | `event_id in dueIds` и `status = registered` |
| step_4 | CODE «targets» | join регистраций с окнами, дедуп пар `(event_id, telegram_id)`, проброс `online`, `onlineUrl`, `mapsUrl` |
| step_5 | LOOP_ON_ITEMS | по `targets` |
| step_6 (в цикле) | `store : put_if_absent` | захват `rm:<event_id>:<kind>:<telegram_id>`, `COLLECTION`, TTL 48 ч |
| step_7 (в цикле) | ROUTER «первый раз?» | `stored` / `Otherwise` |
| step_8 (`first`) | CODE «reminder text» | текст из `texts` (`$t`-ссылка): офлайн `remind.24h`/`remind.2h` (с адресом), онлайн — `remind.*_online` при ссылке и `remind.*_online_pending` без неё (без «Адрес: »); `reply_markup`: офлайн — «Открыть билет» (`web_app`) + «Как добраться» (`url`, при `mapsUrl`); онлайн — **одна** кнопка: «Открыть трансляцию» (`url`, при `onlineUrl`) или «Открыть билет», пока ссылки нет |
| step_9 (`first`) | `send_text_message` | `format: None`, `reply_markup`, `continueOnFailure` |
| step_10 (`Otherwise`) | CODE «already reminded» | лог с причиной `already_sent` |

## Зависимости

- **Таблицы**: `events`, `registrations` (чтение)
- **Переменные**: `MINIAPP_URL` (кнопка «Открыть билет» в напоминании)
- **Store**: `rm:<event_id>:<kind>:<telegram_id>`, `COLLECTION`, TTL 48 ч
- **Connections**: connection среды (отправка)

## Заметки

- **Окна (OWN-16): `24h` iff `2h < dt <= 24h`, `2h` iff `0 < dt <= 2h`.**
  В момент старта — ничего; пропущенное окно не досылается (`dt <= 0` —
  пропуск навсегда). Событие, опубликованное поздно (`dt` уже `< 2h`), вид `24h`
  не получит никогда. Каданс 15 мин против окна 24 ч: граница `24h` ловится
  следующим тиком, дырки нет.
- **Дедуп (IDM-3) — `put_if_absent` ДО отправки**, гейтит отправку, а не вход.
  Поле ответа — `stored`, не `acquired` (ошибка в имени молча закрывает гейт
  навсегда — та же ловушка, что в `reg-afterword`). Маркер ставится и при
  неуспешной отправке: повторного шанса у этого вида нет, как и у послесловия.
- **Получатели — только `status = registered`.** Отбор повторяется в CODE (Q25):
  фильтр чтения может разойтись, решение — по полям записи.
- **`403` / `blocked_bot` здесь не обрабатываются** — это домен W14 (OWN-12).
  `continueOnFailure` на отправке не даёт одному фейлу убить весь цикл.
- **`format: None`** (VOICE: дефолт; разметка однострочному напоминанию не нужна —
  заодно закрыт класс инъекций разметкой).
- **Тексты не новые**: ключи `remind.24h` / `remind.2h` уже были в `ru.json`
  и прототипе именно с этими слотами (`{title}`, `{when}`, `{address}`) —
  дубли `.body` не заводились.
- **`{when}` — только время Asia/Tashkent (`18:30`)**: окно уже говорит
  «завтра» / «через два часа» (шаблон `ru.json`), дата с годом здесь — шум
  (W51: было «17 сентября 2026 г. в 17:41»). Форма прототипа (`when='18:30'`).
- **Сентинел `__none__`** — как в `lifecycle`. Find-шаги обязаны содержать
  `limit` + `record_ids` (иначе невалидны).
- **Онлайн-событие (W67/[W131](../../docs/BACKLOG.md#w131-онлайн-событие-ux-без-qr),
  [ADR-0052](../../docs/adr/0052-event-format-field-online-offline.md)/[ADR-0053](../../docs/adr/0053-online-event-no-qr-wording.md)):**
  `format=online` даёт текст без строки «Адрес: » и **одну** кнопку: со ссылкой —
  «Открыть трансляцию» (`remind.btn.stream`), без неё — «Открыть билет»
  (`ticket.btn.open`, там «появится позже»); текст без ссылки — `remind.*_online_pending`
  и кнопку трансляции не обещает. Офлайн — прежние две кнопки. Карта для онлайна
  не собирается (`mapsUrl` пуст).
- **Кнопки под напоминанием ([#142](https://github.com/aiqadam/aiqadam-events-bot/issues/142)):**
  «Открыть билет» — `web_app` на `#/ticket?event_id=<id>` (метка `ticket.btn.open`,
  как на экране билета); «Как добраться» — `url` на Яндекс.Карты, только при
  валидных координатах. Онлайн-событие и событие без координат — без кнопки
  карты.
- **Карта собирается из `lat`/`lon` (OWN-2), а не хранится.** Не гео: пусто,
  нечисло, вне диапазона и `(0,0)` — «Гвинейский залив», а не адрес
  ([#124](https://github.com/aiqadam/aiqadam-events-bot/issues/124)).
- **`reply_markup` — JSON-проп `send_text_message`**; `format: None` inline-кнопкам
  не мешает (текст по-прежнему без разметки — класс инъекций разметкой закрыт).
- **Ключи текстов**: `remind.24h` / `remind.2h`, онлайн `remind.24h_online` /
  `remind.2h_online` и `remind.*_online_pending` (W131), плюс переиспользованные
  `ticket.btn.open`, `remind.btn.stream` и новый `remind.btn.directions`.
