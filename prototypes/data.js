// Прототип W41 — фейковые данные. Никаких сетевых вызовов (ADR-0026).
// Время показано в Asia/Tashkent (OWN-3); в продукте хранение — UTC.
'use strict';
var PROTO = globalThis.PROTO || (globalThis.PROTO = {});

PROTO.data = {
  botUsername: 'aiqadam_events_bot',
  botName: 'AI Qadam Events',

  // Гость, который проходит регистрацию.
  guest: { name: 'Дилшод' },
  // Организатор (staff чаптера Ташкент).
  owner: { name: 'Азиза' },

  main: {
    id: '4',
    title: 'AI Qadam #4 · LLM Engineering in Production',
    description:
      'Четыре практика о том, как LLM-системы живут в продакшене: пайплайны оценки, версионирование промптов, дежурства и цена инференса.',
    when: 'сб, 26 сентября · 18:30',
    whenLong: 'суббота, 26 сентября · 18:30',
    ends: 'сб, 26 сентября · 22:00',
    deadline: 'ср, 23 сентября · 23:59',
    startsLocal: '2026-09-26T18:30',
    endsLocal: '2026-09-26T22:00',
    deadlineLocal: '2026-09-23T23:59',
    address: 'Ташкент, IT Park, ул. Афросиаб, 1',
    lat: 41.311081,
    lon: 69.279737,
    mapUrl: 'https://yandex.ru/maps/?pt=69.279737,41.311081&z=17&l=map',
    seatsLeft: 42,
    capacity: 120,
    overbook: 40,
    limit: 168,
    status: 'published',
    statusKey: 'status.published',
    inviteLink: 'https://t.me/aiqadam_events_bot?start=e4',
    utm: [
      { utm: 'telegram', url: 'https://t.me/aiqadam_events_bot?start=e4-telegram' },
      { utm: 'instagram', url: 'https://t.me/aiqadam_events_bot?start=e4-instagram' },
      { utm: 'friends', url: 'https://t.me/aiqadam_events_bot?start=e4-friends' },
    ],
    changes: [
      { field: 'Начало', old: '18:00', now: '18:30' },
      { field: 'Адрес', old: 'IT Park, блок B', now: 'IT Park, ул. Афросиаб, 1' },
    ],
  },

  draft: {
    id: '5',
    title: 'Мастер-класс по LLM',
    when: 'вс, 4 октября · 14:00',
    status: 'draft',
    statusKey: 'status.draft',
  },

  // Ближайший ивент для послесловия и каталога.
  next: {
    id: '6',
    title: 'RAG Reading Group · «The Faiss Library»',
    when: 'пн, 5 октября · 19:00',
  },

  catalog: {
    upcoming: [
      { id: '4', title: 'AI Qadam #4 · LLM Engineering in Production', when: 'сб, 26 сентября · 18:30', where: 'Ташкент · IT Park', seats: 42, status: 'published', tag: 'LLM', d: { weekday: 'сб', day: '26', month: 'сент' } },
      { id: '6', title: 'RAG Reading Group · «The Faiss Library»', when: 'пн, 5 октября · 19:00', where: 'Онлайн · Zoom', seats: null, status: 'published', tag: 'RAG', d: { weekday: 'пн', day: '5', month: 'окт' } },
      { id: '7', title: 'Хакатон AI Qadam · RAG for Business', when: 'сб, 17 октября · 10:00', where: 'Ташкент · IT Park', seats: 60, status: 'published', tag: 'Hackathon', d: { weekday: 'сб', day: '17', month: 'окт' } },
    ],
    past: [
      { id: '3', title: 'AI Qadam #3 · Embeddings & Vector DB Day', when: 'сб, 5 сентября · 18:30', where: 'Ташкент · IT Park', attended: 178, status: 'finished', d: { weekday: 'сб', day: '5', month: 'сен' } },
      { id: '2', title: 'AI Qadam Almaty #1 · Computer Vision Day', when: 'сб, 22 августа · 18:30', where: 'Алматы · Astana Hub', attended: 134, status: 'finished', d: { weekday: 'сб', day: '22', month: 'авг' } },
    ],
  },

  // Организатор: свои ивенты (список #/manage).
  ownerEvents: [
    { id: '4', title: 'AI Qadam #4 · LLM Engineering in Production', when: 'сб, 26 сентября · 18:30', status: 'published', statusKey: 'status.published', author: true, registered: 48, checkedIn: 31 },
    { id: '5', title: 'Мастер-класс по LLM', when: 'вс, 4 октября · 14:00', status: 'draft', statusKey: 'status.draft', author: true, registered: 0, checkedIn: 0 },
    { id: '7', title: 'Хакатон AI Qadam · RAG for Business', when: 'сб, 17 октября · 10:00', status: 'published', statusKey: 'status.published', author: false, registered: 67, checkedIn: 0 },
  ],

  participants: [
    { name: 'Азиза Каримова', statusKey: 'myreg.status.checked_in', at: '18:42' },
    { name: 'Бекзод Рахимов', statusKey: 'myreg.status.registered', at: '' },
    { name: 'Гулноза Юсупова', statusKey: 'myreg.status.registered', at: '' },
    { name: 'Дилшод Азимов', statusKey: 'myreg.status.checked_in', at: '18:51' },
    { name: 'Елена Соколова', statusKey: 'myreg.status.cancelled', at: '' },
    { name: 'Жасур Турсунов', statusKey: 'myreg.status.registered', at: '' },
  ],

  controllers: [
    { id: '322876545', since: '25 сентября, 10:14' },
    { id: '9001234567', since: '25 сентября, 11:02' },
  ],

  counts: { registered: 48, checkedIn: 31, cancelled: 2, seatsLeft: 42, capacity: 120 },
  segments: { all_consent: 214, registered: 48, checked_in: 31, no_show: 17 },

  // Мои регистрации гостя (PAR-4).
  myRegs: [
    { title: 'AI Qadam #4 · LLM Engineering in Production', when: 'сб, 26 сентября · 18:30', statusKey: 'myreg.status.registered', canCancel: true },
    { title: 'AI Qadam #3 · Embeddings & Vector DB Day', when: 'сб, 5 сентября · 18:30', statusKey: 'myreg.status.checked_in', canCancel: false },
  ],

  // Контролёр: счётчик чекина.
  scan: { checkedIn: 31, registered: 48, alreadyAt: '18:42' },
};
