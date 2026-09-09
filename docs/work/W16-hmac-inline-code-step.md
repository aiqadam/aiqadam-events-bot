# W16. HMAC в Code step: `fn-verify-init-data`, `fn-sign-qr`, `fn-verify-qr`

- **Статус**: в работе
- **Владелец**: агент W16
- **Волна**: 5
- **Зависит от**: W2 (готово), W8 (готово), [ADR-0010](../adr/0010-unsandboxed-code-step-for-crypto.md)
- **Начат**: 2026-09-09 · **Закрыт**: —

## Цель

Слить двухшаговые HMAC-цепочки (`crypto`-qadam + Code step) в одиночные CODE-шаги
через `node:crypto` (`AP_EXECUTION_MODE=UNSANDBOXED`, ADR-0010) в `fn-verify-init-data`
и `fn-sign-qr` — убрать секрет из логов прогонов (частичное закрытие ADR-0005),
и инлайнить ту же логику подписи в `fn-verify-qr` — убрать лишний вложенный
flow-run на каждый скан QR (латентность, не секьюрити).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `fn-verify-init-data` | — | [catalog/flows/fn-verify-init-data.md](../../catalog/flows/fn-verify-init-data.md) |
| flow `fn-sign-qr` | — | [catalog/flows/fn-sign-qr.md](../../catalog/flows/fn-sign-qr.md) |
| flow `fn-verify-qr` | — | [catalog/flows/fn-verify-qr.md](../../catalog/flows/fn-verify-qr.md) |

## Чек-лист готовности

> Из BACKLOG.md, W16.

- [ ] `fn-verify-init-data`: `step_2`+`step_3` → один CODE-шаг (node:crypto), без
      `secret_key` в выводе какого-либо шага
- [ ] `fn-sign-qr`: `step_2`+`step_3` → один CODE-шаг, наружу только `sig`
- [ ] `fn-verify-qr`: `step_2` (`callFlow → fn-sign-qr`) → инлайн той же логики
      подписи через `node:crypto`, без вызова subflow'а; контракт флоу не меняется
- [ ] `BOT_TOKEN` остаётся входом объединённого шага (не в скоупе — не трогать)
- [ ] независимая сверка HMAC даёт побайтово тот же `hashValid`/`sig`, что старая
      цепочка (те же входные данные, что при закрытии Q16)
- [ ] `ap_get_run` после `ap_lock_and_publish` показывает: ни производного ключа,
      ни полного HMAC-дайджеста в выводе объединённых шагов
- [ ] `fn-verify-qr` даёт тот же `sig`, включая путь с заглушкой (`eventId='x'`, `userId='0'`)
- [ ] три различающих прогона STF-2 из W8 повторены на новой версии, отказы те же
- [ ] три сценария IDM не задеты (сверить явно)
- [ ] `catalog/flows/fn-verify-init-data.md`, `fn-sign-qr.md`, `fn-verify-qr.md`
      обновлены, помечают зависимость от `AP_EXECUTION_MODE=UNSANDBOXED`;
      `fn-verify-qr.md` перестаёт называть `fn-sign-qr` зависимостью
- [ ] латентность `checkin-api` перемерена тем же методом (Q22), записана числом
- [ ] `docs/adr/0005-secrets-visible-in-run-logs.md` не редактируется
- [ ] AppSec-ревью: константное время сравнения, ориентация HMAC-аргументов,
      побайтовое совпадение продублированной логики подписи
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

> Заполняется по ходу.

## Журнал

- **2026-09-09** — пакет взят, создан журнал, ветка `w16-hmac-inline-code-step`.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

## Хвосты и блокеры

- нет
