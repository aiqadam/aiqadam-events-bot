# W116. `set_lang` без языка + переключатель не зависит от записи на сервер

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: v0.1
- **Зависит от**: W114 (готов), W115 (готов)
- **Начат**: 2026-09-27 · **Закрыт**: —

## Цель

Смена языка в табе «Профиль» Mini App работает и сохраняется: `reg-api`
получает выбранный язык, а экран переключается даже если запись `users.lang`
на сервере не удалась.

## Что построено

| Артефакт | ID / имя | Каталог |
|----------|----------|---------|
| flow `reg-api` | `SmutybV5qJQjQASJGY9vi` (версия `LH7KvkmlPW0ouHKnp4tgv`) | [catalog/flows/reg-api.md](../../catalog/flows/reg-api.md) |
| `miniapp/src/routes/Events.tsx` | `changeLang` — локальное переключение до записи | — (код Mini App) |
| `i18n/{ru,uz,en}.json` | ключ `lang.sync_failed` | — |

Изменение на инстансе — **один вход** `reg-api/step_9`: добавлено
`"lang": "{{step_2['output'].lang}}"`. Таблицы, переводы и прочие флоу не тронуты.

## Чек-лист готовности

- [x] `reg-api/step_9` получает `lang` из `step_2` (проводка `{{step_2['output'].lang}}`);
- [x] Mini App переключает язык локально независимо от результата записи; сбой — тост `lang.sync_failed`;
- [x] `miniapp` собирается (`build:dev`); офлайн-проверки (тексты/команды/секреты) — 0;
- [x] экспорт `flows/reg-api.json` обновлён (MCP, `source: mcp`, версия `LH7KvkmlPW0ouHKnp4tgv`);
- [x] запись в `migrations` (строка `2026-09-27-w116-01`, commit `b5e9818`);
- [x] каталог (`catalog/flows/reg-api.md`) синхронизирован;
- [ ] независимое ревью, вердикт «замечаний нет».

## Как проверено

- **Корень найден на живом проекте (MCP).** `ap_flow_structure(includeInput)`
  и `ap_read_step_code` по `reg-api/step_9`: во входе шага нет `lang`, при том
  что `step_2` его нормализует и отдаёт. `step_9` делает
  `lang = LANG_OK.indexOf(str(inputs.lang)) >= 0 ? ... : ''`, поэтому `lang`
  всегда `''` → ветка `set_lang` отвечает `400 bad_request` до записи.
- **Строка владельца в `users`** (`telegram_id 322876545`): `profile_completed_at`
  заполнен (`2026-09-27T14:58:52Z`) — значит гейт `profileDone` проходит и отказ
  приходит именно из проверки `lang === ''`, а не из `profile_required`.
- **После правки** `ap_read_step_code(step_9)` показывает `"lang":
  "{{step_2['output'].lang}}"` во входе; `texts` (19 ключей) сохранены;
  `ap_validate_flow` — «ready to publish (46 steps, 45 valid, 1 skipped)»;
  `ap_lock_and_publish` — успех.
- **Headless (Playwright, `~/w41`), живой dev-бандл** (`miniapp.events.aiqadam.org`,
  `telegram-web-app.js` подменён моком, вебхуки замоканы):
  - до правки клиента при успешном моке `set_lang` переключение работало
    (`aria-pressed uz:true`, label «Til», `localStorage=uz`);
  - при моке отказа (`{ok:false, error:'profile_required'}`) переключение
    **не происходило** — воспроизведён класс дефекта, который закрывает
    клиентская правка (локальное переключение до записи).
- **Сборка:** `npm run build:dev` — зелёный (`tsc -b` + `vite build`, 95 модулей).
- **Офлайн:** `tools/check-texts.py` — «флоу: 31, ссылок $t: 283, расхождений: 0»;
  `tools/check-commands.py` — «нарушений: 0»; `tools/check-export-secrets.sh` — чисто.
- **Экспорт:** `tools/export-flow-mcp.py` по снимку `ap_export_flow` — дифф
  `flows/reg-api.json` ровно `+ "lang"`, `_manifest.json` — новый `publishedVersionId`.

**Не проверено живьём:** сквозной `set_lang` с настоящим `initData` на
опубликованной версии — у агента нет валидного `initData` (нужен `BOT_TOKEN`).
Косвенно: вход шага несут `lang`, гейт профиля у владельца проходит; живая
проверка — за владельцем (открыть таб «Профиль», переключить язык).

## Журнал

- **2026-09-27** — репорт владельца: «переключатель языков в miniapp всё ещё не
  работает», затем «miniapp пишет: запрос не удалось разобрать». Сначала
  исключена среда: prod-бандл языка не содержит вовсе (ветка `prod` — W104/W105,
  `lib/i18n.ts` — русский-онли), dev-бандл W114/W115 несёт и переключает.
  Владелец подтвердил: тестирует dev.
- **2026-09-27** — сверка живого `reg-api` через MCP дала корень: `step_9` не
  читает `lang`. W115 проверялся моком успешного `set_lang`, поэтому дефект
  проводки не всплыл.
