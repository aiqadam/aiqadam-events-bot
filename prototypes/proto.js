// Прототип W41 — общий слой (ADR-0026, ADR-0027).
// Vanilla, без сборки. Тексты продукта — из ../i18n/ru.json; тексты ещё не
// написанного — отдельным словарём прототипа, в ru.json не добавляются.
// Трассировка к SPEC и демо-контролы — отдельным слоем (шиты), не экранами.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

// ---------- Словарь прототипа (строки, которых ещё нет в i18n/ru.json) ----------
PROTO.protoDict = {
  // обвязка прототипа (не продукт)
  'proto.dock_demo': 'Сценарий',
  'proto.dock_trace': 'Требования',
  'proto.sheet_demo': 'Сценарий и состояния',
  'proto.sheet_trace': 'Требования SPEC',
  'proto.trace_empty': 'Для этого экрана отдельного требования SPEC нет — это обвязка прототипа.',
  'proto.trace_note': 'Слой трассировки. На экранах пометок нет — это прототип, а не продукт.',
  'proto.reset': 'Начать сценарий заново',
  'proto.to_start': 'На старт',
  'proto.theme_dark': 'Тёмная тема',
  'proto.theme_light': 'Светлая тема',
  'proto.demo_hint': 'Демо-контролы прототипа. В продукте их нет.',
  // предложения продукта (ещё не в ru.json)
  'proto.menu_guest': 'Найдите свои билеты и регистрируйтесь на события по кнопке ниже',
  'proto.menu_owner': 'Создайте событие или откройте каталог по кнопкам ниже',
  'proto.menu_controller': 'Откройте каталог по кнопке ниже — сканер рядом с вашим событием',
  'proto.tab_event': 'Событие',
  'proto.forwarded_from': 'Переслано',
  'proto.broadcast_sample': 'Друзья, в пятницу встречаемся на AI Qadam #4. Вход свободный, регистрация обязательна.',
  'proto.broadcast_chat_hint': 'Составление — в чате: перешлите боту готовое сообщение.',
  'proto.open_chat': 'Перейти в чат',
  'proto.deep_link_note': 'переход по ссылке регистрации',
  'proto.staff_invite_note': 'переход по ссылке-инвайту',
  'proto.result_ok': 'Можно впускать',
  'proto.result_already': 'Пропустить повторно',
  'proto.result_denied': 'Не впускать',
  'proto.tab_hint': 'Проверьте данные и опубликуйте — участники увидят событие после публикации.',

  // каталог, регистрация и визард: тексты написаны, берутся из ru.json

  // Формат участия — предложение (вердикт 2026-09-18): Онлайн — без ссылки,
  // офлайн — ожидается ссылка Яндекс.Карт (тексты ссылки — из ru.json).
  'proto.geo_mode': 'Формат',
  'proto.geo_online': 'Онлайн',
  'proto.geo_offline': 'Офлайн',

  // контролёры: ввод по логину инлайн, без шита (W55)
  'proto.staff_hint': 'Права — на это событие; отозвать можно в любой момент.',
  'proto.staff_since': 'контролёр с {when}',

  // послесловие: отметка об отправленном отзыве (тексты формы — из ru.json,
  // приняты ADR-0028)
  'proto.feedback_given': 'Отзыв отправлен',

  // билет
  'proto.ticket_none': 'Вы не зарегистрированы на это событие.',

  // рассылка: короткие подписи кнопок (VOICE: до 23 знаков); «не пришли» —
  // реальная строка фильтра участников, второй такой же не заводим.
  'proto.bcast_btn_all': 'Все · {count}',
  'proto.bcast_btn_registered': 'Зарегистрированные · {count}',
  'proto.bcast_btn_checked_in': 'Пришедшие · {count}',

  // онбординг C (ADR-0032): черновые тексты первого касания. Живут здесь,
  // пока пакет реализации не сгенерирует их из i18n/ru.json.
  'onb.why': 'Впервые у нас — пара слов, зачем просим данные: в жизни сообщества участвуем поимённо. Нужно знать участников. Не продаём и в спам не пускаем.',
  'onb.consent': 'Согласны на обработку данных: имя, фамилия, должность, компания, город и telegram_id. Храним у себя, третьим не отдаём. Без согласия оформить не сможем.',
  'onb.details': 'Что храним и зачем: имя, фамилия, должность, компания, город и telegram_id — чтобы вести список участников и пускать на события. Храним у себя, третьим лицам не передаём, в продажу не пускаем. Согласие можно отозвать — напишите нам, данные удалим.',
  'onb.name_ok': 'Вы — Дилшод Азимов? Подтянули из профиля Telegram. Если там никнейм — не жмите «Это я», поправьте.',
  'onb.ask_name': 'Напишите имя и фамилию — как поставить в список участников.',
  'onb.ask_work': 'Где работаете? Пришлите должность и компанию одним сообщением. Пример: ML-инженер, Payme. Компанию можно пропустить.',
  'onb.ask_city': 'Из какого вы города?',
  'onb.review': 'Проверьте: Дилшод Азимов · ML-инженер, Payme · Ташкент. Пока ничего не записано — можно поправить.',
  'onb.suspect': 'В профиле Telegram — «Crypto King 👑»: такое в список участников не поставим. Напишите имя и фамилию руками.',
  'onb.profile_saved': 'Профиль заполнен. Дальше — меню.',
  'onb.btn.continue': 'Дальше',
  'onb.btn.details': 'Подробнее',
  'onb.btn.understood': 'Понятно, согласен',
  'onb.btn.itsme': 'Это я',
  'onb.btn.fix_name': 'Поправить имя',
  'onb.btn.all_good': 'Всё верно',
  'onb.btn.fix': 'Исправить',
  'onb.btn.write': 'Написать',
  'onb.btn.write_name': 'Написать имя',

  // профиль гостя (таб в #/events): черновые тексты, пока пакет
  // реализации не сгенерирует их из i18n/ru.json.
  'profile.tab': 'Профиль',
  'profile.head_note': 'Так вас увидят в списке участников и назовут на входе.',
  'profile.last': 'Фамилия',
  'profile.position': 'Должность',
  'profile.company': 'Компания',
  'profile.company_hint': 'Можно пропустить — фриланс, студент.',
  'profile.city': 'Город',
  'profile.city_hint': 'Ташкент и Алматы — одной кнопкой, другой напишите руками.',
  'profile.pdn_done': 'Согласие на обработку данных дано {when}. Храним у себя, третьим не отдаём.',
  'profile.err': 'Заполните имя и фамилию.',
};

