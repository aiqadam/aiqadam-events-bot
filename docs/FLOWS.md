# Флоу

Целевой состав флоу. Каждый построенный флоу описывается в
`catalog/flows/<flow>.md` по формату `catalog/flows/_TEMPLATE.md` — это и есть
версионируемое состояние ([ADR-0004](adr/0004-catalog-instead-of-flow-export.md)).
Subflow-«функции» именуются `fn-*` и лежат там же.

Легенда: **T** — триггер, **A** — action-шаг, **C** — Code step.

---

## `tg-router` — единственный вход бота

**T** `telegram-bot / new-message` (вебхук бота принадлежит только этому флоу).

1. **A** `store get` `upd:<update_id>` → если есть, выход (IDM-4).
2. **A** `store put` `upd:<update_id>`, TTL 24ч.
3. **A** `tables upsert` `users` — обновляем `first_name`/`username`/`lang`,
   снимаем `blocked_bot` (человек снова пишет — значит, не заблокирован).
4. **C** классификация апдейта: `/start` с payload · команда · нажатие кнопки ·
   контакт · шаг активного визарда.
5. Ветвление → `call-flow` в один из обработчиков ниже.

Роутер сам ничего не отвечает пользователю — только классифицирует и делегирует.

### Ветка `/start` с payload

**A** `call-flow fn-parse-start` → по `kind`:

| `kind` | Payload | Куда |
| --- | --- | --- |
| `e` | `e<id>-<utm>` | `registration` (OWN-6) |
| `c` | `c<eventId>-<userId>-<sig>` | `checkin-deeplink` (STF-3, fallback) |
| `s` | `s<eventId>-<token>` | `staff-accept` (OWN-14) |
| — | пусто/мусор | приветствие + список ивентов |

---

## `registration` — регистрация участника

Вход: `telegram_id`, `event_id`, `utm`.

1. **A** `tables get-record` `events` → проверки: `status = published`,
   `now < reg_deadline_at`, есть места:
   `count(status=registered) < ceil(capacity × (1 + overbook_pct/100))` (OWN-15).
   Мест нет → вежливый отказ, строка в `registrations` не создаётся.
2. **A** `call-flow fn-event-card` → карточка ивента.
3. **A** `telegram sendVenue` (OWN-2) + `sendMessage` с ссылкой на Я.Карты.
4. **Шаг согласия на обработку данных** — кнопка «Согласен» (PAR-1).
   Отказ → регистрация **не создаётся**, диалог закрывается вежливо.
5. **A** `tables upsert registrations` по `(event_id, telegram_id)`,
   `status = registered`, `source = utm` (IDM-1).
6. **Отдельный шаг: согласие на рассылку** (PAR-2) — «Да» / «Нет, спасибо».
   Любой ответ, включая отказ, оставляет регистрацию в силе.
   Кнопка «Нет» — не серая и не мелкая; отказ должен быть равноправным.
7. Опционально: `request_contact` для телефона (DAT-2), пропускаемо.
8. **A** `call-flow fn-sign-qr` → `qrcode` qadam → отправка QR участнику (PAR-6).

Повторный вход по ссылке на уже существующую регистрацию: показываем QR и статус,
второе подтверждение не шлём (IDM-1).

---

## `my-registrations` / `events-list` — participant

- **A** `tables find-records` `events` где `status = published`, `starts_at > now`
  → «будущие»; `ends_at < now` → «прошедшие» (PAR-3).
- «Мои регистрации» (PAR-4) — `registrations` по `telegram_id`, с кнопкой QR.
- **Отмена** (PAR-5) — только пока `now < starts_at`; `status = cancelled`,
  `cancelled_at = now`. После старта кнопка не показывается вовсе.

---

## `checkin-api` — основной путь чекина (Mini App)

**T** `webhook`. Ответ обязан уложиться в `TRIGGER_TIMEOUT_SECONDS = 60` —
флоу короткий и синхронный, ничего тяжёлого внутрь не кладём.

Вход: `{ initData, payload, eventId }`.

1. **A** `call-flow fn-verify-init-data` — HMAC по токену бота + свежесть `auth_date`.
   Невалидно → `401`, дальше не идём (STF-2).
2. **A** `tables find-records` `event_staff` по `(eventId, telegram_id из initData)`
   и `revoked_at` пусто. Нет строки → `403`.
   **Это вторая половина STF-2: без неё любой участник отметит соседа.**
   Проверка «юзер — staff» без привязки к `eventId` считается багом, а не оптимизацией.
3. **A** `call-flow fn-parse-start` + `fn-verify-qr` — подпись QR.
4. Разбор исхода (STF-4):

| Условие | Ответ Mini App |
| --- | --- |
| `payload.eventId ≠ eventId` | `wrong_event` → «другой ивент» |
| подпись не сошлась | `invalid` |
| нет строки в `registrations` или `status = cancelled` | `not_registered` → «нет регистрации» |
| `checked_in_at` уже стоит | `already` + время в Asia/Tashkent → «уже отмечен в 18:42» |
| иначе | `ok` + имя участника |

5. Успех → `tables update-record`: `checked_in_at = now`, `checked_in_by`,
   **только если поле было пусто** (IDM-2).

Ответ всегда содержит имя участника, когда оно известно, — контролёр сверяет глазами.

---

## `checkin-deeplink` — fallback (системная камера)

**Те же проверки, что в `checkin-api`** (STF-3). Отличия: вход — `/start` с payload `c…`,
`event_staff` проверяется по `eventId` из payload, ответ — сообщением в чат.
Ни одна проверка не пропускается на том основании, что это «запасной путь».

