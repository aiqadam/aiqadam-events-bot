# W107. Короткий онбординг: одна карточка согласия, имя без подтверждения, без экрана «Всё верно?»

- **Статус**: готов
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W59, W60 (онбординг C), W50
- **Начат**: 2026-09-26 · **Закрыт**: 2026-09-27

## Цель

Сократить первое касание бота с 7 карточек / 6 тапов до 4 карточек / 3 тапов,
не трогая требования PAR-1/PAR-2/PAR-8 и не перенося профиль в Mini App.
Владелец запросил разбор вариантов в чате 2026-09-26; принята связка трёх правок:

1. **why-карточка и карточка согласия — один экран.** Текст согласия
   (`onb.consent`) уходит на входную карточку (`reg-start/step_9`,
   `menu/step_4`), кнопка называется «Согласен» (`onb.btn.agree`, `ob:agree`).
   Экран `show_consent` и колбэк `ob:continue` на входе больше не нужны.
2. **Чистое имя из Telegram не подтверждается отдельным шагом.**
   `consent_namecheck` при не-подозрительном имени сразу отдаёт вопрос о работе
   (`show_work`, `useTgName:true`); подозрительное — прежний ручной ввод.
   Карточка `onb.name_ok` и кнопки «Это я»/«Поправить имя» (`ob:itsme`) уходят.
3. **Экрана «Всё верно?» нет.** Выбор города (кнопкой или текстом) сразу ведёт
   в `finish`: запись профиля + регистрации, и там же вопрос о рассылке.
   Колбэки `ob:allgood`/`ob:fix` и текст `onb.review` уходят вместе с экраном.
   Это же снимает незакрытый баг W59 («Исправить» откатывал на имя, теряя
   работу и город).

