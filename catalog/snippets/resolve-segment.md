# Эталон: получатели рассылки по сегменту (OWN-9)

**Инвариант:** OWN-9, OWN-12, PAR-2, ADR-0003. Сегмент разворачивается в список
уникальных `telegram_id`; заблокировавшие бота исключаются; `no_show` закрыт
до `ends_at` ивента.

**Встраивают:**

| Флоу | Шаги | Сверено |
|---|---|---|
| — (пока никто) | — | — |

> Сохранён в W22 при удалении флоу `fn-resolve-segment` (`eJ41KArb4vGQYhWSMzUgh`).
> Логика была построена в W2, ни разу не вызвана: рассылки (W14) ещё не собраны.
> Флоу удалён по [ADR-0012](../../docs/adr/0012-end-to-end-flows-instead-of-subflow-functions.md)
> (subflow-функции больше не рабочая практика), а код перенесён сюда, потому что
> иначе он был бы потерян. **Тот, кто будет делать W14, встраивает его в тело
> флоу рассылки**, а не заводит subflow заново.

## Как встраивается

Шесть шагов. Четыре чтения намеренно **узкие**: полная выгрузка `users` тащила
бы в лог прогона телефоны и имена всех пользователей (DAT-2, [Q17](../../docs/OPEN-QUESTIONS.md#q17)).

1. **CODE «normalize segment»** — валидирует сегмент и `event_id`, ставит
   сентинел `-`;
2. **`tables-find-records events`** — `id eq queryEventId`;
3. **`tables-find-records registrations`** — `event_id eq queryEventId`;
4. **`tables-find-records users`** — `blocked_bot eq true` (только заблокированные);
5. **`tables-find-records users`** — `consent_marketing eq true`;
6. **CODE «build recipient list»** — пересечение, дедуп, исключение блокировок.

### Шаг 1 — normalize segment

```js
export const code = async (inputs) => {
  const SEGMENTS = ['all_consent', 'registered', 'attended', 'no_show'];
  const SLUG = /^[A-Za-z0-9_]{1,12}$/;
  const str = (v) => String(v === undefined || v === null ? '' : v).trim();

  const segment = str(inputs.segment);
  const eventId = str(inputs.eventId);

  const segmentOk = SEGMENTS.indexOf(segment) >= 0;
  const needsEvent = segment !== 'all_consent';
  const eventOk = SLUG.test(eventId);

  return {
    segment: segment,
    segmentOk: segmentOk,
    needsEvent: needsEvent,
    eventOk: eventOk,
    eventId: eventId,
    // Сентинел '-' вне алфавита slug'а: выборка гарантированно пуста,
    // чтобы пустой eventId не превратился в выборку всего.
    queryEventId: eventOk ? eventId : '-'
  };
};
```

### Шаг 6 — build recipient list

```js
export const code = async (inputs) => {
  const arr = (src) => Array.isArray(src) ? src : (src && Array.isArray(src.records) ? src.records : []);
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
  const ms = (t) => {
    const s = String(t === undefined || t === null ? '' : t).trim();
    if (s === '') return NaN;
    return Date.parse(/[Zz]$/.test(s) || /[+-][0-9]{2}:?[0-9]{2}$/.test(s) ? s : s + 'Z');
  };

  const segment = String(inputs.segment === undefined || inputs.segment === null ? '' : inputs.segment);
  const eventId = String(inputs.eventId === undefined || inputs.eventId === null ? '' : inputs.eventId);
  const segmentOk = inputs.segmentOk === true || inputs.segmentOk === 'true';
  const needsEvent = inputs.needsEvent === true || inputs.needsEvent === 'true';
  const eventOk = inputs.eventOk === true || inputs.eventOk === 'true';

  const base = { allowed: false, reason: '', segment: segment, eventId: eventId, count: 0, recipients: [], endsAt: '', opensAt: '', blockedExcluded: 0, blockedKnown: 0 };
  const deny = (reason, extra) => Object.assign({}, base, { reason: reason }, extra || {});

  if (!segmentOk) return deny('bad_segment');
  if (needsEvent && !eventOk) return deny('bad_event_id');

  // Две выборки вместо всей таблицы users: шагу нужны только «кто заблокирован»
  // и «кто дал согласие». Полная выгрузка тащила в лог прогона phone и имена
  // всех пользователей (DAT-2).
  //
  // ДОПУЩЕНИЕ, а не равенство множеств (OWN-12): список блокировок теперь даёт
  // платформенный фильтр `blocked_bot eq true`, а не перебор всей таблицы. Промах
  // этого фильтра — отказ в ОПАСНУЮ сторону: заблокировавший бот попадёт в рассылку.
  // У consent_marketing наоборот: там фильтр только сужает, а проверка === 'true'
  // ниже остаётся вторым рубежом, поэтому промах дал бы «никому не слать».
  // Поэтому наружу отдаётся blockedKnown — сколько блокировок вообще увидели.
  // Пустой blockedKnown при непустом сегменте — повод не рассылать, а разобраться.
  const blocked = {};
  let blockedKnown = 0;
  arr(inputs.blockedUsers).map(flat).forEach((u) => {
    const id = u.telegram_id || '';
    if (id !== '' && (u.blocked_bot || '') === 'true') { blocked[id] = true; blockedKnown++; }
  });

  let endsAt = '';
  if (needsEvent) {
    const events = arr(inputs.events).map(flat);
    const ev = events.filter((e) => (e.id || '') === eventId)[0];
    if (!ev) return deny('event_not_found');
    endsAt = ev.ends_at || '';
  }

  // OWN-9: no_show закрыт, пока ивент не закончился — до ends_at это
  // "ещё не дошёл", а не "не пришёл".
  if (segment === 'no_show') {
    const endMs = ms(endsAt);
    if (!isFinite(endMs)) return deny('no_ends_at', { endsAt: endsAt });
    if (Date.now() < endMs) return deny('too_early', { endsAt: endsAt, opensAt: new Date(endMs).toISOString() });
  }

  let candidates = [];
  if (segment === 'all_consent') {
    candidates = arr(inputs.consentUsers).map(flat)
      .filter((u) => (u.consent_marketing || '') === 'true')
      .map((u) => u.telegram_id || '')
      .filter((id) => id !== '');
  } else {
    const regs = arr(inputs.registrations).map(flat).filter((r) => (r.event_id || '') === eventId);
    let picked = [];
    if (segment === 'registered') picked = regs.filter((r) => (r.status || '') === 'registered');
    else if (segment === 'attended') picked = regs.filter((r) => (r.checked_in_at || '') !== '');
    else if (segment === 'no_show') picked = regs.filter((r) => (r.status || '') === 'registered' && (r.checked_in_at || '') === '');
    candidates = picked.map((r) => r.telegram_id || '').filter((id) => id !== '');
  }

  // Уникальные telegram_id, а не строки: задвоенный участник — один человек (ADR-0003).
  const seen = {};
  const unique = [];
  candidates.forEach((id) => { if (!seen[id]) { seen[id] = true; unique.push(id); } });

  const recipients = unique.filter((id) => blocked[id] !== true);

  return {
    allowed: true,
    reason: '',
    segment: segment,
    eventId: eventId,
    count: recipients.length,
    recipients: recipients,
    endsAt: endsAt,
    opensAt: '',
    blockedExcluded: unique.length - recipients.length,
    blockedKnown: blockedKnown
  };
};
```

## Ловушки

- `Date.now()` внутри Code step **работает** (это не workflow-скрипт), но делает
  шаг недетерминированным: тот же вход до и после `ends_at` даёт разный ответ.
  Это осознанно — окно `no_show` привязано ко времени.
- `blockedKnown = 0` при непустом сегменте — сигнал, что фильтр блокировок
  промахнулся. Отказ здесь опасный (лишние получатели), поэтому число
  отдаётся наружу и должно проверяться вызывающим.
