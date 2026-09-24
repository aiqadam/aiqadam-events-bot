# W73. Ответ на обычный текст + самоудаление аккаунта (GDPR)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: P1
- **Зависит от**: —
- **Начат**: 2026-09-23 · **Закрыт**: —

## Цель

Бот молчит на обычный текст, хотя сам зовёт «напишите нам / напишите снова»,
и отозвать согласие на обработку данных нечем. Решение владельца
2026-09-23: **вариант B** — кнопка «Удалить аккаунт» в табе «Профиль»,
удаление всего, что относится к `telegram_id` (GDPR), без контакта
организатора. Пакет разбит на Part 1 (этот) и Part 2 (отложен); граница —
[ADR-0039](../../docs/adr/0039-account-self-deletion-gdpr.md#границы-part-1--part-2).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `tg-router` | `nyaBzgKGG8TTTsryjc9tW` | [catalog/flows/tg-router.md](../../catalog/flows/tg-router.md) |
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` | [catalog/flows/menu.md](../../catalog/flows/menu.md) |
| flow `reg-api` | `SiYL8m6k4oy4YunAdZ1W7` | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| flow `reg-profile` (тексты) | `5U3Kv0cSrnvDTrbictA4L` | [catalog/flows/reg-profile.md](../../catalog/flows/reg-profile.md) |
| Mini App `routes/Events.tsx` (таб «Профиль») | — | — |
| ADR | [0039](../../docs/adr/0039-account-self-deletion-gdpr.md) | — |
| SPEC | PAR-10 | [docs/SPEC.md](../../docs/SPEC.md) |

## Чек-лист готовности

> Из [issue #125](https://github.com/aiqadam/aiqadam-events-bot/issues/125).

- [x] ни один текст бота не обещает того, чего бот не делает —
  `onb.details` и `reg.consent_pdn.declined_no_link` переписаны; живой
  поиск `напишите`/`передумаете` по `flows/*.json` чист
- [x] обычный текст всегда получает ответ (кроме шага формы и форварда
  staff) — `tg-router/step_10` → `route: menu`, `fallback: true` (прогон
  `ywWLXPLM2lnLhUcuezodB`)
- [x] решение владельца по отзыву согласия записано — вариант B, ADR-0039
- [x] `check-texts.py`, `check-commands.py` зелёные (249 пар / 0; 0 нарушений)
- [x] кнопка удаления аккаунта удаляет касания `telegram_id`, ADR-0039
  принят — **Part 1:** `users`, `registrations`, `feedback`,
  `broadcast_targets`, `sessions`; `event_staff`/`staff`/`staff_invites` и
  `events.staff_id` — Part 2
- [x] `catalog/` совпадает с живым проектом

## Как проверено

**Офлайн (все зелёные):** `check-export-secrets.sh` (0 совпадений, 8
`BOT_TOKEN` + 2 `QR_SIGNING_KEY`, все `auth` — ссылки);
`check-texts.py i18n/ru.json flows/*.json` (29 флоу, 249 пар, 0 расхождений);
`check-commands.py` (0 нарушений); `check-agents.py` (0 нарушений);
`cd miniapp && npm run build` (OK).

**Живой `curl` на опубликованном `/sync` `reg-api`** (`initData` подписан
временным флоу `zz-w73-mint-init-data`, читавшим `BOT_TOKEN` + `node:crypto`;
флоу удалён, см. `migrations` `2026-09-23-w73-05`):

| # | Сценарий | Ожидание | Факт |
|---|----------|----------|------|
| T1 | невалидный `initData` | `401` | `401 invalid_init_data` |
| T2 | `delete_account` без `confirm` | `400` | `400 bad_request` «Подтвердите удаление аккаунта.» |
| T3 | свой валидный `initData` (532804490) + `telegramId: "322876545"` в теле | `403` | `403 forbidden` «Так можно удалить только свой аккаунт.» |
| T4 | `delete_account`, `confirm: true`, свой аккаунт | `200` + строки исчезли | `200 delete_account`; `users`/`registrations`/`sessions` по `532804490` — `ap_find_records` «No records found» (до — 1/1/1) |
| T5 | повтор T4 | `200`, не валит | `200 delete_account` |

**Различающий IDOR-прогон:** после T3 строка `users` владельца
(`322876545`, `AmPpQxWUC96AySQbBGXM7`) на месте — чужой аккаунт не удалён.

**Plain-text (Part 1) живым прогоном `tg-router`** (`ap_test_flow` с
синтетическим апдейтом `999000111`, «передумал»): `step_10` →
`{"route":"menu","fallback":true}`, `step_11` — ветка `menu`
`evaluation: true`. Синтетическая строка `users` удалена после проверки.

**UI (headless, `~/w41/w73-shots.mjs`):** статик `miniapp/dist` + мок
`Telegram.WebApp` и `reg-api`, 18/18. Проверено: кнопка удаления ниже
«Сохранить» и с классом `btn-destructive`; подтверждение обязательно; отмена
не шлёт запрос; подтверждение шлёт `action=delete_account` + `confirm=true`
**без** `telegramId`; успех чистит поля и показывает тост; отказ `403` виден
в шите, шит не закрывается. Скриншоты light/dark просмотрены
(`~/w41/shots-w73/`).

**Сверка с прототипом-эталоном (ADR-0027).** Затронутый экран — таб
«Профиль»; его форма (поля, чекбокс рассылки, подпись `profile.pdn_done`)
не менялась с W50 и сверена тогда же. Кнопки удаления аккаунта в
`prototypes/app.js` нет — это **новое требование владельца** (вариант B,
[ADR-0039](../../docs/adr/0039-account-self-deletion-gdpr.md)), а не
самовольное добавление; кнопка стоит последней, после «Сохранить», и
подтверждается шитом. Остальные расхождения (декоративная шапка-аватар
прототипа) — вне этого пакета.

## Журнал

- **2026-09-23** — пакет взят. Решение владельца: вариант B — кнопка
  «удалить аккаунт», удаление всего из базы (любое касание), GDPR. Контакт
  организатора не нужен: тексты ведут в «Профиль». ADR-0039 (свободный
  после резерва 0035–0038).
- **2026-09-23** — граница Part 1/Part 2. Issue #125 определяет Part 1 как
  option A (ответ на текст), а вариант B — как Part 2 (Phase 3). Владелец
  в комментарии к #125 просит сделать B «следом, а не в Phase 3», а
  постановка на пакет требует живых прогонов именно удаления. Решено:
  **Part 1 = option A + вариант B по пользовательским касаниям**, Part 2 =
  права и организационные касания (`event_staff`, `staff`, `staff_invites`,
  `events.staff_id`) — они затрагивают чужие сценарии и требуют отдельного
  решения (ADR-0039, «Границы»). Это расширение скоупа Part 1 названо, а не
  спрятано.
- **2026-09-23** — обычный текст в мёртвой сессии `event_create`/`event_edit`.
  Issue говорит и «точное условие без сессии на `ob_await_*`», и «остатки
  `event_create/edit` — молча». Взято точное условие: текст отвечает меню,
  потому что мёртвая сессия — не форма; молчат только её колбэки и
  нетекстовые апдейты. Записано в карточке `tg-router`.
- **2026-09-23** — первый положительный прогон удаления «прошёл» `200`, но
  строки остались. Причина: минтинг-флоу подписал `initData` с полем `id`,
  а `fn-hmac-init-data` достаёт `telegramId` из `user` (JSON-строка) —
  `valid: true`, `telegramId: ""`, фильтры искали пустую строку. Починено
  минтинг-флоу (`user` как JSON), прогоны повторены; `mine` подтвердил
  непустой `telegramId`. Урок: зелёный `valid` не значит «пользователь
  определён» — проверять, что `telegramId` непуст.
- **2026-09-23** — публикация до ревью (процесс, шаг 3: publish → export →
  tests). Для dev-бота это дёшево: по Decision #0 ([#148](https://github.com/aiqadam/aiqadam-events-bot/issues/148))
  Meetup #3 обслуживает `events-prod`, dev больше не боевой. Точки отката —
  `publishedVersionId` из `main` до правок: `tg-router`
  `pCZzbj5UKQAxztYtD4Oba`, `menu` `cPeZzetARSsdwmlMaJaIF`, `reg-api`
  `N82R7sL1wxm3Ws177RHb0`, `reg-profile` `Zk1LotBaEVkIni7wbEstD`.
- **2026-09-23** — удаление строк только по внутреннему id (гоча 18):
  `find` → `LOOP_ON_ITEMS` → `delete` по `item.id`, пустая выборка — ноль
  итераций. Профиль удаляется последним: сбой раньше оставляет `users` для
  повторного вызова.

## Ревью

> Заполняет независимый ревьюер.

- **Ревьюер**: review-agent (gpt-5.6-luna) · **Дата**: 2026-09-23 · **Вердикт**: замечаний нет

### Что проверено

- MCP доступен: проект `events-dev` (`vZXlkfz60dx6kX97yICx7`). Для `tg-router`,
  `menu`, `reg-api` и `reg-profile` снята живая структура: все шаги
  `configured`, `valid`, без незаполненных веток; CODE-шаги прочитаны через
  `ap_read_step_code` и не содержат сетевых вызовов или записи в таблицы.
- Живые экспорты через `ap_export_flow` совпадают с `flows/*.json` и
  `publishedVersionId` в `_manifest.json`: `SGwk43CYYPHDNsqraS0bX`,
  `dVvIi8m6z28Kpwvmpp5cE`, `DxyL1oN5ia0rOtRzI7R72`,
  `TVBVDJy4pGCIxAYyPzZxs` соответственно; в экспортируемых настройках
  секретов нет.
- Каталог сверен со структурой и экспортом: новые ветки fallback, action
  `delete_account`, циклы `find → loop → delete`, UI-кнопка и граница Part 1 /
  Part 2 описаны согласованно.
- Таблица `migrations` содержит пять записей W73 (`w73-01`…`w73-05`), включая
  публикации четырёх флоу и удаление временного mint-флоу; версии и commit
  совпадают с пакетом.
- Прочитаны живые успешные прогоны plain-text (`ywWLXPLM2lnLhUcuezodB`) и
  отрицательный `reg-api` с malformed `initData` (`He1r0IO87VVwtgzuanQm3`),
  а также серия production-прогонов затронутых флоу. IDOR-гейт, обязательный
  `confirm` и удаление только по внутренним id строк подтверждены структурой,
  кодом и журналом curl-проверок T1–T5.
- Офлайн-проверки `check-export-secrets.sh`, `check-texts.py`,
  `check-commands.py`, `check-agents.py`, `prototypes/check.mjs` и сборка
  Mini App прошли успешно; `git diff --check` также чист.

### Замечания

Нет.

### Ограничение среды

`tools/check-migrations.py` отдельно запустить не удалось: на машине нет
`QADAM_API_KEY` и записи ключа в Keychain. Это не блокировало живую MCP-сверку
структур, экспортов и записей `migrations`; секрет в репозитории не искался и
не добавлялся.

## Хвосты и блокеры

- **Part 2:** удаление `event_staff`, `staff`, `staff_invites` (по `used_by`
  и `created_by`) и `events.staff_id` у событий удаляемого staff; семантика
  «будущая регистрация → cancelled» отклонена в пользу жёсткого удаления
  (ADR-0039, «Альтернативы»). До Part 2 аккаунт staff удаляется частично.
- **Не проверено живьём:** удаление аккаунта владельца (`322876545`) — не
  выполнялось, чтобы не сносить профиль/данные живого организатора; путь
  тот же, что у не-staff, и покрыт T4. Ротация `BOT_TOKEN`/`QR_SIGNING_KEY`
  не требовалась.
- **Проверить на приёмке:** что после удаления следующий `/start` снова
  спрашивает согласие и профиль (PAR-1/PAR-8) — следует из отсутствия
  строки `users`, отдельным прогоном не снималось.
