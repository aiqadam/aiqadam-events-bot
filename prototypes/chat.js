// Прототип W41 — мок чата Telegram (ADR-0027).
// Рендерит сценарии из scenarios.js так, как это отрисует Telegram:
// сообщение — пузырь с текстом, инлайн-клавиатура — отдельным блоком под
// пузырём (внутри сообщения SVG и таблиц не бывает). Карточка диалога
// редактируется на месте (ADR-0017 п. 1). Трассировка и демо-контролы —
// в шитах обвязки.
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
  // Обёртка сообщения: пузырь и (для входящих) клавиатура под ним.
  function msgRow(kind) {
    const row = PROTO.el('div', 'tg-row ' + (kind === 'user' ? 'out' : 'in'));
    const wrap = PROTO.el('div', 'tg-msg');
    row.appendChild(wrap);
    return { row: row, wrap: wrap };
  }

  function bubble(kind, text, opts) {
    const o = opts || {};
    const m = msgRow(kind);
    const b = PROTO.el('div', 'tg-bubble ' + (kind === 'user' ? 'tg-out' : 'tg-in'));
    if (o.forwarded) b.appendChild(PROTO.el('div', 'tg-forwarded', PROTO.t('proto.forwarded_from')));
    b.appendChild(PROTO.el('div', 'tg-text', text));
    b.appendChild(PROTO.el('span', 'tg-time', o.time || PROTO.nowTime()));
    m.wrap.appendChild(b);
    chatRoot.appendChild(m.row);
    scrollDown();
    return m.wrap;
  }

  // Сообщение-карточка: текст как его отдаёт бот. Заголовок — первой строкой;
  // при parse_mode = MarkdownV2 (шаги с markup) он будет жирным.
  function buildCard(step) {
    const card = step.card || {};
    const b = PROTO.el('div', 'tg-bubble tg-in');
    const text = PROTO.el('div', 'tg-text');
    if (card.title) text.appendChild(PROTO.el('div', step.markup ? 'tg-msg-title' : 'tg-msg-line', card.title));
    if (step.cardSub) text.appendChild(PROTO.el('div', 'tg-msg-sub', step.cardSub));
    (card.lines || []).forEach((line) => text.appendChild(PROTO.el('div', 'tg-msg-line', line)));
    if (card.body) text.appendChild(PROTO.el('div', 'tg-msg-body', card.body));
    if (card.link) text.appendChild(PROTO.el('div', 'tg-msg-line', card.link.text));
    b.appendChild(text);
    return b;
  }

  // Инлайн-клавиатура — блок под пузырём, как её рисует Telegram.
  function renderButtons(row, buttons) {
    if (!buttons || !buttons.length) return;
    const kbd = PROTO.el('div', 'tg-kbd');
    buttons.forEach((btn) => {
      const el = PROTO.el('button', 'tg-kbd-btn');
      el.type = 'button';
      if (btn.disabled) { el.classList.add('disabled'); el.disabled = true; }
      el.textContent = btn.label;
      el.addEventListener('click', () => onButton(btn));
      kbd.appendChild(el);
    });
    row.appendChild(kbd);
  }

  function renderStep(step, replay, time) {
    PROTO.setTrace(step.trace || []);
    if (step.kind === 'user') {
      bubble('user', step.text, { forwarded: step.forwarded, time: time });
    } else if (step.kind === 'bot') {
      const row = bubble('bot', step.text, { time: time });
      renderButtons(row, step.buttons);
    } else if (step.kind === 'card') {
      let wrap;
      if (step.edit && activeCardEl) {
        wrap = activeCardEl;
        PROTO.clear(wrap);
        wrap.appendChild(buildCard(step));
      } else {
        const m = msgRow('bot');
        wrap = m.wrap;
        wrap.appendChild(buildCard(step));
        chatRoot.appendChild(m.row);
        activeCardEl = wrap;
      }
      activeCardId = step.id;
      wrap.querySelector('.tg-bubble').appendChild(PROTO.el('span', 'tg-time', time || PROTO.nowTime()));
      renderButtons(wrap, step.buttons);
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
    guest: [['event', 'Карточка ивента'], ['consent-pdn', 'Согласие на данные'], ['consent-mkt', 'Согласие на анонсы'], ['done', 'Билет'], ['reminders', 'Напоминания'], ['afterword', 'Послесловие']],
    owner: [['menu', 'Меню'], ['published', 'Публикация'], ['updated', 'Правка ивента'], ['broadcast', 'Рассылка'], ['staff-invite', 'Инвайт контролёра']],
    controller: [['accept-ok', 'Инвайт принят'], ['menu', 'Меню']],
    onboard: [['event', 'Карточка ивента'], ['consent', 'Согласие'], ['name-ok', 'Проверка имени'], ['city', 'Город'], ['review', 'Всё верно?'], ['done', 'Билет']],
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
    const eventParam = params.get('event') || '';
    // Открыли чат без ивента — начинаем с главного, а не с прошлого выбора.
    PROTO.setChatEvent(eventParam);
    scenarios = PROTO.buildScenarios({ eventId: eventParam });
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
