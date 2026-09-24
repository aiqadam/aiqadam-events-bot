# W103. Викторина в боте: свободный ответ, окно, одна попытка

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: —
- **Начат**: 2026-09-24 · **Закрыт**: —

## Цель

Провести гостя стойки через викторину целиком в чате бота: онбординг уже есть,
вход — кнопкой «Викторина» в меню. 10–15 вопросов, ответ — свободный текст,
один раз на человека, окно `starts_at`/`ends_at`. Ответы просто записываются;
победителей владелец определяет вне системы (выгружает таблицу и отдаёт ИИ).
Ни скоринга, ни лидерборда, ни страницы Mini App.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `quiz` | `6wceNeNPjDvHW7zXOOBi2` (ext `WE8CzyJMuEnEXm1iBufk7`) | [catalog/flows/quiz.md](../../catalog/flows/quiz.md) |
| flow `quiz-answer` | `g2CN4zwC3cJXj59bCYOMR` (ext `dCl7H1XhNWfqDx5BMR4UA`) | [catalog/flows/quiz-answer.md](../../catalog/flows/quiz-answer.md) |
| таблица `quizzes` | `onPqavTOslmDuytZ5ErDf` (ext `RA6NwbSZw7rGtcYW7dB9x`) | [catalog/tables/quizzes.md](../../catalog/tables/quizzes.md) |
| таблица `quiz_questions` | `dJvacDTJfkv3GUwY2CBZs` (ext `Uow3rhLvdObG1mBdUcxuS`) | [catalog/tables/quiz_questions.md](../../catalog/tables/quiz_questions.md) |
| таблица `quiz_attempts` | `LWUEI27IwYuV9sXOVBw4R` (ext `JPo7yK4N9lxN8HxBwpmRs`) | [catalog/tables/quiz_attempts.md](../../catalog/tables/quiz_attempts.md) |
| таблица `quiz_answers` | `0XbW7Mm9jS8rO9T3PFX3Y` (ext `tcwKTQH8W1EG4SHeHdoRr`) | [catalog/tables/quiz_answers.md](../../catalog/tables/quiz_answers.md) |

Правки живых флоу: `tg-router` (`step_10` маршруты, `step_11` ветки `quiz`/
`quiz_answer`, `step_24`/`step_25`), `menu` (`step_14` чтение `quizzes`,
`step_11` кнопка), `reg-api` (ветка `delete_account`: `step_40→45` — удаление
`quiz_answers`/`quiz_attempts` вызывающего), `i18n/ru.json` (ключи `quiz.*`,
`menu.btn.quiz`).

ID опубликованных версий: `quiz` `NWzlzmSOieVWIrU4hlR1J`, `quiz-answer`
`0qb8WuWk3LvRSJN2LniKE`, `tg-router` `92PCVEseESWMxOZCKKBOX`, `menu`
`dZckEYYzOiEiE912a6hgn`, `reg-api` `9rwrhD8PZJbMNvpfDfJoD` (последние две —
после правок по ревью).

## Чек-лист готовности

- [x] таблицы `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers` заведены, DATA-MODEL и `catalog/tables` обновлены;
- [x] флоу `quiz` собирает ответы, ведёт окно, держит одну попытку, пишет `elapsed`/`late`;
- [x] `tg-router`: маршрут `qz:` и свободный ввод `q_await_*` (перекрывает меню-фолбэк);
- [x] `menu`: кнопка «Викторина»;
- [x] тексты в `i18n/ru.json`, `tools/check-texts.py` — 0 расхождений (31 флоу, 264 пары);
- [x] положительный прогон (полное прохождение) и отрицательные (вне окна, повторный вход, не-текст) — на TESTING, не на живом боте;
- [x] экспорт `flows/*.json` (quiz, quiz-answer, tg-router, menu, reg-api) через MCP, `tools/check-export-secrets.sh` — чисто;
- [x] `delete_account` в `reg-api` чистит `quiz_answers`/`quiz_attempts` (W103);
- [x] `catalog/` совпадает с живым проектом (карточки `quiz`, `quiz-answer`, `tg-router`, `menu`, `reg-api`, 4 таблицы, `overview`, `tables/README`).

## Как проверено

