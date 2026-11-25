import { load, suite } from './_load.mjs';
const { code } = await load('delete-person-plan');
const t = suite();
// Выдуманные люди (тестовый диапазон).
const A = '9000000000000901', B = '9000000000000902';
const rec = (id, f, v, extra = {}) => ({ id, cells: { k: { fieldName: f, value: v }, ...Object.fromEntries(Object.entries(extra).map(([n, x], i) => ['e' + i, { fieldName: n, value: x }])) } });
const OWN_NAMES = ['registrations', 'feedback', 'broadcast_targets', 'sessions', 'quiz_answers', 'quiz_attempts', 'reports', 'event_staff', 'staff', 'bot_contacts', 'users'];
const ACTOR_NAMES = ['registrations.checked_in_by', 'event_staff.granted_by', 'staff_invites.created_by', 'staff_invites.used_by', 'broadcasts.created_by'];
const empty = (names) => Object.fromEntries(names.map((n) => [n, []]));
const go = (o = {}) => code({ telegram_id: A, author: [], own: { ...empty(OWN_NAMES), ...(o.own || {}) }, actor: { ...empty(ACTOR_NAMES), ...(o.actor || {}) }, ...(o.top || {}) });

let r = await go();
t.ok(!r.author && r.deletes.length === 0 && r.clears.length === 0 && r.rm_events.length === 0, 'nobody: nothing to do, no empty lists');
t.ok(Object.keys(r.counts).length === 16 && Object.values(r.counts).every((n) => n === 0), 'counts for every name, all zero');

r = await go({ own: { registrations: [rec('r1', 'telegram_id', A, { event_id: 'ev1' }), rec('r2', 'telegram_id', A, { event_id: 'ev2' })], reports: { records: [rec('p1', 'telegram_id', A)] }, users: [rec('u1', 'telegram_id', A)] } });
t.ok(r.deletes.length === 3 && r.deletes[0].table === 'SM8tMxfQuQCHRDdAiNJyQ' && r.deletes[0].ids.join() === 'r1,r2', 'own rows grouped per table');
t.ok(r.deletes.some((d) => d.table === 'LKEqlq1X7RuWz5WC4zkov' && d.ids[0] === 'p1'), 'reports deleted ({records} input)');
t.ok(r.rm_events.join() === 'ev1,ev2' && !JSON.stringify(r.rm_events).includes(A), 'reminder events from own registrations, no telegram_id in the loop list');
t.ok(!JSON.stringify(r.deletes).includes(A) && !JSON.stringify(r.clears).includes(A), 'loop lists carry no telegram_id');
t.ok(r.counts.registrations === 2 && r.counts.reports === 1 && r.counts.users === 1, 'counts');

r = await go({ own: { registrations: [rec('r1', 'telegram_id', A, { event_id: 'ev1' }), rec('r1', 'telegram_id', A, { event_id: 'ev1' })] } });
t.ok(r.deletes[0].ids.length === 1 && r.rm_events.length === 1, 'duplicates collapse');

r = await go({ actor: { 'registrations.checked_in_by': [rec('r9', 'checked_in_by', A)], 'staff_invites.used_by': [rec('i1', 'used_by', A)] } });
t.ok(r.clears.length === 2 && r.clears[0].table === 'SM8tMxfQuQCHRDdAiNJyQ' && r.clears[0].column === 'atmJzUFotSzE9G0akUU2M' && r.clears[0].id === 'r9', 'checked_in_by cleared in the other person row');
t.ok(r.clears[1].column === 'wSLuGfXNArBIdIUlIXenV', 'used_by cleared');

r = await go({ top: { author: [rec('e1', 'staff_id', A)] }, own: { staff: [rec('s1', 'telegram_id', A)] } });
t.ok(r.author === true && r.deletes.length === 1 && !r.deletes.some((d) => d.table === 'R4aSQpLZvw7d3u6DVOSjH'), 'author: flagged, events never in deletes, the rest still planned');

r = await go({ top: { author: [rec('e1', 'staff_id', A)], refuse_if_author: true }, own: { staff: [rec('s1', 'telegram_id', A)], registrations: [rec('r1', 'telegram_id', A, { event_id: 'ev1' })] }, actor: { 'broadcasts.created_by': [rec('b1', 'created_by', A)] } });
t.ok(r.author && r.refused && r.deletes.length === 0 && r.clears.length === 0 && r.rm_events.length === 0 && r.counts.staff === 1, 'reg-api: author with refuse_if_author → nothing deleted, counts kept');
r = await go({ top: { refuse_if_author: 'true' }, own: { staff: [rec('s1', 'telegram_id', A)] } });
t.ok(!r.author && !r.refused && r.deletes.length === 1, 'refuse_if_author without authored events → normal deletion');
r = await go({ top: { author: [rec('e1', 'staff_id', A)], refuse_if_author: false }, own: { staff: [rec('s1', 'telegram_id', A)] } });
t.ok(r.author && !r.refused && r.deletes.length === 1, 'receiver: author without refuse → the rest deleted');
await t.throws(() => go({ own: { feedback: [rec('f1', 'telegram_id', B)] } }), /^mismatch:feedback$/, 'a row of another person stops the run (filter not applied)');
await t.throws(() => go({ actor: { 'broadcasts.created_by': [rec('b1', 'created_by', '')] } }), /^mismatch:broadcasts.created_by$/, 'actor mismatch stops the run');
await t.throws(() => go({ top: { author: [rec('e1', 'staff_id', B)] } }), /^mismatch:events.staff_id$/, 'author mismatch stops the run');
await t.throws(() => go({ own: { sessions: [{ cells: { k: { fieldName: 'telegram_id', value: A } } }] } }), /^no_record_id:sessions$/, 'row without id stops the run');
await t.throws(() => go({ own: { users: null } }), /^bad_input:users$/, 'missing input stops the run');
await t.throws(() => go({ own: { users: { x: 1 } } }), /^bad_input:users$/, 'non-list input stops the run');
for (const bad of ['', ' ' + A, '0' + A.slice(1), '-', 9000000000000901]) {
  await t.throws(() => go({ top: { telegram_id: bad } }), /^bad_telegram_id$/, 'bad id ' + JSON.stringify(bad));
}
t.done('delete-person-plan');
