# Карта проекта

> Обновляется при добавлении/удалении flows и таблиц. Здесь — **только то,
> что реально существует в проекте**. Планы живут в
> [ROADMAP.md](../docs/ROADMAP.md) и [BACKLOG.md](../docs/BACKLOG.md).

## Состояние

Собрано пакетом [W26](../docs/work/W26-rebuild-on-one-touch.md) по
[ADR-0015](../docs/adr/0015-one-touch-one-flow.md) («одно касание = один
флоу») и [ADR-0016](../docs/adr/0016-shared-flow-for-same-shaped-touches.md)
(последовательность структурно одинаковых вопросов делит один флоу), плюс
пакет [W06](../docs/work/W06-lists-cancel.md) (списки и отмена участника).
W26 закрыт («готов», независимое ревью, три круга).

| Что | Сколько | Карточки |
|---|---|---|
| Флоу | 18 (+1 временный DRAFT `tmp-w12-item-probe` — доказательство ссылок цикла, до вердикта ревью) | [flows/](flows/) |
| Таблицы | 12 | [tables/](tables/) |
| Connections | 1 — `AI Qadam Events (dev)` | [connections.md](connections.md) |
| Variables | 5 — `QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`, `MINIAPP_URL`, `YANDEX_GEOCODER_API_KEY` | [variables.md](variables.md) |

## Flows

