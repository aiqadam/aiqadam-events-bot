# Flow: events-api

- **Статус**: ENABLED (published)
- **Триггер**: `@aiqadam/qadam-webhook : catch_webhook` — sync-ответ на
  `POST /api/v1/webhooks/7MSsiJX1OJM9jcvZoU7g5/sync`; тело запроса не читается
  (`authType: none`)
- **Назначение**: публичный каталог событий для экрана `#/events` — будущие
  и прошедшие раздельно (PAR-3, [ADR-0023](../../docs/adr/0023-fourth-miniapp-page-event-catalog.md));
  без `initData`, без персональных данных, только опубликованные и завершённые
- **Flow ID (MCP)**: `7MSsiJX1OJM9jcvZoU7g5`

## Шаги

| Step | Piece / Action | Назначение |
|------|----------------|-----------|
| trigger | `@aiqadam/qadam-webhook : catch_webhook` | приём sync-запроса SPA |
| step_1 | `tables-find-records events` | `status in (published, finished)`, `limit 50`; только поля карточки: `id`, `title`, `address`, `lat`, `lon`, `starts_at`, `ends_at`, `reg_deadline_at`, `status` |
| step_2 | CODE «build catalog» | постфильтр статуса, деление будущие/прошедшие по `ends_at \|\| starts_at`, сортировка по `starts_at`, сборка `registerLink`; `lat`/`lon` — как есть, для ссылок на карты в Mini App (W72) |
| step_3 | `return_response` (`stop`) | `200 {ok, upcoming[], past[]}` — карточки готовыми полями |

## Зависимости

- **Таблицы**: `events` (чтение)
- **Переменные**: `BOT_USERNAME`
- **Connections**: —

## Заметки

- **`registerLink` собирает сервер**: `https://t.me/<BOT_USERNAME>?start=e<id>`
  — SPA не запекает имя бота, оно переживёт смену бота (ADR-0023). В Telegram
  регистрация идёт шитом внутри Mini App (W43), ссылка — запасной путь
  для открывшего каталог вне Telegram.
- **`published` + `finished` в фильтре, постфильтр в CODE** (defense in depth,
  Q25). `finished` включён осознанно: каталог — афиша, завершённое событие обязано
  остаться в «Прошедших»; `draft` и `cancelled` не видны ни в одной вкладке.
- **PII не читается вовсе**: проекция ограничена полями карточки —
  `staff_id`, `chapter_id`, `users` и `registrations` в выдачу не попадают.
- **`lat`/`lon` отдаются строкой, пустое значение — `''`, не `0`** (W72, #124):
  Mini App сам строит ссылки на Яндекс.Карты/Google Maps; онлайн-событие с
  пустыми координатами ссылок не получает (см. `miniapp/src/lib/maps.ts`).
- **Деление на будущие/прошедшие — в CODE, не в фильтре**: диапазонные
  сравнения по `DATE` не работают (Q15). Прошедший — `ends_at` (или
  `starts_at`, если `ends_at` пуст) уже наступил; разрывов нет.
- **`reg_deadline_at` в выдаче — для честной кнопки**: каталог не рисует
  «Зарегистрироваться» после дедлайна; решает всё равно сервер (`reg-api`
  возвращает `deadline_passed`), ответ — понятный текст, а не молчание.
- **Порядок в обеих вкладках — по `starts_at` по возрастанию**; событие
  с непарсящейся датой считается будущим, чтобы не пропасть из выдачи молча.
- Лимит 50 — договорённость Q15; при переполнении срезы режутся по тому же
  порядку (будущие — ближайшие, прошедшие — самые старые), полный курсор
  в каталоге не строится.
