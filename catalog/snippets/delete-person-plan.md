# Эталон: delete-person-plan

**Инвариант:** удаляются и обезличиваются только строки, где проверенное поле действительно равно
`telegram_id` человека; любая строка с другим значением валит прогон до первой записи. Пустая таблица —
не шаг, а отсутствие пункта в списке ([ADR-0059](../../docs/adr/0059-id-switch-prep-deletion-and-delivery-state.md) §1)

**Встраивают:** `fn-delete-person` шаг `plan`

## Что делает

**Входы**

- `telegram_id` — проверенный шагом `input` id (`^[1-9][0-9]{0,15}$`); иначе `bad_telegram_id`.
- `refuse_if_author` — `true` у самоудаления в боте (`reg-api`): автору событий не удаляется ничего
  (ADR-0059 §4). У приёмника ID — `false`: удаляется всё, кроме событий.
- Выходы `tables-find-records` (массив или `{records}`), у каждой записи `id` и `cells` с `fieldName`:
  - `author` — `events` по `staff_id`;
  - `own` — объект `{<имя таблицы>: выход}` для своих строк по `telegram_id`: `registrations`,
    `feedback`, `broadcast_targets`, `sessions`, `quiz_answers`, `quiz_attempts`, `reports`,
    `event_staff`, `staff`, `bot_contacts`, `users`;
  - `actor` — объект `{<таблица>.<поле>: выход}` для чужих строк: `registrations.checked_in_by`,
    `event_staff.granted_by`, `staff_invites.created_by`, `staff_invites.used_by`,
    `broadcasts.created_by`.

**Выход**

- `author` — `true`, если есть хоть одна строка `events` с этим `staff_id`. События не трогаются.
- `refused` — `true`, если `author` и `refuse_if_author`: списки `deletes`, `clears`, `rm_events` пустые.
- `deletes` — `[{table, ids}]`, только для таблиц с найденными строками; `table` — externalId.
- `clears` — `[{table, column, id}]`, по одной записи на строку и поле; `table` и `column` — externalId.
- `rm_events` — `event_id` своих регистраций, без повторов. По ним шаг цикла удаляет Store-ключи
  `rm:<event_id>:24h:<id>` и `rm:<event_id>:2h:<id>`. В списке нет `telegram_id`: вывод цикла (`item`)
  пишется в лог, а ключ собирается внутри шага с выключенным логом.
- `counts` — только числа: строк на удаление и очистку по каждому имени.

**Отказы (throw)** — `bad_telegram_id`, `bad_input:<имя>` (вход не массив и не `{records}`),
`mismatch:<имя>` (поле строки не равно id), `no_record_id:<имя>`.

## Код

```js
// delete-person-plan (ADR-0059 §1). logInput/logOutput OFF: id и строки людей.
export const code = async (inputs) => {
  const tid = inputs.telegram_id;
  if (typeof tid !== 'string' || !/^[1-9][0-9]{0,15}$/.test(tid)) throw new Error('bad_telegram_id');
  const OWN = {
    registrations: ['SM8tMxfQuQCHRDdAiNJyQ', 'telegram_id'], feedback: ['GgGUQEHp6g076nDb2XddP', 'telegram_id'],
    broadcast_targets: ['PAH81WchbaOixGXSdFBK1', 'telegram_id'], sessions: ['toTKgngMTqDNJWDpQMh4d', 'telegram_id'],
    quiz_answers: ['tcwKTQH8W1EG4SHeHdoRr', 'telegram_id'], quiz_attempts: ['JPo7yK4N9lxN8HxBwpmRs', 'telegram_id'],
    reports: ['LKEqlq1X7RuWz5WC4zkov', 'telegram_id'], event_staff: ['t1g8Vae3iEoDk93D6Rle7', 'telegram_id'],
    staff: ['PnDy6gw9tlLUqTGk2EOUn', 'telegram_id'], bot_contacts: ['JLPfHt5KW4PpanBBWX4V6', 'telegram_id'],
    users: ['xHhYjhwqKdONkrYJGcBsz', 'telegram_id'],
  };
  const ACTOR = {
    'registrations.checked_in_by': ['SM8tMxfQuQCHRDdAiNJyQ', 'checked_in_by', 'atmJzUFotSzE9G0akUU2M'],
    'event_staff.granted_by': ['t1g8Vae3iEoDk93D6Rle7', 'granted_by', '0wfqdr7vveoyWxJqjymZP'],
    'staff_invites.created_by': ['JIjKkDu3Im2ylBmkkH5Fu', 'created_by', 'fKQAjYvMBW5ZbGWX8AYgx'],
    'staff_invites.used_by': ['JIjKkDu3Im2ylBmkkH5Fu', 'used_by', 'wSLuGfXNArBIdIUlIXenV'],
    'broadcasts.created_by': ['XrygYF5Q4EUOKkaBFallb', 'created_by', 'AQs7BEfN0hZ3OjPZXZNsc'],
  };
  const rows = (x, name) => {
    if (Array.isArray(x)) return x;
    if (x && Array.isArray(x.records)) return x.records;
    throw new Error('bad_input:' + name);
  };
  const field = (r, n) => { const c = (r && r.cells) || {}; for (const k of Object.keys(c)) if (c[k] && c[k].fieldName === n) return c[k].value; return undefined; };
  const checked = (x, name, f) => rows(x, name).map((r) => {
    if (String(field(r, f)) !== tid) throw new Error('mismatch:' + name);
    if (r.id == null || String(r.id) === '') throw new Error('no_record_id:' + name);
    return r;
  });
  const author = checked(inputs.author, 'events.staff_id', 'staff_id').length > 0;
  const own = inputs.own || {}, actor = inputs.actor || {};
  const deletes = [], clears = [], counts = {}, rm_events = [];
  for (const name of Object.keys(OWN)) {
    const [table, f] = OWN[name];
    const rs = checked(own[name], name, f);
    counts[name] = rs.length;
    if (rs.length) deletes.push({ table, ids: Array.from(new Set(rs.map((r) => String(r.id)))) });
    if (name === 'registrations') {
      for (const r of rs) {
        const ev = field(r, 'event_id');
        if (ev == null || String(ev) === '') continue;
        rm_events.push(String(ev));
      }
    }
  }
  for (const name of Object.keys(ACTOR)) {
    const [table, f, column] = ACTOR[name];
    const rs = checked(actor[name], name, f);
    counts[name] = rs.length;
    for (const r of rs) clears.push({ table, column, id: String(r.id) });
  }
  const refuse = inputs.refuse_if_author === true || inputs.refuse_if_author === 'true';
  if (author && refuse) return { author, refused: true, deletes: [], clears: [], rm_events: [], counts };
  return { author, refused: false, deletes, clears, rm_events: Array.from(new Set(rm_events)), counts };
};
```

## Тесты

[tests/delete-person-plan.test.mjs](tests/delete-person-plan.test.mjs)
