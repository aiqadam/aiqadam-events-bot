# Эталон: id-migrate-preflight

**Инвариант:** в ID уходят только люди с `consent_pdn = true`, каждый один раз, батчами по 10;
при любом сомнении в исходных данных прогон останавливается до первой отправки
([ADR-0058](../../docs/adr/0058-id-migrate-users-to-id.md), ID ADR-0030 §2 п. 3, red team RT-3, RT-9)

**Встраивают:** `id-migrate` шаг `preflight`

## Что делает

**Входы**

- `mode` — переменная `migration_mode`: `test`, `real`, `dry-test`, `dry-real`. Остальное —
  отказ `bad_mode`. `test`/`dry-test` читают выдуманную таблицу `mig_test_users`, `real`/`dry-real` —
  `users`.
- `run` — переменная `migration_run`, `[A-Za-z0-9_-]{1,40}`.
- `open_until` — переменная `migration_open_until`. Для `test`/`real` окно обязано быть открыто
  (сейчас < значение ≤ сейчас + 4 ч), иначе `closed`. `dry-*` ничего не отправляют, окно им не нужно.
- `users_all`, `users_true`, `test_all`, `test_true` — выходы `tables-find-records`: вся таблица и
  та же таблица с фильтром `consent_pdn = true`. Вторая выборка — сверка первой (RT-9).
- `now_ms` — необязательно, для тестов.

**Проверки** (считаются все, отказ — по любой ненулевой):

| Счётчик | Что значит |
|---|---|
| `read_mismatch` | строк с `consent_pdn = true` в полной выборке не столько, сколько во второй |
| `bad_value` | `consent_pdn`, `consent_marketing` или `blocked_bot` не `true`/`false`/пусто |
| `bad_id` | `telegram_id` не `^[1-9][0-9]{0,15}$` |
| `wrong_range` | в тестовом режиме id вне `^9[0-9]{15}$`, в реальном — внутри |
| `disagreeing_dupes` | один `telegram_id` в нескольких строках с разными значениями |
| `pdn_true_no_date` / `mkt_true_no_date` | согласие `true` без разбираемой даты |
| `too_long` | значение длиннее 256 символов (ID отклонит батч) |

Совпадающие дубли сливаются в одного человека (`merged_dupes`). Люди без `consent_pdn = true`
не отправляются (`left_behind`).

**Выход**

- `ok`, `send` (`ok` и режим не `dry-*`), `reason`.
- `counts`: гистограммы трёх dropdown'ов и счётчики выше. `expected`: `{sent, base, module, mailing}` —
  числа, которые записываются в журнал до реального прогона.
- `batches`: список батчей по 10 человек, поля — только сопоставленные ID (без `phone`).

Шаг несёт людей: `logInput`/`logOutput` выключены. Счётчики наружу отдаёт отдельный шаг.

## Код

