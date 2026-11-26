# W146. Переключение на AI Qadam ID, шаг 2: `fn-id-call`, `fn-id-refresh`, адреса ID

- **Статус**: заблокирован (блокер ревью по безопасности; флоу выключены до исправления)
- **Владелец**: агент (сессия AI Qadam ID)
- **Волна**: вне волн
- **Зависит от**: [ADR-0060](../adr/0060-id-switch-flows-to-id-api.md) (принят 2026-11-26), шаг 1 —
  [ID ADR-0035](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0035-profile-get-returns-signer-mailing-consent.md)
  (ID W12, готов 2026-11-26)
- **Начат**: 2026-11-26 · **Закрыт**: —

## Цель

Шаг 2 «Порядка и ворот» ADR-0060: один подфлоу для всех вызовов ID (§1), подфлоу дневного
обновления профиля (§5) и пять переменных адресов на `events-dev`. Существующие флоу не меняются;
их переключение — следующий пакет (шаги 3–6).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `fn-id-call` | `91jUjK1KZAQajF4uVkNoc` (ext `4RfJjWReJ5hqBWAZtpOOY`), версия `i6E4iTXb2Hgck0Lbs7eWw` | [catalog/flows/fn-id-call.md](../../catalog/flows/fn-id-call.md) |
| flow `fn-id-refresh` | `uzlehhnJBmtUCcyQ7k4ML` (ext `6Zjwm4Et4U0PH5oSoMt8e`), версия `p307KydSHM33LPaCJSULt` | [catalog/flows/fn-id-refresh.md](../../catalog/flows/fn-id-refresh.md) |
| эталоны `id-call-sign` (32 теста), `id-call-result` (24), `id-refresh-body` (20) | шаги `sign`, `result`, `body` | [catalog/snippets/](../../catalog/snippets/README.md) |
| [ADR-0061](../adr/0061-fn-id-refresh-may-call-fn-id-call.md) | `fn-id-refresh` → `fn-id-call`, исключение из ADR-0015 п. 5 | — |
| переменные `id_url_profile_get`, `id_url_profile_upsert`, `id_url_profile_batch`, `id_url_consent_set`, `id_url_account_delete` | адреса вебхуков ID QA, не секрет; заданы агентом через MCP решением владельца (2026-11-26) | [catalog/variables.md](../../catalog/variables.md) |

## Чек-лист готовности

- [x] Переменные адресов на `events-dev`
- [x] `fn-id-call` по ADR-0060 §1: `sign` → `send_request` → `result`; логи шагов с телом выключены
- [x] `fn-id-refresh` по ADR-0060 §5: `profile-upsert` с `update_only: true` и `clear`
- [x] Цепочка `fn-id-refresh` → `fn-id-call` разрешена владельцем ([ADR-0061](../adr/0061-fn-id-refresh-may-call-fn-id-call.md))
- [x] Эталоны Code steps с офлайн-тестами (канон подписи сверен с копией ID `fn-verify-sig`)
- [x] Подписанные вызовы на выдуманных людях тестового диапазона: каждый `api`
- [x] Неверный ключ → `401`
- [x] Таймаут / сеть → `ok:false, status:0`
- [x] В логах прогонов нет тела запроса, ответа и ключа
- [x] `flows/*.json`, `catalog/`, `migrations` (`2026-11-26-w146-01…08`)
- [ ] Независимое ревью
- [ ] `catalog/` совпадает с живым проектом

## Как проверено

Люди — выдуманные, тестовый диапазон (`9000000000000951`, `…961`, `…962`, `…963`). Подфлоу не
вызывается вебхуком, поэтому проверка — `ap_test_flow` с данными триггера; каждый вызов ID — настоящий
подписанный запрос в ID QA. Ответы скрыты в логе (так задумано), поэтому итог читается по шагу
`trace` / `outcome` и по таблицам ID (`ap_find_records`).

- Офлайн: `for f in catalog/snippets/tests/*.test.mjs; do node $f; done` → 8 файлов, все зелёные
  (новые: `id-call-sign` 32, `id-call-result` 24, `id-refresh-body` 20). Тест `id-call-sign`
  проверяет конверт независимой копией проверки ID после `JSON.stringify`/`JSON.parse`.
