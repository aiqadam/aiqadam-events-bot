// Прототип W41 — общий слой (ADR-0026, ADR-0027).
// Vanilla, без сборки. Тексты продукта — из ../i18n/ru.json; тексты ещё не
// написанного — отдельным словарём прототипа, в ru.json не добавляются.
// Трассировка к SPEC — отдельным слоем (панель), не разметкой экранов.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

// ---------- Словарь прототипа (строки, которых ещё нет в i18n/ru.json) ----------
// Ключи proto.* — служебные (обвязка прототипа, демо-контролы), в продукт не
// поедут. Остальные — предложения продукта: при реализации станут ключами ru.json.
PROTO.protoDict = {
  // обвязка прототипа (не продукт)
  'proto.trace_toggle': 'Требования',
  'proto.trace_title': 'Требования SPEC',
  'proto.trace_empty': 'Для этого экрана отдельного требования SPEC нет — это обвязка прототипа.',
  'proto.trace_note': 'Слой трассировки. На самих экранах пометок нет — это прототип, а не продукт.',
  'proto.reset': 'Начать сценарий заново',
  'proto.to_start': 'На старт',
  'proto.chat_link': 'Мок чата',
  'proto.app_link': 'Мок Mini App',
  'proto.theme': 'Тема',
  'proto.theme_light': 'Светлая',
  'proto.theme_dark': 'Тёмная',
  'proto.chat_bot': 'бот',
  'proto.app_close': 'Закрыть',
  'proto.demo_scan': 'Сканировать QR',
  'proto.demo_controls': 'Демо-контролы',
  'proto.dict_missing': 'Словарь i18n/ru.json не загрузился — на экране сырые ключи.',
  // предложения продукта (ещё не в ru.json)
  'proto.tab_event': 'Ивент',
  'proto.forwarded_from': 'Переслано',
  'proto.broadcast_sample': 'Друзья, в пятницу встречаемся на AI Qadam #4. Вход свободный, регистрация обязательна.',
  'proto.confirm_cancel_event': 'Отменить ивент «{title}»? Зарегистрированные получат уведомление.',
  'proto.broadcast_chat_hint': 'Составление — в чате: перешлите боту готовое сообщение.',
  'proto.open_chat': 'Перейти в чат',
  'proto.scan_ready': 'Наведите камеру на QR-код',
  'proto.scan_result': 'Результат',
  'proto.you': 'Вы',
  'proto.link_copied': 'Ссылка скопирована',
  'proto.deep_link_note': 'переход по ссылке регистрации',
  'proto.staff_invite_note': 'переход по ссылке-инвайту',
};

