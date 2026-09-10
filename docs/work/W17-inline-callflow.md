# W17. Inline execution mode для `callFlow` на горячем пути

- **Статус**: в работе
- **Владелец**: агент W17
- **Волна**: 5
- **Зависит от**: W8, W5, W16
- **Начат**: 2026-09-11 · **Закрыт**: —

## Цель

Применить `executionMode: "inline"` (upstream [qadam-flow#363](https://github.com/aiqadam/qadam-flow/issues/363),
раскатано на инстансе) к синхронным `callFlow`-цепочкам горячего пути
(`checkin-api`, `registration`, `fn-event-card`) и перемерить латентность
тем же методом, что [Q22](../OPEN-QUESTIONS.md#q22)/W16 — before/after на
опубликованной версии. Подробности и чек-лист — [BACKLOG.md#w17](../BACKLOG.md#w17-inline-execution-mode-для-callflow-на-горячем-пути).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `checkin-api` | `CUKqiby1PoHiQiiCQy24V` | [catalog/flows/checkin-api.md](../../catalog/flows/checkin-api.md) |
| flow `registration` | `vfVfIngczCKA2DpUgcevP` | [catalog/flows/registration.md](../../catalog/flows/registration.md) |
| flow `fn-event-card` | `L1l2LOngDtxPHFSdRp5fE` | [catalog/flows/fn-event-card.md](../../catalog/flows/fn-event-card.md) |

## Чек-лист готовности

- [ ] before-прогон снят на текущей опубликованной версии (checkin-api, registration)
- [ ] схема `executionMode` подтверждена через `ap_get_piece_props`
- [ ] `fn-event-card`: callFlow-шаги переведены на `inline`, опубликовано
- [ ] `checkin-api`: callFlow-шаги переведены на `inline`, опубликовано
- [ ] `registration`: callFlow-шаги переведены на `inline` (кроме `tg-router → registration`), опубликовано
- [ ] after-прогон снят тем же методом, числа записаны в ADR-0009/Q22
- [ ] три различающих прогона STF-2 + позитивный контроль повторены на `checkin-api`
- [ ] IDM-1 (повторный `/start`) повторён на `registration`
- [ ] `catalog/` совпадает с живым проектом
- [ ] независимое ревью, вердикт «замечаний нет»

## Как проверено

> Заполняется по ходу.

## Журнал

- **2026-09-11** — пакет взят. Контекст: команда qadam-flow закрыла
  [issue #363](https://github.com/aiqadam/qadam-flow/issues/363) и раскатала
  `executionMode: "inline"` на `callFlow` (PR upstream #365, milestone v2.0.0).
  Это прямой ответ на [Q22](../OPEN-QUESTIONS.md#q22) — «пауза» между хопами
  была объявлена платформой фиксированной архитектурной стоимостью синхронного
  `callFlow` (до 3 циклов BullMQ-джобы + снапшот/resume), inline её убирает,
  исполняя ребёнка в engine-процессе родителя без джобы/снапшота/waitpoint.
  Из финального комментария в issue — жёсткое ограничение: inline-ребёнок
  никогда не должен паузиться (Delay/Human Input/вложенный `queue`-`callFlow`
  с ожиданием). Ни один subflow горячего пути такого не делает — все чистые
  CODE/tables-цепочки, проверено по каталогу перед стартом.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

## Хвосты и блокеры

- нет
