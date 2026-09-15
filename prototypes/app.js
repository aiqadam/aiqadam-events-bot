// Прототип W41 — мок Mini App (ADR-0027).
// Hash-роутер как у продукта: #/ticket, #/scan, #/manage, #/manage/:id,
// #/events. Фейковые данные, никаких вызовов (ADR-0026). Экраны — как
// продукт: брендовые токены, компоненты и иконки Lucide; требования SPEC —
// в отдельном шите трассировки.
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
  let catalogTab = 'upcoming';
  let backUrl = '';
  let eventId = '';

  function currentHash() {
    const raw = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    const parts = raw.split('?');
    const q = new URLSearchParams(parts[1] || '');
    backUrl = q.get('back') || '';
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
    wrap.appendChild(input);
    if (o.hint) wrap.appendChild(E('div', 'helper', o.hint));
    if (o.error) wrap.appendChild(E('div', 'helper error', o.error));
    return wrap;
  }
  function row2(a, b) { const r = E('div', 'app-row2'); r.appendChild(a); r.appendChild(b); return r; }
  function stat(n, label, kind) {
    const s = E('div', 'stat' + (kind ? ' ' + kind : ''));
    s.appendChild(E('div', 'n', String(n)));
    s.appendChild(E('div', 'l', label));
    return s;
  }
  function iconBadge(icon) {
    const a = E('span', 'avatar avatar-sm');
    a.appendChild(PROTO.icon(icon, 16));
    return a;
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

  function statusBadge(statusKey) {
    const kind = statusKey === 'status.published' ? 'success' : statusKey === 'status.draft' ? 'warning' : 'default';
    return badge(T(statusKey), kind);
  }

  // ---------- роут: билет ----------
  function renderTicket() {
    const ev = D.main;
    setBar(T('ticket.title'));
    PROTO.setTrace(['PAR-6', 'IDM-2', 'ADR-0007']);
    clear();

    const top = E('div', 'ticket-top');
    top.appendChild(E('div', 'ticket-event', ev.title));
    const when = E('div', 'ticket-when');
    when.appendChild(PROTO.icon('calendar', 15));
    when.appendChild(E('span', '', ev.whenLong));
    top.appendChild(when);
    const where = E('div', 'ticket-when');
    where.appendChild(PROTO.icon('map-pin', 15));
    where.appendChild(E('span', '', ev.address));
    top.appendChild(where);
    screen.appendChild(top);

    const plate = E('div', 'qr-plate');
    plate.setAttribute('data-theme', 'light');
    plate.appendChild(fakeQr(232));
    screen.appendChild(plate);

    screen.appendChild(E('div', 'ticket-hint', T('ticket.show_at_entrance')));

    PROTO.setDemo([
      { label: 'Билет', active: true },
      { label: T('ticket.loading'), onClick: () => PROTO.demoNote(T('ticket.loading')) },
      { label: T('ticket.error.network'), onClick: () => PROTO.demoNote(T('ticket.error.network')) },
      { label: T('ticket.error.server'), onClick: () => PROTO.demoNote(T('ticket.error.server')) },
      { label: T('ticket.no_event'), onClick: () => PROTO.demoNote(T('ticket.no_event')) },
      { label: T('ticket.not_in_telegram'), onClick: () => PROTO.demoNote(T('ticket.not_in_telegram')) },
    ]);
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

  // ---------- роут: список ивентов ----------
  function renderManageList() {
    setBar(T('manage.list.title'));
    PROTO.setTrace(['OWN-4', 'ADR-0024', 'ADR-0025']);
    clear();
    const add = linkBtn(T('manage.btn.new'), '#/manage/new', 'btn-primary', 'plus');
    add.style.marginBottom = '14px';
    screen.appendChild(add);

    if (!D.ownerEvents.length) {
      const empty = E('div', 'empty-state');
      empty.appendChild(E('div', 'empty-heading', T('manage.list.empty')));
      screen.appendChild(empty);
    }
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

  // ---------- роут: экран ивента ----------
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
    screen.appendChild(tabs());

    const body = E('div', 'app-tab-body');
    if (manageTab === 'event') renderEventForm(body, isNew);
    else if (manageTab === 'participants') renderParticipants(body);
    else if (manageTab === 'broadcast') renderBroadcastTab(body);
    else renderStaff(body);
    screen.appendChild(body);
  }

  function renderEventForm(body, isNew) {
    PROTO.setTrace(['OWN-1', 'OWN-2', 'OWN-3', 'OWN-4', 'OWN-5', 'OWN-6', 'OWN-15']);
    const ev = isNew ? { title: '', description: '', address: '', capacity: '', overbook: '' } : D.main;
    const err = showErrors;

    const main = E('div', 'form-section');
    main.appendChild(E('div', 'form-section-title', T('proto.section_main')));
    main.appendChild(field(T('field.title'), ev.title, { error: err ? T('manage.err.title_length') : '' }));
    main.appendChild(field(T('field.description'), ev.description, { textarea: true, hint: T('manage.hint.description'), error: err ? T('manage.err.description_length') : '' }));
    body.appendChild(main);

    const where = E('div', 'form-section');
    where.appendChild(E('div', 'form-section-title', T('proto.section_where')));
    where.appendChild(field(T('field.address'), ev.address, { hint: T('manage.hint.address') }));
    where.appendChild(row2(
      field(T('field.lat'), String(ev.lat || ''), { type: 'number', error: err ? T('manage.err.geo_pair') : '' }),
      field(T('field.lon'), String(ev.lon || ''), { type: 'number' })
    ));
    where.appendChild(btn(T('manage.btn.locate'), { kind: 'btn-outline', size: 'btn-sm', icon: 'map-pin', onClick: () => PROTO.toast(T('field.geo')) }));
    where.appendChild(field(T('field.starts_at'), ev.startsLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime') }));
    where.appendChild(field(T('field.ends_at'), ev.endsLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime') }));
    where.appendChild(field(T('field.reg_deadline_at'), ev.deadlineLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime'), error: err ? T('manage.err.deadline_after_starts') : '' }));
    body.appendChild(where);

    const cap = E('div', 'form-section');
    cap.appendChild(E('div', 'form-section-title', T('proto.section_capacity')));
    cap.appendChild(row2(
      field(T('field.capacity'), String(ev.capacity || ''), { type: 'number', hint: T('manage.hint.capacity') }),
      field(T('field.overbook_pct'), String(ev.overbook || ''), { type: 'number', hint: T('manage.hint.overbook') })
    ));
    if (!isNew) {
      const st = E('div', 'app-field');
      st.appendChild(E('label', 'label', T('field.status')));
      st.appendChild(statusBadge(ev.statusKey));
      cap.appendChild(st);
    }
    body.appendChild(cap);

    if (!isNew) {
      const inv = E('div', 'form-section');
      inv.appendChild(E('div', 'form-section-title', T('manage.invite.title')));
      const ic = card([]);
      ic.classList.add('invite-card');
      ic.appendChild(E('div', 'invite-link', ev.inviteLink));
      ic.appendChild(muted(T('manage.invite.hint')));
      const acts = E('div', 'app-actions');
      acts.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-secondary', icon: 'copy', onClick: () => PROTO.copy(ev.inviteLink) }));
      acts.appendChild(btn(T('manage.btn.share'), { kind: 'btn-secondary', icon: 'share', onClick: () => window.open('https://t.me/share/url?url=' + encodeURIComponent(ev.inviteLink), '_blank', 'noopener') }));
      ic.appendChild(acts);
      inv.appendChild(ic);

      const utm = E('div', 'card');
      utm.style.marginTop = '10px';
      utm.appendChild(E('div', 'card-title', T('owner.links.title', { title: ev.title })));
      utm.appendChild(E('div', 'utm-row', ''));
      ev.utm.forEach((u) => {
        const r = E('div', 'utm-row');
        r.appendChild(E('span', '', T('owner.links.item', { utm: u.utm, url: '' }).replace(': ', '')));
        r.appendChild(E('span', 'utm-url', u.url));
        utm.appendChild(r);
      });
      inv.appendChild(utm);
      body.appendChild(inv);
    }

    const cancel = E('div');
    cancel.style.marginTop = '16px';
    cancel.appendChild(btn(T('owner.event.btn.cancel_event'), { kind: 'btn-destructive', block: true, onClick: () => { location.href = PROTO.chatUrl('owner', 'cancelled', true); } }));
    body.appendChild(cancel);

    const actions = E('div', 'sticky-actions');
    actions.appendChild(btn(T('manage.btn.save'), { kind: 'btn-secondary', onClick: () => PROTO.toast(T('manage.saved.updated')) }));
    if (isNew || D.main.status === 'draft') {
      actions.appendChild(btn(T('manage.btn.publish'), { kind: 'btn-primary', onClick: () => { location.href = PROTO.chatUrl('owner', 'published', true); } }));
    } else {
      actions.appendChild(btn(T('manage.btn.publish'), { kind: 'btn-primary', onClick: () => { location.href = PROTO.chatUrl('owner', 'updated', true); } }));
    }
    body.appendChild(actions);

    PROTO.setDemo([
      { label: T('manage.err.validation'), active: showErrors, onClick: () => { showErrors = !showErrors; renderManageEvent(id); } },
      { label: T('manage.saved.draft'), onClick: () => PROTO.toast(T('manage.saved.draft')) },
      { label: T('manage.err.network'), onClick: () => PROTO.demoNote(T('manage.err.network')) },
      { label: T('manage.err.stale'), onClick: () => PROTO.demoNote(T('manage.err.stale')) },
    ], T('proto.tab_hint'));
  }

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
      body.appendChild(E('div', 'empty-state', T('participants.empty')));
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

  function renderStaff(body) {
    PROTO.setTrace(['OWN-14', 'STF-2']);
    if (!D.controllers.length) {
      body.appendChild(E('div', 'empty-state', T('manage.staff.empty')));
    } else {
      const box = card([], 'list-card');
      D.controllers.forEach((s) => {
        const r = E('div', 'list-row');
        r.appendChild(iconBadge('shield'));
        const b = E('div', 'body');
        b.appendChild(E('div', 'name', T('manage.staff.item', { id: s.id, when: s.since })));
        r.appendChild(b);
        r.appendChild(btn(T('manage.staff.btn.revoke'), { kind: 'btn-outline', size: 'btn-sm', onClick: () => PROTO.toast(T('manage.staff.revoked')) }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    const add = E('div', 'app-actions');
    const input = E('input', 'input');
    input.type = 'text';
    input.placeholder = T('manage.staff.add_label');
    add.appendChild(input);
    add.appendChild(btn(T('manage.staff.btn.add'), { kind: 'btn-primary', icon: 'plus', onClick: () => {
      const v = input.value.trim();
      PROTO.toast(v ? T('manage.staff.added') : T('manage.err.bad_telegram_id'));
    } }));
    body.appendChild(add);

    const inv = card([], 'invite-card');
    inv.appendChild(E('div', 'card-title', T('staff.btn.invite')));
    inv.appendChild(muted(T('staff.invite.created', { url: 'https://t.me/' + D.botUsername + '?start=s4-9f2c1a' })));
    inv.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-secondary', icon: 'copy', onClick: () => PROTO.copy('https://t.me/' + D.botUsername + '?start=s4-9f2c1a') }));
    body.appendChild(inv);
    PROTO.setDemo([]);
  }

  // ---------- роут: каталог ----------
  function renderEvents() {
    setBar(catalogTab === 'upcoming' ? T('events.list.upcoming_title') : T('events.list.past_title'));
    PROTO.setTrace(['PAR-3', 'ADR-0023', 'OWN-2']);
    clear();

    const tbox = E('div', 'tabs');
    [['upcoming', T('events.list.btn.upcoming')], ['past', T('events.list.btn.past')]].forEach(([key, label]) => {
      const b = E('button', 'tab' + (catalogTab === key ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { catalogTab = key; renderEvents(); });
      tbox.appendChild(b);
    });
    const tw = E('div', 'tabs-wrap');
    tw.appendChild(tbox);
    screen.appendChild(tw);

    const list = catalogTab === 'upcoming' ? D.catalog.upcoming : D.catalog.past;
    if (!list.length) screen.appendChild(E('div', 'empty-state', catalogTab === 'upcoming' ? T('events.list.empty_upcoming') : T('events.list.empty_past')));
    list.forEach((ev) => screen.appendChild(eventCardEl(ev)));

    PROTO.setDemo([
      { label: T('events.list.btn.upcoming'), active: catalogTab === 'upcoming', onClick: () => { catalogTab = 'upcoming'; renderEvents(); } },
      { label: T('events.list.btn.past'), active: catalogTab === 'past', onClick: () => { catalogTab = 'past'; renderEvents(); } },
    ]);
  }

  function eventCardEl(ev) {
    const c = E('div', 'event-card' + (catalogTab === 'past' ? ' past' : ''));
    const plate = E('div', 'date-plate');
    plate.appendChild(E('div', 'month', ev.d ? ev.d.month : ''));
    plate.appendChild(E('div', 'day', ev.d ? ev.d.day : ''));
    plate.appendChild(E('div', 'weekday', ev.d ? ev.d.weekday : ''));
    c.appendChild(plate);

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
    if (catalogTab === 'upcoming') {
      const a = E('a', 'btn btn-primary btn-sm', T('event.card.btn_register'));
      a.href = PROTO.chatUrl('guest', 'event');
      a.style.textDecoration = 'none';
      a.style.alignSelf = 'flex-start';
      body.appendChild(a);
    }
    c.appendChild(body);
    return c;
  }

  // ---------- роутер ----------
  function parseRoute() {
    const p = currentHash();
    if (p === '/ticket' || p === '/ticket/') return { name: 'ticket' };
    if (p === '/scan' || p === '/scan/') return { name: 'scan' };
    if (p === '/manage' || p === '/manage/') return { name: 'manage' };
    if (p.startsWith('/manage/')) return { name: 'manage-event', id: p.slice('/manage/'.length).split('/')[0] || 'new' };
    if (p === '/events' || p === '/events/') return { name: 'events' };
    return { name: 'index' };
  }

  function route() {
    const r = parseRoute();
    if (r.name === 'ticket') renderTicket();
    else if (r.name === 'scan') renderScan();
    else if (r.name === 'manage') renderManageList();
    else if (r.name === 'manage-event') renderManageEvent(r.id);
    else if (r.name === 'events') renderEvents();
    else {
      setBar('Mini App');
      PROTO.setTrace([]);
      clear();
      screen.appendChild(heading('Mini App', 'app-title'));
      const box = E('div', 'app-actions');
      [['#/ticket?event_id=' + D.main.id, T('ticket.title')], ['#/scan?event_id=' + D.main.id, T('scan.title')], ['#/manage', T('manage.list.title')], ['#/events', T('events.list.upcoming_title')]].forEach(([route_, label]) => box.appendChild(linkBtn(label, route_, 'btn-secondary')));
      screen.appendChild(box);
      PROTO.setDemo([]);
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