| Группа | Флоу |
|---|---|
| Точка входа бота | [tg-router](flows/tg-router.md) |
| Меню-хаб | [menu](flows/menu.md) — голый `/start` и любая незнакомая команда (ADR-0025) |
| Регистрация участника | [reg-start](flows/reg-start.md), [reg-consent-pdn](flows/reg-consent-pdn.md), [reg-consent-mkt](flows/reg-consent-mkt.md) — телефон в регистрации не спрашивается; из каталога регистрацию делает [reg-api](flows/reg-api.md) |
| Жизненный цикл гостя | [reg-afterword](flows/reg-afterword.md) — послесловие после чекина; вызывает [lifecycle](flows/lifecycle.md) |
| Жизненный цикл и напоминания | [lifecycle](flows/lifecycle.md) — `published → finished` по `ends_at` (OWN-4); [reminders](flows/reminders.md) — `24h`/`2h` (OWN-16, IDM-3). Оба DISABLED до утреннего живого прогона (хвост W12) |
| Mini App API | [checkin-api](flows/checkin-api.md), [my-qr-api](flows/my-qr-api.md), [manage-api](flows/manage-api.md), [events-api](flows/events-api.md), [reg-api](flows/reg-api.md) |
| Функции (один уровень вложенности, ADR-0015 п. 5) | [fn-hmac-init-data](flows/fn-hmac-init-data.md), [fn-sign-qr](flows/fn-sign-qr.md), [fn-verify-qr](flows/fn-verify-qr.md), [fn-parse-start](flows/fn-parse-start.md), [fn-find-registration](flows/fn-find-registration.md) |
| Не построено, будущий пакет | [i18n-sync](flows/i18n-sync.md) — [W25](../docs/BACKLOG.md#w25-возврат-i18n-на-платформенном-механизме) |

Как читать карточки, проверенные факты про MCP/subflow'ы — [flows/README.md](flows/README.md).

## Таблицы

Все 11 доменных из [DATA-MODEL.md](../docs/DATA-MODEL.md) плюс служебная
[`migrations`](tables/migrations.md) (журнал изменений инстанса,
[ADR-0021](../docs/adr/0021-repo-is-source-of-truth-migrations-table.md));
схема и `externalId` — в [tables/](tables/), рецепт пересборки —
[tables/README.md](tables/README.md).
`staff` — глобальные права организаторов по чаптеру
([ADR-0024](../docs/adr/0024-staff-by-chapter-event-staff-checkin.md), W32).
`strings` создана по схеме, но пуста осознанно: наполняющий её `i18n-sync`
не построен (см. Flows выше); источник правды для строк —
`i18n/*.json` в репозитории.

В `events`/`registrations`/`event_staff` намеренно оставлена фикстура
`demo` — нужна ревьюеру и последующим прогонам, чтобы проверять STF-2
(права контролёра) без пересборки окружения. Подробности —
[checkin-api.md](flows/checkin-api.md).

## Переменные и Connections

[variables.md](variables.md), [connections.md](connections.md).

## Mini App

Статика на GitHub Pages, адрес — в переменной `MINIAPP_URL`. SPA на Vite+React+TS
([ADR-0022](../docs/adr/0022-miniapp-react-spa.md)), hash-роутер
(`#/ticket?event_id=`, `#/scan?event_id=`, `#/manage`, `#/manage/:id`,
`#/events?tab=mine|upcoming|past`), сборка
`miniapp/dist/` (`pages.yml` → `npm ci && npm run build`, `dist/` → Pages).
Построены четыре роута — `ticket`/`scan`/`manage`/`events`. Пятый — только
новым ADR (форма отзыва — черновик
[ADR-0028](../docs/adr/0028-feedback-screen-fifth-miniapp-page.md)).
[ADR-0017](../docs/adr/0017-screen-not-message.md) п. 3 и [ADR-0022](../docs/adr/0022-miniapp-react-spa.md) расширены на четвёртую страницу ADR-0023.

| Роут | Роль | API |
|---|---|---|
| `#/ticket?event_id=` | гость показывает QR на входе | [my-qr-api](flows/my-qr-api.md) |
| `#/scan?event_id=` | контролёр отмечает гостей | [checkin-api](flows/checkin-api.md) |
| `#/manage` и `#/manage/:id` | staff чаптера видит список своих ивентов и правит их (OWN-1…OWN-5, OWN-15), ведёт список контролёров ивента (W36: выдача/отзыв по `telegram_id`), получает ссылку регистрации (W37); форма — визард из четырёх шагов (W42: основное → где и когда → места → проверка) | [manage-api](flows/manage-api.md) |
| `#/events?tab=mine\|upcoming\|past` | гость смотрит афишу: будущие и прошедшие карточками; таб «Мои билеты» (первый) — свои регистрации со статусами; регистрация — шитом PAR-1/PAR-2 на месте, подтверждение — билет; отмена — с экрана билета `#/ticket` (W43, PAR-5 — только экраном, [Q57](../docs/OPEN-QUESTIONS.md#q57)) | [events-api](flows/events-api.md), [reg-api](flows/reg-api.md) |

Роут `manage` открывается кнопкой «Создать ивент» в карточке [menu](flows/menu.md)
(`web_app` на `#/manage`); права на создание **и** правку решает `manage-api` по `initData`,
таблице [`staff`](tables/staff.md) и `chapter_id` — страница ничего не решает
([ADR-0024](../docs/adr/0024-staff-by-chapter-event-staff-checkin.md)). Фото афиши
форма не трогает ([Q46](../docs/OPEN-QUESTIONS.md#q46), временно снято из OWN-1);
гео — координатами из ссылки Яндекс.Карт (`pt`/`ll`/`@lat,lon`/`q`), кнопкой
«Взять моё местоположение» или недавним местом из своих ивентов; интерактивной
карты нет ([Q52](../docs/OPEN-QUESTIONS.md#q52)). Визард помнит черновик
создания в `localStorage` и после публикации показывает экран успеха со ссылкой
(W42). Даты вводятся как Asia/Tashkent (`datetime-local`) и уходят серверу
строкой без зоны; в UTC переводит `manage-api`.

Стек: Vite+React+TypeScript, hash-роутер (без `browser` history и без `404.html`),
Tailwind 4 + брендовые компоненты, `qrcode` npm lazy только на `ticket`,
`manage` и `events` — ленивые чанки. Чанки: `ticket`+`scan` один, `manage`
отдельный, `events` отдельный (3,7 КиБ, 1,4 КиБ gzip), `qrcode` отдельный
(25 КиБ, 10 КиБ gzip). `ticket`+`scan` открываются до того, как догрузился
`manage` или `events` — бюджет `initial <50 КиБ` из ADR-0020 по смыслу,
а не буквально; каталог `#/events` — публичный экран с входом из чата
кнопкой `web_app` (W38).

Все роутy опираются на общие модули `lib/i18n.ts`/`lib/api.ts`/`lib/theme.ts`:
`i18n/ru.json` тянется словарём с того же Pages (русский-онли,
[ADR-0014](../docs/adr/0014-russian-only-until-platform-i18n.md); словарь не
доехал — на экране сырые ключи, а не пустота), `theme` — из
`Telegram.WebApp.colorScheme → [data-theme]`. QR рисуется на клиенте
`qrcode` npm ([ADR-0007](../docs/adr/0007-qr-rendered-in-miniapp.md): файл
картинкой не шлётся). Вендоренные брендовые файлы лежат с лицензиями в
`miniapp/src/vendor/brand/` (см. ниже).

Все три роута собраны на брендовых токенах и компонентах
([ADR-0019](../docs/adr/0019-design-system-from-brand-repo.md)); своих цветов,
кнопок и типографики в них нет. Собственный CSS — раскладка плюс
цвет **только через семантические токены бренда** (`--destructive`,
`--success`, `--warning`, `--border`): правило — не «никаких `color:`», а
«ни одного литерала цвета и шрифта» (проверка `grep` из чек-листа п. 3a).

- **Заголовок и подзаголовок набраны классами `EmptyState`**
  (`.empty-heading` / `.empty-desc`) вне самого компонента — у бренда нет
  продуктовых классов заголовка страницы (`.section-title` и
  `.subsection-title` — docs-шапки). Это компромисс: изменение `EmptyState`
  у бренда молча поменяет заголовки всех трёх роутов.
- **Шапка Telegram WebView не перекрашивается**: `themeParams` не читаются,
  `setHeaderColor` / `setBackgroundColor` не вызываются — фон страницы
  брендовый, шапка клиента своя, шов между ними виден. Это следствие
  ADR-0019 (свои цвета не заводим, цвета клиента — не наши), принятая цена;
  в живом WebView не проверялось.

- **`miniapp/src/vendor/brand/tokens.css` + `components.css`** — дословные
  файлы бренда с зафиксированным в шапке `BRAND_COMMIT`
  (`8ef4a8059816aec015c8f56f6d38d2d63993c890`, 2026-09-14): токены, база,
  Buttons, Cards, `.sr`, EmptyState, Inputs, Checkbox/Radio/Switch.
  Токены 16 КиБ, компоненты 24 КиБ (40 КиБ до gzip); Inputs и Controls нужны
  только роуту `manage`. Правится только переснятием с бренда, не
  редактированием на месте; обновление — отдельный коммит с переснятием.
- **Веб-шрифтов нет ни на одном из трёх роутов** (включая `manage`).
  Три брендовых семейства — 444 КиБ, и `ticket`/`scan` открываются на площадке
  ивента, где связь плохая ([Q40](../docs/OPEN-QUESTIONS.md#q40),
  [ADR-0020](../docs/adr/0020-no-web-fonts-on-venue-pages.md)). Для `manage`
  решение принято отдельно и тем же замером (ADR-0020 п. 3): 444 КиБ шрифтов
  против ~35 КиБ страницы с CSS, и вторая типографика внутри одной Mini App —
  цена, названная в ADR-0020, которую платить незачем. Работают системные
  фолбэки, объявленные в самих брендовых токенах `--font-*`. Вся палитра
  бренда — OKLCH: на движке без его поддержки токены цвета невалидны, и
  страница откатывается к умолчаниям браузера. Она остаётся читаемой, а QR —
  сканируемым, но брендовой уже не выглядит.
- **Тема — из Telegram** (`colorScheme` → `data-theme` на `<html>`), механизмом
  самого бренда. Без JS остаётся светлая тема из `:root`, и страница читается.
- **Плита QR принудительно светлая** (`data-theme="light"` на контейнере) —
  правило бренда «Dark code on light ground. Never teal.»
  ([«Event stands → QR codes»](https://brand.aiqadam.org/brand.html#stands)).
  Код у `qrcode` npm всегда чёрный на белом; в тёмной теме потемнела бы
  подложка вокруг него, то есть зона покоя.
  `padding: 32px` — зона покоя кода: «four modules, always» — правило бренда,
  раздел [«Event stands → QR codes»](https://brand.aiqadam.org/brand.html#stands),
  а не наша выдумка.
- **Размер кода считается от доступной ширины**, максимум 224 px (172 px на
  экране 320 px, где фиксированные 224 не помещаются в карточку вместе
  с зоной покоя). Код **перерисовывается** под размер, а не масштабируется
  картинкой другого размера; пересчёт повторяется при изменении ширины плиты
  (`ResizeObserver`, фолбэк — `resize` / `orientationchange`), иначе после
  поворота экрана код остаётся крупнее плиты и зона покоя падает ниже нормы.
  Границы payload заданы парсером (`eventId` — слаг до 12 знаков, `userId` —
  до 16 цифр, `sig` — 10): 15–41 знак, 29–37 модулей. Зона покоя **на 224 px**
  — от 4,1 модуля (самый короткий payload) до 5,3; на узком экране код мельче,
  и в модулях она только больше.
- **Уровень коррекции — H**, как у `qrcode.js` ранее (умолчание); бренд для
  печатных стендов предписывает Q. Это размен, а не «у нас с запасом»: H
  покупает избыточность ценой более мелкого модуля. На наших payload'ах Q даёт
  25 модулей против 29 у H на самом коротком, то есть модуль 8,96 px — и зона
  покоя при нынешних 32 px падает до **3,57 модуля**, ниже правила бренда
  «four modules, always». Переход на Q потребовал бы увеличить `padding`
  плиты. Открытый вопрос.
- **Если брендовый CSS не доехал**, плита остаётся без подложки и код лежит
  на фоне страницы по умолчанию. Декодируется он и в этом состоянии
  (проверено декодером по реальным пикселям, в светлой и тёмной системной
  теме) — но светлым фон тогда делает браузер, а не страница.
- **Вердикт чекина — `.card`, не `EmptyState`**: пунктирная рамка у бренда
  означает «данных нет», а исход чекина — как раз данные. Тон исхода —
  семантические токены (`--success` / `--warning` / `--destructive`), и несут
  их **рамка и полоса** (`border-color` + `box-shadow: inset 0 4px 0`), а текст
  вердикта — всегда `--foreground`. Так сделано не для красоты: акцентный токен
  буквами на `--card` даёт в светлой теме 2,1–2,4:1, а эту строку контролёр
  читает в дверях ярко освещённого холла. Новый исход красится так же —
  красить буквы значит вернуть ту же проблему.
  Тем же способом оформлен отказ на `ticket` (рамка и полоса карточки
  билета, текст `--foreground`) и итог сохранения на `manage`.
- **У «Загрузка…» на `ticket` и `manage` есть выход**: `fetch` с таймаутом
  15 с, три различимых исхода — нет соединения/таймаут, сервер ответил
  не-JSON (5xx-страница), сервер ответил JSON с ошибкой — и кнопка
  «Повторить» там, где повтор имеет смысл (не у `not_registered` и не вне
  Telegram).
- **QR запрашивается, не дожидаясь словаря** `i18n/ru.json`: на плохой связи
  это единственное, ради чего страницу открыли. Словарь не доехал — подписи
  будут сырыми ключами, QR будет.

## Схема потоков данных

Целевая схема — [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои) и
[FLOWS.md](../docs/FLOWS.md).
