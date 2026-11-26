# Эталон: id-refresh-body

**Инвариант:** дневное обновление только обновляет существующий профиль (`update_only: true`) и
шлёт из Telegram `first_name` и те из `last_name`, `username`, что есть; отсутствующие идут в
`clear`. Поле со значением и то же поле в `clear` вместе не бывают
([ADR-0060](../../docs/adr/0060-id-switch-flows-to-id-api.md) §5,
[ID ADR-0034](https://github.com/aiqadam/aiqadam-id/blob/main/docs/adr/0034-profile-upsert-explicit-clear-list.md) §4).

**Встраивают:** `fn-id-refresh` шаг `body` (`step_1`)

## Что делает

**Входы:** `telegram_id` (строка или целое число из Telegram), `first_name`, `last_name`, `username`
из апдейта. Ввод и вывод шага выключены: имя и `username`.

**Выход:** `body` для `profile-upsert`:

```
{ telegram_id, update_only: true, first_name, last_name?, username?, clear? }
```

- Поле «есть», если это непустая строка не из одних пробелов; значение уходит как пришло, без
  обрезки. ID сам проверяет длину и состав (ADR-0015 ID).
- `clear` — массив отсутствующих из `last_name`, `username`, в этом порядке; без отсутствующих ключа
  `clear` нет.
- Плохой `telegram_id` → `bad_telegram_id`; нет `first_name` → `no_first_name`. Шаг падает: это дефект
  вызывающего, Telegram всегда присылает `id` и `first_name`. В ID ничего не уходит.

## Код

```js
// fn-id-refresh body (ADR-0060 §5, ID ADR-0034 §4). logInput/logOutput OFF: Telegram name and username.
export const code = async (inputs) => {
  const raw = inputs.telegram_id;
  const tid = typeof raw === 'number' && Number.isSafeInteger(raw) ? String(raw) : raw;
  if (typeof tid !== 'string' || !/^[1-9][0-9]{0,15}$/.test(tid)) throw new Error('bad_telegram_id');
  const has = (v) => typeof v === 'string' && v.trim() !== '';
  if (!has(inputs.first_name)) throw new Error('no_first_name');
  const body = { telegram_id: tid, update_only: true, first_name: inputs.first_name };
  const clear = [];
  for (const f of ['last_name', 'username']) {
    if (has(inputs[f])) body[f] = inputs[f];
    else clear.push(f);
  }
  if (clear.length) body.clear = clear;
  return { body };
};
```

## Тесты

[tests/id-refresh-body.test.mjs](tests/id-refresh-body.test.mjs)
