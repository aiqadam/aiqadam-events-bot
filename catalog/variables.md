# Variables

Имена Variables проекта и их назначение. **Значений секретов здесь не бывает** —
они хранятся зашифрованно в Qadam Flow и задаются только в UI. Значения
несекретных переменных (`BOT_USERNAME`, `MINIAPP_URL`) записаны сознательно:
они и так публичны, а флоу собираются по ним.

Синтаксис в шагах: `{{variables['name']}}` — короткая форма `{{NAME}}` молча
резолвится в пустую строку, а не падает (см. CLAUDE.md, Gotchas Qadam Flow, п. 8).

| Name | Назначение | Где задаётся | Значение |
|------|-----------|--------------|----------|
| `QR_SIGNING_KEY` | ключ HMAC для подписи QR участника (PAR-6); **не** токен бота | UI: Settings → Variables | 64 символа, алфавит `A-Za-z0-9_-` |
| `MINIAPP_URL` | адрес Mini App-статики на GitHub Pages | UI: Settings → Variables | `https://miniapp.events.aiqadam.org/` |
| `BOT_USERNAME` | username бота **без `@`** — для сборки deep link'ов | UI: Settings → Variables | `aiqadam_events_dev_bot` |
| `BOT_TOKEN` | тот же токен бота, что и в connection `AI Qadam Events (dev)` — **дубликат специально для HMAC** ([ADR-0008](../docs/adr/0008-bot-token-as-variable-not-connection-template.md)) | UI: Settings → Variables | — |

Ротация `QR_SIGNING_KEY` инвалидирует все выданные QR разом — только вместе
с перевыпуском кодов, см. [SECURITY.md](../docs/SECURITY.md#секреты).

`BOT_USERNAME` хранится без `@`, поэтому deep link собирается как
`https://t.me/{{variables['BOT_USERNAME']}}?start=...` — добавлять `@` в шаблоне нельзя.

## Кто их читает

| Name | Флоу | Как |
|------|------|-----|
| `QR_SIGNING_KEY` | [checkin-api](flows/checkin-api.md) | `callFlow fn-verify-qr`, поле `qrSigningKey` |
| `QR_SIGNING_KEY` | [my-qr-api](flows/my-qr-api.md) | `callFlow fn-sign-qr`, поле `qrSigningKey` |
| `BOT_TOKEN` | [checkin-api](flows/checkin-api.md) | `callFlow fn-hmac-init-data`, поле `botToken` |
| `BOT_TOKEN` | [my-qr-api](flows/my-qr-api.md) | `callFlow fn-hmac-init-data`, поле `botToken` |
| `MINIAPP_URL` | [reg-start](flows/reg-start.md) | кнопка QR в ветке `existing` |
| `MINIAPP_URL` | [reg-consent-mkt](flows/reg-consent-mkt.md) | кнопка `web_app` на `#/ticket?event_id=` (SPA) в сообщении с билетом (ADR-0007) |
| `MINIAPP_URL` | [my-regs](flows/my-regs.md) | вход `miniappUrl` у CODE «render my regs» — кнопка QR в каждой активной регистрации |
| `MINIAPP_URL` | [menu](flows/menu.md) | вход `miniappUrl` у CODE — кнопка `web_app` на `#/manage` и `#/scan?event_id=` (SPA) |
| `BOT_TOKEN` | [manage-api](flows/manage-api.md) | `callFlow fn-hmac-init-data`, поле `botToken` |
| `BOT_USERNAME` | [manage-api](flows/manage-api.md) | `inviteLink` в ответах `load`/`save` — ссылка на форме, не в чате (W37) |
| `BOT_USERNAME` | [reg-afterword](flows/reg-afterword.md) | deep link на следующий ивент в послесловии (`?start=e<id>-afterword`) |

`fn-hmac-init-data`/`fn-sign-qr`/`fn-verify-qr` сами переменных не читают —
секрет читает и передаёт вызывающий флоу (`{{variables['NAME']}}`), функция
принимает его как обычный входной параметр.
