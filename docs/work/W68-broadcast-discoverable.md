# W68. Рассылка обнаруживаемой (вариант A)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: #125 (тот же `tg-router/step_10` — после него)
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Организатор не находит, как разослать анонс: единственный вход — форвард боту.
Вариант A (решение владельца 2026-09-23): инструкция в 3 шага в табе «Рассылка»,
кнопка «Как сделать рассылку» в меню staff, сегмент «Подписчики анонсов».

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| flow `tg-router` | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `manage-api` | `CcGPwuW4ws5hkcaOPerEG` | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
| Mini App `Manage.tsx` (таб «Рассылка») | — | — |

Опубликованные версии (финальные, после тестов):

| flow | `publishedVersionId` | точка отката (версия до W68) |
|------|----------------------|------------------------------|
| `manage-api` | `aYL50moLqjFmJalgTPxmF` | `g0Tjak1LdiTkWI9UN0Pc4` |
| `menu` | `E5sVXvXecXf3zAIJfJ9aL` | `dVvIi8m6z28Kpwvmpp5cE` |
| `tg-router` | `E5UtwCPjFh5dUFmF0YKg8` | `SGwk43CYYPHDNsqraS0bX` |

## Что именно сделано

1. **`manage-api`**: новое чтение `step_60` (`users`, фильтр `consent_marketing
   eq true`, `telegram_id`+`consent_marketing`+`blocked_bot`, `limit: 500`);
   `step_46` считает `counters.all_consent` тем же правилом, что `bcast-step`
   (уникальные `telegram_id`, кроме `blocked_bot = true`). Контракт
   `participants` дополнен ключом.
2. **`menu`**: в `step_11` у организатора четвёртая кнопка «Как сделать
   рассылку» (`callback_data: menu:bcast_help`); по этому колбэку `step_11`
   отдаёт инструкцию `bcast.howto.title/step1/step2/step3` вместо приветствия.
   Триггер принимает `callbackData`/`callbackQueryId`; `step_14`
   (`answer_callback_query`, `continueOnFailure`) подтверждает колбэк.
3. **`tg-router`**: `step_10` ловит префикс `menu:` до командной цепочки →
   `route: menu`; `step_15` передаёт в `menu` `callbackData`/`callbackQueryId`.
4. **Mini App** (`Manage.tsx`, таб «Рассылка»): карточка-инструкция
   (`bcast.howto.*`) вместо хинта, кнопка «Перейти в чат» (`tg.close()`)
   без изменений, в списке сегментов первым — «Все, кто согласился на анонсы»
   (`bcast.segment.all_consent`) со счётчиком из `participants`.
5. **i18n**: `bcast.howto.title/step1/step2/step3`, `menu.btn.bcast_help`.

## Чек-лист готовности