// ---------- Трассировка: id требования → короткая формулировка ----------
PROTO.specMap = {
  'OWN-1': 'Создание события: название, описание, адрес, гео, начало, конец, дедлайн.',
  'OWN-2': 'Адрес и ссылка на Яндекс.Карты — в карточке события, из точки lat/lon.',
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
  'OWN-14': 'Контролёры события: выбор из списка людей (поиск по имени или @username), права — по telegram_id; инвайт-ссылка ?start=s<eventId>-<token>, TTL 24 часа — альтернатива.',
  'OWN-15': 'Ёмкость и овербукинг: закрытие при ceil(capacity × (1 + overbook_pct/100)).',
  'OWN-16': 'Два напоминания — за 24 ч и за 2 ч до starts_at; пропущенное окно не досылается.',
  'PAR-1': 'Согласие на обработку данных — обязательный шаг регистрации.',
  'PAR-2': 'Согласие на рассылку — отдельный и необязательный шаг.',
  'PAR-3': 'Список событий: мои билеты, будущие и прошедшие; регистрация — прямо в каталоге, без возврата в чат.',
  'PAR-4': 'Мои регистрации — вкладка «Мои билеты» в каталоге Mini App.',
  'PAR-5': 'Отмена регистрации доступна до starts_at — и в чате, и на экране билета.',
  'PAR-6': 'QR участника: payload c<eventId>-<userId>-<sig>, sig — 10 символов base64url.',
  'STF-1': 'Чекин — Mini App; кадр сканера — нативный попап Telegram (showScanQrPopup), страница показывает вердикт и счётчик и не закрывается между людьми.',
  'STF-2': 'Права контролёра проверяются по конкретному event_id.',
  'STF-3': 'Fallback-канал чекина не реализуется (решение владельца, Q41).',
  'STF-4': 'Четыре исхода на экране: успех / уже отмечен / нет регистрации / другое событие.',
  'IDM-1': 'Повторная регистрация не создаёт вторую строку и не шлёт второе подтверждение.',
  'IDM-2': 'Повторный чекин показывает исходное время, не перезаписывает.',
  'IDM-3': 'Напоминание каждого вида уходит ровно один раз.',
  'IDM-4': 'Апдейты Telegram дедуплицируются по update_id.',
  'DAT-1': 'telegram_id — единственный ключ; username не используется для идентификации.',
  'DAT-2': 'Телефон только через request_contact; сейчас не собирается.',
  'ADR-0007': 'QR рендерится в Mini App, файлом не отправляется.',
  'ADR-0017': 'Единица интерфейса — экран; состояние редактируется, факт отправляется.',
  'ADR-0023': 'Каталог событий — четвёртый роут #/events.',
  'ADR-0024': 'Права: глобальный staff по чаптеру, чекин — event_staff; events.staff_id — авторство.',
  'ADR-0025': 'Единственный командный вход — /start; дальше карточки и Mini App.',
  'ADR-0028': 'Форма отзыва — пятый роут #/feedback (принят ADR-0028).',
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
    if (res.ok) { PROTO.dict = await res.json(); PROTO.dictLoaded = true; }
  } catch (e) { /* нет сети — останемся на ключах, страница читаема */ }
  return PROTO.dict;
};

