# Эталон: подпись и проверка QR

**Инвариант:** подпись QR. `sig` — **последние 10 символов** payload'а,
не `split('-')`: base64url содержит дефис
([SECURITY.md](../../docs/SECURITY.md#ловушка-парсинга)).

**Встраивают:**

| Флоу | Шаг | Роль | Сверено |
|---|---|---|---|
| `fn-verify-qr` (`Zl4ShjrJBl8NNyKJ8ASLa`) | `step_2` | проверка | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_38` | проверка | 2026-09-12, побайтово |
| `fn-sign-qr` (`VBkXevctQRgh3em0v2ndA`) | `step_2` | **подпись** | обёртка иная, три строки те же |

> **Про `fn-sign-qr`.** Он подписывает, а не проверяет: имена входов и
> возвращаемая форма у него свои, побайтово совпасть не могут. Совпадать
> обязаны три строки — `msg`, `createHmac(...).digest('base64')` и перевод
> в base64url со срезом до 10 символов. Комментарий про «расхождение с
> fn-sign-qr» оставлен дословно во всех копиях-проверках: он называет
> единственный способ это заметить.

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