- `fn-id-call` — прогоны на черновике до блокировки версии `i6E4iTXb2Hgck0Lbs7eWw`; ревьюер сверил REST: черновик равен опубликованной версии:
  - `consent-set` base → `200 ok` (`2P1yu5GkcySvck2n5Tv64`); module `events` → `200 ok`
    (`8uyX7fPp1WJIvnCKnwksB`); в ID `consents` — две строки с `base.id.v1.ru`, `module.events.v1.ru`;
  - `profile-upsert` → `200 ok` (`pNfNZSMy9G4uDmx0yhZNK`); в ID `members` — `first_name`, `username`
    как отправлены;
  - `profile-get` → `200 ok` (`o2UNP7XhqTzbgZJpz1cqd`); `profile-batch` `by_ids` → `200 ok`
    (`bEUBy4G0c6KDdNYcdQhwR`);
  - `account-delete` → `200 ok` (`LcCpqOdjPOaYGdtG66OxJ`, 3,6 с); ID разослал событие, приёмник бота
    `id-member-deleted` отработал (`DUQfIPoELPRS03HtbCHFR`); в ID строк `…961` нет;
  - `consent-set` module без base → `409`, `reason: http_409` (`jnDoOtwDWNy2QPIOS3Gfp`), в ID ничего;
  - неизвестный `api` → `ok:false, status:0, reason: bad_api`, в сеть ничего (`C80AELrMUqzt34y3wdRK1`);
  - неверный ключ (временно в черновике до публикации) → `401` (`0dfAPXVX8MWacEscRpAn1`);
  - таймаут (временно `timeout: 0.001` в черновике) → `ok:false, status:0, reason: no_json`
    (`CRcpWL4cHtApCFwJLkL9D`). После обеих подмен ключ и `timeout: 10` возвращены; экспорт
    опубликованной версии это показывает.
- `fn-id-refresh` (опубликованная версия), `callFlow` → опубликованный `fn-id-call`:
  - человека нет в ID → `ok, 200, written:false` (`C5d5cK7X6UZbid6ftJsli`), профиль не создан;
  - профиль `Old963`/`Family963`/`old_963` → обновление `New963`, без фамилии, `new_963` →
    `written:true` (`ARHHnDBmHg5LOgJk3wPYV`); в ID `first_name: New963`, `username: new_963`,
    `last_name: ""` (очищено, ID ADR-0034);
  - пустое имя → прогон падает в `body` (`no_first_name`), в ID ничего (`p9Mtuey75dr85wLQna2TT`);
  - уборка: `account-delete` `…963` (`dFLDL3aXO2zdjvQsAQyUu`); в ID `members` и `consents` по `…951`,
    `…961`, `…962`, `…963` — пусто.
- Логи: во всех прогонах выше вход и выход триггера, `sign`, `send`, `result`, `respond`, `body`,
  `call ID` — `**REDACTED**`; видны только `trace` (`api`, `status`, `reason`) и `outcome` (`ok`,
  `status`, `reason`, `written`). При сетевом сбое в логе шага `send` — текст `TypeError` самой qadam,
  без адреса и тела.
- Задержка: `sign` 0,13–0,23 с, ID 0,4–1,2 с, `account-delete` 3,3 с; `fn-id-refresh` целиком 1,1–1,3 с.

## Журнал

- **2026-11-26** — пакет взят. Разбиение владельца: этот пакет — шаг 2 ADR-0060, переключение 11
  флоу — следующий. Переменные адресов агент ставит через MCP (решение владельца 2026-11-26; правило
  AGENTS.md о переменных — про секреты, адреса не секретны, адреса prod задаёт владелец).
- **2026-11-26** — пять переменных `id_url_*` заданы через `ap_upsert_variable` (адреса вебхуков ID QA).
- **2026-11-26** — у бота ещё не было `http`-шага с JSON-телом (единственный — GET геокодера), поэтому
  формы выхода `send_request` сняты пробным флоу с временным шагом, который выводил только типы и
  ключи (флоу `6sHUdpj57nghflDn8P79k`, удалён): `2xx` → `{status, headers, body}`
  (`pg8XH3rd9Jv12ayD4RzlD`); `4xx` → `{response:{status, body}}` (`V69gDzmk1TkHfrigbUhSo`, `401
  bad_signature`); пустой адрес → шаг `FAILED` с `TypeError: error.errorMessage is not a function`
  внутри qadam, прогон держит `continueOnFailure` (`GF8uhsKwdE8RertAZrLSz`); таймаут →
  `{response:{status:500}}` без тела (`8lCUtp509xYVckbkQwHfL`). Тело JSON уходит как `body: {data:
  <объект>}`, ID принимает подпись — канон совпал.
