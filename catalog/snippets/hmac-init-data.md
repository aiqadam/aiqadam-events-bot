# Эталон: проверка `initData` Telegram (HMAC-цепочка)

**Инвариант:** STF-2. `telegram_id` берётся **только** из проверенной `initData`.

**Встраивают:**

| Флоу | Шаг | Сверено |
|---|---|---|
| `fn-verify-init-data` (`YEGaCp6uwKEtI2p4W9FIL`) | `step_2` | эталон-источник |
| `checkin-api` (`CUKqiby1PoHiQiiCQy24V`) | `step_35` | 2026-09-12 |

## Код

```js
export const code = async (inputs) => {
  const crypto = require('node:crypto');

  const dataCheckString = String(inputs.dataCheckString === undefined || inputs.dataCheckString === null ? '' : inputs.dataCheckString);
  const botToken = String(inputs.botToken === undefined || inputs.botToken === null ? '' : inputs.botToken);

  // Телеграмовская цепочка (ADR-0010): secretKey = HMAC-SHA256("WebAppData", botToken) — бинарный ключ,
  // не hex-строка. Раньше qadam гнал его через hex туда-обратно (secretKeyEncoding=hex) —
  // это было артефактом интерфейса qadam'а, а не частью алгоритма: hex-decode(hex-encode(x)) === x.
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken, 'utf8').digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString, 'utf8').digest('hex');

  return expected;
};
```

**Вход шага:**

```json
{"botToken": "{{variables['BOT_TOKEN']}}", "dataCheckString": "{{<шаг разбора>['output'].dataCheckString}}"}
```

## Что нельзя трогать

- **Токен берётся из `{{variables['BOT_TOKEN']}}`, не из `{{connections[...]}}`**
  ([ADR-0008](../../docs/adr/0008-bot-token-as-variable-not-connection-template.md)).
  Шаблон connection'а отдаёт **не тот** токен, которым платформа авторизует
  вызовы Bot API, — на этом уже отклонялись все контролёры разом.
- **Короткая форма `{{VAR}}` даёт пустую строку молча**
  ([Q25](../../docs/OPEN-QUESTIONS.md#q25)). С пустым ключом подпись и проверка
  деградируют согласованно, все позитивные тесты проходят, а секрета нет.
  Только `{{variables['NAME']}}`.
- Сравнение результата — **constant-time**, в отдельном шаге.

## Как ловится дрейф

Проверка односторонняя: подписывает Telegram, проверяем мы. Расхождение копии
означает «этот флоу отклоняет всех» — отказ громкий, не тихий. Различающий
прогон: настоящая `initData` от живого клиента (её нельзя синтезировать,
см. [Q16](../../docs/OPEN-QUESTIONS.md#q16)).
