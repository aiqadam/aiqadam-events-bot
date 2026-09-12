# Эталон: разбор `start`-payload

**Инвариант:** `sig` — **последние 10 символов**, а не `split('-')[2]`
([SECURITY.md](../../docs/SECURITY.md#ловушка-парсинга)). base64url содержит
дефис, поэтому наивный разбор ломается на части подписей — и ломается
выборочно, что хуже, чем всегда.

**Встраивают:** (заполняется по мере перевода в W21)

| Флоу | Шаг | Сверено |
|---|---|---|
| `fn-parse-start` (`KmUrHSoKEPDo02J8mKAn6`) | `step_1` | эталон-источник |

## Код

Полный текст — `ap_read_step_code` по `fn-parse-start` / `step_1`.
Ключевые места, которые обязаны сохраниться при встраивании:

```js
const SLUG = /^[A-Za-z0-9_]{1,12}$/;
const UTM  = /^[A-Za-z0-9_]{1,32}$/;
const USER = /^[0-9]{1,16}$/;
const TOKEN = /^[A-Za-z0-9]{22}$/;
const SIG  = /^[A-Za-z0-9_-]{10}$/;
const ALPHABET = /^[A-Za-z0-9_-]+$/;

if (s.length > 64) return fail('too_long', '');
if (!ALPHABET.test(s)) return fail('bad_charset', '');

// kind === 'c': sig — ВСЕГДА последние 10 символов
if (rest.length < 14) return fail('bad_qr_payload', s);
if (rest.charAt(rest.length - 11) !== '-') return fail('bad_qr_payload', s);
const sig = rest.slice(rest.length - 10);
const body = rest.slice(0, rest.length - 11);
```

## Что нельзя трогать

- Ограничение длины 64 и алфавит `[A-Za-z0-9_-]` — это первый барьер
  перед всем остальным.
- Разбор `c`-payload с конца, а не с начала.
- `kind` берётся первым символом: `e` — регистрация, `c` — чекин,
  `s` — инвайт staff.
