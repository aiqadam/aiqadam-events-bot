// Прототип W41 — мок Mini App (ADR-0027).
// Hash-роутер как у продукта: #/ticket, #/scan, #/manage, #/manage/:id,
// #/events. Фейковые данные, никаких вызовов (ADR-0026). Экраны — как
// продукт: брендовые токены и компоненты, без служебных бейджей; требования
// SPEC — в отдельном слое трассировки.
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
  let backUrl = '';

  // Hash читается заново на каждом route(): переход внутри Mini App меняет
  // только hash, и страница не перезагружается (как в живом SPA).
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

  function card(children, cls) {
    const c = E('div', 'card' + (cls ? ' ' + cls : ''));
    (children || []).forEach((n) => { if (n) c.appendChild(n); });
    return c;
  }
  function heading(text, cls) { return E('div', cls || 'app-h2', text); }
  function muted(text) { return E('div', 'app-muted', text); }
  function btn(label, opts) {
    const o = opts || {};
    const b = E('button', 'btn ' + (o.kind || 'btn-primary') + (o.size ? ' ' + o.size : ''), label);
    b.type = 'button';
    if (o.block) b.style.width = '100%';
    if (o.onClick) b.addEventListener('click', o.onClick);
    if (o.disabled) { b.disabled = true; if (o.title) b.title = o.title; }
    return b;
  }
  function linkBtn(label, route, kind) {
    const a = E('a', 'btn ' + (kind || 'btn-primary'), label);
    a.href = appHref(route);
    a.style.textDecoration = 'none';
    return a;
  }
  function badge(text, kind) {
    return E('span', 'badge' + (kind ? ' badge-' + kind : ''), text);
  }
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
  function row2(a, b) {
    const r = E('div', 'app-row2');
    r.appendChild(a); r.appendChild(b);
    return r;
  }

  // ---------- фейковый QR ----------
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
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if ((x < 8 && y < 8) || (x < 8 && y >= n - 8) || (x >= n - 8 && y < 8)) continue;
        if (rnd() > 0.5) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return c;
  }

  // ---------- демо-контролы (обвязка прототипа) ----------
  function renderDemo(items) {
    const box = document.querySelector('[data-proto-demo]');
    if (!box) return;
    PROTO.clear(box);
    const row = E('div', 'proto-demo-row');
    row.appendChild(E('span', 'proto-demo-label', PROTO.t('proto.demo_controls')));
    (items || []).forEach((it) => {
      if (it.active) row.appendChild(E('span', 'proto-chip active', it.label));
      else {
        const a = PROTO.protoLink(it.label, it.href || location.pathname + location.hash);
        if (it.onClick) {
          a.addEventListener('click', (ev) => { ev.preventDefault(); it.onClick(); });
        }
        row.appendChild(a);
      }
    });
    box.appendChild(row);
  }

  // ---------- роут: билет ----------
  function renderTicket() {
    const ev = D.main;
    setBar(T('ticket.title'));
    PROTO.setTrace(['PAR-6', 'IDM-2', 'ADR-0007']);
    clear();
    screen.appendChild(heading(T('ticket.header'), 'app-title'));

    const info = card([
      E('div', 'app-card-title', T('event.card.header', { title: ev.title })),
      E('div', 'app-muted', T('event.card.when', { when: ev.whenLong })),
      E('div', 'app-muted', T('event.card.where', { address: ev.address })),
    ]);
    screen.appendChild(info);

    const plate = E('div', 'qr-plate');
    plate.setAttribute('data-theme', 'light');
    plate.appendChild(fakeQr(200));
    screen.appendChild(plate);
    screen.appendChild(E('div', 'app-muted app-center', T('ticket.show_at_entrance')));
    screen.appendChild(E('div', 'app-hint', T('ticket.hint')));

    renderDemo([
      { label: 'Билет', active: true },
      { label: T('ticket.loading'), onClick: () => toastState(T('ticket.loading')) },
      { label: T('ticket.error.network'), onClick: () => toastState(T('ticket.error.network')) },
      { label: T('ticket.error.server'), onClick: () => toastState(T('ticket.error.server')) },
      { label: T('ticket.no_event'), onClick: () => toastState(T('ticket.no_event')) },
      { label: T('ticket.not_in_telegram'), onClick: () => toastState(T('ticket.not_in_telegram')) },
    ]);
  }

  function toastState(text) {
    const box = document.querySelector('[data-proto-demo]');
    if (!box) return;
    const old = box.querySelector('.proto-state-note');
    if (old) old.remove();
    const n = E('div', 'proto-state-note', text);
    box.appendChild(n);
  }

  // ---------- роут: сканер ----------
  const scanOutcomes = [
    { key: 'ok', tone: 'ok', label: () => T('checkin.ok', { name: 'Азиза Каримова' }) },
    { key: 'already', tone: 'warn', label: () => T('checkin.already', { time: D.scan.alreadyAt }) },
    { key: 'not_registered', tone: 'bad', label: () => T('checkin.not_registered') },
    { key: 'wrong_event', tone: 'bad', label: () => T('checkin.wrong_event') },
  ];

  function renderScan() {
    const ev = D.main;
    setBar(T('scan.title'));
    PROTO.setTrace(['STF-1', 'STF-2', 'STF-4', 'IDM-2']);
    clear();
    screen.appendChild(heading(T('scan.title'), 'app-title'));

    const view = E('div', 'scan-view');
    view.appendChild(E('div', 'scan-frame'));
    view.appendChild(E('div', 'scan-hint', T('scan.hint')));
    screen.appendChild(view);

    const outcome = scanOutcomes[scanState % scanOutcomes.length];
    const verdict = E('div', 'verdict ' + outcome.tone);
    verdict.appendChild(E('div', 'verdict-text', outcome.label()));
    verdict.appendChild(E('div', 'verdict-sub', T('scan.rescan')));
    screen.appendChild(verdict);

    screen.appendChild(E('div', 'app-muted app-center', T('checkin.counter', { checked_in: D.scan.checkedIn, registered: D.scan.registered })));

    const scanBtn = btn(PROTO.t('proto.demo_scan'), {
      block: true, size: 'btn-lg',
      onClick: () => { scanState++; renderScan(); },
    });
    screen.appendChild(scanBtn);

    const errs = [
      ['forbidden', T('checkin.forbidden')],
      ['stale', T('checkin.unauthorized')],
      ['network', T('scan.network_error')],
      ['server', T('scan.error_server')],
      ['unsupported', T('scan.unsupported')],
      ['no_event', T('scan.no_event')],
      ['not_tg', T('scan.not_in_telegram')],
    ];
    const items = scanOutcomes.map((o, i) => ({ label: o.key, active: i === scanState % scanOutcomes.length, onClick: () => { scanState = i; renderScan(); } }));
    errs.forEach(([k, txt]) => items.push({ label: k, onClick: () => toastState(txt) }));
    renderDemo(items);
  }

  // ---------- роут: список ивентов ----------
  function statusBadge(statusKey) {
    const kind = statusKey === 'status.published' ? 'success' : statusKey === 'status.draft' ? 'warning' : 'default';
    return badge(T(statusKey), kind);
  }

  function renderManageList() {
    setBar(T('manage.list.title'));
    PROTO.setTrace(['OWN-4', 'ADR-0024', 'ADR-0025']);
    clear();
    screen.appendChild(heading(T('manage.list.title'), 'app-title'));
    screen.appendChild(linkBtn(T('manage.btn.new'), '#/manage/new', 'btn-primary'));

    if (!D.ownerEvents.length) {
      const empty = E('div', 'empty-state');
      empty.appendChild(E('div', 'empty-heading', T('manage.list.empty')));
      screen.appendChild(empty);
    }
    D.ownerEvents.forEach((ev) => {
      const c = E('a', 'card hoverable app-event-row');
      c.href = appHref('#/manage/' + ev.id);
      c.appendChild(E('div', 'app-card-title', ev.title));
      const meta = E('div', 'app-event-meta');
      meta.appendChild(E('span', '', ev.when));
      meta.appendChild(statusBadge(ev.statusKey));
      c.appendChild(meta);
      if (ev.author) c.appendChild(E('div', 'app-muted', T('manage.list.author')));
      c.appendChild(E('div', 'app-muted', T('participants.counters', { registered: ev.registered, checked_in: ev.checkedIn, cancelled: 2 })));
      screen.appendChild(c);
    });
    renderDemo([]);
  }

  // ---------- роут: экран ивента (форма/участники/рассылка/контролёры) ----------
  function tabs() {
    const box = E('div', 'tabs');
    const items = [
      ['event', T('proto.tab_event')],
      ['participants', T('owner.event.btn.participants')],
      ['broadcast', T('owner.event.btn.broadcast')],
      ['staff', T('manage.staff.title')],
    ];
    items.forEach(([key, label]) => {
      const b = E('button', 'tab' + (manageTab === key ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { manageTab = key; renderManageEvent(eventId); });
      box.appendChild(b);
    });
    return box;
  }

  let eventId = '';

  function renderManageEvent(id) {
    eventId = id;
    const isNew = id === 'new';
    setBar(isNew ? T('manage.title.new') : T('manage.title.edit'));
    clear();

    const back = E('button', 'btn btn-ghost btn-sm', '← ' + T('manage.btn.back'));
    back.type = 'button';
    back.addEventListener('click', () => go('#/manage'));
    screen.appendChild(back);
    screen.appendChild(heading(isNew ? T('manage.title.new') : T('manage.title.edit'), 'app-title'));
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
    const ev = isNew ? { title: '', description: '', address: '', when: '', ends: '', deadline: '', capacity: '', overbook: '' } : D.main;
    const err = showErrors;

    const f = card([]);
    f.appendChild(field(T('field.title'), ev.title, { error: err ? T('manage.err.title_length') : '' }));
    f.appendChild(field(T('field.description'), ev.description, { textarea: true, hint: T('manage.hint.description'), error: err ? T('manage.err.description_length') : '' }));
    f.appendChild(field(T('field.address'), ev.address, { hint: T('manage.hint.address') }));
    f.appendChild(row2(
      field(T('field.lat'), String(ev.lat || ''), { type: 'number', error: err ? T('manage.err.geo_pair') : '' }),
      field(T('field.lon'), String(ev.lon || ''), { type: 'number' })
    ));
    f.appendChild(btn(T('manage.btn.locate'), { kind: 'btn-outline', size: 'btn-sm', onClick: () => PROTO.toast(T('field.geo')) }));
    f.appendChild(field(T('field.starts_at'), ev.startsLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime') }));
    f.appendChild(field(T('field.ends_at'), ev.endsLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime') }));
    f.appendChild(field(T('field.reg_deadline_at'), ev.deadlineLocal || '', { type: 'datetime-local', hint: T('manage.hint.datetime'), error: err ? T('manage.err.deadline_after_starts') : '' }));
    f.appendChild(row2(
      field(T('field.capacity'), String(ev.capacity || ''), { type: 'number', hint: T('manage.hint.capacity') }),
      field(T('field.overbook_pct'), String(ev.overbook || ''), { type: 'number', hint: T('manage.hint.overbook') })
    ));
    if (!isNew) {
      const st = E('div', 'app-field');
      st.appendChild(E('label', 'label', T('field.status')));
      st.appendChild(statusBadge(ev.statusKey));
      f.appendChild(st);
    }
    body.appendChild(f);

    const actions = E('div', 'app-actions');
    actions.appendChild(btn(T('manage.btn.save'), { kind: 'btn-secondary', block: true, onClick: () => PROTO.toast(T('manage.saved.updated')) }));
    if (isNew || D.main.status === 'draft') {
      actions.appendChild(btn(T('manage.btn.publish'), { kind: 'btn-primary', block: true, onClick: () => { location.href = PROTO.chatUrl('owner', 'published', true); } }));
    } else {
      actions.appendChild(btn(T('manage.btn.publish'), { kind: 'btn-primary', block: true, onClick: () => { location.href = PROTO.chatUrl('owner', 'updated', true); } }));
    }
    actions.appendChild(btn(T('owner.event.btn.cancel_event'), { kind: 'btn-destructive', block: true, onClick: () => { location.href = PROTO.chatUrl('owner', 'cancelled', true); } }));
    body.appendChild(actions);

    if (!isNew) {
      body.appendChild(heading(T('manage.invite.title'), 'app-h3'));
      const inv = card([
        E('div', 'mono app-link', ev.inviteLink),
        E('div', 'app-muted', T('manage.invite.hint')),
      ]);
      body.appendChild(inv);
      const invActions = E('div', 'app-actions');
      invActions.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-secondary', onClick: () => PROTO.copy(ev.inviteLink) }));
      invActions.appendChild(btn(T('manage.btn.share'), { kind: 'btn-secondary', onClick: () => window.open('https://t.me/share/url?url=' + encodeURIComponent(ev.inviteLink), '_blank', 'noopener') }));
      invActions.appendChild(btn(T('owner.btn.new_link'), { kind: 'btn-outline', onClick: () => PROTO.toast(T('owner.links.title', { title: ev.title })) }));
      body.appendChild(invActions);
    }

    renderDemo([
      { label: T('manage.err.validation'), active: showErrors, onClick: () => { showErrors = !showErrors; renderManageEvent(id); } },
      { label: T('manage.saved.draft'), onClick: () => PROTO.toast(T('manage.saved.draft')) },
    ]);
  }

  let participantFilter = 'all';

  function renderParticipants(body) {
    PROTO.setTrace(['OWN-7', 'OWN-8']);
    body.appendChild(card([
      E('div', 'app-muted', T('participants.counters', { registered: D.counts.registered, checked_in: D.counts.checkedIn, cancelled: D.counts.cancelled })),
    ]));

    const filters = E('div', 'app-filters');
    const filterDefs = [
      ['all', T('participants.filter.btn.all')],
      ['checked_in', T('participants.filter.btn.checked_in')],
      ['no_show', T('participants.filter.btn.no_show')],
      ['cancelled', T('participants.filter.btn.cancelled')],
    ];
    filterDefs.forEach(([key, label]) => {
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
      const box = card([]);
      list.forEach((p) => {
        const r = E('div', 'app-list-row');
        r.appendChild(E('span', 'app-list-name', T('participants.item', { name: p.name, status: T(p.statusKey) })));
        if (p.at) r.appendChild(E('span', 'mono app-muted', p.at));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    body.appendChild(heading(T('export.btn.csv') + ' / ' + T('export.btn.json'), 'app-h3'));
    const ex = E('div', 'app-actions');
    ex.appendChild(btn(T('export.btn.csv'), { kind: 'btn-outline', onClick: () => PROTO.toast(T('export.caption', { title: D.main.title, count: D.counts.registered })) }));
    ex.appendChild(btn(T('export.btn.json'), { kind: 'btn-outline', onClick: () => PROTO.toast(T('export.caption', { title: D.main.title, count: D.counts.registered })) }));
    body.appendChild(ex);
    renderDemo([]);
  }

  function renderBroadcastTab(body) {
    PROTO.setTrace(['OWN-9', 'OWN-10', 'OWN-11', 'OWN-12', 'OWN-13']);
    body.appendChild(card([
      E('div', 'app-muted', PROTO.protoDict['proto.broadcast_chat_hint']),
    ]));
    const b = btn(PROTO.t('proto.open_chat'), { kind: 'btn-primary', block: true, onClick: () => { location.href = PROTO.chatUrl('owner', 'broadcast', true); } });
    body.appendChild(b);

    const seg = card([]);
    seg.appendChild(heading(T('bcast.ask.segment'), 'app-h3'));
    const segs = [
      [T('bcast.segment.all_consent'), D.segments.all_consent, true],
      [T('bcast.segment.registered'), D.segments.registered, true],
      [T('bcast.segment.checked_in'), D.segments.checked_in, true],
      [T('bcast.segment.no_show'), D.segments.no_show, false],
    ];
    segs.forEach(([label, count, ok]) => {
      const r = E('div', 'app-list-row');
      r.appendChild(E('span', 'app-list-name', label));
      r.appendChild(E('span', 'mono app-muted', ok ? String(count) : '—'));
      seg.appendChild(r);
    });
    seg.appendChild(E('div', 'helper', T('bcast.segment.no_show_locked', { when: D.main.ends })));
    body.appendChild(seg);
    renderDemo([]);
  }

  function renderStaff(body) {
    PROTO.setTrace(['OWN-14', 'STF-2']);
    body.appendChild(heading(T('manage.staff.title'), 'app-h3'));
    if (!D.controllers.length) {
      body.appendChild(E('div', 'empty-state', T('manage.staff.empty')));
    } else {
      const box = card([]);
      D.controllers.forEach((s) => {
        const r = E('div', 'app-list-row');
        r.appendChild(E('span', 'app-list-name', T('manage.staff.item', { id: s.id, when: s.since })));
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
    add.appendChild(btn(T('manage.staff.btn.add'), { kind: 'btn-primary', onClick: () => {
      const v = input.value.trim();
      PROTO.toast(v ? T('manage.staff.added') : T('manage.err.bad_telegram_id'));
    } }));
    body.appendChild(add);

    body.appendChild(heading(T('staff.btn.invite'), 'app-h3'));
    const inv = card([E('div', 'app-muted', T('staff.invite.created', { url: 'https://t.me/' + D.botUsername + '?start=s4-9f2c1a' }))]);
    body.appendChild(inv);
    body.appendChild(btn(T('manage.btn.copy'), { kind: 'btn-secondary', onClick: () => PROTO.copy('https://t.me/' + D.botUsername + '?start=s4-9f2c1a') }));
    renderDemo([]);
  }

  // ---------- роут: каталог ----------
  let catalogTab = 'upcoming';

  function renderEvents() {
    setBar(T('events.list.upcoming_title'));
    PROTO.setTrace(['PAR-3', 'ADR-0023', 'OWN-2']);
    clear();
    screen.appendChild(heading(T('events.list.upcoming_title'), 'app-title'));

    const tbox = E('div', 'tabs');
    [['upcoming', T('events.list.btn.upcoming')], ['past', T('events.list.btn.past')]].forEach(([key, label]) => {
      const b = E('button', 'tab' + (catalogTab === key ? ' active' : ''), label);
      b.type = 'button';
      b.addEventListener('click', () => { catalogTab = key; renderEvents(); });
      tbox.appendChild(b);
    });
    screen.appendChild(tbox);

    const list = catalogTab === 'upcoming' ? D.catalog.upcoming : D.catalog.past;
    if (!list.length) {
      screen.appendChild(E('div', 'empty-state', catalogTab === 'upcoming' ? T('events.list.empty_upcoming') : T('events.list.empty_past')));
    }
    list.forEach((ev) => screen.appendChild(eventCardEl(ev)));

    renderDemo([
      { label: T('events.list.btn.upcoming'), active: catalogTab === 'upcoming', onClick: () => { catalogTab = 'upcoming'; renderEvents(); } },
      { label: T('events.list.btn.past'), active: catalogTab === 'past', onClick: () => { catalogTab = 'past'; renderEvents(); } },
      { label: T('events.list.empty_upcoming'), onClick: () => toastState(T('events.list.empty_upcoming')) },
    ]);
  }

  function eventCardEl(ev) {
    const c = E('div', 'event-card' + (catalogTab === 'past' ? ' past' : ''));
    const plate = E('div', 'date-plate');
    const parts = (ev.when || '').split(' · ');
    plate.appendChild(E('div', 'month', parts[0] || ''));
    plate.appendChild(E('div', 'day', (ev.when.match(/(\d+)/) || ['', ''])[1]));
    c.appendChild(plate);
    const body = E('div', 'event-body');
    const top = E('div', 'event-top');
    top.appendChild(E('span', 'event-status', (ev.status === 'finished' ? T('status.finished') : T('status.published')).toUpperCase()));
    if (ev.tag) top.appendChild(badge('#' + ev.tag, 'primary'));
    body.appendChild(top);
    body.appendChild(E('div', 'event-title', ev.title));
    const meta = E('div', 'event-meta');
    meta.appendChild(E('span', '', ev.when));
    meta.appendChild(E('span', 'sep', '·'));
    meta.appendChild(E('span', '', ev.where));
    if (ev.seats !== null && ev.seats !== undefined) {
      meta.appendChild(E('span', 'sep', '·'));
      meta.appendChild(E('span', '', T('event.card.seats_left', { left: ev.seats })));
    }
    if (ev.attended) {
      meta.appendChild(E('span', 'sep', '·'));
      meta.appendChild(E('span', '', T('participants.filter.btn.checked_in') + ': ' + ev.attended));
    }
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
      renderDemo([]);
    }
  }

  async function init() {
    await PROTO.loadI18n();
    PROTO.initChrome({ title: 'Мок Mini App' });
    window.addEventListener('hashchange', route);
    route();
    const close = document.querySelector('[data-proto-close]');
    if (close) close.href = backUrl || 'index.html';
  }

  void init();
})();
