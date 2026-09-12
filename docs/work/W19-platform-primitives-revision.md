# W19. Ревизия после обновления образа Qadam Flow

- **Статус**: в работе
- **Владелец**: агент W19
- **Волна**: 5
- **Зависит от**: W8 (готов). **Не** W18 — см. «Журнал», запись от 2026-09-12
- **Начат**: 2026-09-12 · **Закрыт**: —

## Цель

Проверить, что даёт проекту обновление образа `sha-95079f6` → `sha-6445a8e`
([Q26](../OPEN-QUESTIONS.md#q26)), и применить то, что применимо без
архитектурного решения: проекцию колонок в чтениях с ПД и `secret_token`
на telegram-вебхуке. Пересмотр [ADR-0003](../adr/0003-idempotency-without-atomicity.md)
в объём пакета **не входит** — только постановка вопроса.
Чек-лист — [BACKLOG.md#w19](../BACKLOG.md#w19-ревизия-после-обновления-образа-qadam-flow).

## Что построено

Пакет ревизионный: новых флоу и таблиц не создаётся. Правки — в существующих.

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| (заполняется по ходу) | — | — |

## Чек-лист готовности

- [x] версия образа dev подтверждена и записана в журнал (prod не поднят — шаг 0.6 отложен)
- [x] `secret_token` на telegram-вебхуке проверен, результат зафиксирован —
  **неприменим**: вебхука у бота нет, доставка идёт long-polling'ом
- [ ] [Q25](../OPEN-QUESTIONS.md#q25), [Q17](../OPEN-QUESTIONS.md#q17) обновлены по фактической проверке
- [ ] чтения `users` с ПД: либо добавлена проекция колонок, либо записана причина не делать
- [ ] в OPEN-QUESTIONS заведён вопрос о пересмотре ADR-0003 со списком флоу-кандидатов
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

- `ap_research_pieces` по `@aiqadam/qadam-tables` и `@aiqadam/qadam-store`
  (2026-09-12) → на инстансе присутствуют `tables-upsert-records`,
  `tables-update-records` (батч, [#408](https://github.com/aiqadam/qadam-flow/pull/408))
  и `store : put_if_absent`. Ни одного из них не было в образе `sha-95079f6`,
  то есть образ обновлён до `6445a8e` или новее — эмпирически, по наличию
  действий, а не по сайдбару.

- Проверка `secret_token` (#397) вместо ожидаемого ответа дала другой факт:
  - `POST https://app.flow.aiqadam.org/api/v1/webhooks/Y1dNon2V2EhjWM0aYwdQi`
    с телом `{"update_id":999000001}` и **без** заголовка
    `X-Telegram-Bot-Api-Secret-Token` → **HTTP 409**,
    `{"message":"This flow receives events by polling, so it does not accept pushed deliveries."}`.
    Тело выбрано намеренно безопасным: гейт `step_3` классифицирует апдейт без
    `from.id` как `bad_update` и уводит в ветку Otherwise — то есть до `store put`
    и до любых отправок дело не доходит даже при успешной доставке.
  - `getWebhookInfo` через `ap_run_action` (`custom_api_call`, connection
    `TZTlXaCEO2hEvimUowbSA`, прогон `e22V6cLKge55G7hV4Rjas`) →
    `{"ok":true,"result":{"url":"","has_custom_certificate":false,
    "pending_update_count":0,"allowed_updates":["message","callback_query"]}}`.
  - Ingress вебхук-флоу не пострадал: `POST .../CUKqiby1PoHiQiiCQy24V/sync` → `401`
    `invalid_init_data/malformed`, `POST .../I5nd8ggKH4wkQLaww9Dkl/sync` → `200`
    `{ok:false, bad_event_id}`. Путь сканера цел.
  - Polling **работает**: десять PRODUCTION-прогонов `tg-router` 2026-09-12 в
    13:08:48–13:08:51, все `SUCCEEDED`, разные `update_id`; разобранный прогон
    `jAb16tiE4Zm5PyQ3IqSri` — настоящее сообщение владельца (`update_id 24020013`,
    `text: "выа"`), `step_3` дал `proceed: true, reason: ok, seen: false`.
- Прогон `jAb16tiE4Zm5PyQ3IqSri` — заодно прямое доказательство
  [Q17](../OPEN-QUESTIONS.md#q17): вывод `step_7` содержит строку `users`
  целиком, включая `phone` и оба consent-флага.

## Журнал

- **2026-09-12** — пакет взят. Проверка примитивов через `ap_get_piece_props`
  на живом инстансе дала три факта, каждый ложится на свой инвариант:
  - `tables-find-records` → проп **`columns`** (`MULTI_SELECT_DROPDOWN`),
    описание прямо называет причину: «Step outputs are recorded verbatim in
    the run log, so reading only the columns you need is also what keeps the
    rest out of it». Это [Q17](../OPEN-QUESTIONS.md#q17).
  - `tables-update-record` → проп **`only_if`** (`DYNAMIC`): «Use "Does not
    exist" to mean "only if this column is still empty" — that is how you
    write "record it only the first time"», при непопадании —
    `RECORD_PRECONDITION_FAILED`, а не тихий no-op. Это ровно IDM-2.
  - `store : put_if_absent` → `ttl_seconds` плюс «report whether this run is
    the one that took it». Это ровно IDM-4.
  - `tables-upsert-records` честно оговаривает границу: «The key is matched
    here, **not enforced by the table** — another write path can still insert
    one». То есть это не уникальный индекс, и в вопрос по ADR-0003 это войдёт
    как ограничение, а не как решение.
- **2026-09-12** — **поправка к Q26/BACKLOG**: проп проекции колонок на
  инстансе называется **`columns`**, а не `fieldIds`, как записано в Q26 по
  тексту апстримного PR [#407](https://github.com/aiqadam/qadam-flow/pull/407).
  Документ правится по факту с инстанса.
- **2026-09-12** — **расхождение в BACKLOG исправлено**: строка W19 гласила
  «Зависит от: W18 (готово)», тогда как в [STATUS.md](../STATUS.md) W18
  значится `не начат` и журнала `docs/work/W18-*.md` в репозитории нет.
  Написано авансом. Фактической блокировки нет: единственная связка W19 с W18 —
  пункт «убедиться, что журнал W18 не утверждает обратного», а утверждать
  пока нечему. Строка приведена к факту.
- **2026-09-12** — **главная находка пакета, и она не из чек-листа.** Пункт про
  `secret_token` (#397) оказалось нечем закрывать: обновление образа перевело
  telegram-триггер с вебхука на long-polling ([#393](https://github.com/aiqadam/qadam-flow/pull/393)),
  который Q26 отмёл как «к проекту не относится». Доказательства — в разделе
  «Как проверено». Что это меняет: пункт #397 неприменим (аутентифицировать
  нечего), публичного ingress у бота больше нет, обоснование отдельного бота
  сохраняется по другой причине (эксклюзивность `getUpdates`), а бюджеты
  латентности ADR-0009/Q22 для пути «написал боту → бот ответил» перестали быть
  измеренными — интервал опроса в них не входил. Поправлены: Q26, CLAUDE.md
  («Лимиты платформы»), `catalog/flows/tg-router.md` (строка триггера + заметка).
  Замер латентности polling-пути в объём W19 не входит — вынесен в хвосты.
- **2026-09-12** — `step_8` прочитан (`ap_read_step_code`), чтобы не гадать, какие
  колонки нужны: потребляются ровно `created_at` (ключ детерминированной
  сортировки), `lang`, `consent_pdn`, `consent_marketing` и `phone`, причём
  `phone` — **только** чтобы вычислить булев `phoneKnown`. `telegram_id`,
  `first_name`, `last_name`, `username`, `blocked_bot`, `consent_pdn_at`,
  `consent_marketing_at` не читаются ни одним потребителем.
- **2026-09-12** — владелец проекта (см. ветку обсуждения) **заказал**
  пересмотр ADR-0003 отдельным пакетом. На объём W19 это не влияет: W19
  по-прежнему только ставит вопрос, решение и реализация — в заказанном
  пакете.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- `events-prod` не поднят (шаг 0.6 отложен до W15) — пункт «подтвердить версию
  образа на prod» в этом пакете закрыть невозможно, переносится в W15.
- **Латентность polling-пути не измерена.** Бюджеты [ADR-0009](../adr/0009-hot-path-latency-budget-and-order.md)
  и метод [Q22](../OPEN-QUESTIONS.md#q22) снимались на вебхучной доставке.
  Сколько добавляет интервал опроса на пути «пользователь написал → бот ответил» —
  неизвестно. Замер выходит за объём ревизии; нужен отдельно, до W15.
- **`phone` остаётся в логе прогонов `tg-router`** даже после сужения колонок:
  `step_8` вычисляет `phoneKnown` из самого значения. Чистое решение — отдельная
  колонка-флаг в `users`, но это изменение схемы, а W19 — ревизия. Вынесено
  как ограничение в [Q17](../OPEN-QUESTIONS.md#q17).
