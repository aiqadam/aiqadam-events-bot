// Прототип W41 — общий JS. Vanilla, без сборки (ADR-0026).
// Тексты реальных экранов тянутся из i18n/ru.json с того же Pages;
// тексты ненаписанного — отдельным словарём прототипа (proto-dict),
// в i18n/ru.json не добавляются (BACKLOG W41 п. 3).
'use strict';

// ---------- i18n ----------
const PROTO = window.PROTO = {};

PROTO.dict = {};      // реальные тексты (i18n/ru.json)
PROTO.dictLoaded = false;
PROTO.protoDict = {}; // тексты-предложения (только прототип)

// Тексты, которых ещё нет в ru.json (v0.2: W13/W14/W38/W39 и др.).
// Ключи с префиксом proto: — бейдж «прототип» на экране.
PROTO.protoDict = {
  'proto.w13.title': 'Участники',
  'proto.w13.counters': 'Зарегистрировано {registered} · пришло {checked_in} · отменило {cancelled}',
  'proto.w13.export_csv': 'Экспорт CSV',
  'proto.w13.export_json': 'Экспорт JSON',
  'proto.w13.empty': 'В этом срезе никого нет.',
  'proto.w13.filter_all': 'Все',
  'proto.w13.filter_checked_in': 'Пришли',
  'proto.w13.filter_cancelled': 'Отменившие',
  'proto.w13.filter_no_show': 'Не пришли',
  'proto.w13.item': '{name} — {status}',
  'proto.w14.title': 'Рассылка',
  'proto.w14.forward_hint': 'Перешлите боту сообщение, которое нужно разослать.',
  'proto.w14.segment': 'Кому отправляем?',
  'proto.w14.segment_registered': 'Зарегистрированные на ивент',
  'proto.w14.segment_checked_in': 'Пришедшие',
  'proto.w14.segment_no_show': 'Зарегистрировались, но не пришли',
  'proto.w14.test_first': 'Сначала — тест себе',
  'proto.w14.send': 'Разослать {count}',
  'proto.w14.preview': 'Предпросмотр',
  'proto.w38.title': 'Ивенты',
  'proto.w38.upcoming': 'Будущие',
  'proto.w38.past': 'Прошедшие',
  'proto.w38.empty': 'Пока ничего не запланировано.',
  'proto.w39.poster': 'Афиша',
  'proto.w39.hint': 'Фото вернётся в v0.2 (Q50, W39)',
  'proto.w10.title': 'Контролёры',
  'proto.w10.invite': 'Пригласить контролёра',
  'proto.w10.link_hint': 'Одноразовая ссылка, действует 24 часа',
  'proto.states.stale': 'Данные Mini App устарели — переоткройте приложение',
  'proto.states.forbidden': 'Нет прав на чекин этого ивента',
  'proto.states.network': 'Нет соединения. Проверьте сеть и повторите.',
  'proto.states.server': 'Сервер ответил неожиданно. Повторите чуть позже.',
  'proto.states.loading': 'Загрузка…',
  'proto.chat.deep_link': 'Ссылка регистрации',
  'proto.chat.forwarded': 'Пересланное сообщение',
  'proto.chat.reminder_24h': 'Напоминание за 24 часа',
  'proto.chat.reminder_2h': 'Напоминание за 2 часа',
  'proto.chat.afterword': 'Послесловие после ивента',
};

async function loadI18n() {
  if (PROTO.dictLoaded) return PROTO.dict;
  try {
    const res = await fetch('../i18n/ru.json');
    if (res.ok) {
      PROTO.dict = await res.json();
      PROTO.dictLoaded = true;
    }
  } catch (e) { /* нет сети — останемся на пустом словаре, ключи на экране */ }
  return PROTO.dict;
}

function t(key, vars) {
  let s = PROTO.dict[key] !== undefined ? PROTO.dict[key] : (PROTO.protoDict[key] !== undefined ? PROTO.protoDict[key] : key);
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
    }
  }
  return s;
}

// ---------- Тема: в прототипе переключатель, в продукте — Telegram ----------
PROTO.theme = 'light';
function applyProtoTheme() {
  document.documentElement.setAttribute('data-theme', PROTO.theme);
}
function toggleTheme() {
  PROTO.theme = PROTO.theme === 'light' ? 'dark' : 'light';
  applyProtoTheme();
  const btn = document.querySelector('[data-proto-theme-btn]');
  if (btn) btn.textContent = PROTO.theme === 'light' ? 'Тёмная тема' : 'Светлая тема';
}

// ---------- Хелперы ----------
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Бейдж «собрано» / «предложение» + требование SPEC
function reqBadge({ built, spec }) {
  const b = el('span', 'req-badge ' + (built ? 'built' : 'proposal'));
  b.textContent = (built ? '' : 'предложение · ') + (spec || '');
  return b;
}

// Таймштамп в чате (мок)
function chatTime(d) {
  const dt = d || new Date();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}