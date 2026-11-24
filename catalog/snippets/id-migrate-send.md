# Эталон: id-migrate-send

**Инвариант:** батч уходит в ID подписанным ключом `migration_key` под тегом `id.migrate.v1`,
каждая попытка — со свежим `request_id`; ключ и люди не попадают ни в лог, ни в текст ошибки
([ADR-0058](../../docs/adr/0058-id-migrate-users-to-id.md), ID ADR-0030 §2 пп. 4–5, RT-6, RT-11)

**Встраивают:** `id-migrate` шаг `send` (внутри цикла по батчам)

## Что делает

Тело запроса — `{ts, request_id, signature, payload}`, где `payload` — строка JSON
`{kind:'batch', mode, run, people}`, подписанная ровно в том виде, в каком отправлена:

```
signature = HMAC_SHA256_hex(migration_key, "id.migrate.v1\n" + ts + "\n" + request_id + "\n" + sha256_hex(payload))
```

Канон проверки — ID `catalog/snippets/migrate-verify-sig.md`.

**Попытки.** До трёх, пауза 1 с × номер попытки. Повторяется сетевой сбой, `409` (повтор
`request_id` — значит, прошлая попытка дошла до ID, но ответ потерян; импорт идемпотентен), `429` и
`5xx`, кроме `503 not_configured`. Остальные отказы (`400`, `401`, `403`, `503 not_configured`) не
повторяются. После неудачи шаг бросает `batch_failed: <status> <reason>`: цикл останавливается, прогон
падает. Текст ошибки — только статус и код причины от ID, без id и без тела.

**Выход** при успехе: `counts` из ответа ID, `skipped` — число пропущенных, `sent` — размер батча,
`macs` — HMAC(`migration_key`, id) по обработанным (не пропущенным) людям для итогового digest
(ID ADR-0030 §5), `attempts`.

`logInput`/`logOutput` выключены: вход — ключ и люди, выход — ключевые хэши.

## Код

```js
// id-migrate-send (ADR-0058). logInput/logOutput OFF: the key and the people.
export const code = async (inputs) => {
  const crypto = require('node:crypto');
  const s = (v) => (v === undefined || v === null ? '' : String(v));
  const key = inputs.migration_key, url = s(inputs.url), mode = s(inputs.mode), run = s(inputs.run);
  if (typeof key !== 'string' || key.length < 32 || key.includes('{{')) throw new Error('not_configured: migration_key');
  if (!/^https:\/\/[A-Za-z0-9.-]+\/api\/v1\/webhooks\/[A-Za-z0-9]+\/sync$/.test(url)) throw new Error('not_configured: url');
  if (mode !== 'test' && mode !== 'real') throw new Error('bad_mode');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(run)) throw new Error('bad_run');
  const people = inputs.people;
  if (!Array.isArray(people) || people.length < 1 || people.length > 10) throw new Error('bad_batch');
  const payload = JSON.stringify({ kind: 'batch', mode, run, people });
  const nowSec = () => Math.floor((Number.isFinite(inputs.now_ms) ? inputs.now_ms : Date.now()) / 1000);
  const wait = (ms) => (inputs.no_wait ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
  let last = 'no_attempt';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ts = String(nowSec()), rid = 'mig-' + crypto.randomBytes(12).toString('hex');
    const bodyHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
    const signature = crypto.createHmac('sha256', key).update('id.migrate.v1\n' + ts + '\n' + rid + '\n' + bodyHash, 'utf8').digest('hex');
    let status = 0, body = null;
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ts, request_id: rid, signature, payload }) });
      status = res.status;
      try { body = await res.json(); } catch (e) { body = null; }
    } catch (e) { status = 0; }
    const reason = body && typeof body.reason === 'string' && /^[a-z_]{1,40}$/.test(body.reason) ? body.reason : '';
    if (status === 200 && body && body.ok === true) {
      const skipped = Array.isArray(body.skipped) ? body.skipped : null;
      if (!skipped || !skipped.every((i) => Number.isInteger(i) && i >= 0 && i < people.length) || new Set(skipped).size !== skipped.length) throw new Error('bad_answer: skipped');
      const skip = new Set(skipped);
      const macs = people.filter((p, i) => !skip.has(i)).map((p) => crypto.createHmac('sha256', key).update(s(p.telegram_id), 'utf8').digest('hex'));
      return { ok: true, attempts: attempt, sent: people.length, skipped: skipped.length, counts: body.counts || {}, macs };
    }
    last = status + ' ' + (reason || 'no_reason');
    const retry = status === 0 || status === 409 || status === 429 || (status >= 500 && reason !== 'not_configured');
    if (!retry) break;
    if (attempt < 3) await wait(1000 * attempt);
  }
  throw new Error('batch_failed: ' + last);
};
```

## Тесты

[tests/id-migrate-send.test.mjs](tests/id-migrate-send.test.mjs) — `fetch` подменён, сеть не нужна.