```js
// id-migrate-preflight (ADR-0058). logInput/logOutput OFF: inputs and batches carry people.
export const code = async (inputs) => {
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const MODES = ['test', 'real', 'dry-test', 'dry-real'];
  const mode = s(inputs.mode).trim(), run = s(inputs.run).trim();
  const base = { ok: false, send: false, mode, run, counts: {}, expected: {}, batches: [], batch_count: 0 };
  if (!MODES.includes(mode)) return { ...base, reason: 'bad_mode' };
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(run)) return { ...base, reason: 'bad_run' };
  const testMode = mode === 'test' || mode === 'dry-test', sending = mode === 'test' || mode === 'real';
  if (sending) {
    const now = Number.isFinite(inputs.now_ms) ? inputs.now_ms : Date.now();
    const until = Date.parse(s(inputs.open_until));
    if (!Number.isFinite(until) || !(now < until) || until > now + 4 * 3600 * 1000) return { ...base, reason: 'closed' };
  }
  const list = (x, name) => { const r = Array.isArray(x) ? x : (x && Array.isArray(x.records) ? x.records : null); if (!r) throw new Error('read_failed: ' + name); return r; };
  const flat = (rec) => { const o = {}, c = (rec && rec.cells) || {}; for (const k of Object.keys(c)) if (c[k] && typeof c[k] === 'object' && 'fieldName' in c[k]) o[c[k].fieldName] = c[k].value; return o; };
  const all = list(testMode ? inputs.test_all : inputs.users_all, testMode ? 'test_all' : 'users_all').map(flat);
  const trueRead = list(testMode ? inputs.test_true : inputs.users_true, testMode ? 'test_true' : 'users_true');
  const FIELDS = ['telegram_id', 'first_name', 'last_name', 'username', 'profile_first_name', 'profile_last_name',
    'position', 'company', 'city', 'lang', 'profile_completed_at', 'created_at', 'consent_pdn', 'consent_pdn_at',
    'consent_marketing', 'consent_marketing_at', 'blocked_bot'];
  const DROPS = ['consent_pdn', 'consent_marketing', 'blocked_bot'];
  const hist = {}; for (const d of DROPS) hist[d] = { true: 0, false: 0, empty: 0, other: 0 };
  const c = { rows: all.length, distinct: 0, merged_dupes: 0, disagreeing_dupes: 0, left_behind: 0, read_mismatch: 0,
    bad_value: 0, bad_id: 0, wrong_range: 0, pdn_true_no_date: 0, mkt_true_no_date: 0, too_long: 0 };
  const TEST = /^9[0-9]{15}$/, date = (v) => Number.isFinite(Date.parse(s(v)));
  const byId = new Map();
  for (const r of all) {
    const p = {};
    for (const k of FIELDS) { const v = r[k]; p[k] = v === undefined || v === null || s(v) === '' ? null : s(v); }
    for (const d of DROPS) { const v = s(p[d]); if (v === 'true' || v === 'false') hist[d][v]++; else if (v === '') hist[d].empty++; else { hist[d].other++; c.bad_value++; } }
    for (const k of FIELDS) if (p[k] !== null && p[k].length > 256) c.too_long++;
    const tid = s(p.telegram_id);
    if (!/^[1-9][0-9]{0,15}$/.test(tid)) { c.bad_id++; continue; }
    if (testMode !== TEST.test(tid)) c.wrong_range++;
    const key = JSON.stringify(FIELDS.map((k) => p[k]));
    const have = byId.get(tid);
    if (have) { if (have.key === key) c.merged_dupes++; else c.disagreeing_dupes++; continue; }
    byId.set(tid, { key, p });
  }
  if (hist.consent_pdn.true !== trueRead.length) c.read_mismatch = 1;
  c.distinct = byId.size;
  const people = [];
  let mailing = 0;
  for (const { p } of byId.values()) {
    if (p.consent_pdn !== 'true') { c.left_behind++; continue; }
    if (!date(p.consent_pdn_at)) c.pdn_true_no_date++;
    if (p.consent_marketing === 'true') { mailing++; if (!date(p.consent_marketing_at)) c.mkt_true_no_date++; }
    people.push(p);
  }
  const STOP = ['read_mismatch', 'bad_value', 'bad_id', 'wrong_range', 'disagreeing_dupes', 'pdn_true_no_date', 'mkt_true_no_date', 'too_long'];
  const stops = STOP.filter((k) => c[k] > 0);
  const counts = { ...c, hist }, expected = { sent: people.length, base: people.length, module: people.length, mailing };
  if (stops.length) return { ...base, counts, expected, reason: 'stop: ' + stops.join(',') };
  const batches = [];
  for (let i = 0; i < people.length; i += 10) batches.push(people.slice(i, i + 10));
  return { ok: true, send: sending && batches.length > 0, reason: 'ok', mode, run, counts, expected, batches, batch_count: batches.length };
};
```

## Тесты

[tests/id-migrate-preflight.test.mjs](tests/id-migrate-preflight.test.mjs).
