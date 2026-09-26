# W107. Короткий онбординг: одна карточка согласия, имя без подтверждения, без экрана «Всё верно?»

- **Статус**: в работе
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

## Ревью

> Заполняет **независимый ревьюер** по [REVIEW-CHECKLIST.md](REVIEW-CHECKLIST.md).
> Владелец пакета сюда не пишет — только отвечает под замечаниями, что исправлено.

- **Ревьюер**: <агент> · **Дата**: YYYY-MM-DD · **Вердикт**: —

### Замечания

1. —

## Хвосты и блокеры

- Живой прогон в Telegram (реальный чат) — на владельца: у агента нет живого
  Telegram-пользователя без профиля. MCP-прогоны `ap_test_flow` закрывают
  ветвление, но не отправку настоящему клиенту.
