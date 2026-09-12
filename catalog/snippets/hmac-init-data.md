# Эталон: проверка `initData` Telegram (HMAC-цепочка)

**Инвариант:** STF-2. `telegram_id` берётся **только** из проверенной `initData`.

**Цепочка из трёх шагов, и эталон нужен у всех трёх.** До 2026-09-13 этот файл
описывал только средний (HMAC) — самый короткий и наименее хрупкий. Разбор
`initData` и решение о валидности были **продублированы в двух флоу без канона**
(замечание 3 ревью W21): ослабление в одной копии — например, снятие проверки
свежести `auth_date` — не заметил бы никто, вторая копия продолжила бы работать.
Проверка `initData` — единственное, что стоит между посторонним и правом
отмечать участников (STF-2), поэтому дыра закрыта.

**Встраивают:**

| Шаг цепочки | Флоу и шаги | Сверено |
|---|---|---|
| 1. разбор `initData` | `checkin-api/step_34`, `my-qr-api/step_19` | 2026-09-13 |
| 2. HMAC | `checkin-api/step_35`, `my-qr-api/step_20` | 2026-09-13 |
| 3. проверка валидности | `checkin-api/step_36`, `my-qr-api/step_21` | 2026-09-13 |

Копии внутри каждой строки побайтово одинаковы между собой (проверено ревью W21
по `sha256`); шаг 2 сверен с текстом ниже, шаги 1 и 3 внесены в файл из живого
`checkin-api` 2026-09-13.

## Шаг 1 — разбор `initData`

Канонизация `data_check_string` — то место, где ошибка не видна на глаз:
поля сортируются по ключу, `hash` исключается, склейка через `\n`. Любое
отклонение даёт неверный дайджест, то есть «все контролёры отклонены»,
и это отказ в безопасную сторону — но есть и обратный: если сюда попадёт
`hash` из неотсортированного набора, проверка станет проходимой.

```js
export const code = async (inputs) => {
  const fail = (reason) => ({
    ok: false, reason: reason,
    // Заглушка, а не пустая строка: text у crypto qadam — обязательное поле.
    dataCheckString: 'x', hash: '', authDate: 0, telegramId: '', user: null, keys: []
  });

  const raw = inputs.initData;
  if (raw === undefined || raw === null) return fail('malformed');
  const s = String(raw).trim();
  if (s === '') return fail('malformed');
  if (s.length > 8192) return fail('too_long');

  const parts = s.split('&');
  const fields = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '') continue;
    const j = p.indexOf('=');
    if (j <= 0) return fail('malformed');
    let k, v;
    try {
      k = decodeURIComponent(p.slice(0, j).replace(/\+/g, ' '));
      v = decodeURIComponent(p.slice(j + 1).replace(/\+/g, ' '));
    } catch (e) {
      return fail('malformed');
    }
    fields[k] = v;
  }

  const hash = typeof fields.hash === 'string' ? fields.hash : '';
  if (!/^[0-9a-f]{64}$/.test(hash)) return fail('bad_hash_format');

  // data_check_string: все поля кроме hash, отсортированы по ключу, склеены '\n'
  const keys = Object.keys(fields).filter((k) => k !== 'hash').sort();
  if (keys.length === 0) return fail('malformed');
  const dataCheckString = keys.map((k) => k + '=' + fields[k]).join('\n');

  const authDateNum = Number(fields.auth_date);
  const authDate = isFinite(authDateNum) && authDateNum > 0 ? authDateNum : 0;

  let user = null;
  let telegramId = '';
  if (typeof fields.user === 'string' && fields.user !== '') {
    try { user = JSON.parse(fields.user); } catch (e) { user = null; }
    if (user && (typeof user.id === 'number' || typeof user.id === 'string')) telegramId = String(user.id);
  }

  return { ok: true, reason: '', dataCheckString: dataCheckString, hash: hash, authDate: authDate, telegramId: telegramId, user: user, keys: keys };
};
```

## Шаг 2 — HMAC

```js
export const code = async (inputs) => {
  const crypto = require('node:crypto');

  const dataCheckString = String(inputs.dataCheckString === undefined || inputs.dataCheckString === null ? '' : inputs.dataCheckString);
  const botToken = String(inputs.botToken === undefined || inputs.botToken === null ? '' : inputs.botToken);

  // Телеграмовская цепочка (ADR-0010): secretKey = HMAC-SHA256("WebAppData", botToken) — бинарный ключ,
  // не hex-строка. Раньше qadam гнал его через hex туда-обратно (secretKeyEncoding=hex) —
  // это было артефактом интерфейса qadam'а, а не частью алгоритма: hex-decode(hex-encode(x)) === x.
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString, 'utf8').digest('hex');

  return expected;
};
```

**Вход шага:**

