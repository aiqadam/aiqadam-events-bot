# Эталон: id-call-sign

**Инвариант:** запрос в ID уходит только на адрес вебхука ID из переменной этого `api`, на хост
`app.flow.aiqadam.org`, и подписан ключом `id_module_key` по правилу ID: модуль `events`, `ts`,
случайный `request_id`, хэш канонического тела
([ADR-0060](../../docs/adr/0060-id-switch-flows-to-id-api.md) §1,
[ID ADR-0012](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0012-module-signing-keys-payload-replay.md)).
Ключ не покидает шаг.

**Встраивают:** `fn-id-call` шаг `sign` (`step_1`)

## Что делает

Тот же алгоритм, что в ID (`catalog/snippets/verify-sig.md`, проверка `fn-verify-sig`):

```
canonical = "events\n" + ts + "\n" + request_id + "\n" + sha256(canon(body))
signature = HMAC_SHA256(id_module_key, canonical)   // lowercase hex
```

`canon(v)` — JSON с ключами объектов по алфавиту, рекурсивно; массивы по порядку;
`null`/`undefined` → `null`.

**Входы:** `api`, `body`, `key` = `{{variables['id_module_key']}}` и пять адресов
`url_profile_get` … `url_account_delete` = `{{variables['id_url_…']}}`. Ввод и вывод шага выключены:
ключ, тело с данными человека, подпись.

**Выход:**

- `reason` — `ok`, `bad_api` (не из пяти), `not_configured` (ключ короче 32 или не подставлен; адрес
  не вебхук ID), `bad_body` (тело не объект);
- при `ok`: `url` и `envelope` = `{module, ts, request_id, signature, body}` — тело запроса `http`;
- иначе `url: ''` и `envelope: {}`: шаг `http` падает без сети, `result` отвечает `ok:false, status:0`.

`ts` — секунды строкой (окно ID 300 с, опережение 60 с). `request_id` — `ev-` и 32 hex-символа из
`crypto.randomBytes`: повтор ID (`409`) возможен только при повторе того же конверта.

## Код

```js
// fn-id-call sign (ADR-0060 §1, ID ADR-0012). logInput/logOutput OFF: the key, the body, the signature.
export const code = async (inputs) => {
  const crypto = require('node:crypto');
  const fail = (reason) => ({ reason, url: '', envelope: {} });
  const urls = {
    'profile-get': inputs.url_profile_get,
    'profile-upsert': inputs.url_profile_upsert,
    'profile-batch': inputs.url_profile_batch,
    'consent-set': inputs.url_consent_set,
    'account-delete': inputs.url_account_delete,
  };
  const api = typeof inputs.api === 'string' ? inputs.api : '';
  if (!Object.prototype.hasOwnProperty.call(urls, api)) return fail('bad_api');
  const key = inputs.key;
  if (typeof key !== 'string' || key.length < 32 || key.includes('{{')) return fail('not_configured');
  const url = typeof urls[api] === 'string' ? urls[api] : '';
  if (!/^https:\/\/app\.flow\.aiqadam\.org\/api\/v1\/webhooks\/[A-Za-z0-9]{1,40}\/sync$/.test(url)) return fail('not_configured');
  const body = inputs.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return fail('bad_body');
  const canon = (v) => {
    if (v === null || v === undefined) return 'null';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  };
  const ts = String(Math.floor((Number.isFinite(inputs.now_ms) ? inputs.now_ms : Date.now()) / 1000));
  const request_id = 'ev-' + crypto.randomBytes(16).toString('hex');
  const bodyHash = crypto.createHash('sha256').update(canon(body), 'utf8').digest('hex');
  const signature = crypto.createHmac('sha256', key).update('events\n' + ts + '\n' + request_id + '\n' + bodyHash, 'utf8').digest('hex');
  return { reason: 'ok', url, envelope: { module: 'events', ts, request_id, signature, body } };
};
```

## Тесты

[tests/id-call-sign.test.mjs](tests/id-call-sign.test.mjs)
