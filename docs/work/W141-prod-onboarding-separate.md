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
| flow `reg-start` | `FkxtgayOK5QubyqqMd9q4` | — | `OtJL5GaiPObHTfcCVt4gm` |
| flow `reg-profile` | `5U3Kv0cSrnvDTrbictA4L` | — | `MEf7vkJI69mLNLPQHLJeP` |
| flow `menu` | `1DORFhP9F3W00KpKz5wDw` | — | `vJ13RIrbCiHVQUPgMneVY` |
| flow `reg-consent-mkt` | `3gLF6TcbpFObHONATQ64N` | `umKDENNz63nFu5S4K6aNd` | `Gu1dt6jQqC0aoV2ssneHq` |
| flow `reg-consent-pdn` | `vQJDQ8NecB1PleIFrq07O` | — | `kCjJ2GQejHHScsVxSJrAj` |
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

MCP не умеет revert по версии. Откат — по канону dev-pre-W138
(`git show d2718ae^1:flows/<flow>.json`) с картой средовых id
([`catalog/environments.md`](../../catalog/environments.md)): вернуть прежние
`input`/`sourceCode` изменённых шагов, восстановить удалённые шаги
(`reg-start`/`menu` — только CODE; удалённые шаги — `reg-profile` 14 шт.,
`reg-consent-pdn` 4 шт., `reg-consent-mkt` 2 шт.), затем повторная публикация.
Входы `auth` в git-версиях вычищены экспортом — при восстановлении шагать с
`auth={{connections['KIbxO5kYo3RsU5PNGPz9l']}}`.

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

## Ревью

> Заполняет **независимый ревьюер**. Владелец пакета сюда не пишет.

## Хвосты и блокеры

- живой e2e в Telegram prod-бота — за владельцем; `ap_test_step` не годится
  (эффектов не сохраняет, ROUTER не гейтит);
- `tools/check-migrations.py` по prod — известный хвост (нет ключа платформы),
  как в W134/W137/W140;
- W136 (гео-ветка `manage-api`) и прочие dev-хвосты на prod — вне этого пакета.
