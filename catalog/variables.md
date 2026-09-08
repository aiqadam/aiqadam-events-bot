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

`BOT_USERNAME` хранится без `@`, поэтому deep link собирается как
`https://t.me/{{variables['BOT_USERNAME']}}?start=...` — добавлять `@` в шаблоне нельзя.
