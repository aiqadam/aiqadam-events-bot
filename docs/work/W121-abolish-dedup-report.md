# W121. Упразднить `dedup-report`

- **Статус**: в работе
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

- [ ] на dev записана строка `delete` в `migrations` до удаления флоу;
- [ ] `ap_delete_flow` по `dedup-report` (dev) — флоу нет в `ap_list_flows`;
- [ ] ключи `dedup.*` сняты из `i18n/{ru,uz,en}.json` и из платформенных переводов dev;
- [ ] `flows/dedup-report.json` и запись в `flows/_manifest.json` удалены;
- [ ] `catalog/flows/dedup-report.md` удалён, `catalog/overview.md` без строки
      «Диагностика (опс)» и с актуальным числом флоу;
- [ ] ссылки на W12b в `catalog/flows/manage-api.md`, `staff-accept.md`,
      `catalog/tables/event_staff.md`, `docs/DATA-MODEL.md` приведены к
      действительности (никто дубли не считает);
- [ ] решение зафиксировано: новый ADR, ответ в Q42, строка в BACKLOG;
- [ ] офлайн-проверки (`check-texts.py`, `check-commands.py`,
      `check-export-secrets.sh`, `check-agents.py`) — зелёные;
- [ ] независимое ревью, вердикт «замечаний нет».

**Не входит:** prod — по [ADR-0042](../adr/0042-two-environments-one-repo.md)
это хотфикс в окно cutover (хвост пакета).

## Как проверено

- <проверка> → <результат>

## Журнал

- **2026-09-28** — пакет взят (ветка `w121-abolish-dedup-report`). Решение
  владельца — удалить, не отключать; prod не трогать в этом пакете.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- **prod**: `dedup-report` (prod `PNjhVFpxwOyR8fVkJAR4p`) остаётся ENABLED —
  снять хотфиксом в окно cutover (ADR-0042).