- **2026-09-27** — правка: `ap_update_step(reg-api/step_9, {lang})`; клиент
  `changeLang` переключает язык локально (`setLang` + `setUiLang`) до
  best-effort записи; добавлен ключ `lang.sync_failed` (ru/uz/en) для честного
  сообщения, если запись не прошла. Публикация, MCP-экспорт, каталог.
- **2026-09-27** — ревью круг 1: одно «важно» — журнал/STATUS/BACKLOG держали
  запись в `migrations` открытым хвостом, хотя строка `2026-09-27-w116-01` уже
  вставлена (совпадает: `flow:reg-api`, `LH7KvkmlPW0ouHKnp4tgv`, `b5e9818`).
  Пункт отмечен, хвост убран, вместо него в «Хвосты» вынесены два «на будущее»
  ревьюера (`loadProfile` может откатить локальный выбор; guard не даёт
  повторить синхронизацию того же языка). Запущен круг 2.

## Ревью

### Круг 1

- **Ревьюер**: review-agent (чистый контекст) · **Дата**: 2026-09-27 · **Вердикт**: есть замечания

#### Замечания

1. **важно** — Журнал, `STATUS.md` и чек-лист BACKLOG называют запись в
   `migrations` незакрытым хвостом («после коммита — нужен sha»), но строка
   `2026-09-27-w116-01` в живой таблице `migrations` (dev) **уже есть**:
   `object=flow:reg-api`, `object_id=SmutybV5qJQjQASJGY9vi`,
   `version_id=LH7KvkmlPW0ouHKnp4tgv`, `action=publish`, `commit=b5e9818`.
   Где: `docs/work/W116-set-lang-wiring.md` (чек-лист готовности, «Хвосты»),
   `docs/STATUS.md` (строка W116), `docs/BACKLOG.md` (пункт 4 «Готово, когда»).
   Почему важно: каталог/журнал — утверждение о реальности; висящий хвост,
   которого нет, вводит в заблуждение и мешает переводу в `готов`. Владельцу
   достаточно отметить пункт и убрать хвост.

2. **на будущее** — `loadProfile` при следующем открытии снова применяет
   серверный `users.lang` и может откатить локально выбранный язык, если запись
   не удалась. Условие `isSupportedLang(serverLang) && serverLang !== getLangCode()`
   сравнивает сервер с текущим кодом в момент ответа, а не «пользователь не
   выбирал в этой сессии»; при расхождении сервер побеждает. Следствие: выбор,
   сделанный при `lang.sync_failed`, на перезагрузке не сохраняется (локально
   снова серверный язык). Там же теоретическая гонка `loadI18n`/`loadProfile`
   (кто разрешится позже, тот и выставит `uiLang`). Где:
   `miniapp/src/routes/Events.tsx` (`loadProfile`, `changeLang`). Не блокер —
   кнопки языка недоступны, пока профиль грузится, поэтому окно узкое; хвост
   уже зафиксирован в W115.

3. **на будущее** — повторная попытка синхронизации того же языка невозможна:
   guard `code === getLangCode()` в начале `changeLang` гасит нажатие по уже
   активному языку. После `lang.sync_failed` пользователь не может повторить
   запись `users.lang` тем же тапом — только переключившись на другой язык и
   обратно. Где: `miniapp/src/routes/Events.tsx`, `changeLang`. Требованию
   «не блокировка переключателя» не противоречит (локально язык уже выбран),
   но стоит знать.

#### Что проверено

- **Живой проект (MCP, dev).** `ap_flow_structure(reg-api, includeInput=true)`
  и `ap_read_step_code(step_9)`: во входе `step_9` есть
  `lang: "{{step_2['output'].lang}}"`, все 19 ключей `texts` на месте, прочие
  входы не потеряны. `step_2` нормализует `lang` (`trim().toLowerCase()`),
  `step_9` сужает его до `ru|uz|en` (`LANG_OK`); для `set_lang` при
  `profileDone` отдаёт `outcome:'profile_saved'` с сохранёнными метками
  `profile_completed_at`/`consent_marketing_at`; `profile_get` отдаёт `lang`
  из `userRow.lang`. `step_22` пишет `wW12TT5X2kFgLryWbnnm5` из
  `{{step_9['output'].lang}}` — по `ap_export_table(users)` это внешний id
  колонки `lang`. `ap_validate_flow` — «ready to publish (46 steps, 45 valid,
  1 skipped)»; `step_12` остаётся `skip` (W60), не регресс.
- **Версия совпала.** `ap_export_flow` вернул `flows[0].id =
  LH7KvkmlPW0ouHKnp4tgv`; в `flows/_manifest.json` у `reg-api` тот же
  `publishedVersionId` (`source: mcp`); в `migrations` — та же версия.
- **`migrations` (dev).** Строка `2026-09-27-w116-01` существует и совпадает
  с заявленным (`flow:reg-api`, `SmutybV5qJQjQASJGY9vi`, `LH7KvkmlPW0ouHKnp4tgv`,
  `publish`, `commit=b5e9818`). Расхождение только с текстом журнала (замечание 1).
