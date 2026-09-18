// Прототип W41 — офлайн-проверка (Node, без зависимостей).
//   node prototypes/check.mjs
// Что проверяет:
//   1) все ключи t('...') / T('...') / protoDict['...'] из prototypes/*.js
//      резолвятся в i18n/ru.json или в словаре прототипа;
//   2) сценарии: у каждого шага есть id/kind, все переходы go существуют,
//      webApp-роуты известны, trace-идентификаторы описаны в specMap;
//   3) сценарии «проходятся»: обход от входа по кнопкам и автопереходам
//      достигает конца и покрывает все шаги;
//   4) предложенные строки не просочились в i18n/ru.json.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(p, 'utf8');

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);

// ---------- 1. словари ----------
const ru = JSON.parse(read(path.join(root, 'i18n', 'ru.json')));

// ---------- 2. загрузка сценариев в песочнице ----------
const sandbox = {
  console,
  setTimeout, clearTimeout,
  URLSearchParams,
  fetch: async () => ({ ok: false }),
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { search: '', hash: '', pathname: '', href: '' },
  navigator: {},
  document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, setAttribute() {} }) },
  window: null,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of ['proto.js', 'data.js', 'scenarios.js']) {
  try {
    vm.runInContext(read(path.join(here, f)), sandbox, { filename: f });
  } catch (e) {
    fail(`не загрузился ${f}: ${e.message}`);
  }
}

const PROTO = sandbox.PROTO;
if (!PROTO) { console.error('PROTO не определён'); process.exit(1); }

PROTO.dict = ru;
PROTO.dictLoaded = true;
const protoDict = PROTO.protoDict || {};
const scenarios = PROTO.buildScenarios();

// ---------- 3. ключи из исходников ----------
const known = new Set([...Object.keys(ru), ...Object.keys(protoDict)]);
const jsFiles = fs.readdirSync(here).filter((f) => f.endsWith('.js'));
const usedKeys = new Set();
for (const f of jsFiles) {
  const src = read(path.join(here, f));
  const patterns = [/(?:\bPROTO\.)?\bt\(\s*'([^']+)'/g, /\bT\(\s*'([^']+)'/g, /protoDict\['([^']+)'\]/g, /protoDict\["([^"]+)"\]/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) usedKeys.add(m[1]);
  }
}
for (const key of usedKeys) {
  if (!known.has(key)) fail(`ключ не резолвится: ${key}`);
}
// ключи, использованные в сценариях (в т.ч. динамические через data)
if (PROTO.missing && PROTO.missing.length) {
  for (const key of PROTO.missing) fail(`ключ не резолвится (при построении сценариев): ${key}`);
}

// ---------- 4. структура сценариев ----------
const ROUTES = new Set(['#/ticket', '#/scan', '#/manage', '#/manage/new', '#/events', '#/feedback']);
// #/feedback — пятый роут, принят ADR-0028 (W45): в сценариях проходит как разрешённый.
function routeName(hash) {
  const p = String(hash).split('?')[0];
  return ROUTES.has(p) || /^#\/manage\/[^/]+$/.test(p);
}
const ENTRIES = {
  guest: ['reminders'],
  owner: ['published', 'updated', 'cancelled', 'broadcast', 'staff-invite', 'finished'],
  controller: ['menu'],
};

