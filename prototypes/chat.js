// Прототип W41 — мок чата Telegram (ADR-0027).
// Рендерит сценарии из scenarios.js в вёрстке, повторяющей Telegram:
// пузыри, карточки, inline-клавиатура. Карточка диалога редактируется на
// месте (ADR-0017 п. 1). Трассировка и демо-контролы — в шитах обвязки.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

(function () {
  const chatRoot = document.getElementById('chat');
  const params = new URLSearchParams(location.search);
  const scenarioId = params.get('s') || 'guest';
  const startStep = params.get('step') || '';
  const doResume = params.get('resume') === '1';
  const stateKey = 'proto-chat-' + scenarioId;

  let scenarios = null;
  let sc = null;
  let rendered = [];
  let activeCardEl = null;
  let activeCardId = null;
  let finished = false;

  const cardIcons = {
    event: 'calendar', 'consent-pdn': 'calendar', 'consent-mkt': 'calendar', done: 'ticket',
    'pdn-declined': 'alert', 'menu-guest': 'list', myreg: 'ticket', cancel: 'alert',
    'cancel-done': 'check-circle', 'cancel-kept': 'check-circle', 'st-already': 'ticket',
    'st-no-seats': 'alert', 'st-deadline': 'clock', 'st-not-published': 'alert',
    'st-cancelled': 'alert', 'st-finished': 'alert', 'st-bad-payload': 'alert',
    menu: 'list', published: 'megaphone', invite: 'link', links: 'link', notify: 'megaphone',
    broadcast: 'megaphone', segment: 'megaphone', preview: 'megaphone', tested: 'megaphone',
    sent: 'megaphone', 'staff-invite': 'shield', 'accept-ok': 'shield',
    'st-accept-invalid': 'shield', 'st-accept-used': 'shield', 'st-accept-expired': 'shield',
  };

  function loadState() {
    try {
      const raw = sessionStorage.getItem(stateKey);
      if (!raw) return null;
      const st = JSON.parse(raw);
      return st && st.scenario === scenarioId ? st : null;
    } catch (e) { return null; }
  }
  function saveState() {
    try { sessionStorage.setItem(stateKey, JSON.stringify({ scenario: scenarioId, rendered: rendered, activeCard: activeCardId })); } catch (e) { /* noop */ }
  }
  function resetState() { try { sessionStorage.removeItem(stateKey); } catch (e) { /* noop */ } }

  function findStep(id) { return sc.steps.find((s) => s.id === id) || null; }
  function indexOf(id) { return sc.steps.findIndex((s) => s.id === id); }
  function scrollDown() { const scr = chatRoot.parentElement; if (scr) scr.scrollTop = scr.scrollHeight; }

  // ---------- отрисовка ----------
  function bubble(kind, text, opts) {
    const o = opts || {};
    const row = PROTO.el('div', 'tg-row ' + (kind === 'user' ? 'out' : 'in'));
    const b = PROTO.el('div', 'tg-bubble ' + (kind === 'user' ? 'tg-out' : 'tg-in'));
    if (o.forwarded) b.appendChild(PROTO.el('div', 'tg-forwarded', PROTO.t('proto.forwarded_from')));
    b.appendChild(PROTO.el('div', 'tg-text', text));
    b.appendChild(PROTO.el('span', 'tg-time', o.time || PROTO.nowTime()));
    row.appendChild(b);
    chatRoot.appendChild(row);
    scrollDown();
    return b;
  }

  function splitLine(line) {
    const i = line.indexOf(': ');
    if (i < 0) return { v: line };
    return { k: line.slice(0, i), v: line.slice(i + 2) };
  }

  function buildCard(step) {
    const card = step.card || {};
    const b = PROTO.el('div', 'tg-bubble tg-in tg-card');
    const head = PROTO.el('div', 'tg-card-head');
    const mark = PROTO.el('span', 'tg-card-mark');
    mark.appendChild(PROTO.icon(cardIcons[step.id] || 'calendar', 18));
    head.appendChild(mark);
    const titles = PROTO.el('div', 'tg-card-titles');
    titles.appendChild(PROTO.el('div', 'tg-card-title', card.title || ''));
    const sub = step.cardSub || '';
    if (sub) titles.appendChild(PROTO.el('div', 'tg-card-sub', sub));
    head.appendChild(titles);
    b.appendChild(head);

    if (card.lines && card.lines.length) {
      const box = PROTO.el('div', 'tg-card-lines');
      card.lines.forEach((line) => {
        const parts = splitLine(line);
        const row = PROTO.el('div', 'tg-card-line');
        if (parts.k) row.appendChild(PROTO.el('span', 'k', parts.k));
        row.appendChild(PROTO.el('span', 'v', parts.v));
        box.appendChild(row);
      });
      b.appendChild(box);
    }
    if (card.body) {
      const body = PROTO.el('div', 'tg-card-body');
      if (card.bodyMuted) body.classList.add('muted');
      body.textContent = card.body;
      b.appendChild(body);
    }
    if (card.link) {
      const a = PROTO.el('a', 'tg-card-link');
      a.href = card.link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(PROTO.icon('map-pin', 15));
      a.appendChild(PROTO.el('span', '', card.link.text));
      b.appendChild(a);
    }
    return b;
  }

  function renderButtons(container, buttons) {
    if (!buttons || !buttons.length) return;
    const kbd = PROTO.el('div', 'tg-kbd');
    buttons.forEach((btn) => {
      const el = PROTO.el('button', 'tg-kbd-btn');
      el.type = 'button';
      if (btn.primary) el.classList.add('primary');
      if (btn.tone === 'danger') el.classList.add('danger');
      if (btn.locked) el.classList.add('locked');
      if (btn.disabled) { el.classList.add('disabled'); el.disabled = true; }
      el.textContent = btn.label;
      el.addEventListener('click', () => onButton(btn));
      kbd.appendChild(el);
      if (btn.disabled && btn.note) kbd.appendChild(PROTO.el('div', 'tg-kbd-note', btn.note));
    });
    container.appendChild(kbd);
  }

  function renderStep(step, replay, time) {
    PROTO.setTrace(step.trace || []);
    if (step.kind === 'user') {
      bubble('user', step.text, { forwarded: step.forwarded, time: time });
    } else if (step.kind === 'bot') {
      const b = bubble('bot', step.text, { time: time });
      renderButtons(b, step.buttons);
    } else if (step.kind === 'card') {
      let b;
      if (step.edit && activeCardEl) {
        b = activeCardEl;
        PROTO.clear(b);
        const fresh = buildCard(step);
        while (fresh.firstChild) b.appendChild(fresh.firstChild);
      } else {
        const row = PROTO.el('div', 'tg-row in');
        b = buildCard(step);
        row.appendChild(b);
        chatRoot.appendChild(row);
        activeCardEl = b;
      }
      activeCardId = step.id;
      b.appendChild(PROTO.el('span', 'tg-time', time || PROTO.nowTime()));
      renderButtons(b, step.buttons);
      scrollDown();
    }
    if (!replay) { rendered.push({ id: step.id, time: time || PROTO.nowTime() }); saveState(); }
  }

  function finish() { finished = true; renderDemo(); }

  function advanceFrom(index) {
    if (finished) return;
    const next = sc.steps[index + 1];
    if (!next || next.state) { finish(); return; }
    renderStep(next, false);
    if (!next.buttons || !next.buttons.length) setTimeout(() => advanceFrom(index + 1), 420);
  }
  function runIndex(i) {
    if (i < 0 || i >= sc.steps.length) { finish(); return; }
    const step = sc.steps[i];
    renderStep(step, false);
    if (!step.buttons || !step.buttons.length) setTimeout(() => advanceFrom(i), 420);
  }
  function runId(id) {
    if (!id || id === 'end') { finish(); return; }
    const i = indexOf(id);
    if (i < 0) { finish(); return; }
    runIndex(i);
  }

  function onButton(btn) {
    if (btn.disabled) return;
    if (btn.copy) { PROTO.copy(btn.copy); return; }
    if (btn.share) { window.open('https://t.me/share/url?url=' + encodeURIComponent(btn.share), '_blank', 'noopener'); return; }
    if (btn.webApp) {
      saveState();
      const back = PROTO.chatUrl(scenarioId, btn.resume || '', true);
      location.href = PROTO.appUrl(btn.webApp, back);
      return;
    }
    if (btn.go) runId(btn.go);
  }

  // ---------- демо-контролы (в шите обвязки, не на экране) ----------
  const quickIndex = {
    guest: [['event', 'Карточка ивента'], ['consent-pdn', 'Согласие на данные'], ['consent-mkt', 'Согласие на анонсы'], ['done', 'Билет'], ['reminders', 'Напоминания'], ['afterword', 'Послесловие'], ['myreg', 'Мои регистрации']],
    owner: [['menu', 'Меню'], ['published', 'Публикация'], ['updated', 'Правка ивента'], ['broadcast', 'Рассылка'], ['staff-invite', 'Инвайт контролёра']],
    controller: [['accept-ok', 'Инвайт принят'], ['menu', 'Меню']],
  };

  function renderDemo() {
    const items = [];
    (quickIndex[scenarioId] || []).forEach(([id, label]) => {
      items.push({ label: label, href: PROTO.chatUrl(scenarioId, id) });
    });
    (PROTO.stateIndex[scenarioId] || []).forEach(([id, label]) => {
      items.push({ label: label, href: PROTO.chatUrl(scenarioId, id) });
    });
    items.push({ label: PROTO.t('proto.reset'), href: PROTO.chatUrl(scenarioId) });
    const note = sc.hint + (finished ? '\n\nСценарий завершён.' : '');
    PROTO.setDemo(items, note);
  }

  async function init() {
    await PROTO.loadI18n();
    PROTO.initChrome({ title: 'Мок чата · ' + scenarioId, dockLabel: 'Сценарий' });
    scenarios = PROTO.buildScenarios();
    sc = scenarios[scenarioId] || scenarios.guest;
    renderDemo();

    const saved = (startStep && doResume) ? loadState() : null;
    if (saved) {
      rendered = saved.rendered || [];
      rendered.forEach((entry) => { const st = findStep(entry.id); if (st) renderStep(st, true, entry.time); });
    } else resetState();
    if (startStep) runId(startStep); else runIndex(0);
  }

  void init();
})();