- **Диагноз дефекта подтверждён живым прогоном.** Прогон `V2tsyBIas1NxJwZWjsV6G`
  (PRODUCTION, 2026-09-27 14:59, до публикации, реальный `initData` владельца):
  `step_2` отдал `lang:"en"`, а `step_9` — `lang:""` и
  `error:"bad_request"`, HTTP 400. Это ровно дефект «`step_9` не получал `lang`»;
  в прогоне виден `ap-parent-run-locale: ru` и `users.lang = ru` — язык терялся
  на пробросе, а не в сужении.
- **Экспорт.** `git diff origin/main...w116-set-lang-wiring` по
  `flows/reg-api.json` — ровно `+ "lang"` в `step_9`; `state: LOCKED`,
  `connectionIds: []`, `localeSource: null` (вебхук-флоу Mini App берёт локаль
  из заголовка `ap-parent-run-locale` — так и задумано). Секретов нет,
  `tools/check-export-secrets.sh` — 0.
- **Диф не задел лишнего.** Изменены только `catalog/flows/reg-api.md`,
  `docs/BACKLOG.md`, `docs/STATUS.md`, `docs/work/W116-…`, `flows/_manifest.json`,
  `flows/reg-api.json`, `i18n/{ru,uz,en}.json`, `miniapp/src/routes/Events.tsx`.
  Прочие флоу, таблицы и переводы флоу не тронуты. `docs/I18N.md` и
  `catalog/overview.md` ключи не перечисляют — расходиться нечему; паритет
  `ru/uz/en` — 445/445/445.
- **Клиент.** `changeLang` сначала `await setLang(code)` + `setUiLang(code)`
  (словарь/подсветка/localStorage), затем best-effort `postJson(set_lang)`;
  успех — тост `lang.changed`, отказ — `lang.sync_failed`. Заголовок
  `ap-parent-run-locale` в `postJson` берётся из `getLang()`, а `setLang` пишет
  localStorage до запроса. Ключ `lang.sync_failed` добавлен в три словаря,
  литералов нет. `set_lang` по-прежнему уходит.
- **Офлайн.** `tools/check-texts.py i18n/ru.json flows/*.json` — 0 расхождений;
  `tools/check-commands.py` — 0; `tools/check-export-secrets.sh` — чисто;
  `cd miniapp && npm run build:dev` — зелёный (`tsc -b` + `vite build`,
  95 модулей).
- **AppSec.** `telegram_id` для `set_lang` берётся из проверенного `initData`
  (`fn-hmac-init-data` → `step_2.telegramId`), тело на него не влияет; `lang`
  из тела сужается до whitelist `ru|uz|en` перед записью — инъекции/подмена
  значения исключены. IDOR нет: пишется только строка вызывающего. Секретов в
  шагах/каталоге/экспорте нет; `localStorage` хранит только код языка, не ПД.

#### Ограничения проверки

- **Живой сквозной `set_lang` с настоящим `initData` на опубликованной версии
  не выполнен** — у ревьюера нет `BOT_TOKEN`. Прогонов после публикации
  `LH7KvkmlPW0ouHKnp4tgv` в `ap_list_runs` нет (последние — 14:59, до
  публикации 15:04). Это ожидаемое ограничение, не блокер: правка проверена
  по живой конфигурации шага и коду `step_9`; сквозная проверка — за владельцем
  (таб «Профиль»).
- **Headless-тулчейн недоступен**: `~/w41` (Playwright/Chromium) есть на машине,
  но доступ к каталогу вне рабочего дерева запрещён правами сессии, поэтому
  прогон с моком Telegram/вебхуков не воспроизводился. Дополнительно: живой
  dev-бандл `miniapp.events.aiqadam.org` собран из `main` (`.github/workflows/pages.yml`
  деплоит только на push в `main`), а PR #183 не влит — в живом `i18n/ru.json`
  сайта ключа `lang.sync_failed` нет. Клиентская правка проверена чтением кода
  и локальной сборкой, не живым бандлом.
- `tools/export-flows.sh` и `tools/check-migrations.py` не запускались: нет
  ключа платформы и `jq`. Сверка выполнена через MCP (`ap_export_flow`,
  `ap_find_records`) и диф экспорта из репозитория.

## Хвосты и блокеры

- **Живой сквозной прогон `set_lang`** (таб «Профиль» в Telegram) — за
  владельцем: у агента нет валидного `initData`.
- **`loadProfile` может откатить локальный выбор** после `lang.sync_failed`:
  при следующем открытии серверный `users.lang` (не обновившийся из-за сбоя)
  снова применяется поверх локального. Окно узкое (кнопки языка недоступны,
  пока профиль грузится), наследует хвост W115 про гонку `loadI18n`/`loadProfile`.
- **Guard `code === getLangCode()`** не даёт повторить синхронизацию того же
  языка после сбоя — нужно уйти на другой язык и вернуться.
- **Перенос языка на prod** — отдельный пакет (W114/W115/W116 на `prod`).
