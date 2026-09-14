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
| Флоу | 22 | [flows/](flows/) |
| Таблицы | 10 | [tables/](tables/) |
| Connections | 1 — `AI Qadam Events (dev)` | [connections.md](connections.md) |
| Variables | 4 — `QR_SIGNING_KEY`, `BOT_TOKEN`, `BOT_USERNAME`, `MINIAPP_URL` | [variables.md](variables.md) |

## Flows

| Группа | Флоу |
|---|---|
| Точка входа бота | [tg-router](flows/tg-router.md) |
| Регистрация участника | [reg-start](flows/reg-start.md), [reg-consent-pdn](flows/reg-consent-pdn.md), [reg-consent-mkt](flows/reg-consent-mkt.md), [reg-phone](flows/reg-phone.md) |
| Жизненный цикл гостя | [reg-afterword](flows/reg-afterword.md) — послесловие после чекина; вызывающего пока нет, ждёт W12 |
| Списки и отмена участника (W06) | [events-list](flows/events-list.md), [my-regs](flows/my-regs.md), [my-reg-cancel](flows/my-reg-cancel.md) |
| Визард ивента (создание/правка, ADR-0016) | [event-wizard-start](flows/event-wizard-start.md), [event-wizard-edit-start](flows/event-wizard-edit-start.md), [event-wizard-field](flows/event-wizard-field.md), [event-wizard-photo](flows/event-wizard-photo.md), [event-wizard-geo](flows/event-wizard-geo.md), [event-wizard-publish](flows/event-wizard-publish.md) |
| Mini App API | [checkin-api](flows/checkin-api.md), [my-qr-api](flows/my-qr-api.md) |
| Функции (один уровень вложенности, ADR-0015 п. 5) | [fn-hmac-init-data](flows/fn-hmac-init-data.md), [fn-sign-qr](flows/fn-sign-qr.md), [fn-verify-qr](flows/fn-verify-qr.md), [fn-parse-start](flows/fn-parse-start.md), [fn-find-registration](flows/fn-find-registration.md) |
| Не построено, будущий пакет | [i18n-sync](flows/i18n-sync.md) — [W25](../docs/BACKLOG.md#w25-возврат-i18n-на-платформенном-механизме) |

Как читать карточки, проверенные факты про MCP/subflow'ы — [flows/README.md](flows/README.md).

## Таблицы

Все 10 из [DATA-MODEL.md](../docs/DATA-MODEL.md), схема и `externalId` —
в [tables/](tables/), рецепт пересборки — [tables/README.md](tables/README.md).
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

Статика на GitHub Pages, адрес — в переменной `MINIAPP_URL`. Страниц две из
трёх разрешённых [ADR-0017](../docs/adr/0017-screen-not-message.md) п. 3
(`manage` не построена — [Q43](../docs/OPEN-QUESTIONS.md#q43)).

| Страница | Файл | Роль | API |
|---|---|---|---|
| билет | `miniapp/ticket.html` | гость показывает QR на входе | [my-qr-api](flows/my-qr-api.md) |
| сканер | `miniapp/index.html` | контролёр отмечает гостей | [checkin-api](flows/checkin-api.md) |

Обе страницы опираются на два общих файла: `i18n.js` тянет надписи словарём
`i18n/ru.json` с того же Pages (русский-онли, [ADR-0014](../docs/adr/0014-russian-only-until-platform-i18n.md);
словарь не доехал — на экране сырые ключи, а не пустота), а `ticket` — ещё и
на `vendor/qrcode.min.js`, которым QR рисуется на клиенте
([ADR-0007](../docs/adr/0007-qr-rendered-in-miniapp.md): файл картинкой не шлётся).
Оба вендоренных файла лежат с лицензиями рядом.

Обе страницы собраны на брендовых токенах и компонентах
([ADR-0019](../docs/adr/0019-design-system-from-brand-repo.md)); своих цветов,
кнопок и типографики в них нет, в собственном CSS страниц — только раскладка.

- **`vendor/aiqadam-brand-subset.css`** — дословные блоки `tokens.css` и
  `components.css` бренда с зафиксированным в шапке коммитом: токены, база,
  Buttons, Badges, Cards, `.sr`, EmptyState. 11,6 КиБ (3,8 КиБ gzip).
  Правится только переснятием с бренда, не редактированием на месте.
- **Веб-шрифтов нет ни на одной из двух страниц.** Три брендовых семейства —
  444 КиБ, и обе страницы открываются на площадке ивента, где связь плохая
  ([Q40](../docs/OPEN-QUESTIONS.md#q40)). Работают системные фолбэки, объявленные
  в самих брендовых токенах `--font-*`. Вся палитра бренда — OKLCH: на
  движке без его поддержки токены цвета невалидны, и страница откатывается
  к умолчаниям браузера. Она остаётся читаемой, а QR — сканируемым, но
  брендовой уже не выглядит.
- **Тема — из Telegram** (`colorScheme` → `data-theme` на `<html>`), механизмом
  самого бренда. Без JS остаётся светлая тема из `:root`, и страница читается.
- **Плита QR принудительно светлая** (`data-theme="light"` на контейнере) —
  правило бренда «Dark code on light ground. Never teal.»
  ([«Event stands → QR codes»](https://brand.aiqadam.org/brand.html#stands)).
  Сам код у `qrcode.js` всегда чёрный на белом; в тёмной теме потемнела бы
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
- **Уровень коррекции — H**, умолчание `qrcode.js`; бренд для печатных стендов
  предписывает Q. Это размен, а не «у нас с запасом»: H покупает избыточность
  ценой более мелкого модуля. На наших payload'ах Q даёт 25 модулей против 29
  у H на самом коротком, то есть модуль 8,96 px — и зона покоя при нынешних
  32 px падает до **3,57 модуля**, ниже правила бренда «four modules, always».
  Переход на Q потребовал бы увеличить `padding` плиты. Открытый вопрос.
- **Если брендовый CSS не доехал**, плита остаётся без подложки и код лежит
  на фоне страницы по умолчанию. Декодируется он и в этом состоянии
  (проверено декодером по реальным пикселям, в светлой и тёмной системной
  теме) — но светлым фон тогда делает браузер, а не страница.
- **Вердикт чекина — `.card`, не `EmptyState`**: пунктирная рамка у бренда
  означает «данных нет», а исход чекина — как раз данные. Тон исхода —
  семантические токены (`--success` / `--warning` / `--destructive`).
- **QR запрашивается, не дожидаясь словаря** `i18n/ru.json`: на плохой связи
  это единственное, ради чего страницу открыли. Словарь не доехал — подписи
  будут сырыми ключами, QR будет.

## Схема потоков данных

Целевая схема — [ARCHITECTURE.md](../docs/ARCHITECTURE.md#слои) и
[FLOWS.md](../docs/FLOWS.md).
