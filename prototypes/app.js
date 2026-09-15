// Мок Mini App прототипа W41 — hash-роутер и фейковые экраны.
// Экраны построенные (#/ticket, #/scan, #/manage, список+инвайт W37) и
// предложенные v0.2 (W13/W14/W38/W39), каждый подписан требованием SPEC
// либо «предложение». Фейковые данные, никаких вызовов (ADR-0026).
'use strict';

const screen = document.getElementById('screen');
const barTitle = document.getElementById('app-bar-title');
// back приходит в hash-query (app.html#/ticket?event_id=demo&back=...), не в search
const rawHash = location.hash.startsWith('#') ? location.hash.slice(1) : '';
const backHref = new URLSearchParams((rawHash.split('?')[1]) || '').get('back'); // возврат в мок чата

// Фейковые данные
const evt = {
  id: 'demo',
  title: 'AI Qadam Meetup · Ташкент',
  when: 'сб, 26 сент · 18:00',
  address: 'Ташкент, ул. Афросиаб, 1',
  status: 'опубликован',
  capacity: '60',
  overbook: '40',
  regDeadline: 'ср, 23 сент · 18:00',
  inviteLink: 'https://t.me/aiqadam_events_bot?start=e' + 'demo',
};
const participants = [
  { name: 'Азиза Каримова', status: 'зарегистрирован' },
  { name: 'Дилшод Рахимов', status: 'был на ивенте' },
  { name: 'Мадина Юсупова', status: 'зарегистрирован' },
  { name: 'Тимур Азимов', status: 'отменена' },
];
const staffList = [
  { id: '322876545', item: 'ID 322876545 — контролёр с 25.09, 10:14' },
  { id: '9001234567', item: 'ID 9001234567 — контролёр с 25.09, 11:02' },
];

function clear() {
  screen.innerHTML = '';
  screen.scrollTop = 0;
}

function header(title, sub) {
  const h = document.createElement('div');
  h.className = 'proto-app-header';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  h.appendChild(h2);
  if (sub) {
    const s = document.createElement('span');
    s.className = 'req-badge built';
    s.textContent = sub;
    h.appendChild(s);
  }
  screen.appendChild(h);
}

function backToChat() {
  if (backHref) {
    const a = document.createElement('a');
    a.className = 'btn btn-secondary btn-sm';
    a.href = backHref;
    a.textContent = '← в чат';
    screen.appendChild(a);
  }
}

function screenTag({ title, spec, built }) {
  const tag = document.createElement('div');
  tag.className = 'proto-screen-tag';
  const tEl = document.createElement('span');
  tEl.className = 'proto-title';
  tEl.textContent = title;
  tag.appendChild(tEl);
  tag.appendChild(reqBadge({ built, spec }));
  return tag;
}

function cardHTML({ title, body, meta }) {
  const c = document.createElement('div');
  c.className = 'card';
  if (title) {
    const t = document.createElement('h3');
    t.style.cssText = 'margin:0;font-size:15px;font-weight:600;font-family:var(--font-display);';
    t.textContent = title;
    c.appendChild(t);
  }
  if (body) {
    const p = document.createElement('p');
    p.innerHTML = body.replace(/\n/g, '<br/>');
    c.appendChild(p);
  }
  if (meta) {
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = meta;
    c.appendChild(m);
  }
  return c;
}

