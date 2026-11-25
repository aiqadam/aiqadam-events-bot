import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { load, suite } from './_load.mjs';
globalThis.require = createRequire(import.meta.url);
const { code } = await load('id-event-verify');
const t = suite();
// Выдуманные ключ и люди (тестовый диапазон).
const K = 'k'.repeat(64), A = '9000000000000901', NOW = 1_800_000_000_000, TS = String(NOW / 1000);
const canon = (v) => v === null || v === undefined ? 'null' : typeof v !== 'object' ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
const sign = (e, key = K, tag = 'id.member-deleted.v1\n') => createHmac('sha256', key).update(tag + e.module + '\n' + e.ts + '\n' + e.request_id + '\n' + createHash('sha256').update(canon(e.body), 'utf8').digest('hex'), 'utf8').digest('hex');
const env = (o = {}) => { const e = { type: 'id.member-deleted.v1', module: 'events', ts: TS, request_id: 'del-0f1e2d3c', body: { telegram_id: A }, ...o }; e.signature = o.signature ?? sign(e); return e; };
const go = (e, o = {}) => code({ ...e, key: K, now_ms: NOW, ...o });

let r = await go(env());
t.ok(r.ok && r.reason === 'ok' && r.requestId === 'del-0f1e2d3c' && r.bodyOk && r.telegramId === A, 'valid event accepted');
r = await go(env({ body: { telegram_id: A, extra: [1, { b: 2, a: null }] } }));
t.ok(r.ok, 'canon: nested keys sorted, arrays in order, null');
const e1 = env(); const e1b = { ...e1, body: { telegram_id: A } };
t.ok((await go(e1b)).ok, 'body re-built with the same content still verifies (hash over canon, not raw text)');

// Подпись и привязка полей.
const base = env();
t.ok((await go({ ...base, body: { telegram_id: '9000000000000902' } })).reason === 'bad_signature', 'body swap breaks the signature');
t.ok((await go({ ...base, request_id: 'del-other' })).reason === 'bad_signature', 'request_id bound');
t.ok((await go({ ...base, ts: String(Number(TS) - 1) })).reason === 'bad_signature', 'ts bound');
const noTag = env(); noTag.signature = sign(noTag, K, '');
t.ok((await go(noTag)).reason === 'bad_signature', 'module→ID shaped signature (no tag) rejected (ADR-0018)');
const otherKey = env(); otherKey.signature = sign(otherKey, 'x'.repeat(64));
t.ok((await go(otherKey)).reason === 'bad_signature', 'another key rejected');
t.ok((await go({ ...base, signature: base.signature.toUpperCase() })).reason === 'malformed', 'uppercase hex is malformed');

// Тип, модуль, формат, окно.
t.ok((await go(env({ type: 'id.member-updated.v1' }))).reason === 'bad_type', 'other type rejected');
t.ok((await go(env({ module: 'shop' }))).reason === 'unknown_module', 'other module rejected');
t.ok((await go(env({ request_id: 'del:1' }))).reason === 'malformed', 'request_id with ":" rejected (Store key)');
t.ok((await go(env({ request_id: '' }))).reason === 'malformed', 'empty request_id');
t.ok((await go(env({ ts: '17e8' }))).reason === 'malformed', 'non-digit ts');
t.ok((await go(env({ ts: String(Number(TS) - 301) }))).reason === 'expired', 'ts older than 300 s');
t.ok((await go(env({ ts: String(Number(TS) - 300) }))).ok, 'ts exactly 300 s old accepted');
t.ok((await go(env({ ts: String(Number(TS) + 61) }))).reason === 'skew', 'ts more than 60 s ahead');
t.ok((await go(env({ ts: String(Number(TS) + 60) }))).ok, 'ts 60 s ahead accepted');

// Ключ.
for (const k of [undefined, '', 'short', "{{variables['id_module_key']}}" + 'x'.repeat(40)]) {
  t.ok((await go(env(), { key: k })).reason === 'not_configured', 'key not configured: ' + JSON.stringify(k && k.slice(0, 12)));
}

// Тело: подпись верна, тело нет → ok, bodyOk false, без id.
for (const body of [{}, { telegram_id: 9000000000000901 }, { telegram_id: '0900' }, { telegram_id: '' }, { telegram_id: '1'.repeat(17) }, null, [A]]) {
  r = await go(env({ body }));
  t.ok(r.ok && !r.bodyOk && r.telegramId === '', 'bad body flagged: ' + JSON.stringify(body));
}

// Отказ не отдаёт ни id, ни requestId.
r = await go({ ...base, request_id: 'del-other' });
t.ok(!r.ok && r.requestId === '' && r.telegramId === '' && !JSON.stringify(r).includes(A), 'reject carries no id');
t.done('id-event-verify');
