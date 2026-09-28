# W124. Язык Mini App при холодном запуске: жалоба из `#/report`

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W114, W115, W116, W123 (готовы)
- **Начат**: 2026-09-28 · **Закрыт**: —

## Цель

Первый холодный запуск Mini App показывает интерфейс на языке
`user.language_code` из `initData`, а `reports.context.lang` описывает язык,
на котором форма показана. Подробности — [BACKLOG W124](../BACKLOG.md#w124-язык-mini-app-при-холодном-запуске-жалоба-из-report).

## Что построено

Изменений на инстансе нет (флоу, таблицы, `i18n/*.json` не тронуты) — только
клиент `miniapp/`:

| Файл | Правка |
|------|--------|
| `src/lib/telegram.ts` | `getLang()`: фолбэк на `user.language_code` из сырого `initData`, если `initDataUnsafe.user` пуст |
| `src/routes/Report.tsx` | `context` собирается в момент `submit`, а не в `useMemo([tg])` |
| `src/lib/dates.ts` | форматтеры `Intl` строятся по текущему языку (кэш по локали), а не на импорте |
| `docs/I18N.md`, `catalog/overview.md` | источник языка и поведение дат |

## Чек-лист готовности

- [x] `getLang()` берёт `user.language_code` из сырого `initData` как фолбэк;
- [x] `reports.context.lang` = язык словаря на момент отправки;
- [x] headless-прогон различает (`initData=en` + пустой `initDataUnsafe`);
- [x] `build:dev`, офлайн-проверки — 0; `docs/I18N.md`/`catalog/` синхронны;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

Сервер не тронут, поэтому доказательство клиентское и различающее: две сборки
одного кода — `dist` до правки (`main`) и после, обе отданы локально, вход
описан заголовком `initData` с `language_code=en` и **пустым
`initDataUnsafe`** (та самая macOS-поздняя загрузка).

- **Форма `#/report` (холодный запуск).** Скрипт `~/w41/w124-lang.mjs`,
  webhook `report-api` перехвачен (побочных записей нет):
  - до правки → `title=Сообщить о проблеме`, `submit=Отправить сообщение`,
    `<html lang>=ru`, `context.lang="ru"`;
  - после правки → `title=Report a problem`, `submit=Send message`,
    `<html lang>=en`, `context.lang="en"`.
- **Даты при смене языка.** Скрипт `~/w41/w124-dates.mjs`, событие
  `startsAt=2026-10-12T13:30:00Z` (Ташкент `18:30`), вход `ru`, затем клик
  `#pf-lang-en`:
  - до правки → `пн, 12 октября · 18:30` и после переключения тоже (даты
    залипали на импорте), `localStorage=en`;
  - после правки → `пн, 12 октября · 18:30` → `Mon, 12 October · 18:30`.
- `npx tsc --noEmit` — 0; `npm run build:dev` — ok;
  `check-texts.py`/`check-commands.py`/`check-export-secrets.sh`/
  `prototypes/check.mjs` — 0.

## Журнал

- **2026-09-28** — пакет взят по жалобе владельца (запись `0alHttkl0zEO6vSvulhUM`,
  прогон `HEqBKGowxgbCG3gqfkKjI`). Разбор прогона: в одном запросе
  `ap-parent-run-locale: en`, а `context.lang: "ru"` — расхождение указывает на
  `getLang()`/`loadI18n()`, а не на сеть.
- **2026-09-28** — `getLang()` до правки читал только
  `initDataUnsafe.user.language_code`; на macOS он пуст при монтировании, а
  сырой `initData` уже несёт `en` (его и валидирует `fn-hmac-init-data`).
  Фолбэк на разбор сырого `initData` — безопасен: значение влияет только на
  язык интерфейса, права и `telegram_id` сервер считает сам (DAT-1).
- **2026-09-28** — `Report.tsx` держал `context` в `useMemo(..., [tg])`: он
  вычислялся на первом рендере, до загрузки словаря, и `lang` замирал на
  `ru` даже при верном словаре. Сборка контекста перенесена в `submit`.
- **2026-09-28** — `dates.ts` создавал `Intl.DateTimeFormat` на импорте по
  локали, снятой один раз: холодный старт залипал на `ru`, а переключение языка
  в «Профиле» не меняло даты до перезагрузки. Правка — ленивые форматтеры с
  кэшем по локали (тот же класс: язык не снимок). Проверено отдельным
  различающим прогоном (см. «Как проверено»).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: review-agent (независимый, чистый контекст, opencode/deepseek-v4.1-flash) ·
  **Дата**: 2026-09-28 · **Вердикт**: есть замечания (блокеров нет; одно «важно» —
  рассинхрон `docs/I18N.md` о источнике `ap-parent-run-locale`; далее «на будущее»).

### Чем проверено

**Живой проект (`app-flow-events-dev`, MCP).** Пакет не трогает инстанс: в
`migrations` (`NCZNGuWh6PFs1JZXRPNTE`) записей `package=W124` **нет**;
`git diff d362f9a..HEAD` меняет только `miniapp/src/{lib/telegram.ts,lib/dates.ts,
routes/Report.tsx}` и документы — `flows/`, `i18n/` не тронуты. `report-api`
(`R8GgSVXgHsmLSKdEdzygp`) — `ENABLED, published`, тот же. Разбор жалобы по живому
прогону `HEqBKGowxgbCG3gqfkKjI` (`ap_get_run`): заголовок `ap-parent-run-locale: en`,
`initData.user.language_code=en`, macOS, `appVersion 9.6`, `context={lang:ru,…}` —
сигнатура дефекта ровно та, что описана в журнале. `report-api/step_5`
(`ap_read_step_code` + `flows/report-api.json`) `telegram_id` берёт только из
`{{step_1['output'].data.telegramId}}` (HMAC `fn-hmac-init-data`, окно 300 c),
`context` лишь режется до 2000 символов и пишется как данные.

**Свои различающие прогоны (headless).** Собраны **две** сборки `npm run build:dev`
из одной ветки: `before` — версии трёх файлов из `d362f9a`, `after` — ветка
(`diff -rq` подтверждает, что отличаются ровно эти три файла). Обе отданы
локальным static-сервером, `telegram-web-app.js` заглушён, `Telegram.WebApp`
подставлен `addInitScript`, все `**/api/v1/webhooks/**` перехвачены (побочных
записей нет), из запроса читаются тело (`context`) и заголовок
`ap-parent-run-locale`.

| Сценарий (вход) | before | after |
|---|---|---|
| `#/report`, `initData language_code=en`, `initDataUnsafe={}` | «Сообщить о проблеме», `context.lang=ru`, header `ru` | «Report a problem», `context.lang=en`, header `en` |
| То же, но `initDataUnsafe.user.language_code=en` (сигнатура жалобы) | словарь `en`, `context.lang=ru` | `context.lang=en` |
| `localStorage=uz` при Telegram `en` | словарь `uz`, `context.lang=ru` | `uz` / `uz` |
| `initDataUnsafe=uz` при сыром `en` | словарь `uz`, `context.lang=ru` | `uz` / `uz` |
| Даты, холодный старт `en`, пустой unsafe | `пн, 12 октября · 18:30` | `Mon, 12 October · 18:30` |
| Даты, клик `#pf-lang-en` (вход `ru`) | `ru` → `ru` (залипло) | `ru` → `en` |

Различие состоялось на одном входе: до правки — дефолт `ru` (или `en`-словарь при
`ru`-контексте), после — `en` в словаре, `context.lang` и заголовке. Явный выбор
(`localStorage`) по-прежнему перебивает Telegram и попадает и в `context.lang`, и в
заголовок — регрессии нет.

**AppSec (4.1/4.2).** Фолбэк `langFromInitData()` читает только `user.language_code`
сырого `initData`, сужает до `ru|uz|en`; значение уходит лишь в словарь, `Intl` и
`ap-parent-run-locale`. Ни `telegram_id`, ни права, ни фильтры на клиенте из него не
выводятся (grep по `miniapp/src`: клиентского `telegram_id` нет вовсе). Подмена
`language_code` без валидного `hash` → сервер 401; с валидным — это язык самого
отправителя, т.е. поверхность атаки не растёт. `fetch('i18n/'+lang+'.json')`
ограничен множеством из трёх значений — обхода пути нет. Обоснование
задокументировано комментарием в `telegram.ts` и журналом.

**Регрессии.** `npx tsc --noEmit` — 0; `npm run build:dev` — ok;
`tools/check-texts.py i18n/ru.json flows/*.json` — 31 флоу / 287 ссылок / 0;
`tools/check-commands.py i18n/*.json flows/*.json` — 0; `tools/check-export-secrets.sh`
— exit 0; `node prototypes/check.mjs` — OK (те же 6 прежних предупреждений).
Остальные места снятия языка один раз: `api.ts` и `loadI18n()` вызывают `getLang()`
в момент запроса/загрузки, `Events.tsx` `uiLang` синхронизируется после
`loadI18n()` и в `changeLang()` — залипания нет; других `getLang()`/`new Intl`/
`LOCALE` на уровне модуля в `miniapp/src` не осталось. `docs/I18N.md` (Mini App-
раздел) и `catalog/overview.md` новой формулировке соответствуют.

### Замечания

1. **важно** — `docs/I18N.md`, раздел «Цепочка локали» (стр. 79–82): «SPA шлёт
   заголовок `ap-parent-run-locale` из `Telegram.WebApp.initDataUnsafe.user.language_code`».
   Это неверно и само по себе (W114 добавил приоритет `localStorage`), а W124
   добавляет фолбэк на сырой `initData` — ровно в разобранном кейсе macOS
   `initDataUnsafe` пуст, и заголовок берётся не из него (мой прогон: before без
   unsafe → header `ru`, after → `en`). В Mini App-разделе (стр. 144–146) фолбэк
   описан, а в «Цепочке локали» — нет, поэтому описание серверного контракта
   локали разъехалось с `getLang()`. Пакет правил `I18N.md` и отметил
   синхронность — строку нужно привести к фактическому порядку:
   `localStorage` → `initDataUnsafe` → сырой `initData` → `ru`. Расхождение в
   [ADR-0045](../adr/0045-i18n-on-platform-dollar-t.md) п. 3 — то же, но ADR
   задним числом не правится (причина отмечена здесь, не как правка).
   - *Исправлено*: «Цепочка локали» в `docs/I18N.md` приведена к фактическому
     порядку `localStorage` → `initDataUnsafe` → сырой `initData` → `ru` со
     ссылкой на `getLang()` (W114/W124); формулировка «из
     `initDataUnsafe.user.language_code`» убрана. (2026-09-28)

2. **на будущее** (вне диффа W124, найдено чтением кода) — гонка `loadI18n()` и
   `setLang()` в `lib/i18n.ts`. `loadI18n()` на старте ставит `LANG=getLang()` и
   создаёт промис словаря этого языка; `Events.tsx` параллельно вызывает
   `loadProfile()`, и при `users.lang`, отличном от исходного, `setLang()` меняет
   `LANG`/`dict`. Если промис `loadI18n()` разрешится **после** `setLang()`, он
   перезапишет `dict = Object.assign({}, ru, lang)` словарём **исходного** языка,
   тогда как `LANG`/`uiLang` останутся новыми — тексты и подсветка языка разъедутся.
   Проявляется только при выборе языка на другом устройстве (сервер знает `ru`,
   локально пусто, язык Telegram другой). W124 это не вносит и не обостряет, живым
   прогоном не воспроизводил (тайминг); завести записью в OPEN-QUESTIONS/бэклог,
   сейчас не чинить.
   - *Записано*: [Q66](../OPEN-QUESTIONS.md#q66) (индекс + секция) — гонка
     `loadI18n()`/`setLang()`, кандидат (защита поколением или повторное чтение
     `LANG` после `await`); в W124 не чиним. (2026-09-28)

3. **на будущее** — обоснование безопасности фолбэка живёт только комментарием в
   `telegram.ts` и в журнале; в `docs/I18N.md`/`SECURITY.md` его нет. При правке
   п. 1 добавить туда строку: сырой `initData` на клиенте не проверяется, значение
   влияет только на язык UI и предпочтение локали, права и `telegram_id` считает
   сервер (DAT-1).
   - *Исправлено*: то же обоснование добавлено строкой в `docs/I18N.md`,
     «Цепочка локали» (подмена `language_code` не даёт ничего, кроме чужого
     языка UI; права — из проверенного `initData`). (2026-09-28)

**Снято без замечаний (для протокола).** Инъекций в фолбэке нет (`URLSearchParams`
+ `JSON.parse` в `try/catch`, значение сужается до белого списка); `context`
остаётся диагностическим полем, `reports.context.lang` теперь отражает показанный
язык; каталог `overview.md` описывает реальное поведение; инстанс не тронут,
переопубликация не нужна. Пункты чек-листа W124 (BACKLOG) подтверждены, кроме
полной синхронности `docs/I18N.md` — см. п. 1.
