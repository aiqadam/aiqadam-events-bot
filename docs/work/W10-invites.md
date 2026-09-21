# W10. Инвайты и отзыв прав контролёра

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: v0.1
- **Зависит от**: W2 (`tg-router`, `fn-parse-start` — ✅), W28 (лекало экрана — ✅), W36/W44/W55 (панель контролёров в `manage` — ✅)
- **Начат**: 2026-09-21 · **Закрыт**: —

## Цель

`staff-invite` / `staff-accept` (OWN-14): одноразовая ссылка
`?start=s<eventId>-<token>`, TTL 24 ч, в БД только `sha256`, права — по
конкретному событию. Отзыв прав (`revoked_at`) уже построен W36 и действует
на следующем скане через STF-2 в `checkin-api`. Подробности — [BACKLOG](../BACKLOG.md#w10-инвайты-и-отзыв-прав-контролёра).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `staff-accept` | `8seS0t3EfBZbmMSxuuYwC` | [catalog/flows/staff-accept.md](../../catalog/flows/staff-accept.md) |
| таблица `staff_invites` | внешний `JIjKkDu3Im2ylBmkkH5Fu` | [catalog/tables/staff_invites.md](../../catalog/tables/staff_invites.md) |

## Чек-лист готовности

> Из [BACKLOG.md](../BACKLOG.md#w10-инвайты-и-отзыв-прав-контролёра).

- [ ] токен одноразовый;
- [ ] TTL 24 ч соблюдается;
- [ ] в БД лежит только `sha256`;
- [ ] отзыв через `revoked_at` действует на следующем же скане;
- [ ] ответы собраны по лекалу W28, а не лентой сообщений;
- [ ] `catalog/` совпадает с живым проектом.

## Как проверено

- <заполняется по ходу>

## Журнал

- **2026-09-21** — пакет взят. Перед сборкой — вердикт владельца по прототипу:
  создание инвайта живёт в Mini App, на табе «Контролёры» `#/manage/:id`
  (инлайн-блок под добавлением по логину), в чат карточка-инвайт не приходит.
  В прототипе была сирота `staff-invite` (чат-карточка без входной кнопки) —
  удалена вместе с чипом в демо-списке; в `renderStaff` добавлен блок
  «Пригласить контролёра» с одноразовой ссылкой. `prototypes/check.mjs` — exit 0.
- **2026-09-21** — найдено при сверке инстанса до начала сборки: живой
  `DISABLED`-черновик `staff-accept` (`8seS0t3EfBZbmMSxuuYwC`, триггер
  `callableFlow`), не заведённый ни одним пакетом, вне `_manifest.json` и
  каталога (тот самый «отдельный хвост», названный ревью W58). Его шаги уже
  смотрят на верные `externalId` (`staff_invites`/`events`/`event_staff`), но
  ветка ответа на невалидный инвайт пустая (`Branch 1` без условий) и `step_7`
  с `only_if value: ""` — флоу неполный. Решение W10: доводим/пересобираем его
  как часть пакета, а не плодим второй.

- **2026-09-21** — собран `staff-invite` (webhook, `nFIO7cJiEXlQMCdr6lLjc`):
  `initData` → гейт `staff`+чаптер → `generate-password` (22, alphanumeric)
  → `hash-text` sha256 → `staff_invites` (`token_hash`, `event_id`,
  `created_by`, `created_at`, `expires_at = +24ч`) → `{inviteLink}`. Токен
  в БД не пишется; ответ отдаёт ссылку один раз.
- **2026-09-21** — доведён `staff-accept` (`8seS0t3EfBZbmMSxuuYwC`), ранее
  безымянный `DISABLED`-черновик: у роутера `step_5` пустая ветка отказов
  получила условия (`invalid`/`used`/`expired`), добавлен недостающий
  `send accepted + scanner` (`step_11`) — до него флоу не отправлял успешный
  ответ; тексты `step_4` приведены к текущему `ru.json` («события», после
  W56); пустой fallback закрыт no-op. Опубликован и включён.
- **2026-09-21** — `tg-router`: в разборе маршрута `kind='s'` уходит в
  `staff_accept` (было — в `Otherwise` молча); добавлена ветка и
  `callFlow staff-accept` (`queue`), payload `{token, eventId, chatId,
  telegramId}`. Опубликован.
- **2026-09-21** — Mini App: `STAFF_INVITE_API`, кнопка «Пригласить
  контролёра» инлайн в табе «Контролёры» (`Manage.tsx`) с ссылкой,
  подсказкой и «Скопировать»/«Поделиться»; `npm run build` зелёный.
  Ключ `staff.invite.hint` добавлен в `ru.json`; прототип переведён на него
  (свой `proto.staff_invite_hint` удалён) — эталон и продукт больше не
  расходятся. `prototypes/check.mjs` — exit 0.
- **2026-09-21** — живой тест приёма (`staff-accept`) на четырёх исходах,
  фикстуры вставлены/удалены через MCP: валидная ссылка → «Вы контролёр
  события …» + `used_at`/`used_by` + строка `event_staff` + кнопка сканера
  (прогон `FT1Fe6UliSl65Wgm6e8GI`, PRODUCTION); повтор → «Ссылка уже
  использована»; просроченная → «Срок действия ссылки истёк»; неизвестный
  токен и токен «не на то событие» → «Ссылка не найдена» (fail-closed).
  Сквозной диплинк проверен через `tg-router`: `/start s…-…` →
  `route=staff_accept` → вызов флоу → сообщение владельцу (прогон
  `vpwLPv92CrRjabDnhn3yi`). Негатив создания: `curl` на
  `staff-invite/sync` с мусорным `initData` → `401 invalid_init_data`.
- **2026-09-21** — каталог: карточки `catalog/flows/staff-invite.md` и
  `staff-accept.md`, обновлены `tg-router.md`, `overview.md` (25 → 27
  флоу), `docs/FLOWS.md`. Офлайн-гейты: `check.mjs` — exit 0,
  `check-texts.py` — exit 0, `check-commands.py` — exit 0,
  `check-export-secrets.sh` — чисто.

- **2026-09-21** — **влит в `main` решением владельца** (команда «Мержи»),
  PR #100, merge-коммит `e6180b6`. Влит **до** экспорта и независимого ревью:
  это решение владельца, а не «готовность» пакета. Статус оставлен
  `заблокирован` с указанием, чего не хватает (ключ платформы → экспорт,
  `migrations`, `EXPECTED_BOT_TOKEN` 6→7; затем ревью). Pages из `main`
  публикует SPA — кнопка «Пригласить контролёра» станет живой.

- **2026-09-21** — **экспорт снят через MCP, без REST-ключа.** `ap_export_flow`
  вызван напрямую по OAuth-токену opencode (`~/.local/share/opencode/mcp-auth.json`),
  ответы сохранены в файлы, нормализованы `tools/export-flow-mcp.py` — так
  большой `tg-router` не пришлось пересобирать руками. Диф `tg-router.json`
  содержит ровно ожидаемое: ветка `staff_accept`, `callFlow staff-accept`
  (`step_21`) и новый код `step_10`. Офлайн-гейты с полным экспортом:
  `check-texts.py` 27 флоу/230 пар — 0, `check-commands.py` — 0,
  `check-export-secrets.sh` — чисто (`EXPECTED_BOT_TOKEN` 7).

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- **Экспорт снят без REST-ключа, через MCP** (прямой вызов
  `ap_export_flow` по OAuth-токену opencode — `mcp-auth.json`), затем
  `tools/export-flow-mcp.py`: `flows/staff-invite.json` (`cYLX8SyKdGhxp3Bu6PHE1`),
  `flows/staff-accept.json` (`8ath7lNU6cmkgNUS2fZh7`), `flows/tg-router.json`
  (`pCZzbj5UKQAxztYtD4Oba`) — все `state: LOCKED`, `_manifest.json` 27 флоу
  с `source: "mcp"`. `tools/check-export-secrets.sh`: `EXPECTED_BOT_TOKEN`
  6 → 7 (`staff-invite/step_2`). Строки `migrations` — по этим версиям.
- **`tools/check-migrations.py` (сетевая сверка) не запускался**: нужен
  `QADAM_API_KEY`. Инварианты сведены вручную по MCP-экспорту и `_manifest.json`.
- **Живой позитив создания** (`staff-invite` из Mini App) — нужен овнер:
  Pages задеплоен из `main` (#100), кнопка живая; негатив (`401`) доказан.
- **Независимое ревью не проходило** — пакет влит решением владельца раньше
  срока (см. запись о мерже).
