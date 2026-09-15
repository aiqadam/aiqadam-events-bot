// Мок чата прототипа W41 — движок отрисовки сценариев (scenarios.js).
// Карточка-экран редактируется на месте (ADR-0017): card-edit заменяет
// содержимое последней карточки, не отправляя новое сообщение.
'use strict';

const chatRoot = document.getElementById('chat');
const roleEl = document.querySelector('[data-proto-chat-role]');

// Текущая редактируемая карточка (её заменяет card-edit)
let activeCardEl = null;
// Текущий шаг
let currentStep = null;
// Отправленные bot-сообщения (для разделителя «предложение»)
let sentBubbles = 0;

function bubble(text, { user, proposal, spec, note }) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (user ? 'user' : 'bot');
  const p = document.createElement('div');
  p.innerHTML = text.replace(/\n/g, '<br/>');
  wrap.appendChild(p);
  if (note) {
    const n = document.createElement('div');
    n.style.cssText = 'font-size:11px;color:var(--muted-foreground);margin-top:4px;';
    n.textContent = '↑ ' + note;
    wrap.appendChild(n);
  }
  if (proposal) {
    const b = document.createElement('span');
    b.style.cssText = 'display:block;margin-top:6px;';
    b.appendChild(reqBadge({ built: false, spec: spec || 'предложение' }));
    wrap.appendChild(b);
  } else if (spec) {
    const b = document.createElement('span');
    b.style.cssText = 'display:block;margin-top:6px;';
    b.appendChild(reqBadge({ built: true, spec }));
    wrap.appendChild(b);
  }
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = chatTime();
  wrap.appendChild(time);
  chatRoot.appendChild(wrap);
  scrollDown();
  return wrap;
}

function card(node, { title, rows, body, buttons, proposal, spec }) {
  node.className = 'msg-card';
  node.innerHTML = '';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;';
  const titleEl = document.createElement('div');
  titleEl.className = 'msg-card-title';
  titleEl.textContent = title;
  head.appendChild(titleEl);
  head.appendChild(reqBadge({ built: !proposal, spec: spec || 'v0.1' }));
  node.appendChild(head);

  if (rows && rows.length) {
    const dl = document.createElement('div');
    dl.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'msg-card-row';
      const kEl = document.createElement('span');
      kEl.className = 'msg-card-label';
      kEl.textContent = k + ':';
      const vEl = document.createElement('span');
      vEl.textContent = v;
      row.appendChild(kEl);
      row.appendChild(vEl);
      dl.appendChild(row);
    });
    node.appendChild(dl);
  }

  if (body) {
    const p = document.createElement('div');
    p.innerHTML = body.replace(/\n/g, '<br/>');
    node.appendChild(p);
  }

  if (buttons && buttons.length) {
    const act = document.createElement('div');
    act.className = 'actions';
    buttons.forEach((btn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (btn.primary ? 'btn-primary' : 'btn-secondary');
      b.style.cssText = 'justify-content:center;';
      b.textContent = btn.label;
      b.addEventListener('click', () => handleAction(btn));
      act.appendChild(b);
    });
    node.appendChild(act);
  }
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = chatTime();
  node.appendChild(time);
  // новая карточка — в чат; существующая (card-edit) — только перерисовать
  if (!node.parentNode) chatRoot.appendChild(node);
  scrollDown();
  return node;
}

function scrollDown() {
  const scr = chatRoot.parentElement;
  if (scr) scr.scrollTop = scr.scrollHeight;
}

function handleAction(btn) {
  if (btn.webApp) {
    // Кнопка web_app — переход в мок Mini App с возвратом в тот же шаг сценария.
    const back = location.pathname.split('/').pop() + '?s=' + currentScenario + '&step=' + (btn.next || currentStepIndex);
    const target = 'app.html' + btn.webApp + '&back=' + encodeURIComponent(back);
    location.href = target;
    return;
  }
  runStep(btn.next);
}

// Переход к шагу по id (или по индексу)
function runStep(target) {
  const steps = currentScenarioData.steps;
  let idx = typeof target === 'number' ? target : -1;
  if (idx < 0) {
    idx = steps.findIndex((s) => s.id === target);
  }
  if (idx < 0) {
    // «end» — конец сценария
    bubble('— конец сценария —', {});
    return;
  }
  currentStepIndex = idx;
  const step = steps[idx];

  if (step.type === 'user') {
    bubble(step.text, { user: true, note: step.note });
    // после user-сообщения автоматически идём к следующему шагу
    runStep(idx + 1);
    return;
  }
  if (step.type === 'bot') {
    bubble(step.text, { proposal: step.proposal, spec: step.spec });
    runStep(idx + 1);
    return;
  }
  if (step.type === 'card') {
    activeCardEl = card(document.createElement('div'), step);
    return;
  }
  if (step.type === 'card-edit') {
    if (!activeCardEl) {
      // фолбэк: если редактируемой карточки нет — рисуем новую
      activeCardEl = card(document.createElement('div'), step);
    } else {
      card(activeCardEl, step);
    }
    return;
  }
}

// ---------- инициализация ----------
const params = new URLSearchParams(location.search);
const currentScenario = params.get('s') || 'guest';
const resumeStep = params.get('step');
let currentScenarioData = buildScenario(currentScenario);
let currentStepIndex = 0;

async function init() {
  roleEl.textContent = currentScenarioData.title;
  await loadI18n();
  // сценарий перестраиваем после загрузки словаря (тексты — из ru.json)
  currentScenarioData = buildScenario(currentScenario);
  chatRoot.innerHTML = '';
  // стартовое приветствие чата
  const intro = bubble('AI Qadam Events — прототип диалога «' + currentScenarioData.title + '». Нажимайте кнопки карточек.', {});
  // первые шаги: user-сообщения и бот-карточки
  const startIdx = resumeStep ? currentScenarioData.steps.findIndex((s) => s.id === resumeStep) : 0;
  runStep(startIdx >= 0 ? startIdx : 0);
}

void init();