Все проверки — `ap_test_flow`/`ap_test_step` в TESTING (прогоны на инстансе
`events-dev`), фикстура владельца `telegramId 322876545`; тестовые ответы и
попытка владельца удалены после проверок, сессия очищена.

- **вход, полный путь**: `quiz` (run `FDFucHlvFWVHHA4l9qtGQ`) → `active:true`,
  `quizId:booth1`, `count:12`, `outcome:start`; `step_7` создал попытку,
  `step_8` — сессию `q_await_answer`, `step_9` отправил вопрос 1 (Bot API `200`);
- **ответ**: `quiz-answer` (run `QglmuGobvIDvbEBdY2yAl`) → `outcome:next`,
  `elapsed_ms:13069`, `late:true`, ответ записан (`action:created`), сессия
  переведена на `idx:2`, отправлен вопрос 2;
- **финал**: сессия выставлялась на `idx:12` — `quiz-answer` (run
  `fjEiu0V6I4su4XkrSjWlZ`) → `outcome:finish`, ответ записан, `quiz_attempts.finished_at`
  проставлен, сессия закрыта (`scenario='-'`, `step='-'`), отправлен `quiz.done`;
- **повторный вход**: `quiz` (run `FvY72yNwqY0NkbLTmzutP`) → `outcome:reply`,
  текст «Вы уже прошли викторину» (попытка завершена);
- **окно закрыто**: `ends_at` временно в прошлом → `quiz` (run `QiwIBTlwf7MbsDs65u46V`)
  → `outcome:reply`, «Викторина сейчас не идёт»; `ends_at` восстановлен;
- **маршрутизация tg-router**: колбэк `qz:start` (run `CTRhQ9MvFelHxKDyHiJtP`)
  → `step_10 route:quiz`, ветка `quiz` выбрана, `step_24` вызвал `quiz`;
  текст при сессии викторины (run `43PVt1OnaNKB6QlTbMJQI`) → `route:quiz_answer`,
  ветка `quiz_answer`, `step_25` вызвал `quiz-answer`; фото (run
  `sHzenmq48sYGgos9S5Icd`) → `route:none`, `Otherwise` (ответом не считается);
- **кнопка гостя**: `menu` для не-staff профиля (run `kOql1WMFTZdPOrTBUDw5h`)
  → `reply_markup` первой строкой `[Викторина / qz:start]`, затем `События`;
- `ap_validate_flow` — `quiz` 12/12, `quiz-answer` 16/16, `tg-router` 26/26,
  `menu` 15/15.

Контент для стоенда: одна викторина `booth1` «Викторина у стойки», 12 вопросов
(черновик владельца — в BACKLOG/обсуждении), окно `2026-09-23…2026-10-01` —
**плейсхолдер, владельцу заменить на реальное**.

## Журнал

- **2026-09-24** — пакет взят. Решения владельца из обсуждения: вход кнопкой в
  меню (QR на стойке — обычная ссылка на бота, онбординг не трогаем); ответ —
  свободный текст, вариантов нет; таймер «10 секунд» проверяется **по факту
  ответа** (`elapsed` пишется, поздно — флаг `late`, не режем), активного
  отсчёта `Delay` нет; брошенная попытка — старт сначала; завершённую перепройти
  нельзя; скоринг/лидерборд/страница не делаются; выгрузка — чтение таблицы.
- **2026-09-24** — два флоу, не один: вход (колбэк) и ответ (текст) — разные по
  устройству касания ([ADR-0015](../../docs/adr/0015-one-touch-one-flow.md)),
  поэтому `quiz` и `quiz-answer`, а не один роутер. Внутри каждого — свой
  ROUTER (`start`/`reply` и `next`/`finish`/`reply`), пустую ветку от
  `ap_build_flow` удаляли (`ap_delete_branch`, индекс 0).
- **2026-09-24** — «10 секунд» — метка, не отказ: `elapsed` считается от
  отправки вопроса ботом (`draft.shownAt`), активный `Delay`-флоу отброшен
  (платформа не держит секунды точно). Следствие: пока гость не ответит, вопрос
  ждёт; на стойке это никого не блокирует.
