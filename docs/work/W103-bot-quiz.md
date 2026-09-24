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
`DE2d4DwGmtOgd1s7EyLqZ`, `tg-router` `7XN2bitvXcuHXOPFieWRl`, `menu`
`dZckEYYzOiEiE912a6hgn`, `reg-api` `9rwrhD8PZJbMNvpfDfJoD`.

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

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: <агент> · **Дата**: YYYY-MM-DD · **Вердикт**: замечаний нет | есть замечания

### Замечания

1. **блокер | важно | на будущее** — <что не так> — <флоу/шаг/файл> — <почему важно>
   - *Исправлено*: <что сделал владелец> (YYYY-MM-DD)

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
- **Контент и окно — плейсхолдеры**: 12 вопросов из обсуждения, окно
  `2026-09-23…2026-10-01`. Владелец заменяет на реальные перед событием.
- **Независимое ревью не запущено** (следующий шаг — review-agent).
