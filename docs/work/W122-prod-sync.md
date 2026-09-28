# W122. Перенос dev→prod: W109–W121 + i18n (хотфикс ADR-0042)

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W109, W112, W113b, W114, W116, W119, W120, W121 (все `готов` на dev)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Догнать `events-prod` до `events-dev` по пакетам, применённым на dev после
копии 2026-09-26 и хотфикса W107. Prod — замороженная копия, меняется только
осознанным хотфиксом через MCP `app-flow-events-prod` (ADR-0042 п. 2).

## Объём (сверка `migrations` prod: строк W109–W121 нет)

**Фаза 1 — средовые механики, от i18n не зависят:**

| Пакет | Что | Точки |
|-------|-----|-------|
| W112 | `logOutput: false` | триггер `tg-router` + 24 шага, 11 флоу |
| W109 | per-row `__clear` `cancelled_at` | `reg-consent-pdn/step_5`, `reg-api/step_11`/`step_18`, `reg-profile/step_23`/`step_29` |
| W113b | `DECLARE_KEY` | `users`, `registrations`, `sessions`, `staff`, `feedback`, `quiz_attempts`, `quiz_answers` |
| W121 | удалить `dedup-report` | prod `PNjhVFpxwOyR8fVkJAR4p` пока ENABLED |

**Фаза 2 — i18n и язык/город:**

| Пакет | Что |
|-------|-----|
| W25/W27 | каталог платформенных переводов + `defaultLocale=ru` + `localeSource` `tg-router`, перевод `texts` на `{{$t[...]}}` |
| W114 | язык: карточка `ob:lang`, `set_lang`, `step_27` effective lang |
| W116 | `reg-api/step_9` получает `lang` |
| W119/W120 | город «Вы из Ташкента?» да/нет, снятие алиасов |
| W115/W117 | Mini App: переключатель языка, тихий вид |

## Различия сред (из сверки 2026-09-28)

- prod `reg-profile`/`reg-start` несут **литеральные** тексты, не `{{$t[...]}}`;
  у prod нет переводов W25/W27 (копия снята 2026-09-26, W25 — 2026-09-27).
- prod MCP **не отдаёт** инструменты переводов (`ap_upsert_translations`,
  `ap_list_translations`) — каталог на prod заливает владелец через UI.
- `tables` на prod: в схеме `tables-upsert-records` виден Clear Columns, но
  `__clear` пробуется точечно.
- prod `dedup-report` ENABLED — снимается фазой 1d.

## Чек-лист готовности

- [ ] W109, W112, W113b, W121 применены на prod, флоу опубликованы;
- [ ] каталог переводов и `defaultLocale=ru` на prod (владелец, UI);
- [ ] W25-конвертация `texts` и `localeSource` на prod;
- [ ] W114/W116/W119/W120 применены на prod;
- [ ] Mini App prod пересобран и задеплоен;
- [ ] строки `migrations` на prod по каждой правке;
- [ ] `catalog/environments.md` отражает расхождения/состояние;
- [ ] независимое ревью, вердикт «замечаний нет».

## Журнал

- **2026-09-28** — Пакет взят по прямому запросу владельца: «накатим на prod
  правки из dev», объём — «всё, вместе с i18n». Сверка `migrations` prod
  (`package in W109…W121`) — **0 строк**; dev — 30 строк W109–W121.
  Оба MCP-инстанса подняты, prod холодный старт со второй попытки.

## Хвосты и блокеры

- Импорт переводов и `defaultLocale` на prod — действие владельца в UI
  (MCP prod без инструментов переводов).
- Mini App prod — отдельный репозиторий/ветка (`aiqadam/aiqadam-events-bot-prod`,
  ветка `prod`), деплой владельцем или через CI.
