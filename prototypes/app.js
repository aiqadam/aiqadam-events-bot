// Прототип W41 — мок Mini App (ADR-0027).
// Hash-роутер как у продукта: #/ticket, #/scan, #/manage, #/manage/:id,
// #/events, #/feedback (пятый роут принят ADR-0028, W45). Фейковые данные, никаких вызовов
// (ADR-0026). Экраны — как продукт: брендовые токены, компоненты и иконки
// Lucide; требования SPEC — в отдельном шите трассировки.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

(function () {
  const screen = document.getElementById('screen');
  const D = PROTO.data;
  const T = (k, v) => PROTO.t(k, v);
  const E = PROTO.el;

  let manageTab = 'event';
  let scanState = 0;
  let scanError = null;
  let showErrors = false;
  let wizardTried = false;
  let participantFilter = 'all';
  let participantsEmpty = false;
  let catalogTab = 'mine';
  let catalogEmpty = false;
  let ticketDemo = null;
  let backUrl = '';
  let hashParams = new URLSearchParams('');
  let eventId = '';
  let wizardStep = 0;
  let wizardDone = false;
  let wizardDraft = null;
  let feedbackRating = 0;
  let feedbackSent = false;
  let staffQuery = '';

  function currentHash() {
    const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    const parts = raw.split('?');
    hashParams = new URLSearchParams(parts[1] || '');
    backUrl = hashParams.get('back') || '';
    return parts[0] || '';
  }
  function appHref(route) {
    const sep = route.indexOf('?') >= 0 ? '&' : '?';
    return 'app.html' + route + (backUrl ? sep + 'back=' + encodeURIComponent(backUrl) : '');
  }
  function go(route) { location.href = appHref(route); }
  function clear() { PROTO.clear(screen); screen.scrollTop = 0; }
  // Шапка мока — хром клиента: всегда имя приложения, как в настоящем
  // Telegram. Заголовок несёт сам экран (H1), setBar-пер-экран убран
  // вердиктом владельца 2026-09-18 (дублирование заголовка).

  // ---------- хелперы ----------
  function card(children, cls) {
    const c = E('div', 'card' + (cls ? ' ' + cls : ''));
    (children || []).forEach((n) => { if (n) c.appendChild(n); });
    return c;
  }
  function heading(text, cls) { return E('div', cls || 'app-h3', text); }
  function muted(text) { return E('div', 'app-muted', text); }
  // Первичные действия — 44 px (btn-lg из шкалы бренда): главная кнопка
  // экрана не ниже остальных и попадает под палец.
  function btn(label, opts) {
    const o = opts || {};
    const kind = o.kind || 'btn-primary';
    const size = o.size !== undefined ? o.size : (kind === 'btn-primary' ? 'btn-lg' : '');
    const b = E('button', 'btn ' + kind + (size ? ' ' + size : ''), label);
    b.type = 'button';
    if (o.icon) b.insertBefore(PROTO.icon(o.icon, 16), b.firstChild);
    if (o.block) b.style.width = '100%';
    if (o.onClick) b.addEventListener('click', o.onClick);
    if (o.disabled) { b.disabled = true; if (o.title) b.title = o.title; }
    return b;
  }
  function linkBtn(label, route, kind, icon) {
    const k = kind || 'btn-primary';
    const a = E('a', 'btn ' + k + (k === 'btn-primary' ? ' btn-lg' : ''), label);
    a.href = appHref(route);
    a.style.textDecoration = 'none';
    if (icon) a.insertBefore(PROTO.icon(icon, 16), a.firstChild);
    return a;
  }
  function badge(text, kind) { return E('span', 'badge' + (kind ? ' badge-' + kind : ''), text); }
  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  }
  function avatar(name, cls) { return E('span', 'avatar ' + (cls || 'avatar-md'), initials(name)); }
  function field(label, value, opts) {
    const o = opts || {};
    const wrap = E('div', 'app-field');
    wrap.appendChild(E('label', 'label', label));
    const input = o.textarea ? E('textarea', 'textarea') : E('input', 'input');
    if (!o.textarea) input.type = o.type || 'text';
    input.value = value || '';
    if (o.placeholder) input.placeholder = o.placeholder;
    if (o.error) input.classList.add('error');
    // Исправленное поле не должно краснеть до перерисовки: ошибку снимаем
    // на первом же вводе.
    input.addEventListener('input', () => {
      input.classList.remove('error');
      const err = wrap.querySelector('.helper.error');
      if (err) err.remove();
    });
    if (o.onInput) input.addEventListener('input', o.onInput);
    wrap.appendChild(input);
    if (o.hint) wrap.appendChild(E('div', 'helper', o.hint));
    if (o.error) wrap.appendChild(E('div', 'helper error', o.error));
    return wrap;
  }
  function row2(a, b) { const r = E('div', 'app-row2'); r.appendChild(a); r.appendChild(b); return r; }
  // StatCard — доменный паттерн бренда (`.stat-card`/`.stat-label`/`.stat-value`).
  function stat(n, label, kind) {
    const s = E('div', 'stat-card' + (kind ? ' ' + kind : ''));
    s.appendChild(E('div', 'stat-label', label));
    s.appendChild(E('div', 'stat-value', String(n)));
    return s;
  }
  // EmptyState — доменный паттерн бренда (иконка + заголовок).
  function emptyState(text, icon) {
    const e = E('div', 'empty-state');
    const ic = E('div', 'empty-icon');
    ic.appendChild(PROTO.icon(icon || 'calendar', 22));
    e.appendChild(ic);
    e.appendChild(E('div', 'empty-heading', text));
    return e;
  }
  function iconBadge(icon) {
    const a = E('span', 'avatar avatar-sm');
    a.appendChild(PROTO.icon(icon, 16));
    return a;
  }
  function datePlate(d) {
    const plate = E('div', 'date-plate');
    plate.appendChild(E('div', 'month', d ? d.month : ''));
    plate.appendChild(E('div', 'day', d ? d.day : ''));
    plate.appendChild(E('div', 'weekday', d ? d.weekday : ''));
    return plate;
  }
  function statusBadge(statusKey) {
    const kind = statusKey === 'status.published' ? 'success' : statusKey === 'status.draft' ? 'warning' : 'default';
    return badge(T(statusKey), kind);
  }

  // ---------- шит продукта (регистрация, гео, выбор контролёра) ----------
  let sheet = null;
  function sheetEls() {
    if (sheet) return sheet;
    const root = E('div', 'app-sheet');
    root.setAttribute('hidden', '');
    const backdrop = E('div', 'app-sheet-backdrop');
    const panel = E('div', 'app-sheet-panel');
    panel.appendChild(E('div', 'app-sheet-grab'));
    const head = E('div', 'app-sheet-head');
    const title = E('div', 'app-sheet-title');
    const close = E('button', 'app-sheet-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть');
    close.appendChild(PROTO.icon('x', 18));
    head.appendChild(title);
    head.appendChild(close);
    const body = E('div', 'app-sheet-body');
    panel.appendChild(head);
    panel.appendChild(body);
    root.appendChild(backdrop);
    root.appendChild(panel);
    (document.querySelector('.proto-app') || document.body).appendChild(root);
    backdrop.addEventListener('click', closeSheet);
    close.addEventListener('click', closeSheet);
    sheet = { root: root, title: title, body: body, render: null };
    return sheet;
  }
  function openSheet(title, render) {
    const s = sheetEls();
    s.title.textContent = title;
    s.render = render;
    renderSheet();
    s.root.removeAttribute('hidden');
  }
  function renderSheet() {
    if (!sheet || !sheet.render) return;
    PROTO.clear(sheet.body);
    sheet.render(sheet.body);
  }
  function closeSheet() { if (sheet) sheet.root.setAttribute('hidden', ''); }

  function searchField(placeholder, value, onInput) {
    const wrap = E('div', 'input-wrap');
    wrap.appendChild(PROTO.icon('search', 16));
    const input = E('input', 'input');
    input.type = 'search';
    input.placeholder = placeholder;
    input.value = value || '';
    input.addEventListener('input', onInput);
    wrap.appendChild(input);
    return wrap;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fakeQr(size) {
    // Фейковый QR. Чёрное на белом — единственное место с «сырым» цветом:
    // правило бренда «Dark code on light ground. Never teal» (Event stands →
    // QR codes), как и у настоящего `qrcode` в продукте.
    const c = E('canvas', 'qr-canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
    const n = 29, cell = size / n, rnd = mulberry32(20260916);
    function finder(x, y) {
      ctx.fillStyle = '#000000'; ctx.fillRect(x * cell, y * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = '#ffffff'; ctx.fillRect((x + 1) * cell, (y + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = '#000000'; ctx.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
    }
    ctx.fillStyle = '#000000';
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x < 8 && y < 8) || (x < 8 && y >= n - 8) || (x >= n - 8 && y < 8)) continue;
      if (rnd() > 0.5) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    return c;
  }

  // ---------- данные ----------
  function eventById(id) {
    if (D.main.id === String(id)) return D.main;
    const all = D.catalog.upcoming.concat(D.catalog.past);
    return all.find((e) => String(e.id) === String(id)) || null;
  }
  function isRegistered(id) {
    const ev = eventById(id);
    if (ev && typeof ev.registered === 'boolean') return ev.registered;
    return D.myTickets.some((t) => String(t.eventId) === String(id));
  }
  function eventData(id) {
    return D.eventData[String(id)] || D.eventData[D.main.id];
  }
  function ownerEvent(id) {
    return D.ownerEvents.find((e) => String(e.id) === String(id)) || null;
  }
  function eventInvite(id) {
    const ev = ownerEvent(id);
    // У нового ивента ссылки ещё нет — показываем будущий id, а не чужой.
    return (ev && ev.inviteLink) || ('https://t.me/' + D.botUsername + '?start=e' + (id === 'new' ? '10' : id));
  }
  function eventUtm(id) {
    const base = eventInvite(id);
    return [
      { utm: 'telegram', url: base + '-telegram' },
      { utm: 'instagram', url: base + '-instagram' },
      { utm: 'friends', url: base + '-friends' },
    ];
  }
  function mapUrl(lat, lon) {
    return 'https://yandex.ru/maps/?pt=' + lon + ',' + lat + '&z=17&l=map';
  }
  const seatsLeft = PROTO.seatsLeft;
  function fmtCoord(n) { return Number(n).toFixed(5); }
  function parseYandexLink(text) {
    const s = String(text || '');
    let m = /(?:pt|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
    if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
    m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
    if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
    m = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
    if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
    return null;
  }
  function plateFromLocal(s) {
    if (!s) return null;
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return {
      weekday: ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'][d.getDay()],
      day: String(d.getDate()),
      month: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()],
    };
  }
  function humanLocal(s) {
    const p = plateFromLocal(s);
    if (!p) return s || '';
    const months = { янв: 'января', фев: 'февраля', мар: 'марта', апр: 'апреля', мая: 'мая', июн: 'июня', июл: 'июля', авг: 'августа', сен: 'сентября', окт: 'октября', ноя: 'ноября', дек: 'декабря' };
    return p.weekday + ', ' + p.day + ' ' + (months[p.month] || p.month) + ' · ' + String(s).slice(11, 16);
  }

  // ---------- роут: билет ----------
  function renderTicket() {
    const id = hashParams.get('event_id') || D.main.id;
    const ev = eventById(id);
    PROTO.setTrace(['PAR-6', 'IDM-2', 'ADR-0007', 'PAR-5']);
    clear();

    const demoItems = [
      { label: 'Билет', active: ticketDemo === null, onClick: () => { ticketDemo = null; renderTicket(); } },
      { label: 'Загрузка', active: ticketDemo === 'loading', onClick: () => { ticketDemo = 'loading'; renderTicket(); } },
      { label: 'Нет связи', active: ticketDemo === 'network', onClick: () => { ticketDemo = 'network'; renderTicket(); } },
      { label: 'Ошибка сервера', active: ticketDemo === 'server', onClick: () => { ticketDemo = 'server'; renderTicket(); } },
    ];

    if (!ev) {
      screen.appendChild(emptyState(T('common.err.event_not_found'), 'ticket'));
      const acts = E('div', 'app-actions');
      acts.appendChild(linkBtn(T('feedback.to_events'), '#/events', 'btn-primary'));
      screen.appendChild(acts);
      PROTO.setDemo(demoItems);
      return;
    }

    if (ticketDemo === 'loading') {
      const box = E('div', 'ticket-state');
      const sk = E('div', 'skeleton ticket-skeleton');
      box.appendChild(sk);
      box.appendChild(E('div', 'app-muted', T('ticket.loading')));
      screen.appendChild(box);
      PROTO.setDemo(demoItems);
      return;
    }
    if (ticketDemo) {
      const box = E('div', 'ticket-state');
      const ic = E('div', 'state-icon');
      ic.appendChild(PROTO.icon('alert', 24));
      box.appendChild(ic);
      box.appendChild(E('div', 'state-title', T(ticketDemo === 'network' ? 'ticket.error.network' : 'ticket.error.server')));
      box.appendChild(btn(T('ticket.retry'), { kind: 'btn-primary', onClick: () => { ticketDemo = null; renderTicket(); } }));
      screen.appendChild(box);
      PROTO.setDemo(demoItems);
      return;
    }

    const ticket = D.myTickets.find((t) => String(t.eventId) === String(ev.id));
    const finished = ev.status === 'finished' || ev.statusKey === 'status.finished';

    if (finished) {
      screen.appendChild(ticketState('check-circle', T('reg.event_finished')));
      const acts = E('div', 'app-actions');
      if (ticket && !ticket.feedbackGiven) acts.appendChild(linkBtn(T('afterword.feedback_btn'), '#/feedback?event_id=' + ev.id, 'btn-outline', 'message-square'));
      acts.appendChild(linkBtn(T('feedback.to_events'), '#/events?tab=past', 'btn-primary'));
      screen.appendChild(acts);
      PROTO.setDemo(demoItems);
      return;
    }

    if (!ticket) {
      screen.appendChild(ticketState('ticket', T('proto.ticket_none')));
      const acts = E('div', 'app-actions');
      acts.appendChild(btn(T('event.card.btn_register'), { kind: 'btn-primary', onClick: () => openRegistration(ev) }));
      acts.appendChild(linkBtn(T('feedback.to_events'), '#/events', 'btn-secondary'));
      screen.appendChild(acts);
      PROTO.setDemo(demoItems);
      return;
    }

    const top = E('div', 'ticket-top');
    top.appendChild(E('div', 'ticket-event', ev.title));
    const when = E('div', 'ticket-when');
    when.appendChild(PROTO.icon('calendar', 15));
    when.appendChild(E('span', '', ev.whenLong || ev.when));
    top.appendChild(when);
    const whereText = ev.address || ev.where;
    if (whereText) {
      const where = E('div', 'ticket-when');
      where.appendChild(PROTO.icon('map-pin', 15));
      where.appendChild(E('span', '', whereText));
      top.appendChild(where);
    }
    screen.appendChild(top);

    const plate = E('div', 'qr-plate');
    plate.setAttribute('data-theme', 'light');
    plate.appendChild(fakeQr(232));
    screen.appendChild(plate);

    screen.appendChild(E('div', 'ticket-hint', T('ticket.show_at_entrance')));

    if (ticket.canCancel) {
      const cancel = E('div', 'ticket-cancel');
      cancel.appendChild(btn(T('myreg.btn.cancel'), {
        kind: 'btn-outline', block: true, onClick: () => openCancelSheet(ev),
      }));
      screen.appendChild(cancel);
    }
    PROTO.setDemo(demoItems);
  }

  function ticketState(icon, text) {
    const box = E('div', 'ticket-state');
    const ic = E('div', 'state-icon');
    ic.appendChild(PROTO.icon(icon, 24));
    box.appendChild(ic);
    box.appendChild(E('div', 'state-title', text));
    return box;
  }

  function openCancelSheet(ev) {
    const title = String(ev.title || '').replace(/[«»]/g, '').trim();
    openSheet(T('myreg.btn.cancel'), (body) => {
      body.appendChild(E('div', 'app-muted', T('cancel.confirm', { title: title })));
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('cancel.btn.confirm'), { kind: 'btn-destructive', onClick: () => {
        const t = D.myTickets.find((x) => String(x.eventId) === String(ev.id));
        if (t) t.canCancel = false;
        const cat = D.catalog.upcoming.find((x) => String(x.id) === String(ev.id));
        if (cat) cat.registered = false;
        if (D.main.id === String(ev.id)) D.main.registered = false;
        D.myTickets = D.myTickets.filter((x) => String(x.eventId) !== String(ev.id));
        closeSheet();
        PROTO.toast(T('cancel.done', { title: title }));
        go('#/events?tab=mine');
      } }));
      acts.appendChild(btn(T('cancel.btn.keep'), { kind: 'btn-secondary', onClick: closeSheet }));
      body.appendChild(acts);
    });
  }

  // ---------- роут: сканер ----------
  const scanOutcomes = [
    { key: 'ok', tone: 'ok', icon: 'check-circle', label: (scan) => T('checkin.ok', { name: scan.nextCheckin || T('checkin.name_unknown') }), sub: 'proto.result_ok' },
    { key: 'already', tone: 'warn', icon: 'clock', label: (scan) => T('checkin.already', { time: scan.alreadyAt }), sub: 'proto.result_already' },
    { key: 'not_registered', tone: 'bad', icon: 'x-circle', label: () => T('checkin.not_registered'), sub: 'proto.result_denied' },
    { key: 'wrong_event', tone: 'bad', icon: 'alert', label: () => T('checkin.wrong_event'), sub: 'proto.result_denied' },
  ];
  // Действие в состоянии ошибки: `resume` — вернуться к сканеру (сеть,
  // повтор), `close` — выйти из сканера (нет прав, ивент не передан:
  // сканировать дальше бессмысленно).
  const scanErrors = {
    forbidden: { icon: 'shield', text: 'checkin.forbidden', action: 'close' },
    stale: { icon: 'clock', text: 'checkin.unauthorized', action: 'close' },
    network: { icon: 'alert', text: 'scan.network_error', action: 'resume' },
    server: { icon: 'alert', text: 'scan.error_server', action: 'resume' },
    unsupported: { icon: 'alert', text: 'scan.unsupported', action: 'close' },
    no_event: { icon: 'calendar', text: 'scan.no_event', action: 'close' },
    not_tg: { icon: 'alert', text: 'scan.not_in_telegram', action: 'close' },
  };

  function renderScan() {
    PROTO.setTrace(['STF-1', 'STF-2', 'STF-4', 'IDM-2']);
    clear();

    const ed = eventData(hashParams.get('event_id') || D.main.id);
    // На ивенте без регистраций успешный скан невозможен — открываемся
    // на исходе «нет регистрации», а не на успехе с чужим именем.
    const baseState = scanState % scanOutcomes.length;
    const state = (ed.scan.registered === 0 && baseState === 0) ? 2 : baseState;
    const outcomeLabels = ['Успех', 'Повторный скан', 'Нет регистрации', 'Чужой QR'];
    const errorLabels = { forbidden: 'Нет прав', stale: 'Данные устарели', network: 'Нет связи', server: 'Ошибка сервера', unsupported: 'Камера недоступна', no_event: 'Ивент не передан', not_tg: 'Не из Telegram' };
    const items = scanOutcomes.map((o, i) => ({
      label: outcomeLabels[i] || o.key,
      active: !scanError && i === state,
      onClick: () => { scanError = null; scanState = i; renderScan(); },
    }));
    Object.keys(scanErrors).forEach((k) => {
      items.push({ label: errorLabels[k] || k, active: scanError === k, onClick: () => { scanError = k; renderScan(); } });
    });
    PROTO.setDemo(items, 'Нажатие на кадр — следующий скан (STF-1: сканер не закрывается).');

    if (scanError) {
      const e = scanErrors[scanError];
      const box = E('div', 'scan-state');
      const ic = E('div', 'state-icon');
      ic.appendChild(PROTO.icon(e.icon, 24));
      box.appendChild(ic);
      box.appendChild(E('div', 'state-title', T(e.text)));
      box.appendChild(btn(e.action === 'close' ? T('common.btn.close') : T('scan.rescan'), {
        kind: 'btn-primary',
        onClick: () => { if (e.action === 'close') { go('#/events'); return; } scanError = null; renderScan(); },
      }));
      screen.appendChild(box);
      return;
    }

    const outcome = scanOutcomes[state];

    const view = E('div', 'scan-view');
    ['tl', 'tr', 'bl', 'br'].forEach((c) => view.appendChild(E('span', 'scan-corner ' + c)));
    view.appendChild(E('div', 'scan-line'));
    view.style.cursor = 'pointer';
    view.addEventListener('click', () => {
      // Успешный скан в демо двигает счётчик — иначе «отмечен» и «0 из 67»
      // выглядят как несработавший чекин.
      if (outcome.key === 'ok' && ed.scan.checkedIn < ed.scan.registered) ed.scan.checkedIn++;
      scanState++;
      renderScan();
    });
    screen.appendChild(view);
    screen.appendChild(E('div', 'scan-hint', T('scan.hint')));

    const verdict = E('div', 'verdict ' + outcome.tone);
    const vi = E('span', 'verdict-icon');
    vi.appendChild(PROTO.icon(outcome.icon, 22));
    verdict.appendChild(vi);
    const vt = E('div', 'verdict-body');
    vt.appendChild(E('div', 'verdict-text', outcome.label(ed.scan)));
    vt.appendChild(E('div', 'verdict-sub', T(outcome.sub)));
    verdict.appendChild(vt);
    screen.appendChild(verdict);

    // Счётчик показывает тот скан, который дал вердикт: на успехе +1
    // (инкремент случится следующим тапом, когда исход сменится).
    const shown = outcome.key === 'ok' ? Math.min(ed.scan.registered, ed.scan.checkedIn + 1) : ed.scan.checkedIn;
    const pct = ed.scan.registered ? Math.round((shown / ed.scan.registered) * 100) : 0;
    const prog = E('div', 'scan-progress');
    const bar = E('div', 'scan-progress-bar');
    const fill = E('div', 'scan-progress-fill');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    prog.appendChild(bar);
    prog.appendChild(E('div', 'scan-progress-label', T('checkin.counter', { checked_in: shown, registered: ed.scan.registered })));
    screen.appendChild(prog);
  }

  // ---------- роут: список ивентов овнера ----------
  function renderManageList() {
    PROTO.setTrace(['OWN-4', 'ADR-0024', 'ADR-0025', 'STF-2']);
    clear();
    // Кнопки «Создать ивент» здесь нет: на форму создания овнер попадает
    // из чата (кнопка меню → #/manage/new). Вердикт владельца 2026-09-18.
    if (!D.ownerEvents.length) screen.appendChild(emptyState(T('manage.list.empty'), 'calendar'));
    D.ownerEvents.forEach((ev) => screen.appendChild(manageRow(ev)));
    PROTO.setDemo([]);
  }

  function manageRow(ev) {
    // Овнер — всегда staff своих ивентов: кнопка сканера рядом с ивентом.
    // В продукте видимость — по правам (STF-2); здесь показана всегда.
    const row = E('div', 'ev-row');
    row.style.flexWrap = 'wrap';
    const a = E('a', 'ev-main');
    a.href = appHref('#/manage/' + ev.id);
    const main = E('div', '');
    main.appendChild(E('div', 'ev-title', ev.title));
    const meta = E('div', 'ev-row-meta');
    meta.appendChild(statusBadge(ev.statusKey));
    meta.appendChild(E('span', '', ev.when));
    main.appendChild(meta);
    main.appendChild(E('div', 'app-muted', T('participants.counters', { registered: ev.registered, checked_in: ev.checkedIn, cancelled: ev.cancelled })));
    a.appendChild(main);
    row.appendChild(a);
    const tail = E('span', 'ev-tail');
    tail.appendChild(PROTO.icon('chevron-right', 18));
    row.appendChild(tail);
    const scan = linkBtn(T('menu.btn.scanner'), '#/scan?event_id=' + ev.id, 'btn-outline btn-sm', 'qr');
    scan.style.width = '100%';
    scan.style.marginTop = '10px';
    row.appendChild(scan);
    return row;
  }

  // ---------- роут: ивент овнера — визард ----------
  const WIZARD_STEPS = ['main', 'where', 'capacity', 'review'];

  function wizardFields(id) {
    if (wizardDraft) return wizardDraft;
    const src = id === 'new' ? null : D.ownerEvents.find((e) => String(e.id) === String(id));
    const hasCoords = !!src && src.lat !== null && src.lat !== undefined && src.lon !== null && src.lon !== undefined;
    wizardDraft = {
      // Формат участия (вердикт 2026-09-18): новое событие — офлайн
      // по умолчанию; у существующего с координатами — тоже офлайн.
      online: src ? !hasCoords : false,
      mapLink: '',
      title: src ? src.title : '',
      description: src ? (src.description || '') : '',
      address: src ? (src.address || '') : '',
      lat: src && src.lat !== null && src.lat !== undefined ? src.lat : null,
      lon: src && src.lon !== null && src.lon !== undefined ? src.lon : null,
      startsLocal: src ? (src.startsLocal || '') : '',
      endsLocal: src ? (src.endsLocal || '') : '',
      deadlineLocal: src ? (src.deadlineLocal || '') : '',
      capacity: src && src.capacity ? String(src.capacity) : '',
      overbook: src && src.overbook ? String(src.overbook) : '',
    };
    return wizardDraft;
  }

  function wizardErrors(f) {
    const e = { main: {}, where: {}, capacity: {} };
    const title = String(f.title || '').trim();
    if (title.length < 2 || title.length > 200) e.main.title = T('manage.err.title_length');
    if (String(f.description || '').length > 4000) e.main.description = T('manage.err.description_length');
    if (String(f.address || '').trim().length < 2) e.where.address = T('manage.err.address_length');
    if (!f.startsLocal) e.where.starts = T('manage.err.datetime');
    if (!f.endsLocal) e.where.ends = T('manage.err.datetime');
    if (!f.deadlineLocal) e.where.deadline = T('manage.err.datetime');
    else if (f.startsLocal && f.deadlineLocal > f.startsLocal) e.where.deadline = T('manage.err.deadline_after_starts');
    // Офлайн без координат не публикуется: ожидается ссылка Яндекс.Карт
    // (или недавнее место). Онлайн — гео не требуется вовсе.
    if (!f.online && (f.lat === null || f.lon === null)) e.where.geo = T('manage.geo.link_bad');
    if (f.capacity !== '') {
      const cap = parseInt(f.capacity, 10);
      if (isNaN(cap) || cap < 1) e.capacity.capacity = T('manage.err.capacity');
    }
    if (f.overbook !== '') {
      const over = parseInt(f.overbook, 10);
      if (isNaN(over) || over < 0 || over > 100) e.capacity.overbook = T('manage.err.overbook');
    }
    return e;
  }
  function stepValid(errs, step) { return Object.keys(errs[step] || {}).length === 0; }

  function tabs() {
    const wrap = E('div', 'tabs-wrap');
    const scroll = E('div', 'tabs-scroll');
    const box = E('div', 'tabs');
    [['event', T('proto.tab_event')], ['participants', T('owner.event.btn.participants')], ['broadcast', T('owner.event.btn.broadcast')], ['staff', T('manage.staff.title')]]
      .forEach(([key, label]) => {
        const b = E('button', 'tab' + (manageTab === key ? ' active' : ''), label);
        b.type = 'button';
        b.addEventListener('click', () => { manageTab = key; renderManageEvent(eventId); });
        box.appendChild(b);
      });
    scroll.appendChild(box);
    wrap.appendChild(scroll);
    return wrap;
  }

  function renderManageEvent(id) {
    eventId = id;
    const isNew = id === 'new';
    clear();

    const back = E('button', 'btn btn-ghost btn-sm', T('manage.btn.back'));
    back.type = 'button';
    back.insertBefore(PROTO.icon('arrow-left', 16), back.firstChild);
    back.addEventListener('click', () => go('#/manage'));
    back.style.marginBottom = '10px';
    screen.appendChild(back);
    if (!isNew) screen.appendChild(tabs());

    const body = E('div', 'app-tab-body');
    if (isNew) renderWizard(body, true);
    else if (manageTab === 'event') renderWizard(body, false);
    else if (manageTab === 'participants') renderParticipants(body);
    else if (manageTab === 'broadcast') renderBroadcastTab(body);
    else renderStaff(body);
    screen.appendChild(body);
  }

  function stepDots(n, total) {
    const box = E('div', 'step-dots');
    for (let i = 0; i < total; i++) {
      box.appendChild(E('span', 'step-dot' + (i < n ? ' done' : '') + (i === n ? ' active' : '')));
    }
    return box;
  }

  function renderWizard(body, isNew) {
    PROTO.setTrace(['OWN-1', 'OWN-2', 'OWN-3', 'OWN-4', 'OWN-5', 'OWN-6', 'OWN-15']);
    const f = wizardFields(eventId);
    const step = WIZARD_STEPS[wizardStep];
    const errs = wizardErrors(f);
    const show = showErrors || wizardTried;

    if (wizardDone) { renderWizardDone(body); return; }

    const head = E('div', 'wizard-head');
    head.appendChild(stepDots(wizardStep, WIZARD_STEPS.length));
    head.appendChild(E('div', 'wizard-step-label', T('manage.step.label', { n: wizardStep + 1, m: WIZARD_STEPS.length })));
    body.appendChild(head);

    const stepTitle = { main: T('manage.step.main'), where: T('manage.step.where'), capacity: T('manage.step.capacity'), review: T('manage.step.review') }[step];
    body.appendChild(E('div', 'wizard-title', stepTitle));

    if (step === 'main') renderWizardMain(body, f, errs.main, show);
    else if (step === 'where') renderWizardWhere(body, f, errs.where, show);
    else if (step === 'capacity') renderWizardCapacity(body, f, errs.capacity, show);
    else renderWizardReview(body, f, isNew, errs, show);

    const valid = WIZARD_STEPS.every((s) => stepValid(errs, s));
    const nav = E('div', 'sticky-actions');
    if (wizardStep > 0) {
      nav.appendChild(btn(T('common.btn.back'), { kind: 'btn-secondary', onClick: () => { wizardStep--; renderManageEvent(eventId); } }));
    }
    if (step !== 'review') {
      // Ошибки считаем в момент нажатия, а не из закрытия рендера: поля
      // обновляются без перерисовки, и старое состояние уже неактуально.
      nav.appendChild(btn(T('manage.btn.next'), { kind: 'btn-primary', onClick: () => {
        const fresh = wizardErrors(wizardFields(eventId));
        if (!stepValid(fresh, step)) { wizardTried = true; renderManageEvent(eventId); return; }
        wizardStep++;
        renderManageEvent(eventId);
      } }));
    } else if (isNew || String(eventId) === '5') {
      nav.appendChild(btn(T('manage.btn.publish'), {
        kind: 'btn-primary',
        disabled: !valid,
        onClick: () => {
          const fresh = wizardErrors(wizardFields(eventId));
          if (!WIZARD_STEPS.every((s) => stepValid(fresh, s))) { wizardTried = true; renderManageEvent(eventId); return; }
          wizardDone = true;
          renderManageEvent(eventId);
        },
      }));
    } else {
      // OWN-5: уведомление уходит только при изменении полей notify-on-change
      // (DATA-MODEL). Сравниваем с исходным ивентом — и тост говорит правду.
      nav.appendChild(btn(T('manage.btn.save'), { kind: 'btn-primary', onClick: () => {
        const src = ownerEvent(eventId) || {};
        const notify = ['title', 'address', 'startsLocal', 'endsLocal', 'deadlineLocal'];
        const changed = notify.some((k) => String(src[k] || '') !== String(f[k] || ''))
          || (src.lat !== f.lat) || (src.lon !== f.lon);
        PROTO.toast(T(changed ? 'manage.saved.updated_notified' : 'manage.saved.updated'));
      } }));
    }
    if (step === 'review' && !valid) body.appendChild(E('div', 'helper error', T('manage.err.validation')));
    body.appendChild(nav);

    PROTO.setDemo([
      { label: 'Ошибки валидации', active: showErrors, onClick: () => { showErrors = !showErrors; renderManageEvent(eventId); } },
      { label: T('manage.saved.draft'), onClick: () => PROTO.toast(T('manage.saved.draft')) },
      { label: T('manage.err.network'), onClick: () => PROTO.demoNote(T('manage.err.network')) },
      { label: T('manage.err.stale'), onClick: () => PROTO.demoNote(T('manage.err.stale')) },
    ], T('proto.tab_hint'));
  }

  function renderWizardMain(body, f, errors, show) {
    const sec = E('div', 'form-section');
    sec.appendChild(field(T('field.title'), f.title, {
      error: show ? errors.title : '',
      onInput: (e) => { f.title = e.target.value; },
    }));
    sec.appendChild(field(T('field.description'), f.description, {
      textarea: true, hint: T('manage.hint.description'),
      error: show ? errors.description : '',
      onInput: (e) => { f.description = e.target.value; },
    }));
    body.appendChild(sec);
  }

  function renderWizardWhere(body, f, errors, show) {
    const sec = E('div', 'form-section');
    sec.appendChild(field(T('field.address'), f.address, {
      hint: T('manage.hint.address'),
      error: show ? errors.address : '',
      onInput: (e) => { f.address = e.target.value; },
    }));

    // Формат участия (вердикт владельца 2026-09-18): два варианта вместо
    // гео-конструктора. Онлайн — никакой ссылки; офлайн — ожидается ссылка
    // Яндекс.Карт (валидация требует координаты: ссылка или недавнее место).
    // Указания точки на карте и шитов больше нет.
    const loc = E('div', 'app-field');
    loc.appendChild(E('label', 'label', T('proto.geo_mode')));
    const mode = E('div', 'segmented');
    [['online', T('proto.geo_online')], ['offline', T('proto.geo_offline')]].forEach(([key, label]) => {
      const on = (key === 'online') === !!f.online;
      const b = btn(label, { kind: 'btn-secondary', size: 'btn-sm', onClick: () => { f.online = (key === 'online'); renderManageEvent(eventId); } });
      if (on) b.classList.add('active');
      mode.appendChild(b);
    });
    loc.appendChild(mode);
    if (!f.online) {
      const linkInput = E('input', 'input');
      linkInput.type = 'url';
      linkInput.placeholder = T('manage.geo.link_placeholder');
      linkInput.value = f.mapLink || '';
      linkInput.addEventListener('input', (e) => { f.mapLink = e.target.value; });
      loc.appendChild(linkInput);
      const applyRow = E('div', 'chip-row');
      applyRow.appendChild(btn(T('manage.geo.link_apply'), { kind: 'btn-primary', size: 'btn-sm', icon: 'link', onClick: () => {
        const parsed = parseYandexLink(f.mapLink || '');
        if (!parsed) { PROTO.toast(T('manage.geo.link_bad')); return; }
        f.lat = parsed.lat;
        f.lon = parsed.lon;
        PROTO.toast(T('manage.geo.link_applied'));
        renderManageEvent(eventId);
      } }));
      loc.appendChild(applyRow);
      if (f.lat !== null && f.lon !== null) {
        loc.appendChild(locPreview(f));
        loc.appendChild(E('div', 'helper', T('manage.geo.coords', { lat: fmtCoord(f.lat), lon: fmtCoord(f.lon) })));
        const a = E('a', 'loc-link', T('event.card.btn_map'));
        a.href = mapUrl(f.lat, f.lon);
        a.target = '_blank';
        a.rel = 'noopener';
        a.appendChild(PROTO.icon('external', 14));
        loc.appendChild(a);
      } else {
        loc.appendChild(E('div', 'helper', show && errors.geo ? errors.geo : T('manage.geo.none')));
      }
      loc.appendChild(E('div', 'section-label', T('manage.geo.recent')));
      const recent = E('div', 'chip-row');
      D.venues.forEach((v) => {
        if (v.lat === null || v.lon === null) return;
        recent.appendChild(btn(v.name, { kind: 'btn-outline', size: 'btn-sm', onClick: () => {
          f.lat = v.lat;
          f.lon = v.lon;
          renderManageEvent(eventId);
        } }));
      });
      loc.appendChild(recent);
    }
    sec.appendChild(loc);

    sec.appendChild(field(T('field.starts_at'), f.startsLocal, { type: 'datetime-local', hint: T('manage.hint.datetime'), error: show ? errors.starts : '', onInput: (e) => { f.startsLocal = e.target.value; } }));
    sec.appendChild(field(T('field.ends_at'), f.endsLocal, { type: 'datetime-local', hint: T('manage.hint.datetime'), error: show ? errors.ends : '', onInput: (e) => { f.endsLocal = e.target.value; } }));
    sec.appendChild(field(T('field.reg_deadline_at'), f.deadlineLocal, {
      type: 'datetime-local', hint: T('manage.hint.datetime'),
      error: show ? errors.deadline : '',
      onInput: (e) => { f.deadlineLocal = e.target.value; },
    }));
    body.appendChild(sec);
  }

  function locPreview(f) {
    const box = E('div', 'loc-preview');
    box.appendChild(E('div', 'loc-grid'));
    const pin = E('span', 'loc-pin');
    pin.appendChild(PROTO.icon('map-pin', 20));
    pin.style.left = '50%';
    pin.style.top = '46%';
    box.appendChild(pin);
    return box;
  }

  function renderWizardCapacity(body, f, errors, show) {
    const live = E('div', 'capacity-live');
    function paint() {
      PROTO.clear(live);
      const cap = parseInt(f.capacity, 10);
      if (!cap || cap <= 0) {
        live.appendChild(E('div', 'app-muted', T('event.card.seats_unlimited')));
        return;
      }
      const over = f.overbook === '' ? 40 : parseInt(f.overbook, 10);
      const limit = Math.ceil(cap * (1 + (isNaN(over) ? 0 : over) / 100));
      live.appendChild(E('div', 'capacity-live-value', String(limit)));
      live.appendChild(E('div', 'app-muted', T('manage.capacity.limit', { limit: limit })));
    }
    const sec = E('div', 'form-section');
    sec.appendChild(row2(
      field(T('field.capacity'), f.capacity, { type: 'number', hint: T('manage.hint.capacity'), error: show ? errors.capacity : '', onInput: (e) => { f.capacity = e.target.value; paint(); } }),
      field(T('field.overbook_pct'), f.overbook, { type: 'number', hint: T('manage.hint.overbook'), error: show ? errors.overbook : '', onInput: (e) => { f.overbook = e.target.value; paint(); } })
    ));
    sec.appendChild(live);
    body.appendChild(sec);
    paint();
  }

  function previewCard(f) {
    const c = E('div', 'event-card preview');
    const plate = plateFromLocal(f.startsLocal);
    if (plate) c.appendChild(datePlate(plate));
    else c.classList.add('no-plate');
    const b = E('div', 'event-body');
    const top = E('div', 'event-top');
    const isDraft = String(eventId) === '5' || eventId === 'new';
    top.appendChild(E('span', 'event-status', (isDraft ? T('status.draft') : T('status.published')).toUpperCase()));
    b.appendChild(top);
    b.appendChild(E('div', 'event-title', String(f.title || '').trim() || T('manage.err.title_length')));
    const meta = E('div', 'ev-meta');
    const line = (icon, text) => {
      const l = E('span', 'ev-meta-line');
      l.appendChild(PROTO.icon(icon, 13));
      l.appendChild(E('span', '', text));
      meta.appendChild(l);
    };
    if (f.startsLocal) line('calendar', humanLocal(f.startsLocal));
    if (f.address) line('map-pin', f.address);
    const left = seatsLeft(f.capacity, f.overbook, (ownerEvent(eventId) || {}).registered || 0);
    if (left !== null) line('users', T('event.card.seats_left', { left: left }));
    b.appendChild(meta);
    if (f.description) b.appendChild(E('div', 'app-muted', f.description));
    c.appendChild(b);
    return c;
  }

  function renderWizardReview(body, f, isNew, errs, show) {
    body.appendChild(E('div', 'app-muted', T('manage.review.hint')));
    body.appendChild(previewCard(f));

    const isDraft = isNew || String(eventId) === '5';
    if (isDraft) {
      const saveDraft = btn(T('manage.btn.save_draft'), { kind: 'btn-outline', block: true, onClick: () => PROTO.toast(T('manage.saved.draft')) });
      saveDraft.style.marginTop = '14px';
      body.appendChild(saveDraft);
    } else {
      renderInviteBlock(body, eventId);
      const cancel = E('div');
      cancel.style.marginTop = '16px';
      cancel.appendChild(btn(T('owner.event.btn.cancel_event'), { kind: 'btn-destructive', block: true, onClick: () => openCancelEventSheet(f, eventId) }));
      body.appendChild(cancel);
    }
  }

  function renderInviteBlock(body, id) {
    const inv = card([], 'invite-card');
    inv.appendChild(E('div', 'card-title', T('manage.invite.title')));
    inv.appendChild(E('div', 'invite-link', eventInvite(id)));
    inv.appendChild(muted(T('manage.invite.hint')));
    const acts = E('div', 'app-actions');
    acts.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-primary', icon: 'copy', onClick: () => PROTO.copy(eventInvite(id)) }));
    acts.appendChild(btn(T('manage.btn.share'), { kind: 'btn-outline', icon: 'share', onClick: () => window.open('https://t.me/share/url?url=' + encodeURIComponent(eventInvite(id)), '_blank', 'noopener') }));
    inv.appendChild(acts);
    body.appendChild(inv);

    const utm = card([], '');
    utm.style.marginTop = '10px';
    utm.appendChild(E('div', 'card-title', T('owner.links.title', { title: wizardFields(id).title })));
    eventUtm(id).forEach((u) => {
      const r = E('div', 'utm-row');
      r.appendChild(E('span', '', u.utm));
      r.appendChild(E('span', 'utm-url', u.url));
      const copy = btn('', { kind: 'btn-ghost', size: 'btn-lg btn-icon', icon: 'copy', onClick: () => PROTO.copy(u.url) });
      copy.setAttribute('aria-label', T('manage.btn.copy') + ' ' + u.utm);
      r.appendChild(copy);
      utm.appendChild(r);
    });
    body.appendChild(utm);
  }

  function renderWizardDone(body) {
    const title = wizardFields(eventId).title;
    const done = E('div', 'sheet-success');
    const ic = E('div', 'success-icon');
    ic.appendChild(PROTO.icon('check-circle', 34));
    done.appendChild(ic);
    done.appendChild(E('div', 'success-title', T('manage.chat.published', { title: title })));
    body.appendChild(done);
    renderInviteBlock(body, eventId);
    // «К списку» уже есть в шапке экрана — второй такой кнопки не заводим
    // (MINIAPP-UX п. 1: навигация не дублируется).
    PROTO.setDemo([]);
  }

  function openCancelEventSheet(f, id) {
    openSheet(T('owner.event.btn.cancel_event'), (body) => {
      body.appendChild(E('div', 'app-muted', T('manage.cancel.confirm', { title: f.title })));
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('common.btn.confirm'), { kind: 'btn-destructive', onClick: () => {
        closeSheet();
        PROTO.toast(T('manage.saved.cancelled'));
        location.href = PROTO.chatUrl('owner', 'cancelled', true, id);
      } }));
      acts.appendChild(btn(T('common.btn.cancel'), { kind: 'btn-secondary', onClick: closeSheet }));
      body.appendChild(acts);
    });
  }

  // ---------- таб «Участники» ----------
  function renderParticipants(body) {
    PROTO.setTrace(['OWN-7', 'OWN-8']);
    const ed = eventData(eventId);
    const grid = E('div', 'stat-grid');
    grid.appendChild(stat(ed.counts.registered, T('manage.parts.stat_registered'), ''));
    grid.appendChild(stat(ed.counts.checkedIn, T('manage.parts.stat_checked_in'), 'ok'));
    grid.appendChild(stat(ed.counts.cancelled, T('manage.parts.stat_cancelled'), 'warn'));
    body.appendChild(grid);

    const filters = E('div', 'segmented');
    [['all', T('participants.filter.btn.all')], ['checked_in', T('participants.filter.btn.checked_in')], ['no_show', T('participants.filter.btn.no_show')], ['cancelled', T('participants.filter.btn.cancelled')]]
      .forEach(([key, label]) => {
        const b = btn(label, { kind: 'btn-secondary', size: 'btn-sm', onClick: () => { participantFilter = key; participantsEmpty = false; renderManageEvent(eventId); } });
        if (participantFilter === key) b.classList.add('active');
        filters.appendChild(b);
      });
    body.appendChild(filters);

    const list = participantsEmpty ? [] : ed.participants.filter((p) => {
      if (participantFilter === 'all') return true;
      if (participantFilter === 'checked_in') return p.statusKey === 'myreg.status.checked_in';
      if (participantFilter === 'cancelled') return p.statusKey === 'myreg.status.cancelled';
      if (participantFilter === 'no_show') return p.statusKey === 'myreg.status.registered';
      return true;
    });
    if (!list.length) {
      body.appendChild(emptyState(T('participants.empty'), 'users'));
    } else {
      const box = card([], 'list-card');
      list.forEach((p) => {
        const r = E('div', 'list-row');
        r.appendChild(avatar(p.name, 'avatar-md'));
        const b = E('div', 'body');
        b.appendChild(E('div', 'name', p.name));
        b.appendChild(E('div', 'sub', T(p.statusKey)));
        r.appendChild(b);
        if (p.at) r.appendChild(E('span', 'tail', p.at));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    const title = (ownerEvent(eventId) || D.main).title;
    const ex = E('div', 'app-actions');
    ex.appendChild(btn(T('export.btn.csv'), { kind: 'btn-outline', icon: 'download', onClick: () => PROTO.toast(T('export.caption', { title: title, count: ed.counts.registered })) }));
    ex.appendChild(btn(T('export.btn.json'), { kind: 'btn-outline', icon: 'download', onClick: () => PROTO.toast(T('export.caption', { title: title, count: ed.counts.registered })) }));
    body.appendChild(ex);
    PROTO.setDemo([
      { label: 'Пустой срез', active: participantsEmpty, onClick: () => { participantsEmpty = !participantsEmpty; renderManageEvent(eventId); } },
    ]);
  }

  // ---------- таб «Рассылка» ----------
  function renderBroadcastTab(body) {
    PROTO.setTrace(['OWN-9', 'OWN-10', 'OWN-11', 'OWN-12', 'OWN-13']);
    body.appendChild(card([muted(PROTO.protoDict['proto.broadcast_chat_hint'])]));
    // Чат открывается про этот же ивент: название, сегменты и обратный путь.
    body.appendChild(btn(PROTO.t('proto.open_chat'), { kind: 'btn-primary btn-lg', block: true, icon: 'megaphone', onClick: () => { location.href = PROTO.chatUrl('owner', 'broadcast', true, eventId); } }));

    const ed = eventData(eventId);
    const seg = card([], '');
    seg.appendChild(E('div', 'card-title', T('bcast.ask.segment')));
    [
      [T('bcast.segment.all_consent'), ed.segments.all_consent, true],
      [T('bcast.segment.registered'), ed.segments.registered, true],
      [T('bcast.segment.checked_in'), ed.segments.checked_in, true],
      [T('bcast.segment.no_show'), ed.segments.no_show, false],
    ].forEach(([label, count, ok]) => {
      const r = E('div', 'list-row');
      r.appendChild(E('span', 'body', label));
      r.appendChild(E('span', 'tail', ok ? String(count) : '—'));
      if (!ok) r.appendChild(PROTO.icon('clock', 15));
      seg.appendChild(r);
    });
    seg.appendChild(E('div', 'helper', T('bcast.segment.no_show_locked', { when: (ownerEvent(eventId) || D.main).ends })));
    body.appendChild(seg);
    PROTO.setDemo([]);
  }

  // ---------- таб «Контролёры»: выбор из списка, не ID руками ----------
  function renderStaff(body) {
    PROTO.setTrace(['OWN-14', 'STF-2', 'DAT-1']);
    const ed = eventData(eventId);
    body.appendChild(muted(T('proto.staff_hint')));

    if (!ed.controllers.length) {
      body.appendChild(emptyState(T('manage.staff.empty'), 'shield'));
    } else {
      const box = card([], 'list-card');
      ed.controllers.forEach((s) => {
        const r = E('div', 'list-row staff-row');
        r.appendChild(avatar(s.name, 'avatar-md'));
        const b = E('div', 'body');
        b.appendChild(E('div', 'name', s.name));
        b.appendChild(E('div', 'sub', s.username + ' · ' + T('proto.staff_since', { when: s.since })));
        r.appendChild(b);
        r.appendChild(btn(T('manage.staff.btn.revoke'), { kind: 'btn-outline', size: 'btn-sm', onClick: () => {
          ed.controllers = ed.controllers.filter((x) => x.id !== s.id);
          PROTO.toast(T('manage.staff.revoked'));
          renderManageEvent(eventId);
        } }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    const add = btn(T('proto.staff_add'), { kind: 'btn-primary btn-lg', block: true, icon: 'plus', onClick: openStaffPicker });
    add.style.marginTop = '14px';
    body.appendChild(add);
    body.appendChild(E('div', 'helper', T('proto.staff_invite_alt')));
    PROTO.setDemo([]);
  }

  function openStaffPicker() {
    openSheet(T('proto.staff_add'), (body) => {
      body.appendChild(searchField(T('manage.staff.search_placeholder'), staffQuery, (e) => {
        staffQuery = e.target.value;
        renderSheet();
        const inp = sheet.body.querySelector('input[type="search"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }));
      const q = staffQuery.trim().toLowerCase().replace(/^@/, '');
      const known = eventData(eventId).controllers.map((c) => c.id);
      const found = D.people.filter((p) => {
        if (known.indexOf(p.id) >= 0) return false;
        if (!q) return true;
        return p.name.toLowerCase().indexOf(q) >= 0 || p.username.toLowerCase().replace(/^@/, '').indexOf(q) >= 0;
      });
      body.appendChild(E('div', 'section-label', T('proto.staff_section_participants')));
      if (!found.length) {
        body.appendChild(emptyState(T('proto.staff_nobody'), 'users'));
        return;
      }
      const box = card([], 'list-card');
      found.forEach((p) => {
        const r = E('button', 'list-row person-row');
        r.type = 'button';
        r.appendChild(avatar(p.name, 'avatar-md'));
        const b = E('div', 'body');
        b.appendChild(E('div', 'name', p.name));
        b.appendChild(E('div', 'sub', p.username));
        r.appendChild(b);
        const plus = E('span', 'person-add');
        plus.appendChild(PROTO.icon('plus', 18));
        r.appendChild(plus);
        r.addEventListener('click', () => {
          eventData(eventId).controllers.push({ id: p.id, name: p.name, username: p.username, since: '26 сентября, 12:00' });
          staffQuery = '';
          closeSheet();
          PROTO.toast(T('manage.staff.added'));
          renderManageEvent(eventId);
        });
        box.appendChild(r);
      });
      body.appendChild(box);
    });
  }

  // ---------- роут: каталог — мои билеты / будущие / прошедшие ----------
  function renderEvents() {
    const tabsDef = [
      ['mine', T('events.tab.mine')],
      ['upcoming', T('events.list.btn.upcoming')],
      ['past', T('events.list.btn.past')],
    ];
    PROTO.setTrace(['PAR-3', 'PAR-4', 'ADR-0023', 'PAR-1', 'PAR-2', 'IDM-1', 'STF-2']);
    clear();

    const tw = E('div', 'tabs-wrap');
    const tbox = E('div', 'tabs');
    tabsDef.forEach(([key, label]) => {
      const b = E('button', 'tab' + (catalogTab === key ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { catalogTab = key; catalogEmpty = false; renderEvents(); });
      tbox.appendChild(b);
    });
    tw.appendChild(tbox);
    screen.appendChild(tw);

    if (catalogTab === 'mine') {
      if (catalogEmpty || !D.myTickets.length) screen.appendChild(emptyState(T('myreg.empty'), 'ticket'));
      else D.myTickets.forEach((t) => screen.appendChild(ticketRow(t)));
    } else if (catalogTab === 'upcoming') {
      if (catalogEmpty) screen.appendChild(emptyState(T('events.list.empty_upcoming'), 'calendar'));
      else D.catalog.upcoming.forEach((ev) => screen.appendChild(eventCardEl(ev)));
    } else {
      if (catalogEmpty) screen.appendChild(emptyState(T('events.list.empty_past'), 'calendar'));
      else D.catalog.past.forEach((ev) => screen.appendChild(eventCardEl(ev)));
    }

    PROTO.setDemo([
      { label: T('events.tab.mine'), active: catalogTab === 'mine', onClick: () => { catalogTab = 'mine'; catalogEmpty = false; renderEvents(); } },
      { label: T('events.list.btn.upcoming'), active: catalogTab === 'upcoming', onClick: () => { catalogTab = 'upcoming'; catalogEmpty = false; renderEvents(); } },
      { label: T('events.list.btn.past'), active: catalogTab === 'past', onClick: () => { catalogTab = 'past'; catalogEmpty = false; renderEvents(); } },
      { label: 'Пустой срез', active: catalogEmpty, onClick: () => { catalogEmpty = !catalogEmpty; renderEvents(); } },
    ]);
  }

  function ticketRow(t) {
    const row = E('div', 'event-card ticket-card');
    row.appendChild(datePlate(t.d));
    const body = E('div', 'event-body');
    const top = E('div', 'event-top');
    top.appendChild(statusBadge(t.statusKey));
    body.appendChild(top);
    body.appendChild(E('div', 'event-title', t.title));
    const meta = E('div', 'ev-meta');
    const line = (icon, text) => {
      const l = E('span', 'ev-meta-line');
      l.appendChild(PROTO.icon(icon, 13));
      l.appendChild(E('span', '', text));
      meta.appendChild(l);
    };
    line('calendar', t.when);
    if (t.where) line('map-pin', t.where);
    body.appendChild(meta);
    const acts = E('div', 'event-actions');
    if (t.upcoming) {
      acts.appendChild(linkBtn(T('reg.qr.button'), '#/ticket?event_id=' + t.eventId, 'btn-primary', 'qr'));
    } else if (!t.feedbackGiven) {
      acts.appendChild(linkBtn(T('afterword.feedback_btn'), '#/feedback?event_id=' + t.eventId, 'btn-outline', 'message-square'));
    } else {
      acts.appendChild(E('span', 'badge badge-success', T('proto.feedback_given')));
    }
    body.appendChild(acts);
    row.appendChild(body);
    return row;
  }

  function eventCardEl(ev) {
    const c = E('div', 'event-card' + (catalogTab === 'past' ? ' past' : ''));
    c.appendChild(datePlate(ev.d));

    const body = E('div', 'event-body');
    const top = E('div', 'event-top');
    top.appendChild(E('span', 'event-status', (ev.status === 'finished' ? T('status.finished') : T('status.published')).toUpperCase()));
    if (ev.tag) top.appendChild(badge('#' + ev.tag, 'primary'));
    body.appendChild(top);
    body.appendChild(E('div', 'event-title', ev.title));
    const meta = E('div', 'ev-meta');
    function metaLine(icon, text) {
      const l = E('span', 'ev-meta-line');
      l.appendChild(PROTO.icon(icon, 13));
      l.appendChild(E('span', '', text));
      meta.appendChild(l);
    }
    metaLine('calendar', ev.when);
    metaLine('map-pin', ev.where);
    const left = seatsLeft(ev.capacity, ev.overbook, ev.registeredCount);
    if (left !== null) metaLine('users', T('event.card.seats_left', { left: left }));
    if (ev.attended) metaLine('check-circle', T('participants.filter.btn.checked_in') + ': ' + ev.attended);
    body.appendChild(meta);

    const acts = E('div', 'event-actions');
    if (catalogTab === 'upcoming') {
      if (isRegistered(ev.id)) {
        acts.appendChild(linkBtn(T('reg.qr.button'), '#/ticket?event_id=' + ev.id, 'btn-primary', 'qr'));
      } else {
        acts.appendChild(btn(T('event.card.btn_register'), { kind: 'btn-primary', onClick: () => openRegistration(ev) }));
      }
      // Кнопка чекина рядом с ивентом — только staff этого ивента (STF-2).
      // В продукте видимость решает сервер по правам; в моке флаг в данных.
      // Вердикт владельца 2026-09-18: из чата кнопка чекина убрана.
      if (ev.staff) acts.appendChild(linkBtn(T('menu.btn.scanner'), '#/scan?event_id=' + ev.id, 'btn-outline btn-sm', 'qr'));
    } else if (ev.attendedMe && !ev.feedbackGiven) {
      acts.appendChild(linkBtn(T('afterword.feedback_btn'), '#/feedback?event_id=' + ev.id, 'btn-outline', 'message-square'));
    } else if (ev.attendedMe && ev.feedbackGiven) {
      acts.appendChild(E('span', 'badge badge-success', T('proto.feedback_given')));
    }
    if (acts.childNodes.length) body.appendChild(acts);
    c.appendChild(body);
    return c;
  }

  // ---------- регистрация внутри Mini App (PAR-1, PAR-2) ----------
  function openRegistration(ev) {
    let pdn = false;
    let mkt = false;
    let done = false;
    openSheet(T('reg.sheet.title'), (body) => {
      if (done) {
        const ok = E('div', 'sheet-success');
        const ic = E('div', 'success-icon');
        ic.appendChild(PROTO.icon('check-circle', 34));
        ok.appendChild(ic);
        ok.appendChild(E('div', 'success-title', T('reg.done.header')));
        ok.appendChild(E('div', 'app-muted', T('reg.done.hint')));
        body.appendChild(ok);
        const acts = E('div', 'sheet-actions');
        acts.appendChild(btn(T('reg.qr.button'), { kind: 'btn-primary', icon: 'qr', onClick: () => {
          closeSheet();
          if (parseRoute().name === 'ticket') renderTicket();
          else go('#/ticket?event_id=' + ev.id);
        } }));
        body.appendChild(acts);
        return;
      }
      body.appendChild(E('div', 'sheet-event', ev.title));
      body.appendChild(E('div', 'app-muted', ev.when + ((ev.address || ev.where) ? ' · ' + (ev.address || ev.where) : '')));

      const pdnRow = E('label', 'control-row');
      const pdnBox = E('input', 'checkbox');
      pdnBox.type = 'checkbox';
      pdnBox.checked = pdn;
      pdnBox.addEventListener('change', () => { pdn = pdnBox.checked; renderSheet(); });
      pdnRow.appendChild(pdnBox);
      pdnRow.appendChild(E('span', '', T('reg.pdn.label')));
      body.appendChild(pdnRow);

      const mktRow = E('label', 'control-row');
      const mktBox = E('input', 'checkbox');
      mktBox.type = 'checkbox';
      mktBox.checked = mkt;
      mktBox.addEventListener('change', () => { mkt = mktBox.checked; });
      mktRow.appendChild(mktBox);
      mktRow.appendChild(E('span', '', T('reg.mkt.label')));
      body.appendChild(mktRow);
      body.appendChild(E('div', 'helper', T('reg.mkt.hint')));

      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('event.card.btn_register'), {
        kind: 'btn-primary btn-lg',
        disabled: !pdn,
        onClick: () => {
          ev.registered = true;
          if (D.main.id === String(ev.id)) D.main.registered = true;
          const t = D.myTickets.find((x) => String(x.eventId) === String(ev.id));
          if (!t) {
            D.myTickets.unshift({
              eventId: String(ev.id), title: ev.title, when: ev.when, where: ev.where || ev.address,
              statusKey: 'myreg.status.registered', canCancel: true, upcoming: true, d: ev.d,
            });
          }
          done = true;
          renderSheet();
        },
      }));
      body.appendChild(acts);
    });
  }

  // ---------- роут: форма отзыва (пятый роут, принят ADR-0028) ----------
  function renderFeedback() {
    const id = hashParams.get('event_id') || D.feedback.eventId;
    const ev = eventById(id);
    const title = ev ? ev.title : D.feedback.eventTitle;
    PROTO.setTrace(['ADR-0028', 'ADR-0017']);
    clear();

    if (feedbackSent) {
      const ok = E('div', 'sheet-success');
      const ic = E('div', 'success-icon');
      ic.appendChild(PROTO.icon('check-circle', 34));
      ok.appendChild(ic);
      ok.appendChild(E('div', 'success-title', T('feedback.done_title')));
      ok.appendChild(E('div', 'app-muted', T('feedback.done')));
      screen.appendChild(ok);
      const acts = E('div', 'app-actions');
      acts.appendChild(linkBtn(T('feedback.to_events'), '#/events?tab=past', 'btn-primary'));
      screen.appendChild(acts);
      PROTO.setDemo([]);
      return;
    }

    screen.appendChild(E('div', 'app-title', T('feedback.title')));
    screen.appendChild(E('div', 'app-sub', title));
    screen.appendChild(E('div', 'app-muted', T('feedback.lead')));

    const rate = E('div', 'form-section');
    rate.appendChild(E('div', 'section-label', T('feedback.rate')));
    const stars = E('div', 'rating');
    for (let i = 1; i <= 5; i++) {
      const b = E('button', 'rating-star' + (i <= feedbackRating ? ' on' : ''));
      b.type = 'button';
      b.setAttribute('aria-label', String(i));
      b.appendChild(PROTO.icon('star', 28));
      b.addEventListener('click', () => { feedbackRating = i; renderFeedback(); });
      stars.appendChild(b);
    }
    rate.appendChild(stars);
    if (feedbackRating === 0) rate.appendChild(E('div', 'helper', T('feedback.rate_hint')));
    screen.appendChild(rate);

    const text = E('div', 'form-section');
    text.appendChild(field(T('feedback.text'), '', { textarea: true, placeholder: T('feedback.placeholder') }));
    screen.appendChild(text);

    const acts = E('div', 'app-actions');
    acts.appendChild(btn(T('feedback.submit'), {
      kind: 'btn-primary btn-lg', block: true, disabled: feedbackRating === 0,
      onClick: () => {
        if (ev) ev.feedbackGiven = true;
        const t = D.myTickets.find((x) => String(x.eventId) === String(id));
        if (t) t.feedbackGiven = true;
        feedbackSent = true;
        renderFeedback();
      },
    }));
    screen.appendChild(acts);
    PROTO.setDemo([]);
  }

  // ---------- роутер ----------
  function parseRoute() {
    const p = currentHash();
    if (p === '/ticket' || p === '/ticket/') return { name: 'ticket' };
    if (p === '/scan' || p === '/scan/') return { name: 'scan' };
    if (p === '/manage' || p === '/manage/') return { name: 'manage' };
    if (p.startsWith('/manage/')) return { name: 'manage-event', id: p.slice('/manage/'.length).split('/')[0] || 'new' };
    if (p === '/events' || p === '/events/') return { name: 'events' };
    if (p === '/feedback' || p === '/feedback/') return { name: 'feedback' };
    return { name: 'index' };
  }

  function route() {
    const r = parseRoute();
    closeSheet();
    if (r.name === 'ticket') renderTicket();
    else if (r.name === 'scan') { scanError = null; renderScan(); }
    else if (r.name === 'manage') renderManageList();
    else if (r.name === 'manage-event') {
      // Новый ивент открывается с первой вкладки и без чужих фильтров.
      manageTab = 'event'; participantFilter = 'all'; participantsEmpty = false;
      wizardDone = false; wizardStep = 0; wizardDraft = null; wizardTried = false;
      renderManageEvent(r.id);
    }
    else if (r.name === 'events') {
      const tab = hashParams.get('tab');
      catalogTab = (tab === 'upcoming' || tab === 'past') ? tab : 'mine';
      catalogEmpty = false;
      renderEvents();
    }
    else if (r.name === 'feedback') { feedbackSent = false; feedbackRating = 0; renderFeedback(); }
    else {
      // Точка входа продукта — каталог с «Моими билетами» (вердикт владельца).
      history.replaceState(null, '', appHref('#/events'));
      catalogTab = 'mine';
      renderEvents();
    }
    const close = document.querySelector('[data-proto-close]');
    if (close) close.href = backUrl || 'index.html';
  }

  async function init() {
    await PROTO.loadI18n();
    PROTO.initChrome({ title: 'Мок Mini App', dockLabel: 'Демо' });
    window.addEventListener('hashchange', route);
    route();
  }

  void init();
})();
