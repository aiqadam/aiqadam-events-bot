# W2. Subflow-«функции»

- **Статус**: в работе
- **Владелец**: агент W2 (Claude Code, сессия barustamov)
- **Волна**: 2
- **Зависит от**: W1, шаги 0.1–0.3
- **Начат**: 2026-09-08 · **Закрыт**: —

## Цель

Собрать девять переиспользуемых subflow-«функций» (`fn-*`) в проекте `events-dev`:
`fn-t`, `fn-parse-start`, `fn-sign-qr`, `fn-verify-qr`, `fn-verify-init-data`,
`fn-fmt-time`, `fn-resolve-segment`, `fn-event-card`, `fn-find-registration`
([ARCHITECTURE](../ARCHITECTURE.md#subflowы-вместо-библиотеки)).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| — | — | — |

## Чек-лист готовности

- [ ] `fn-parse-start` корректно разбирает `c…`-payload, где **`sig` содержит дефис**
      (последние 10 символов — подпись, не `split('-')`)
- [ ] отбивается payload длиннее 64 символов и с символами вне `A-Za-z0-9_-`
- [ ] `fn-sign-qr` использует `crypto` qadam (`sha256`, `outputEncoding = base64`),
      а Code step только переводит base64 → base64url и режет до 10 символов
- [ ] `fn-verify-init-data` собран цепочкой из двух `hmac-signature`,
      где ключ второго — hex-вывод первого
- [ ] `fn-find-registration` при нескольких строках на `(event_id, telegram_id)`
      возвращает самую раннюю (ADR-0003)
- [ ] `fn-verify-qr` и `fn-verify-init-data` сравнивают **constant-time**
- [ ] `fn-verify-init-data` проверён на реальном `initData` и отвергает подделанный `hash`
- [ ] `fn-fmt-time` отдаёт ташкентское время для UTC-входа (OWN-3)
- [ ] `catalog/` совпадает с живым проектом
- [ ] пройдено независимое ревью, вердикт «замечаний нет»

## Как проверено

- <заполняется по ходу>

## Журнал

- **2026-09-08** — пакет взят, ветка `w02-subflows`.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

## Хвосты и блокеры

- —