```json
{"botToken": "{{variables['BOT_TOKEN']}}", "dataCheckString": "{{<шаг разбора>['output'].dataCheckString}}"}
```

## Шаг 3 — решение о валидности

Здесь живут две вещи, которые нельзя ослабить незаметно: **сравнение в
постоянном времени** и **потолок свежести**. Отдельно — правило «`telegramId`
и `user` отдаются ТОЛЬКО при `valid`»: пока они отдавались при `hashValid`,
просроченный на сутки `initData` всё равно нёс годный `telegramId`, и
вызывающему достаточно было посмотреть не туда, чтобы выдать авторизацию.

```js
export const code = async (inputs) => {
  const ctEq = (a, b) => {
    const x = String(a === undefined || a === null ? '' : a);
    const y = String(b === undefined || b === null ? '' : b);
    let diff = x.length ^ y.length;
    const n = x.length > y.length ? x.length : y.length;
    for (let i = 0; i < n; i++) {
      const cx = i < x.length ? x.charCodeAt(i) : 0;
      const cy = i < y.length ? y.charCodeAt(i) : 0;
      diff |= cx ^ cy;
    }
    return diff === 0;
  };

  // 24ч, SECURITY.md: сканер открыт весь вечер, а initData не обновляется сам.
  // Это одновременно и дефолт, и ПОТОЛОК: вызывающий может окно сузить, но не расширить.
  const MAX_AGE_CAP = 86400;
  const SKEW = 300;

  const parsedOk = inputs.parsedOk === true || inputs.parsedOk === 'true';
  const parseReason = String(inputs.reason === undefined || inputs.reason === null ? '' : inputs.reason);
  const expectedRaw = inputs.expected;
  const expected = typeof expectedRaw === 'string' ? expectedRaw : String(expectedRaw === undefined || expectedRaw === null ? '' : expectedRaw);
  const hash = String(inputs.hash === undefined || inputs.hash === null ? '' : inputs.hash);

  const authDateNum = Number(inputs.authDate);
  const authDate = isFinite(authDateNum) && authDateNum > 0 ? authDateNum : 0;

  let maxAge = Number(inputs.maxAgeSeconds);
  if (!isFinite(maxAge) || maxAge <= 0) maxAge = MAX_AGE_CAP;
  if (maxAge > MAX_AGE_CAP) maxAge = MAX_AGE_CAP;

  const nowSec = Math.floor(Date.now() / 1000);
  const ageSeconds = authDate > 0 ? nowSec - authDate : -1;

  const hashValid = parsedOk && /^[0-9a-f]{64}$/.test(expected) && ctEq(hash, expected);
  const fresh = authDate > 0 && ageSeconds <= maxAge && ageSeconds >= -SKEW;
  const valid = hashValid && fresh;

  const reason = valid ? '' : (!parsedOk ? (parseReason || 'malformed') : (!hashValid ? 'bad_hash' : 'expired'));

  return {
    valid: valid,
    hashValid: hashValid,
    fresh: fresh,
    reason: reason,
    // telegram_id и user отдаются ТОЛЬКО при valid (STF-2). Раньше отдавались при
    // hashValid, и просроченный на сутки initData всё равно нёс годный telegramId —
    // вызывающему достаточно было посмотреть не туда, чтобы получить авторизацию.
    telegramId: valid ? String(inputs.telegramId === undefined || inputs.telegramId === null ? '' : inputs.telegramId) : '',
    user: valid ? (inputs.user === undefined ? null : inputs.user) : null,
    authDate: authDate,
    authDateIso: authDate > 0 ? new Date(authDate * 1000).toISOString() : '',
    ageSeconds: ageSeconds,
    maxAgeSeconds: maxAge
  };
};
```


## Что нельзя трогать

- **Токен берётся из `{{variables['BOT_TOKEN']}}`, не из `{{connections[...]}}`**
  ([ADR-0008](../../docs/adr/0008-bot-token-as-variable-not-connection-template.md)).
  Шаблон connection'а отдаёт **не тот** токен, которым платформа авторизует
  вызовы Bot API, — на этом уже отклонялись все контролёры разом.
- **Короткая форма `{{VAR}}` даёт пустую строку молча**
  ([Q25](../../docs/OPEN-QUESTIONS.md#q25)). С пустым ключом подпись и проверка
  деградируют согласованно, все позитивные тесты проходят, а секрета нет.
  Только `{{variables['NAME']}}`.
- Сравнение результата — **constant-time**, в отдельном шаге.

## Как ловится дрейф

Проверка односторонняя: подписывает Telegram, проверяем мы. Расхождение копии
означает «этот флоу отклоняет всех» — отказ громкий, не тихий. Различающий
прогон: настоящая `initData` от живого клиента (её нельзя синтезировать,
см. [Q16](../../docs/OPEN-QUESTIONS.md#q16)).