function fakeQr(size) {
  // Фейковый QR-узор на canvas: детерминированный, по payload.
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  const n = 29;
  const cell = size / n;
  const rnd = mulberry32(12345);
  // finder patterns (три угла)
  function finder(x, y) {
    ctx.fillRect(x * cell, y * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((x + 1) * cell, (y + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#000000';
    ctx.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if ((x < 8 && y < 8) || (x < 8 && y >= n - 8) || (x >= n - 8 && y < 8)) continue;
      if (rnd() > 0.5) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return c;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Роут: билет ----------
function routeTicket(eventId) {
  clear();
  header(t('ticket.title'), 'PAR-6 · ADR-0007');
  backToChat();
  screen.appendChild(screenTag({ title: 'Билет участника — построено (v0.1)', spec: 'ticket · my-qr-api', built: true }));
  const card = cardHTML({
    title: evt.title,
    body: evt.when + '\n' + evt.address,
    meta: 'Покажите этот QR на входе.',
  });
  screen.appendChild(card);

  const plate = document.createElement('div');
  plate.className = 'qr-plate';
  plate.setAttribute('data-theme', 'light');
  plate.style.cssText = 'padding:32px;margin-top:4px;';
  plate.appendChild(fakeQr(180));
  screen.appendChild(plate);

  const note = document.createElement('p');
  note.className = 'empty-desc';
  note.textContent = 'Демо-QR: узор фейковый, в прототипе не считывается.';
  screen.appendChild(note);

  // Состояния
  screen.appendChild(screenTag({ title: 'Состояния, которые ломают экран', spec: '', built: false }));
  const states = [
    { title: '401 — устаревший initData (окно 300 c, Q49)', text: t('proto.states.stale'), error: true },
    { title: 'Нет регистрации', text: t('ticket.error.unknown'), error: false },
    { title: 'Нет связи / сервер не JSON', text: t('proto.states.network') + ' / ' + t('proto.states.server'), error: true },
  ];
  states.forEach((s) => {
    const d = document.createElement('div');
    d.className = 'proto-state' + (s.error ? ' error' : '');
    const st = document.createElement('span');
    st.className = 'proto-state-title';
    st.textContent = s.title;
    d.appendChild(st);
    const p = document.createElement('p');
    p.className = 'empty-desc';
    p.textContent = s.text;
    d.appendChild(p);
    screen.appendChild(d);
  });
}

// ---------- Роут: сканер ----------
let scanState = 0;
const scanOutcomes = [
  { kind: 'ok', text: (n) => t('checkin.ok', { name: n }), tone: 'ok' },
  { kind: 'already', text: () => t('checkin.already', { time: '18:42' }), tone: 'warn' },
  { kind: 'not_registered', text: () => t('checkin.not_registered'), tone: 'bad' },
  { kind: 'wrong_event', text: () => t('checkin.wrong_event'), tone: 'bad' },
];
const scanNames = ['Азиза Каримова', 'Дилшод Рахимов', 'Мадина Юсупова', 'Тимур Азимов'];

function routeScan(eventId) {
  clear();
  scanState = 0;
  header(t('scan.title'), 'STF-1…STF-4');
  backToChat();
  screen.appendChild(screenTag({ title: 'Сканер — построено (v0.1)', spec: 'scan · checkin-api', built: true }));

  const hint = document.createElement('p');
  hint.className = 'empty-desc';
  hint.textContent = t('scan.hint');
  screen.appendChild(hint);

  const resultCard = document.createElement('div');
  resultCard.className = 'card result';
  screen.appendChild(resultCard);

  // Кнопка «просканировать» — мок показа попапа, не закрывающегося между людьми (STF-1)
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary btn-lg';
  btn.style.cssText = 'justify-content:center;';
  btn.textContent = 'Просканировать QR (демо)';
  btn.addEventListener('click', () => {
    const o = scanOutcomes[scanState % scanOutcomes.length];
    resultCard.className = 'card result ' + o.tone;
    resultCard.innerHTML = '';
    const name = scanNames[scanState % scanNames.length];
    const tEl = document.createElement('h3');
    tEl.className = 'empty-heading';
    tEl.textContent = o.text(name);
    resultCard.appendChild(tEl);
    // попап переоткрывается автоматически (STF-1) — подсказка
    const p = document.createElement('p');
    p.className = 'empty-desc';
    p.textContent = 'Сканер не закрывается — следующий скан сразу (STF-1).';
    resultCard.appendChild(p);
    scanState++;
  });
  screen.appendChild(btn);

  const counter = document.createElement('p');
  counter.className = 'empty-desc';
  counter.textContent = t('checkin.counter', { checked_in: '31', registered: '48' });
  screen.appendChild(counter);

  // Четыре исхода STF-4 явно
  screen.appendChild(screenTag({ title: 'Четыре исхода STF-4', spec: 'STF-4', built: true }));
  scanOutcomes.forEach((o) => {
    const d = document.createElement('div');
    d.className = 'proto-state ' + (o.tone !== 'ok' ? o.tone : '');
    const st = document.createElement('span');
    st.className = 'proto-state-title';
    st.textContent = o.text(scanNames[0]);
    d.appendChild(st);
    screen.appendChild(d);
  });

  // Состояния
  screen.appendChild(screenTag({ title: 'Состояния, которые ломают экран', spec: '', built: false }));
  const states = [
    { title: '403 — не staff этого ивента (STF-2)', text: t('proto.states.forbidden'), error: true },
    { title: '401 — устаревший initData (окно 12 ч, Q49)', text: t('proto.states.stale'), error: true },
    { title: 'Нет связи', text: t('proto.states.network'), error: true },
    { title: 'Сканер камеры недоступен', text: t('scan.unsupported'), error: false },
  ];
  states.forEach((s) => {
    const d = document.createElement('div');
    d.className = 'proto-state' + (s.error ? ' error' : '');
    const st = document.createElement('span');
    st.className = 'proto-state-title';
    st.textContent = s.title;
    d.appendChild(st);
    const p = document.createElement('p');
    p.className = 'empty-desc';
    p.textContent = s.text;
    d.appendChild(p);
    screen.appendChild(d);
  });
}

// ---------- Роут: manage ----------
function routeManage(eventId) {
  clear();
  const isEdit = Boolean(eventId);
  header(isEdit ? t('manage.title.edit') : t('manage.list.title'), isEdit ? 'OWN-1…OWN-5' : 'W37 · ADR-0025');
  backToChat();

  if (!isEdit) {
    // список своих ивентов (W37)
    screen.appendChild(screenTag({ title: 'Список своих ивентов — построено (v0.1)', spec: 'manage · W37', built: true }));
    const btn = document.createElement('a');
    btn.className = 'btn btn-primary btn-lg';
    btn.href = 'app.html#/manage/evt1';
    btn.textContent = t('manage.btn.new');
    screen.appendChild(btn);

    const list = [
      { id: 'evt1', title: evt.title, meta: evt.when + ' · опубликован', author: true },
      { id: 'evt2', title: 'Мастер-класс по LLM', meta: 'вс, 4 окт · 14:00 · черновик', author: true },
      { id: 'evt3', title: 'Хакатон AI Qadam', meta: 'сб, 17 окт · 10:00 · опубликован', author: false },
    ];
    list.forEach((it) => {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = 'app.html#/manage/' + it.id;
      a.style.cssText = 'display:block;text-decoration:none;color:inherit;';
      const tEl = document.createElement('h3');
      tEl.style.cssText = 'margin:0;font-size:15px;font-weight:600;font-family:var(--font-display);';
      tEl.textContent = it.title;
      a.appendChild(tEl);
      const m = document.createElement('div');
      m.className = 'meta';
      m.textContent = it.meta;
      a.appendChild(m);
      screen.appendChild(a);
    });
  } else {
    // форма правки — построено + ссылка-приглашение (W37) + контролёры (W36)
    screen.appendChild(screenTag({ title: 'Форма ивента — построено (v0.1)', spec: 'manage-api', built: true }));

    const form = document.createElement('div');
    form.className = 'card';
    const flds = [
      ['Название', evt.title],
      ['Адрес', evt.address],
      ['Начало', evt.when],
      ['Окончание', 'сб, 26 сент · 21:00'],
      ['Дедлайн регистрации', evt.regDeadline],
      ['Мест', evt.capacity + ' · овербукинг ' + evt.overbook + '%'],
      ['Статус', evt.status],
    ];
    flds.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:14px;';
      const kEl = document.createElement('span');
      kEl.className = 'meta';
      kEl.textContent = k;
      const vEl = document.createElement('span');
      vEl.textContent = v;
      row.appendChild(kEl);
      row.appendChild(vEl);
      form.appendChild(row);
    });
    screen.appendChild(form);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-lg';
    saveBtn.style.cssText = 'justify-content:center;';
    saveBtn.textContent = t('manage.btn.save');
    saveBtn.addEventListener('click', () => {
      saveBtn.textContent = t('manage.saved.updated');
      saveBtn.disabled = true;
    });
    screen.appendChild(saveBtn);

    // Ссылка-приглашение (W37, OWN-6)
    screen.appendChild(screenTag({ title: 'Ссылка регистрации — построено (v0.1)', spec: 'OWN-6 · W37', built: true }));
    const inv = cardHTML({
      title: t('manage.invite.title'),
      body: evt.inviteLink + '\n' + t('manage.invite.hint'),
    });
    screen.appendChild(inv);
    const invBtn = document.createElement('button');
    invBtn.type = 'button';
    invBtn.className = 'btn btn-secondary';
    invBtn.textContent = t('manage.btn.copy');
    invBtn.addEventListener('click', () => { invBtn.textContent = t('manage.btn.copied'); });
    screen.appendChild(invBtn);

    // Контролёры (W36)
    screen.appendChild(screenTag({ title: 'Контролёры ивента — построено (v0.1)', spec: 'W36 · STF-2', built: true }));
    const st = cardHTML({ title: t('manage.staff.title'), body: '' });
    screen.appendChild(st);
    staffList.forEach((s) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;padding:6px 0;border-top:1px solid var(--border);';
      const span = document.createElement('span');
      span.textContent = s.item;
      row.appendChild(span);
      const rev = document.createElement('button');
      rev.type = 'button';
      rev.className = 'btn btn-outline btn-sm';
      rev.textContent = t('manage.staff.btn.revoke');
      rev.addEventListener('click', () => { row.remove(); });
      row.appendChild(rev);
      screen.appendChild(row);
    });
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    const inp = document.createElement('input');
    inp.className = 'input';
    inp.placeholder = t('manage.staff.add_label');
    addRow.appendChild(inp);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = t('manage.staff.btn.add');
    addBtn.addEventListener('click', () => {
      if (inp.value.trim()) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px;padding:6px 0;border-top:1px solid var(--border);';
        const span = document.createElement('span');
        span.textContent = 'ID ' + inp.value.trim() + ' — контролёр с сейчас';
        row.appendChild(span);
        const rev = document.createElement('button');
        rev.type = 'button';
        rev.className = 'btn btn-outline btn-sm';
        rev.textContent = t('manage.staff.btn.revoke');
        rev.addEventListener('click', () => { row.remove(); });
        row.appendChild(rev);
        screen.insertBefore(row, addRow);
        inp.value = '';
      }
    });
    addRow.appendChild(addBtn);
    screen.appendChild(addRow);

    // Предложения v0.2
    renderProposals();
  }
}

function renderProposals() {
  screen.appendChild(screenTag({ title: 'Предложения v0.2', spec: '', built: false }));

  // W13: участники + счётчики + экспорт
  const p = cardHTML({
    title: t('participants.title', { title: evt.title }),
    body: t('participants.counters', { registered: '48', checked_in: '31', cancelled: '2' }),
    meta: 'OWN-7 · OWN-8 — W13',
  });
  screen.appendChild(p);
  const filterRow = document.createElement('div');
  filterRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [['Все', 'all'], ['Пришли', 'checked_in'], ['Отменившие', 'cancelled'], ['Не пришли', 'no_show']].forEach(([label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary btn-sm';
    b.textContent = label;
    filterRow.appendChild(b);
  });
  screen.appendChild(filterRow);
  participants.forEach((pp) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:6px 0;border-top:1px solid var(--border);';
    const n = document.createElement('span');
    n.textContent = pp.name;
    const s = document.createElement('span');
    s.className = 'meta';
    s.textContent = pp.status;
    row.appendChild(n);
    row.appendChild(s);
    screen.appendChild(row);
  });
  const exportRow = document.createElement('div');
  exportRow.style.cssText = 'display:flex;gap:8px;';
  [['CSV', t('export.btn.csv')], ['JSON', t('export.btn.json')]].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-outline';
    b.textContent = label + ' ' + t('export.caption', { title: '', count: '48' }).replace('«»', '');
    b.addEventListener('click', () => { b.textContent = 'Скачивание в прототипе не работает (W13)'; });
    exportRow.appendChild(b);
  });
  screen.appendChild(exportRow);

  // W14: рассылка пересылкой
  const bcast = cardHTML({
    title: t('proto.w14.title'),
    body: t('proto.w14.forward_hint') + '\n\n' + t('bcast.segment.registered') + ': 48\n' + t('bcast.segment.checked_in') + ': 31\n' + t('bcast.segment.no_show') + ': заблокировано до конца ивента',
    meta: 'OWN-9…OWN-13 — W14',
  });
  screen.appendChild(bcast);
  const bcastRow = document.createElement('div');
  bcastRow.style.cssText = 'display:flex;gap:8px;';
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.className = 'btn btn-secondary';
  testBtn.textContent = t('bcast.btn.test');
  testBtn.addEventListener('click', () => { testBtn.textContent = t('bcast.test.sent'); });
  bcastRow.appendChild(testBtn);
  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-primary';
  sendBtn.textContent = t('bcast.btn.send');
  sendBtn.disabled = true;
  sendBtn.title = t('bcast.send.blocked_no_test');
  sendBtn.addEventListener('click', () => {});
  bcastRow.appendChild(sendBtn);
  screen.appendChild(bcastRow);
  const bcastNote = document.createElement('p');
  bcastNote.className = 'empty-desc';
  bcastNote.textContent = 'Отправка не активна без теста себе (OWN-10). В прототипе — только показ.';
  screen.appendChild(bcastNote);

  // W39: афиша (Q50)
  const poster = cardHTML({
    title: t('proto.w39.poster'),
    body: 'Здесь будет фото афиши. ' + t('proto.w39.hint'),
    meta: 'OWN-1 · Q50 — W39',
  });
  screen.appendChild(poster);
}

