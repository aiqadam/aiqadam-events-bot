import { createRequire } from 'node:module';
import { load, suite } from './_load.mjs';
globalThis.require = createRequire(import.meta.url);
const { code } = await load('id-call-sign');
const t = suite();
// Выдуманные ключ, адреса и люди (тестовый диапазон).
const K = 'k'.repeat(64), A = '9000000000000951', NOW = 1_800_000_000_000;
const U = (id) => `https://app.flow.aiqadam.org/api/v1/webhooks/${id}/sync`;
const URLS = { url_profile_get: U('PG0000000000000000001'), url_profile_upsert: U('UP0000000000000000001'), url_profile_batch: U('PB0000000000000000001'), url_consent_set: U('CS0000000000000000001'), url_account_delete: U('AD0000000000000000001') };
const go = (o = {}) => code({ api: 'profile-get', body: { telegram_id: A }, key: K, now_ms: NOW, ...URLS, ...o });

// Независимая копия проверки ID (aiqadam-id catalog/snippets/verify-sig.md, fn-verify-sig `verify`).
const crypto = require('node:crypto');
const idVerify = (inputs, key) => {
  const module = String(inputs.module ?? ''), ts = String(inputs.ts ?? ''), requestId = String(inputs.request_id ?? ''), signature = String(inputs.signature ?? '');
  if (module !== 'events' || !ts || !requestId || !signature) return 'malformed';
  const now = Math.floor(NOW / 1000), tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return 'malformed';
  if (now - tsNum > 300) return 'expired';
  if (tsNum - now > 60) return 'skew';
  const canon = (v) => { if (v === null || v === undefined) return 'null'; if (typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canon(v[k])).join(',') + '}'; };
  const bodyHash = crypto.createHash('sha256').update(canon(inputs.body), 'utf8').digest('hex');
  const expected = crypto.createHmac('sha256', String(key)).update(module + '\n' + ts + '\n' + requestId + '\n' + bodyHash, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'ok' : 'bad_signature';
};
// Конверт проходит JSON-сериализацию, как в http-шаге, и ID проверяет разобранный.
const wire = (e) => JSON.parse(JSON.stringify(e));

let r = await go();
t.ok(r.reason === 'ok' && r.url === URLS.url_profile_get, 'profile-get → its URL');
t.ok(idVerify(wire(r.envelope), K) === 'ok', 'ID verify accepts the envelope');
t.ok(r.envelope.module === 'events' && r.envelope.ts === String(NOW / 1000), 'module events, ts in seconds as a string');
t.ok(/^ev-[0-9a-f]{32}$/.test(r.envelope.request_id), 'request_id: ev- + 32 hex');
t.ok(/^[0-9a-f]{64}$/.test(r.envelope.signature), 'signature: lowercase hex');
t.ok(!JSON.stringify(r).includes(K), 'key never in the output');
const r2 = await go();
t.ok(r2.envelope.request_id !== r.envelope.request_id, 'request_id differs per call');

for (const [api, k] of [['profile-upsert', 'url_profile_upsert'], ['profile-batch', 'url_profile_batch'], ['consent-set', 'url_consent_set'], ['account-delete', 'url_account_delete']]) {
  r = await go({ api });
  t.ok(r.reason === 'ok' && r.url === URLS[k], `${api} → its URL`);
}

// Тело: канон с сортировкой ключей, вложенность, массивы, null, числа, кириллица.
const body = { telegram_id: A, update_only: true, first_name: 'Тест', clear: ['username', 'last_name'], nested: { b: 2, a: null }, n: 1.5 };
r = await go({ api: 'profile-upsert', body });
t.ok(idVerify(wire(r.envelope), K) === 'ok', 'complex body verifies after the wire');
t.ok(idVerify(wire({ ...r.envelope, body: { ...body, clear: ['last_name', 'username'] } }), K) === 'bad_signature', 'array order bound');
t.ok(idVerify(wire({ ...r.envelope, body: { ...body, telegram_id: '9000000000000952' } }), K) === 'bad_signature', 'body swap breaks the signature');
t.ok(idVerify(wire(r.envelope), 'x'.repeat(64)) === 'bad_signature', 'another key → 401 at ID');
t.ok(idVerify(wire({ ...r.envelope, request_id: 'ev-other' }), K) === 'bad_signature', 'request_id bound');

// Отказы без сети.
const bad = (x) => x.url === '' && JSON.stringify(x.envelope) === '{}';
r = await go({ api: 'profile-delete' }); t.ok(r.reason === 'bad_api' && bad(r), 'unknown api');
r = await go({ api: '__proto__' }); t.ok(r.reason === 'bad_api' && bad(r), '__proto__ is not an api');
r = await go({ api: undefined }); t.ok(r.reason === 'bad_api' && bad(r), 'missing api');
r = await go({ key: 'short' }); t.ok(r.reason === 'not_configured' && bad(r), 'short key');
r = await go({ key: "{{variables['id_module_key']}}" + 'x'.repeat(40) }); t.ok(r.reason === 'not_configured' && bad(r), 'unresolved key template');
r = await go({ key: undefined }); t.ok(r.reason === 'not_configured' && bad(r), 'missing key');
r = await go({ url_profile_get: '' }); t.ok(r.reason === 'not_configured' && bad(r), 'empty URL');
r = await go({ url_profile_get: "{{variables['id_url_profile_get']}}" }); t.ok(r.reason === 'not_configured' && bad(r), 'unresolved URL template');
r = await go({ url_profile_get: 'http://app.flow.aiqadam.org/api/v1/webhooks/PG01/sync' }); t.ok(r.reason === 'not_configured', 'http (not https) refused');
r = await go({ url_profile_get: 'https://evil.example/api/v1/webhooks/PG01/sync' }); t.ok(r.reason === 'not_configured', 'other host refused');
r = await go({ url_profile_get: 'https://app.flow.aiqadam.org.evil.example/api/v1/webhooks/PG01/sync' }); t.ok(r.reason === 'not_configured', 'host suffix trick refused');
r = await go({ url_profile_get: 'https://app.flow.aiqadam.org/api/v1/webhooks/PG01' }); t.ok(r.reason === 'not_configured', 'async webhook (no /sync) refused');
r = await go({ url_profile_get: U('PG01') + '?x=1' }); t.ok(r.reason === 'not_configured', 'query string refused');
r = await go({ body: null }); t.ok(r.reason === 'bad_body' && bad(r), 'null body');
r = await go({ body: [A] }); t.ok(r.reason === 'bad_body' && bad(r), 'array body');
r = await go({ body: '{"telegram_id":"x"}' }); t.ok(r.reason === 'bad_body' && bad(r), 'string body');
t.done('id-call-sign');