- **2026-09-24** — `table_id`/`field.id` в шагах `tables`: `table_id` —
  externalId таблицы, но `field.id` в фильтрах сработал и по **внутреннему**
  id (`0bP9eErHjkFZuPDAmrJCQ` в `quiz/step_3` вернул ровно 12 вопросов). В
  `values` upsert — только externalId полей (гоча 1).
- **2026-09-24** — тестовый вход триггера `telegram-bot` — **сам `update`**,
  без обёртки; у `callableFlow` — `{"data": {...}}`. Обёртка `{"update": {...}}`
  у Telegram-триггера даёт `step_1 → ok:false`, все поля пусты — и `route:none`
  без ошибки (тихий промах). Проверять шаги роутера прогоном **всего** флоу:
  `ap_test_step` подхватывает сохранённый sample предыдущих шагов и врёт.
- **2026-09-24** — после публикации любого флоу **не прогонять тесты до
  экспорта**: `ap_test_*` переводит версию в DRAFT (гоча 14). Экспорт снимался
  сразу после `ap_lock_and_publish`.
- **2026-09-24** — экспорт через MCP без ключа: `ap_export_flow` возвращает
  черновик/опубликованную версию, но `tools/export-flow-mcp.py` требует файл с
  сырым ответом. Полные ответы лежат в базе сессии
  (`~/.local/share/opencode/opencode.db`, таблица `part`,
  `json_extract(data,'$.state.output')`), а если ответ был обрезан — ещё и в
  `~/.local/share/opencode/tool-output/`. Так сняты `quiz`, `quiz-answer`,
  `menu` (из БД) и `tg-router`, `reg-api` (из `tool-output`), затем
  `export-flow-mcp.py` записал `flows/*.json` и манифест (31 флоу).
- **2026-09-24** — `delete_account` в `reg-api` дополнен удалением
  `quiz_answers`/`quiz_attempts` (хвост W103): `step_40→45` вставлены **между
  петлёй `sessions` и чтением `users`** (`AFTER step_34`), профиль по-прежнему
  удаляется последним; проекция — только `quiz_id`, чтобы текст ответа не
  попадал в лог прогона (Q31).
- **2026-09-24** — независимое ревью (агент-ревьюер, живой MCP): блокеров и
  «важно» нет, три «на будущее». Два исправлены сразу:
  (1) **ack колбэка** `qz:start` — `tg-router/step_26` в ветке `quiz`, до
  вызова `quiz` (как W99 у `menu_cb`), иначе Telegram держал «часики»;
  (2) **закрытие окна гасит сессию** — `quiz-answer/step_16` в ветке `reply`
  пишет `scenario='-'`/`step='-'`, иначе текст после закрытия окна уходил в
  `quiz_answer` вместо меню-фолбэка W73. Оба перепубликованы и экспортированы
  заново; третий пункт (перезапуск недоделанной попытки не стирает старые
  строки `quiz_answers`, а перезаписывает их лениво) — оставлен хвостом.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: review-agent (opencode-go/deepseek-v4.1-flash, чистый контекст) · **Дата**: 2026-09-24 · **Вердикт**: **есть замечания** — блокеров и «важно» нет; три замечания уровня «на будущее». Пакет может идти в `готов` после того, как владелец заведёт их в хвосты/OPEN-QUESTIONS (чинить сейчас не требуется).

### Замечания

1. **на будущее** — ADR-0041 п.2 обещает при повторном входе в недоделанную викторину «стереть её и начать сначала», а реализация стирает только сессию: `quiz/step_8` перезаписывает `sessions.draft` на `idx:1`, но старые строки `quiz_answers` физически не удаляются — они перезаписываются по ключу лишь по мере повторных ответов (`quiz-answer/step_7`/`step_10`); шагов `tables-delete-record` в `quiz`/`quiz-answer` нет. Завершённая попытка не страдает (на ней все вопросы перезаписаны), но брошенная-и-перезапущенная-и-снова-брошенная оставляет устаревшие `quiz_answers` для вопросов, не отвеченных в новом проходе. Победителей это не ломает (завершённость — по `quiz_attempts.finished_at`), однако формулировка ADR и поведение расходятся. — `quiz`/`step_8`, `quiz-answer` (ветки `next`/`finish`) — свести ADR к реализации (в каталоге так и описано) либо добавить удаление старых строк при старте заново; зафиксировать решение.

