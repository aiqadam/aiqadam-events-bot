# Эталон: id-call-result

**Инвариант:** вызывающий флоу всегда получает `{ok, status, body, reason}` и никогда — падение
подфлоу. `ok: true` только при `2xx` с JSON-телом `ok: true` от ID. Сеть, таймаут, ответ не в JSON и
отказ `sign` дают `ok: false, status: 0`
([ADR-0060](../../docs/adr/0060-id-switch-flows-to-id-api.md) §1, §6).

**Встраивают:** `fn-id-call` шаг `result` (`step_3`)

## Что делает

Входы: `sign_reason` = `{{step_1['output'].reason}}`, `out` = `{{step_2['output']}}`. Ввод и вывод
шага выключены: в ответе ID данные человека.

Выход шага `send_request` (`@aiqadam/qadam-http` 0.13.0, `failureMode: continue_all`,
`continueOnFailure`), проверено на QA (W146):

| Случай | Выход `step_2` |
|---|---|
| `2xx` | `{status, headers, body}` |
| `4xx`, `5xx` | `{response: {status, body}}` |
| таймаут | `{response: {status: 500}}`, без `body` |
| частный или зарезервированный адрес (защита платформы) | `{response: {status: 403, body: "<строка>"}}` |
| пустой адрес (отказ `sign`), сеть | шаг `FAILED`, выход — не объект; прогон идёт дальше |

Ответ:

| Случай | `ok` | `status` | `body` | `reason` |
|---|---|---|---|---|
| отказ `sign` | `false` | `0` | `{}` | `bad_api`, `not_configured`, `bad_body` |
| шаг упал (сеть) | `false` | `0` | `{}` | `network` |
| нет тела или тело не объект (таймаут, не JSON) | `false` | `0` | `{}` | `no_json` |
| `2xx` и `body.ok === true` | `true` | код | тело ID | `ok` |
| иначе (`4xx`, `5xx`, `2xx` без `ok: true`) | `false` | код | тело ID | `http_<код>` |

`reason` — код без данных человека; его и `status` пишет в лог следующий шаг `trace`.

## Код

```js
// fn-id-call result (ADR-0060 §1, §6). logInput/logOutput OFF: the ID answer carries personal data.
export const code = async (inputs) => {
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const down = (reason) => ({ ok: false, status: 0, body: {}, reason });
  const signReason = typeof inputs.sign_reason === 'string' ? inputs.sign_reason : '';
  if (signReason !== 'ok') return down(/^[a-z_]{1,20}$/.test(signReason) ? signReason : 'not_configured');
  const out = inputs.out;
  if (!isObj(out)) return down('network');
  // 2xx: {status, headers, body}; 4xx/5xx/timeout: {response: {status, body?}}.
  const r = out.status === undefined && isObj(out.response) ? out.response : out;
  const status = Number.isInteger(r.status) && r.status >= 100 && r.status <= 599 ? r.status : 0;
  if (!status) return down('network');
  if (!isObj(r.body)) return down('no_json');
  const ok = status >= 200 && status < 300 && r.body.ok === true;
  return { ok, status, body: r.body, reason: ok ? 'ok' : 'http_' + status };
};
```

## Тесты

[tests/id-call-result.test.mjs](tests/id-call-result.test.mjs)
