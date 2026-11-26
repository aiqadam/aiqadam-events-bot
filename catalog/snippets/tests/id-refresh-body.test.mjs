import { load, suite } from './_load.mjs';
const { code } = await load('id-refresh-body');
const t = suite();
// Выдуманные люди (тестовый диапазон).
const A = '9000000000000963';
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let r = await code({ telegram_id: A, first_name: 'Тест', last_name: 'Тестов', username: 'test_963' });
t.ok(eq(r.body, { telegram_id: A, update_only: true, first_name: 'Тест', last_name: 'Тестов', username: 'test_963' }), 'all present → no clear');
r = await code({ telegram_id: A, first_name: 'Тест', username: 'test_963' });
t.ok(eq(r.body, { telegram_id: A, update_only: true, first_name: 'Тест', username: 'test_963', clear: ['last_name'] }), 'no last_name → clear last_name');
r = await code({ telegram_id: A, first_name: 'Тест', last_name: 'Тестов' });
t.ok(eq(r.body.clear, ['username']) && !('username' in r.body), 'no username → clear username');
r = await code({ telegram_id: A, first_name: 'Тест' });
t.ok(eq(r.body.clear, ['last_name', 'username']), 'both missing → both cleared, fixed order');
r = await code({ telegram_id: A, first_name: 'Тест', last_name: '', username: '   ' });
t.ok(eq(r.body.clear, ['last_name', 'username']) && !('last_name' in r.body) && !('username' in r.body), 'empty and blank → cleared, not sent');
r = await code({ telegram_id: A, first_name: 'Тест', last_name: null, username: undefined });
t.ok(eq(r.body.clear, ['last_name', 'username']), 'null and undefined → cleared');
r = await code({ telegram_id: A, first_name: 'Тест', last_name: 42, username: { u: 1 } });
t.ok(eq(r.body.clear, ['last_name', 'username']) && !('last_name' in r.body), 'non-strings are not sent, they are cleared');
r = await code({ telegram_id: A, first_name: ' Тест ', last_name: ' Т ' });
t.ok(r.body.first_name === ' Тест ' && r.body.last_name === ' Т ', 'values go as they came (ID validates)');
r = await code({ telegram_id: 9000000000000963, first_name: 'Тест' });
t.ok(r.body.telegram_id === A, 'numeric Telegram id → string');
r = await code({ telegram_id: A, first_name: 'Тест', clear: ['first_name'], update_only: false, phone: '+0' });
t.ok(r.body.update_only === true && eq(r.body.clear, ['last_name', 'username']) && !('phone' in r.body), 'extra inputs ignored; update_only always true');
for (const f of ['last_name', 'username']) {
  r = await code({ telegram_id: A, first_name: 'Тест', [f]: 'x' });
  t.ok(!(r.body.clear || []).includes(f), `${f} with a value is never in clear`);
}

await t.throws(() => code({ telegram_id: A }), /^no_first_name$/, 'missing first_name');
await t.throws(() => code({ telegram_id: A, first_name: '  ' }), /^no_first_name$/, 'blank first_name');
await t.throws(() => code({ telegram_id: '', first_name: 'Тест' }), /^bad_telegram_id$/, 'empty id');
await t.throws(() => code({ telegram_id: '0123', first_name: 'Тест' }), /^bad_telegram_id$/, 'leading zero');
await t.throws(() => code({ telegram_id: '12345678901234567', first_name: 'Тест' }), /^bad_telegram_id$/, '17 digits');
await t.throws(() => code({ telegram_id: 1.5, first_name: 'Тест' }), /^bad_telegram_id$/, 'non-integer number');
await t.throws(() => code({ telegram_id: 2 ** 60, first_name: 'Тест' }), /^bad_telegram_id$/, 'unsafe integer');
await t.throws(() => code({ telegram_id: "{{trigger['output'].data.telegramId}}", first_name: 'Тест' }), /^bad_telegram_id$/, 'unresolved template');
t.done('id-refresh-body');
