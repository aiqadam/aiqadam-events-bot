# Эталон: id-event-verify

**Инвариант:** событие ID принимается, только если подпись ключом `id_module_key` сошлась над
строкой с тегом направления, `ts` в окне и тип и модуль — наши. Тело проверяется отдельно и
отдаётся флагом: заявка на повтор (`idrq:<request_id>`) ставится после подписи, но до тела
([ADR-0059](../../docs/adr/0059-id-switch-prep-deletion-and-delivery-state.md) §3,
[ID ADR-0018](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0018-id-to-module-signature-direction-tag.md))

**Встраивают:** `id-member-deleted` шаг `verify`

## Что делает

Тот же алгоритм, что в ID (`verify-sig`, «ID→module events — direction tag») и в QA-заглушке ID
`stub-module-receiver`:

```
canonical = "id.member-deleted.v1\n" + module + "\n" + ts + "\n" + request_id + "\n" + sha256(canon(body))
signature = HMAC_SHA256(id_module_key, canonical)   // lowercase hex
```

`canon(v)` — JSON с ключами объектов по алфавиту, рекурсивно; `null`/`undefined` → `null`.

**Входы** — поля конверта из тела вебхука (`type`, `module`, `ts`, `request_id`, `signature`, `body`)
и `key` = `{{variables['id_module_key']}}`. Ввод и вывод шага выключены: ключ и `telegram_id`.

**Выход**

- `ok` — подпись верна. Иначе `reason`, ответ `401`:
  - `not_configured` — ключ не задан (короче 32 символов или не подставился);
  - `bad_type` — тип не `id.member-deleted.v1`;
  - `unknown_module` — модуль не `events`;
  - `malformed` — нет `ts`, `request_id` не `^[A-Za-z0-9_-]{1,80}$`, подпись не 64 hex;
  - `expired` / `skew` — `ts` старше 300 с или впереди больше чем на 60 с;
  - `bad_signature` — сравнение в постоянное время не сошлось.
- `requestId` — только при `ok`; из него шаг Store собирает ключ повтора.
- `bodyOk` — `body.telegram_id` строка `^[1-9][0-9]{0,15}$`; иначе ответ `400` после заявки на повтор.
- `telegramId` — только при `ok` и `bodyOk`.

## Код

```js
// id-event-verify (ADR-0059 §3, ID ADR-0018). logInput/logOutput OFF: the key and telegram_id.
export const code = async (inputs) => {
  const crypto = require('node:crypto');
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const reject = (reason) => ({ ok: false, reason, requestId: '', bodyOk: false, telegramId: '' });
  const key = inputs.key;
  if (typeof key !== 'string' || key.length < 32 || key.includes('{{')) return reject('not_configured');
  if (s(inputs.type) !== 'id.member-deleted.v1') return reject('bad_type');
  const module = s(inputs.module);
  if (module !== 'events') return reject('unknown_module');
  const ts = s(inputs.ts), requestId = s(inputs.request_id), signature = s(inputs.signature);
  if (!/^[0-9]{1,12}$/.test(ts) || !/^[A-Za-z0-9_-]{1,80}$/.test(requestId) || !/^[0-9a-f]{64}$/.test(signature)) return reject('malformed');
  const now = Math.floor((Number.isFinite(inputs.now_ms) ? inputs.now_ms : Date.now()) / 1000);
  const tsNum = Number(ts);
  if (now - tsNum > 300) return reject('expired');
  if (tsNum - now > 60) return reject('skew');
  const canon = (v) => {
    if (v === null || v === undefined) return 'null';
    if (typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  };
  const bodyHash = crypto.createHash('sha256').update(canon(inputs.body), 'utf8').digest('hex');
  const canonical = 'id.member-deleted.v1\n' + module + '\n' + ts + '\n' + requestId + '\n' + bodyHash;
  const expected = Buffer.from(crypto.createHmac('sha256', key).update(canonical, 'utf8').digest('hex'), 'utf8');
  const got = Buffer.from(signature, 'utf8');
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return reject('bad_signature');
  const b = inputs.body;
  const tid = b && typeof b === 'object' && !Array.isArray(b) && typeof b.telegram_id === 'string' ? b.telegram_id : '';
  const bodyOk = /^[1-9][0-9]{0,15}$/.test(tid);
  return { ok: true, reason: 'ok', requestId, bodyOk, telegramId: bodyOk ? tid : '' };
};
```

## Тесты

[tests/id-event-verify.test.mjs](tests/id-event-verify.test.mjs)
