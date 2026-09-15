// Прототип W41 — мок чата Telegram (ADR-0027).
// Рендерит сценарии из scenarios.js в вёрстке, повторяющей Telegram:
// пузыри, карточки, inline-клавиатура. Карточка диалога редактируется на
// месте (ADR-0017 п. 1). Трассировка к SPEC — отдельным слоем.
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
  let rendered = [];       // [{id, time}]
  let activeCardEl = null; // редактируемая карточка
  let activeCardId = null;
  let finished = false;

  // ---------- состояние (переживает переход в Mini App и обратно) ----------
  function loadState() {
    try {
      const raw = sessionStorage.getItem(stateKey);
      if (!raw) return null;
      const st = JSON.parse(raw);
      return st && st.scenario === scenarioId ? st : null;
    } catch (e) { return null; }
  }
  function saveState() {
    try {
      sessionStorage.setItem(stateKey, JSON.stringify({ scenario: scenarioId, rendered: rendered, activeCard: activeCardId }));
    } catch (e) { /* приватный режим — не критично */ }
  }
  function resetState() {
    try { sessionStorage.removeItem(stateKey); } catch (e) { /* noop */ }
  }

  function findStep(id) {
    return sc.steps.find((s) => s.id === id) || null;
  }
  function indexOf(id) {
    return sc.steps.findIndex((s) => s.id === id);
  }

  function scrollDown() {
    const scr = chatRoot.parentElement;
    if (scr) scr.scrollTop = scr.scrollHeight;
  }

  // ---------- отрисовка ----------
  function bubble(kind, text, opts) {
    const o = opts || {};
    const row = PROTO.el('div', 'tg-row ' + (kind === 'user' ? 'out' : 'in'));
    const b = PROTO.el('div', 'tg-bubble ' + (kind === 'user' ? 'tg-out' : 'tg-in'));
    if (o.forwarded) b.appendChild(PROTO.el('div', 'tg-forwarded', PROTO.t('proto.forwarded_from')));
    if (o.note) b.appendChild(PROTO.el('div', 'tg-note', o.note));
    b.appendChild(PROTO.el('div', 'tg-text', text));
    b.appendChild(PROTO.el('span', 'tg-time', o.time || PROTO.nowTime()));
    row.appendChild(b);
    chatRoot.appendChild(row);
    scrollDown();
    return b;
  }

  function buildCard(step) {
    const card = step.card || {};
    const b = PROTO.el('div', 'tg-bubble tg-card');
    if (card.title) b.appendChild(PROTO.el('div', 'tg-card-title', card.title));
    if (card.lines && card.lines.length) {
      const box = PROTO.el('div', 'tg-card-lines');
      card.lines.forEach((line) => box.appendChild(PROTO.el('div', 'tg-card-line', line)));
      b.appendChild(box);
    }
    if (card.body) b.appendChild(PROTO.el('div', 'tg-card-body', card.body));
    if (card.link) {
      const a = PROTO.el('a', 'tg-card-link', card.link.text);
      a.href = card.link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      b.appendChild(a);
    }
    return b;
  }

  function renderButtons(container, buttons) {
    const kbd = PROTO.el('div', 'tg-kbd');
    (buttons || []).forEach((btn) => {
      const el = PROTO.el('button', 'tg-kbd-btn');
      el.type = 'button';
      if (btn.primary) el.classList.add('primary');
      if (btn.tone === 'danger') el.classList.add('danger');
      if (btn.disabled) {
        el.classList.add('disabled');
        el.disabled = true;
        if (btn.note) el.title = btn.note;
      }
      el.textContent = btn.label;
      if (btn.note && !btn.disabled) el.title = btn.note;
      el.addEventListener('click', () => onButton(btn));
      kbd.appendChild(el);
    });
    if (buttons && buttons.length) container.appendChild(kbd);
  }

  // Рендер шага. replay:true — восстановление истории, без автоперехода.
  function renderStep(step, replay, time) {
    PROTO.setTrace(step.trace || []);
    if (step.kind === 'user') {
      bubble('user', step.text, { note: step.note, forwarded: step.forwarded, time: time });
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
    if (!replay) {
      rendered.push({ id: step.id, time: time || PROTO.nowTime() });
      saveState();
    }
  }

  function finish() {
    finished = true;
    renderDemo();
  }

  function advanceFrom(index) {
    if (finished) return;
    const next = sc.steps[index + 1];
    if (!next) { finish(); return; }
    if (next.state) { finish(); return; }
    renderStep(next, false);
    if (!next.buttons || !next.buttons.length) {
      setTimeout(() => advanceFrom(index + 1), 420);
    }
  }

  function runIndex(i) {
    if (i < 0 || i >= sc.steps.length) { finish(); return; }
    const step = sc.steps[i];
    renderStep(step, false);
    if (!step.buttons || !step.buttons.length) {
      setTimeout(() => advanceFrom(i), 420);
    }
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
    if (btn.share) {
      const url = 'https://t.me/share/url?url=' + encodeURIComponent(btn.share);
      window.open(url, '_blank', 'noopener');
      return;
    }
    if (btn.webApp) {
      saveState();
      const back = PROTO.chatUrl(scenarioId, btn.resume || '', true);
      location.href = PROTO.appUrl(btn.webApp, back);
      return;
    }
    if (btn.go) runId(btn.go);
  }

  // ---------- демо-контролы (обвязка прототипа, не экран) ----------
  const quickIndex = {
    guest: [['event', 'Карточка ивента'], ['consent-pdn', 'Согласие на данные'], ['consent-mkt', 'Согласие на анонсы'], ['done', 'Билет'], ['reminders', 'Напоминания'], ['afterword', 'Послесловие'], ['myreg', 'Мои регистрации']],
    owner: [['menu', 'Меню'], ['published', 'Публикация'], ['invite', 'Ссылка-приглашение'], ['updated', 'Правка ивента'], ['broadcast', 'Рассылка'], ['staff-invite', 'Инвайт контролёра']],
    controller: [['accept-ok', 'Инвайт принят'], ['menu', 'Меню']],
  };

  function renderDemo() {
    const box = document.querySelector('[data-proto-demo]');
    if (!box) return;
    PROTO.clear(box);
    const head = PROTO.el('div', 'proto-demo-head');
    head.appendChild(PROTO.el('strong', '', sc.title));
    head.appendChild(PROTO.el('span', 'proto-demo-hint', sc.hint));
    box.appendChild(head);

    const jumps = PROTO.el('div', 'proto-demo-row');
    jumps.appendChild(PROTO.el('span', 'proto-demo-label', 'Ключевые шаги:'));
    (quickIndex[scenarioId] || []).forEach(([id, label]) => {
      const a = PROTO.protoLink(label, PROTO.chatUrl(scenarioId, id));
      jumps.appendChild(a);
    });
    box.appendChild(jumps);

    const states = PROTO.el('div', 'proto-demo-row');
    states.appendChild(PROTO.el('span', 'proto-demo-label', 'Состояния:'));
    (PROTO.stateIndex[scenarioId] || []).forEach(([id, label]) => {
      states.appendChild(PROTO.protoLink(label, PROTO.chatUrl(scenarioId, id)));
    });
    box.appendChild(states);

    const reset = PROTO.el('div', 'proto-demo-row');
    reset.appendChild(PROTO.protoLink(PROTO.t('proto.reset'), PROTO.chatUrl(scenarioId)));
    if (finished) reset.appendChild(PROTO.el('span', 'proto-demo-hint', 'Сценарий завершён.'));
    box.appendChild(reset);
  }

  // ---------- инициализация ----------
  async function init() {
    await PROTO.loadI18n();
    PROTO.initChrome({ title: 'Мок чата · ' + scenarioId });
    scenarios = PROTO.buildScenarios();
    sc = scenarios[scenarioId] || scenarios.guest;
    renderDemo();

    const saved = (startStep && doResume) ? loadState() : null;
    if (saved) {
      rendered = saved.rendered || [];
      rendered.forEach((entry) => {
        const st = findStep(entry.id);
        if (st) renderStep(st, true, entry.time);
      });
    } else {
      resetState();
    }
    if (startStep) runId(startStep); else runIndex(0);
  }

  void init();
})();