---

## `staff-invite` / `staff-accept` — контролёры

`staff-invite` (owner): генерируем 22 символа base64url → `tables create-record`
`staff_invites` c `token_hash = sha256(token)`, `expires_at = now + 24ч` →
отдаём owner'у ссылку `?start=s<eventId>-<token>` (OWN-14).

`staff-accept`: `sha256` пришедшего токена → поиск по `token_hash`;
отказ если не найден, `used_at` не пуст или `now > expires_at`.
Успех → `used_at = now` + строка в `event_staff` + ссылка на Mini App.

Отзыв прав — `revoked_at = now` в `event_staff`; активные сессии Mini App
перестают работать на следующем же скане, потому что проверка идёт на каждый запрос.

---

## `event-wizard` — создание и правка ивента (owner)

Состояние — в `sessions` (`scenario = event_create`), шаг за шагом:
название → описание → фото → адрес → гео (`location`) → начало → конец → дедлайн → превью → публикация.

- Даты вводятся в ташкентском времени, **C** конвертирует в UTC на записи (OWN-3).
- Гео принимается сообщением-локацией; ручной ввод координат не предусмотрен.
- Публикация: `status = published`, `published_at = now`.
- Правка опубликованного (`scenario = event_edit`): **C** сравнивает старое и новое,
  и если задето хоть одно поле из [notify-on-change](DATA-MODEL.md#notify-on-change) —
  ставит рассылку уведомления зарегистрированным (OWN-5) с перечнем «было → стало».

---

## `lifecycle` — автопереходы статусов

**T** `schedule` каждые 5 минут.

- `published` и `now > ends_at` → `finished` (OWN-4).
- `cancelled` вручную owner'ом → уведомление всем `registered`.

---

## `reminders` — напоминания

**T** `schedule` каждые 15 минут. Виды: **`24h` и `2h`** (OWN-16), напоминания
в момент старта нет.
Перед каждой отправкой — `store` put-if-absent `rm:<event_id>:<kind>:<telegram_id>` (IDM-3).
Пропущенное окно (платформа лежала) не досылается задним числом: напоминание за 2 часа,
отправленное через 3 часа после начала, хуже, чем неотправленное.

---

## `broadcast`

### Составление (owner)

`scenario = broadcast` в `sessions`: сегмент (OWN-9) → текст → **предпросмотр** →
**обязательный тест себе** (OWN-10).

Сегмент `no_show` не предлагается, пока `now < ends_at`, и owner видит причину
с указанием, когда сегмент откроется (OWN-9). Это проверка на сервере, а не
скрытая кнопка в UI.

Кнопка «Отправить» появляется, **только когда `broadcasts.test_sent_at` не пусто**.
Это не UI-подсказка, а проверка на сервере: запуск без `test_sent_at` отклоняется.

### `broadcast-runner`

**Важно:** отправлять из Code step нельзя — в песочнице нет `fetch`
([ARCHITECTURE.md](ARCHITECTURE.md#песочница-code-step--проверено-на-инстансе-2026-09-08)).
Поэтому цикл рассылки — это **`LOOP_ON_ITEMS` по чанку**, внутри которого работают
qadam-шаги, а Code step только считает, кого брать следующим.

1. **A** `call-flow fn-resolve-segment` → снимок получателей в `broadcast_targets`
   (исключая `blocked_bot`; для `all_consent` — только `consent_marketing = true`).
2. **C** отрезает чанк от курсора `broadcasts.cursor` — чистое вычисление списка.
3. **LOOP** по чанку, на каждой итерации:
   - **A** `telegram send_text_message` с кнопкой **«Отписаться»** (OWN-13),
     шаг помечен `continueOnFailure` — иначе первая же ошибка убьёт весь прогон;
   - ветка **on success** → `tables update-record`: `state = sent` немедленно,
     до перехода к следующему адресату;
   - ветка **on failure** → **C** разбирает `{{step['error']}}`:
     `429` → `delay` ровно на `retry_after` и повтор того же адресата (OWN-12);
     `403` → `users.blocked_bot = true`, target `blocked`,
     **больше никогда не дёргаем** (OWN-12); иначе → `failed` с текстом ошибки;
   - **A** `delay` между итерациями держит темп **≤ 25 msg/s** (OWN-11).
4. Размер чанка подобран так, чтобы прогон не подходил к `FLOW_TIMEOUT_SECONDS = 600`;
   остаток добирает следующий запуск по курсору.

Курсор и `broadcast_targets.state` — это и есть защита от повторной отправки при рестарте.
Считать «отправлено» по счётчику `sent` нельзя: счётчик переживёт рестарт, а позиция — нет.

> **Не проверено:** достижимы ли 25 msg/s при пошаговом цикле платформы и доступен ли
> `retry_after` в объекте ошибки шага. Это самое рискованное место проекта —
> [Q13](OPEN-QUESTIONS.md#q13), измеряется до сборки W14.

### `unsubscribe`

Кнопка из массового сообщения → `consent_marketing = false`, `consent_marketing_at = now`,
подтверждение человеку. Отписка не трогает `consent_pdn` и не отменяет регистрации.

---

## `participants-list` / `export` — owner

Счётчики и фильтры (OWN-7) — `tables find-records` + **C** агрегация.
Экспорт (OWN-8): `csv` qadam → **C** дописывает **UTF-8 BOM** (`﻿`) в начало файла,
иначе Excel съест кириллицу; JSON — как есть. Отдаём документом в чат.
