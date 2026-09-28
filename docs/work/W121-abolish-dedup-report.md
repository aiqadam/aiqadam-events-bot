# W121. Упразднить `dedup-report`

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W113b (готов), [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Убрать суточный `dedup-report` (W12b): после [ADR-0047](../adr/0047-unique-keys-and-types-after-audit.md)
(ключи объявлены на семи таблицах) отчёт потерял сигнал — `registrations`
структурно без дублей, `event_staff` считает штатные revoked+active, реальный
вопрос остался только у `broadcast_targets`. Решение владельца 2026-09-28 —
упразднить флоу, а не сужать.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| — (флоу удаляется) | dev `zOjCtJKlvYqmvthgITW4L` | — |

## Чек-лист готовности

- [x] на dev записана строка `delete` в `migrations` до удаления флоу;
- [x] `ap_delete_flow` по `dedup-report` (dev) — флоу нет в `ap_list_flows`;
- [x] ключи `dedup.*` сняты из `i18n/{ru,uz,en}.json` и из платформенных переводов dev;
- [x] `flows/dedup-report.json` и запись в `flows/_manifest.json` удалены;
- [x] `catalog/flows/dedup-report.md` удалён, `catalog/overview.md` без строки
      «Диагностика (опс)» и с актуальным числом флоу;
- [x] ссылки на W12b в `catalog/flows/manage-api.md`, `staff-accept.md`,
      `catalog/tables/event_staff.md`, `docs/DATA-MODEL.md` приведены к
      действительности (никто дубли не считает);
- [x] решение зафиксировано: новый ADR, ответ в Q42, строка в BACKLOG;
- [x] офлайн-проверки (`check-texts.py`, `check-commands.py`,
      `check-export-secrets.sh`, `check-agents.py`) — зелёные;
- [ ] независимое ревью, вердикт «замечаний нет».

**Не входит:** prod — по [ADR-0042](../adr/0042-two-environments-one-repo.md)
это хотфикс в окно cutover (хвост пакета).

## Как проверено

- **Живой dev через MCP.** До удаления — `ap_insert_records` строки
  `2026-09-28-w121-01` (`action: delete`, `object: flow:dedup-report`) в
  `migrations`; затем `ap_delete_flow zOjCtJKlvYqmvthgITW4L` → «permanently
  deleted»; `ap_list_flows name=dedup` → 0 флоу; `ap_list_translations key=dedup`
  → «No translations found». Все пять ключей `dedup.*` удалены по id; ни один
  флоу на них не ссылался (ответ инструмента).
- **Репозиторий.** `flows/_manifest.json` — 30 записей (было 31),
  `flows/dedup-report.json` и `catalog/flows/dedup-report.md` удалены,
  `catalog/overview.md` — 31 флоу (30 наших + чужой `ChatBot`), группы
  «Диагностика (опс)» нет.
- **Офлайн.** `check-texts.py i18n/ru.json flows/*.json` — 30 флоу, 280 ссылок
  `$t`, 0 расхождений; `check-commands.py` — 30 флоу, 0 нарушений;
  `check-export-secrets.sh` — чисто; `check-agents.py` — 0 нарушений; ключи
  `ru`/`uz`/`en` — по 441 (паритет сохранён).

## Журнал

- **2026-09-28** — пакет взят (ветка `w121-abolish-dedup-report`). Решение
  владельца — удалить, не отключать; prod не трогать в этом пакете.
- **2026-09-28 — решения при сборке.**
  1. **Строка `migrations` — до удаления**, `commit: "-"` (хэш ещё не
  существовал; дозапись хэша после коммита — если понадобится, конвенция
  допускает `-`).
  2. **`delete`, не `disable`.** Это упразднение: флоу не оставляем «мёртвым
     грузом», а его прогоны — история, восстановимая из git.
  3. **Ключи `dedup.*` сняты с платформы**, а не только из репозитория:
     иначе платформенные переводы разошлись бы с `i18n/` (W25, ADR-0045).
  4. **`docs/adr/0047` не правится** (ADR не редактируется задним числом);
     строка «`dedup-report` остаётся полезной» перекрыта ADR-0049.
- **2026-09-28 — зачистка ссылок.** Кроме очевидных карточки и overview
  приведены к действительности: `manage-api`/`staff-accept`/`event_staff`
  (ссылались на «считает W12b»), `DATA-MODEL` (два present-tense), BACKLOG
  W14-блок про контролёров, Q42, Q-«report-digest» (ссылался на удалённую
  карточку как образец — заменён на `reminders`), `I18N.md` (флоу без локали).
  ROADMAP/STATUS-история и закрытые ADR не переписываются.
- **2026-09-28 — правки по ревью (круг 1).** Два «важно»: present-tense про
  живой `dedup-report` в Q18 (стр. 881–900) и строка W12b в таблице «Осталось»
  критического пути `docs/BACKLOG.md:56` — исправлены.

## Ревью

- **Ревьюер**: независимый агент-ревьюер (чистый контекст), **дата**: 2026-09-28
- **Вердикт**: есть замечания

### Проверено (живой проект через MCP + офлайн-проверки)

- **dev `app-flow-events-dev`.** `ap_list_flows name=dedup` — 0 флоу. Полный
  `ap_list_flows` — **31** флоу: 30 наших ENABLED/published + чужой `ChatBot`
  (`Ap06RmygApT4oFAylYfpu`, `@aiqadam/qadam-forms`). Совпадает с
  `catalog/overview.md` (31 = 30 + ChatBot) и с `flows/_manifest.json`
  (**30** записей, `dedup-report` в нём нет).
- **`migrations` (dev, `NCZNGuWh6PFs1JZXRPNTE`).** `ap_find_records` по объекту
  `flow:dedup-report` — 6 строк: `create`/`publish` W12b (prod-`flowId`
  `PNjhVFpxwOyR8fVkJAR4p`), `publish` W100, `create` W106 (dev
  `zOjCtJKlvYqmvthgITW4L`), `publish` W25 (`FJlEZptnn7s25Hzt7VpNp`).
  **Последняя по объекту** — `delete` `2026-09-28-w121-01`,
  `applied_at 2026-09-28T03:43:34Z`, `object_id zOjCtJKlvYqmvthgITW4L`,
  `version_id -`, `commit -`, `package W121`. Флоу живьём нет → инварианты
  `check-migrations.py` B2 (delete в конце + флоу не живой), B4 (delete
  пропускается) и C (id/action/version_id/commit) сходятся.
- **Офлайн-проверки — все exit 0.** `check-texts.py i18n/ru.json flows/*.json`
  — 30 флоу, 280 ссылок `$t`, 0 расхождений; `check-commands.py` — 30 флоу,
  0 нарушений; `check-export-secrets.sh` — чисто (0 совпадений токена/hex,
  `variables`/`connections` ссылками); `check-agents.py` — 0 нарушений.
  `i18n/{ru,uz,en}.json` — по **441** ключу, `dedup.*` нет ни в одном,
  паритет наборов полный (`uz`/`en` vs `ru`: missing 0, extra 0).
- **Репозиторий.** `flows/dedup-report.json`, `catalog/flows/dedup-report.md`
  и запись в `_manifest.json` удалены; `catalog/overview.md` — 31 флоу без
  строки «Диагностика (опс)»; ссылок на удалённую карточку из живых
  документов нет (остались только в журналах W12b/W113b — история);
  `grep -rn dedup-report flows/` — вызовов нет; `catalog/`
  (`manage-api`, `staff-accept`, `event_staff`) и `docs/DATA-MODEL.md`,
  `docs/I18N.md` приведены к ADR-0047/0049 корректно; `docs/adr/README.md`
  содержит строку 0049.
- **Чего проверить не удалось (честно).** `ap_list_translations` в наборе
  инструментов ревьюера отсутствует, `QADAM_API_KEY` на машине не задан,
  `security`/Keychain нет — поэтому **живые платформенные переводы `dedup.*`
  и прогон `tools/check-migrations.py` не выполнялись** (скрипт упал
  fail-closed с кодом 2: «ключа нет»). Переводы подтверждены косвенно: ни один
  из 30 флоу не ссылается на `dedup.*`, ключей нет ни в одном `i18n/*.json`;
  `migrations` сверена вручную по записям (см. выше).

### Замечания

1. **важно** `docs/OPEN-QUESTIONS.md`, Q18 (стр. 881–900) — остались
   present-tense утверждения, что `dedup-report` жив: «с W12b тем же путём
   **отчитывается** `dedup-report` — всем строкам `staff`» и «`dedup-report`
   — всем строкам `staff` (W12b; **сейчас** это ровно владелец проекта)».
   Флоу удалён, а читается как действующий. Q42 получил «Дополнение
   2026-09-28», Q18 — нет, хотя журнал («зачистка ссылок… Q18/Q42») заявляет
   обратное (подтверждено: в ветке `OPEN-QUESTIONS.md` менялся только в трёх
   хунках — 48, 2863, 3823; Q18 не тронут). Добавить в Q18 такой же
   однострочный апдейт об упразднении, как в Q42.
2. **важно** `docs/BACKLOG.md:56` — W12b стоит в таблице «Осталось, в порядке
   взятия (критический путь v0.1)» с описанием «диагностика дублей строк —
   считать и сообщать, не удалять». Это живой planning-документ, а не история:
   раздел `## W12b` ниже уже несёт баннер «Упразднён 2026-09-28», но его
   строка в «Осталось» продолжает числить удалённый флоу незакрытой работой
   критического пути. Убрать строку или пометить «упразднён». (Строка
   `docs/STATUS.md:111` и журналы `docs/work/*` — история, их не трогаем.)

**Чего в замечаниях нет:** блокеров нет; секретов и небезопасного вывода
удаление не привнесло (AppSec-блок неприменим: пакет только удаляет); ссылки
на ADR-0047/0049 корректны; закрытые ADR (0045/0047) и ROADMAP задним числом
не переписаны — ADR-0049 прямо фиксирует перекрытие строки ADR-0047.

## Ответ владельца (2026-09-28, круг 1)

1. **Исправлено.** Q18: present-tense заменён на прошедшее время с пометкой
   «упразднён 2026-09-28, [ADR-0049](../adr/0049-abolish-dedup-report.md)» в
   обоих местах; последнее предложение переформулировано про отчёты фоновых
   флоу вообще, а не про W12b.
2. **Исправлено.** `docs/BACKLOG.md:56`: строка W12b в таблице «Осталось»
   помечена как упразднённая со ссылкой на ADR-0049/W121.

## Хвосты и блокеры

- **prod**: `dedup-report` (prod `PNjhVFpxwOyR8fVkJAR4p`) остаётся ENABLED —
  снять хотфиксом в окно cutover (ADR-0042).