2. **на будущее** — закрытие окна по ходу викторины не закрывает сессию: `quiz-answer/step_5` в ветке `reply` отвечает `quiz.closed`, но `sessions` остаётся `scenario=quiz`, `step=q_await_answer` (закрывает её только финал, `step_12`). До истечения суточной свежести `tg-router/step_8` сессия жива, `step_10` продолжает уводить любой обычный текст в `quiz_answer`, и гость получает `quiz.closed` вместо меню-фолбэка W73. — `quiz-answer` (ветка `reply`) / `tg-router/step_10` — UX-мелочь; лечится закрытием сессии и в ветке «окно закрыто».

3. **на будущее** — колбэк `qz:start` не подтверждается: `tg-router/step_24` только зовёт `quiz`, `answer_callback_query` не вызывается (в `tg-router` он один — `step_22` ветки `menu_cb`, W99). Telegram держит прогресс на кнопке до `answerCallbackQuery`; на логику викторины не влияет, но клиент показывает «часики» до ~30 с. — `tg-router` (ветка `quiz`) — если подтвердится живым тапом на реальном боте, добавить ack рядом с вызовом, как для `menu_cb`.

### Что проверено

- **Живой проект (MCP, `app-flow-events-dev`)** — `ap_flow_structure`/`ap_read_step_code` по `quiz` (`6wceNeNPjDvHW7zXOOBi2`, 12 шагов), `quiz-answer` (`g2CN4zwC3cJXj59bCYOMR`, 16), `tg-router` (`nyaBzgKGG8TTTsryjc9tW`, 26), `menu` (`1DORFhP9F3W00KpKz5wDw`, 15), `reg-api` (`SiYL8m6k4oy4YunAdZ1W7`, 46); `ap_validate_flow` — 12/12, 16/16, 26/26, 15/15, 46 (45 valid, 1 skipped `step_12`, W60). Структуры, входы CODE и роутеры совпадают с `catalog/flows/*`.
- **Логика окна/одной попытки/`elapsed`/`late`** — прочитан код `quiz/step_2/step_5`, `quiz-answer/step_2/step_5`: окно `now ∈ [starts_at, ends_at]` (выбор позднейшей), `finished_at` как замок одной попытки, `elapsed = now - shownAt`, `late = elapsed > 10000`, ответ обрезан до 500. Сентинел `__none__` в фильтрах на месте.
- **Различающие прогоны** — `quiz` вход `FDFucHlvFWVHHA4l9qtGQ` (`start`, попытка+сессия созданы, вопрос 1 отправлен), повтор после финала `FvY72yNwqY0NkbLTmzutP` (`reply`/`quiz.already`), окно закрыто `QiwIBTlwf7MbsDs65u46V` (`reply`/`quiz.closed`); `quiz-answer` финал `fjEiu0V6I4su4XkrSjWlZ` (запись ответа, `finished_at`, сессия `-`/`-`, `quiz.done`); `tg-router` `qz:start` `CTRhQ9MvFelHxKDyHiJtP` (`route:quiz` → `step_24`), текст при сессии `43PVt1OnaNKB6QlTbMJQI` (`route:quiz_answer` → `step_25`), фото `sHzenmq48sYGgos9S5Icd` (`route:none` → `Otherwise`); `menu` `kOql1WMFTZdPOrTBUDw5h` (`reply_markup` первой строкой `[Викторина / qz:start]`, затем `События`). Прогоны читал через `ap_get_run`, а не по журналу.
- **`reg-api` ветка `delete_account`** — живая структура и опубликованный экспорт: `step_40→42` (`quiz_answers`) и `step_43→45` (`quiz_attempts`) стоят после петли `sessions` и **до** чтения/удаления `users` (`step_36→38`), профиль удаляется последним; удаление по внутреннему id через `LOOP_ON_ITEMS` (паттерн, отработанный на `registrations`); проекция — только `quiz_id` (текст ответа/имя в лог не пишутся, Q31); фильтры — по `step_2.telegramId` из проверенного `initData`. IDOR-гейт `step_9` (`target.ne.telegramId → 403`) и обязательный `confirm: true` не задеты. Сквозной `delete_account` с данными викторины не прогонялся (заявлено хвостом журнала).
- **Таблицы** — `ap_list_tables`: `quizzes` (4 поля), `quiz_questions` (3), `quiz_attempts` (4), `quiz_answers` (8, `late` = dropdown `true`/`false`) совпадают с `catalog/tables/*` и `docs/DATA-MODEL.md` (id/externalId/типы). После тестов `quiz_attempts`/`quiz_answers` пусты (тестовые данные вычищены), `quizzes` — 1 строка `booth1`, `quiz_questions` — 12.
- **Экспорт ↔ инстанс** — `ap_export_flow` по пяти флоу: `quiz` `NWzlzmSOieVWIrU4hlR1J`, `quiz-answer` `DE2d4DwGmtOgd1s7EyLqZ`, `tg-router` `7XN2bitvXcuHXOPFieWRl`, `menu` `dZckEYYzOiEiE912a6hgn`, `reg-api` `9rwrhD8PZJbMNvpfDfJoD` — все `state: LOCKED` и равны `publishedVersionId` в `flows/_manifest.json`; `flows/*.json` в репозитории — `LOCKED`. `migrations`: строки `2026-09-24-w103-01…09` на месте, `version_id` совпадают с манифестом.
- **AppSec** — `telegram_id` в `quiz`/`quiz-answer` берётся из апдейта, в `reg-api` — из проверенного `initData`; пользовательский текст в Telegram уходит с `format: "None"` (разметка не инъектируется, имя не эхоится); IDOR/confirm в `reg-api` целы; новых секретов и значений в экспорте нет. CSV-выгрузки пакет не строит — CSV-инъекция к пакету не относится.
- **Офлайн** — `tools/check-texts.py i18n/ru.json flows/*.json` → 31 флоу, 264 пары, 0 расхождений; `tools/check-commands.py flows/*.json` → 0 нарушений; `bash tools/check-export-secrets.sh` → чисто (токен/ключ — ссылками, значений нет). `tools/check-migrations.py` **прогнать не удалось** — на машине нет ключа платформы (`QADAM_API_KEY`/Keychain); манифест ↔ инстанс сверен точечно по пяти флоу, остальные 26 записей W103 не менял (диф `_manifest.json` в `c034f04`/`547dfa7` — только `menu`, `tg-router`, `reg-api` + две новые записи `quiz`, `quiz-answer`). Пред-существующее расхождение (`ChatBot` есть в проекте, но не в манифесте) к W103 не относится — отсутствовал и до пакета.

