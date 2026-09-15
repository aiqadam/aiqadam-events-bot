// Сценарии прототипа W41 — данные, из которых chat.js рисует диалог.
// Каждый шаг — сообщение (user / bot) или карточка (card / card-edit).
// card-edit — карточка-экран, редактируемая на месте (ADR-0017 п. 1).
// web_app-кнопка уходит в мок Mini App (app.html) с адресом возврата в чат.
'use strict';

function buildScenario(name) {
  const D = PROTO.protoDict;
  const T = (k, vars) => t(k, vars);
  const evt = {
    id: 'demo',
    title: 'AI Qadam Meetup · Ташкент',
    when: 'сб, 26 сент · 18:00',
    address: 'Ташкент, ул. Афросиаб, 1',
    seatsLeft: '42',
    deadline: 'ср, 23 сент',
  };

  // Общий каркас карточки ивента (карточка-экран, reg-start)
  const evCard = (body, buttons) => ({
    type: 'card',
    built: true,
    spec: 'PAR-1 · ADR-0017',
    title: evt.title,
    rows: [
      ['Когда', evt.when],
      ['Где', evt.address],
      ['Мест', 'Свободных мест: ' + evt.seatsLeft],
      ['Регистрация до', evt.deadline],
    ],
    body,
    buttons,
  });

  const scenarios = {
    guest: {
      title: 'Гость',
      steps: [
        {
          type: 'bot',
          text: T('start.greeting_anon'),
        },
        {
          type: 'user',
          text: 'https://t.me/aiqadam_events_bot?start=e' + evt.id + '-utm',
          note: D['proto.chat.deep_link'],
        },
        {
          ...evCard(T('reg.consent_pdn.ask'), [
            { label: T('reg.consent_pdn.btn_yes'), next: 'guest-mkt' },
            { label: T('reg.consent_pdn.btn_no'), next: 'guest-pdn-no' },
          ]),
        },
        {
          id: 'guest-pdn-no',
          type: 'card-edit',
          built: true,
          spec: 'PAR-1',
          title: evt.title,
          rows: [],
          body: T('reg.consent_pdn.declined'),
          buttons: [{ label: T('common.btn.menu'), next: 'end' }],
        },
        {
          id: 'guest-mkt',
          type: 'card-edit',
          built: true,
          spec: 'PAR-2',
          title: evt.title,
          rows: [],
          body: T('reg.consent_marketing.ask'),
          buttons: [
            { label: T('reg.consent_marketing.btn_yes'), next: 'guest-done' },
            { label: T('reg.consent_marketing.btn_no'), next: 'guest-done' },
          ],
        },
        {
          id: 'guest-done',
          type: 'card-edit',
          built: true,
          spec: 'PAR-6 · ADR-0007',
          title: T('reg.done.header'),
          rows: [],
          body: T('reg.qr.open_miniapp'),
          buttons: [
            { label: T('reg.qr.button'), webApp: '#/ticket?event_id=' + evt.id, next: 'guest-remind' },
          ],
        },
        {
          id: 'guest-remind',
          type: 'bot',
          text: '— ' + D['proto.chat.reminder_24h'] + ' —\n' + T('remind.24h', { title: evt.title, when: 'завтра, 18:00', address: evt.address }),
          proposal: true,
          spec: 'W12 · IDM-3',
        },
        {
          type: 'bot',
          text: '— ' + D['proto.chat.reminder_2h'] + ' —\n' + T('remind.2h', { title: evt.title, when: '18:00', address: evt.address }),
          proposal: true,
          spec: 'W12 · IDM-3',
        },
        {
          type: 'bot',
          text: '— ' + D['proto.chat.afterword'] + ' —\n' + T('afterword.thanks') + '\n' + T('afterword.next_header') + ' ' + T('afterword.no_next'),
          proposal: true,
          spec: 'W12 · ADR-0017 п. 7',
        },
      ],
    },

    owner: {
      title: 'Овнер (staff)',
      steps: [
        {
          type: 'user',
          text: '/start',
        },
        {
          type: 'card',
          built: true,
          spec: 'W34 · ADR-0025',
          title: T('menu.title'),
          rows: [],
          body: '',
          buttons: [
            { label: T('menu.btn.events'), next: 'owner-events' },
            { label: T('menu.btn.my_registrations'), next: 'owner-myreg' },
            { label: T('menu.btn.new_event'), webApp: '#/manage', next: 'owner-app' },
            { label: T('menu.btn.scanner'), webApp: '#/scan?event_id=' + evt.id, next: 'owner-app' },
          ],
        },
        {
          id: 'owner-events',
          type: 'bot',
          text: '— ' + D['proto.w38.title'] + ' (PAR-3, экран #/events — ' + T('proto.w38.title').toLowerCase() + ') —',
          proposal: true,
          spec: 'W38 · ADR-0023',
        },
        {
          id: 'owner-myreg',
          type: 'bot',
          text: T('myreg.title') + ':\n' + T('myreg.empty'),
          built: true,
          spec: 'PAR-4 · W06',
        },
        {
          id: 'owner-app',
          type: 'bot',
          text: '— открыт Mini App; возврат сюда из мока — ссылкой «← в чат» —',
        },
        {
          type: 'card',
          built: true,
          spec: 'OWN-6 · W37',
          title: T('manage.chat.published', { title: evt.title }),
          rows: [],
          body: D['proto.chat.deep_link'] + ': t.me/aiqadam_events_bot?start=e' + evt.id,
          buttons: [
            { label: T('manage.btn.copy'), next: 'owner-participants' },
          ],
        },
        {
          id: 'owner-participants',
          type: 'bot',
          text: '— ' + T('participants.title', { title: evt.title }) + ' —\n' + T('participants.counters', { registered: '48', checked_in: '31', cancelled: '2' }),
          proposal: true,
          spec: 'W13 · OWN-7',
        },
        {
          type: 'card',
          built: false,
          proposal: true,
          spec: 'W14 · OWN-9…OWN-13',
          title: D['proto.w14.title'],
          rows: [],
          body: D['proto.w14.forward_hint'],
          buttons: [
            { label: D['proto.w14.segment_registered'] + ' · 48', next: 'end' },
            { label: D['proto.w14.test_first'], next: 'end' },
          ],
        },
      ],
    },

    controller: {
      title: 'Контролёр',
      steps: [
        {
          type: 'bot',
          text: T('start.greeting_anon'),
        },
        {
          type: 'card',
          built: true,
          spec: 'W34 · ADR-0025',
          title: T('menu.title'),
          rows: [],
          body: '',
          buttons: [
            { label: T('menu.btn.scanner'), webApp: '#/scan?event_id=' + evt.id, next: 'controller-app' },
          ],
        },
        {
          id: 'controller-app',
          type: 'bot',
          text: '— открыт сканер Mini App; четыре исхода STF-4 см. в моке —',
        },
        {
          type: 'bot',
          text: '— ' + T('checkin.ok', { name: 'Азиза Каримова' }) + ' (STF-4: успех) —',
          built: true,
          spec: 'STF-4',
        },
        {
          type: 'bot',
          text: T('checkin.already', { time: '18:42' }) + ' (STF-4: повторный скан, Asia/Tashkent)',
          built: true,
          spec: 'STF-4 · IDM-2',
        },
        {
          type: 'bot',
          text: T('checkin.not_registered') + ' (STF-4: нет регистрации)',
          built: true,
          spec: 'STF-4',
        },
        {
          type: 'bot',
          text: T('checkin.wrong_event') + ' (STF-4: чужой QR)',
          built: true,
          spec: 'STF-4',
        },
      ],
    },
  };

  return scenarios[name];
}