// ---------- Трассировка: id требования → короткая формулировка ----------
PROTO.specMap = {
  'OWN-1': 'Создание ивента: название, описание, адрес, гео, начало, конец, дедлайн.',
  'OWN-2': 'Адрес и ссылка на Яндекс.Карты — в карточке ивента, из точки lat/lon.',
  'OWN-3': 'Даты в UTC, показ в Asia/Tashkent; ввод владельца — ташкентский.',
  'OWN-4': 'Статусы draft → published → cancelled | finished.',
  'OWN-5': 'Правка существенных полей опубликованного шлёт уведомление зарегистрированным.',
  'OWN-6': 'Ссылка регистрации ?start=e<id>-<utm>; несколько меток.',
  'OWN-7': 'Список участников и счётчики: зарегистрировано / пришло / отменило.',
  'OWN-8': 'Экспорт CSV (UTF-8 BOM) и JSON.',
  'OWN-9': 'Рассылка по сегментам; «не пришли» недоступен до ends_at.',
  'OWN-10': 'Перед отправкой — предпросмотр и обязательный тест себе.',
  'OWN-11': 'Троттлинг: не более 25 сообщений в секунду.',
  'OWN-12': '429 — повтор по retry_after; 403 — blocked_bot, больше не дёргаем.',
  'OWN-13': 'В каждом массовом сообщении — кнопка «отписаться».',
  'OWN-14': 'Инвайт контролёра: одноразовая ссылка ?start=s<eventId>-<token>, TTL 24 часа.',
  'OWN-15': 'Ёмкость и овербукинг: закрытие при ceil(capacity × (1 + overbook_pct/100)).',
  'OWN-16': 'Два напоминания — за 24 ч и за 2 ч до starts_at; пропущенное окно не досылается.',
  'PAR-1': 'Согласие на обработку данных — обязательный шаг регистрации.',
  'PAR-2': 'Согласие на рассылку — отдельный и необязательный шаг.',
  'PAR-3': 'Список ивентов: будущие и прошедшие раздельно.',
  'PAR-4': 'Мои регистрации.',
  'PAR-5': 'Отмена регистрации доступна до starts_at.',
  'PAR-6': 'QR участника: payload c<eventId>-<userId>-<sig>, sig — 10 символов base64url.',
  'STF-1': 'Чекин — Mini App со сканером, не закрывающимся между людьми.',
  'STF-2': 'Права контролёра проверяются по конкретному event_id.',
  'STF-3': 'Fallback-канал чекина не реализуется (решение владельца, Q41).',
  'STF-4': 'Четыре исхода на экране: успех / уже отмечен / нет регистрации / другой ивент.',
  'IDM-1': 'Повторная регистрация не создаёт вторую строку и не шлёт второе подтверждение.',
  'IDM-2': 'Повторный чекин показывает исходное время, не перезаписывает.',
  'IDM-3': 'Напоминание каждого вида уходит ровно один раз.',
  'IDM-4': 'Апдейты Telegram дедуплицируются по update_id.',
  'DAT-1': 'telegram_id — единственный ключ; username не используется для идентификации.',
  'DAT-2': 'Телефон только через request_contact; сейчас не собирается.',
  'ADR-0007': 'QR рендерится в Mini App, файлом не отправляется.',
  'ADR-0017': 'Единица интерфейса — экран; состояние редактируется, факт отправляется.',
  'ADR-0023': 'Каталог ивентов — четвёртый роут #/events.',
  'ADR-0025': 'Единственный командный вход — /start; дальше карточки и Mini App.',
};

// ---------- i18n ----------
PROTO.dict = {};
PROTO.dictLoaded = false;
PROTO.missing = [];
PROTO._missingSeen = {};

PROTO.loadI18n = async function () {
  if (PROTO.dictLoaded) return PROTO.dict;
  try {
    const res = await fetch('../i18n/ru.json', { cache: 'no-cache' });
    if (res.ok) {
      PROTO.dict = await res.json();
      PROTO.dictLoaded = true;
    }
  } catch (e) {
    /* нет сети — останемся на ключах, страница читаема */
  }
  return PROTO.dict;
};

PROTO.t = function (key, vars) {
  let s = PROTO.dict[key];
  if (s === undefined) s = PROTO.protoDict[key];
  if (s === undefined) {
    s = key;
    if (!PROTO._missingSeen[key]) {
      PROTO._missingSeen[key] = true;
      PROTO.missing.push(key);
    }
  }
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split('{' + k + '}').join(String(vars[k]));
    }
  }
  return s;
};

// Короткая форма для файлов прототипа.
function t(key, vars) { return PROTO.t(key, vars); }

// ---------- Тема (в продукте — Telegram.WebApp.colorScheme) ----------
PROTO.theme = 'light';
PROTO.applyTheme = function () {
  document.documentElement.setAttribute('data-theme', PROTO.theme);
  const btns = document.querySelectorAll('[data-proto-theme-label]');
  btns.forEach((b) => {
    b.textContent = PROTO.theme === 'light' ? t('proto.theme_dark') : t('proto.theme_light');
  });
};
PROTO.toggleTheme = function () {
  PROTO.theme = PROTO.theme === 'light' ? 'dark' : 'light';
  PROTO.applyTheme();
};

// ---------- DOM-хелперы ----------
PROTO.el = function (tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};
PROTO.clear = function (node) { node.innerHTML = ''; };

// Экранирование не нужно: весь текст ставится через textContent, а не innerHTML.

