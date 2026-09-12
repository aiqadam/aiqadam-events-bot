# Эталон: поиск регистрации участника (каноническая строка)

**Инвариант:** IDM-1, ADR-0003. Уникальности `(event_id, telegram_id)` в БД нет —
дубли схлопываются **при чтении**, детерминированно.

**Встраивают:**

| Флоу | Шаги (нормализация → чтение → выбор) | Сверено |
|---|---|---|
| `fn-find-registration` (`OkjryrJdcdZQNAWYamZgr`) | `step_1` → `step_2` → `step_3` | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_40` → `step_41` → `step_42` | 2026-09-12 |
| `checkin-api` | — → `step_19` → `step_29` (перечитывание после CAS, W20) | 2026-09-12 |
| `my-qr-api` (`I5nd8ggKH4wkQLaww9Dkl`) | `step_2` → `step_22` → `step_23` | 2026-09-12 |
| `registration` (`vfVfIngczCKA2DpUgcevP`) | `step_77` → `step_78` → `step_79` (ветка `start`) | 2026-09-12 |
| `registration` | `step_4` → `step_80` → `step_81` (ветка `pdn_yes`) | 2026-09-12 |

Все одиннадцать шагов сверены ревьюером W21 механически — расхождений нет.

## Как встраивается

Три шага, и ни один нельзя пропустить:

1. **CODE «normalize registration keys»** — валидирует форму и подставляет
   сентинел `-` вместо пустых значений;
2. **`tables-find-records registrations`** — два `eq`, `table_id = PNuChoFG0tIBTND86yzDL`,
   поля `event_id` (`6mRpFdqphYL2PtfQwBFEr`) и `telegram_id` (`kfw8Et1Msb0Qiki6GMs9b`);
3. **CODE «pick earliest registration»** — сортировка и выбор канонической строки.

### Шаг 1 — normalize

```js
export const code = async (inputs) => {
  const SLUG = /^[A-Za-z0-9_]{1,12}$/;
  const USER = /^[0-9]{1,16}$/;
  const str = (v) => String(v === undefined || v === null ? '' : v).trim();

  const eventId = str(inputs.eventId);
  const telegramId = str(inputs.telegramId);
  const inputOk = SLUG.test(eventId) && USER.test(telegramId);

  // Пустой фильтр — это выборка чужих регистраций. Сентинел '-' вне
  // алфавита slug'а и telegram_id, поэтому гарантированно не совпадёт ни с чем.
  return {
    inputOk: inputOk,
    eventId: eventId,
    telegramId: telegramId,
    queryEventId: inputOk ? eventId : '-',
    queryTelegramId: inputOk ? telegramId : '-'
  };
};
```

### Шаг 3 — pick earliest

```js
export const code = async (inputs) => {
  const inputOk = inputs.inputOk === true || inputs.inputOk === 'true';
  const src = inputs.records;
  const list = Array.isArray(src) ? src : (src && Array.isArray(src.records) ? src.records : (src && Array.isArray(src.items) ? src.items : []));

  const empty = {
    found: false, inputOk: inputOk, duplicates: 0, recordId: '', recordIds: [],
    registration: null, checkedIn: false, checkedInAt: '', cancelled: false, registered: false,
    statuses: [], anyRegistered: false, anyCancelled: false,
    eventId: String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId),
    telegramId: String(inputs.telegramId === undefined || inputs.telegramId === null ? '' : inputs.telegramId)
  };
  if (!inputOk || list.length === 0) return empty;

  // cells ключуются внутренним id поля, но каждая ячейка несёт fieldName —
  // собираем плоский объект по именам, чтобы не зашивать id в код.
  const flat = (rec) => {
    const out = { __recordId: String(rec && rec.id ? rec.id : ''), __created: String(rec && rec.created ? rec.created : '') };
    const cells = (rec && rec.cells) || {};
    Object.keys(cells).forEach((fid) => {
      const c = cells[fid];
      if (c && typeof c === 'object' && typeof c.fieldName === 'string') {
        out[c.fieldName] = c.value === undefined || c.value === null ? '' : String(c.value);
      }
    });
    return out;
  };

  const rows = list.map(flat);

  const sortKey = (r) => {
    const t = r.registered_at || r.__created || '';
    const ms = t === '' ? Number.POSITIVE_INFINITY : Date.parse(/[Zz]$/.test(t) || /[+-][0-9]{2}:?[0-9]{2}$/.test(t) ? t : t + 'Z');
    return isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };

  rows.sort((a, b) => {
    const d = sortKey(a) - sortKey(b);
    if (d !== 0) return d;
    const c = String(a.__created).localeCompare(String(b.__created));
    if (c !== 0) return c;
    return String(a.__recordId).localeCompare(String(b.__recordId));
  });

  const first = rows[0];

  // IDM-2: при нескольких чекинах показываем самый ранний, а не последний
  let checkedInAt = '';
  let checkedInMs = Number.POSITIVE_INFINITY;
  let checkedInBy = '';
  rows.forEach((r) => {
    const t = r.checked_in_at || '';
    if (t === '') return;
    const ms = Date.parse(/[Zz]$/.test(t) || /[+-][0-9]{2}:?[0-9]{2}$/.test(t) ? t : t + 'Z');
    if (isFinite(ms) && ms < checkedInMs) { checkedInMs = ms; checkedInAt = t; checkedInBy = r.checked_in_by || ''; }
  });

  // Правило агрегации статуса названо явно: канонической считается САМАЯ РАННЯЯ
  // строка — её же обновляет запись (IDM-1), поэтому её статус и есть статус пары.
  // Но дубль мог лечь позже с другим статусом, а от статуса зависит, слать ли
  // подтверждение. Поэтому наружу отдаются и статусы всех строк: вызывающий,
  // которому нужна осторожность, смотрит на anyRegistered/anyCancelled.
  const statuses = rows.map((r) => r.status || '');
  const anyRegistered = statuses.indexOf('registered') >= 0;
  const anyCancelled = statuses.indexOf('cancelled') >= 0;

  const registration = {
    id: first.id || '',
    event_id: first.event_id || '',
    telegram_id: first.telegram_id || '',
    status: first.status || '',
    source: first.source || '',
    registered_at: first.registered_at || '',
    cancelled_at: first.cancelled_at || '',
    checked_in_at: checkedInAt,
    checked_in_by: checkedInBy
  };

  return {
    found: true,
    inputOk: true,
    duplicates: rows.length,
    recordId: first.__recordId,
    recordIds: rows.map((r) => r.__recordId),
    registration: registration,
    checkedIn: checkedInAt !== '',
    checkedInAt: checkedInAt,
    cancelled: (first.status || '') === 'cancelled',
    registered: (first.status || '') === 'registered',
    statuses: statuses,
    anyRegistered: anyRegistered,
    anyCancelled: anyCancelled,
    eventId: String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId),
    telegramId: String(inputs.telegramId === undefined || inputs.telegramId === null ? '' : inputs.telegramId)
  };
};
```

Все девять копий сверены ревьюером по sha256 — совпадают побайтово.

## Что нельзя трогать

- **Сентинел `-` вместо пустого фильтра.** Пустой фильтр — это выборка **чужих**
  регистраций. `-` вне алфавита slug'а и `telegram_id`, поэтому не совпадёт ни с чем.
- **`limit` не задаётся — это часть инварианта, а не небрежность.** С лимитом
  выборка обрежется молча, и каноническая строка может в неё не попасть.
- **Каноническая — САМАЯ РАННЯЯ** по `registered_at`, при равенстве — по `created`,
  затем по `id`. Её же обновляет запись, поэтому её статус и есть статус пары.
- **`checkedInAt` — самый ранний непустой из всех дублей** (IDM-2): повторный
  чекин обязан показать исходное время, а не последнее.
- **Наружу отдаются `anyRegistered`/`anyCancelled`** — вызывающему, которому
  нужна осторожность, мало статуса одной строки.

## Как ловится дрейф

Тихо. Расхождение даёт неверный **исход** (например, «нет регистрации» у
зарегистрированного) при зелёном прогоне. Защита — побайтовая сверка
и различающий прогон на паре с дублями.
