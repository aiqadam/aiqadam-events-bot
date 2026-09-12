# Эталон: разрешение строки i18n из таблицы `strings`

**Инвариант:** I18N-2. Ни одной пользовательской строки литералом — только ключи.

**Встраивают:**

| Флоу | Шаг | Ключи | Сверено |
|---|---|---|---|
| `fn-t` (`f8ZRXjQ2Ndk88lMlMOv1i`) | `step_3` | из входа | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_9` | `checkin.ok`, `checkin.name_unknown` | 2026-09-12 |
| `checkin-api` | `step_10` | `checkin.already` | 2026-09-12 |
| `checkin-api` | `step_43` | `checkin.wrong_event`, `checkin.invalid`, `checkin.not_registered` | 2026-09-12 |
| `checkin-api` | `step_44` | `checkin.forbidden` | 2026-09-12 |
| `checkin-api` | `step_46` | `checkin.unauthorized` (`lang: ru`) | 2026-09-12 |
| `my-qr-api` (`I5nd8ggKH4wkQLaww9Dkl`) | `step_25` | `checkin.not_registered` | 2026-09-12 |
| `my-qr-api` | `step_27` | `checkin.unauthorized` (`lang: ru`) | 2026-09-12 |
| `registration` (`vfVfIngczCKA2DpUgcevP`) | `step_11` | отказ (ключ из `step_9`), конверт | 2026-09-12 |
| `registration` | `step_14` | `reg.already`, конверт | 2026-09-12 |
| `registration` | `step_17` | QR invite (existing), конверт | 2026-09-12 |
| `registration` | `step_23` | `reg.venue.hint`, конверт | 2026-09-12 |
| `registration` | `step_31` | согласие на ПД, конверт | 2026-09-12 |
| `registration` | `step_43` | `reg.done` + рассылка, конверт | 2026-09-12 |
| `registration` | `step_49` | `reg.consent_pdn.declined`, конверт | 2026-09-12 |
| `registration` | `step_57` | `…saved_yes`, конверт | 2026-09-12 |
| `registration` | `step_59` | `…saved_no`, конверт | 2026-09-12 |
| `registration` | `step_62` | `reg.phone.ask` + share, конверт | 2026-09-12 |
| `registration` | `step_68` | `reg.phone.saved`, конверт | 2026-09-12 |
| `registration` | `step_70` | `reg.phone.skipped`, конверт | 2026-09-12 |
| `registration` | `step_74` | QR invite (finalize), конверт | 2026-09-12 |
| `registration` | `step_99` | карточка ивента, **без конверта** | 2026-09-12 |

## Как встраивается

Два шага, а не один:

1. **`tables-find-records` по `strings`** — фильтр `key in (<список через запятую>)`,
   `table_id = qi6bBTL7plRGBgFUfli8w`, поле `key` — externalId `xpNgdNnrNy0iftelqDjeN`.
2. **CODE-шаг ниже** — собственно эталон.

**Список ключей статический**, потому что вызывающий знает его на этапе сборки.
Отсюда два отличия от `fn-t`:

- **нормализация ключей не нужна** — вместе с ней не нужен и сентинел `!no-key`
  (он существовал только чтобы пустой рантайм-список не валил фильтр `in`);
- **`limit` не задаётся**. У `fn-t` стоял `limit 200`, и переполнение обрезало бы
  выборку **молча**, отправив лишние ключи на экран сырыми. Здесь число строк
  ограничено самим списком: `<число ключей> × 3 языка`.

**Одно чтение на несколько веток дешевле, чем по чтению на ветку.** Если ключи
нужны нескольким терминальным веткам одного ROUTER'а, читается объединение ключей
**до** ветвления, а ветки лишь разрешают язык из готовой выборки. Исключение —
ветки, исполняющиеся до того, как известен пользователь (а значит и язык):
им нужно своё чтение с фиксированным языком.

## Код

```js
export const code = async (inputs) => {
  const FALLBACK = 'ru';
  const lang = String(inputs.lang === undefined || inputs.lang === null ? '' : inputs.lang) || FALLBACK;

  const keys = Array.isArray(inputs.keys) ? inputs.keys.map((k) => String(k)) : [];

  const src = inputs.records;
  const list = Array.isArray(src) ? src : (src && Array.isArray(src.records) ? src.records : []);

  const flat = (rec) => {
    const out = {};
    const cells = (rec && rec.cells) || {};
    Object.keys(cells).forEach((fid) => {
      const c = cells[fid];
      if (c && typeof c === 'object' && typeof c.fieldName === 'string') {
        out[c.fieldName] = c.value === undefined || c.value === null ? '' : String(c.value);
      }
    });
    return out;
  };

  // Дубли (key, lang) БД не запрещает (ADR-0003): берём первую непустую.
  const byKey = {};
  list.forEach((rec) => {
    const r = flat(rec);
    const k = r.key || '';
    const l = r.lang || '';
    const v = r.value || '';
    if (k === '' || l === '' || v === '') return;
    if (!byKey[k]) byKey[k] = {};
    if (byKey[k][l] === undefined) byKey[k][l] = v;
  });

  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const vars = obj(inputs.vars);
  const varsByKey = obj(inputs.varsByKey);

  // Подстановки для конкретного ключа перекрывают общие: одно и то же имя ({when})
  // в разных ключах карточки ивента означает разное время.
  const substFor = (key, tpl) => {
    const local = obj(varsByKey[key]);
    return String(tpl).replace(/\{([A-Za-z0-9_.]+)\}/g, (m, name) => {
      const v = local[name] !== undefined && local[name] !== null ? local[name] : vars[name];
      // Неизвестная подстановка остаётся видной, а не стирается в пустоту.
      if (v === undefined || v === null) return m;
      return String(v);
    });
  };

  const texts = {};
  const resolvedLang = {};
  const missing = [];
  const fellBack = [];

  keys.forEach((k) => {
    const row = byKey[k] || {};
    let raw = row[lang];
    let used = lang;
    if (raw === undefined) { raw = row[FALLBACK]; used = FALLBACK; }
    if (raw === undefined) {
      // Сырой ключ на экране заметен, пустой экран — нет (I18N.md).
      texts[k] = k;
      resolvedLang[k] = '';
      missing.push(k);
      return;
    }
    if (used !== lang) fellBack.push(k);
    texts[k] = substFor(k, raw);
    resolvedLang[k] = used;
  });

  const firstKey = keys.length > 0 ? keys[0] : '';

  return {
    lang: lang,
    text: firstKey === '' ? '' : texts[firstKey],
    texts: texts,
    resolvedLang: resolvedLang,
    missing: missing,
    fellBack: fellBack,
    keys: keys
  };
};
```

**Вход шага:**

```json
{"keys": ["<ключ>", "…"], "lang": "{{<шаг>['output'].lang}}", "records": "{{<шаг чтения strings>['output']}}"}
```

Необязательные `vars` и `varsByKey` — подстановки `{name}`; `varsByKey`
перекрывает `vars` для конкретного ключа.

## Что нельзя трогать

- **Порядок разрешения**: `(key, lang)` → `(key, 'ru')` → **сам ключ как текст**.
  Последнее звено не косметика: сырой ключ на экране заметен, пустой экран — нет.
- **`varsByKey` перекрывает `vars`.** Реальный набор строк W3 использует одно имя
  `{when}` в `event.card.when`, `event.card.ends` и `event.card.deadline` с разным
  значением — общими `vars` их не различить.
- **Неизвестная подстановка возвращается как есть** (`{foo}`), а не стирается.
- **Ключ не может содержать запятую** — запятая разделяет значения фильтра `in`.

## Как ловится дрейф

Тихо. Расхождение копии даёт неправильный **текст**, а не отказ, и ни один
прогон этого не заметит. Единственная защита — побайтовая сверка копий
(правило 1 в [README](README.md)) и проверка, что список выше полон.

## Вариант с конвертом (`registration`)

Шаги `@aiqadam/qadam-telegram-bot` **не редактируются**
([qadam-flow#411](https://github.com/aiqadam/qadam-flow/issues/411)), а их ссылки
написаны на `{{<шаг>['output'].data.text}}` — форму ответа `callFlow`. Поэтому в
`registration` копии возвращают не сам объект, а конверт:

```js
  // Форма ответа fn-t повторяется один в один: шаги @aiqadam/qadam-telegram-bot
  // ниже не редактируются (qadam-flow#411), а их ссылки написаны на
  // {{<шаг>['output'].data...}}. Конверт уйдёт, когда апстрим починит #411.
  return { status: 'success', data: out };
```

Всё остальное тело — побайтово тот же эталон; отличается **только** последний
`return`. Отсюда два следствия:

1. **Замена обязана встать под именем удалённого шага.** Платформа выдаёт
   свободное имя с наименьшим номером, поэтому порядок такой: сначала добавить
   вспомогательный шаг чтения `strings` (он съедает «старое» свободное имя),
   потом удалить `callFlow`, потом добавить CODE — он получит освободившееся имя.
2. **Это костыль, а не решение.** Когда #411 починят, конверт снимается,
   а ссылки в шагах отправки правятся на `['output'].text`.