// ---------- Роут: каталог #/events (W38) ----------
function routeEvents() {
  clear();
  header(t('proto.w38.title'), 'PAR-3 · ADR-0023');
  backToChat();
  screen.appendChild(screenTag({ title: 'Каталог ивентов — предложение v0.2', spec: 'W38 · #/events', built: false }));
  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:8px;';
  [['upcoming', t('proto.w38.upcoming')], ['past', t('proto.w38.past')]].forEach(([id, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary';
    b.textContent = label;
    tabs.appendChild(b);
  });
  screen.appendChild(tabs);
  const list = [
    { title: evt.title, meta: 'сб, 26 сент · 18:00 · свободно 42' },
    { title: 'Мастер-класс по LLM', meta: 'вс, 4 окт · 14:00 · свободно 120' },
    { title: 'Хакатон AI Qadam', meta: 'сб, 17 окт · 10:00 · свободно 60' },
  ];
  list.forEach((it) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = 'app.html#/ticket?event_id=' + it.id;
    a.style.cssText = 'display:block;text-decoration:none;color:inherit;';
    const tEl = document.createElement('h3');
    tEl.style.cssText = 'margin:0;font-size:15px;font-weight:600;font-family:var(--font-display);';
    tEl.textContent = it.title;
    a.appendChild(tEl);
    const m = document.createElement('div');
    m.className = 'meta';
    m.textContent = it.meta;
    a.appendChild(m);
    screen.appendChild(a);
  });
}

