# W67. Онлайн-событие: ссылка на трансляцию вместо QR

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: Phase 3 ([#119](https://github.com/aiqadam/aiqadam-events-bot/issues/119))
- **Зависит от**: решение владельца по полю `events.online_url` (получено 2026-09-29)
- **Начат**: 2026-09-29 · **Закрыт**: —

## Цель

Для онлайн-события QR не генерируется: зарегистрированный участник получает
**ссылку на трансляцию** — в билете (`#/ticket`) и в напоминаниях 24 ч / 2 ч,
только в тот момент, когда она нужна. Публичный каталог ссылку не отдаёт.
Решение владельца 2026-09-29 (взятие пакета): «для онлайн-событий QR не должен
генерироваться, там просто должна появляться ссылка в нужный момент».

Дизайн — [ADR-0051](../../docs/adr/0051-online-event-link-instead-of-qr.md).

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| поле `events.online_url` (TEXT) | externalId `ko1bekdWsaspUtTydMee1` | [catalog/tables/events.md](../../catalog/tables/events.md) |
| flow `manage-api` | `pFtbgOP3U8sNFvP86Szli` (версия `EkbEhblm5NasfLh49FpB4`) | [catalog/flows/manage-api.md](../../catalog/flows/manage-api.md) |
| flow `my-qr-api` | `wRV7Iho1yaxJ7VnsS49P4` (версия `LgPsdYn5lLEvdkFiiQydi`) | [catalog/flows/my-qr-api.md](../../catalog/flows/my-qr-api.md) |
| flow `reminders` | `5JiN4gJgdh8ItkzUqVnTf` (версия `mKdWNvzwn6gMd49ftuVWj`) | [catalog/flows/reminders.md](../../catalog/flows/reminders.md) |
| SPA `#/manage` | поле «Ссылка на трансляцию» в шаге «Где и когда» | `miniapp/src/routes/Manage.tsx` |
| SPA `#/ticket` | кнопка «Открыть трансляцию» вместо QR-плиты | `miniapp/src/routes/Ticket.tsx` |

## Чек-лист готовности

Из [#119](https://github.com/aiqadam/aiqadam-events-bot/issues/119) плюс
обязательный пункт:

- [x] решение владельца по полю `events.online_url` — получено 2026-09-29;
- [x] DATA-MODEL, `catalog/tables/events.md`, `migrations` обновлены;
- [x] ссылка видна только зарегистрированным (билет + напоминания);
- [x] уведомление при смене ссылки работает (OWN-5) — `online_url` в `notify-on-change`;
- [~] offline → online чистит `address`/`lat`/`lon` — **баг подтверждён
      чтением** (пустое значение Tables = «не менять»; `tables-upsert-records`
      0.4.5 не умеет `clear_columns`), **фикс — хвост** (нужен отдельный
      `tables-update-record` с `clear_columns`; клиент шлёт пустые поля, сервер
      их не пишет) — см. «Хвосты»;
- [x] `check-texts.py`, `npm run build` зелёные;
- [x] `catalog/` совпадает; экспорт `flows/*.json` тем же коммитом (MCP, `source: mcp`);
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- `ap_validate_flow` manage-api / my-qr-api / reminders → все `valid`, готовы к публикации;
- `ap_lock_and_publish` всех трёх → published/enabled; экспорт MCP снят сразу после публикации;
- `tools/check-texts.py i18n/ru.json flows/*.json` → 294 ссылки `$t`, расхождений 0;
- `tools/check-commands.py`, `tools/check-agents.py`, `tools/check-export-secrets.sh` → чисто;
- `node prototypes/check.mjs` → OK;
- `cd miniapp && npm run build` (tsc + vite, dev) → собрано;
- 9 ключей перевода добавлены в `i18n/{ru,uz,en}.json` и импортированы
  `ap_upsert_translations` (ru/uz/en) — иначе `$t` валит шаг.

## Журнал

- **2026-09-29** — обшторм и взятие. Ключевые решения: (1) признак онлайна —
  непустой `online_url` (чинит неявную связь [Q63](../../docs/OPEN-QUESTIONS.md#q63));
  (2) QR для онлайна не подписывается и не рисуется; (3) ссылка приходит
  зарегистрированному в билете и в напоминаниях 24 ч / 2 ч — это и есть «нужный
  момент»; (4) публичный `events-api` ссылку не отдаёт.
- **2026-09-29** — реализация. `manage-api/step_7`: `online_url` в `fields`/
  `EVENT_KEYS`, валидация `https://` ≤500, при онлайне адрес и точка пишутся
  пустыми, `online_url` в diff уведомления; `step_11` upsert пишет
  `online_url`. `my-qr-api`: новый шаг `step_9` (чтение `online_url`) и решение
  `step_5` — онлайн отдаёт `{online:true,url}` без `payload`. `reminders`:
  `online_url` в проекции, проброс через `step_2`/`step_4`, текст
  `remind.*_online` без «Адрес: » и кнопка «Открыть трансляцию».
- **2026-09-29** — экспорт. MCP-снимки положены `tools/export-flow-mcp.py`;
  `_manifest.json` обновлён (3 флоу, `source: mcp`).

## Ревью

- **Ревьюер**: — · **Дата**: — · **Вердикт**: —

### Замечания

## Хвосты и блокеры

- **Очистка `address`/`lat`/`lon` при offline → online.** Подтверждено чтением
  кода и семантики Tables (пустая строка = «не менять»), `tables-upsert-records`
  на пине 0.4.5 не содержит `clear_columns`. Фикс — отдельный шаг
  `tables-update-record` (`clear_columns`) в ветке `save` либо перепривязка
  `step_11` на `tables` 0.4.6. Следствие сейчас: у события, переведённого из
  офлайна в онлайн, в записи может остаться старый адрес (свежее онлайн-событие
  чисто).
- **Посещаемость онлайн-событий** — отдельный вопрос: без чекина не включается
  `reg-afterword` (послесловие/отзыв). Заведено вопросом, не входит в пакет.
- **Строгий тайм-гейт** ссылки (не раньше N часов до начала) — по умолчанию нет;
  добавляется решением владельца.
- **Живая проверка** в Telegram (создать онлайн-событие, зарегистрироваться,
  открыть билет, напоминание) — за владельцем.
