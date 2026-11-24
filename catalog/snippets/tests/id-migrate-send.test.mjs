import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { load, suite } from './_load.mjs';
globalThis.require = createRequire(import.meta.url);
const { code } = await load('id-migrate-send');
const t = suite();
// Выдуманные ключ и люди (тестовый диапазон).
const MK = 'm'.repeat(40), URL_ = 'https://flow.example.test/api/v1/webhooks/abc123/sync';
const A = '9000000000000001', B = '9000000000000002';
const P = (id) => ({ telegram_id: id, consent_pdn: 'true', consent_pdn_at: '2026-10-01T10:00:00Z' });
let calls = [];
const answer = (...seq) => { calls = []; let i = 0; globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); const a = seq[Math.min(i++, seq.length - 1)]; if (a === 'net') throw new Error('ECONNRESET ' + A); return { status: a[0], json: async () => a[1] }; }; };
const go = (o = {}) => code({ migration_key: MK, url: URL_, mode: 'test', run: 'r1', people: [P(A), P(B)], no_wait: true, ...o });
const mac = (id) => createHmac('sha256', MK).update(id, 'utf8').digest('hex');

answer([200, { ok: true, counts: { people: 2 }, skipped: [1] }]);
let r = await go();
t.ok(r.ok && r.attempts === 1 && r.skipped === 1 && r.macs.length === 1 && r.macs[0] === mac(A), 'success; macs only for processed');
const b = calls[0].body, h = createHash('sha256').update(b.payload, 'utf8').digest('hex');
t.ok(b.signature === createHmac('sha256', MK).update('id.migrate.v1\n' + b.ts + '\n' + b.request_id + '\n' + h, 'utf8').digest('hex'), 'signature matches the ID canon');
t.ok(JSON.parse(b.payload).kind === 'batch' && JSON.parse(b.payload).people.length === 2 && /^mig-[0-9a-f]{24}$/.test(b.request_id), 'payload and request_id shape');
t.ok(!JSON.stringify(r).includes(A), 'no id in the output');

answer('net', [502, null], [200, { ok: true, counts: {}, skipped: [] }]);
r = await go();
t.ok(r.ok && r.attempts === 3 && calls.length === 3 && new Set(calls.map((c) => c.body.request_id)).size === 3, 'network error and 502 retried, fresh request_id each time');
answer([409, { ok: false, reason: 'replay' }], [200, { ok: true, counts: {}, skipped: [] }]);
r = await go();
t.ok(r.ok && r.attempts === 2, '409 retried');
answer([401, { ok: false, reason: 'bad_signature' }]);
let err = ''; try { await go(); } catch (e) { err = e.message; }
t.ok(err === 'batch_failed: 401 bad_signature' && calls.length === 1, '401 not retried');
answer([503, { ok: false, reason: 'not_configured' }]);
err = ''; try { await go(); } catch (e) { err = e.message; }
t.ok(err === 'batch_failed: 503 not_configured' && calls.length === 1, '503 not_configured not retried');
answer('net');
err = ''; try { await go(); } catch (e) { err = e.message; }
t.ok(err === 'batch_failed: 0 no_reason' && calls.length === 3 && !err.includes(A), 'three failures → stop; no id in the error');
answer([500, { ok: false, reason: 'x ' + A }]);
err = ''; try { await go(); } catch (e) { err = e.message; }
t.ok(!err.includes(A) && err === 'batch_failed: 500 no_reason', 'odd reason text not echoed');
answer([200, { ok: true, counts: {}, skipped: [5] }]);
await t.throws(() => go(), /bad_answer/, 'skipped position out of range');
await t.throws(() => go({ migration_key: '{{variables.k}}' }), /not_configured: migration_key/, 'no key');
await t.throws(() => go({ url: 'http://flow.example.test/api/v1/webhooks/abc/sync' }), /not_configured: url/, 'http refused');
await t.throws(() => go({ mode: 'dry-test' }), /bad_mode/, 'dry mode never sends');
await t.throws(() => go({ people: [] }), /bad_batch/, 'empty batch');
t.done('id-migrate-send');
