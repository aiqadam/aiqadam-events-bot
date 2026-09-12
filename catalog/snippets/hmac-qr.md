# Эталон: подпись и проверка QR

**Инвариант:** подпись QR. `sig` — **последние 10 символов** payload'а,
не `split('-')`: base64url содержит дефис
([SECURITY.md](../../docs/SECURITY.md#ловушка-парсинга)).

**Встраивают:**

| Флоу | Шаг | Роль | Сверено |
|---|---|---|---|
| `fn-verify-qr` (`Zl4ShjrJBl8NNyKJ8ASLa`) | `step_2` | проверка | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_38` | проверка | 2026-09-12, побайтово |
| `fn-sign-qr` (`VBkXevctQRgh3em0v2ndA`) | `step_1`+`step_2` | **подпись** | эталон-источник варианта подписи |
| `my-qr-api` (`I5nd8ggKH4wkQLaww9Dkl`) | `step_5`+`step_24` | **подпись** | 2026-09-12, побайтово |

> **У эталона две стороны, и это не одно и то же.** Проверяющая считает
> ожидаемую подпись и сравнивает; подписывающая ещё и собирает `payload`.
> Побайтово совпадать обязаны копии **внутри** своей стороны; между
> сторонами обязаны совпадать три строки — `msg`,
> `createHmac(...).digest('base64')` и перевод в base64url со срезом до 10.
> Оба текста приведены ниже целиком.

## Код

```js
export const code = async (inputs) => {
  const crypto = require('node:crypto');

  const eventId = String(inputs.signEventId === undefined || inputs.signEventId === null ? '' : inputs.signEventId);
  const userId = String(inputs.signUserId === undefined || inputs.signUserId === null ? '' : inputs.signUserId);
  const qrSigningKey = String(inputs.qrSigningKey === undefined || inputs.qrSigningKey === null ? '' : inputs.qrSigningKey);

  // Дублирует логику fn-sign-qr (ADR-0010: мотив — латентность, не секьюрити,
  // убирается вложенный flow-run на каждый скан). Расхождение с fn-sign-qr здесь
  // означает, что часть QR молча перестанет проходить чекин.
  const msg = 'c:' + eventId + ':' + userId;
  const raw = crypto.createHmac('sha256', qrSigningKey).update(msg, 'utf8').digest('base64');
  const b64url = raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = b64url.slice(0, 10);
  if (sig.length !== 10) throw new Error('fn-verify-qr: short hmac output');

  return { sig: sig };
};
```

**Вход шага:**

```json
{"signUserId": "…", "signEventId": "…", "qrSigningKey": "{{variables['QR_SIGNING_KEY']}}"}
```

## Что нельзя трогать

- **Формат `msg` — `'c:' + eventId + ':' + userId`.** Любое изменение
  обесценивает все уже выданные QR.
- **base64 → base64url и срез до 10 символов** — именно в этом порядке.
- `{{variables['QR_SIGNING_KEY']}}` только в длинной форме (см. выше).

## Как ловится дрейф

Подпись ставится в одном флоу (`registration`, `my-qr-api`), проверяется в
другом (`checkin-api`). Расхождение копий означает, что **скан перестаёт
проходить** — отказ громкий. Это и есть обязательный тест пакета W21:
QR, подписанный в `registration`, обязан пройти в `checkin-api`.

## Код — сторона подписи

Два шага. Первый падает громко на мусорном входе: подпись по пустым значениям —
тихая катастрофа, её нельзя пропускать дальше.

```js
export const code = async (inputs) => {
  const SLUG = /^[A-Za-z0-9_]{1,12}$/;
  const USER = /^[0-9]{1,16}$/;

  const eventId = String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId).trim();
  const userId = String(inputs.userId === undefined || inputs.userId === null ? '' : inputs.userId).trim();

  // Подпись по пустым входам — тихая катастрофа, поэтому падаем громко.
  if (!SLUG.test(eventId)) throw new Error('fn-sign-qr: bad eventId');
  if (!USER.test(userId)) throw new Error('fn-sign-qr: bad userId');

  // Канонический вид зафиксирован в SECURITY.md: "c:" + eventId + ":" + userId
  return { eventId: eventId, userId: userId, msg: 'c:' + eventId + ':' + userId };
};
```

```js
export const code = async (inputs) => {
  const crypto = require('node:crypto');

  const msg = String(inputs.msg === undefined || inputs.msg === null ? '' : inputs.msg);
  const eventId = String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId);
  const userId = String(inputs.userId === undefined || inputs.userId === null ? '' : inputs.userId);
  const qrSigningKey = String(inputs.qrSigningKey === undefined || inputs.qrSigningKey === null ? '' : inputs.qrSigningKey);

  const raw = crypto.createHmac('sha256', qrSigningKey).update(msg, 'utf8').digest('base64');

  // base64 -> base64url, срез до 10 (SECURITY.md): та же логика, что была в старом Code step,
  // только сам HMAC теперь считается здесь же, а не в отдельном crypto qadam (ADR-0010).
  const b64url = raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sig = b64url.slice(0, 10);
  if (sig.length !== 10) throw new Error('fn-sign-qr: short hmac output');

  // Полный дайджест (b64url) наружу не отдаётся — как и раньше, только sig.
  return {
    sig: sig,
    eventId: eventId,
    userId: userId,
    msg: msg,
    payload: 'c' + eventId + '-' + userId + '-' + sig
  };
};
```

## Дрейф пойман? Нет — проверен и не найден

**2026-09-12, W21.** Сквозная проверка сделана и прошла: `my-qr-api/step_24`
(встроенная подпись) выдал `aIxmwbnzb_` для пары `(demo, 322876545)` —
ровно ту подпись, которую независимо посчитала и приняла встроенная проверка
`checkin-api/step_38`. Прогоны `JMAC4mcduVJjKONyTQC2g` (подпись) и
`G05GjI12dsGeWssBAwAAt` (проверка).

Это и есть тот тест, ради которого ADR-0012 соглашается на дублирование:
две независимые копии HMAC сошлись на одном значении.
