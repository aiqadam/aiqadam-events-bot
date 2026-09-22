# W91. Чекин отменённого события

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Сканирование QR отменённого события сейчас проходит как успех. Part 1 — вердикт
`event_cancelled` («Событие отменено»). Part 2 (ручной чекин, ADR-0036) — Phase 3.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-api` (step_13 + step_7) | `rKoDYtiIVdbzlW59b57uH` | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| Mini App `Scan.tsx` (вердикт) | — | — |

Изменения:
- `checkin-api`: новый шаг `step_13` (`tables-find-records events`, проекция
  `status`) между `step_6` и `step_7`; `step_7` читает `eventRows` и отдаёт
  `event_cancelled` при `status = cancelled` — после гейтов контролёра/подписи,
  но **до** проверки регистрации. `shouldCheckin` для этого исхода `false`,
  запись `checked_in_at` не происходит.
- `i18n/ru.json`: `checkin.event_cancelled`.
- `Scan.tsx`: вердикт `event_cancelled` (тон/иконка/подпись).
- Каталог обновлён; Part 2 (ручной чекин, ADR-0036) — не здесь.

## Чек-лист готовности

> Из [issue #143](https://github.com/aiqadam/aiqadam-events-bot/issues/143), Part 1.

- [x] скан QR отменённого события → «Событие отменено»
- [x] `i18n/ru.json`: `checkin.event_cancelled`
- [x] `check-texts.py`, `check-commands.py` зелёные
- [x] `catalog/flows/checkin-api.md`, экспорт и `_manifest.json` обновлены тем же коммитом
- [x] `catalog/` совпадает с живым проектом

## Как проверено

Живой прогон на `events-dev` (published `checkin-api`), `initData` и QR
подписаны временным флоу `zz-qa-mint` (переменные `BOT_TOKEN`/`QR_SIGNING_KEY`
читаются внутри Code step, значения не покидают инстанс; по решению владельца
2026-09-23). Временные данные после проверки удалены.

- Темп. событие `zzw91cancel` (`status=cancelled`) + контролёр +
  подписанный QR: `{"status":"event_cancelled","text":"Событие отменено"}`, HTTP 200.
- **Различающий регресс:** темп. событие `zzw91live` (`status=published`) +
  регистрация: `{"status":"ok","text":"Binali — отмечен"}`, HTTP 200 —
  гейт срабатывает только на `cancelled`, обычный чекин пишется.
- Первый прогон вскрыл ошибку: `table_id` был взят внутренним id
  (`ap_list_tables`), шаг падал `Table with externalId … not found`, весь
  `valid`-путь отдавал 500 — исправлено на externalId (`R4aSQpLZvw7d3u6DVOSjH`),
  перепубликовано, прогон зелёный.
- `check-texts.py` — 238 пар, 0 расхождений.

## Журнал

- **2026-09-23** — пакет взят. Временный минтинг-флоу `zz-qa-mint` создан и
  удалён; временные события/контролёр/регистрация удалены. `checkin-api` был
  на несколько минут сломан (500 из-за неверного `table_id`) — поймано
  первым же curl, исправлено до ухода с инстанса.

## Ревью

> Заполняет независимый ревьюер.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- Part 2 (ручной чекин) — Phase 3, ADR-0036.
