# Эталон: разбор `start`-payload

**Инвариант:** `sig` — **последние 10 символов**, а не `split('-')[2]`
([SECURITY.md](../../docs/SECURITY.md#ловушка-парсинга)). base64url содержит
дефис, поэтому наивный разбор ломается на части подписей — и ломается
выборочно, что хуже, чем всегда.

**Встраивают:**

| Флоу | Шаг | Сверено |
|---|---|---|
| `fn-parse-start` (`KmUrHSoKEPDo02J8mKAn6`) | `step_1` | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_2` | 2026-09-12, побайтово |
| `tg-router` (`Y1dNon2V2EhjWM0aYwdQi`) | `step_15` | 2026-09-12, **в конверте** |

## Код

```js
export const code = async (inputs) => {
  const SLUG = /^[A-Za-z0-9_]{1,12}$/;
  const UTM = /^[A-Za-z0-9_]{1,32}$/;
  const USER = /^[0-9]{1,16}$/;
  const TOKEN = /^[A-Za-z0-9]{22}$/;
  const SIG = /^[A-Za-z0-9_-]{10}$/;
  const ALPHABET = /^[A-Za-z0-9_-]+$/;

  const base = { valid: false, kind: '', error: '', eventId: '', userId: '', utm: '', token: '', sig: '', start: '' };
  const fail = (error, start) => Object.assign({}, base, { error: error, start: start || '' });

  const raw = inputs.start;
  if (raw === undefined || raw === null) return fail('empty', '');
  const s = String(raw);
  if (s.length === 0) return fail('empty', '');
  if (s.length > 64) return fail('too_long', '');
  if (!ALPHABET.test(s)) return fail('bad_charset', '');

  const kind = s.charAt(0);
  const rest = s.slice(1);

  if (kind === 'e') {
    const i = rest.indexOf('-');
    const eventId = i < 0 ? rest : rest.slice(0, i);
    const utm = i < 0 ? '' : rest.slice(i + 1);
    if (!SLUG.test(eventId)) return fail('bad_event_id', s);
    if (utm !== '' && !UTM.test(utm)) return fail('bad_utm', s);
    return Object.assign({}, base, { valid: true, kind: 'e', eventId: eventId, utm: utm, start: s });
  }

  if (kind === 'c') {
    // sig -- ALWAYS the last 10 chars: base64url includes '-', split('-') is wrong here
    if (rest.length < 14) return fail('bad_qr_payload', s);
    if (rest.charAt(rest.length - 11) !== '-') return fail('bad_qr_payload', s);
    const sig = rest.slice(rest.length - 10);
    const body = rest.slice(0, rest.length - 11);
    const i = body.indexOf('-');
    if (i <= 0) return fail('bad_qr_payload', s);
    const eventId = body.slice(0, i);
    const userId = body.slice(i + 1);
    if (!SLUG.test(eventId)) return fail('bad_event_id', s);
    if (!USER.test(userId)) return fail('bad_user_id', s);
    if (!SIG.test(sig)) return fail('bad_sig', s);
    return Object.assign({}, base, { valid: true, kind: 'c', eventId: eventId, userId: userId, sig: sig, start: s });
  }

  if (kind === 's') {
    const i = rest.indexOf('-');
    if (i <= 0) return fail('bad_invite_payload', s);
    const eventId = rest.slice(0, i);
    const token = rest.slice(i + 1);
    if (!SLUG.test(eventId)) return fail('bad_event_id', s);
    if (!TOKEN.test(token)) return fail('bad_token', s);
    return Object.assign({}, base, { valid: true, kind: 's', eventId: eventId, token: token, start: s });
  }

  return fail('unknown_kind', s);
};
```

## Что нельзя трогать

- Ограничение длины 64 и алфавит `[A-Za-z0-9_-]` — это первый барьер
  перед всем остальным.
- Разбор `c`-payload с конца, а не с начала.
- `kind` берётся первым символом: `e` — регистрация, `c` — чекин,
  `s` — инвайт staff.

## Почему здесь полный текст, а не выдержка

Первая редакция этого файла приводила «ключевые места». Побайтовая сверка
(правило 1 в [README](README.md)) по выдержке невозможна: расхождение в
любой из неупомянутых строк проходит проверку. Заменено на полный текст
при первом же появлении второй копии (W21, `checkin-api/step_2`).
