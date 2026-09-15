// Прототип W41 — сквозные сценарии чата (ADR-0027).
// Чистые данные: ни DOM, ни сети. Тексты — из i18n/ru.json (PROTO.dict) и
// словаря прототипа. Карточка диалога редактируется на месте (ADR-0017 п. 1):
// шаг с edit:true заменяет активную карточку, а не отправляет новую.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

PROTO.buildScenarios = function () {
  const T = PROTO.t;
  const D = PROTO.data;
  const ev = D.main;
  const P = PROTO.protoDict;

  // Карточка ивента — общий каркас гостевого пути. Строки — формат VOICE
  // «Метка: значение», как их отдаёт i18n.
  const eventCard = (extraBody) => ({
    title: T('event.card.header', { title: ev.title }),
    lines: [
      T('event.card.when', { when: ev.whenLong }),
      T('event.card.where', { address: ev.address }),
      T('event.card.seats_left', { left: ev.seatsLeft }),
      T('event.card.deadline', { when: ev.deadline }),
    ],
    body: T('event.card.description', { description: ev.description }) + (extraBody ? '\n\n' + extraBody : ''),
    link: { text: T('event.card.map_link', { url: ev.mapUrl }), url: ev.mapUrl },
  });

  const menuButtonsGuest = [
    { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu-guest' },
    { label: T('menu.btn.my_registrations'), go: 'myreg' },
  ];
  const menuButtonsOwner = [
    { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu' },
    { label: T('menu.btn.my_registrations'), go: 'myreg' },
    { label: T('menu.btn.new_event'), webApp: '#/manage', resume: 'menu' },
    { label: T('menu.btn.scanner'), webApp: '#/scan?event_id=' + ev.id, resume: 'menu' },
  ];

  const guest = {
    id: 'guest',
    title: 'Гость',
    hint: 'Регистрация по ссылке: карточка ивента → два согласия → билет → напоминания → послесловие.',
    steps: [
      { id: 'start', kind: 'user', text: '/start e' + ev.id, note: P['proto.deep_link_note'], trace: ['OWN-6', 'ADR-0025'] },

      { id: 'event', kind: 'card', card: eventCard(), trace: ['OWN-2', 'OWN-3', 'OWN-4', 'OWN-15', 'ADR-0017'],
        buttons: [{ label: T('event.card.btn_register'), go: 'consent-pdn', primary: true }] },

      { id: 'consent-pdn', kind: 'card', edit: true, card: eventCard(T('reg.consent_pdn.ask')), trace: ['PAR-1', 'ADR-0017'],
        buttons: [
          { label: T('reg.consent_pdn.btn_yes'), go: 'consent-mkt', primary: true },
          { label: T('reg.consent_pdn.btn_no'), go: 'pdn-declined' },
        ] },

      { id: 'pdn-declined', kind: 'card', edit: true, card: { title: ev.title, lines: [], body: T('reg.consent_pdn.declined') }, trace: ['PAR-1'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },

      { id: 'consent-mkt', kind: 'card', edit: true, card: eventCard(T('reg.consent_marketing.ask')), trace: ['PAR-2', 'ADR-0017'],
        buttons: [
          { label: T('reg.consent_marketing.btn_yes'), go: 'done', primary: true },
          { label: T('reg.consent_marketing.btn_no'), go: 'done' },
        ] },

      { id: 'done', kind: 'card', edit: true, card: {
          title: T('reg.done.header'),
          lines: [T('event.card.when', { when: ev.whenLong }), T('event.card.where', { address: ev.address })],
          body: T('reg.done', { title: ev.title }) + '\n' + T('reg.qr.open_miniapp'),
        }, trace: ['PAR-6', 'IDM-1', 'ADR-0007'],
        buttons: [{ label: T('reg.qr.button'), webApp: '#/ticket?event_id=' + ev.id, resume: 'reminders', primary: true }] },

      { id: 'reminders', kind: 'bot', text: T('remind.24h', { title: ev.title, when: ev.whenLong, address: ev.address }), trace: ['OWN-16', 'IDM-3'] },
      { id: 'reminder-2h', kind: 'bot', text: T('remind.2h', { title: ev.title, when: '18:30', address: ev.address }), trace: ['OWN-16', 'IDM-3'] },
      { id: 'afterword', kind: 'bot', text: T('afterword.thanks') + '\n' + T('afterword.next_header') + ' ' + D.next.title + ' — ' + D.next.when, trace: ['ADR-0017'],
        buttons: [{ label: T('afterword.btn_next'), webApp: '#/events', resume: 'afterword', primary: true }] },

      { id: 'menu-guest', kind: 'card', card: { title: T('menu.title'), lines: [], body: '' }, trace: ['ADR-0025'],
        buttons: menuButtonsGuest },

      { id: 'myreg', kind: 'card', card: {
          title: T('myreg.title'), lines: [],
          body: D.myRegs.map((r) => T('myreg.item', { title: r.title, when: r.when, status: T(r.statusKey) })).join('\n'),
        }, trace: ['PAR-4'],
        buttons: [{ label: T('myreg.btn.cancel'), go: 'cancel', tone: 'danger' }, { label: T('common.btn.menu'), go: 'menu-guest' }] },

      { id: 'cancel', kind: 'card', card: { title: ev.title, lines: [], body: T('cancel.confirm', { title: ev.title }) }, trace: ['PAR-5'],
        buttons: [
          { label: T('cancel.btn.confirm'), go: 'cancel-done', tone: 'danger' },
          { label: T('cancel.btn.keep'), go: 'cancel-kept', primary: true },
        ] },
      { id: 'cancel-done', kind: 'card', edit: true, card: { title: ev.title, lines: [], body: T('cancel.done', { title: ev.title }) }, trace: ['PAR-5', 'IDM-1'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu-guest' }] },
      { id: 'cancel-kept', kind: 'card', edit: true, card: { title: ev.title, lines: [], body: T('cancel.kept') }, trace: ['PAR-5'],
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
    ],
  };

  const owner = {
    id: 'owner',
    title: 'Организатор',
    hint: 'Меню → создание ивента в Mini App → ссылка-приглашение → правка → участники и экспорт → рассылка пересылкой → контролёры.',
    steps: [
      { id: 'start', kind: 'user', text: '/start', trace: ['ADR-0025'] },
      { id: 'menu', kind: 'card', card: { title: T('menu.title'), lines: [], body: '' }, trace: ['ADR-0025'],
        buttons: menuButtonsOwner },

      { id: 'myreg', kind: 'card', card: {
          title: T('myreg.title'), lines: [],
          body: D.myRegs.map((r) => T('myreg.item', { title: r.title, when: r.when, status: T(r.statusKey) })).join('\n'),
        }, trace: ['PAR-4'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'published', kind: 'bot', text: T('manage.chat.published', { title: ev.title }), trace: ['OWN-1', 'OWN-4'] },
      { id: 'invite', kind: 'card', card: {
          title: T('manage.invite.title'), lines: [],
          body: ev.inviteLink + '\n' + T('manage.invite.hint'),
        }, trace: ['OWN-6'],
        buttons: [
          { label: T('manage.btn.copy'), copy: ev.inviteLink },
          { label: T('manage.btn.share'), share: ev.inviteLink },
          { label: T('owner.btn.new_link'), go: 'links' },
        ] },
      { id: 'links', kind: 'card', edit: true, card: {
          title: T('owner.links.title', { title: ev.title }), lines: [],
          body: T('owner.links.plain', { url: ev.inviteLink }) + '\n' + ev.utm.map((u) => T('owner.links.item', { utm: u.utm, url: u.url })).join('\n'),
        }, trace: ['OWN-6'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'updated', kind: 'bot', text: T('manage.chat.updated_notified', { title: ev.title, count: D.counts.registered }), trace: ['OWN-5'] },
      { id: 'notify', kind: 'card', card: {
          title: T('notify.changed.header', { title: ev.title }), lines: [],
          body: ev.changes.map((c) => T('notify.changed.line', { field: c.field, old: c.old, new: c.now })).join('\n'),
        }, trace: ['OWN-5'], buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'cancelled', kind: 'bot', text: T('manage.chat.cancelled', { title: ev.title, count: D.counts.registered }), trace: ['OWN-4'] },
      { id: 'cancel-notify', kind: 'bot', text: T('notify.event_cancelled', { title: ev.title }), trace: ['OWN-4'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },

      { id: 'broadcast', kind: 'card', card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.ask.body') }, trace: ['OWN-9'],
        buttons: [{ label: T('bcast.ask.segment'), go: 'segment', primary: true }] },
      { id: 'segment', kind: 'card', edit: true, card: { title: T('owner.event.btn.broadcast'), lines: [], body: T('bcast.ask.segment') }, trace: ['OWN-9'],
        buttons: [
          { label: T('bcast.segment.all_consent') + ' · ' + D.segments.all_consent, go: 'forwarded' },
          { label: T('bcast.segment.registered') + ' · ' + D.segments.registered, go: 'forwarded' },
          { label: T('bcast.segment.checked_in') + ' · ' + D.segments.checked_in, go: 'forwarded' },
          { label: T('bcast.segment.no_show'), go: 'st-bcast-noshow' },
        ] },
      { id: 'forwarded', kind: 'user', forwarded: true, text: P['proto.broadcast_sample'], trace: ['OWN-9'] },
      { id: 'preview', kind: 'card', edit: true, card: {
          title: T('bcast.preview.title'), lines: [],
          body: P['proto.broadcast_sample'] + '\n\n' + T('bcast.preview.count', { count: D.segments.registered }),
        }, trace: ['OWN-10'],
        buttons: [
          { label: T('bcast.btn.test'), go: 'tested' },
          { label: T('bcast.btn.send'), disabled: true, note: T('bcast.send.blocked_no_test') },
        ] },
      { id: 'tested', kind: 'card', edit: true, card: {
          title: T('bcast.preview.title'), lines: [],
          body: P['proto.broadcast_sample'] + '\n\n' + T('bcast.preview.count', { count: D.segments.registered }) + '\n' + T('bcast.test.sent'),
        }, trace: ['OWN-10'],
        buttons: [{ label: T('bcast.btn.send'), go: 'sent', primary: true }] },
      { id: 'sent', kind: 'card', edit: true, card: {
          title: T('owner.event.btn.broadcast'), lines: [],
          body: T('bcast.started', { count: D.segments.registered }) + '\n' + T('bcast.progress', { sent: 48, total: 48, failed: 0 }),
        }, trace: ['OWN-11', 'OWN-12'] },
      { id: 'mass', kind: 'bot', text: P['proto.broadcast_sample'], trace: ['OWN-13'],
        buttons: [{ label: T('bcast.btn.unsubscribe'), go: 'unsub-done' }] },
      { id: 'unsub-done', kind: 'bot', text: T('unsub.done'), trace: ['OWN-13'],
        buttons: [{ label: T('common.btn.menu'), go: 'menu' }] },
      { id: 'finished', kind: 'bot', text: T('bcast.finished', { sent: 48, failed: 0 }), trace: ['OWN-11'],
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
    hint: 'Инвайт-ссылка → права на ивент → сканер Mini App: четыре исхода, луп без закрытия.',
    steps: [
      { id: 'invite', kind: 'user', text: '/start s' + ev.id + '-9f2c1a', note: P['proto.staff_invite_note'], trace: ['OWN-14'] },
      { id: 'accept-ok', kind: 'card', card: { title: ev.title, lines: [], body: T('staff.accept.ok', { title: ev.title }) }, trace: ['OWN-14', 'STF-2'],
        buttons: [{ label: T('staff.accept.btn.scanner'), webApp: '#/scan?event_id=' + ev.id, resume: 'accept-ok', primary: true }] },
      { id: 'notify', kind: 'bot', text: T('manage.staff.notify', { title: ev.title }), trace: ['OWN-14', 'STF-2'],
        buttons: [{ label: T('staff.accept.btn.scanner'), webApp: '#/scan?event_id=' + ev.id, resume: 'notify', primary: true }] },
      { id: 'menu', kind: 'card', card: { title: T('menu.title'), lines: [], body: '' }, trace: ['ADR-0025'],
        buttons: [
          { label: T('menu.btn.events'), webApp: '#/events', resume: 'menu' },
          { label: T('menu.btn.scanner'), webApp: '#/scan?event_id=' + ev.id, resume: 'menu' },
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
    ['st-not-published', 'Ивент не опубликован'],
    ['st-cancelled', 'Ивент отменён'],
    ['st-finished', 'Ивент завершён'],
    ['st-bad-payload', 'Ссылка не разобрана'],
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