Решение — новый [ADR-0043](../../docs/adr/0043-shorter-onboarding.md)
(надстройка над [ADR-0032](../../docs/adr/0032-onboarding-first-touch-profile.md),
не отменяет его). ТЗ — правка [SPEC PAR-8](../../docs/SPEC.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| ADR | [0043](../../docs/adr/0043-shorter-onboarding.md) | — |
| flow `reg-profile` | `bEz2bKyL82zlIwckxqvxc` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| flow `reg-start` | `furNEp5R3KFZ2jdSni2Eu` | [catalog/flows/reg-start.md](../../catalog/flows/reg-start.md) |
| flow `menu` | `rV2ymkl6ET11uMjbywU4D` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |

## Чек-лист готовности

- [x] ADR-0043 принят (запрос владельца 2026-09-26), SPEC PAR-8 приведён в соответствие
- [x] `reg-start/step_9` и `menu/step_4`: why + согласие одной карточкой, кнопка `ob:agree`
- [x] `reg-profile/step_3`/`step_4`: чистый вход имени → сразу работа; подозрительный — ручной ввод; city → finish; экран review снят
- [x] вход по диплинку события: согласие → работа → город → готово+маркетинг → билет (различающий прогон)
- [x] вход голым `/start` (menu, без события): тот же диалог, финал `finish_no_event` (различающий прогон)
- [x] отклонение (`ob:decline`) на согласии и «Подробнее» (`ob:details`) работают как прежде
- [x] подозрительное имя (`has_digit`/`bad_chars`) уходит в ручной ввод, не регистрирует «Crypto King»
- [x] повторное касание (`ob:register` → `finish_lite`) не сломано
- [x] `i18n/ru.json` и `tools/check-texts.py` — 0 расхождений; `check-commands.py` — 0
- [x] `catalog/` совпадает с живым проектом
- [x] независимое ревью: вердикт «замечаний нет» (круг 3)

## Как проверено

Различающими MCP-прогонами `ap_test_flow` на `events-dev` (обёртка `{"data":{...}}`,
гоча №13) и чтением таблиц, а не только ответом шага. Тестовые `telegram_id`
(888888888…893), временное событие `w107tmp` и диагностические строки
`users`/`sessions`/`registrations` удалены после проверки.

1. `reg-profile` `ob:agree`, чистое имя `Дилшод Азимов`, `eventId:''` → `step_3`
   `check.suspicious=false`; `step_4` `writeKind:'consent'`, `nextStep:'ob_await_work'`,
   `profile:{first,last}` из Telegram, `saveConsent:true`; ROUTER ушёл в ветку
   `consent`; `users` получил `consent_pdn=true`; сессия `ob_await_work`. Первое
   касание чистое имя **не подтверждает** — сразу вопрос о работе.
2. `reg-profile` текст `ML-инженер, Payme` на шаге `ob_await_work` → `text_work`,
   `writeKind:'card'`, `profile.position/company` домешены, `nextStep:'ob_city'`.
3. `reg-profile` `ob:city:Tashkent`, `eventId:''` → `finish` с `city:'Ташкент'`;
   `step_4` `writeKind:'finish_no_event'`, в `profile.city` город; `users` получил
   все шесть профильных полей + `consent_pdn` + `profile_completed_at`, сессия
   `await_marketing`; `registrations` **не трогалась** (экрана review нет, но
   регистрации без события и не должно быть).
4. `reg-profile` `ob:city:Almaty`, `eventId:mu9rqipgetmp` (событие есть) →
   `writeKind:'finish'`, `step_23` создал `registrations` с id
   `mu9rqipgetmp-888888889`; факты события (дата/адрес/карта) в финальной карточке.
   То есть регистрация по-прежнему создаётся только на `finish`.
5. `reg-profile` `ob:agree`, имя `Crypto King 👑` → `check.reason='has_emoji'`,
   `writeKind:'consent'`, карточка `onb.suspect`, `nextStep:'ob_name'` — ручной
   ввод, «Это я» нет.
6. `reg-profile` `ob:decline` на `ob_consent` → `writeKind:'declined'`, сессия
   очищена сентинелом `-`, текст `declined_no_link` (события нет).
7. `menu` (профиль пуст) → `needs_onboard`, `step_4` отдал текст `onb.why` +
   `onb.consent` одной карточкой и кнопку «Согласен» / `ob:agree`.
8. `reg-start` с временным опубликованным событием `w107tmp` → `outcome:'onboard'`,
   `step_9` — факты события + `onb.why` + `onb.consent`, кнопка `ob:agree`.
9. Офлайн: `check-texts.py` 31/267/0, `check-commands.py` 0, `check-export-secrets.sh`
   чисто, `check-agents.py` 0.
10. После замечания ревьюера (круг 1) — исправление и проверка: `menu` и
    `reg-start` (временное событие) отдают входную карточку с **двумя**
    кнопками `[Согласен ob:agree][Подробнее ob:details]`; `ob:details` открывает
    полный текст с `[Понятно, согласен ob:understood][Не сейчас ob:decline]`;
    `ob:understood` пишет согласие и ведёт к вопросу о работе. Временное
    событие и диагностические строки удалены. Офлайн после правки:
    `check-texts.py` 31/269/0 (добавлены `onb.btn.details` в две карточки),
    `check-commands.py` 0, `check-export-secrets.sh` чисто.

Сендеры в прогонах дали `400 chat not found` (синтетический чат) — это ожидаемо
и происходит **после** записи в таблицы; именно так W59 проверял ветки. Живой
прогон в Telegram — хвост на владельца.

## Журнал

- **2026-09-26** — Пакет взят по прямому запросу владельца (разбор вариантов
  в чате, без предварительного пакета BACKLOG — как W58/W59). Выбрана связка
  1+2+3 из разбора: она не требует Mini App (вариант 5/6 отложены), не трогает
  обязательность полей (вариант 4 отвергнут) и остаётся в чате.
- **2026-09-26** — Границы: PAR-1 держится тем, что согласие записывается
  веткой ROUTER `consent` при `ob:agree` **до** вопроса о работе; PAR-2 —
  маркетинг по-прежнему отдельным вопросом после регистрации; PAR-8 — те же
  пять полей, тот же гейт `profile_completed_at`. Регистрация создаётся только
  на `finish`/`finish_lite`, как и было.
- **2026-09-26** — `reg-profile/step_4`: ветку `finish` пришлось научить
  домешивать город из `p.city` (раньше это делал снятый `show_review`), иначе
  `finish_no_event` потерял бы город при выборе кнопкой/текстом.
- **2026-09-26** — Мёртвые ключи `onb.name_ok`/`onb.review`/`onb.btn.*` не
  удаляются из `i18n/ru.json`: это архив корпуса (прецедент — `menu.title`),
  а прототип и `check-texts.py` на них больше не опираются.
- **2026-09-26** — Экспорт `flows/*.json` снят MCP-путём (ключ платформы на
  машине отсутствует): `ap_export_flow` через OAuth-эндпоинт, затем штатный
  `tools/export-flow-mcp.py` (`source: mcp`). Новые версии: `menu`
  `E1imPZqAQ2VGrVP5paUls`, `reg-profile` `VobO7ZfoaJGEoNEbUCyvN`, `reg-start`
  `XZlvZyyavCpKHVcQcMxft`.
- **2026-09-26** — Правка комментария `reg-start/step_15` (упоминал снятый
  `ob:continue`) потребовала повторной публикации `reg-start` и повторного
  экспорта — сделано.
- **2026-09-27** — Круг 1 ревью нашёл **блокер**: при слиянии why и согласия в
  одну карточку потерялась кнопка «Подробнее» (`ob:details`), а с ней — путь
  отказа `ob:decline` и полный текст согласия. Правильная форма — две кнопки
  «Согласен» + «Подробнее» (как в прототипе и ADR-0043). Возвращена на обе
  входные карточки; `ob:details`/`ob:understood` проверены прогонами, ветка
  отказа `ob:decline` в `show_details` уже была. Замечание «важно» (каталог
  `reg-start.md`: «why-карточка + Дальше») исправлено. Во второе ревью — с
  этой записью и обновлённым экспортом.
- **2026-09-27** — Владелец проверил живой флоу в Telegram: **работает**.
  Хвост «живой прогон на владельца» снят; пакет закрыт `готов` (ревью 3 круга,
  вердикт «замечаний нет»).

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 · **Вердикт**: есть замечания

### Замечания

1. **блокер** — На объединённой входной карточке нет кнопки «Подробнее», из-за чего
   недостижимы и полный текст согласия, и путь отказа (`ob:decline`).
   Где: `flows/reg-start.json` (`step_9`, `replyMarkup`), `flows/menu.json`
   (`step_4`, `replyMarkup`); мёртвый `show_details`-бранч в
   `flows/reg-profile.json` (`step_4`). Почему: `step_9`/`step_4` собирают
   `inline_keyboard` только из одной кнопки `onb.btn.agree` → `ob:agree`.
   Ни один шаг не отдаёт `callback_data: 'ob:details'` (grep по `flows/`:
   `ob:details` встречается лишь в обработчике `reg-profile/step_3`, а
   `onb.btn.details` — только в `prototypes/` и `i18n/ru.json`). Следствие:
   ветки `ob:details` → `ob_understood` → `consent_namecheck` и
   `ob:decline` из UI недостижимы вовсе. Это противоречит:
   - [ADR-0043](../../docs/adr/0043-shorter-onboarding.md) п. 1: «"Подробнее"
     (`onb.details`, `ob:details`) остаётся на месте»;
   - эталону `prototypes/scenarios.js` (входные карточки, строки 94/168/244):
     две кнопки `[Согласен][Подробнее]`, и `prototypes/onboard.html` прямо
     пишет «полный текст — за "Подробнее"»;
   - самому журналу (чек-лист: «отклонение (`ob:decline`) на согласии и
     "Подробнее" (`ob:details`) работают как прежде» — неверно) и каталогу
     `catalog/flows/reg-profile.md` (§Заметки, стр. 106–107: «Полный текст
     согласия остаётся за "Подробнее"» — неверно).
   Практическая цена: пользователь, не согласный на обработку ПД, не имеет
   ни одной кнопки, чтобы отказаться (остаётся молчание), а полный текст
   согласия невозможно раскрыть — это удар по PAR-1 и по преемственности
   согласия. Правка: вернуть на обе карточки вторую кнопку
   `onb.btn.details` → `ob:details` (первой оставить «Согласен»), как в
   прототипе и ADR; код `show_details` в `reg-profile/step_4` уже готов.
   - *Исправлено*: на `reg-start/step_9` и `menu/step_4` добавлена вторая
     кнопка «Подробнее» (`onb.btn.details` → `ob:details`), в `texts` добавлен
     ключ `onb.btn.details`. Прогоны `d79IdDr4pxySaZRhsI2vz` (`menu`) и
     `NGlkyhx3B48FA0RfwGBRt` (`reg-start`, временное событие) отдают
     `replyMarkup` с двумя кнопками `[Согласен ob:agree][Подробнее ob:details]`;
     прогоны `uc7UKY9xX7a5GjfW3VmSM` (`ob:details` → карточка полного текста с
     `[Понятно, согласен ob:understood][Не сейчас ob:decline]`) и
     `YIvC7dHvGYkWyKRRxkdWK` (`ob:understood` → `consent_namecheck`, согласие
     записано) подтверждают обе ветки. Опубликованы заново (`reg-start`
     `YxV0BnadDEOHpN0AMSmqk`, `menu` `9IbZNd9s13DcIgadgBRcd`), экспорт обновлён
     (2026-09-27).

2. **важно** — `catalog/flows/reg-start.md:9` описывает входную карточку как
   «`onboard`, why-карточка + `Дальше`». Кнопки «Дальше» и колбэка
   `ob:continue` больше нет (ADR-0043); тот же файл ниже (§Шаги, стр. 26;
   §Заметки, стр. 46–48) верно называет «Согласен»/`ob:agree`. Почему важно:
   каталог — утверждение о реальности; строка «Назначение» врёт и
   противоречит сама себе, а пакет отметил «`catalog/` совпадает с живым
   проектом». Правка — одно слово: `Дальше` → «Согласен» (`ob:agree`).
   - *Исправлено*: `catalog/flows/reg-start.md` (§Назначение) теперь
     «карточка "зачем + согласие" + `Согласен`/`Подробнее`»; строки таблицы и
     заметок называют обе кнопки. `catalog/flows/menu.md` — то же
     (2026-09-27).

### Как проверено и чем это ревью ограничено

**Живой проект (MCP, `app-flow-events-dev`, `vZXlkfz60dx6kX97yICx7`).**
`ap_list_flows` (32 флоу, три целевых — ENABLED/published); `ap_flow_structure`
по `reg-profile` (`bEz2bKyL82zlIwckxqvxc`), `reg-start` (`furNEp5R3KFZ2jdSni2Eu`),
`menu` (`rV2ymkl6ET11uMjbywU4D`) — шаги совпадают с каталогом, `invalid`/заглушек
нет; `ap_read_step_code` по `reg-profile/step_3` и `step_4`, `reg-start/step_9`,
`menu/step_4` — код побайтово равен `flows/*.json` и каталогу, все функции
чистые (без сети и записи в таблицы). Живой `ap_export_flow`: `reg-profile`
`flows[0].id = VobO7ZfoaJGEoNEbUCyvN`, `reg-start` `XZlvZyyavCpKHVcQcMxft` —
совпадают с `publishedVersionId` в `flows/_manifest.json`, оба `state: LOCKED`,
`status: PUBLISHED`; `menu` — через манифест, `migrations` и живой
`step_4` (отдельный экспорт не снимал, см. ограничения). `migrations`:
`2026-09-26-w107-01/02/03` (`package W107`, `action publish`, `commit 3f89b2e`) —
`version_id` = версии из манифеста.

**Различающие прогоны владельца прочитаны, а не приняты на слово**
(`ap_list_runs` flow `reg-profile`, TESTING — 6 прогонов, все завершились
`400 chat not found` на отправке, после записи в таблицы; это и есть ожидаемый
исход синтетического чата):
- `xF5m8sCwBSrgHGDyeMIFI` — `ob:agree`, чистое имя `Дилшод Азимов`,
  `sessionDraft.eventId: ''`: `step_3 check.suspicious=false`, `step_4`
  `writeKind:'consent'`, `nextStep:'ob_await_work'`, `profile:{first,last}`,
  `saveConsent:true`; ROUTER ушёл в `consent`; `step_13` создал `users` с
  `consent_pdn=true`. PAR-1 держится — согласие записано до вопроса о работе.
- `aRPtNivdz1YOMfvFcHwnF` — `ob:city:Tashkent`, `draft.step:'ob_city'`,
  `eventId:''`: `step_4 writeKind:'finish_no_event'`, `profile` с городом,
  `step_35` записал шесть профильных полей + `consent_pdn` +
  `profile_completed_at`; `registrations` не тронута (ADR-0034 — верно).
- `ob:decline`, `ob:details` и `ob:understood` живьём не проверялись и не
  могли быть: кнопок для них нет (замечание 1). Собственных прогонов не
  заводил: дефект структурный (кнопки отсутствуют), доказывается кодом и
  `replyMarkup` без побочных эффектов; позитивное/негативное ветвление уже
  подтверждено прочитанными прогонами. За собой удалять нечего — тестовые
  строки не создавал.
- Чистота после прогонов владельца: `users`/`sessions`/`registrations` по
  `telegram_id` 888888888…893 пусты, события `w107tmp` в `events` нет.

**Офлайн:** `check-texts.py` — 31 флоу / 267 пар / 0; `check-commands.py` — 0;
`check-export-secrets.sh` — чисто, значения секретов в экспорт не попали;
`check-agents.py` — 0. `check-migrations.py` запустить не удалось — на машине
нет ключа платформы (`QADAM_API_KEY`/Keychain); это известное ограничение, не
замечание пакета, манифест ↔ инстанс ↔ `migrations` сверены точечно по трём
флоу.

**Инварианты:** PAR-1 (согласие веткой `consent` при `ob:agree` до первого поля
ПД, регистрация — только в `finish`), PAR-2 (маркетинг отдельным вопросом,
`consent_marketing` не проставляется), PAR-8 (те же пять полей + гейт
`profile_completed_at`, недозаполненное — сессия), ADR-0034 (`finish_no_event`
без `registrations`) — держатся по коду и по прогонам. `finish_lite` не тронут
по существу: новая строка домешивания города инертна при пустом `p.city`, а
ветка `users` не пишет; отдельного прогона `finish_lite` владелец не оставил,
но диф это подтверждает.

**AppSec:** эвристика имени и ручной ввод/город в MarkdownV2 экранируются
(`esc` применяется ко всему пользовательскому тексту, включая `onb.suspect`
через `eventCard(extra)`); нового самописного HMAC/секретов нет; `auth` —
ссылки `{{connections[...]}}`; IDOR/PAR и `sig`-парсинг пакет не трогает.
Замеченный прототипный дефект — не AppSec, а функциональная регрессия
(замечание 1).

**Ограничения ревью:** живого Telegram-чата и `initData` у ревьюера нет
(хвост на владельце, как и записано); `check-migrations.py` без ключа; экспорт
`menu` отдельно не выгружался (id сверен через манифест, `migrations`,
структуру и код); пред-существующее расхождение состава манифеста (`ChatBot`
есть в проекте, нет в `flows/_manifest.json`) — унаследованный хвост,
задокументирован в W70/W72/W103/W106, к W107 не относится.

### Круг 2

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 · **Вердикт**: есть замечания (блокеров и «важно» нет; одно «на будущее»)

**Оба замечания круга 1 закрыты и проверены живьём, а не по записи владельца.**

- *Блокер (кнопка «Подробнее»)*. Живой `ap_read_step_code`: `reg-start/step_9` и
  `menu/step_4` собирают `replyMarkup.inline_keyboard` из **двух** кнопок —
  `[onb.btn.agree → ob:agree][onb.btn.details → ob:details]`; ключ
  `onb.btn.details: "Подробнее"` есть во входах `texts` обеих карточек.
  `reg-profile/step_3` маршрутизирует `ob:details` (при `draft.step=ob_consent`)
  → `show_details`, `ob:understood` (при `ob_details`) → `consent_namecheck`,
  `ob:decline` — на `ob_consent`/`ob_details`; `reg-profile/step_4` на
  `show_details` отдаёт карточку `onb.details` с кнопками
  `[Понятно, согласен ob:understood][Не сейчас ob:decline]`. Прогон владельца
  `uc7UKY9xX7a5GjfW3VmSM` (`ob:details`) это подтверждает текстом и обеими
  кнопками; `YIvC7dHvGYkWyKRRxkdWK` (`ob:understood`) даёт `writeKind:'consent'`,
  `saveConsent:true`, ROUTER → `consent`, `step_13` пишет `users.consent_pdn=true`
  (PAR-1). Путь `ob:details` достижим и сквозь `tg-router`: колбэк с префиксом
  `ob:` при активной сессии `registration` маршрутизируется в `reg_profile`
  (`flows/tg-router.json`, код маршрутизации). Опубликовано: живой
  `ap_export_flow` отдаёт `reg-start` `YxV0BnadDEOHpN0AMSmqk` и `menu`
  `9IbZNd9s13DcIgadgBRcd` — те же, что `publishedVersionId` в
  `flows/_manifest.json` и `version_id` в `migrations` `2026-09-26-w107-02/03`
  (commit `77225fd`), оба `state: LOCKED`.
- *«Важно» (каталог `reg-start.md` «Дальше»)*. `catalog/flows/reg-start.md`
  (§Назначение, §Шаги, §Заметки) и `catalog/flows/menu.md` называют обе кнопки;
  `ob:continue`/«Дальше» нигде не описаны как живые — только «снят» либо
  архивные ключи `i18n/ru.json` / мёртвые ключи во входах `texts`.

#### Замечания

1. **на будущее** — `docs/STATUS.md`, строка W107, перечисляет **устаревшие**
   опубликованные версии: `reg-start` `XZlvZyy…` и `menu` `E1imPZq…`. После
   правки круга 1 оба флоу опубликованы заново — `YxV0BnadDEOHpN0AMSmqk` и
   `9IbZNd9s13DcIgadgBRcd` (совпадают в живом `ap_export_flow`,
   `flows/_manifest.json` и `migrations`); `reg-profile` `VobO7Zf…` верен.
   Где: `docs/STATUS.md:174`. Почему: STATUS — «состояние работ», не каталог,
   на логику не влияет, но строка врёт о том, что сейчас опубликовано. Правка —
   два id при закрытии пакета.
   - *Исправлено*: `docs/STATUS.md` (строка W107) обновлена на актуальные
     версии. Попутно закрыт хвост, который ревьюер отметил в «Ограничениях»:
     после тестовых прогонов черновик `reg-profile` разошёлся с публикацией
     (гоча №14), живой `ap_export_flow` отдавал DRAFT `EEvBjDZ…`. `reg-profile`
     опубликован заново — `EEvBjDZGB51k4ay0vaZd8` (код тот же, `exampleData`
     пуст), `flows/_manifest.json` и `migrations` обновлены; теперь draft ==
     published у всех трёх флоу (2026-09-27).

#### Чем проверено и чем ограничено

**Живой проект (MCP, `app-flow-events-dev`).** `ap_read_step_code` по
`reg-start/step_9`, `menu/step_4`, `reg-profile/step_3`/`step_4` — код
побайтово совпал с `flows/*.json`; `ap_export_flow` по трём флоу — `state:
LOCKED`, `status: PUBLISHED`, `flows[0].id = publishedVersionId` для `reg-start`
и `menu`; `ap_list_flows` — три флоу ENABLED/published; `ap_validate_flow` —
21/15/40 шагов, все valid, заглушек/invalid нет; `ap_get_run` — прочитаны
различающие прогоны (`xF5m8sCwBSrgHGDyeMIFI` — `ob:agree`, чистое имя →
`writeKind:'consent'` **до** вопроса о работе, PAR-1; `uc7…` — `ob:details` →
карточка `onb.details` + `[ob:understood][ob:decline]`; `YIv…` — `ob:understood`
→ согласие записано). Таблицы после прогонов чисты: `users`/`sessions`/
`registrations` по `telegram_id` 888888888–896 пусты (включая 895/896 из
прогонов круга 1), события `w107tmp` нет. Офлайн: `check-texts.py` — 31 флоу /
269 пар / 0; `check-commands.py` — 0; `check-export-secrets.sh` — чисто,
значений секретов в экспорте нет; `check-agents.py` — 0.

**AppSec.** Пользовательские данные (имя из Telegram, текст/город) уходят в
MarkdownV2 только через `esc(...)` — в `reg-profile/step_4` через
`eventCard(extra)` и `esc` на каждом поле, в `reg-start/step_9`/`menu/step_4`
тексты статические; согласие пишется веткой `consent` до первого поля ПД
(PAR-1, подтверждено прогонами); нового самописного HMAC/секретов нет, `auth` —
ссылки `{{connections[...]}}`; IDOR/PAR и `sig`-парсинг пакет не трогает.

**Ограничения.** Живого Telegram-чата и `initData` у ревьюера нет (хвост на
владельце). `check-migrations.py` без ключа платформы не запускался — манифест
↔ инстанс ↔ `migrations` сверены точечно по трём флоу. Живой `ap_export_flow`
по `reg-profile` возвращает `flows[0].id = EEvBjDZGB51k4ay0vaZd8` — это
пост-публикационный слепок тестовых прогонов `uc7…`/`YIv…` (создан
19:22:53–19:23:04, гоча №14), а не опубликованная `VobO7ZfoaJGEoNEbUCyvN`;
последняя подтверждается `migrations` `2026-09-26-w107-01` (commit `3f89b2e`) и
`flows/_manifest.json`, а код живого шага совпадает с экспортом. Самостоятельных
прогонов не заводил: ветвление доказано кодом, `replyMarkup` и прочитанными
прогонами владельца; за собой удалять нечего.

### Круг 3

- **Ревьюер**: агент (независимый, чистый контекст) · **Дата**: 2026-09-27 · **Вердикт**: замечаний нет

**Единственное замечание круга 2 («на будущее» — устаревшие версии в `docs/STATUS.md`)
закрыто и проверено живьём; новых проблем нет.**

- *STATUS.* Строка W107 (`docs/STATUS.md:174`) перечисляет `reg-profile` `EEvBjDZ…`,
  `reg-start` `YxV0Bnad…`, `menu` `9IbZNd9s…` — все три совпадают с живым
  `ap_export_flow`, `flows/_manifest.json` (`publishedVersionId`) и `migrations`
  `2026-09-26-w107-01/02/03` (`version_id`). Прежние `XZlvZyy…`/`E1imPZq…` из строки ушли.
- *Перепубликация `reg-profile` (гоча №14).* Живой `ap_export_flow`
  (`bEz2bKyL82zlIwckxqvxc`) теперь отдаёт `EEvBjDZGB51k4ay0vaZd8` со `state: LOCKED`,
  `status: PUBLISHED` — то есть draft == published; прежний DRAFT-слепок тестовых
  прогонов совпал с опубликованной версией. `migrations` `2026-09-26-w107-01`
  (`action publish`, `version_id EEvBjDZGB51k4ay0vaZd8`, commit `bac425b`) и манифест —
  те же. `reg-start`/`menu` — `YxV0BnadDEOHpN0AMSmqk`/`9IbZNd9s13DcIgadgBRcd`,
  `state: LOCKED`, `status: PUBLISHED`, совпадают во всех трёх источниках.
- *Код шагов.* `ap_read_step_code`: `reg-start/step_9` и `menu/step_4` собирают
  `replyMarkup.inline_keyboard` из **двух** кнопок `[Согласен ob:agree][Подробнее ob:details]`;
  в их входах `texts` есть `onb.btn.details: "Подробнее"`. `reg-profile/step_3`
  маршрутизирует `ob:details` (при `draft.step=ob_consent`) → `show_details`,
  `ob:understood` (при `ob_details`) → `consent_namecheck`, `ob:decline` — на
  `ob_consent`/`ob_details`; `step_4` на `show_details` отдаёт карточку `onb.details`
  с `[Понятно, согласен ob:understood][Не сейчас ob:decline]`. Маркеры совпали с
  `flows/{reg-start,menu,reg-profile}.json`. Путь `ob:details` достижим сквозь
  `tg-router`: колбэк с префиксом `ob:` при активной сессии `registration` (в т.ч.
  без `eventId`, из `menu`) уходит в `reg_profile` (`flows/tg-router.json`, код
  маршрутизации).
- *Каталог.* `catalog/flows/{reg-start,reg-profile,menu}.md` называют обе кнопки;
  `ob:continue`/«Дальше» упомянуты только как снятые (`reg-start.md:50`,
  `reg-profile.md:25`) или как архивные ключи `i18n/ru.json`/входы `texts` — живыми
  не описаны.
- *Таблицы.* Диагностических строк нет: `users`/`sessions`/`registrations` по
  `telegram_id` 888888888–896 — пусто, события `w107tmp*` в `events` нет.
- *Структуры.* `ap_flow_structure` по трём флоу — все шаги `configured`, `invalid`
  и заглушек нет (перепубликация `reg-profile` структуру не меняла).
- *Офлайн.* `check-texts.py` — 31 флоу / 269 пар / 0; `check-commands.py` — 0;
  `check-export-secrets.sh` — чисто (значений секретов в экспорте нет);
  `check-agents.py` — 0.

**Ограничения.** Живого Telegram-чата и `initData` у ревьюера нет (хвост на
владельце, как и в кругах 1–2). `check-migrations.py` без ключа платформы не
запускался — манифест ↔ инстанс ↔ `migrations` сверены точечно по трём флоу.
Наблюдение, не влияющее на вердикт: в строке `docs/STATUS.md` сохранился оборот
«осталось одно „на будущее“ (эта строка)» от круга 2 — сам пункт закрыт (версии
актуальны), оборот снимается при переводе пакета в `готов`. Самостоятельных
прогонов не заводил: дефект структурный, доказывается кодом и `replyMarkup`;
за собой удалять нечего.

## Хвосты и блокеры

- Нет. Живой прогон в реальном Telegram **подтверждён владельцем 2026-09-27**:
  онбординг проходит и работает.
