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
  W14-блок про контролёров, Q18/Q42, Q-«report-digest» (ссылался на удалённую
  карточку как образец — заменён на `reminders`), `I18N.md` (флоу без локали).
  ROADMAP/STATUS-история и закрытые ADR не переписываются.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- **prod**: `dedup-report` (prod `PNjhVFpxwOyR8fVkJAR4p`) остаётся ENABLED —
  снять хотфиксом в окно cutover (ADR-0042).
