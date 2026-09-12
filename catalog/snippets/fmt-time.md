# Эталон: показ времени в `Asia/Tashkent`

**Инвариант:** OWN-3. Хранение — UTC, показ — `Asia/Tashkent`.

**Встраивают:**

| Флоу | Шаг | Режим | Сверено |
|---|---|---|---|
| `fn-fmt-time` (`5Hctxr9SnbhxGxow0Xgxu`) | `step_1` | одиночный + батч | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_47` | одиночный, `format: time` | 2026-09-12 |
| `registration` (`vfVfIngczCKA2DpUgcevP`) | `step_38` | одиночный, дедлайн отказа | 2026-09-12 |
| `registration` | `step_97` | батч: starts/ends/deadline карточки | 2026-09-12 |

## Код

```js
export const code = async (inputs) => {
  const TZ = 'Asia/Tashkent';
  const LOCALES = { ru: 'ru-RU', uz: 'uz-UZ', en: 'en-US' };

  const asked = String(inputs.lang === undefined || inputs.lang === null ? '' : inputs.lang).trim();
  const lang = LOCALES[asked] ? asked : 'ru';
  const locale = LOCALES[lang];

  // Форматтеры строятся один раз на вызов, а не на каждое значение:
  // в батч-режиме их переиспользуют все элементы.
  const dateFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const bothFmt = new Intl.DateTimeFormat(locale, { timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const blank = { valid: false, error: '', text: '', date: '', time: '', datetime: '', iso: '', epochMs: 0, tz: TZ, lang: lang };
  const fail = (error) => Object.assign({}, blank, { error: error });

  const one = (rawIso, rawFormat) => {
    if (rawIso === undefined || rawIso === null) return fail('empty');
    let s = String(rawIso).trim();
    if (s === '') return fail('empty');

    // Tables отдаёт DATE строкой и не гарантирует суффикс зоны.
    // Без зоны строка трактуется как локальное время песочницы (UTC) — фиксируем явно.
    if (!/[Zz]$/.test(s) && !/[+-][0-9]{2}:?[0-9]{2}$/.test(s)) s = s + 'Z';

    const d = new Date(s);
    if (isNaN(d.getTime())) return fail('bad_date');

    const date = dateFmt.format(d);
    const time = timeFmt.format(d);
    const datetime = bothFmt.format(d);
    const fmt = String(rawFormat === undefined || rawFormat === null ? '' : rawFormat).trim();
    const text = fmt === 'date' ? date : (fmt === 'time' ? time : datetime);

    return { valid: true, error: '', text: text, date: date, time: time, datetime: datetime, iso: d.toISOString(), epochMs: d.getTime(), tz: TZ, lang: lang };
  };

  // Батч-режим (ADR-0009/Q28): один вызов subflow вместо N.
  // Вызов callFlow стоит ~1,2-1,9 с даже inline, а тело — миллисекунды,
  // поэтому три значения одним вызовом дешевле трёх вызовов втрое.
  // Ключи карты выбирает вызывающий; порядок не важен, индексов нет.
  const src = inputs.items;
  const isMap = src && typeof src === 'object' && !Array.isArray(src);
  if (isMap) {
    const texts = {};
    const results = {};
    const invalid = [];
    Object.keys(src).forEach((k) => {
      const it = src[k];
      const r = (it && typeof it === 'object' && !Array.isArray(it))
        ? one(it.iso, it.format)
        : one(it, '');
      results[k] = r;
      texts[k] = r.text;
      if (!r.valid) invalid.push(k);
    });
    return { batch: true, lang: lang, tz: TZ, texts: texts, results: results, invalid: invalid,
             valid: invalid.length === 0, error: '', text: '', date: '', time: '', datetime: '', iso: '', epochMs: 0 };
  }

  // Одиночный режим — прежний контракт, без изменений.
  return Object.assign({ batch: false, texts: {}, results: {}, invalid: [] }, one(inputs.iso, inputs.format));
};
```

**Вход шага (одиночный режим):**

```json
{"iso": "{{<шаг>['output'].<поле>}}", "lang": "{{<шаг>['output'].lang}}", "format": "time"}
```

`format`: `date` / `time` / иное (= дата и время). Батч-режим — вместо `iso`
передаётся карта `items`, результат в `texts[<ключ>]`.

**Комментарий про батч-режим оставлен дословно**, хотя во встроенной копии
`callFlow` уже нет: он объясняет, почему у функции два режима. Правило 1
требует побайтового совпадения — расхождение ради «актуальности комментария»
ломает механическую сверку ради ничего.

## Что нельзя трогать

- **Ручного смещения UTC+5 нет и не должно появиться.** В песочнице полный ICU;
  `Asia/Tashkent` и `uz-UZ` работают. Смещение руками переживёт ровно до первой
  смены правил зоны.
- **Строка без суффикса зоны дополняется `Z`.** Tables отдаёт `DATE` строкой и
  зону не гарантирует; без этого значение молча уедет на несколько часов.
- **`hourCycle: 'h23'`** — иначе `ru-RU` и `en-US` разойдутся в формате часов.

## Как ловится дрейф

Тихо, как и у i18n: расхождение даёт неверное **время** на экране, а не отказ.
Различающий признак, который стоит помнить при ревью: `14:41Z` обязан
показываться как `19:41`.
