# W06. Участник: списки, мои регистрации, отмена

- **Статус**: на проверке
- **Владелец**: агент W6
- **Волна**: 4
- **Зависит от**: W5 (по BACKLOG; фактически — касания `reg-*` из W26, `tg-router`, таблицы `events`/`registrations`)
- **Начат**: 2026-09-13 · **Закрыт**: —

## Цель

PAR-3 (список ивентов: будущие/прошедшие раздельно), PAR-4 (мои регистрации),
PAR-5 (отмена до `starts_at`). Подробности — [BACKLOG W6](../BACKLOG.md#w6-участник-списки-мои-регистрации-отмена).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `events-list` | `UxuFOI7GvXaboDQZHHKSI` / ext `5Vwo7OcDP4TfHHCaPQycx` | [flows/events-list.md](../../catalog/flows/events-list.md) |
| flow `my-regs` | `R3KaUIk4M9e01npCxeu3n` / ext `K4RS16MdhW0pf8UnYZueu` | [flows/my-regs.md](../../catalog/flows/my-regs.md) |
| flow `my-reg-cancel` | `1pt6UqDUUunGio2V7YWna` / ext `NgRBWT6gR7yhuf1qwG2mM` | [flows/my-reg-cancel.md](../../catalog/flows/my-reg-cancel.md) |
| `tg-router` — 3 маршрута + 3 ветки + 3 `callFlow` | `nyaBzgKGG8TTTsryjc9tW` (шаги `step_10` код+вход, `step_11` ветки, `step_23→25`) | [flows/tg-router.md](../../catalog/flows/tg-router.md) |
| `i18n/ru.json` — ключ `cancel.kept` | «Хорошо, регистрация оставлена.» | — |

## Чек-лист готовности

- [x] будущие и прошедшие разделены по `starts_at`/`ends_at` — прогоны
  `QI9obfFpY4ECSK5CTviGn` (upcoming: только `demo`) и `ABP5aOIDCrZai6tZK0eet`
  (past: только `emtzwtmr32apl`), оба с реальной доставкой в Telegram
- [x] кнопка отмены исчезает после `starts_at`, а не просто выдаёт ошибку —
  прогон `jmayWSMXmH4faeM4BzjkQ`: у регистрации на прошедший ивент есть QR,
  кнопки отмены нет; серверная проверка `too_late` — прогон `TwOCe59RUAQS9waEHjCZz`
- [x] `catalog/` совпадает с живым проектом — 3 новые карточки, `tg-router.md`
  и `overview.md` (21 флоу) обновлены; заодно снята stale-строка про W26
  «на проверке» (STATUS и журнал W26 говорят «готов»)
- [ ] пройдено независимое ревью с вердиктом «замечаний нет»

## Проектные решения (зафиксированы при взятии, до сборки)

- **Граница флоу по ADR-0015/ADR-0016.** Три касания: `events-list`
  (команда `/events` + тоггл будущие/прошедшие — один вопрос, один флоу),
  `my-regs` (команда `/myregs` — список регистраций с QR-кнопками),
  `my-reg-cancel` (колбэки отмены: запрос → подтвердить/оставить — один
  вопрос со всеми ответами, один флоу). QR-кнопка — `web_app`-URL на
  `ticket.html?event_id=`, отдельного касания не требует (как в `reg-phone`).
- **Даты — в CODE-шаге, не в фильтре.** Диапазонные `gt`/`lt` по `DATE` не
  работают ни в MCP, ни в qadam'е ([Q15](../OPEN-QUESTIONS.md#q15), вариант 1):
  читаем `events` по `status eq published` и делим на будущие/прошедшие в коде.
- **Источник истины об отмене — `status`, не `cancelled_at`.**
  Очистить DATE-поле нечем ([DATA-MODEL.md](../DATA-MODEL.md#cancelled_at--не-источник-истины-о-статусе-q30-2026-09-12)):
  реактивированная строка несёт старый `cancelled_at`. Фильтры и счётчики —
  только по `status`.
- **PAR-5 — две проверки, не одна.** Кнопка «Отменить» не рисуется при
  `now >= starts_at` (требование BACKLOG — «исчезает»), плюс серверная
  проверка в `my-reg-cancel` (`cancel.too_late` при гонке). Скрытая кнопка
  без серверной проверки — не выполнение.
- **Тексты — во входе `texts` CODE-шагов** (ADR-0014, механизм
  `catalog/snippets/ru-texts.md`): ключи `events.list.*`, `myreg.*`,
  `cancel.*` уже заготовлены в `i18n/ru.json`. В шагах отправки литералов нет.
- **Точки врезки в `tg-router`** (живой, `nyaBzgKGG8TTTsryjc9tW`): новые
  маршруты в `step_10` (команды `/events`, `/myregs`; колбэки отмены) +
  новые ветки `step_11` + `callFlow queue/fire-and-forget` по образцу
  `step_12→15`. Команды имеют приоритет над активной сессией — как
  `/start e…`, `/newevent`, `/editevent` сегодня (новый вход перекрывает
  недоведённый диалог).

## Как проверено

> Все прогоны — после `ap_lock_and_publish`, выводы скопированы сюда.
> `step_1` (ack) во всех прогонах падает с `400 query ID is invalid` — это
> ожидаемо: в тестах нет живого `callback_query_id`; `continueOnFailure`
> пропускает дальше. Живой ack проверяется только реальным нажатием кнопки.

- `events-list` upcoming (`QI9obfFpY4ECSK5CTviGn`) → «Будущие ивенты / Демо-ивент
  W26 — 20 сентября 2026 г. в 19:00» + тоггл, доставлено (msg 1918)
- `events-list` past (`ABP5aOIDCrZai6tZK0eet`, `callbackData: ev:list:past`) →
  «Прошедшие ивенты / Пьянка — 22 марта 1995 г. в 22:00», доставлено (msg 1919)
- `my-regs` фикстура (`rLgmb6BzkLO6gKyFIOtXl` до правки проекции, `mSEInOm5crDHrcujIQTC9`
  после) → «Демо-ивент W26 — 20.09 в 19:00 — был на ивенте» + QR `web_app` +
  кнопка отмены (ивент будущий), доставлено (msg 1933)
- `my-regs` пустой (`cZjzS07NlSbsRVkNmvYkd`, чужой `telegram_id`) → «Регистраций
  пока нет.», клавиатуры нет вовсе, доставлено (msg 1922)
- `my-reg-cancel` confirm (`Akmq9H72bKO04ohCnmkPf`) → «Отменить регистрацию на
  «Демо-ивент W26»?» + «Да, отменить» / «Оставить», доставлено (msg 1923)
- `my-reg-cancel` keep (`FfLcG9q568twVNnJCKl2J`, `myreg:no`) → «Хорошо,
  регистрация оставлена.», доставлено (msg 1924)
- `my-reg-cancel` ok (`OUOAMP1cXAe9nhe9I8qwK`, синтетический `999000111` на
  `demo`) → upsert `updated` той же строки (id `59es0el…`, дубля нет),
  `status=cancelled`, `cancelled_at` проставлен, `registered_at` цел →
  «Регистрация на «Демо-ивент W26» отменена.», доставлено (msg 1925)
- `my-reg-cancel` too_late (`TwOCe59RUAQS9waEHjCZz`, тот же пользователь на
  прошедшем `emtzwtmr32apl`) → `outcome=too_late`, шага записи в прогоне нет,
  строка осталась `registered` → «Ивент уже начался…», доставлено (msg 1926)
- `my-regs` после отмены (`jmayWSMXmH4faeM4BzjkQ`) → «…Демо-ивент — отменена»
  без кнопок + «Пьянка — зарегистрирован» с QR, но без кнопки отмены —
  требование «кнопка исчезает» доказано тем же прогоном
- `my-reg-cancel` not_found (`3ZtZoTl1lEnt2mz96Jl2L`, чужой `999000112`) →
  «Активной регистрации не нашлось.», доставлено (msg 1928)
- Сквозной `tg-router /events` (`OT2j8QvrCfbroQ4J9kMka`, draft) →
  `route=events_list`, queue-вызов отработал в PRODUCTION (`KvrwakpR13CmB74vKeEQ1`,
  SUCCEEDED, msg 1929) — обёртка `flowProps.payload` доезжает
- Сквозной `tg-router /myregs` (`yxvW68ByzQGjHIwUIUaJB`) → `route=my_regs`
- Регресс `tg-router /start edemo-` (`Z8yLikDmgUQlDkXCWreNC`) → `route=reg_start`,
  все остальные ветки `false` — правка `step_10` старые маршруты не задела
- Сквозной колбэк `myreg:cancel:demo` (`swVTwPvdcefXQSvjeJd8o`) → `route=my_reg_cancel`
- Синтетические строки (`59es0el…`, `9IywmjpY…`) удалены (`ap_delete_records`);
  фикстуры `demo`/`demo-322876545` не тронуты (чтение после прогонов подтверждает)

## Журнал

- **2026-09-13** — пакет взят: ветка `w06-lists-cancel`, STATUS → в работе.
  Живое состояние сверено через MCP: 18 флоу (`tg-router nyaBzgKGG8TTTsryjc9tW`,
  `reg-*`, визард, `fn-*`, `checkin-api`, `my-qr-api`), таблицы `events`
  (`bVtxmEkqb3dPwZ2FKljqk`), `registrations` (`a87VoexSxH2QEj4JBhSgn`),
  `sessions`, `users` на месте; фикстура `demo` жива. Коды `step_1`/`step_10`
  роутера прочитаны — классификация команд и маршрутизация понятны, врезка
  W6 идёт туда.
- **2026-09-13** — `events-list` собран (`UxuFOI7GvXaboDQZHHKSI`): при создании
  `ap_build_flow` пометил `step_2` невалидным, хотя `ap_validate_step_config`
  тот же конфиг принимает, — лечится пересохранением шага (`ap_update_step`
  тем же input). Замечание в журнал, а не в каталог: артефакт сборки, не
  свойство флоу. Та же история повторилась у обоих чтений `my-regs`.
- **2026-09-13** — первый прогон `my-regs` поймал баг до ревью: «demo — —
  был на ивенте». Причина — проекция `step_3` не включала `status`, а постфильтр
  в коде читал его же: фильтр выкинул все строки молча, не упав. Починено
  добавлением колонки в проекцию, перепроверено (`MB10QENUnkCV1X4jz74wx`).
  Урок записан в карточку `my-regs.md`: проекция и постфильтр обязаны покрывать
  одни и те же поля. Fail-closed здесь не сработал, потому что молчал код,
  а не платформа.
- **2026-09-13** — в `step_5 my-reg-cancel` при сборке опечатался текст
  (`?` без закрывающего `»` + пробел в хвосте) — поймано сверкой с `ru.json`
  глазами до прогонов, исправлено `ap_update_step`. Напоминание, что
  `check-texts.py` гоняет только ревьюер (нужен REST-экспорт), владелец
  сверяет руками.
- **2026-09-13** — из входа `my-regs/step_4` убраны два неиспользуемых ключа
  (`cancel.btn.*` — копипаст при сборке, код их не читает), перепубликовано,
  перепроверено (`mSEInOm5crDHrcujIQTC9`). Пустой вход лучше «запаса».
- **2026-09-13** — новый ключ `cancel.kept` добавлен только в `ru.json`
  (подтверждения «оставить» не было ни в одном пакете). `uz`/`en` не тронуты:
  по ADR-0014 они архив, а `strings` пуста — расхождения негде проявиться.
- **2026-09-13** — сборка завершена, каталог синхронизирован (3 карточки +
  `tg-router.md` + `overview.md` → 21 флоу), STATUS → на проверке. Тестовые
  сообщения ушли в личку владельца (msg 1918–1933) — dev-бот, ожидаемо.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- нет
