# Эталон: id-migrate-verify

**Инвариант:** прогон считается прошедшим, только если ID пометил ровно тех, кого бот отправил и ID
не пропустил, и все отправленные учтены; сверка — числами и ключевым digest, без единого
`telegram_id` наружу ([ADR-0058](../../docs/adr/0058-id-migrate-users-to-id.md), ID ADR-0030 §5,
RT-4, RT-10)

**Встраивают:** `id-migrate` шаг `verify`

## Что делает

**Входы:** `migration_key`, `url` (вебхук ID `migrate-verify`), `mode`, `run`, `results` — собранные
циклом выходы `send` (по одному на батч), `expected` — из `preflight`.

1. `digest = sha256_hex(sort(macs).join("\n"))` по всем `macs` всех батчей; `sent`, `skipped` — суммы.
2. Подписанный запрос `{kind:'verify', mode, run, digest, sent, skipped}` в `migrate-verify`, те же
   правила попыток, что у `id-migrate-send`.
3. Итог `pass` — все условия:
   - `sent = expected.sent`;
   - `members_inserted + members_existing + skipped_deleted + skipped_bad = sent` (суммы ответов ID);
   - ответ ID `match: true`.

**Выход:** `{pass, sent_ok, accounted_ok, match, totals, verify}` — только числа и флаги.
`logInput` выключен (ключ); выход можно логировать.

## Код

```js
// id-migrate-verify (ADR-0058). logInput OFF: the key; the output is counts and flags only.
export const code = async (inputs) => {
  const crypto = require('node:crypto');
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const key = inputs.migration_key, url = s(inputs.url), mode = s(inputs.mode), run = s(inputs.run);
  if (typeof key !== 'string' || key.length < 32 || key.includes('{{')) throw new Error('not_configured: migration_key');
  if (!/^https:\/\/[A-Za-z0-9.-]+\/api\/v1\/webhooks\/[A-Za-z0-9]+\/sync$/.test(url)) throw new Error('not_configured: url');
  if (mode !== 'test' && mode !== 'real') throw new Error('bad_mode');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(run)) throw new Error('bad_run');
  const results = Array.isArray(inputs.results) ? inputs.results : null;
  if (!results || results.some((x) => !x || x.ok !== true || !Array.isArray(x.macs))) throw new Error('bad_results');
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const totals = { batches: results.length, sent: 0, skipped: 0, members_inserted: 0, members_existing: 0, skipped_deleted: 0, skipped_bad: 0,
    created: { base: 0, module: 0, mailing: 0 }, existing: { base: 0, module: 0, mailing: 0 }, log_written: 0, log_repaired: 0 };
  const macs = [];
  for (const x of results) {
    totals.sent += n(x.sent); totals.skipped += n(x.skipped); macs.push(...x.macs);
    const c = x.counts || {};
    for (const k of ['members_inserted', 'members_existing', 'skipped_deleted', 'skipped_bad', 'log_written', 'log_repaired']) totals[k] += n(c[k]);
    for (const g of ['created', 'existing']) for (const p of ['base', 'module', 'mailing']) totals[g][p] += n(c[g] && c[g][p]);
  }
  if (macs.some((m) => !/^[0-9a-f]{64}$/.test(s(m)))) throw new Error('bad_results');
  const digest = crypto.createHash('sha256').update(macs.slice().sort().join('\n'), 'utf8').digest('hex');
  const payload = JSON.stringify({ kind: 'verify', mode, run, digest, sent: totals.sent, skipped: totals.skipped });
  const nowSec = () => Math.floor((Number.isFinite(inputs.now_ms) ? inputs.now_ms : Date.now()) / 1000);
  const wait = (ms) => (inputs.no_wait ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  let answer = null, last = 'no_attempt';
  for (let attempt = 1; attempt <= 3 && !answer; attempt++) {
    const ts = String(nowSec()), rid = 'mig-' + crypto.randomBytes(12).toString('hex');
    const h = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    const signature = crypto.createHmac('sha256', key).update('id.migrate.v1\n' + ts + '\n' + rid + '\n' + h, 'utf8').digest('hex');
    let status = 0, body = null;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ts, request_id: rid, signature, payload }) });
      status = res.status;
      try { body = await res.json(); } catch (e) { body = null; }
    } catch (e) { status = 0; }
    const reason = body && typeof body.reason === 'string' && /^[a-z_]{1,40}$/.test(body.reason) ? body.reason : '';
    if (status === 200 && body && body.ok === true) { answer = body; break; }
    last = status + ' ' + (reason || 'no_reason');
    const retry = status === 0 || status === 409 || status === 429 || (status >= 500 && reason !== 'not_configured');
    if (!retry) break;
    if (attempt < 3) await wait(1000 * attempt);
  }
  if (!answer) throw new Error('verify_failed: ' + last);
  const b = (v) => v === true || v === 'true';
  const verify = { match: b(answer.match), digest_ok: b(answer.digest_ok), count_ok: b(answer.count_ok), marked: n(answer.marked),
    wrong_range: n(answer.wrong_range), bad_marker: n(answer.bad_marker) };
  const exp = inputs.expected || {};
  const sent_ok = totals.sent === n(exp.sent);
  const accounted_ok = totals.members_inserted + totals.members_existing + totals.skipped_deleted + totals.skipped_bad === totals.sent;
  return { pass: sent_ok && accounted_ok && verify.match, sent_ok, accounted_ok, match: verify.match, totals, expected: exp, verify };
};
```

## Тесты

[tests/id-migrate-verify.test.mjs](tests/id-migrate-verify.test.mjs) — `fetch` подменён.