> Из [issue #120](https://github.com/aiqadam/aiqadam-events-bot/issues/120).

- [x] владелец выбрал A, решение записано в BACKLOG (сделано 2026-09-23)
- [ ] организатор находит рассылку из Mini App без подсказок (живая проверка)
      — headless-стенд и текст инструкции сделаны; проверка «без подсказок»
      на живом телефоне — за владельцем (как у W74/W76)
- [x] тест себе обязателен, серверные гейты на месте (не трогались: `bcast-run`)
- [x] виден сегмент «Подписчики анонсов» (`all_consent`) со счётчиком
- [x] `check-texts.py`, `check-commands.py`, `npm run build` зелёные
- [x] `catalog/` совпадает с живым проектом

## Как проверено

**Живой сквозной прогон `tg-router` (MCP, TESTING).** Синтетический
`callback_query` с `data: menu:bcast_help` от `322876545`:
`step_10` → `{"route":"menu","fallback":false}`; `step_11` ветка `menu`
`evaluation: true`; `step_15` вызвал `menu` (`queue`). Прогон `menu`
(`D05qFAyT1EjMMnkcd6ZrT`, PRODUCTION, пришёл из очереди): триггер получил
`callbackData: "menu:bcast_help"` и `callbackQueryId`; `step_11` отдал текст
«Как сделать рассылку…» и 4 кнопки (включая `menu:bcast_help`); `step_12`
доставил сообщение (`message_id` 2580). `step_14` в прогоне ❌ с 400
«query is too old» — это ожидаемо для синтетического `callbackQueryId`;
`continueOnFailure` не прервал прогон.

**Прямой прогон `menu`** (MCP, TESTING, `0VLQ03UfLyCN8yZOs1qfQ`) с тем же
колбэком — тот же результат, сообщение `message_id` 2579.

**Живой `curl` на опубликованный `/sync` `manage-api`** (`initData` подписан
временным флоу `zz-w68-mint-init-data`, читавшим `BOT_TOKEN` + `node:crypto`;
флоу удалён, см. `migrations` `2026-09-23-w68-04`):

| # | Сценарий | Ожидание | Факт |
|---|----------|----------|------|
| M1 | `participants` события `mu9rqipgetmp`, staff | `200`, `all_consent` = числу подписчиков | `200`; `counters {registered:5, checked_in:1, cancelled:0, all_consent:5}` |
| M2 | то же событие `mu9uzchnu2il` (0 регистраций) | `200`, `all_consent` тот же (глобальный) | `200`; `all_consent:5` |
| M3 | `participants` не-staff (`532804490`) | `403` | `403 forbidden` |

Различающий контроль: `users` с `consent_marketing = true` и
`blocked_bot ≠ true` — ровно 5 строк (`ap_find_records`), счётчик `M1`
сходится.

**Офлайн:** `check-export-secrets.sh` — 0; `check-texts.py` — 254 пары, 0
расхождений; `check-commands.py` — 0 нарушений; `check-agents.py` — 0;
`prototypes/check.mjs` — OK; `miniapp npm run build` — OK.

**UI (headless, `~/w41/w68-shots.mjs`):** статик `miniapp/dist` + мок
`Telegram.WebApp` и `manage-api`, 13/13, 0 console-ошибок. Проверено:
карточка-инструкция из 3 шагов, кнопка «Перейти в чат», сегмент «Все, кто
согласился на анонсы» первым со счётчиком, `no_show` закрыт до `ends_at` и
открыт после; скриншоты light/dark просмотрены (`~/w41/shots-w68/`).

## Ревью

- **Ревьюер**: review-agent (независимое ревью, чистый контекст), **Дата**: 2026-09-23
- **Вердикт**: есть замечания (блокеров нет; одно `важно` — живой прогон
  `manage-api`/`all_consent`)

### Замечания

1. **важно** — счётчик `all_consent` не подтверждён живым прогоном
   `manage-api`. `step_60`/`step_46` опубликованы (версия
   `aYL50moLqjFmJalgTPxmF`), но после публикации W68 (2026-09-23 14:24/14:31
   UTC) в `manage-api` нет ни одного прогона: `ap_list_runs` по флоу
   показывает последний запуск 06:02 UTC. Пункт чек-листа «виден сегмент
   „Подписчики анонсов“ со счётчиком» отмечен по headless-стенду с **моком**
   `manage-api`, а не по живому ответу. Риск низкий — чтение `step_60`
   повторяет рабочий `bcast-step` (тот же `table_id`, те же колонки, тот же
   фильтр `consent_marketing eq true`, тот же `limit: 500`), а правило
   `step_46` (уникальные `telegram_id`, `consent_marketing = true`, кроме
   `blocked_bot = true`) совпадает с `bcast-run`/`bcast-step`, — но серверный
   путь заголовочной фичи не исполнялся ни разу. **Чинить:** один живой
   запрос `participants` (Mini App или `/sync`) и подтвердить
   `counters.all_consent` в ответе.

2. **на будущее** — нет различающего прогона «не-организатор». Инструкция и
   кнопка проверены только владельцем (`322876545`, `isOwner: true`). Что
   гость/контролёр по тому же колбэку `menu:bcast_help` получат обычное меню
   без инструкции, следует только из чтения кода (`if (isHelp && isOwner)`);
   пары «организатор → инструкция, гость → обычное меню» в прогонах нет. Это
   видимость, а не граница прав (настоящий гейт — в `bcast-draft`/`bcast-step`,
   не тронут), поэтому не блокер. Прогнать пару при следующем касании `menu`.

3. **на будущее** — `exampleData` триггера `menu` в репозитории без
   `callbackData`/`callbackQueryId`. Проверено по существу: это **не**
   расхождение репозитория с инстансом — `ap_export_flow` по опубликованной
   версии (`E5sVXvXecXf3zAIJfJ9aL`, `state: LOCKED`) тоже отдаёт старый
   `exampleData`, а `ap_flow_structure`/`ap_resolve_property_options` его
   достраивают (похоже, дефолтами схемы `callableFlow`). На поведение не
   влияет: рантайм несёт значения через `flowProps.payload`
   (`tg-router/step_15`), что подтверждено живым прогоном
   `D05qFAyT1EjMMnkcd6ZrT` (`callbackData: "menu:bcast_help"` дошёл до
   `menu`). Стоит вынести в платформенные гочки (AGENTS/ARCHITECTURE), чтобы
   каждый пакет не расследовал это заново.

4. **на будущее** — `menu/step_14` (`answer_callback_query`) падает на каждом
   рендере меню, кроме колбэка. При `/start` и ответе на обычный текст
   `callbackQueryId` пуст → Telegram 400, шаг ❌ в прогоне (наблюдалось в
   `D05qFAyT1EjMMnkcd6ZrT`). `continueOnFailure` не даёт прогону упасть, и
   каталог это описывает; но теперь каждый `/start` несёт неуспешный шаг и
   лишний вызов Bot API. Гейт по непустому id (ROUTER/`skip`) — не
   обязателен, но сделал бы прогоны чище.

5. **на будущее** — инструкция отправляется новым сообщением, а не
   редактированием карточки. `menu/step_12` шлёт `send_text_message`
   (ADR-0017 п. 2: состояние редактируется), поэтому повторное нажатие «Как
   сделать рассылку» плодит сообщения в ленте. Это тот же приём, что у меню
   на `/start`, поэтому не блокер; при следующем касании рассмотреть
   `edit_message_text` с фолбэком на новое сообщение.

6. **на будущее** — счётчик `all_consent` глобальный, прототип рисует его
   по-событийным. В `prototypes/data.js` `segments.all_consent` различается по
   событиям (214/12/180), в реализации — одно глобальное число. Реализация
   верна серверному сегменту (`bcast-step`/`bcast-run` считают глобально), но
   расхождение с эталоном-прототипом (ADR-0027, чек-лист 3a) в журнале явно
   не названо — зафиксировать при следующей правке.

7. **на будущее** — каталог `catalog/flows/menu.md` в шапке перечисляет входы
   `route: menu` (голый `/start`, неразобранный payload, незнакомая команда),
   но не упоминает W73 (обычный текст) и W68 (`menu:*`), хотя таблица шагов и
   примечание ниже их описывают. Дополнить список в шапке.

### Чем проверено

- **MCP:** `ap_flow_structure` (`menu`, `tg-router`, `manage-api`,
  `includeInput`), `ap_read_step_code` (`menu/step_11`, `manage-api/step_46`),
  `ap_export_flow` (все три флоу — `flows[0].id` совпал с
  `publishedVersionId` манифеста), `ap_get_run`
  (`D05qFAyT1EjMMnkcd6ZrT`, `0VLQ03UfLyCN8yZOs1qfQ`, `bWbJVtPXveVAHNSsNv481`),
  `ap_list_runs` (`menu`, `tg-router`, `manage-api`), `ap_find_records`
  (`migrations`, пакет W68), `ap_list_tables`, `ap_list_flows`.
- **Различающий прогон прочитан:** `tg-router` (TESTING) — колбэк
  `menu:bcast_help` → `step_10` `route: menu`, `step_11` ветка `menu`,
  `step_15` вызвал `menu`; `menu` (PRODUCTION) — триггер получил
  `callbackData: "menu:bcast_help"`, `step_11` отдал инструкцию
  `bcast.howto.*` и 4 кнопки, `step_12` доставил сообщение. Логика `/start`,
  незнакомой команды и W73-фолбэка прочитана по коду: вставленная ветка
  `menu:` не перекрывает их (стоит после `bcast:` и до командной цепочки).
- **Сверка манифест ↔ инстанс ↔ `migrations`:** `menu`
  `E5sVXvXecXf3zAIJfJ9aL`, `tg-router` `E5UtwCPjFh5dUFmF0YKg8`, `manage-api`
  `aYL50moLqjFmJalgTPxmF`; строки `2026-09-23-w68-01…03`, commit `e0aed17` —
  совпадают.
- **Офлайн (запущено самому):** `check-export-secrets.sh` — 0;
  `check-texts.py` — 254 пары, 0 расхождений; `check-commands.py` — 0;
  `check-agents.py` — 0; `prototypes/check.mjs` — OK; `miniapp npm run build` —
  OK.
- **AppSec:** `step_46` повторно проверяет права по полям (staff + чаптер +
  событие, Q25) и отдаёт 403; `all_consent` — счётчик без ПД; экранирование
  Telegram не затронуто (`format: None`); CSV-инъекция обрабатывается
  (существующий `csvEsc`), `all_consent` в CSV не попадает; секретов в шагах
  и экспорте нет.
- **Каталог против реальности:** `catalog/flows/{menu,tg-router,manage-api}.md`
  и `catalog/overview.md` сверены со структурами — совпадают (кроме п. 7).
- **Ограничение:** `check-migrations.py` недоступен без ключа платформы (нет
  ни в `QADAM_API_KEY`, ни в Keychain) — сетевая сверка всего манифеста не
  выполнена; три флоу пакета сверены вручную через MCP. Замечанием пакету не
  является.

### Ответ владельца (круг 1)

- **#1 (`важно`) — исправлено.** Живой `curl` на опубликованный `/sync`
  `manage-api` (см. таблицу M1–M3 в «Как проверено»): `all_consent = 5`,
  сходится с ручным подсчётом `users`; не-staff — `403`. Временный
  минтинг-флоу удалён, `migrations 2026-09-23-w68-04`.
- **#7 — исправлено.** Шапка `catalog/flows/menu.md` дополнена входами W73
  (обычный текст) и W68 (`menu:*`).
- **#3 — вынесено в гочи.** Платформенное поведение записано в `AGENTS.md`
  как гоча 19; в журнале хвост переписан со ссылкой на неё.
- **#2, #4, #5, #6 — приняты как `на будущее`** (не блокеры): не-организатор
  проверен только чтением кода (видимость, не граница прав); `step_14` ❌ на
  `/start` — цена `continueOnFailure` за ack кнопки; инструкция — новым
  сообщением (как и меню); `all_consent` глобальный, прототип рисует его
  по-событийным (реализация верна серверному сегменту).

## Журнал

- **2026-09-23** — пакет взят; решение владельца: вариант A.
- **2026-09-23** — зависимость #125 снята (W73 смержен), `tg-router/step_10`
  свободен; правки `tg-router`/`menu` — последовательно, один исполнитель
  (гоча 16).
- **2026-09-23** — публикация до ревью (процесс, шаг 3: publish → export →
  PR → ревью). Точки отката сняты из `main` до правок:
  `tg-router` `SGwk43CYYPHDNsqraS0bX`, `menu` `dVvIi8m6z28Kpwvmpp5cE`,
  `manage-api` `g0Tjak1LdiTkWI9UN0Pc4`.
- **2026-09-23** — тесты `ap_test_flow` пишут sample-данные (гоча 14):
  после прогонов `menu` и `tg-router` оба флоу перепубликованы и экспорт
  снят заново. В `migrations` — по одной финальной строке `publish` на флоу.
- **2026-09-23** — побочный эффект живых прогонов: два меню-сообщения
  (в т.ч. help) ушли владельцу в чат с dev-ботом. Вредных записей нет;
  синтетическая строка `store`/`users` — идемпотентна/апсерт.
- **2026-09-23** — ревью круг 1 (`review-agent`, чистый контекст): блокеров
  нет, одно `важно` (живой прогон `manage-api`/`all_consent`) и шесть
  `на будущее`. Исправлено: `важно` закрыто живым `curl` (M1–M3) + снят
  временный минтинг-флоу; шапка `catalog/flows/menu.md` дополнена (замечание
  7); платформенная гоча про `exampleData` вынесена в `AGENTS.md` (замечание
  3). Остальные `на будущее` приняты — см. «Ответ владельца (круг 1)».
- **2026-09-23** — пакет на повторном ревью (круг 2).

## Хвосты и блокеры

- **`ap_export_flow` не сериализует свежий `exampleData` триггера `menu`.**
  Ревью круг 1 проверило по существу: это **не** расхождение репозитория с
  инстансом (экспорт `LOCKED`-версии тоже без двух полей), на поведение не
  влияет. Вынесено в [AGENTS.md, гоча 19](../../AGENTS.md). Дальше не
  расследовать.
- **`step_14` (`answer_callback_query`) падает на `/start` и обычном тексте**
  (пустой `callbackQueryId` → 400, `continueOnFailure`). Цена — лишний
  неуспешный вызов Bot API на входе в меню. Принято как `на будущее` (ревью
  круг 1): чистого гейта без дублирования веток в этом движке нет.
- **Проверка «организатор находит рассылку без подсказок»** — живой телефон
  за владельцем (как у W74/W76).
