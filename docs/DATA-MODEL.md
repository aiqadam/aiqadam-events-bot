# Модель данных

> **Актуальность (2026-09-13, W22).** Ниже логика описана через
> subflow-«функции» `fn-*`. **Этих флоу больше нет** — [ADR-0012](adr/0012-end-to-end-flows-instead-of-subflow-functions.md)
> отменил их как практику (W21 убрал все вызовы, W22 удалил сами флоу).
> Читайте `fn-<имя>` как «шаг по эталону
> [`catalog/snippets/<имя>`](../catalog/snippets/), встроенный в тело флоу».
> Требования от этого не изменились — изменилось только то, где живёт код.
> Единственный оставшийся `callFlow` в проекте — `tg-router` → `registration`.

Хранилище — **Qadam Flow Tables**. Ключи идемпотентности, где Tables не даёт гарантий, —
**Store** (`qadams/core/store`).

**Типы полей в Tables — только `TEXT`, `NUMBER`, `DATE`, `STATIC_DROPDOWN`**
(проверено на инстансе 2026-09-08). Поэтому:

- boolean хранится как `STATIC_DROPDOWN` со значениями `true` / `false`;
- JSON (`sessions.draft`) — как `TEXT` со строкой JSON;
- timestamp — `DATE`, ISO-8601 UTC.

