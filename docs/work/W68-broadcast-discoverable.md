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

**Офлайн:** `check-export-secrets.sh` — 0; `check-texts.py` — 254 пары, 0
расхождений; `check-commands.py` — 0 нарушений; `check-agents.py` — 0;
`prototypes/check.mjs` — OK; `miniapp npm run build` — OK.

**UI (headless, `~/w41/w68-shots.mjs`):** статик `miniapp/dist` + мок
`Telegram.WebApp` и `manage-api`, 13/13, 0 console-ошибок. Проверено:
карточка-инструкция из 3 шагов, кнопка «Перейти в чат», сегмент «Все, кто
согласился на анонсы» первым со счётчиком, `no_show` закрыт до `ends_at` и
открыт после; скриншоты light/dark просмотрены (`~/w41/shots-w68/`).

## Ревью

> Заполняет независимый ревьюер.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

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

## Хвосты и блокеры

- **`ap_export_flow` не сериализует свежий `exampleData` триггера.** После
  `ap_update_trigger` (добавлены `callbackData`/`callbackQueryId` в
  `exampleData` триггера `menu`) `ap_flow_structure` и
  `ap_resolve_property_options` отдают новую схему, а `ap_export_flow` —
  старую. Функционально не влияет: живой прогон подтвердил, что
  `callbackData` доходит до `menu`; форма вызова `callFlow` резолвится
  через `ap_resolve_property_options` (новая схема). Следствие: в
  `flows/menu.json` и `flows/tg-router.json` `exampleData` триггера `menu`
  без двух новых полей — расхождение репозитория с инстансом в sample-данных,
  не в поведении. Проверено повторной публикацией — поведение сохраняется;
  платформенная гоча, не ошибка пакета.
- **Проверка «организатор находит рассылку без подсказок»** — живой телефон
  за владельцем (как у W74/W76).
