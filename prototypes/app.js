// Прототип W41 — мок Mini App (ADR-0027).
// Hash-роутер как у продукта: #/ticket, #/scan, #/manage, #/manage/:id,
// #/events. Форма отзыва #/feedback — предложение (черновик ADR-0028),
// пятого роута в продукте ещё нет. Фейковые данные, никаких вызовов
// (ADR-0026). Экраны — как продукт: брендовые токены, компоненты и иконки
// Lucide; требования SPEC — в отдельном шите трассировки.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

(function () {
  const screen = document.getElementById('screen');
  const barTitle = document.getElementById('app-bar-title');
  const D = PROTO.data;
  const T = (k, v) => PROTO.t(k, v);
  const E = PROTO.el;

  let manageTab = 'event';
  let scanState = 0;
  let showErrors = false;
  let participantFilter = 'all';
  let catalogTab = 'mine';
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
  function setBar(title) { if (barTitle) barTitle.textContent = title; }

  // ---------- хелперы ----------
  function card(children, cls) {
    const c = E('div', 'card' + (cls ? ' ' + cls : ''));
    (children || []).forEach((n) => { if (n) c.appendChild(n); });
    return c;
  }
  function heading(text, cls) { return E('div', cls || 'app-h3', text); }
  function muted(text) { return E('div', 'app-muted', text); }
  function btn(label, opts) {
    const o = opts || {};
    const b = E('button', 'btn ' + (o.kind || 'btn-primary') + (o.size ? ' ' + o.size : ''), label);
    b.type = 'button';
    if (o.icon) b.insertBefore(PROTO.icon(o.icon, 16), b.firstChild);
    if (o.block) b.style.width = '100%';
    if (o.onClick) b.addEventListener('click', o.onClick);
    if (o.disabled) { b.disabled = true; if (o.title) b.title = o.title; }
    return b;
  }
  function linkBtn(label, route, kind, icon) {
    const a = E('a', 'btn ' + (kind || 'btn-primary'), label);
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
  function splitLine(line) {
    const i = line.indexOf(': ');
    if (i < 0) return { v: line };
    return { k: line.slice(0, i), v: line.slice(i + 2) };
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
  function mapUrl(lat, lon) {
    return 'https://yandex.ru/maps/?pt=' + lon + ',' + lat + '&z=17&l=map';
  }
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

  // ---------- роут: билет ----------
  function renderTicket() {
    const ev = eventById(hashParams.get('event_id') || D.main.id) || D.main;
    setBar(T('ticket.title'));
    PROTO.setTrace(['PAR-6', 'IDM-2', 'ADR-0007', 'PAR-5']);
    clear();

    const top = E('div', 'ticket-top');
    top.appendChild(E('div', 'ticket-event', ev.title));
    const when = E('div', 'ticket-when');
    when.appendChild(PROTO.icon('calendar', 15));
    when.appendChild(E('span', '', ev.whenLong || ev.when));
    top.appendChild(when);
    if (ev.address) {
      const where = E('div', 'ticket-when');
      where.appendChild(PROTO.icon('map-pin', 15));
      where.appendChild(E('span', '', ev.address));
      top.appendChild(where);
    }
    screen.appendChild(top);

    const plate = E('div', 'qr-plate');
    plate.setAttribute('data-theme', 'light');
    plate.appendChild(fakeQr(232));
    screen.appendChild(plate);

    screen.appendChild(E('div', 'ticket-hint', T('ticket.show_at_entrance')));

    const ticket = D.myTickets.find((t) => String(t.eventId) === String(ev.id));
    if (ticket && ticket.canCancel) {
      const cancel = E('div', 'ticket-cancel');
      cancel.appendChild(btn(T('myreg.btn.cancel'), {
        kind: 'btn-outline', block: true, onClick: () => openCancelSheet(ev),
      }));
      screen.appendChild(cancel);
    }

    PROTO.setDemo([
      { label: 'Билет', active: true },
      { label: T('ticket.loading'), onClick: () => PROTO.demoNote(T('ticket.loading')) },
      { label: T('ticket.error.network'), onClick: () => PROTO.demoNote(T('ticket.error.network')) },
      { label: T('ticket.error.server'), onClick: () => PROTO.demoNote(T('ticket.error.server')) },
      { label: T('ticket.no_event'), onClick: () => PROTO.demoNote(T('ticket.no_event')) },
      { label: T('ticket.not_in_telegram'), onClick: () => PROTO.demoNote(T('ticket.not_in_telegram')) },
    ]);
  }

  function openCancelSheet(ev) {
    openSheet(T('myreg.btn.cancel'), (body) => {
      body.appendChild(E('div', 'app-muted', T('cancel.confirm', { title: ev.title })));
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('cancel.btn.confirm'), { kind: 'btn-destructive', onClick: () => {
        const t = D.myTickets.find((x) => String(x.eventId) === String(ev.id));
        if (t) t.canCancel = false;
        const cat = D.catalog.upcoming.find((x) => String(x.id) === String(ev.id));
        if (cat) cat.registered = false;
        if (D.main.id === String(ev.id)) D.main.registered = false;
        D.myTickets = D.myTickets.filter((x) => String(x.eventId) !== String(ev.id));
        closeSheet();
        PROTO.toast(T('proto.ticket_cancelled'));
        go('#/events?tab=mine');
      } }));
      acts.appendChild(btn(T('cancel.btn.keep'), { kind: 'btn-secondary', onClick: closeSheet }));
      body.appendChild(acts);
    });
  }

  // ---------- роут: сканер ----------
  const scanOutcomes = [
    { key: 'ok', tone: 'ok', icon: 'check-circle', label: () => T('checkin.ok', { name: 'Азиза Каримова' }), sub: 'proto.result_ok' },
    { key: 'already', tone: 'warn', icon: 'clock', label: () => T('checkin.already', { time: D.scan.alreadyAt }), sub: 'proto.result_already' },
    { key: 'not_registered', tone: 'bad', icon: 'x-circle', label: () => T('checkin.not_registered'), sub: 'proto.result_denied' },
    { key: 'wrong_event', tone: 'bad', icon: 'alert', label: () => T('checkin.wrong_event'), sub: 'proto.result_denied' },
  ];

  function renderScan() {
    setBar(T('scan.title'));
    PROTO.setTrace(['STF-1', 'STF-2', 'STF-4', 'IDM-2']);
    clear();

    const outcome = scanOutcomes[scanState % scanOutcomes.length];

    const view = E('div', 'scan-view');
    ['tl', 'tr', 'bl', 'br'].forEach((c) => view.appendChild(E('span', 'scan-corner ' + c)));
    view.appendChild(E('div', 'scan-line'));
    view.style.cursor = 'pointer';
    view.addEventListener('click', () => { scanState++; renderScan(); });
    screen.appendChild(view);
    screen.appendChild(E('div', 'scan-hint', T('scan.hint')));

    const verdict = E('div', 'verdict ' + outcome.tone);
    const vi = E('span', 'verdict-icon');
    vi.appendChild(PROTO.icon(outcome.icon, 22));
    verdict.appendChild(vi);
    const vt = E('div', 'verdict-body');
    vt.appendChild(E('div', 'verdict-text', outcome.label()));
    vt.appendChild(E('div', 'verdict-sub', T(outcome.sub)));
    verdict.appendChild(vt);
    screen.appendChild(verdict);

    const pct = Math.round((D.scan.checkedIn / D.scan.registered) * 100);
    const prog = E('div', 'scan-progress');
    const bar = E('div', 'scan-progress-bar');
    const fill = E('div', 'scan-progress-fill');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    prog.appendChild(bar);
    prog.appendChild(E('div', 'scan-progress-label', T('checkin.counter', { checked_in: D.scan.checkedIn, registered: D.scan.registered })));
    screen.appendChild(prog);

    const items = scanOutcomes.map((o, i) => ({
      label: o.key,
      active: i === scanState % scanOutcomes.length,
      onClick: () => { scanState = i; renderScan(); },
    }));
    [['forbidden', T('checkin.forbidden')], ['stale', T('checkin.unauthorized')], ['network', T('scan.network_error')], ['server', T('scan.error_server')], ['unsupported', T('scan.unsupported')], ['no_event', T('scan.no_event')], ['not_tg', T('scan.not_in_telegram')]]
      .forEach(([k, txt]) => items.push({ label: k, onClick: () => PROTO.demoNote(txt) }));
    PROTO.setDemo(items, 'Нажатие на кадр — следующий скан (STF-1: сканер не закрывается).');
  }

  // ---------- роут: список ивентов овнера ----------
  function renderManageList() {
    setBar(T('manage.list.title'));
    PROTO.setTrace(['OWN-4', 'ADR-0024', 'ADR-0025']);
    clear();
    const add = linkBtn(T('manage.btn.new'), '#/manage/new', 'btn-primary', 'plus');
    add.style.marginBottom = '14px';
    screen.appendChild(add);

    if (!D.ownerEvents.length) screen.appendChild(emptyState(T('manage.list.empty'), 'calendar'));
    D.ownerEvents.forEach((ev) => screen.appendChild(manageRow(ev)));
    PROTO.setDemo([]);
  }

  function manageRow(ev) {
    const a = E('a', 'ev-row');
    a.href = appHref('#/manage/' + ev.id);
    const main = E('div', 'ev-main');
    main.appendChild(E('div', 'ev-title', ev.title));
    const meta = E('div', 'ev-row-meta');
    meta.appendChild(statusBadge(ev.statusKey));
    meta.appendChild(E('span', '', ev.when));
    main.appendChild(meta);
    main.appendChild(E('div', 'app-muted', T('participants.counters', { registered: ev.registered, checked_in: ev.checkedIn, cancelled: 2 })));
    a.appendChild(main);
    const tail = E('span', 'ev-tail');
    tail.appendChild(PROTO.icon('chevron-right', 18));
    a.appendChild(tail);
    return a;
  }

  // ---------- роут: ивент овнера — визард ----------
  const WIZARD_STEPS = ['main', 'where', 'capacity', 'review'];

  function wizardFields(id) {
    if (wizardDraft) return wizardDraft;
    if (id === 'new') {
      wizardDraft = { title: '', description: '', address: '', lat: null, lon: null, startsLocal: '', endsLocal: '', deadlineLocal: '', capacity: '', overbook: '' };
      return wizardDraft;
    }
    if (String(id) === D.main.id) {
      wizardDraft = {
        title: D.main.title, description: D.main.description, address: D.main.address,
        lat: D.main.lat, lon: D.main.lon, startsLocal: D.main.startsLocal,
        endsLocal: D.main.endsLocal, deadlineLocal: D.main.deadlineLocal,
        capacity: String(D.main.capacity), overbook: String(D.main.overbook),
      };
      return wizardDraft;
    }
    wizardDraft = {
      title: D.draft.title, description: D.draft.description, address: D.draft.address,
      lat: D.draft.lat, lon: D.draft.lon, startsLocal: D.draft.startsLocal,
      endsLocal: D.draft.endsLocal, deadlineLocal: D.draft.deadlineLocal,
      capacity: String(D.draft.capacity || ''), overbook: String(D.draft.overbook || ''),
    };
    return wizardDraft;
  }

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
    setBar(isNew ? T('manage.title.new') : T('manage.title.edit'));
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
      const d = E('span', 'step-dot' + (i < n ? ' done' : '') + (i === n ? ' active' : ''));
      box.appendChild(d);
    }
    return box;
  }

  function renderWizard(body, isNew) {
    PROTO.setTrace(['OWN-1', 'OWN-2', 'OWN-3', 'OWN-4', 'OWN-5', 'OWN-6', 'OWN-15']);
    const f = wizardFields(eventId);
    const step = WIZARD_STEPS[wizardStep];

    if (wizardDone) { renderWizardDone(body); return; }

    const head = E('div', 'wizard-head');
    head.appendChild(stepDots(wizardStep, WIZARD_STEPS.length));
    head.appendChild(E('div', 'wizard-step-label', T('proto.wizard_step', { n: wizardStep + 1, m: WIZARD_STEPS.length })));
    body.appendChild(head);

    const stepTitle = { main: T('proto.section_main'), where: T('proto.section_where'), capacity: T('proto.section_capacity'), review: T('proto.step_review') }[step];
    body.appendChild(E('div', 'wizard-title', stepTitle));

    if (step === 'main') renderWizardMain(body, f);
    else if (step === 'where') renderWizardWhere(body, f);
    else if (step === 'capacity') renderWizardCapacity(body, f);
    else renderWizardReview(body, f, isNew);

    const nav = E('div', 'sticky-actions');
    if (wizardStep > 0) {
      nav.appendChild(btn(T('common.btn.back'), { kind: 'btn-secondary', onClick: () => { wizardStep--; renderManageEvent(eventId); } }));
    }
    if (step !== 'review') {
      nav.appendChild(btn(T('proto.wizard_next'), { kind: 'btn-primary', onClick: () => { wizardStep++; renderManageEvent(eventId); } }));
    } else if (isNew || (String(eventId) === '5')) {
      nav.appendChild(btn(T('manage.btn.publish'), { kind: 'btn-primary', onClick: () => { wizardDone = true; renderManageEvent(eventId); } }));
    } else {
      nav.appendChild(btn(T('manage.btn.save'), { kind: 'btn-primary', onClick: () => PROTO.toast(T('proto.wizard_saved')) }));
    }
    body.appendChild(nav);

    PROTO.setDemo([
      { label: T('manage.err.validation'), active: showErrors, onClick: () => { showErrors = !showErrors; renderManageEvent(eventId); } },
      { label: T('manage.saved.draft'), onClick: () => PROTO.toast(T('proto.wizard_draft')) },
      { label: T('manage.err.network'), onClick: () => PROTO.demoNote(T('manage.err.network')) },
      { label: T('manage.err.stale'), onClick: () => PROTO.demoNote(T('manage.err.stale')) },
    ], T('proto.tab_hint'));
  }

  function renderWizardMain(body, f) {
    const sec = E('div', 'form-section');
    sec.appendChild(field(T('field.title'), f.title, {
      error: showErrors ? T('manage.err.title_length') : '',
      onInput: (e) => { f.title = e.target.value; },
    }));
    sec.appendChild(field(T('field.description'), f.description, {
      textarea: true, hint: T('manage.hint.description'),
      error: showErrors ? T('manage.err.description_length') : '',
      onInput: (e) => { f.description = e.target.value; },
    }));
    body.appendChild(sec);
  }

  function renderWizardWhere(body, f) {
    const sec = E('div', 'form-section');
    sec.appendChild(field(T('field.address'), f.address, {
      hint: T('manage.hint.address'),
      onInput: (e) => { f.address = e.target.value; },
    }));

    const loc = E('div', 'app-field');
    loc.appendChild(E('label', 'label', T('field.geo')));
    const chips = E('div', 'chip-row');
    chips.appendChild(btn(T('proto.paste_link'), { kind: 'btn-outline', size: 'btn-sm', icon: 'link', onClick: () => openLinkSheet(f) }));
    chips.appendChild(btn(T('proto.pick_on_map'), { kind: 'btn-outline', size: 'btn-sm', icon: 'map-pin', onClick: () => openMapSheet(f) }));
    loc.appendChild(chips);
    if (f.lat !== null && f.lon !== null) {
      loc.appendChild(locPreview(f));
      loc.appendChild(E('div', 'helper', T('proto.coords', { lat: fmtCoord(f.lat), lon: fmtCoord(f.lon) })));
      const a = E('a', 'loc-link', T('event.card.btn_map'));
      a.href = mapUrl(f.lat, f.lon);
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(PROTO.icon('external', 14));
      loc.appendChild(a);
    } else {
      loc.appendChild(E('div', 'helper', T('proto.location_none')));
    }
    sec.appendChild(loc);

    sec.appendChild(field(T('field.starts_at'), f.startsLocal, { type: 'datetime-local', hint: T('manage.hint.datetime'), onInput: (e) => { f.startsLocal = e.target.value; } }));
    sec.appendChild(field(T('field.ends_at'), f.endsLocal, { type: 'datetime-local', hint: T('manage.hint.datetime'), onInput: (e) => { f.endsLocal = e.target.value; } }));
    sec.appendChild(field(T('field.reg_deadline_at'), f.deadlineLocal, {
      type: 'datetime-local', hint: T('manage.hint.datetime'),
      error: showErrors ? T('manage.err.deadline_after_starts') : '',
      onInput: (e) => { f.deadlineLocal = e.target.value; },
    }));
    body.appendChild(sec);
  }

  function locPreview(f) {
    const box = E('div', 'loc-preview');
    const grid = E('div', 'loc-grid');
    box.appendChild(grid);
    const pin = E('span', 'loc-pin');
    pin.appendChild(PROTO.icon('map-pin', 20));
    pin.style.left = '50%';
    pin.style.top = '46%';
    box.appendChild(pin);
    return box;
  }

  function renderWizardCapacity(body, f) {
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
      live.appendChild(E('div', 'app-muted', T('proto.capacity_limit', { limit: limit })));
    }
    const sec = E('div', 'form-section');
    sec.appendChild(row2(
      field(T('field.capacity'), f.capacity, { type: 'number', hint: T('manage.hint.capacity'), onInput: (e) => { f.capacity = e.target.value; paint(); } }),
      field(T('field.overbook_pct'), f.overbook, { type: 'number', hint: T('manage.hint.overbook'), onInput: (e) => { f.overbook = e.target.value; paint(); } })
    ));
    sec.appendChild(live);
    body.appendChild(sec);
    paint();
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

  function renderWizardReview(body, f, isNew) {
    body.appendChild(E('div', 'app-muted', T('proto.review_hint')));
    const c = E('div', 'event-card preview');
    const plate = plateFromLocal(f.startsLocal);
    if (plate) c.appendChild(datePlate(plate));
    else c.classList.add('no-plate');
    const b = E('div', 'event-body');
    const top = E('div', 'event-top');
    const isDraft = isNew || String(eventId) === '5';
    top.appendChild(E('span', 'event-status', (isDraft ? T('status.draft') : T('status.published')).toUpperCase()));
    b.appendChild(top);
    b.appendChild(E('div', 'event-title', f.title || T('manage.err.required')));
    const meta = E('div', 'ev-meta');
    const line = (icon, text) => {
      const l = E('span', 'ev-meta-line');
      l.appendChild(PROTO.icon(icon, 13));
      l.appendChild(E('span', '', text));
      meta.appendChild(l);
    };
    if (f.address) line('map-pin', f.address);
    if (f.startsLocal) line('calendar', f.startsLocal.replace('T', ' · '));
    if (f.capacity) line('users', T('field.capacity') + ': ' + f.capacity);
    b.appendChild(meta);
    if (f.description) b.appendChild(E('div', 'app-muted', f.description));
    c.appendChild(b);
    body.appendChild(c);

    if (isNew || String(eventId) === '5') {
      const saveDraft = btn(T('proto.save_draft'), { kind: 'btn-outline', block: true, onClick: () => PROTO.toast(T('proto.wizard_draft')) });
      saveDraft.style.marginTop = '14px';
      body.appendChild(saveDraft);
    } else {
      const cancel = E('div');
      cancel.style.marginTop = '16px';
      cancel.appendChild(btn(T('owner.event.btn.cancel_event'), { kind: 'btn-destructive', block: true, onClick: () => openCancelEventSheet(f) }));
      body.appendChild(cancel);
    }
  }

  function renderWizardDone(body) {
    const done = E('div', 'sheet-success');
    const ic = E('div', 'success-icon');
    ic.appendChild(PROTO.icon('check-circle', 34));
    done.appendChild(ic);
    done.appendChild(E('div', 'success-title', T('proto.published_ok')));
    done.appendChild(E('div', 'app-muted', T('proto.published_hint')));
    body.appendChild(done);

    const inv = card([]);
    inv.classList.add('invite-card');
    inv.appendChild(E('div', 'invite-link', D.main.inviteLink));
    const acts = E('div', 'app-actions');
    acts.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-primary', icon: 'copy', onClick: () => PROTO.copy(D.main.inviteLink) }));
    acts.appendChild(btn(T('manage.btn.share'), { kind: 'btn-outline', icon: 'share', onClick: () => window.open('https://t.me/share/url?url=' + encodeURIComponent(D.main.inviteLink), '_blank', 'noopener') }));
    inv.appendChild(acts);
    body.appendChild(inv);

    const back = btn(T('manage.btn.back'), { kind: 'btn-secondary', block: true, onClick: () => { wizardDone = false; wizardStep = 0; go('#/manage'); } });
    back.style.marginTop = '14px';
    body.appendChild(back);
    PROTO.setDemo([]);
  }

  function openCancelEventSheet(f) {
    openSheet(T('owner.event.btn.cancel_event'), (body) => {
      body.appendChild(E('div', 'app-muted', T('proto.confirm_cancel_event', { title: f.title })));
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('common.btn.confirm'), { kind: 'btn-destructive', onClick: () => {
        closeSheet();
        PROTO.toast(T('manage.saved.cancelled'));
        go('#/manage');
      } }));
      acts.appendChild(btn(T('common.btn.cancel'), { kind: 'btn-secondary', onClick: closeSheet }));
      body.appendChild(acts);
    });
  }

  // ---------- гео: ссылка Яндекс.Карт и точка на карте ----------
  function openLinkSheet(f) {
    let error = '';
    openSheet(T('proto.paste_link'), (body) => {
      body.appendChild(E('div', 'app-muted', T('manage.hint.geo')));
      const input = E('input', 'input');
      input.type = 'url';
      input.placeholder = T('proto.link_placeholder');
      body.appendChild(input);
      if (error) body.appendChild(E('div', 'helper error', error));
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('proto.link_apply'), { kind: 'btn-primary', onClick: () => {
        const parsed = parseYandexLink(input.value);
        if (!parsed) { error = T('proto.link_bad'); renderSheet(); return; }
        f.lat = parsed.lat;
        f.lon = parsed.lon;
        closeSheet();
        PROTO.toast(T('proto.link_applied'));
        renderManageEvent(eventId);
      } }));
      body.appendChild(acts);
    });
  }

  function openMapSheet(f) {
    let lat = f.lat !== null ? f.lat : 41.311081;
    let lon = f.lon !== null ? f.lon : 69.279737;
    openSheet(T('proto.pick_on_map'), (body) => {
      body.appendChild(E('div', 'app-muted', T('proto.map_hint')));
      const map = E('div', 'loc-preview pickable');
      map.appendChild(E('div', 'loc-grid'));
      const pin = E('span', 'loc-pin');
      pin.appendChild(PROTO.icon('map-pin', 20));
      map.appendChild(pin);
      const coords = E('div', 'helper');
      function paint() {
        const x = Math.min(96, Math.max(4, ((lon - 69.15) / 0.3) * 100));
        const y = Math.min(96, Math.max(4, ((41.38 - lat) / 0.14) * 100));
        pin.style.left = x + '%';
        pin.style.top = y + '%';
        coords.textContent = T('proto.coords', { lat: fmtCoord(lat), lon: fmtCoord(lon) });
      }
      map.addEventListener('click', (e) => {
        const r = map.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        lon = 69.15 + px * 0.3;
        lat = 41.38 - py * 0.14;
        paint();
      });
      paint();
      body.appendChild(map);
      body.appendChild(coords);
      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('proto.map_apply'), { kind: 'btn-primary', onClick: () => {
        f.lat = lat;
        f.lon = lon;
        closeSheet();
        renderManageEvent(eventId);
      } }));
      body.appendChild(acts);
    });
  }

  // ---------- таб «Участники» ----------
  function renderParticipants(body) {
    PROTO.setTrace(['OWN-7', 'OWN-8']);
    const grid = E('div', 'stat-grid');
    grid.appendChild(stat(D.counts.registered, T('proto.registered_short'), ''));
    grid.appendChild(stat(D.counts.checkedIn, T('proto.checked_in_short'), 'ok'));
    grid.appendChild(stat(D.counts.cancelled, T('proto.cancelled_short'), 'warn'));
    body.appendChild(grid);

    const filters = E('div', 'segmented');
    [['all', T('participants.filter.btn.all')], ['checked_in', T('participants.filter.btn.checked_in')], ['no_show', T('participants.filter.btn.no_show')], ['cancelled', T('participants.filter.btn.cancelled')]]
      .forEach(([key, label]) => {
        const b = btn(label, { kind: 'btn-secondary', size: 'btn-sm', onClick: () => { participantFilter = key; renderManageEvent(eventId); } });
        if (participantFilter === key) b.classList.add('active');
        filters.appendChild(b);
      });
    body.appendChild(filters);

    const list = D.participants.filter((p) => {
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

    const ex = E('div', 'app-actions');
    ex.appendChild(btn(T('export.btn.csv'), { kind: 'btn-outline', icon: 'download', onClick: () => PROTO.toast(T('export.caption', { title: D.main.title, count: D.counts.registered })) }));
    ex.appendChild(btn(T('export.btn.json'), { kind: 'btn-outline', icon: 'download', onClick: () => PROTO.toast(T('export.caption', { title: D.main.title, count: D.counts.registered })) }));
    body.appendChild(ex);
    PROTO.setDemo([]);
  }

  // ---------- таб «Рассылка» ----------
  function renderBroadcastTab(body) {
    PROTO.setTrace(['OWN-9', 'OWN-10', 'OWN-11', 'OWN-12', 'OWN-13']);
    body.appendChild(card([muted(PROTO.protoDict['proto.broadcast_chat_hint'])]));
    body.appendChild(btn(PROTO.t('proto.open_chat'), { kind: 'btn-primary', block: true, icon: 'megaphone', onClick: () => { location.href = PROTO.chatUrl('owner', 'broadcast', true); } }));

    const seg = card([], '');
    seg.appendChild(E('div', 'card-title', T('bcast.ask.segment')));
    [
      [T('bcast.segment.all_consent'), D.segments.all_consent, true],
      [T('bcast.segment.registered'), D.segments.registered, true],
      [T('bcast.segment.checked_in'), D.segments.checked_in, true],
      [T('bcast.segment.no_show'), D.segments.no_show, false],
    ].forEach(([label, count, ok]) => {
      const r = E('div', 'list-row');
      r.appendChild(E('span', 'body', label));
      r.appendChild(E('span', 'tail', ok ? String(count) : '—'));
      if (!ok) r.appendChild(PROTO.icon('clock', 15));
      seg.appendChild(r);
    });
    seg.appendChild(E('div', 'helper', T('bcast.segment.no_show_locked', { when: D.main.ends })));
    body.appendChild(seg);
    PROTO.setDemo([]);
  }

  // ---------- таб «Контролёры»: выбор из списка, не ID руками ----------
  function renderStaff(body) {
    PROTO.setTrace(['OWN-14', 'STF-2', 'DAT-1']);
    body.appendChild(muted(T('proto.staff_hint')));

    if (!D.controllers.length) {
      body.appendChild(emptyState(T('manage.staff.empty'), 'shield'));
    } else {
      const box = card([], 'list-card');
      D.controllers.forEach((s) => {
        const r = E('div', 'list-row staff-row');
        r.appendChild(avatar(s.name, 'avatar-md'));
        const b = E('div', 'body');
        b.appendChild(E('div', 'name', s.name));
        b.appendChild(E('div', 'sub', s.username + ' · ' + T('proto.staff_since', { when: s.since })));
        r.appendChild(b);
        r.appendChild(btn(T('manage.staff.btn.revoke'), { kind: 'btn-outline', size: 'btn-sm', onClick: () => {
          D.controllers = D.controllers.filter((x) => x.id !== s.id);
          PROTO.toast(T('manage.staff.revoked'));
          renderManageEvent(eventId);
        } }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    const add = btn(T('proto.staff_add'), { kind: 'btn-primary', block: true, icon: 'plus', onClick: openStaffPicker });
    add.style.marginTop = '14px';
    body.appendChild(add);
    body.appendChild(E('div', 'helper', T('proto.staff_invite_alt')));
    PROTO.setDemo([]);
  }

  function openStaffPicker() {
    openSheet(T('proto.staff_add'), (body) => {
      body.appendChild(searchField(T('proto.staff_search'), staffQuery, (e) => {
        staffQuery = e.target.value;
        renderSheet();
        const inp = sheet.body.querySelector('input[type="search"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }));
      const q = staffQuery.trim().toLowerCase().replace(/^@/, '');
      const known = D.controllers.map((c) => c.id);
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
          D.controllers.push({ id: p.id, name: p.name, username: p.username, since: '26 сентября, 12:00' });
          staffQuery = '';
          closeSheet();
          PROTO.toast(T('proto.staff_added'));
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
      ['mine', T('proto.tab_my_tickets')],
      ['upcoming', T('events.list.btn.upcoming')],
      ['past', T('events.list.btn.past')],
    ];
    setBar(catalogTab === 'mine' ? T('proto.tab_my_tickets') : catalogTab === 'upcoming' ? T('events.list.upcoming_title') : T('events.list.past_title'));
    PROTO.setTrace(['PAR-3', 'PAR-4', 'ADR-0023', 'PAR-1', 'PAR-2', 'IDM-1']);
    clear();

    const tw = E('div', 'tabs-wrap');
    const tbox = E('div', 'tabs');
    tabsDef.forEach(([key, label]) => {
      const b = E('button', 'tab' + (catalogTab === key ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { catalogTab = key; renderEvents(); });
      tbox.appendChild(b);
    });
    tw.appendChild(tbox);
    screen.appendChild(tw);

    if (catalogTab === 'mine') {
      if (!D.myTickets.length) {
        screen.appendChild(emptyState(T('proto.my_tickets_empty'), 'ticket'));
      } else {
        D.myTickets.forEach((t) => screen.appendChild(ticketRow(t)));
      }
      screen.appendChild(E('div', 'helper', T('proto.tab_my_tickets_hint')));
    } else if (catalogTab === 'upcoming') {
      D.catalog.upcoming.forEach((ev) => screen.appendChild(eventCardEl(ev)));
    } else {
      D.catalog.past.forEach((ev) => screen.appendChild(eventCardEl(ev)));
    }

    PROTO.setDemo([
      { label: T('proto.tab_my_tickets'), active: catalogTab === 'mine', onClick: () => { catalogTab = 'mine'; renderEvents(); } },
      { label: T('events.list.btn.upcoming'), active: catalogTab === 'upcoming', onClick: () => { catalogTab = 'upcoming'; renderEvents(); } },
      { label: T('events.list.btn.past'), active: catalogTab === 'past', onClick: () => { catalogTab = 'past'; renderEvents(); } },
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
    acts.appendChild(linkBtn(T('reg.qr.button'), '#/ticket?event_id=' + t.eventId, 'btn-primary', 'qr'));
    if (!t.upcoming && !t.feedbackGiven) {
      acts.appendChild(linkBtn(T('proto.afterword_feedback'), '#/feedback?event_id=' + t.eventId, 'btn-outline', 'message-square'));
    } else if (!t.upcoming && t.feedbackGiven) {
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
    if (ev.seats !== null && ev.seats !== undefined) metaLine('users', T('event.card.seats_left', { left: ev.seats }));
    if (ev.attended) metaLine('check-circle', T('participants.filter.btn.checked_in') + ': ' + ev.attended);
    body.appendChild(meta);

    const acts = E('div', 'event-actions');
    if (catalogTab === 'upcoming') {
      if (isRegistered(ev.id)) {
        acts.appendChild(linkBtn(T('reg.qr.button'), '#/ticket?event_id=' + ev.id, 'btn-primary', 'qr'));
      } else {
        acts.appendChild(btn(T('event.card.btn_register'), { kind: 'btn-primary', onClick: () => openRegistration(ev) }));
      }
    } else if (ev.attendedMe && !ev.feedbackGiven) {
      acts.appendChild(linkBtn(T('proto.afterword_feedback'), '#/feedback?event_id=' + ev.id, 'btn-outline', 'message-square'));
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
    openSheet(T('proto.reg_title'), (body) => {
      if (done) {
        const ok = E('div', 'sheet-success');
        const ic = E('div', 'success-icon');
        ic.appendChild(PROTO.icon('check-circle', 34));
        ok.appendChild(ic);
        ok.appendChild(E('div', 'success-title', T('proto.reg_done_title')));
        ok.appendChild(E('div', 'app-muted', T('proto.reg_done_hint')));
        body.appendChild(ok);
        const acts = E('div', 'sheet-actions');
        acts.appendChild(btn(T('reg.qr.button'), { kind: 'btn-primary', icon: 'qr', onClick: () => { closeSheet(); go('#/ticket?event_id=' + ev.id); } }));
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
      pdnRow.appendChild(E('span', '', T('proto.reg_pdn')));
      body.appendChild(pdnRow);

      const mktRow = E('label', 'control-row');
      const mktBox = E('input', 'checkbox');
      mktBox.type = 'checkbox';
      mktBox.checked = mkt;
      mktBox.addEventListener('change', () => { mkt = mktBox.checked; });
      mktRow.appendChild(mktBox);
      mktRow.appendChild(E('span', '', T('proto.reg_mkt')));
      body.appendChild(mktRow);
      body.appendChild(E('div', 'helper', T('proto.reg_mkt_hint')));

      const acts = E('div', 'sheet-actions');
      acts.appendChild(btn(T('event.card.btn_register'), {
        kind: 'btn-primary',
        disabled: !pdn,
        onClick: () => {
          ev.registered = true;
          if (D.main.id === String(ev.id)) D.main.registered = true;
          const t = D.myTickets.find((x) => String(x.eventId) === String(ev.id));
          if (!t) {
            D.myTickets.unshift({
              eventId: String(ev.id), title: ev.title, when: ev.when, where: ev.where,
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

  // ---------- роут: форма отзыва (предложение, черновик ADR-0028) ----------
  function renderFeedback() {
    const id = hashParams.get('event_id') || D.feedback.eventId;
    const ev = eventById(id);
    const title = ev ? ev.title : D.feedback.eventTitle;
    setBar(T('proto.feedback_title'));
    PROTO.setTrace(['ADR-0028', 'ADR-0017']);
    clear();

    if (feedbackSent) {
      const ok = E('div', 'sheet-success');
      const ic = E('div', 'success-icon');
      ic.appendChild(PROTO.icon('check-circle', 34));
      ok.appendChild(ic);
      ok.appendChild(E('div', 'success-title', T('proto.feedback_done_title')));
      ok.appendChild(E('div', 'app-muted', T('proto.feedback_done')));
      screen.appendChild(ok);
      const acts = E('div', 'app-actions');
      acts.appendChild(linkBtn(T('proto.feedback_to_events'), '#/events?tab=past', 'btn-primary'));
      screen.appendChild(acts);
      PROTO.setDemo([]);
      return;
    }

    screen.appendChild(E('div', 'app-title', T('proto.feedback_title')));
    screen.appendChild(E('div', 'app-sub', title));
    screen.appendChild(E('div', 'app-muted', T('proto.feedback_lead')));

    const rate = E('div', 'form-section');
    rate.appendChild(E('div', 'section-label', T('proto.feedback_rate')));
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
    screen.appendChild(rate);

    const text = E('div', 'form-section');
    text.appendChild(field(T('proto.feedback_text'), '', { textarea: true, placeholder: T('proto.feedback_placeholder') }));
    screen.appendChild(text);

    const acts = E('div', 'app-actions');
    acts.appendChild(btn(T('proto.feedback_submit'), {
      kind: 'btn-primary', block: true, disabled: feedbackRating === 0,
      onClick: () => {
        const ev2 = ev;
        if (ev2) ev2.feedbackGiven = true;
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
    else if (r.name === 'scan') renderScan();
    else if (r.name === 'manage') renderManageList();
    else if (r.name === 'manage-event') { wizardDone = false; wizardStep = 0; wizardDraft = null; renderManageEvent(r.id); }
    else if (r.name === 'events') {
      const tab = hashParams.get('tab');
      catalogTab = (tab === 'upcoming' || tab === 'past') ? tab : 'mine';
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