## Хвосты и блокеры

- **`migrations`**: строки `2026-09-24-w103-01…08` (4 таблицы `create`, 4 флоу
  `publish`), плюс `w103-09` — публикация `reg-api`. Экспорт — файлы `flows/`
  и `_manifest.json` (source `mcp`), коммит `c034f04` + следующий.
- **Живой положительный на реальном боте не прогнан** (нужен тап по кнопке в
  Telegram и полное прохождение): проверено на TESTING, включая вызов
  `tg-router → quiz` end-to-end.
- **Удаление аккаунта с данными викторины живьём не прогонялось**: новые шаги
  `reg-api` (`step_40→45`) собраны по проверенному шаблону `find→loop→delete`
  и проходят `ap_validate_flow` (46 шагов), но сквозной `delete_account` с
  реальным `initData` и ответами викторины — отдельная проверка (сложно
  воспроизвести фикстуру).
- **Перезапуск недоделанной попытки не стирает старые ответы сразу** (находка
  ревью, «на будущее»): `quiz/step_8` сбрасывает только `sessions.draft`,
  старые `quiz_answers` перезаписываются по ключу по мере повторных ответов.
  Брошенная-перезапущенная-снова брошенная попытка может оставить строки
  с прежним `answered_at`. Для выгрузки ИИ это шум, а не потеря; лечение —
  `find→loop→delete` по `quiz_answers` в старте (`quiz`) при взятии хвоста.
- **Контент и окно — плейсхолдеры**: 12 вопросов из обсуждения, окно
  `2026-09-23…2026-10-01`. Владелец заменяет на реальные перед событием.
- **Независимое ревью не запущено** (следующий шаг — review-agent).
