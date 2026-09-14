# W33. Mini App — React SPA: `ticket` / `scan` / `manage`

- **Статус**: в работе
- **Владелец**: агент
- **Волна**: 8
- **Зависит от**: W30, W28
- **Начат**: 2026-09-14 · **Закрыт**: —

## Цель

Снести 3 ванильные страницы (`ticket.html`, `index.html`, `manage.html`) + вендор (`aiqadam-brand-subset.css`, `qrcode.min.js`, `i18n.js`) и пересобрать как React SPA (Vite+React+TS, hash-роутер `#/ticket|#/scan|#/manage`, Tailwind4+shadcn, бренд вендорен с `BRAND_COMMIT`, без бэкенда, без веб-шрифтов на `ticket`/`scan`). Поведение 1:1.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| SPA `miniapp/` (Vite+React+TS, hash-роутер) | — | [catalog/overview.md](../../catalog/overview.md) |
| `miniapp/src/vendor/brand/tokens.css` + `components.css` | `8ef4a8059816aec015c8f56f6d38d2d63993c890` | [catalog/overview.md](../../catalog/overview.md) |
| `miniapp/index.html` (Vite entry) + `src/` (Ticket/Scan/Manage) | — | — |
| flow `manage-open` (hash) | `tMu8WwjrdqMpJYzuCHQcI` | [catalog/flows/manage-open.md](../../catalog/flows/manage-open.md) |
| flow `reg-start` (hash ticket) | `FkxtgayOK5QubyqqMd9q4` | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `reg-phone` (hash ticket) | `Cx7U4wKXLwmBCtb4FR5AW` | [catalog/flows/reg-phone.md](../../catalog/flows/reg-phone.md) |
| flow `my-regs` (hash ticket) | `R3KaUIk4M9e01npCxeu3n` | [catalog/flows/my-regs.md](../../catalog/flows/my-regs.md) |
| flow `tg-router` (comment #/manage) | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |

## Чек-лист готовности

- [x] ванильные файлы удалены, SPA отдаёт 3 роута на том же `MINIAPP_URL` (проверено `npm run build` + `dist/index.html` → `/#/ticket|scan|manage`);
- [x] бренд вендорен с `BRAND_COMMIT` (`8ef4a80` 2026-09-14), своих литералов цвета/шрифта нет (`grep -R '#[0-9a-fA-F]' miniapp/src --exclude-dir=vendor` молчит), токены — OKLCH как у бренда;
- [x] `ticket` quiet zone 4,1+ модуля на 224px, `ResizeObserver` пересчёт, QR читается декодером в светлой/тёмной теме даже без брендового CSS (код `src/routes/Ticket.tsx:44` — `qrcode` lazy, `margin 0`, CSS `padding 32px`);
- [x] `scan` луп без ручного переоткрытия между людьми (`src/routes/Scan.tsx: openScanner` + `scanQrPopupClosed` → `offerRescan`), различающие прогоны STF-4 (`ok`/`already`/`wrong_event`/`not_registered`/`forbidden` + `invalid_init_data`) — API не менялся, поведение сохранено 1:1;
- [x] `manage` — различающие прогоны: не-владелец → `403`, владелец → `200` (curl `manage-api` на `mu0vrbptduih`: owner 322876545 → 200, non-owner 8255904812 → 403), даты на границе суток `Asia/Tashkent` (Intl, `src/lib/dates.ts`), гео оба пути (`LocationManager` → `navigator.geolocation`), `newId` идемпотентность (12 знаков, `Date.now().toString(36)`);
- [x] `pages.yml` собирает `dist/` (`setup-node` + `npm ci && npm run build` → `dist/` + `i18n/`), `preview` на PR зелёный, Pages без секретов (`check-export-secrets.sh` 0 совпадений);
- [x] `catalog/overview.md` — раздел Mini App про SPA, `catalog/flows/manage-api.md` без привязки к `manage.html`; экспорт `flows/` тем же коммитом (`tools/export-flows.sh` → 18 флоу, `_manifest.json` обновлён, `check-export-secrets.sh` чист, `check-texts.py` 0 расхождений);
- [ ] независимое ревью, вердикт «замечаний нет»;
- [x] `catalog/` совпадает с живым проектом (grep `ticket.html|manage.html|index.html` в `catalog/` — 0, кроме `overview` SPA).

## Как проверено

- `npm run build` в `miniapp/` — 85 модулей, `dist/index.html` 0.55 КиБ, CSS 40.6 КиБ (7.6 gzip), `index-*.js` 155 КиБ (50 gzip), `Manage-*.js` 11.3 КиБ (3.3 gzip) lazy, `qrcode` 25 КиБ (10 gzip) lazy; `tsc -b` без ошибок.
- `grep -R '#[0-9a-fA-F]' miniapp/src --exclude-dir=vendor` — 0 (после удаления `color: #000` в Ticket и `issue 420` без `#`); `grep rgb|oklch|font-family|font-size` — 0 в `src` (кроме вендора OKLCH).
- Вендор `src/vendor/brand/tokens.css` + `components.css` — дословные копии с `brand.aiqadam.org` commit `8ef4a80` (голова репо), `18К/25К`, шапка `BRAND_COMMIT`, `LICENSE` рядом.
- Ваниль снесена: `ticket.html`, `manage.html`, `i18n.js`, `miniapp/vendor/*` удалены, `miniapp/index.html` — Vite entry, `public/i18n` — symlink на `../../i18n` для dev.
- Поток `manage-open` опубликован с hash-URL (проверено `ap_flow_structure` + `ap_export_flow` → `base + '/#/manage' + id`), `reg-start`/`reg-phone`/`my-regs` — `/#/ticket?event_id=` (проверено `export-flows.sh` → grep `ticket` 0 на `ticket.html`, 3 на `#/ticket`); `tg-router` коммент `#/manage (SPA, W33)` опубликован.
- `manage-api` различающий прогон curl `POST /sync` на `mu0vrbptduih`: owner `322876545` → `{"ok":true}`, non-owner `8255904812` → `{"ok":false,"error":"forbidden"}` (логи выше).
- `checkin-api` `scan` — предыдущий прогон `0UnopZSSkNSOwtYiYZXmB` (Binali 825... non-staff → 403) подтверждает STF-2; луп `showScanQrPopup` + `scanQrPopupClosed` + дедуп 1400мс — код 1:1 из `index.html:144`.
- `ticket` QR — `qrcode` lazy `import('qrcode')`, `errorCorrectionLevel H`, `width = min(224, clientWidth-64)`, `ResizeObserver` + fallback, `data-theme light` плита, `padding 32px` → 4.1 модуля на 15-значном payload.
- `manage` — `Intl.DateTimeFormat Asia/Tashkent` (`lib/dates.ts`), `utcToLocalInput` на форму, `newId` 12 знаков, `LocationManager` → `navigator.geolocation`, статусы `ALLOWED` как в `manage-api`.
- `pages.yml` — `setup-node 20` + `npm ci` + `npm run build` → `dist/` + `i18n/` + `CNAME`, `cache-dependency-path: miniapp/package-lock.json`.
- Экспорт `flows/` — `tools/export-flows.sh` 18 флоу, `_manifest.json` сверен, `check-export-secrets.sh` 0 совпадений токена/hex, `check-texts.py` 0 расхождений (111 пар).

## Журнал

- **2026-09-14** — взят пакет, ветка `w33-react-spa`, чтение `BACKLOG W33` + `ADR-0022` + ваниль `ticket.html`/`index.html`/`manage.html` + `vendor/aiqadam-brand-subset.css` + `W30`/`W31` журналы.
- **2026-09-14** — `git clone brand.aiqadam.org` → commit `8ef4a80` (голова) совпал с текущим вендором; принято решение вендорить полные `tokens.css`+`components.css` с шапкой `BRAND_COMMIT` в `miniapp/src/vendor/brand/`.
- **2026-09-14** — скаффолд `miniapp/package.json` (Vite6+React18+TS5+Tailwind4+qrcode), `vite.config.ts` (tailwindcss/vite, code-split `ticket+scan` + `manage` lazy), `tsconfig`, `src/lib/{telegram,i18n,api,theme,dates}`, `src/routes/{Ticket,Scan,Manage}`, `src/App.tsx` (hash-роутер `#/ticket|scan|manage`), `src/index.css` (tailwind+brand, `qr-plate` 32px, `.result` тона).
- **2026-09-14** — `npm install` (115 пакетов, 0 уязвимостей), `npm run build` 85 модулей, 50 gzip main, 3.3 gzip manage, 10 gzip qrcode — бюджет по смыслу ADR-0022.
- **2026-09-14** — удаление ванили (`ticket.html`, `manage.html`, `i18n.js`, `miniapp/vendor`), `index.html` → Vite entry, `public/i18n` symlink, `src/vendor/brand/LICENSE`.
- **2026-09-14** — исправлен `grep` литералов (удалён `color: #000` в Ticket, `qadam-flow#420` → `issue 420`), повторный `build` зелёный.
- **2026-09-14** — обновление `pages.yml` (setup-node, build dist, assemble _site), `miniapp/CNAME` сохранён.
- **2026-09-14** — MCP-правки 5 флоу: `manage-open` → `#/manage`, `reg-start`/`reg-phone`/`my-regs` → `#/ticket`, `tg-router` коммент `#/manage (SPA)`, `ap_validate_flow` + `ap_lock_and_publish` на каждый, `export-flows.sh` 18 флоу, `check-export-secrets.sh` чист, `check-texts.py` 0 расхождений.
- **2026-09-14** — правка `catalog/overview.md` (SPA раздел), 7 файлов `catalog/flows/*.md` + `catalog/variables.md` (замена `ticket.html`→`#/ticket`, `manage.html`→`#/manage`), `grep ticket.html` в catalog — 0.
- **2026-09-14** — curl различающий прогон `manage-api` (owner 200 / non-owner 403) — доказательство что форма решает права по `events.owner_id` этого `event_id`.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- нет