PROTO.t = function (key, vars) {
  let s = PROTO.dict[key];
  if (s === undefined) s = PROTO.protoDict[key];
  if (s === undefined) {
    s = key;
    if (!PROTO._missingSeen[key]) { PROTO._missingSeen[key] = true; PROTO.missing.push(key); }
  }
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
};
function t(key, vars) { return PROTO.t(key, vars); }

// ---------- Тема (в продукте — Telegram.WebApp.colorScheme) ----------
// Порядок: ?theme= в ссылке (скриншоты) → выбор, сохранённый кнопкой → светлая.
PROTO.themeFromQuery = function () {
  if (typeof location === 'undefined') return null;
  const m = /[?&]theme=(dark|light)\b/.exec(location.search || '');
  return m ? m[1] : null;
};
PROTO.themeStored = function () {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v = localStorage.getItem('proto-theme');
    return v === 'dark' || v === 'light' ? v : null;
  } catch (e) { return null; }
};
PROTO.theme = PROTO.themeFromQuery() || PROTO.themeStored() || 'light';
PROTO.applyTheme = function () {
  document.documentElement.setAttribute('data-theme', PROTO.theme);
  const btn = document.querySelector('[data-proto-theme]');
  if (btn) {
    PROTO.clear(btn);
    btn.appendChild(PROTO.icon(PROTO.theme === 'light' ? 'moon' : 'sun', 18));
    btn.setAttribute('aria-label', PROTO.theme === 'light' ? t('proto.theme_dark') : t('proto.theme_light'));
  }
};
PROTO.toggleTheme = function () {
  PROTO.theme = PROTO.theme === 'light' ? 'dark' : 'light';
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('proto-theme', PROTO.theme); } catch (e) { /* noop */ }
  PROTO.applyTheme();
};
// Привязка кнопки темы. Вызывается каждой страницей (в т.ч. стартовой, где
// кнопка лежит в разметке, а не создаётся initChrome).
PROTO.initTheme = function () {
  const btn = document.querySelector('[data-proto-theme]');
  if (btn && !btn.getAttribute('data-proto-theme-bound')) {
    btn.setAttribute('data-proto-theme-bound', '1');
    btn.addEventListener('click', PROTO.toggleTheme);
  }
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

// ---------- Иконки (Lucide, 2px stroke, currentColor — ADR-0019) ----------
PROTO.icons = {
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'send': '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'ticket': '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/>',
  'scan-line': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'share': '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'megaphone': '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  'shield': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'more': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'external': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  'list': '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'sliders': '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  'qr': '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'star': '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  'message-square': '<path d="M22 17a2 2 0 0 1-2 2H6l-4 4V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>',
  'map': '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  'navigation': '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
};
PROTO.icon = function (name, size) {
  const span = PROTO.el('span', 'proto-icon');
  span.setAttribute('aria-hidden', 'true');
  const px = size || 18;
  span.style.width = px + 'px';
  span.style.height = px + 'px';
  span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (PROTO.icons[name] || '') + '</svg>';
  return span;
};

// ---------- Остаток мест (OWN-15) ----------
// Одно правило для всех экранов и чата: лимит ceil(capacity × (1 + overbook/100))
// минус зарегистрированные. Живёт здесь, а не в фикстурах, чтобы числа
// не разъезжались между поверхностями.
PROTO.seatsLeft = function (capacity, overbook, registered) {
  const cap = parseInt(capacity, 10);
  if (!cap || cap <= 0) return null;
  const over = overbook === '' || overbook === null || overbook === undefined ? 40 : parseInt(overbook, 10);
  const limit = Math.ceil(cap * (1 + (isNaN(over) ? 0 : over) / 100));
  return Math.max(0, limit - (registered || 0));
};

// ---------- Слой трассировки и демо-шиты (ADR-0027 п. 4) ----------
PROTO._trace = [];
PROTO._demoItems = [];
PROTO._demoNote = '';
PROTO._sheetKind = null;

PROTO.setTrace = function (ids) {
  PROTO._trace = ids || [];
  if (PROTO._sheetKind === 'trace') PROTO.renderSheetBody();
};
PROTO.setDemo = function (items, note) {
  PROTO._demoItems = items || [];
  PROTO._demoNote = note || '';
  if (PROTO._sheetKind === 'demo') PROTO.renderSheetBody();
};
PROTO.demoNote = function (text) {
  PROTO._demoNote = text || '';
  PROTO.openSheet('demo');
};
PROTO.openSheet = function (kind) {
  PROTO._sheetKind = kind;
  const sheet = document.querySelector('[data-proto-sheet]');
  if (!sheet) return;
  sheet.removeAttribute('hidden');
  const title = document.querySelector('[data-proto-sheet-title]');
  if (title) title.textContent = kind === 'trace' ? t('proto.sheet_trace') : t('proto.sheet_demo');
  PROTO.renderSheetBody();
  PROTO.syncDock();
};
PROTO.closeSheet = function () {
  PROTO._sheetKind = null;
  const sheet = document.querySelector('[data-proto-sheet]');
  if (sheet) sheet.setAttribute('hidden', '');
  PROTO.syncDock();
};
PROTO.toggleSheet = function (kind) {
  if (PROTO._sheetKind === kind) PROTO.closeSheet(); else PROTO.openSheet(kind);
};
PROTO.renderSheetBody = function () {
  const body = document.querySelector('[data-proto-sheet-body]');
  if (!body) return;
  PROTO.clear(body);
  if (PROTO._sheetKind === 'trace') {
    body.appendChild(PROTO.el('p', 'proto-sheet-note', t('proto.trace_note')));
    if (!PROTO._trace.length) body.appendChild(PROTO.el('p', 'proto-sheet-empty', t('proto.trace_empty')));
    PROTO._trace.forEach((id) => {
      const item = PROTO.el('div', 'proto-trace-item');
      item.appendChild(PROTO.el('span', 'proto-trace-id', id));
      item.appendChild(PROTO.el('span', 'proto-trace-text', PROTO.specMap[id] || ''));
      body.appendChild(item);
    });
    return;
  }
  body.appendChild(PROTO.el('p', 'proto-sheet-note', t('proto.demo_hint')));
  const row = PROTO.el('div', 'proto-chips');
  PROTO._demoItems.forEach((it) => {
    if (it.active) { row.appendChild(PROTO.el('span', 'proto-chip active', it.label)); return; }
    const b = PROTO.el('button', 'proto-chip', it.label);
    b.type = 'button';
    if (it.onClick) b.addEventListener('click', () => { it.onClick(); });
    else if (it.href) b.addEventListener('click', () => { location.href = it.href; });
    row.appendChild(b);
  });
  body.appendChild(row);
  if (PROTO._demoNote) body.appendChild(PROTO.el('div', 'proto-sheet-state', PROTO._demoNote));
};

PROTO.syncDock = function () {
  document.querySelectorAll('[data-proto-dock-btn]').forEach((b) => {
    const kind = b.getAttribute('data-proto-dock-btn');
    if (PROTO._sheetKind === kind) b.classList.add('active'); else b.classList.remove('active');
  });
};

// ---------- Обвязка страницы ----------
PROTO.initChrome = function (opts) {
  const o = opts || {};
  const bar = document.querySelector('[data-proto-bar]');
  if (bar) {
    PROTO.clear(bar);
    const back = PROTO.el('a', 'proto-bar-back');
    back.href = 'index.html';
    back.appendChild(PROTO.icon('arrow-left', 18));
    back.appendChild(PROTO.el('span', '', t('proto.to_start')));
    bar.appendChild(back);
    if (o.title) bar.appendChild(PROTO.el('span', 'proto-bar-title', o.title));
    const themeBtn = PROTO.el('button', 'proto-icon-btn');
    themeBtn.type = 'button';
    themeBtn.setAttribute('data-proto-theme', '');
    bar.appendChild(themeBtn);
  }
  const dock = document.querySelector('[data-proto-dock]');
  if (dock) {
    PROTO.clear(dock);
    const demo = PROTO.el('button', 'proto-dock-btn');
    demo.type = 'button';
    demo.setAttribute('data-proto-dock-btn', 'demo');
    demo.appendChild(PROTO.icon('list', 16));
    demo.appendChild(PROTO.el('span', '', o.dockLabel || t('proto.dock_demo')));
    demo.addEventListener('click', () => PROTO.toggleSheet('demo'));
    dock.appendChild(demo);

    const trace = PROTO.el('button', 'proto-dock-btn');
    trace.type = 'button';
    trace.setAttribute('data-proto-dock-btn', 'trace');
    trace.appendChild(PROTO.icon('info', 16));
    trace.appendChild(PROTO.el('span', '', t('proto.dock_trace')));
    trace.addEventListener('click', () => PROTO.toggleSheet('trace'));
    dock.appendChild(trace);
  }
  const close = document.querySelector('[data-proto-sheet-close]');
  if (close) close.addEventListener('click', PROTO.closeSheet);
  PROTO.initTheme();
  if (!PROTO.dictLoaded) {
    const warn = document.querySelector('[data-proto-warn]');
    if (warn) warn.removeAttribute('hidden');
  }
};

PROTO.protoLink = function (label, href, kind) {
  const a = PROTO.el('a', 'proto-btn ' + (kind === 'primary' ? 'proto-btn-primary' : 'proto-btn-outline'), label);
  a.href = href;
  return a;
};

PROTO.nowTime = function () {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
PROTO.toast = function (msg) {
  const node = PROTO.el('div', 'proto-toast', msg);
  document.body.appendChild(node);
  setTimeout(() => node.classList.add('show'), 10);
  setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 250); }, 1700);
};
PROTO.copy = function (text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => PROTO.toast(t('manage.btn.copied')), () => PROTO.toast(text));
  } else PROTO.toast(text);
};
PROTO.appUrl = function (route, backUrl) {
  const sep = route.indexOf('?') >= 0 ? '&' : '?';
  return 'app.html' + route + sep + 'back=' + encodeURIComponent(backUrl || 'index.html');
};
// Событие, вокруг которого идёт чат-сценарий: пока он выбран, все ссылки чата
// (шаги, чипы демо, обратный путь из Mini App) несут его с собой.
PROTO.chatEventId = function () {
  try { return (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('proto-chat-event')) || ''; } catch (e) { return ''; }
};
PROTO.setChatEvent = function (id) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (id) sessionStorage.setItem('proto-chat-event', String(id));
    else sessionStorage.removeItem('proto-chat-event');
  } catch (e) { /* noop */ }
};
PROTO.chatUrl = function (scenario, step, resume, eventId) {
  if (eventId) PROTO.setChatEvent(eventId);
  const ev = eventId || PROTO.chatEventId();
  return 'chat.html?s=' + encodeURIComponent(scenario)
    + (step ? '&step=' + encodeURIComponent(step) : '')
    + (resume ? '&resume=1' : '')
    + (ev ? '&event=' + encodeURIComponent(ev) : '');
};
