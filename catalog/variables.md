# Variables

Имена Variables проекта и их назначение. **Значений секретов здесь не бывает** —
они хранятся зашифрованно в Qadam Flow и задаются только в UI. Значения
несекретных переменных (`BOT_USERNAME`, `MINIAPP_URL`) записаны сознательно:
они и так публичны, а флоу собираются по ним.

Синтаксис в шагах: `{{variables['name']}}`.

| Name | Назначение | Где задаётся |
|------|-----------|--------------|
| `QR_SIGNING_KEY` | ключ HMAC для подписи QR участника (PAR-6); **не** токен бота | UI: Settings → Variables |
| — | *задан в `events-dev` 2026-09-08: 64 символа, алфавит `A-Za-z0-9_-`* | |
| `MINIAPP_URL` | адрес Mini App-сканера на GitHub Pages | UI: Settings → Variables |
| `BOT_USERNAME` | username бота **без `@`** — для сборки deep link'ов | UI: Settings → Variables |
| `BOT_TOKEN` | тот же токен бота, что и в connection `AI Qadam Events (dev)` — **дубликат специально для HMAC** (W8, [ADR-0008](../docs/adr/0008-bot-token-as-variable-not-connection-template.md)) | UI: Settings → Variables |

Ротация `QR_SIGNING_KEY` инвалидирует все выданные QR разом — только вместе
с перевыпуском кодов, см. [SECURITY.md](../docs/SECURITY.md#секреты).

## Состояние в `events-dev` (2026-09-08)

Значения через MCP не читаются — проверено одноразовым флоу с CODE-шагом,
который вернул только метаданные, не сами значения; флоу удалён.

| Name | Задан | Что известно |
|------|-------|--------------|
| `QR_SIGNING_KEY` | да | длина 64, алфавит `A-Za-z0-9_-`; значение не выносится ни в каталог, ни в git |
| `BOT_USERNAME` | да | `aiqadam_events_dev_bot`, **без** ведущего `@` |
| `MINIAPP_URL` | да | `https://miniapp.events.aiqadam.org/` — шаг 0.5 закрыт 2026-09-08, тот же адрес стоит Mini App-ом у бота в BotFather |
| `BOT_TOKEN` | да, добавлен 2026-09-09 (W8) | значение не выносится ни в каталог, ни в git; проверено **поведением**, не конфигом — прогон на настоящем `initData` дал `hashValid: true` только после переключения HMAC-шага на эту переменную (тогда — `fn-verify-init-data / step_2`, флоу удалён в W22) ([ADR-0008](../docs/adr/0008-bot-token-as-variable-not-connection-template.md)) |

## Кто их читает (сверено 2026-09-13, W22)

Список снят с живого проекта: шаги, которые `ap_validate_flow` помечает как
`references {{variables...}}` — это и есть полный перечень потребителей.
Флоу `fn-*` удалены в W22, поэтому прежние строки этой таблицы указывали
на несуществующее.

| Name | Флоу | Шаг |
|------|------|-----|
| `QR_SIGNING_KEY` | [checkin-api](flows/checkin-api.md) | `step_38` — проверка подписи QR (эталон [`hmac-qr`](snippets/hmac-qr.md)) |
| `QR_SIGNING_KEY` | [my-qr-api](flows/my-qr-api.md) | `step_24` — подпись QR |
| `QR_SIGNING_KEY` | [registration](flows/registration.md) | `step_13` (ветка `existing`), `step_72` (финализация) — подпись QR |
| `BOT_TOKEN` | [checkin-api](flows/checkin-api.md) | `step_35` — HMAC `initData` (эталон [`hmac-init-data`](snippets/hmac-init-data.md)) |
| `BOT_TOKEN` | [my-qr-api](flows/my-qr-api.md) | `step_20` — HMAC `initData` |
| `BOT_USERNAME` | [registration](flows/registration.md) | `step_96` — сборка `registerDeepLink` в карточке ивента |
| `MINIAPP_URL` | [registration](flows/registration.md) | `step_18`, `step_75` — кнопка `web_app` на `ticket.html` (W5, ADR-0007) |

`BOT_TOKEN` в `registration` **не читается**: этот флоу вызывается из `tg-router`,
а не из Mini App, и `initData` не проверяет.

`ap_validate_flow` помечает такие шаги как `"references {{variables...}} which does
not exist in the flow"` — это **ложное срабатывание**, флоу работает. Но проверять
подстановку всё равно надо не валидатором, а прогоном: опечатка в имени даёт пустую
строку и тоже проходит валидацию. Как это сверялось для `QR_SIGNING_KEY`:
подпись ставится в одном флоу, а проверяется в другом, поэтому пустой или
разъехавшийся ключ ломает скан **громко** — это и есть проверка
([ADR-0012](../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)).

`BOT_USERNAME` хранится без `@`, поэтому deep link собирается как
`https://t.me/{{variables['BOT_USERNAME']}}?start=...` — добавлять `@` в шаблоне нельзя.
