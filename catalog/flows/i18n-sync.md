# Flow: i18n-sync

- **Статус**: не существует. Не восстановлен после очистки инстанса
  `events-dev` ([W26](../../docs/work/W26-rebuild-on-one-touch.md)) и
  намеренно не входит в W26 ([ADR-0014](../../docs/adr/0014-russian-only-until-platform-i18n.md)):
  проект временно говорит только по-русски, строки — литералом во входах
  CODE-шагов, таблица `strings` никем не читается.
- **Возврат** — пакет [W25](../../docs/BACKLOG.md#w25-возврат-i18n-на-платформенном-механизме),
  не раньше, чем закроется [qadam-flow#420](https://github.com/aiqadam/qadam-flow/issues/420).

Прежняя реализация (cron-синхронизация `i18n/*.json` → таблица `strings`,
ru/uz/en) — в истории git (см. `docs/work/W03-i18n.md`), не как текущая спека.
