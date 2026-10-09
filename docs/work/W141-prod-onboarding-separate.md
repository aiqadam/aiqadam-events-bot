# W141. Перенос W138 на prod: онбординг и регистрация отдельными сообщениями (хотфикс ADR-0042)

- **Статус**: на проверке
- **Владелец**: агент
- **Волна**: вне волн (хотфикс [ADR-0042](../adr/0042-two-environments-one-repo.md))
- **Зависит от**: W138 (готов на dev) — ✅
- **Начат**: 2026-10-09 · **Закрыт**: —

## Цель

Перенести [W138](W138-onboarding-separate-messages.md) ([ADR-0056](../adr/0056-onboarding-separate-messages.md))
с dev на prod отдельным хотфиксом: гостевой онбординг и регистрация — с одной
редактируемой карточки на **отдельное сообщение на каждый вопрос** (факты
события — один раз). Правки — только через MCP `app-flow-events-prod`; канон —
dev ([ADR-0042](../adr/0042-two-environments-one-repo.md)). `flows/*.json` и
`catalog/flows/*.md` не трогаются.

## Что построено

| Артефакт (prod) | flowId | published до | published после |
|-----------------|--------|--------------|-----------------|
| flow `reg-start` | `FkxtgayOK5QubyqqMd9q4` | `jHj9ZJjUr9dW5ClOntXP1` | `OtJL5GaiPObHTfcCVt4gm` |
| flow `reg-profile` | `5U3Kv0cSrnvDTrbictA4L` | `WLYauRql1cnoNrNFHTduo` | `MEf7vkJI69mLNLPQHLJeP` |
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` | `OwMQZLxQV7k4dVtWR52iE` | `vJ13RIrbCiHVQUPgMneVY` |
| flow `reg-consent-mkt` | `3gLF6TcbpFObHONATQ64N` | `umKDENNz63nFu5S4K6aNd` | `Gu1dt6jQqC0aoV2ssneHq` |
| flow `reg-consent-pdn` | `vQJDQ8NecB1PleIFrq07O` | `daAur8CQujShx9vad7kr5` | `kCjJ2GQejHHScsVxSJrAj` |
| таблица `migrations` (prod) | — | — | `NCZNGuWh6PFs1JZXRPNTE` |
| connection | — | — | `KIbxO5kYo3RsU5PNGPz9l` (`Events-Prod`) |

`tg-router` (`nyaBzgKGG8TTTsryjc9tW`) и Mini App **не меняются**: W138 их не
трогал (`tg-router.json` и `miniapp/` в мерже W138 не менялись).

## Дрейф dev↔prod (предусловие)

Структуры всех пяти prod-флоу **совпали с dev-pre-W138** по именам шагов и
ролям (ветки, edit-шаги, фолбэк-цепочки `edit → send`): `reg-start`
(`register_direct`, `step_15/17/21`), `reg-profile` (`step_1…40`, 8 веток
`step_5`, 14 фолбэк-шагов), `reg-consent-pdn` (`step_11/15/16/17`),
`reg-consent-mkt` (`step_7` edit + `step_8` фолбэк + `step_9` билет). Разъезда
имён (как в W140) нет; тем не менее правки сделаны **по роли/ветке**, а не по
имени dev (`ap_delete_step`+`ap_add_step` переиспользуют низшие свободные имена).

**i18n.** W138 новых ключей не добавлял (`git diff` мержа `i18n/` пуст); на prod
проверены все используемые префиксы (`ticket.*`, `onb.*`, `menu.*`, `lang.*`,
`bcast.howto.*`, `reg.*` + остальные — используются прод-логикой сегодня).
Импорт переводов не требуется.

**Три ловушки, учтённые при переносе:**

1. `ap_export_flow` хранит в `callFlow` устаревший `externalId`
   (`reg-start/step_22` → `bEd0cScLAymIT44Dmtnxu`) — рабочее; W138 ссылку не
   меняет, не трогали.
2. Три поля `events` (`lang`/`online_url`/`format`) несут разные id в средах.
   Правки не затронули шаги, читающие/пишущие их (`reg-profile/step_2`,
   `reg-consent-mkt/step_4`) — id по имени не копировались.
3. Имена шагов dev-post ≠ роли prod-pre; маппинг — по ветке.

## Чек-лист готовности

- [x] нет `running`-рассылки на prod (предусловие); baseline `reg-consent-mkt`
      `umKDENNz63nFu5S4K6aNd` записан
- [x] `reg-start` — CODE `step_15/17/21` (ADR-0056: `cardMessageId` не читается)
- [x] `menu` — CODE `step_6`
- [x] `reg-consent-mkt` — `step_2`/`step_5` (полная карта `texts`, включая
      `ticket.btn.open`) + удалены `step_7`/`step_8`
- [x] `reg-consent-pdn` — `step_2`/`step_7` + перестройка веток: `step_8`
      edit→send, удалены `step_11/15/16/17`, добавлены send `step_8` (done) и
      `step_10` (declined)
- [x] `reg-profile` — `step_3`/`step_4` (CODE+input) + все ветки `card/consent/
      declined/finish/finish_lite/finish_no_event`: edit→send, удалены 14
      фолбэк-шагов, добавлены send `step_9/10/11/12/15/16`; `step_33` (билет) привязан
      `step_30 → step_15 → step_33`
- [x] `ap_validate_flow` — 0 `invalid` ×5 (`reg-start` 23, `reg-profile` 26,
      `menu` 15, `reg-consent-mkt` 9, `reg-consent-pdn` 14); read-back совпал с dev-post
- [x] publish ×5; строки `migrations` (prod) `2026-10-09-w141-01…05`
- [x] `catalog/environments.md` обновлён
- [ ] живой e2e в Telegram prod-бота — за владельцем (диплинк, голый `/start`,
      повторное касание, `register_direct`, отказ, выбор языка)
- [ ] независимое ревью

## Детали исполнения

Порядок (правки одного флоу строго последовательны, гоча 16; вложенные
`input`/`texts` — целиком, гоча 12; `edit`→`send` только через
`ap_delete_step`+`ap_add_step`, гочи 12/18):

1. `reg-start`: `ap_update_step` ×3 (`step_15/17/21`, только `sourceCode`;
   входы с мёртвым `cardMessageId` оставлены как на dev).
2. `menu`: `ap_update_step` `step_6` (только `sourceCode`).
3. `reg-consent-mkt`: `ap_update_step` `step_2` (CODE+input), `step_5`
   (полный `input` с 13 ключами `texts` + code); `ap_delete_step` `step_7`
   (каскадом ушёл `step_8`; `step_9` релинкован на `step_5`).
4. `reg-consent-pdn`: `ap_update_step` `step_2`/`step_7`; `ap_delete_step`
   `step_8` (каскад: `step_10/15/16`) и `step_11` (каскад: `step_17`);
   `ap_add_step` send после `step_7` (→ `step_8`) и после `step_12` (→ `step_10`).
5. `reg-profile`: `ap_update_step` `step_3`/`step_4`; `ap_delete_step`
   `step_9/15/20/25/31/37` (каскадом — 14 фолбэков); `ap_add_step` шесть send
   после `step_8`/`step_14`/`step_19`/`step_24`/`step_30`/`step_36`
   (→ `step_9/10/11/12/15/16`; при вставке после `step_30` — сплайс между
   `step_30` и `step_33`, проверено read-back).
6. `ap_validate_flow` ×5 → read-back → `ap_lock_and_publish` ×5.

`sourceCode`/`input` берутся из dev-эталона `flows/<flow>.json`. На prod
**не** запускать `ap_test_step`/`ap_test_flow` (гоча 11).

## Откат

MCP не умеет revert по версии. **Дорелизные версии** (последние публикации до
W141, из `migrations` prod) — в таблице «Что построено»; канон содержимого —
dev-pre-W138 `git show d2718ae^1:flows/<flow>.json` + карта средовых id
([`catalog/environments.md`](../../catalog/environments.md)). Чтобы откатить:
вернуть прежние `input`/`sourceCode` изменённых шагов, восстановить удалённые
шаги (`reg-start`/`menu` — только CODE; удалённые: `reg-profile` 14 шт.,
`reg-consent-pdn` 4 шт., `reg-consent-mkt` 2 шт.), затем повторная публикация
(пошагово довести до содержимого dev-pre). Входы `auth` в git-версиях вычищены
экспортом — при восстановлении шагать с
`auth={{connections['KIbxO5kYo3RsU5PNGPz9l']}}`.

**Пробел процесса:** полный `ap_export_flow`-снапшот prod до первой правки **не
снимался** (`~/qadam-snapshots/w141/` пуст) — откат опирается на dev-канон, а не
на побайтовый слепок prod. Для будущих хотфиксов prod снапшот — обязательный шаг
до первой правки (как в W140).

## Как проверено

- **Структура:** `ap_flow_structure` ×5 до правок — prod = dev-pre-W138 по ролям;
  после — read-back совпал с деревом dev-post-W138 (`reg-profile`:
  `step_30 → step_15 → step_33`; `reg-consent-pdn`: `step_7 → step_8`,
  `step_12 → step_10`; `reg-consent-mkt`: `step_5 → step_9`).
- **`ap_validate_flow`** — 0 `invalid` по всем пяти (шагов: 23/26/15/9/14).
- **Экспорт `ap_export_flow` ×5** — `state: LOCKED`, `valid: true`;
  `flows[0].id` совпал с новой версией; структура/`texts` живых шагов совпали с
  dev-эталоном (в т.ч. `ticket.btn.open` в `reg-consent-mkt/step_5`).
- **i18n:** `ap_list_translations` (prod) по префиксам `ticket.`, `onb.`, `menu.`,
  `lang.`, `bcast.howto`, `reg.` — все ключи на месте.
- **migrations (prod):** строки `2026-10-09-w141-01…05` (`action publish`).

## Журнал

- **2026-10-09** — пакет заведён; ресерч prod (только чтение): 5 flowId, структуры
  совпали с dev-pre-W138, i18n полон. План согласован с владельцем (жёсткий cut,
  scope = ровно W138, W141). Baseline `reg-consent-mkt` `umKDENNz63nFu5S4K6aNd`.
- **2026-10-09** — правки на prod через MCP `app-flow-events-prod` строго
  последовательно, каждый флоу с read-back. **Неожиданное:** каскадное удаление
  edit-шага снимает и его `continueOnFailure`-цепочку (`reg-consent-mkt/step_7`
  унёс `step_8`; `reg-consent-pdn/step_8` унёс `step_10/15/16`), поэтому
  отдельные `ap_delete_step` для фолбэков не понадобились. При вставке send
  после `step_30` (`reg-profile`, finish_lite) платформа сплайсила корректно:
  `step_30 → step_15 → step_33`. Валидация 0 invalid, публикация ×5.
- **2026-10-09** — `reg-profile` пересобран один-в-один с dev-деревом; `step_4`
  по-прежнему отдаёт `cardText`/`replyMarkup` (короткий вопрос) и
  `ticketText`/`ticketReplyMarkup` (finish_lite), поэтому все send-шаги веток
  читают `{{step_4['output'].cardText}}` — контракт сохранён.

- **2026-10-09** — ревью круг 1: одно `важно` (дорелизные версии не записаны,
  снапшот prod не снят) и одно «на будущее» (мёртвые ключи
  `reg.consent_marketing.saved_yes`/`saved_no` в `texts` шага `reg-consent-mkt/step_5`).
  Владелец закрыл `важно`: дорелизные `publishedVersionId` подняты из `migrations`
  prod (последние публикации до W141) и внесены в таблицу; в «Откат» добавлен
  пробел процесса (снапшот обязателен для будущих хотфиксов). «На будущее» —
  в хвосты.

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

## Хвосты и блокеры

- живой e2e в Telegram prod-бота — за владельцем; `ap_test_step` не годится
  (эффектов не сохраняет, ROUTER не гейтит);
- `tools/check-migrations.py` по prod — известный хвост (нет ключа платформы),
  как в W134/W137/W140;
- W136 (гео-ветка `manage-api`) и прочие dev-хвосты на prod — вне этого пакета;
- «на будущее» (ревью круг 1): `reg-consent-mkt/step_5` (prod и dev-эталон)
  держит в `texts` мёртвые ключи `reg.consent_marketing.saved_yes`/`saved_no`,
  которые код после ADR-0056 не читает (финал шлёт `reg-profile`); снять
  отдельной правкой на dev, затем перенести.

### Ревью (круг 1)

- **Ревьюер**: независимый агент-ревьюер (opencode, `deepseek-v4.1-flash`) · **Дата**: 2026-10-09 · **Вердикт**: есть замечания (1 `важно`, 1 `на будущее`)

#### Что проверено (живой prod через MCP `app-flow-events-prod` + репозиторий)

- **Версии публикаций живьём.** `ap_export_flow` ×5: `flows[0].id` (published), `state: LOCKED`, `valid: true`, `flowId` совпал, `connectionIds = [KIbxO5kYo3RsU5PNGPz9l]`. Живые версии совпали с таблицей журнала и `migrations`:
  - `reg-start` `FkxtgayOK5QubyqqMd9q4` → `OtJL5GaiPObHTfcCVt4gm`
  - `reg-profile` `5U3Kv0cSrnvDTrbictA4L` → `MEf7vkJI69mLNLPQHLJeP`
  - `menu` `1DORFhP9F3W00KpKz5wDw` → `vJ13RIrbCiHVQUPgMneVY`
  - `reg-consent-mkt` `3gLF6TcbpFObHONATQ64N` → `Gu1dt6jQqC0aoV2ssneHq`
  - `reg-consent-pdn` `vQJDQ8NecB1PleIFrq07O` → `kCjJ2GQejHHScsVxSJrAj`
- **Структура** `ap_flow_structure` ×5: набор и цепочки шагов **совпали с dev-эталоном** `flows/*.json` (число шагов 23/26/15/9/14 совпало с деревом dev и с `ap_validate_flow`), `ap_validate_flow` ×5 → «ready to publish», 0 `invalid`. `edit_message_text` не осталось ни в одном из пяти (проверено экспортом `reg-start`/`reg-profile` и по структуре `menu`/`reg-consent-pdn`/`reg-consent-mkt`); все ветки — `send_text_message`. Цепочки: `reg-profile` finish_lite `step_30 → step_15 (send done) → step_33 (send ticket)`; `reg-consent-pdn` `step_7 → step_8 (done+mkt)`, `step_12 → step_10 (declined)`; `reg-consent-mkt` `step_5 → step_9` (только билет).
- **CODE-шаги** `ap_read_step_code` ×10 (все изменённые): `reg-start/step_15/17/21`, `menu/step_6`, `reg-profile/step_3/4`, `reg-consent-mkt/step_2/5`, `reg-consent-pdn/step_2/7` — **побайтово совпали** с dev-эталоном `flows/*.json` (сверка по полному тексту; `cardMessageId` нигде не читается — только мёртвый вход, как на dev). `esc` во всех шагах побайтово равен эталону `catalog/snippets/markdown-v2.md`.
- **Инварианты.** PAR-1: `reg-profile` пишет `consent_pdn=true` (поле `KtdV8plfevjdnKlLko08q`) в ветке `consent` (`step_13`) **до** вопроса (`step_10`) и до полей профиля; в `finish`/`finish_no_event` — в одной строке с профилем (`step_22`/`step_35`), причём согласие уже записано на шаге согласия. PAR-2: `consent_marketing` (ext `FpWznk9Fgl8wUXXUKolRu`) пишется **только** `reg-consent-mkt/step_3` по явному колбэку `reg:mkt:yes/no`; в `reg-profile`/`reg-start`/`menu`/`reg-consent-pdn` вхождения поля нет (grep по живым экспортам — 0). `reg-profile/step_4` отдаёт `cardText`/`replyMarkup` (короткий вопрос) и `ticketText`/`ticketReplyMarkup` (finish_lite); факты события в вопросах не повторяются.
- **migrations (prod)** `NCZNGuWh6PFs1JZXRPNTE`: ровно 5 строк `2026-10-09-w141-01…05`, все `action publish`, `object_id`/`version_id` совпали с живыми версиями, `commit 4413515` (= HEAD ветки); строк после них нет.
- **AppSec.** В экспортах нет фактических секретов (поля `auth` вычищены; `check-export-secrets.sh` rc=0; grep по сохранённым экспортам — ни `connections`, ни токен-подобных строк). Авторизация/IDOR не затронуты: пакет меняет только тексты и способ отправки, решающие шаги прав те же. Нового класса логирования ПД не появилось: изменённые CODE-шаги сохраняют дефолтные `logInput`/`logOutput`, как их pre-W138-версии.
- **Репозиторий.** `git diff main --stat` — ровно 3 файла (`catalog/environments.md`, `docs/STATUS.md`, `docs/work/W141-…md`); `flows/*.json` и `catalog/flows/*.md` коммитом W141 не трогались (канон dev). `catalog/environments.md` описывает живой prod точно.
- **Офлайн** (с аргументами, как в хуке): `check-texts.py i18n/ru.json flows/*.json` — 30 флоу/303 ссылки/0; `check-commands.py` — 0 нарушений; `check-export-secrets.sh` — rc=0; `check-agents.py` — 0.
- **i18n.** `ap_list_translations` в моём наборе MCP-инструментов **не экспонирован**, прямой прод-запрос перевода повторить не удалось. Косвенно: W138 не менял `i18n/` (`git diff d2718ae^1 d2718ae -- i18n/` пуст), а набор `$t`-ключей изменённых шагов — подмножество тех, что эти же флоу уже использовали до W141 (напр. `ticket.btn.open` читается `reg-start/step_7`), поэтому новых ключей к импорту нет; все ссылки проходят `check-texts.py`.
- **Откат.** Источник (`git show d2718ae^1:flows/<flow>.json`) существует и содержит прежние edit-шаги (проверено: `reg-profile` 6, `reg-consent-pdn` 2, `reg-consent-mkt` 1 `edit_message_text`); маппинг env-id есть в `catalog/environments.md`. Оценка достаточности — замечание 1.
- **Не проверено живьём:** e2e в Telegram prod-бота (диплинк, голый `/start`, повторное касание, `register_direct`, отказ, выбор языка) — за владельцем; остаётся гейтом перед `готов`.

#### Замечания

1. **важно** — путь отката правдоподобен, но недоказуем побайтово: снапшот prod **не снят** (`~/qadam-snapshots/w141/` пуст), а в таблице «Что построено» дорелизный `publishedVersionId` записан только для `reg-consent-mkt` (`umKDENNz63nFu5S4K6aNd`); у `reg-start`/`reg-profile`/`menu`/`reg-consent-pdn` в колонке «published до» — `—`. Откат опирается на dev-канон `d2718ae^1` + ручное возвращение `auth={{connections['KIbxO5kYo3RsU5PNGPz9l']}}` (в git-экспортах `auth` вычищен). Источник корректен и существует (проверено), но результат отката нельзя сверить с тем, что реально было на prod, а средовые отличия (`auth`, три поля `events`) восстанавливаются вручную. W140 для этого снимал `ap_export_flow`-снапшоты. — журнал, разделы «Что построено» (колонка «published до») и «Откат»; `~/qadam-snapshots/w141/`. Рекомендация: дозаписать дорелизные `publishedVersionId` (история версий платформы) и сделать `ap_export_flow`-снапшот обязательным шагом хотфикса — впредь **до** первой правки.
2. **на будущее** — `reg-consent-mkt/step_5` (prod и dev-эталон) несёт в `texts` ключи `reg.consent_marketing.saved_yes`/`saved_no`, которые его код не читает: после ADR-0056 финальную карточку с этими текстами шлёт `reg-profile`, а `step_5` строит только билет. Мёртвые ключи ничему не мешают, но карта текстов обещает больше, чем экран. — prod `reg-consent-mkt/step_5`; `flows/reg-consent-mkt.json`. Убрать при следующей правке карточки в dev-каноне.
