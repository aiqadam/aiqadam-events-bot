// Прототип W41 — сквозные сценарии чата (ADR-0027).
// Чистые данные: ни DOM, ни сети. Тексты — из i18n/ru.json (PROTO.dict) и
// словаря прототипа. Карточка диалога редактируется на месте (ADR-0017 п. 1):
// шаг с edit:true заменяет активную карточку, а не отправляет новую.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

PROTO.buildScenarios = function (opts) {
  const T = PROTO.t;
  const D = PROTO.data;
  const P = PROTO.protoDict;
  const o = opts || {};
  // Сценарий овнера открывается на конкретное событие (кнопка «Перейти в чат»
  // из рассылки передаёт event); без параметра — главное событие.
  const ev = (o.eventId && D.ownerEvents.find((e) => String(e.id) === String(o.eventId))) || D.main;
  const ed = D.eventData[String(ev.id)] || D.eventData[D.main.id];

  // Карточка события — общий каркас гостевого пути. Строки — формат VOICE
  // «Метка: значение», как их отдаёт i18n.
  const eventCard = (extraBody) => ({
    title: T('event.card.header', { title: ev.title }),
    lines: [
      T('event.card.when', { when: ev.whenLong }),
      T('event.card.where', { address: ev.address }),
      T('event.card.seats_left', { left: PROTO.seatsLeft(ev.capacity, ev.overbook, ed.counts.registered) }),
      T('event.card.deadline', { when: ev.deadline }),
    ],
    body: T('event.card.description', { description: ev.description }) + (extraBody ? '\n\n' + extraBody : ''),
    link: { text: T('event.card.map_link', { url: ev.mapUrl }), url: ev.mapUrl },
  });

  // Мои регистрации живут экраном (PAR-4 → таб «Мои билеты»), а не карточкой
  // в чате: чат-карточка myreg из прототипа убрана вердиктом владельца.
  // «Мои билеты» — одно имя экрана и в табе, и в меню (вердикт владельца);
  // product-ключ menu.btn.my_registrations заменяется пакетом W43.
  // Гость: одна кнопка «События» — каталог и «Мои билеты» это один экран
  // (#/events открывается на первом табе «Мои билеты»), две кнопки не нужны.
  // Вердикт владельца 2026-09-18 (W49).
  const menuButtonsGuest = [
    { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu-guest' },
  ];
  // Овнер: «События» (каталог и «Мои билеты» — один экран), создание —
  // сразу форма #/manage/new (в Mini App кнопки создания нет).
  // Кнопки чекина в чате нет: сканер — рядом с событием в Mini App (STF-2).
  // Вердикт владельца 2026-09-18 (W49).
  // W51 (решение владельца 2026-09-19, поправка к вердикту): овнеру вернули
  // вход в свой список — «Панель администратора» сразу на #/manage.
  // W52 (решение владельца 2026-09-19): у овнера первой кнопкой — Управление.
  const menuButtonsOwner = [
    { label: T('menu.btn.manage'), webApp: '#/manage', resume: 'menu' },
    { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu' },
    { label: T('menu.btn.new_event'), webApp: '#/manage/new', resume: 'menu' },
  ];

  // Первое касание общее для всех ролей (ADR-0032): зачем → согласие →
  // имя (эвристика) → работа → город → «Всё верно?». `after` — шаг после
  // проверки (гость — регистрация, овнер — «профиль сохранён», контролёр —
  // accept); `declinedGo` — куда уйти при отказе от согласия.
  const obCore = (after, declinedGo) => ([
    { id: 'consent', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.consent')), trace: ['PAR-1', 'ADR-0017'],
      buttons: [
        { label: T('reg.consent_pdn.btn_yes'), go: 'name-ok' },
        { label: T('onb.btn.details'), go: 'details' },
      ] },

    { id: 'details', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.details')), trace: ['PAR-1', 'ADR-0017'],
      buttons: [
        { label: T('onb.btn.understood'), go: 'name-ok' },
        { label: T('reg.consent_pdn.btn_no'), go: 'declined' },
      ] },

    { id: 'declined', kind: 'card', edit: true, markup: true, card: { title: ev.title, lines: [], body: T('reg.consent_pdn.declined') }, trace: ['PAR-1'],
      buttons: [{ label: T('common.btn.menu'), go: declinedGo }] },

    { id: 'name-ok', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.name_ok', { name: 'Дилшод Азимов' })), trace: ['PAR-1', 'DAT-1', 'ADR-0017'],
      buttons: [
        { label: T('onb.btn.itsme'), go: 'work' },
        { label: T('onb.btn.fix_name'), go: 'ask-name' },
      ] },

    { id: 'ask-name', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.ask_name')), trace: ['PAR-1', 'ADR-0017'] },
    { id: 'user-name', kind: 'user', text: 'Дилшод Азимов', trace: ['PAR-1'] },

    { id: 'work', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.ask_work')), trace: ['PAR-1', 'ADR-0017'] },
    { id: 'user-work', kind: 'user', text: 'ML-инженер, Payme', trace: ['PAR-1'] },

    { id: 'city', kind: 'card', edit: true, markup: true, card: eventCard(T('onb.ask_city')), trace: ['PAR-1', 'ADR-0017'],
      buttons: [
        { label: 'Ташкент', go: 'review' },
        { label: 'Алматы', go: 'review' },
        { label: T('onb.btn.write'), go: 'user-city' },
      ] },
    { id: 'user-city', kind: 'user', text: 'Бишкек', trace: ['PAR-1'] },

    { id: 'review', kind: 'card', edit: true, markup: true, card: { title: T('onb.btn.all_good'), lines: [], body: T('onb.review', { profile: 'Дилшод Азимов · ML-инженер, Payme · Ташкент' }) }, trace: ['PAR-1', 'ADR-0017'],
      buttons: [
        { label: T('onb.btn.all_good'), go: after, primary: true },
        { label: T('onb.btn.fix'), go: 'ask-name' },
      ] },
  ]);

  const guest = {
    id: 'guest',
    title: 'Гость',
    hint: 'Первое касание — онбординг C (зачем → согласие → профиль → «Всё верно?»), дальше регистрация, билет, напоминания, послесловие.',
    steps: [
      { id: 'start', kind: 'user', text: '/start e' + ev.id, note: P['proto.deep_link_note'], trace: ['OWN-6', 'ADR-0025'] },

      { id: 'event', kind: 'card', markup: true, card: eventCard(T('onb.why')), trace: ['OWN-2', 'OWN-3', 'OWN-4', 'OWN-15', 'ADR-0017'],
        buttons: [{ label: T('onb.btn.continue'), go: 'consent' }] },

      ...obCore('done', 'menu-guest'),

      { id: 'done', kind: 'card', edit: true, markup: true, card: {
          title: T('reg.done.header'),
          lines: [T('event.card.when', { when: ev.whenLong }), T('event.card.where', { address: ev.address })],
          body: T('reg.done', { title: ev.title }) + '\n' + T('reg.consent_marketing.ask'),
        }, trace: ['PAR-2', 'IDM-1', 'ADR-0007'],
        buttons: [
          { label: T('reg.consent_marketing.btn_yes'), go: 'mkt-done' },
          { label: T('reg.consent_marketing.btn_no'), go: 'mkt-done' },
        ] },

      { id: 'mkt-done', kind: 'card', edit: true, markup: true, card: {
          title: T('reg.done.header'),
          lines: [T('event.card.when', { when: ev.whenLong }), T('event.card.where', { address: ev.address })],
          body: T('reg.done', { title: ev.title }) + '\n' + T('reg.qr.open_miniapp'),
        }, trace: ['PAR-6', 'IDM-1', 'ADR-0007'],
        buttons: [{ label: T('reg.qr.button'), webApp: '#/ticket?event_id=' + ev.id, resume: 'reminders' }] },

      { id: 'reminders', kind: 'bot', text: T('remind.24h', { title: ev.title, when: '18:30', address: ev.address }), trace: ['OWN-16', 'IDM-3'] },
      { id: 'reminder-2h', kind: 'bot', text: T('remind.2h', { title: ev.title, when: '18:30', address: ev.address }), trace: ['OWN-16', 'IDM-3'] },
      // Послесловие — только благодарность; предложение следующего события убрано
      // вердиктом владельца. Отзыв живёт экраном #/feedback (принят ADR-0028).
      { id: 'afterword', kind: 'bot', text: T('afterword.thanks'), trace: ['ADR-0017', 'ADR-0028'],
        buttons: [{ label: T('afterword.feedback_btn'), webApp: '#/feedback?event_id=' + ev.id, resume: 'afterword', primary: true }] },

      // Меню гостя — без грубого «Что дальше?» (общий menu.title живёт
      // в продукте для всех ролей): целевая строка — из ru.json
      // (W50 сгенерировал тексты меню из ru.json).
      // Вердикт владельца 2026-09-18 (W49).
      { id: 'menu-guest', kind: 'card', card: { title: '', lines: [], body: T('menu.lead_guest') }, trace: ['ADR-0025'],
        buttons: menuButtonsGuest },

      // Отмена регистрации из чата — состояние (в to-be основной путь отмены
      // живёт на экране билета в Mini App, PAR-5).
      { id: 'cancel', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('cancel.confirm', { title: ev.title }) }, trace: ['PAR-5'],
        buttons: [
          { label: T('cancel.btn.confirm'), go: 'cancel-done', tone: 'danger' },
          { label: T('cancel.btn.keep'), go: 'cancel-kept', primary: true },
        ] },
      { id: 'cancel-done', kind: 'card', state: true, edit: true, card: { title: ev.title, lines: [], body: T('cancel.done', { title: ev.title }) }, trace: ['PAR-5', 'IDM-1'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'cancel-kept', kind: 'card', state: true, edit: true, card: { title: ev.title, lines: [], body: T('cancel.kept') }, trace: ['PAR-5'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },

      { id: 'st-already', kind: 'card', state: true, card: eventCard(T('reg.already', { title: ev.title })), trace: ['IDM-1', 'PAR-6'],
        buttons: [{ label: T('reg.qr.button'), webApp: '#/ticket?event_id=' + ev.id, resume: 'st-already', primary: true }] },
      { id: 'st-no-seats', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('reg.no_seats') }, trace: ['OWN-15'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'st-deadline', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('reg.deadline_passed', { when: ev.deadline }) }, trace: ['OWN-15'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'st-not-published', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('reg.not_published') }, trace: ['OWN-4'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'st-cancelled', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('reg.event_cancelled') }, trace: ['OWN-4'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'st-finished', kind: 'card', state: true, card: { title: ev.title, lines: [], body: T('reg.event_finished') }, trace: ['OWN-4'],
        buttons: [{ label: T('menu.btn.events'), webApp: '#/events', resume: 'menu-guest' }] },
      { id: 'st-bad-payload', kind: 'card', state: true, card: { title: T('menu.title'), lines: [], body: T('start.bad_payload') }, trace: ['ADR-0025'],
        buttons: menuButtonsGuest },
      // Подозрительное имя: кнопки «Это я» нет, только ручной ввод.
      { id: 'suspect', kind: 'card', state: true, markup: true, card: eventCard(T('onb.suspect', { name: 'Crypto King 👑' })), trace: ['PAR-1', 'DAT-1', 'ADR-0017'],
        buttons: [{ label: T('onb.btn.write_name'), go: 'ask-name', primary: true }] },
    ],
  };

  const owner = {
    id: 'owner',
    title: 'Организатор',
    hint: 'Первое касание — тот же онбординг, дальше меню → создание события в Mini App → ссылка-приглашение → правка → участники и экспорт → рассылка пересылкой → контролёры.',
    steps: [
      { id: 'start', kind: 'user', text: '/start', trace: ['ADR-0025'] },
      { id: 'ob-event', kind: 'card', markup: true, card: eventCard(T('onb.why')), trace: ['OWN-2', 'OWN-3', 'ADR-0017'],
        buttons: [{ label: T('onb.btn.continue'), go: 'consent' }] },

      ...obCore('profile-saved', 'menu'),

      { id: 'profile-saved', kind: 'card', edit: true, markup: true, card: { title: T('profile.tab'), lines: [], body: T('onb.profile_saved') }, trace: ['PAR-1', 'ADR-0017'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },
      // Меню овнера — без «Что дальше?» (см. меню гостя): целевая строка —
      // из ru.json. Вердикт владельца 2026-09-18 (W49).
      { id: 'menu', kind: 'card', card: { title: '', lines: [], body: T('menu.lead_owner') }, trace: ['ADR-0025'],
        buttons: menuButtonsOwner },

      // W37 / MINIAPP-UX п. 7: чат несёт факт, ссылка живёт на экране события.
      { id: 'published', kind: 'bot', text: T('manage.chat.published', { title: ev.title }), trace: ['OWN-1', 'OWN-4', 'OWN-6'],
        buttons: [{ label: T('owner.event.btn.edit'), webApp: '#/manage/' + ev.id, resume: 'published' }] },

      { id: 'updated', kind: 'bot', text: T('manage.chat.updated_notified', { title: ev.title, count: ed.counts.registered }), trace: ['OWN-5'] },
      { id: 'notify', kind: 'card', card: {
          title: T('notify.changed.header', { title: ev.title }), lines: [],
          body: (ev.changes || []).map((c) => T('notify.changed.line', { field: c.field, old: c.old, new: c.now })).join('\n'),
        }, trace: ['OWN-5'], buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'cancelled', kind: 'bot', text: T('manage.chat.cancelled', { title: ev.title, count: ed.counts.registered }), trace: ['OWN-4'] },
      { id: 'cancel-notify', kind: 'bot', text: T('notify.event_cancelled', { title: ev.title }), trace: ['OWN-4'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'broadcast', kind: 'card', cardSub: ev.title, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.ask.body') }, trace: ['OWN-9'],
        buttons: [{ label: T('bcast.ask.segment'), go: 'segment' }] },
      // Подписи кнопок — короткие (VOICE: до 23 знаков); полное имя сегмента
      // остаётся в тексте экрана рассылки.
      { id: 'segment', kind: 'card', edit: true, cardSub: ev.title, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.ask.segment') }, trace: ['OWN-9'],
        buttons: [
          { label: T('proto.bcast_btn_all', { count: ed.segments.all_consent }), go: 'forwarded' },
          { label: T('proto.bcast_btn_registered', { count: ed.segments.registered }), go: 'forwarded' },
          { label: T('proto.bcast_btn_checked_in', { count: ed.segments.checked_in }), go: 'forwarded' },
          { label: T('participants.filter.btn.no_show'), go: 'st-bcast-noshow' },
        ] },
      { id: 'forwarded', kind: 'user', forwarded: true, text: (ev.broadcastText || P['proto.broadcast_sample']), trace: ['OWN-9'] },
      { id: 'preview', kind: 'card', edit: true, cardSub: ev.title, card: {
          title: T('bcast.preview.title'), lines: [],
          body: (ev.broadcastText || P['proto.broadcast_sample']) + '\n\n' + T('bcast.preview.count', { count: ed.segments.registered }),
        }, trace: ['OWN-10'],
        // Кнопка отправки появляется только после теста себе: в Telegram нет
        // «выключенной» кнопки — сообщение редактируется и клавиатура меняется.
        buttons: [{ label: T('bcast.btn.test'), go: 'tested' }] },
      { id: 'tested', kind: 'card', edit: true, cardSub: ev.title, card: {
          title: T('bcast.preview.title'), lines: [],
          body: (ev.broadcastText || P['proto.broadcast_sample']) + '\n\n' + T('bcast.preview.count', { count: ed.segments.registered }) + '\n' + T('bcast.test.sent'),
        }, trace: ['OWN-10'],
        buttons: [{ label: T('bcast.btn.send'), go: 'sent', primary: true }] },
      { id: 'sent', kind: 'card', edit: true, card: {
          title: T('owner.event.btn.broadcast'), lines: [],
          body: T('bcast.started', { count: ed.broadcast.total }) + '\n' + T('bcast.progress', { sent: ed.broadcast.sent, total: ed.broadcast.total, failed: 0 }),
        }, trace: ['OWN-11', 'OWN-12'] },
      { id: 'mass', kind: 'bot', text: (ev.broadcastText || P['proto.broadcast_sample']), trace: ['OWN-13'],
        buttons: [{ label: T('bcast.btn.unsubscribe'), go: 'unsub-done' }] },
      { id: 'unsub-done', kind: 'bot', text: T('unsub.done'), trace: ['OWN-13'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },
      { id: 'finished', kind: 'bot', text: T('bcast.finished', { sent: ed.broadcast.sent, failed: 0 }), trace: ['OWN-11'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'staff-invite', kind: 'card', card: {
          title: T('staff.btn.invite'), lines: [],
          body: T('staff.invite.created', { url: 'https://t.me/' + D.botUsername + '?start=s' + ev.id + '-9f2c1a' }),
        }, trace: ['OWN-14'], buttons: [{ label: T('manage.btn.copy'), copy: 'https://t.me/' + D.botUsername + '?start=s' + ev.id + '-9f2c1a' }] },

      { id: 'st-bcast-noshow', kind: 'card', state: true, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.segment.no_show_locked', { when: ev.ends }) }, trace: ['OWN-9'],
        buttons: [{ label: T('common.btn.back'), go: 'segment' }] },
      { id: 'st-bcast-empty', kind: 'card', state: true, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.empty_segment') }, trace: ['OWN-9'],
        buttons: [{ label: T('common.btn.back'), go: 'segment' }] },
      { id: 'st-bcast-cancelled', kind: 'card', state: true, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.cancelled') }, trace: ['OWN-9'],
        buttons: [{ label: T('common.btn.back'), go: 'segment' }] },
      { id: 'st-forbidden', kind: 'card', state: true, card: { title: T('manage.title.edit'), lines: [], body: T('manage.err.forbidden') }, trace: ['OWN-5'] },
    ],
  };
  const controller = {
    id: 'controller',
    title: 'Контролёр',
    hint: 'Первое касание — тот же онбординг, дальше инвайт-ссылка → права на событие → сканер Mini App: четыре исхода, луп без закрытия.',
    steps: [
      { id: 'invite', kind: 'user', text: '/start s' + ev.id + '-9f2c1a', note: P['proto.staff_invite_note'], trace: ['OWN-14'] },
      { id: 'ob-event', kind: 'card', markup: true, card: eventCard(T('onb.why')), trace: ['OWN-2', 'OWN-3', 'ADR-0017'],
        buttons: [{ label: T('onb.btn.continue'), go: 'consent' }] },

      ...obCore('accept-ok', 'menu'),
      // Кнопка сканера — сразу в сообщении: контролёр здесь конкретный,
      // событие известен (вердикт владельца 2026-09-18). Общие меню чата
      // кнопок чекина не несут.
      { id: 'accept-ok', kind: 'card', card: { title: ev.title, lines: [], body: T('staff.accept.ok', { title: ev.title }) }, trace: ['OWN-14', 'STF-2'],
        buttons: [{ label: T('staff.accept.btn.scanner'), webApp: '#/scan?event_id=' + ev.id, resume: 'accept-ok', primary: true }] },
      // Меню контролёра — без «Что дальше?», как у гостя и овнера (W49).
      { id: 'menu', kind: 'card', card: { title: '', lines: [], body: T('menu.lead_controller') }, trace: ['ADR-0025'],
        buttons: [
          { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu' },
        ] },
      { id: 'st-accept-invalid', kind: 'card', state: true, card: { title: T('menu.title'), lines: [], body: T('staff.accept.invalid') }, trace: ['OWN-14'] },
      { id: 'st-accept-used', kind: 'card', state: true, card: { title: T('menu.title'), lines: [], body: T('staff.accept.used') }, trace: ['OWN-14'] },
      { id: 'st-accept-expired', kind: 'card', state: true, card: { title: T('menu.title'), lines: [], body: T('staff.accept.expired') }, trace: ['OWN-14'] },
    ],
  };

  return { guest: guest, owner: owner, controller: controller };
};

PROTO.stateIndex = {
  guest: [
    ['st-already', 'Повторная регистрация'],
    ['st-no-seats', 'Мест нет (OWN-15)'],
    ['st-deadline', 'Дедлайн прошёл'],
    ['st-not-published', 'Событие не опубликован'],
    ['st-cancelled', 'Событие отменён'],
    ['st-finished', 'Событие завершён'],
    ['st-bad-payload', 'Ссылка не разобрана'],
    ['suspect', 'Подозрительное имя — без «Это я»'],
    ['declined', 'Отказ от согласия'],
    ['cancel', 'Отмена регистрации'],
  ],
  owner: [
    ['st-forbidden', 'Нет прав на правку'],
    ['st-bcast-noshow', 'Сегмент «не пришли» заблокирован'],
    ['st-bcast-empty', 'Пустой сегмент'],
    ['st-bcast-cancelled', 'Рассылка отменена'],
  ],
  controller: [
    ['st-accept-invalid', 'Инвайт не найден'],
    ['st-accept-used', 'Инвайт использован'],
    ['st-accept-expired', 'Срок инвайта истёк'],
  ],
};
