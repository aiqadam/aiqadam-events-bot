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

  // Ближайший ивент для каталога.
  next: {
    id: '6',
    title: 'RAG Reading Group · The Faiss Library',
    when: 'пн, 5 октября · 19:00',
  },

  catalog: {
    // seats не хранится: остаток считается по OWN-15 (PROTO.seatsLeft)
    // от лимита ceil(capacity × (1 + overbook/100)) минус зарегистрированные.
    upcoming: [
      // staff: зритель мока — staff этого ивента (кнопка чекина видна);
      // staff: false — обычный гость (кнопки нет). В продукте решает сервер.
      {
        id: '4', title: 'AI Qadam #4 · LLM Engineering in Production',
        when: 'сб, 26 сентября · 18:30', where: 'Ташкент · IT Park',
        capacity: 120, overbook: 40, registeredCount: 48,
        status: 'published', tag: 'LLM', registered: true, staff: true,
        d: { weekday: 'сб', day: '26', month: 'сент' },
      },
      {
        id: '6', title: 'RAG Reading Group · The Faiss Library',
        when: 'пн, 5 октября · 19:00', where: 'Онлайн · Zoom',
        capacity: null, overbook: null, registeredCount: 0,
        status: 'published', tag: 'RAG', registered: false, staff: false,
        d: { weekday: 'пн', day: '5', month: 'окт' },
      },
      {
        id: '7', title: 'Хакатон AI Qadam · RAG for Business',
        when: 'сб, 17 октября · 10:00', where: 'Ташкент · IT Park',
        capacity: 60, overbook: 40, registeredCount: 67,
        status: 'published', tag: 'Hackathon', registered: false, staff: false,
        d: { weekday: 'сб', day: '17', month: 'окт' },
      },
    ],
    past: [
      {
        id: '3', title: 'AI Qadam #3 · Embeddings & Vector DB Day',
        when: 'сб, 5 сентября · 18:30', where: 'Ташкент · IT Park', attended: 178,
        status: 'finished', attendedMe: true, feedbackGiven: false,
        d: { weekday: 'сб', day: '5', month: 'сен' },
      },
      {
        id: '2', title: 'AI Qadam Almaty #1 · Computer Vision Day',
        when: 'сб, 22 августа · 18:30', where: 'Алматы · Astana Hub', attended: 134,
        status: 'finished', attendedMe: false, feedbackGiven: false,
        d: { weekday: 'сб', day: '22', month: 'авг' },
      },
    ],
  },

  // Мои билеты (PAR-4) — первый таб каталога.
  myTickets: [
    {
      eventId: '4', title: 'AI Qadam #4 · LLM Engineering in Production',
      when: 'сб, 26 сентября · 18:30', where: 'Ташкент · IT Park',
      statusKey: 'myreg.status.registered', canCancel: true, upcoming: true,
      d: { weekday: 'сб', day: '26', month: 'сент' },
    },
    {
      eventId: '3', title: 'AI Qadam #3 · Embeddings & Vector DB Day',
      when: 'сб, 5 сентября · 18:30', where: 'Ташкент · IT Park',
      statusKey: 'myreg.status.checked_in', canCancel: false, upcoming: false,
      feedbackGiven: false, d: { weekday: 'сб', day: '5', month: 'сен' },
    },
  ],

  // Организатор: ивенты чаптера (список #/manage). Поля полные — форма
  // правки открывает любой ивент, а не только свой (W32: правит любой staff).
  ownerEvents: [
    {
      id: '4', title: 'AI Qadam #4 · LLM Engineering in Production',
      description: 'Четыре практика о том, как LLM-системы живут в продакшене: пайплайны оценки, версионирование промптов, дежурства и цена инференса.',
      address: 'Ташкент, IT Park, ул. Афросиаб, 1', lat: 41.311081, lon: 69.279737,
      startsLocal: '2026-09-26T18:30', endsLocal: '2026-09-26T22:00', deadlineLocal: '2026-09-23T23:59',
      capacity: '120', overbook: '40', ends: 'сб, 26 сентября · 22:00',
      when: 'сб, 26 сентября · 18:30', whenLong: 'суббота, 26 сентября · 18:30',
      broadcastText: 'Друзья, в пятницу встречаемся на AI Qadam #4. Вход свободный, регистрация обязательна.',
      deadline: 'ср, 23 сентября · 23:59',
      mapUrl: 'https://yandex.ru/maps/?pt=69.279737,41.311081&z=17&l=map',
      status: 'published', statusKey: 'status.published',
      author: true, registered: 48, checkedIn: 31, cancelled: 2,
      inviteLink: 'https://t.me/aiqadam_events_bot?start=e4',
    },
    {
      id: '5', title: 'Мастер-класс по LLM',
      description: 'Практический разбор: как собрать LLM-пайплайн от идеи до продакшена.',
      address: 'Ташкент, IT Park, ул. Афросиаб, 1', lat: 41.311081, lon: 69.279737,
      startsLocal: '2026-10-04T14:00', endsLocal: '2026-10-04T17:00', deadlineLocal: '2026-10-02T23:59',
      capacity: '40', overbook: '40', ends: 'вс, 4 октября · 17:00',
      when: 'вс, 4 октября · 14:00', whenLong: 'воскресенье, 4 октября · 14:00',
      broadcastText: 'В воскресенье — мастер-класс по LLM. Приходите, будет практика.',
      changes: [{ field: 'Начало', old: '14:00', now: '15:00' }],
      deadline: 'пт, 2 октября · 23:59',
      mapUrl: 'https://yandex.ru/maps/?pt=69.279737,41.311081&z=17&l=map',
      status: 'draft', statusKey: 'status.draft',
      author: true, registered: 0, checkedIn: 0, cancelled: 0,
      inviteLink: 'https://t.me/aiqadam_events_bot?start=e5',
    },
    {
      id: '7', title: 'Хакатон AI Qadam · RAG for Business',
      description: 'Командный хакатон: собрать RAG-решение для бизнес-задачи за один день.',
      address: 'Ташкент, IT Park, ул. Афросиаб, 1', lat: 41.311081, lon: 69.279737,
      startsLocal: '2026-10-17T10:00', endsLocal: '2026-10-17T19:00', deadlineLocal: '2026-10-15T23:59',
      capacity: '60', overbook: '40', ends: 'сб, 17 октября · 19:00',
      when: 'сб, 17 октября · 10:00', whenLong: 'суббота, 17 октября · 10:00',
      broadcastText: 'В субботу — хакатон RAG for Business. Собирайте команды!',
      changes: [{ field: 'Начало', old: '10:00', now: '10:30' }, { field: 'Адрес', old: 'IT Park, блок B', now: 'IT Park, ул. Афросиаб, 1' }],
      deadline: 'чт, 15 октября · 23:59',
      mapUrl: 'https://yandex.ru/maps/?pt=69.279737,41.311081&z=17&l=map',
      status: 'published', statusKey: 'status.published',
      author: false, registered: 67, checkedIn: 0, cancelled: 5,
      inviteLink: 'https://t.me/aiqadam_events_bot?start=e7',
    },
  ],

  // Данные по каждому ивенту: табы «Участники», «Рассылка», «Контролёры» и
  // сканер показывают ивент, который открыт, а не главный.
  eventData: {
    '4': {
      participants: [
        { name: 'Азиза Каримова', statusKey: 'myreg.status.checked_in', at: '18:42' },
        { name: 'Бекзод Рахимов', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Гулноза Юсупова', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Дилшод Азимов', statusKey: 'myreg.status.checked_in', at: '18:51' },
        { name: 'Елена Соколова', statusKey: 'myreg.status.cancelled', at: '' },
        { name: 'Жасур Турсунов', statusKey: 'myreg.status.registered', at: '' },
      ],
      controllers: [
        { id: '322876545', name: 'Азиза Каримова', username: '@aziza_k', since: '25 сентября, 10:14' },
        { id: '9001234567', name: 'Камила Юлдашева', username: '@kamila', since: '25 сентября, 11:02' },
      ],
      counts: { registered: 48, checkedIn: 31, cancelled: 2 },
      segments: { all_consent: 214, registered: 48, checked_in: 31, no_show: 17 },
      broadcast: { sent: 48, total: 48 },
      scan: { checkedIn: 31, registered: 48, alreadyAt: '18:42', nextCheckin: 'Дилшод Азимов' },
    },
    '5': {
      participants: [],
      controllers: [],
      counts: { registered: 0, checkedIn: 0, cancelled: 0 },
      segments: { all_consent: 12, registered: 0, checked_in: 0, no_show: 0 },
      broadcast: { sent: 0, total: 0 },
      scan: { checkedIn: 0, registered: 0, alreadyAt: '14:20', nextCheckin: null },
    },
    '7': {
      participants: [
        { name: 'Камила Юлдашева', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Максим Орлов', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Нигора Ахмедова', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Отабек Мирзаев', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Полина Ким', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Рустам Назаров', statusKey: 'myreg.status.registered', at: '' },
        { name: 'Тимур Сафаров', statusKey: 'myreg.status.cancelled', at: '' },
        { name: 'Азиза Каримова', statusKey: 'myreg.status.cancelled', at: '' },
      ],
      controllers: [
        { id: '9001234567', name: 'Камила Юлдашева', username: '@kamila', since: '16 октября, 09:40' },
      ],
      counts: { registered: 67, checkedIn: 0, cancelled: 5 },
      segments: { all_consent: 180, registered: 67, checked_in: 0, no_show: 0 },
      broadcast: { sent: 67, total: 67 },
      scan: { checkedIn: 0, registered: 67, alreadyAt: '10:15', nextCheckin: 'Камила Юлдашева' },
    },
  },

  // Люди, известные боту: участники ивента и уже добавленные контролёры.
  // Поиск в выборе контролёра идёт по имени и @username; права выдаются
  // по telegram_id (DAT-1) — username здесь только подпись для поиска.
  people: [
    { id: '322876545', name: 'Азиза Каримова', username: '@aziza_k', note: 'checked_in' },
    { id: '901234567', name: 'Бекзод Рахимов', username: '@bekzod', note: 'registered' },
    { id: '902345678', name: 'Гулноза Юсупова', username: '@gulnoza_y', note: 'registered' },
    { id: '903456789', name: 'Дилшод Азимов', username: '@dilshod', note: 'checked_in' },
    { id: '904567890', name: 'Елена Соколова', username: '@elena_s', note: 'cancelled' },
    { id: '905678901', name: 'Жасур Турсунов', username: '@jasur_t', note: 'registered' },
    { id: '9001234567', name: 'Камила Юлдашева', username: '@kamila', note: 'staff' },
    { id: '906789012', name: 'Максим Орлов', username: '@max_orlov', note: 'participant' },
    { id: '907890123', name: 'Нигора Ахмедова', username: '@nigora_a', note: 'participant' },
    { id: '908901234', name: 'Отабек Мирзаев', username: '@otabek', note: 'participant' },
    { id: '909012345', name: 'Полина Ким', username: '@polina_k', note: 'participant' },
    { id: '910123456', name: 'Рустам Назаров', username: '@rustam_n', note: 'participant' },
  ],

  // Недавние места — быстрый выбор в шаге «Где и когда».
  venues: [
    { name: 'IT Park, ул. Афросиаб, 1', lat: 41.311081, lon: 69.279737 },
    { name: 'Astana Hub, Мангилик Ел 55/8', lat: 51.090488, lon: 71.418153 },
  ],

  // Фидбек после ивента (принят ADR-0028, тексты — из ru.json).
  feedback: { eventId: '3', eventTitle: 'AI Qadam #3 · Embeddings & Vector DB Day' },
};
