# W123. Сообщение о проблеме из продукта — экран `#/report`

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (пакет-кандидат, назначен владельцем 2026-09-28)
- **Зависит от**: [Q62](../OPEN-QUESTIONS.md#q62) (отвечен 2026-09-28), [W41](../work/W41-prototypes-e2e.md) (прототип, готов)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Дать участнику и организатору способ сообщить о **клиентской** проблеме
(вёрстка, тема, i18n, «кнопка не реагирует», пустой экран при успешном ответе
API) — то, что не видно в прогонах. Форма и место зафиксированы пакетом:
экран `#/report`, таблица `reports`, флоу `report-api`; без `reports-digest`
и без чат-ветки в `tg-router`. Подробности — [BACKLOG.md](../BACKLOG.md#w123-сообщение-о-проблеме-из-продукта-q62--экран-mini-app).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `report-api` | `R8GgSVXgHsmLSKdEdzygp` (внутр. externalId `U9da0ciAfDrcA2N71qt6r`) | [catalog/flows/report-api.md](../../catalog/flows/report-api.md) |
| таблица `reports` | внешний `LKEqlq1X7RuWz5WC4zkov`, внутр. `XIJdKUVMYUwdbdTqqrZqZ` | [catalog/tables/reports.md](../../catalog/tables/reports.md) |
| SPA-роут `#/report` | `miniapp/src/routes/Report.tsx` | [catalog/overview.md](../../catalog/overview.md) |
| вход из «Профиля» | `miniapp/src/routes/Events.tsx` (`ProfileTab`) | — |
| вход из меню | `menu/step_11` (`web_app` `#/report?from=menu`) — flow `rV2ymkl6ET11uMjbywU4D` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| ADR | [ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md) | [adr/README](../../docs/adr/README.md) |
| SPEC | [PAR-12](../../docs/SPEC.md) | — |

## Чек-лист готовности

> Скопировано из [BACKLOG.md](../BACKLOG.md#w123-сообщение-о-проблеме-из-продукта-q62--экран-mini-app).

- [x] ADR шестого роута `#/report` принят — [ADR-0050](../../docs/adr/0050-sixth-miniapp-page-report.md); плюс SPEC [PAR-12](../../docs/SPEC.md);
- [x] таблица `reports` заведена; ключ не объявлен (несколько сообщений
      от одного человека легальны, ADR-0003/ADR-0047);
- [x] флоу `report-api` собран, `ap_validate_flow` чист; живые прогоны:
      валидный `initData` → 200 и строка, невалидный → 401, staff-гейта нет;
- [x] страница `#/report` в SPA, вход из «Профиля» и `web_app`-кнопки;
      тексты — `i18n/*.json` (I18N-2), `tools/check-texts.py` чист;
- [x] `tools/check-commands.py` чист (новой команды нет);
- [x] `catalog/` обновлён (флоу, таблица, overview, menu), строки `migrations` записаны;
- [ ] независимое ревью, вердикт «замечаний нет»;
- [x] `catalog/` совпадает с живым проектом.

## Как проверено

**Негатив — `curl` по опубликованному `/sync`** (флоу с побочным эффектом,
gotcha 11), заголовок `ap-parent-run-locale: ru`:

```
POST .../webhooks/R8GgSVXgHsmLSKdEdzygp/sync  {"initData":"bogus",...}
→ HTTP 401 {"ok":false,"text":"Данные Mini App устарели — переоткройте приложение","error":"invalid_init_data"}
```

**Позитив — валидный `initData`, подписанный временным флоу-подписантом**
(выбор владельца; флоу `zz-w123-initdata-mint`, `WjicJeOvohCIrCdRWsclQ`,
собран на `crypto/hmac-signature` с `{{variables['BOT_TOKEN']}}`, прогнан
`ap_test_flow`, **удалён**; тестовые строки из `reports` **удалены**).

Прогон подписанта `w6CglCPhrdRIUMTrT2Ox5`: `data_check_string`
`auth_date=1790598869\nquery_id=AAH1790598869\nuser={"id":999000000001,...}`,
`hash=16f31c3d…9f9f`, `initData` собран из трёх полей + `hash`.

| Проба (curl, published) | Результат |
|---|---|
| валидный `initData`, `kind=broken`, текст | `HTTP 200 {"ok":true,"text":"Сообщение отправлено"}` |
| пустой `text` | `HTTP 422 {"ok":false,"error":"validation","text":"Опишите проблему — хотя бы коротко.","fields":{"text":"report.error.text"}}` |
| `kind=hack` | `HTTP 422 {…"fields":{"kind":"report.error.kind"}}` |
| `ap-parent-run-locale: uz`, валидный | `HTTP 200 {"ok":true,"text":"Xabar yuborildi"}` |
| `ap-parent-run-locale: en`, битый `initData` | `HTTP 401 {"text":"Mini App data is stale — reopen the app"}` |

**Строка в `reports`** после валидного прогона (`ap_find_records`), затем
удалена (`ap_delete_records`, ids `I0OMxKp6kStiNLtqZki6o`, `PX2m9EvZ2XX2zlTd1pHfh`):

```
source=miniapp  created_at=2026-09-28T12:34:46.493Z  context={"lang":"ru"}
status=new  telegram_id=999000000001  kind=broken
text=Не сохраняется компания в профиле  route=profile  app_version=8.0  event_id=(empty)
```

**Офлайн-проверки** (все код 0): `tools/check-export-secrets.sh` (ссылок
`BOT_TOKEN` — 9, `EXPECTED_BOT_TOKEN` поднят 8→9), `tools/check-texts.py`
(31 флоу, 287 ссылок `$t`, 0 расхождений), `tools/check-commands.py`
(0 нарушений), `node prototypes/check.mjs` (ключи резолвятся, сценарии
целы), `npm run build:dev` (tsc + vite, чанк `Report` 3,7 КиБ).

## Журнал

- **2026-09-28** — пакет взят по указанию владельца («W123 го»).
- **2026-09-28** — флоу `report-api` собран зеркалом `feedback-api`:
  `fn-hmac-init-data` → ROUTER `invalid/valid` → CODE-валидация →
  ROUTER `reject/ok` → `tables-create-records` → `200`. Умышленные отличия:
  **нет** `fn-find-registration` и staff-гейта (Q62, ADR-0050 п. 3),
  **`tables-create-records`** вместо `upsert` (несколько жалоб легальны).
- **2026-09-28** — `ap_update_step` по `menu/step_11`: `sourceCode` заменён
  целиком, `texts` передан полной картой с новым `menu.btn.report`
  (gotcha 12); после — `ap_validate_flow` и `ap_lock_and_publish`.
- **2026-09-28** — экспорт `flows/report-api.json` и `flows/menu.json` снят
  через `ap_export_flow` **сразу после** публикаций; ключа платформы на
  машине нет, поэтому MCP-снимок (`source: mcp`) — легитимный путь ADR-0021.
- **2026-09-28** — `.env.prod` **не трогался**: решение владельца — пакет
  только dev, перенос на prod отдельным шагом; при promote добавить в
  `.env.prod` ключ `report` с id prod-флоу (иначе `build:prod` упадёт на
  `endpoint('report')` — названный хвост).
- **2026-09-28** — расхождения с прототипом (ADR-0027), названы сознательно:
  1. В тексте экрана `report.lead`/`report.done` прототип обещал «сообщение
     увидят организаторы»; Q62 называет читателя — **владельца продукта**, без
     уведомления организатору. Обещать организаторов было бы неправдой —
     продукт говорит «мы». Прототип приведён к тому же тексту.
  2. Кнопка в меню бота (`#/report?from=menu`) — её в прототипе нет (там
     только вход из «Профиля»), но требует форма пакета в BACKLOG; команда
     WebApp не является, ADR-0025 не задет.
  3. Выбор вида — брендовые `.chip-row` (продуктовый аналог `.segmented.wrap`
     из прототипа, W77) вместо класса эталона; поведение и подписи совпадают.

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

- —

## Хвосты и блокеры

- **prod — отдельный шаг** (решение владельца): создать `reports` и
  `report-api` в `events-prod`, добавить id в `miniapp/.env.prod`, опубликовать,
  строки `migrations` на prod. До этого `.env.prod` без ключа `report`.
- **`check-migrations.py`** (нужен ключ платформы, сеть) — прогнать на ревью/приёмке.
- **Живой вход из меню и «Профиля» в Telegram** (клик по кнопке `web_app`) —
  на владельца; серверный путь доказан curl'ом.