// ---------- Слой трассировки (ADR-0027 п. 4) ----------
PROTO._trace = [];
PROTO.setTrace = function (ids) {
  PROTO._trace = ids || [];
  PROTO.renderTrace();
};
PROTO.toggleTrace = function () {
  const panel = document.querySelector('[data-proto-trace-panel]');
  if (!panel) return;
  const open = panel.hasAttribute('hidden');
  if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
  const btn = document.querySelector('[data-proto-trace-toggle]');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) PROTO.renderTrace();
};
PROTO.renderTrace = function () {
  const body = document.querySelector('[data-proto-trace-body]');
  if (!body) return;
  PROTO.clear(body);
  if (!PROTO._trace.length) {
    body.appendChild(PROTO.el('p', 'proto-trace-empty', t('proto.trace_empty')));
    return;
  }
  PROTO._trace.forEach((id) => {
    const item = PROTO.el('div', 'proto-trace-item');
    item.appendChild(PROTO.el('span', 'proto-trace-id', id));
    item.appendChild(PROTO.el('span', 'proto-trace-text', PROTO.specMap[id] || ''));
    body.appendChild(item);
  });
};

// ---------- Обвязка страницы прототипа ----------
// Строит верхнюю панель (назад, заголовок, тумблеры) и панель трассировки.
PROTO.initChrome = function (opts) {
  const o = opts || {};
  const bar = document.querySelector('[data-proto-bar]');
  if (bar) {
    PROTO.clear(bar);
    const back = PROTO.el('a', 'proto-btn proto-btn-ghost', '← ' + t('proto.to_start'));
    back.href = 'index.html';
    bar.appendChild(back);
    if (o.title) bar.appendChild(PROTO.el('span', 'proto-bar-title', o.title));

    const right = PROTO.el('div', 'proto-bar-right');
    const themeBtn = PROTO.el('button', 'proto-btn proto-btn-ghost', '');
    themeBtn.type = 'button';
    themeBtn.setAttribute('data-proto-theme-label', '');
    themeBtn.addEventListener('click', PROTO.toggleTheme);
    right.appendChild(themeBtn);

    const traceBtn = PROTO.el('button', 'proto-btn proto-btn-outline', t('proto.trace_toggle'));
    traceBtn.type = 'button';
    traceBtn.setAttribute('data-proto-trace-toggle', '');
    traceBtn.setAttribute('aria-expanded', 'false');
    traceBtn.addEventListener('click', PROTO.toggleTrace);
    right.appendChild(traceBtn);
    bar.appendChild(right);
  }
  PROTO.applyTheme();
  if (PROTO.missing.length === 0 && !PROTO.dictLoaded) {
    // словарь не доехал — предупредим обвязку, а не экран
    const warn = document.querySelector('[data-proto-warn]');
    if (warn) warn.removeAttribute('hidden');
  }
};

// Кнопка запуска сценария/экрана — стиль прототипа, не продукта.
PROTO.protoLink = function (label, href, kind) {
  const a = PROTO.el('a', 'proto-btn ' + (kind === 'primary' ? 'proto-btn-primary' : 'proto-btn-outline'), label);
  a.href = href;
  return a;
};

PROTO.esc = function (s) { return String(s === undefined || s === null ? '' : s); };

PROTO.nowTime = function () {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

PROTO.toast = function (msg) {
  const node = PROTO.el('div', 'proto-toast', msg);
  document.body.appendChild(node);
  setTimeout(() => { node.classList.add('show'); }, 10);
  setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 250); }, 1700);
};

PROTO.copy = function (text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => PROTO.toast(PROTO.t('proto.link_copied')),
      () => PROTO.toast(text)
    );
  } else {
    PROTO.toast(text);
  }
};

// Кнопка/ссылка прототипа, открывающая мок Mini App из чата.
PROTO.appUrl = function (route, backUrl) {
  const sep = route.indexOf('?') >= 0 ? '&' : '?';
  return 'app.html' + route + sep + 'back=' + encodeURIComponent(backUrl || 'index.html');
};

PROTO.chatUrl = function (scenario, step, resume) {
  return 'chat.html?s=' + encodeURIComponent(scenario) + (step ? '&step=' + encodeURIComponent(step) : '') + (resume ? '&resume=1' : '');
};
