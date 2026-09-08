# Variables

Имена Variables проекта и их назначение. **Значения — НИКОГДА**: секреты хранятся
зашифрованно в Qadam Flow и задаются в UI.

Синтаксис в шагах: `{{variables['name']}}`.

| Name | Назначение | Где задаётся |
|------|-----------|--------------|
| `QR_SIGNING_KEY` | ключ HMAC для подписи QR участника (PAR-6); **не** токен бота | UI: Settings → Variables |
| `MINIAPP_URL` | адрес Mini App-сканера на GitHub Pages | UI: Settings → Variables |
| `BOT_USERNAME` | `@username` бота — для сборки deep link'ов | UI: Settings → Variables |

Ротация `QR_SIGNING_KEY` инвалидирует все выданные QR разом — только вместе
с перевыпуском кодов, см. [SECURITY.md](../docs/SECURITY.md#секреты).
