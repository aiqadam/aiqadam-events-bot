# Модель данных

Хранилище — **Qadam Flow Tables**. Ключи идемпотентности, где Tables не даёт гарантий, —
**Store** (`qadams/core/store`).

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
| `username` | text | справочно, может отсутствовать и меняться |
| `phone` | text | только из `request_contact` (DAT-2), иначе пусто |
| `lang` | text | `ru` \| `uz` \| `en` |
| `consent_pdn` | bool | согласие на обработку данных (PAR-1) |
| `consent_pdn_at` | timestamp | когда дано |
| `consent_marketing` | bool | отдельное и необязательное (PAR-2), по умолчанию `false` |
| `consent_marketing_at` | timestamp | |
| `blocked_bot` | bool | выставляется при `403` (OWN-12), снимается при новом апдейте от пользователя |
| `created_at` | timestamp | |

`consent_marketing` **никогда** не проставляется как побочный эффект `consent_pdn`.

## `events`

| Поле | Тип | Примечание |
| --- | --- | --- |
| `id` | text, **PK** | короткий slug в алфавите `A-Za-z0-9_` — влезает в 64 символа deep link |
| `owner_id` | text → `users.telegram_id` | роль owner (DAT-3) |
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
| `published_at`, `cancelled_at`, `finished_at` | timestamp | |

Ссылка на Яндекс.Карты **не хранится** — генерируется из `lat`/`lon` (OWN-2).

### notify-on-change

Правка опубликованного ивента рассылает уведомление зарегистрированным (OWN-5),
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
Сегмент «зарегались, но не пришли» = `status=registered` и `checked_in_at` пусто,
считается только после `ends_at`.

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
этим `telegram_id` и пустым `revoked_at`». Глобального staff не существует.

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

Состояние визардов (создание ивента, составление рассылки). Памяти процесса нет.

| Поле | Тип | Примечание |
| --- | --- | --- |
| `telegram_id` | text, PK | одна активная сессия на человека |
| `scenario` | text | `event_create` \| `event_edit` \| `broadcast` |
| `step` | text | текущий шаг визарда |
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

## Идемпотентность

| Требование | Ключ | Механизм |
| --- | --- | --- |
| IDM-1 регистрация | `(event_id, telegram_id)` | уникальность в `registrations`; повтор = обновление статуса, подтверждение шлётся только при реальном переходе в `registered` |
| IDM-2 чекин | `registrations.checked_in_at` | пишем **только если пусто**; иначе возвращаем исходное время (экран «уже отмечен в 18:42») |
| IDM-3 напоминания | `store` ключ `rm:<event_id>:<kind>:<telegram_id>` | put-if-absent перед отправкой |
| IDM-4 апдейты | `store` ключ `upd:<update_id>`, TTL 24ч | если ключ есть — апдейт уже обработан, выходим |

> **Проверить до сборки:** даёт ли Tables настоящие уникальные индексы и атомарный
> upsert, и атомарен ли `store put`. Если нет — все четыре пункта переезжают
> на `store` с отдельным шагом-захватом ключа. См. [Q2](OPEN-QUESTIONS.md#q2).
> Без этой проверки идемпотентность держится на «мы проверили перед записью»,
> что при двух воркерах — гонка, а не гарантия.