- **2026-11-26** — настоящий 10-секундный таймаут проверить не удалось: частный (`10.255.255.1`) и
  документационный (`198.51.100.7`) адреса платформа режет сама (`403`, тело-строка — тоже путь
  `status: 0`; `vdvUTkAqokahxvqnqDogd`, `8mFLFaaVd8qtcI6nmBYJy`), а публичные «медленные» сервисы
  (`httpbin.org/delay`, `httpstat.us`) ответили `400`/`500` без задержки (тело запроса в эти прогоны —
  пустой объект `{}`, данных не уходило). Таймаут проверен через `timeout: 0.001` по адресу ID: обрыв
  сразу, значит единица — секунды, а обычные вызовы (0,4–1,2 с) при `10` проходят.
- **2026-11-26** — пробный флоу заменён чистой сборкой (`ap_update_step` сливает входы и не удаляет
  ключ, остался бы лишний вход). Хост закреплён в `sign`: подписанное тело не уйдёт по подменённой
  переменной на чужой адрес.
- **2026-11-26** — ADR-0015 п. 5 запрещает цепочку функций, а `fn-id-refresh` зовёт `fn-id-call`.
  Владелец выбрал узкое исключение новым ADR → [ADR-0061](../adr/0061-fn-id-refresh-may-call-fn-id-call.md).
  Попутно в `catalog/overview.md` список функций дополнен `fn-delete-person` (ADR-0059; строку не
  обновили в W145).
- **2026-11-26** — `result` добавляет к `{ok, status, body}` из ADR-0060 §1 код `reason` без данных
  человека: его пишет в лог `trace`, и вызывающему не надо разбирать `status: 0`.
- **2026-11-26** — `migrations`: строки `2026-11-26-w146-01…08` (5 переменных, удаление пробного флоу,
  две публикации; commit `1df28e6`). `tools/check-migrations.py` падал `TypeError` на старой строке
  `bcast-run` W135 с датой без времени (`2026-10-05`) — сломан с октября, не из-за W146. Починен
  минимально: дата без зоны считается UTC. После починки по объектам W146 расхождений нет; остальные
  28 — исторические (W32 `fn-hmac-init-data`, W60, W136, W138, W142 и др.), вынесены в хвосты.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: агент (чистый контекст) · **Дата**: 2026-11-26 · **Вердикт**: есть замечания

### Замечания

1. **блокер** — уязвимость класса «обход аутентификации подфлоу»; затрагивает не только этот пакет.
   Подробности не публикуются в этом репо до исправления; они у владельца и в закрытом вопросе AI Qadam
   ID (ID-24).
   - *Сделано* (2026-11-26): владельцу доложено; по его решению `fn-id-call` и `fn-id-refresh` выключены
     (`migrations` `w146-09`, `-10`). Исправление — отдельным ADR (решение владельца: правка платформы и
     до неё внутренний секрет вызывающего). Пакет заблокирован до него.
2. **на будущее** — то же касается других функций бота; вопрос заведётся вместе с ADR исправления.
3. **на будущее** — прогоны «опубликованной конфигурации» `fn-id-call` прошли на черновике до
   блокировки версии; ревьюер сверил REST: черновик и опубликованная версия одинаковы.
   - *Исправлено*: формулировка в «Как проверено» (2026-11-26).
4. **на будущее** — `applied_at` строк `w146-01…05` (07:20) не совпадал с созданием переменных
   (07:36:25–26). - *Исправлено* в `migrations` (2026-11-26).

Сверено ревьюером и сошлось: структура обоих флоу и логи, код шагов байт-в-байт с эталонами,
опубликованные версии с `flows/*.json` и манифестом (35/35), канон подписи с ID, адреса `id_url_*`, все
прогоны из «Как проверено», уборка в ID QA, офлайн-тесты 183/183, `check-export-secrets.sh`.

## Хвосты и блокеры

- **Блокер ревью 1** — ждёт ADR исправления (решение владельца 2026-11-26). Оба флоу выключены.

- `tools/check-migrations.py` показывает 28 исторических расхождений `migrations` (не W146): коммиты
  вне git (W60, W136, W138), формат id (`2026-10-03-manage-names-01`), `version_id` у `create`/`update`
  (W10, W142), `fn-hmac-init-data` (W32: последняя publish-строка со старым flowId), `object_id`
  таблицы W142. Чинить ли журнал задним числом — решение владельца.
- Prod: адреса `id_url_*` prod задаёт владелец; перенос — после пакета переключения (ADR-0060,
  «Следствия»).
- Следующий пакет — шаги 3–6 ADR-0060: переключение 11 флоу, `idr:` в `tg-router` и
  `fn-delete-person`, освежение данных, сквозная проверка. У шагов `callFlow fn-id-call` в
  обработчиках — `logInput`/`logOutput` выключены (ответ несёт данные человека).
