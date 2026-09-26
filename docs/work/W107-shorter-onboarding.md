# W107. Короткий онбординг: одна карточка согласия, имя без подтверждения, без экрана «Всё верно?»

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн
- **Зависит от**: W59, W60 (онбординг C), W50
- **Начат**: 2026-09-26 · **Закрыт**: —

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
- [ ] независимое ревью: вердикт «замечаний нет»

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

## Хвосты и блокеры

- Живой прогон в Telegram (реальный чат) — на владельца: у агента нет живого
  Telegram-пользователя без профиля. MCP-прогоны `ap_test_flow` закрывают
  ветвление, но не отправку настоящему клиенту.