// ---------- Роутер ----------
function parseHash() {
  const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  const [pathPart, queryPart] = raw.split('?');
  const q = new URLSearchParams(queryPart || '');
  const p = pathPart || '';
  if (p === '/ticket' || p === '/ticket/') return { name: 'ticket', eventId: q.get('event_id') || '' };
  if (p === '/scan' || p === '/scan/') return { name: 'scan', eventId: q.get('event_id') || '' };
  if (p === '/manage' || p === '/manage/') return { name: 'manage', eventId: q.get('event_id') || '' };
  if (p.startsWith('/manage/')) return { name: 'manage', eventId: p.slice('/manage/'.length).split('/')[0] || '' };
  if (p === '/events') return { name: 'events' };
  return { name: 'index' };
}

function route() {
  const r = parseHash();
  const titles = {
    ticket: t('ticket.title'),
    scan: t('scan.title'),
    manage: t('manage.list.title'),
    events: t('proto.w38.title'),
    index: 'Mini App',
  };
  barTitle.textContent = titles[r.name] || 'Mini App';
  if (r.name === 'ticket') routeTicket(r.eventId);
  else if (r.name === 'scan') routeScan(r.eventId);
  else if (r.name === 'manage') routeManage(r.eventId);
  else if (r.name === 'events') routeEvents();
  else {
    clear();
    header('Mini App', 'прототип');
    backToChat();
    const note = document.createElement('p');
    note.className = 'empty-desc';
    note.textContent = 'Выберите экран в шапке. Роуты: #/ticket, #/scan, #/manage, #/events (предложение W38).';
    screen.appendChild(note);
  }
}

window.addEventListener('hashchange', route);
async function init() {
  await loadI18n();
  route();
}
void init();