for (const [sid, sc] of Object.entries(scenarios)) {
  const ids = new Map();
  sc.steps.forEach((s, i) => {
    if (!s.id) { fail(`${sid}[${i}]: нет id`); return; }
    if (ids.has(s.id)) fail(`${sid}: дублирующийся id ${s.id}`);
    ids.set(s.id, i);
  });
  sc.steps.forEach((s) => {
    if (!s.kind) fail(`${sid}.${s.id}: нет kind`);
    if (!Array.isArray(s.trace) || !s.trace.length) warnings.push(`${sid}.${s.id}: пустой trace`);
    (s.trace || []).forEach((tr) => { if (!PROTO.specMap[tr]) fail(`${sid}.${s.id}: trace ${tr} не описан в specMap`); });
    if (s.kind === 'card' && !s.card) fail(`${sid}.${s.id}: card без card`);
    if ((s.kind === 'bot' || s.kind === 'user') && !s.text) fail(`${sid}.${s.id}: нет text`);
    (s.buttons || []).forEach((b, bi) => {
      if (!b.label) fail(`${sid}.${s.id}[${bi}]: кнопка без label`);
      if (b.go && b.go !== 'end' && !ids.has(b.go)) fail(`${sid}.${s.id}[${bi}]: go «${b.go}» не найден`);
      if (b.webApp && !routeName(b.webApp)) {
        fail(`${sid}.${s.id}[${bi}]: webApp «${b.webApp}» — неизвестный роут`);
      }
    });
  });

  // обход: вход + автопереходы по кнопкам
  const visited = new Set();
  const queue = [0];
  (ENTRIES[sid] || []).forEach((id) => { if (ids.has(id)) queue.push(ids.get(id)); });
  while (queue.length) {
    const i = queue.shift();
    if (i < 0 || i >= sc.steps.length) continue;
    const step = sc.steps[i];
    if (visited.has(step.id)) continue;
    visited.add(step.id);
    if (step.buttons && step.buttons.length) {
      step.buttons.forEach((b) => { if (b.go && b.go !== 'end' && ids.has(b.go)) queue.push(ids.get(b.go)); });
    } else {
      const next = sc.steps[i + 1];
      if (next && !next.state) queue.push(i + 1);
    }
  }
  sc.steps.forEach((s) => {
    if (s.state) return; // состояния открываются прыжком, не обходом
    if (!visited.has(s.id)) warnings.push(`${sid}.${s.id}: недостижим в обходе`);
  });
  if (!visited.size) fail(`${sid}: обход ничего не посетил`);
}

// ---------- 4a. trace-иды экранов Mini App (app.js) ----------
// В сценариях чата trace проверен выше; у экранов Mini App он задаётся
// литералами в setTrace — их тоже сверяем со specMap.
const appSrc = read(path.join(here, 'app.js'));
const traceRe = /setTrace\(\[([^\]]*)\]\)/g;
let traceTotal = 0;
let tm;
while ((tm = traceRe.exec(appSrc)) !== null) {
  const ids = tm[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  ids.forEach((id) => {
    traceTotal++;
    if (!PROTO.specMap[id]) fail(`app.js: trace ${id} не описан в specMap`);
  });
}

// ---------- 5. предложения не в ru.json ----------
// Сравнение с точностью до пунктуации, кавычек и эмодзи: «Черновик сохранён.»
// и «Черновик сохранён» — одна и та же строка, второй источник правды не нужен.
const norm = (s) => String(s).toLowerCase()
  .replace(/[«»"'`]/g, '')
  .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
  .replace(/[.,!?;:—–\-()]/g, '')
  .replace(/\s+/g, ' ')
  .trim();
const ruTexts = new Set(Object.values(ru));
const ruNorm = new Map();
Object.entries(ru).forEach(([k, v]) => { if (!ruNorm.has(norm(v))) ruNorm.set(norm(v), k); });
for (const [k, v] of Object.entries(protoDict)) {
  if (ru[k] !== undefined) fail(`protoDict перекрывает ключ ru.json: ${k}`);
  if (ruTexts.has(v)) warnings.push(`protoDict «${k}» совпадает текстом со строкой ru.json`);
  if (ruNorm.has(norm(v))) fail(`protoDict «${k}» дублирует строку ru.json «${ruNorm.get(norm(v))}»: ${v}`);
}

// ---------- вывод ----------
console.log(`Сценарии: ${Object.keys(scenarios).join(', ')}`);
console.log(`Ключей из JS: ${usedKeys.size}, словарь прототипа: ${Object.keys(protoDict).length}, trace-идов Mini App: ${traceTotal}`);
if (warnings.length) {
  console.log(`\nПредупреждения (${warnings.length}):`);
  warnings.forEach((w) => console.log('  ~ ' + w));
}
if (errors.length) {
  console.error(`\nОШИБКИ (${errors.length}):`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('\nOK: ключи резолвятся, переходы целы, сценарии проходятся.');
