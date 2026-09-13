# Эталон: подпись и проверка QR

**Инвариант:** подпись QR. `sig` — **последние 10 символов** payload'а,
не `split('-')`: base64url содержит дефис
([SECURITY.md](../../docs/SECURITY.md#ловушка-парсинга)).

**Встраивают (после [ADR-0015](../../docs/adr/0015-one-touch-one-flow.md)/W26):**

| Флоу | Шаг | Роль | Примечание |
|---|---|---|---|
| [`fn-sign-qr`](../flows/fn-sign-qr.md) | `step_1` (канонический `msg`) + `step_2` (HMAC) | **подпись** (каноническая копия) | вызывается через `callFlow` из `my-qr-api` |
| [`fn-verify-qr`](../flows/fn-verify-qr.md) | `step_1` (пересчёт) + `step_2` (сравнение) | проверка — **пересчитывает HMAC инлайн**, не зовёт `fn-sign-qr` | сознательное исключение из ADR-0015 п. 5 (латентность одного лишнего хопа на каждый скан); вызывается из `checkin-api` |

`checkin-api`/`my-qr-api` больше не содержат HMAC-код напрямую — оба вызывают
соответствующую функцию через `callFlow`. Дублирование теперь ровно одно
(между `fn-sign-qr` и `fn-verify-qr`), а не по одной копии на каждый
конечный флоу, как было до W26.

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

## Вариант с конвертом (`registration/step_13`, `step_72`)

Внесено 2026-09-13 по замечанию 2 ревью W21: обе копии были помечены в таблице
как «конверт», но самого преобразования файл не описывал — а это криптография,
и «конверт» без точного определения означает «сверить нельзя».

Отличий от текста выше ровно **два**:

1. `return {` в финальном возврате заменён на `const out = {`;
2. в конец добавлено:

```js
  // Форма ответа fn-sign-qr повторяется один в один: шаги
  // @aiqadam/qadam-telegram-bot ниже читают {{<шаг>['output'].data...}},
  // а они не редактируются (qadam-flow#411).
  return { status: 'success', data: out };
```

Больше расхождений нет — проверено ревью W21 по `sha256` после снятия обёртки.
Когда [#411](https://github.com/aiqadam/qadam-flow/issues/411) починят, конверт
уйдёт и обе копии станут побайтово равны канону.

## Что нельзя трогать

- **Формат `msg` — `'c:' + eventId + ':' + userId`.** Любое изменение
  обесценивает все уже выданные QR.
- **base64 → base64url и срез до 10 символов** — именно в этом порядке.
- `{{variables['QR_SIGNING_KEY']}}` только в длинной форме (см. выше).

## Как ловится дрейф

Подпись ставится в `fn-sign-qr` (зовёт `my-qr-api`), проверяется в
`fn-verify-qr` (зовёт `checkin-api`). Расхождение двух копий HMAC означает,
что **скан перестаёт проходить** — отказ громкий, а не тихий. Обязательный
тест при любой правке любой из двух копий: QR, выданный через `my-qr-api`,
обязан пройти чекин через `checkin-api`.

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

## Контрольное значение

Способ сверить две копии, не собирая сквозной прогон: подать обеим одну
пару `(eventId, userId)` и сравнить `sig` — они обязаны совпасть.
Контрольное значение `aIxmwbnzb_` для пары `(demo, 322876545)` лежит в
sample data `fn-verify-qr`; оно привязано к конкретному `QR_SIGNING_KEY`
и после ротации ключа не значит ничего — тогда остаётся сквозной сценарий
«выдали QR через `my-qr-api` → прошли чекин через `checkin-api`».