Схема заведена в проекте `events-dev` (W1). Живые идентификаторы таблиц и полей,
dropdown-значения и рецепт пересборки — [catalog/tables/](../catalog/tables/README.md).
Что платформа при этом **не** проверяет (dropdown не валидирует значения, `DATE`
хранится как текст без приведения к UTC) —
[ARCHITECTURE](ARCHITECTURE.md#tables-на-практике--проверено-на-инстансе-2026-09-08).

Соглашения:

- все даты — **ISO-8601 в UTC** (`2026-09-08T14:00:00Z`), показ в `Asia/Tashkent` (OWN-3);
- `telegram_id` — единственный идентификатор пользователя (DAT-1), тип — строка
  (id уже вылезают за 2^53, в JSON-шагах число потеряет точность — **храним строкой**);
- `username` — только справочная подпись, ни одной связи и ни одной проверки прав по нему;
- boolean-флагов ролей нет (DAT-3).

## `users`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `telegram_id` | text, **PK** | единственный ключ (DAT-1) |
| `first_name` | text | из апдейта, обновляется при каждом контакте |
| `last_name` | text | может отсутствовать |
| `profile_first_name` | text | имя из онбординга (PAR-8), руками или кнопкой «Это я» |
| `profile_last_name` | text | фамилия из онбординга |
| `username` | text | справочно, может отсутствовать и меняться |
| `phone` | text | только из `request_contact` (DAT-2), иначе пусто; **с 2026-09-14 в регистрации не спрашивается** — остаётся в схеме на будущее |
| `lang` | text | `ru` \| `uz` \| `en` |
| `consent_pdn` | bool | согласие на обработку данных (PAR-1) |
| `consent_pdn_at` | timestamp | когда дано |
| `position` | text | должность из онбординга (PAR-8, [ADR-0032](../docs/adr/0032-onboarding-first-touch-profile.md)) |
| `company` | text | компания, может отсутствовать (фриланс/студент) |
| `city` | text | город из онбординга |
| `profile_completed_at` | timestamp | когда профиль заполнен полностью |
| `consent_marketing` | bool | отдельное и необязательное (PAR-2), по умолчанию `false` |
| `consent_marketing_at` | timestamp | |
| `blocked_bot` | bool | выставляется при `403` (OWN-12), снимается при новом апдейте от пользователя |
| `created_at` | timestamp | |

`consent_marketing` **никогда** не проставляется как побочный эффект `consent_pdn`.

Имя/фамилия профиля (PAR-8) хранятся **отдельно** от `first_name`/`last_name` —
те перезаписываются каждым апдейтом из Telegram: `profile_first_name`,
`profile_last_name` (TEXT, имена решены пакетом W50, [Q58](../docs/OPEN-QUESTIONS.md#q58)).

## `events`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, **PK** | короткий slug в алфавите `A-Za-z0-9_` — влезает в 64 символа deep link |
| `staff_id` | text → `staff.telegram_id` | **автор** (кто создал); не гейт прав ([ADR-0024](adr/0024-staff-by-chapter-event-staff-checkin.md)) |
| `chapter_id` | text → `chapters.id` | чаптер события; сейчас общий `1` ([ADR-0024](adr/0024-staff-by-chapter-event-staff-checkin.md), [Q8](OPEN-QUESTIONS.md#q8)) |
| `title` | text | |
| `description` | text | |
| `photo_file_id` | text | Telegram `file_id`, не URL |
| `address` | text | адрес текстом |
| `lat`, `lon` | number | для `sendVenue` (OWN-2) |
| `starts_at` | timestamp UTC | |
| `ends_at` | timestamp UTC | по нему автопереход в `finished` (OWN-4) |
| `reg_deadline_at` | timestamp UTC | |
| `status` | enum | `draft` \| `published` \| `cancelled` \| `finished` |
| `capacity` | number | опционально; пусто = без лимита |
| `overbook_pct` | number | перебор в расчёте на неявку, дефолт **40** (OWN-15) |
| `published_at`, `cancelled_at`, `finished_at` | timestamp | |

Ссылка на Яндекс.Карты **не хранится** — генерируется из `lat`/`lon` (OWN-2).

Эффективный лимит регистраций (OWN-15):

```
limit = capacity пусто ? ∞ : ceil(capacity × (1 + overbook_pct / 100))
```

Дефолт `overbook_pct = 40` выбран под бесплатные митапы, где неявка обычно
30–50%. Значение правится у каждого события: у камерного воркшопа с ограниченным
залом перебор в 40% — это люди, которым негде сесть. Как накопится своя
статистика неявок, дефолт стоит пересмотреть на фактах.

## `chapters`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, PK | slug |
| `title` | text | |
| `created_at` | timestamp | |

Заведена сразу, чтобы второй чаптер не требовал миграции. Заведён общий чаптер
`id=1` («AI Qadam Uzbekistan»); права `staff` режутся по чаптеру
([ADR-0024](adr/0024-staff-by-chapter-event-staff-checkin.md)), сегменты и
видимость по чаптеру рассылок **пока не режутся** — это отдельное требование, когда
появится ([Q8](OPEN-QUESTIONS.md#q8)).

## `staff`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `telegram_id` | text, PK | единственный ключ (DAT-1) |
| `chapter_id` | text → `chapters.id` | чаптер staff; пусто = все чаптеры |
| `note` | text | справочно |
| `added_at` | timestamp | UTC |

Строка в `staff` — право **создавать и править** события своего чаптера
([ADR-0024](adr/0024-staff-by-chapter-event-staff-checkin.md)). Доступ к событию:
`staff.chapter_id === '' ` или `staff.chapter_id === event.chapter_id`. Нет строки —
отказ и на создание, и на правку, одним `403 forbidden`. Ведётся человеком в UI
платформы; это не `users` (реестр контактов) и не `event_staff` (контролёры события).

### notify-on-change

Правка опубликованного события рассылает уведомление зарегистрированным (OWN-5),
если изменилось любое из: `starts_at`, `ends_at`, `address`, `lat`, `lon`, `title`,
`reg_deadline_at`, `status`.

Изменение `description`, `photo_file_id`, `capacity` — **не** повод для рассылки.
В уведомлении перечисляются только фактически изменившиеся поля («было → стало»).

## `registrations`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, PK | |
| `event_id` | text → `events.id` | |
| `telegram_id` | text → `users.telegram_id` | |
| `status` | enum | `registered` \| `cancelled` |
| `source` | text | utm из `?start=e<id>-<utm>` (OWN-6) |
| `registered_at` | timestamp | |
| `cancelled_at` | timestamp | |
| `checked_in_at` | timestamp | пусто = не пришёл; **пишется один раз** (IDM-2) |
| `checked_in_by` | text | `telegram_id` контролёра |

**Уникальность: `(event_id, telegram_id)`** — одна строка на пару, повторная регистрация
переводит `cancelled` обратно в `registered`, а не плодит строки (IDM-1).

Счётчики owner'а (OWN-7): зарегистрировано = `status=registered`;
пришло = `checked_in_at` не пусто; отменило = `status=cancelled`.
Сегмент «зарегались, но не пришли» = `status=registered` и `checked_in_at` пусто.
Доступен **только после `ends_at`** (OWN-9) — до конца события он означает
«ещё не дошёл», а не «не пришёл».

## `event_staff`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `event_id` | text → `events.id` | |
| `telegram_id` | text → `users.telegram_id` | |
| `granted_by` | text | кто выдал |
| `granted_at` | timestamp | |
| `revoked_at` | timestamp | пусто = права активны (OWN-14) |

**Уникальность: `(event_id, telegram_id)`.**
Проверка прав контролёра (STF-2) — это ровно «есть строка с этим `event_id`,
этим `telegram_id` и пустым `revoked_at`». Глобального права **чекина** не существует;
глобальный `staff` — это команда/организаторы, к чекину отношения не имеет.
Выдаёт и отзывает права **любой staff с доступом к событию** ([ADR-0024](adr/0024-staff-by-chapter-event-staff-checkin.md)).

## `staff_invites`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `token_hash` | text, PK | **SHA-256 от токена**; сам токен не хранится |
| `event_id` | text | |
| `created_by` | text | |
| `created_at` | timestamp | |
| `expires_at` | timestamp | `created_at + 24ч` (OWN-14) |
| `used_at` | timestamp | пусто = не использован; одноразовость |
| `used_by` | text | |

## `broadcasts`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, PK | |
| `event_id` | text | пусто для сегмента «все с consent» |
| `segment` | enum | `all_consent` \| `registered` \| `attended` \| `no_show` (OWN-9) |
| `body`, `parse_mode` | text | |
| `media_chat_id`, `media_message_id` | text | источник `copyMessage` (чат и `message_id` пересланного поста) для фото-рассылок; пусто у текстовых/старых (W79, #131) |
| `created_by` | text | |
| `test_sent_at` | timestamp | **пусто → отправка запрещена** (OWN-10) |
| `status` | enum | `draft` \| `running` \| `done` \| `failed` |
| `total`, `sent`, `failed_count` | number | |
| `cursor` | number | индекс в списке получателей, для возобновления |
| `started_at`, `finished_at` | timestamp | |

## `broadcast_targets`

Материализованный список получателей — снимок сегмента на момент старта.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `broadcast_id` | text | |
| `telegram_id` | text | |
| `state` | enum | `pending` \| `sent` \| `blocked` \| `failed` |
| `sent_at` | timestamp | |
| `error` | text | |

Уникальность `(broadcast_id, telegram_id)` — она же защита от двойной отправки при рестарте чанка.

## `sessions`

Состояние многошаговых диалогов в чате (регистрация, составление рассылки). Памяти процесса нет.
Создание и правка события сессий не используют — это форма `manage` (ADR-0017 п. 3, W31);
строки `event_create`/`event_edit` — остатки удалённого чатового визарда.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `telegram_id` | text, PK | одна активная сессия на человека |
| `scenario` | text | `registration` \| `broadcast` |
| `step` | text | текущий шаг диалога |
| `draft` | json | накопленные поля |
| `updated_at` | timestamp | сессии старше 24ч считаются протухшими |

## `strings`

Локализация (I18N-2), см. [I18N.md](I18N.md).

| Поле | Тип |
| --- | --- |
| `key` | text |
| `lang` | text (`ru`/`uz`/`en`) |
| `value` | text |

Уникальность `(key, lang)`.

## `feedback`

Отзывы участников об событии — оценка и необязательный комментарий
([ADR-0028](adr/0028-feedback-screen-fifth-miniapp-page.md), [Q53](OPEN-QUESTIONS.md#q53), W45).

| Поле | Тип | Примечание |
| --- | --- | --- |
| `event_id` | text → `events.id` | часть ключа |
| `telegram_id` | text | часть ключа (DAT-1) |
| `rating` | number | 1–5, целое |
| `comment` | text | необязателен, ≤2000 символов |
| `submitted_at` | timestamp | UTC, последней отправки |

Уникальность `(event_id, telegram_id)` не гарантирована БД
([ADR-0003](adr/0003-idempotency-without-atomicity.md)); поддерживается
`tables-upsert-records` с ключом по этой паре — повторная отправка
перезаписывает прежний отзыв, а не создаёт второй. Пишет только
`feedback-api`, после проверки участия (регистрация с чекином на конкретный
`event_id`). Читают — автор/staff события через `#/manage` (та же граница
прав, что у списков участников); без анонимности, без модерации, без
уведомления организатору отдельным сообщением.

## `quizzes`

Окно викторины в чате ([ADR-0041](adr/0041-quiz-in-chat-not-a-page.md), W103).

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, **PK** | slug викторины |
| `title` | text | название в сообщении-вступлении |
| `starts_at` | timestamp UTC | начало окна |
| `ends_at` | timestamp UTC | конец окна |

Вне окна викторина недоступна: кнопка в меню не рисуется, а вход отвечает
`quiz.closed`. Диапазонные фильтры по `DATE` не работают ([Q15](OPEN-QUESTIONS.md#q15)) —
активное окно выбирается в CODE-шаге.

## `quiz_questions`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `quiz_id` | text → `quizzes.id` | часть ключа |
| `idx` | number | номер вопроса, с 1; часть ключа |
| `text` | text | текст вопроса |

Ответ — свободный текст, поэтому правильных вариантов и баллов в схеме нет.
Порядок — по `idx`, сортировка в CODE.

## `quiz_attempts`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `quiz_id` | text → `quizzes.id` | часть ключа |
| `telegram_id` | text → `users.telegram_id` | часть ключа (DAT-1) |
| `started_at` | timestamp | обновляется при старте заново |
| `finished_at` | timestamp | пусто = не завершена; замок «одна попытка» |

Ключ `(quiz_id, telegram_id)` — `tables-upsert-records`. Завершённую попытку
перепройти нельзя; недоделанную — можно (сначала). Уникальность не гарантирована
БД ([ADR-0003](adr/0003-idempotency-without-atomicity.md)).

## `quiz_answers`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `quiz_id` | text → `quizzes.id` | часть ключа |
| `telegram_id` | text → `users.telegram_id` | часть ключа (DAT-1) |
| `question_idx` | number | часть ключа |
| `answer` | text | свободный ответ, обрезан до 500 символов |
| `answered_at` | timestamp UTC | момент приёма |
| `elapsed_ms` | number | мс от отправки вопроса до ответа |
| `late` | bool (dropdown) | `true` — ответ позже 15 с; не отказ, только метка |
| `display_name` | text | имя из Telegram на момент ответа, для читаемой выгрузки |

Ключ `(quiz_id, telegram_id, question_idx)` — повторный ответ на тот же вопрос
перезаписывает строку. Скоринга нет: победителей владелец определяет вне системы,
выгружая таблицу. `answer` и `display_name` — ПД, поэтому самоудаление аккаунта
([PAR-10](SPEC.md)) чистит и эти строки: `reg-api/delete_account` удаляет
`quiz_answers` и `quiz_attempts` (W103, [ADR-0041](adr/0041-quiz-in-chat-not-a-page.md)).

## Идемпотентность

**Проверено 2026-09-08:** уникальных индексов в Tables нет (три записи с одинаковым
ключом вставились подряд), upsert-действия нет, у `store put` нет ни put-if-absent,
ни TTL. Атомарного примитива на платформе не существует, поэтому «уникальность»
ниже — это соглашение наших флоу, а не гарантия БД.

Как мы с этим живём — [ADR-0003](adr/0003-idempotency-without-atomicity.md).
Коротко: повтор делаем безвредным, дубли схлопываем при чтении, остаток
**считает** `dedup-report` — диагностика, а не уборка
([Q42](OPEN-QUESTIONS.md#q42), W12b).

| Требование | Ключ | Механизм |
| --- | --- | --- |
| IDM-1 регистрация | `(event_id, telegram_id)` | `find-records` перед записью; подтверждение шлётся **только** при фактическом переходе `нет строки → registered` |
| IDM-2 чекин | `registrations.checked_in_at` | пишем **только если пусто**, никогда не перезаписываем; при нескольких значениях показываем минимальное |
| IDM-3 напоминания | `store` ключ `rm:<event_id>:<kind>:<telegram_id>` | `get` → `put`; окно между ними прикрыто тем, что расписание не запускает один вид напоминания дважды подряд |
| IDM-4 апдейты | `store` ключ `upd:<update_id>` | `get` → `put`; Telegram переотправляет апдейт через секунды, окно в миллисекундах практически не срабатывает |
| IDM-викторина (W103) | `quiz_answers` `(quiz_id, telegram_id, question_idx)`; `quiz_attempts` `(quiz_id, telegram_id)` | `tables-upsert-records`: повторный ответ на тот же вопрос перезаписывает строку, старт заново — те же ключи. «Одна попытка» держится не индексом, а `quiz_attempts.finished_at` |

**Чтение `registrations` идёт только через `fn-find-registration`**, который при
нескольких строках на `(event_id, telegram_id)` берёт самую раннюю. Счётчики (OWN-7)
и сегменты (OWN-9) считают **уникальные `telegram_id`**, а не строки: иначе один
задвоенный участник станет двумя.

Ключи `upd:*` истекают по TTL (`store put_if_absent`, [ADR-0011](adr/0011-idempotency-on-atomic-primitives.md));
дубли строк не убираются, а считаются — `dedup-report` ([Q42](OPEN-QUESTIONS.md#q42)).

## `migrations` (служебная, ADR-0021)

Не доменная таблица: журнал изменений инстанса через MCP — что, когда, какой
версией и каким коммитом репозитория описано. Флоу её не читают и не пишут;
схема и правила ведения — [catalog/tables/migrations.md](../catalog/tables/migrations.md).

## `cancelled_at` — не источник истины о статусе (Q30, 2026-09-12)

У **реактивированной** регистрации `cancelled_at` остаётся от прошлой отмены:
очистить DATE-поле через qadam `tables` сейчас нечем — пустая строка отвергается
валидатором дат, а «оставить пустым» у пропа `values` означает «не менять».

**Следствие, обязательное к соблюдению:** статус пары `(event_id, telegram_id)`
определяется полем **`status`**. Строка со `status = registered` и непустым
`cancelled_at` — нормальное состояние, а не противоречие в данных.
Списки участников и экспорт (OWN-8) обязаны фильтровать по `status`.

Подробности и путь к устранению — [Q30](../docs/OPEN-QUESTIONS.md#q30).
