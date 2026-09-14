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
| SPA `miniapp/` | — | [catalog/overview.md](../../catalog/overview.md) |
| flow `manage-open` (hash) | `tMu8WwjrdqMpJYzuCHQcI` | [catalog/flows/manage-open.md](../../catalog/flows/manage-open.md) |

## Чек-лист готовности

- [ ] ванильные файлы удалены, SPA отдаёт 3 роута на том же `MINIAPP_URL` (проверено на `https://miniapp.events.aiqadam.org/#/…`);
- [ ] бренд вендорен с `BRAND_COMMIT`, своих литералов цвета/шрифта нет (`grep` из чек-листа п. 3a молчит), токены — OKLCH как у бренда;
- [ ] `ticket` quiet zone 4,1+ модуля на 224px, `ResizeObserver` пересчёт, QR читается декодером в светлой/тёмной теме даже без брендового CSS;
- [ ] `scan` луп без ручного переоткрытия между людьми, различающие прогоны STF-4 (`ok`/`already`/`wrong_event`/`not_registered`/`forbidden` + `invalid_init_data`);
- [ ] `manage` — различающие прогоны: не-владелец → `403`, владелец → `200`, даты на границе суток `Asia/Tashkent`, гео оба пути, `newId` идемпотентность;
- [ ] `pages.yml` собирает `dist/`, `preview` на PR зелёный, Pages без секретов;
- [ ] `catalog/overview.md` — раздел Mini App про SPA, `catalog/flows/manage-api.md` без привязки к `manage.html`; экспорт `flows/` тем же коммитом;
- [ ] независимое ревью, вердикт «замечаний нет»;
- [ ] `catalog/` совпадает с живым проектом.

## Как проверено

- —

## Журнал

- **2026-09-14** — взят пакет, ветка `w33-react-spa`, начато чтение спеки и ванили.

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

—

## Хвосты и блокеры

- нет
