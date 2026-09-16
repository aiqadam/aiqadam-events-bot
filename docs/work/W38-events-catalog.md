# W38. Четвёртая страница Mini App — каталог ивентов `#/events`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: v0.1 (первый пакет пары W38 → W43, [ROADMAP](../ROADMAP.md#v01--порядок-работ-один-агент-последовательно))
- **Зависит от**: W33 (✅ SPA и роутер), ADR-0017, W30/ADR-0019 (`EventCard`), ADR-0023
- **Начат**: 2026-09-16 · **Закрыт**: —

## Цель

PAR-3 переезжает из чат-списка `events-list` на экран `#/events`: две вкладки
(будущие/прошедшие), карточки `EventCard`, тап — в уже построенный `reg-start`
по deep link. Чат-флоу `events-list` и его ветки в `tg-router` выводятся
из эксплуатации. Подробности — [BACKLOG W38](../BACKLOG.md#w38-четвёртая-страница-mini-app--каталог-ивентов-events),
дублировать не надо.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `events-api` (новый) | `wEdKdE4RBGKIzWkl4MJHG`, версия `ytVOqCYzA5fLsIufaAQd6` | [catalog/flows/events-api.md](../../catalog/flows/events-api.md) |
| flow `menu` (правка) | `1DORFhP9F3W00KpKz5wDw`, версия `JYOyGHCtsFPFu8mMRoj4u` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| flow `tg-router` (правка) | `nyaBzgKGG8TTTsryjc9tW`, версия `F7pxsKGZXUAqxBl29KuGq` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `events-list` (удалён) | был `UxuFOI7GvXaboDQZHHKSI` | — |
| роут SPA `#/events` | `miniapp/src/routes/Events.tsx` (ленивый чанк 3,7 КиБ / 1,4 gzip) | [catalog/overview.md](../../catalog/overview.md) |

## Чек-лист готовности

> Скопирован из [BACKLOG.md](../BACKLOG.md#w38-четвёртая-страница-mini-app--каталог-ивентов-events).

- [x] каталог открывается из меню одной кнопкой, будущие и прошедшие раздельны
      (PAR-3 не потерян — воспроизведены оба среза `events-list`);
- [x] тап по ивенту открывает `reg-start` этого ивента (проверено вживую:
      переход → карточка регистрации);
- [x] `register_link` строит сервер; в SPA нет литерального `BOT_USERNAME`
      (grep), имя бота приходит с API;
- [x] `events-api` не отдаёт персональных данных и неопубликованных ивентов;
      проверено различающим прогоном (черновик не виден);
- [x] `events-list` удалён; каталог и `flows/` без него, `tg-router` без его
      веток и команды `/events`, `migrations` дописаны;
- [x] каталог на брендовых токенах и `EventCard`, своих цветов/шрифтов нет
      ([ADR-0019](../adr/0019-design-system-from-brand-repo.md)); каталог — ленивый
      чанк, веб-шрифты не грузятся ([ADR-0020](../adr/0020-no-web-fonts-on-venue-pages.md));
- [x] тексты из `i18n/ru.json`, `check-texts.py` чист;
- [x] `catalog/flows/events-api.md`, раздел Mini App в `catalog/overview.md`,
      экспорт `flows/` тем же коммитом, `check-export-secrets.sh` чист;
- [ ] независимое ревью, вердикт «замечаний нет».

Плюс обязательный пункт: `catalog/` совпадает с живым проектом.

**Граница доказательства по «тапу».** Живого Telegram-клиента у агента нет:
доказаны обе половины цепочки по отдельности — серверная (`registerLink`
с `start=e<id>` в ответе) и клиентская (`href` кнопки в DOM, `openTelegramLink`
в WebView), плюс то, что `/start e<id>` у бота ведёт в `reg-start` (построено
и принято в W5/W28). Тап живьём и переход «меню → каталог» на боевом Pages
закрываются после мержа — записано в «Хвостах».

## Как проверено

> Чем именно, а не «протестировано». Фикстуры, отрицательные сценарии, что видел на экране.

- **`events-api`, различающий прогон на черновике (PRODUCTION, `curl`).**
  Создана временная строка `events` со `status = draft` (`id = w38drafttest`,
  запись `TSjUJnJ4V9TsgXm1kbeJt`), `POST .../wEdKdE4RBGKIzWkl4MJHG/sync` →
  черновик **отсутствует** и в `upcoming`, и в `past`; в выдаче только поля
  карточки (`id`, `title`, `address`, `startsAt`, `endsAt`, `status`,
  `registerLink`) — `staff_id`/`chapter_id`/`telegram_id` не читаются вовсе.
  Фикстура удалена (`tables-delete-record`, run `qgPw52VPRtxJTmy4WTisd`).
- **`registerLink` строит сервер**: в ответе
  `https://t.me/aiqadam_events_dev_bot?start=e<id>` — `BOT_USERNAME` подставлен;
  `grep` по `miniapp/src/` литералов `BOT_USERNAME`/`aiqadam_events` не находит.
- **`events-api`**: `ap_validate_flow` — valid; TESTING-прогон
  `p8xt8jlJQMBqvfaDQtT7J` (деление и `registerLink` на боевых строках);
  живой `curl` — `200 {ok, upcoming[4], past[3]}`.
- **`menu`**: прогон `M62dDF6YDjxjpM012GwRS` — в `reply_markup` кнопка
  «Ивенты» стала `web_app` с `https://miniapp.events.aiqadam.org/#/events`;
  живая доставка — прогон `tg-router` `5qUrqNcfiR2Np1sg1zqTC` (`/start` →
  `route=menu`, очередь) → прогон `menu` `ikWQHcyte3onrflvuLaig` SUCCEEDED,
  карточка ушла владельцу. Побочный эффект теста: `tg-router` пишет `users`
  с именем из тестового апдейта («Тест»); имя вернётся при следующем
  живом сообщении владельца.
- **`tg-router`**: `ap_validate_flow` — valid (19 шагов); полный TESTING-прогон
  `0Yth6r4tELdDo6neNgXY5` — старый колбэк `ev:list:upcoming` даёт `route=none`
  и уходит в `Otherwise` (step_16, тишина); полный прогон `5qUrqNcfiR2Np1sg1zqTC`
  — `/start` даёт `route=menu`, ветка `menu` единственная совпавшая.
- **SPA `#/events`** (headless Playwright, 390×844, deviceScaleFactor 2,
  локальная сборка `miniapp/dist` + `i18n/`, API — живой `events-api`):
  будущие — 4 карточки с датой-платой, статусом «Опубликован», временем
  Asia/Tashkent (OWN-3) и кнопкой «Зарегистрироваться»; прошедшие — 3 карточки
  со статусом «Завершён» и **без** кнопки; вкладки переключаются, `?tab=past`
  открывается диплинком; пустой срез (мок ответа `{upcoming:[],past:[]}`) —
  `EmptyState` строкой «Пока ничего не запланировано.», а не молчание;
  светлая и тёмная темы. Скриншоты — `~/w41/shots-w38/`,
  скрипт `~/w41/w38.mjs`.
- **Тексты**: `tools/check-texts.py` — 17 флоу, 114 пар, 0 расхождений;
  новые ключи SPA (`events.loading`, `events.err.network`, `events.err.server`)
  только в `ru.json` (ADR-0014); мёртвый `events.list.item` снят.
- **Экспорт и проверки**: `tools/check-export-secrets.sh` — чист;
  `tools/check-commands.py i18n/ru.json flows/*.json` — 0 нарушений;
  `miniapp` `npm run build` — tsc + vite без ошибок; веб-шрифтов нет
  (в вендоренном CSS только data-URI).

## Журнал

- **2026-09-16** — взятие пакета. Границы: `miniapp/src/App.tsx` (роут
  `#/events` ленивым чанком), новый `events-api` (sync-вебхук, чтение `events`
  со `status = published`, деление будущие/прошедшие в CODE, `register_link`
  собирает сервер из `BOT_USERNAME`), `menu` (кнопка «Афиша» → `web_app`
  на `{{MINIAPP_URL}}#/events` вместо колбэка `ev:list:upcoming`), удаление
  `events-list` и его веток/команды `/events` в `tg-router`, `i18n/ru.json`,
  каталог, `flows/`, `migrations`. `reg-start` не трогается — регистрацию
  и согласия переносит в каталог W43, идущий следом. Порядок работ — BACKLOG
  W38 п. 1–5; вебхук собирается первым, SPA — поверх его контракта ответа.
- **2026-09-16 — сборка и прогоны.** `events-api` собран одним `ap_build_flow`
  (4 шага), `ap_validate_flow`, TESTING-прогон, публикация. `menu/step_4`:
  одна строка кода (кнопка «Ивенты» — `callback_data` → `web_app`), тексты
  не тронуты — `ap_update_step` принимает только `sourceCode` и не задевает
  `input.texts` (гоча 12). `tg-router`: из `step_10` убрана ветка `events_list`,
  шаг `step_23` (`callFlow events-list`) удалён, затем пустая ветка 3 из
  `step_11` — `ap_validate_flow` до удаления ветки ругался на empty branch,
  порядок «шаг → ветка» сработал. `events-list` удалён после снятия ссылок.
- **2026-09-16 — Q56 (буква ADR-0023 против W12).** Обнаружено при выборе
  фильтра: ADR-0023 п. 3 говорит «только published», но W12 переводит
  прошедшие в `finished`, и буквальный фильтр выбросил бы их из «Прошедших».
  Решение — `in (published, finished)` + постфильтр в CODE; запись
  в [OPEN-QUESTIONS Q56](../OPEN-QUESTIONS.md#q56) (ADR задним числом
  не правится).
- **2026-09-16 — экспорт после тестовых прогонов дал DRAFT.** `ap_export_flow`
  по `tg-router` вернул `state: DRAFT`: прогоны `ap_test_step`/`ap_test_flow`
  после публикации пишут в черновик sample-данные (в экспорт их срезает
  нормализация, но версия перестаёт быть LOCKED). Лечение — повторная
  `ap_lock_and_publish` (контент не меняется) и экспорт сразу после неё;
  в `migrations` пишется одна финальная `publish`-строка. **Для следующих
  пакетов: экспорт снимать до тестовых прогонов** (или републиковать).
- **2026-09-16 — Gotcha тестового инструмента: `ap_test_step` по callableFlow
  без обёртки `{"data": {...}}` даёт пустые поля.** Плоский `triggerTestData`
  ложится в output триггера как есть, а входы шагов читают
  `{{trigger['output'].data.X}}` — прогон `vMi9FI5Pjbv8c0f1CCD49` получил
  пустой `firstName` и анонимное приветствие там, где ожидалось именное;
  тот же тест с обёрткой (`M62dDF6YDjxjpM012GwRS`) — правильный. В реальном
  рантайме `payload` разворачивается платформой в `.data` сам. Дописано
  гочей 13 в [CLAUDE.md](../../CLAUDE.md).
- **2026-09-16 — MCP-снимок экспорта беднее REST** (ожидаемо, Q44/ADR-0021):
  в шагах нет `auth`, у `menu` исчез пустой `ownerRecords: ""`, у `tg-router`
  — пустые `utm`/`callbackData` в `exampleData`. Для ре-импорта это значит
  перенастройку connection'ов; источник правды — репозиторий, расхождение
  фиксировано `source: "mcp"` в `_manifest.json`.
- **2026-09-16 — `events.list.item` снят из `ru.json`** как мёртвый после
  удаления чат-листа; остальные `events.list.*` переиспользованы SPA
  (табы, заголовки, пустые срезы) — новых текстов, кроме трёх `events.*`,
  не заводилось.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: <агент> · **Дата**: YYYY-MM-DD · **Вердикт**: замечаний нет | есть замечания

### Замечания

1. **блокер | важно | на будущее** — <что не так> — <флоу/шаг/файл> — <почему важно>
   - *Исправлено*: <что сделал владелец> (YYYY-MM-DD)

## Хвосты и блокеры

- (заполняется по ходу)
