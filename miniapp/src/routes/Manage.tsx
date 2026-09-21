import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram, hapticImpact, hapticNotification, setClosingConfirmation } from '../lib/telegram';
import { useBackButton } from '../lib/useBackButton';
import { setupThemeListener } from '../lib/theme';
import { postJson, MANAGE_API, STAFF_EVENTS_API, STAFF_INVITE_API } from '../lib/api';
import { utcToLocalInput, utcToPlate, utcToTime, utcMs } from '../lib/dates';

const FIELDS = ['title', 'description', 'address', 'lat', 'lon', 'starts_at', 'ends_at', 'reg_deadline_at', 'capacity', 'overbook_pct'] as const;

// Черновик нового события переживает уход со страницы (W42): localStorage,
// ключ один — второй формы создания на устройстве быть не может.
const DRAFT_KEY = 'manage.new.draft';

// Шаги визарда: один смысл на шаг (W42, OWN-1…OWN-5).
const STEP_KEYS = ['manage.step.main', 'manage.step.where', 'manage.step.capacity', 'manage.step.review'];
const LAST_STEP = STEP_KEYS.length - 1;

// Куда прыгать при ошибке сервера: имя поля → шаг (W42).
const STEP_OF_FIELD: Record<string, number> = {
  title: 0,
  description: 0,
  address: 1,
  starts_at: 1,
  ends_at: 1,
  reg_deadline_at: 1,
  geo: 1,
  lat: 1,
  lon: 1,
  capacity: 2,
  overbook_pct: 2,
};

const EMPTY_FIELDS: Record<string, string> = {
  title: '',
  description: '',
  address: '',
  lat: '',
  lon: '',
  starts_at: '',
  ends_at: '',
  reg_deadline_at: '',
  capacity: '',
  overbook_pct: '',
};

type EventData = Record<string, unknown>;
type StaffItem = { telegram_id: string; item: string; name: string; username: string; sub: string };
type StaffCandidate = { telegram_id: string; name: string; username: string };
// W13: строка участника от manage-api (action participants): status — ключ
// ('registered'|'cancelled'), checked_in_at — «DD.MM.YYYY HH:mm» Tashkent или ''.
type PartRow = { telegram_id: string; name: string; status: string; checked_in_at: string };
type PartsFilter = 'all' | 'checked_in' | 'no_show' | 'cancelled';
// W45 (Q53): строка отзыва от manage-api (action feedback_list) — оценка 1-5,
// комментарий может быть пустым, submitted_at — «DD.MM.YYYY HH:mm» Tashkent.
type FeedbackRow = { telegram_id: string; name: string; rating: number; comment: string; submitted_at: string };
type ListItem = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
  isAuthor: boolean;
  address?: string;
  lat?: string;
  lon?: string;
};
type StepError = { step: number; field: string; text: string };

function genNewId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 12);
}

// --- гео: ссылка Яндекс.Карт → координаты (Q52: карты в продукте нет) --------
// Разбираем те же формы, что и прототип: pt/ll (lon,lat), @lat,lon, q=lat,lon,
// плюс голая пара «широта, долгота» — человек часто копирует её текстом.
function parseYandexLink(raw: string): { lat: number; lon: number } | null {
  const s = String(raw || '').trim();
  let m = /(?:pt|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
  m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  m = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s);
  if (m) return { lat: parseFloat(m[1]), lon: parseFloat(m[2]) };
  m = /^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/.exec(s);
  if (m) return { lat: parseFloat(m[1].replace(',', '.')), lon: parseFloat(m[2].replace(',', '.')) };
  return null;
}

function coordsInRange(lat: number, lon: number): boolean {
  return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

// Орг-ссылка (её даёт «Поделиться»): https://yandex.com/maps/org/<slug>/<oid>…
// Орг-ссылка координат не несёт — её разбирает только сервер через
// Геокодер (Q55); resolveOrgLink ниже.
const YANDEX_MAPS_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,6}\/maps\//i;

// Эквивалентная ссылка на точку — ею предзаполняем поле правки, когда ссылка
// неизвестна, а координаты есть (вердикт W49: проверяется сама ссылка).
function equivLink(lat: string, lon: string): string {
  return 'https://yandex.ru/maps/?pt=' + lon + ',' + lat + '&z=17';
}

// --- предпросмотр карточки: локальное «YYYY-MM-DDTHH:mm» — ташкентское ------
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_NOM = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function localParts(s: string): { y: number; mo: number; d: number; h: string; mi: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: m[4], mi: m[5] };
}

function plateFromLocal(s: string): { month: string; day: string; weekday: string } | null {
  const p = localParts(s);
  if (!p) return null;
  const wd = new Date(Date.UTC(p.y, p.mo, p.d)).getUTCDay();
  return { month: MONTHS_NOM[p.mo], day: String(p.d), weekday: WEEKDAYS[wd] };
}

// W53: конец события из локальной («ташкентской», UTC+5 без DST) строки формы.
function tashMs(local: string): number {
  const p = localParts(local);
  if (!p) return NaN;
  return Date.UTC(p.y, p.mo, p.d, +p.h, +p.mi) - 5 * 3600 * 1000;
}

// «сб, 26 сентября · 22:00» — форма меты каталога, но из локальной строки.
function endsWhen(local: string): string {
  const p = plateFromLocal(local);
  const lp = localParts(local);
  if (!p || !lp) return '';
  return `${p.weekday}, ${p.day} ${p.month} · ${lp.h}:${lp.mi}`;
}

function humanLocal(s: string): string {
  const p = localParts(s);
  if (!p) return String(s || '');
  const wd = new Date(Date.UTC(p.y, p.mo, p.d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${p.d} ${MONTHS_GEN[p.mo]} · ${p.h}:${p.mi}`;
}

// --- клиентская валидация визарда -------------------------------------------
// strict=false — формат и согласованность (для «Далее»): пустое поле не ругаем,
// черновик можно вести по шагам недозаполненным.
// strict=true — то же плюс обязательные поля (для «Опубликовать»).
// Серверная валидация manage-api остаётся источником правды: это только UX.
function clientErrors(
  f: Record<string, string>,
  strict: boolean,
  geo?: { online: boolean; mapLink: string },
): StepError[] {
  const out: StepError[] = [];
  const add = (step: number, field: string, key: string, vars?: Record<string, string | number>) => {
    out.push({ step, field, text: t(key, vars) });
  };
  const title = (f['title'] || '').trim();
  if (strict && !title) add(0, 'title', 'manage.err.required');
  else if (title && (title.length < 2 || title.length > 200)) add(0, 'title', 'manage.err.title_length');
  if ((f['description'] || '').length > 4000) add(0, 'description', 'manage.err.description_length');

  // Адрес обязателен только офлайну (онлайн — только даты, решение
  // владельца 2026-09-20): формат приходит в geo, без него — старое правило.
  const address = (f['address'] || '').trim();
  if (address && (address.length < 2 || address.length > 300)) add(1, 'address', 'manage.err.address_length');
  else if (strict && !address && (!geo || !geo.online)) add(1, 'address', 'manage.err.required');
  (['starts_at', 'ends_at', 'reg_deadline_at'] as const).forEach((k) => {
    if (strict && !f[k]) add(1, k, 'manage.err.datetime');
  });
  if (f['starts_at'] && f['ends_at'] && f['ends_at'] <= f['starts_at']) add(1, 'ends_at', 'manage.err.ends_before_starts');
  if (f['starts_at'] && f['reg_deadline_at'] && f['reg_deadline_at'] > f['starts_at']) add(1, 'reg_deadline_at', 'manage.err.deadline_after_starts');

  const lat = (f['lat'] || '').trim();
  const lon = (f['lon'] || '').trim();
  if ((lat === '') !== (lon === '')) add(1, 'geo', 'manage.err.geo_pair');
  else if (lat !== '' && !coordsInRange(Number(lat.replace(',', '.')), Number(lon.replace(',', '.')))) {
    add(1, 'geo', 'manage.err.geo_range');
  }
  // Вердикт W49 (W50): офлайн без разбираемой ссылки не публикуется —
  // проверяется сама ссылка, не координаты.
  if (strict && geo && !geo.online && !parseYandexLink(geo.mapLink.trim())) {
    add(1, 'geo', 'manage.geo.link_bad');
  }

  if ((f['capacity'] || '') !== '') {
    const n = Number(f['capacity']);
    if (!/^\d+$/.test(f['capacity']) || n < 1 || n > 1000000) add(2, 'capacity', 'manage.err.capacity');
  }
  if ((f['overbook_pct'] || '') !== '') {
    const n = Number(f['overbook_pct']);
    if (!/^\d+$/.test(f['overbook_pct']) || n < 0 || n > 100) add(2, 'overbook_pct', 'manage.err.overbook');
  }
  return out;
}

function isForbiddenRes(res: { kind: string; data?: Record<string, unknown> }): boolean {
  return res.kind === 'json' && String((res.data as Record<string, unknown> | undefined)?.['error'] || '') === 'forbidden';
}

function capacityLimit(capacity: string, overbook: string): number | null {
  const cap = parseInt(capacity, 10);
  if (!cap || cap <= 0) return null;
  const over = overbook === '' ? 40 : parseInt(overbook, 10);
  return Math.ceil(cap * (1 + (isNaN(over) ? 0 : over) / 100));
}

function limitText(capacity: string, overbook: string): string {
  const limit = capacityLimit(capacity, overbook);
  return limit === null ? t('event.card.seats_unlimited') : t('manage.capacity.limit', { limit });
}

// W44: инициалы для аватара кандидата — кружок с буквами, как в прототипе.
// Фото из Bot API не тянем; цвета — только семантические токены бренда.
function candidateInitials(name: string, username: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return username.replace(/^@/, '').slice(0, 2).toUpperCase();
}

export default function Manage({ eventId: propEventId }: { eventId: string }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const [eventId, setEventId] = useState(propEventId);
  const newIdRef = useRef(genNewId());
  const [origStatus, setOrigStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [dictLoaded, setDictLoaded] = useState(false);
  const [titleText, setTitleText] = useState('Новое событие');
  const [statusText, setStatusText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showLoadfail, setShowLoadfail] = useState(false);
  const [loadfailText, setLoadfailText] = useState('');
  const [loadfailRetryable, setLoadfailRetryable] = useState(true);

  // Результат сохранения и ошибки — тостом (паттерн эталона), не строкой в баре.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  // W42: визард — шаг, ошибки шагов (клиентские и серверные), экран успеха.
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<StepError[]>([]);
  const [done, setDone] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [cancelSheet, setCancelSheet] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // Снимок полей на момент загрузки/сохранения — чтобы «К списку» не терял
  // несохранённые правки молча (дизайн-ревью W42). Состояние, а не ref: после
  // сохранения снимок меняется, и подтверждение закрытия (W47) снимается тем
  // же рендером, а не ожиданием ухода со страницы.
  const [loaded, setLoaded] = useState<Record<string, string> | null>(null);
  // Счётчик запросов resolve_geo: поздний ответ при закрытом шите не применяем
  // (дизайн-ревью, круг 6).
  const geoReqRef = useRef(0);

  // form fields
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY_FIELDS });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // гео (вердикт W49): формат Онлайн/Офлайн + голое поле ссылки с живым
  // разбором. Отдельного хранилища нет: онлайн ⟺ пустые lat/lon.
  const [online, setOnline] = useState(false);
  const [mapLink, setMapLink] = useState('');

  // W36: секция «Контролёры» — только у существующего события (нужен eventId).
  const [staffItems, setStaffItems] = useState<StaffItem[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffFieldError, setStaffFieldError] = useState('');
  const [staffResult, setStaffResult] = useState('');

  // W13: секция «Участники» (OWN-7, OWN-8) — только у существующего события.
  // Срезы (все/пришли/не пришли/отмены) режет страница из одного ответа, как
  // эталон; файлы csv/json собирает сервер — страница их только скачивает.
  const [parts, setParts] = useState<{ counters: { registered: number; checked_in: number; cancelled: number }; rows: PartRow[]; csv: string; json: string } | null>(null);
  const [partsError, setPartsError] = useState('');
  const [partsFilter, setPartsFilter] = useState<PartsFilter>('all');

  // W45 (Q53): секция «Отзывы» — только у существующего события, читает
  // feedback-api через manage-api (action feedback_list), та же граница прав,
  // что у участников.
  const [feedback, setFeedback] = useState<{ average: number; count: number; rows: FeedbackRow[] } | null>(null);
  const [feedbackError, setFeedbackError] = useState('');

  // W55 (вердикт владельца 2026-09-19, отмена Q51-фолбэка): ввод контролёра —
  // логин Telegram инлайн в секции, без шита. Источник совпадений — участники
  // события + staff чаптера (Q51); резолв логин→ID — точным совпадением
  // username среди кандидатов, запись — тем же staff_add по telegram_id (DAT-1).
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  // W10 (OWN-14): одноразовая ссылка-инвайт вместо логина (альтернатива,
  // вердикт владельца 2026-09-21). Создаётся здесь, в Mini App.
  const [staffInviteUrl, setStaffInviteUrl] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  // W37: список событий чаптера (#/manage без :id) и ссылка регистрации,
  // которая живёт на экране (сервер отдаёт её в `load` и `save`).
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  // W50: события, где вызывающий — действующий контролёр (гейт кнопок сканера).
  const [staffIds, setStaffIds] = useState<Record<string, boolean>>({});
  const [retryTarget, setRetryTarget] = useState<'list' | 'form'>('form');

  // W53: табы правки (прототип tabs()) — только при открытом событии;
  // создание идёт визардом без табов. Порядок — как в эталоне.
  type ManageTab = 'event' | 'participants' | 'broadcast' | 'staff';
  const [manageTab, setManageTab] = useState<ManageTab>('event');
  const [inviteLink, setInviteLink] = useState<{ eventId: string; url: string } | null>(null);

  const showToast = useCallback((text: string, sticky = false) => {
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
    setToast(text);
    if (!sticky) {
      toastTimer.current = window.setTimeout(() => setToast(null), 2500);
    }
  }, []);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  // keep prop sync (when hash changes)
  useEffect(() => setEventId(propEventId), [propEventId]);

  const applyStatus = useCallback((st: string) => {
    setOrigStatus(st);
  }, []);

  const setField = useCallback((name: string, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }));
    setErrs((prev) => prev.filter((e) => e.field !== name));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setGeo = useCallback((lat: number, lon: number) => {
    setFields((prev) => ({
      ...prev,
      lat: String(Math.round(lat * 1e6) / 1e6),
      lon: String(Math.round(lon * 1e6) / 1e6),
    }));
    setErrs((prev) => prev.filter((e) => e.field !== 'geo' && e.field !== 'lat' && e.field !== 'lon'));
  }, []);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setErrs([]);
  }, []);

  const showFieldErrors = useCallback((errFields: Record<string, unknown>) => {
    const mapped: Record<string, string> = {};
    Object.keys(errFields || {}).forEach((name) => {
      mapped[name] = t(String(errFields[name]));
    });
    setFieldErrors(mapped);
  }, []);

  const fieldError = useCallback(
    (field: string): string => {
      const e = errs.find((x) => x.field === field && x.step === step);
      if (e) return e.text;
      return fieldErrors[field] || '';
    },
    [errs, step, fieldErrors],
  );

  const fillForm = useCallback(
    (ev: EventData) => {
      const next: Record<string, string> = {};
      ['title', 'description', 'address', 'lat', 'lon', 'capacity', 'overbook_pct'].forEach((n) => {
        const v = ev[n];
        next[n] = v === undefined || v === null ? '' : String(v);
      });
      ['starts_at', 'ends_at', 'reg_deadline_at'].forEach((n) => {
        next[n] = utcToLocalInput(String(ev[n] || ''));
      });
      setFields(next);
      setLoaded(next);
      applyStatus(String(ev['status'] || 'draft'));
      // Вердикт W49: формат выводится из координат (онлайн ⟺ точки нет);
      // правка с координатами предзаполняет ссылку эквивалентной.
      const hasCoords = String(next['lat'] || '').trim() !== '' && String(next['lon'] || '').trim() !== '';
      setOnline(!hasCoords);
      setMapLink(hasCoords ? equivLink(next['lon'], next['lat']) : '');
    },
    [applyStatus],
  );

  const collect = useCallback(
    (status: string) => {
      const out: Record<string, string> = {};
      FIELDS.forEach((n) => {
        out[n] = String(fields[n] || '').trim();
      });
      out['status'] = status;
      return out;
    },
    [fields],
  );

  const errorTextFor = useCallback((res: { kind: string; http?: number; data?: Record<string, unknown> }) => {
    if (res.kind === 'network') return t('manage.err.network');
    if (res.kind === 'server') return t('manage.err.server');
    // 401 — initData протух (окно 300 c, Q49): сервер отвечает общим текстом,
    // но пользователю нужно действие, а не диагноз — форма живёт только
    // в памяти React и переоткрывается из чата.
    if (res.http === 401) return t('manage.err.stale');
    const d = res.data as Record<string, unknown>;
    if (typeof d['text'] === 'string' && d['text']) return String(d['text']);
    return t('manage.err.server');
  }, []);

  const showLoadFail = useCallback((text: string, retryable = true) => {
    hapticNotification('error');
    setShowForm(false);
    setLoadfailText(text);
    setLoadfailRetryable(retryable);
    setShowLoadfail(true);
    setStatusText('');
  }, []);

  const load = useCallback(
    async (id?: string) => {
      const target = id === undefined ? eventId : id;
      setShowLoadfail(false);
      setRetryTarget('form');
      setStatusText(t('manage.loading'));
      const res = await postJson(MANAGE_API, { initData, action: 'load', eventId: target });
      if (res.kind !== 'json' || !res.data['ok'] || !res.data['event']) {
        showLoadFail(errorTextFor(res as never), !isForbiddenRes(res));
        return;
      }
      fillForm(res.data['event'] as EventData);
      const inv = typeof res.data['inviteLink'] === 'string' ? String(res.data['inviteLink']) : '';
      setInviteLink(inv ? { eventId: target, url: inv } : null);
      setStatusText('');
      setStep(0);
      setErrs([]);
      // Серверные ошибки полей не переезжают на другое событие (ревью W42,
      // круг 4): карта ключей не привязана к шагу, «starts_past» с события A
      // горел бы под валидной датой события B, пока поле не тронут.
      setFieldErrors({});
      setDone(false);
      setDraftRestored(false);
      setShowForm(true);
    },
    [eventId, initData, errorTextFor, fillForm, showLoadFail],
  );

  // W37: список событий своего чаптера — вход в правку без команд (ADR-0025).
  const loadList = useCallback(async () => {
    setShowLoadfail(false);
    setShowForm(false);
    setRetryTarget('list');
    setStatusText(t('manage.loading'));
    const res = await postJson(MANAGE_API, { initData, action: 'list' });
    if (res.kind !== 'json' || !res.data['ok'] || !Array.isArray(res.data['events'])) {
      showLoadFail(errorTextFor(res as never), !isForbiddenRes(res));
      return;
    }
    setListItems(res.data['events'] as ListItem[]);
    setListLoaded(true);
    setStatusText('');
    // W50 (вердикт W49): сканер — в строках списка, видно только контролёру.
    // Создание автора контролёром не делает (staff — только явной выдачей),
    // поэтому гейт — тем же staff-events-api, что в каталоге. Тихо нет —
    // значит нет.
    try {
      const se = await postJson(STAFF_EVENTS_API, { initData });
      if (se.kind === 'json' && se.data['ok'] && Array.isArray(se.data['eventIds'])) {
        const set: Record<string, boolean> = {};
        (se.data['eventIds'] as unknown[]).forEach((id) => {
          if (typeof id === 'string' && id) set[id] = true;
        });
        setStaffIds(set);
      }
    } catch {}
  }, [initData, errorTextFor, showLoadFail]);

  const resetFormState = useCallback(() => {
    setStep(0);
    setErrs([]);
    setFieldErrors({});
    setDone(false);
    setDraftRestored(false);
    setCancelSheet(false);
    setConfirmExit(false);
    geoReqRef.current += 1; // ответ resolve_geo в полёте уже не применяется
    setOnline(false);
    setMapLink('');
  }, []);

  const leaveForm = useCallback(() => {
    resetFormState();
    // Если форма открыта из списка, hash ведёт на событие — возвращаем его
    // на #/manage (App пересоберёт роут); после создания hash не менялся.
    if (window.location.hash && window.location.hash !== '#/manage') {
      window.location.hash = '#/manage';
      return;
    }
    setEventId('');
    setShowForm(false);
    setInviteLink(null);
    void loadList();
  }, [loadList, resetFormState]);

  const isDirty = useCallback(() => {
    if (!eventId) return false;
    const base = loaded;
    if (!base) return false;
    return FIELDS.some((n) => String(fields[n] || '').trim() !== String(base[n] || '').trim());
  }, [eventId, fields, loaded]);

  // «К списку» не теряет несохранённые правки молча: спрашиваем (дизайн-ревью).
  // У создания правки не теряются — черновик лежит в localStorage, поэтому
  // подтверждение выхода нужно только у существующего события (эталон не
  // спрашивает вовсе; это исправление дефекта, см. журнал W42).
  const backToList = useCallback(() => {
    if (!done && eventId && isDirty()) {
      setConfirmExit(true);
      // W53: диалог подтверждения живёт в табе «Событие» — уводим туда же,
      // иначе с других табов выход виснет без отзыва (ревью W53).
      setManageTab('event');
      return;
    }
    leaveForm();
  }, [done, eventId, isDirty, leaveForm]);

  // W47: нативная «Назад» — экран события ведёт к списку, открытый шит
  // (отмена события / подтверждение выхода) закрывает, корневые экраны
  // (список, создание из чата) её скрывают.
  const goBack = useCallback(() => {
    if (cancelSheet) {
      setCancelSheet(false);
      return;
    }
    if (confirmExit) {
      setConfirmExit(false);
      return;
    }
    backToList();
  }, [cancelSheet, confirmExit, backToList]);
  useBackButton(cancelSheet || confirmExit || (showForm && !!eventId), goBack);

  // W42: создание — визард с черновиком в localStorage (уход со страницы его
  // не теряет); после сохранения на сервере черновик больше не нужен.
  const startNew = useCallback(() => {
    // Ключ идемпотентности — один на открытие формы (ADR-0003): повторное
    // «Сохранить» апсертит ту же запись. Новое открытие формы — новый ключ,
    // иначе второе создание перезаписало бы первое событие (ревью W42, блокер).
    newIdRef.current = genNewId();
    let next = { ...EMPTY_FIELDS };
    let nextStep = 0;
    let restored = false;
    // Вердикт W49: новое — офлайн с пустой ссылкой.
    let nextOnline = false;
    let nextLink = '';
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { fields?: Record<string, string>; step?: number; online?: boolean; mapLink?: string };
        if (d && d.fields && typeof d.fields === 'object') {
          next = { ...EMPTY_FIELDS, ...d.fields };
          nextStep = Math.min(LAST_STEP, Math.max(0, Number(d.step) || 0));
          restored = true;
          // Черновик нового формата хранит и гео-состояние; старый (только
          // поля) — выводится из координат, как правка существующего.
          if (typeof d.online === 'boolean') {
            nextOnline = d.online;
            nextLink = typeof d.mapLink === 'string' ? d.mapLink : '';
          } else {
            const hasCoords =
              String(next['lat'] || '').trim() !== '' && String(next['lon'] || '').trim() !== '';
            nextLink = hasCoords ? equivLink(next['lon'], next['lat']) : '';
          }
        }
      }
    } catch {}
    setFields(next);
    setLoaded(next);
    setOnline(nextOnline);
    setMapLink(nextLink);
    setStep(nextStep);
    setErrs([]);
    setFieldErrors({});
    setDone(false);
    setCancelSheet(false);
    setDraftRestored(restored);
    setShowForm(true);
    setToast(null);
    setTitleText(t('manage.title.new'));
    applyStatus('');
  }, [applyStatus]);

  const submit = useCallback(
    async (status: string) => {
      if (busy) return;
      setCancelSheet(false);
      clearErrors();
      const collecting = collect(status);
      setBusy(true);
      showToast(t('manage.saving'), true);
      const res = await postJson(MANAGE_API, {
        initData,
        action: 'save',
        eventId,
        newId: eventId ? '' : newIdRef.current,
        fields: collecting,
      });
      setBusy(false);
      if (res.kind !== 'json') {
        hapticNotification('error');
        showToast(errorTextFor(res as never));
        return;
      }
      const d = res.data as Record<string, unknown>;
      if (d['ok']) {
        hapticNotification('success');
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        setLoaded(collecting);
        if (d['eventId']) setEventId(String(d['eventId']));
        applyStatus(status);
        // После публикации экран успеха живёт как «Новое событие» (прототип);
        // после черновика/правки форма — уже правка существующего события.
        setTitleText(t(status === 'published' && origStatus !== 'published' ? 'manage.title.new' : 'manage.title.edit'));
        const inv = typeof d['inviteLink'] === 'string' ? String(d['inviteLink']) : '';
        setInviteLink(inv ? { eventId: String(d['eventId'] || eventId), url: inv } : null);
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.saved.updated');
        if (status === 'published' && origStatus !== 'published') {
          // Публикация заканчивается экраном успеха со ссылкой, а не прыжком
          // в чат (W42; чат-факт приходит карточкой — W37).
          setToast(null);
          setDone(true);
        } else if (status === 'cancelled') {
          // Отмена — факт в чат, экран возвращается к списку (эталон уходил
          // в чат; у нас экран несёт состояние, ADR-0017).
          showToast(txt);
          leaveForm();
        } else {
          showToast(txt);
        }
        return;
      }
      if (d['error'] === 'validation') {
        hapticNotification('error');
        const errFields = (d['fields'] as Record<string, unknown>) || {};
        showFieldErrors(errFields);
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.err.validation');
        showToast(txt);
        // Прыгаем на первый шаг с ошибкой, чтобы человек её увидел (W42).
        const first = Object.keys(errFields).find((k) => STEP_OF_FIELD[k] !== undefined);
        if (first !== undefined) setStep(STEP_OF_FIELD[first]);
        return;
      }
      hapticNotification('error');
      showToast(errorTextFor(res as never));
    },
    [busy, clearErrors, collect, eventId, initData, origStatus, applyStatus, errorTextFor, showFieldErrors, showToast, leaveForm],
  );

  // Шаг проверяется на «Далее» — как в эталоне (дизайн-ревью W42): пустые
  // обязательные поля не пропускаем, точки шагов с ошибками помечаются.
  const nextStep = useCallback(() => {
    const e = clientErrors(fields, true, { online, mapLink }).filter((x) => x.step === step);
    if (e.length) {
      setErrs(e);
      return;
    }
    setErrs([]);
    setStep((s) => Math.min(LAST_STEP, s + 1));
  }, [fields, step, online, mapLink]);

  const prevStep = useCallback(() => {
    setErrs([]);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const publish = useCallback(() => {
    const e = clientErrors(fields, true, { online, mapLink });
    if (e.length) {
      setErrs(e);
      setStep(e[0].step);
      return;
    }
    void submit('published');
  }, [fields, online, mapLink, submit]);

  // W50 (вердикт W49, перенос из prototypes/app.js): ссылка — голое поле
  // с живым разбором на вводе. Успех — тишина, битая ссылка — ошибка,
  // пустое — подсказка. Орг-ссылка координат не несёт — уходит на сервер
  // (Геокодер возвращает точку и адрес, Q55); после успеха поле хранит
  // эквивалентную ссылку, чтобы правило «проверяется сама ссылка» сходилось.
  const onLinkChange = useCallback(
    (v: string) => {
      setMapLink(v);
      const parsed = parseYandexLink(v.trim());
      if (parsed && coordsInRange(parsed.lat, parsed.lon)) {
        setGeo(parsed.lat, parsed.lon);
      } else {
        // Как в эталоне: битая ссылка сносит координаты, а не оставляет
        // прежнюю точку под чужим текстом.
        setFields((prev) => ({ ...prev, lat: '', lon: '' }));
        setErrs((prev) => prev.filter((e) => e.field !== 'geo' && e.field !== 'lat' && e.field !== 'lon'));
      }
    },
    [setGeo],
  );

  const resolveOrgLink = useCallback(
    async (raw: string) => {
      const reqId = ++geoReqRef.current;
      const res = await postJson(MANAGE_API, { initData, action: 'resolve_geo', link: raw });
      if (geoReqRef.current !== reqId) return;
      if (res.kind === 'json' && res.data['ok']) {
        const la = Number(res.data['lat']);
        const lo = Number(res.data['lon']);
        if (coordsInRange(la, lo)) {
          setGeo(la, lo);
          setMapLink(equivLink(String(lo), String(la)));
          // Адрес подставляем, только если поле пустое: введённое вручную не трогаем.
          const addr = typeof res.data['address'] === 'string' ? res.data['address'].trim() : '';
          if (addr) setFields((prev) => (String(prev['address'] || '').trim() ? prev : { ...prev, address: addr }));
          return;
        }
      }
      // Не разобралось даже сервером — поле хранит ввод, статус покажет ошибку.
    },
    [initData, setGeo],
  );

  const onLinkPaste = useCallback(() => {
    // Вставка: клиентский разбор — в onChange; здесь — добор сервером.
    // Набор руками фокус не теряет: живого ререндера по буквам нет.
    setTimeout(() => {
      const el = document.getElementById('f-geolink') as HTMLInputElement | null;
      const raw = (el ? el.value : mapLink).trim();
      if (!raw) return;
      setMapLink(raw);
      if (parseYandexLink(raw)) return; // координаты уже встали в onChange
      if (YANDEX_MAPS_RE.test(raw)) void resolveOrgLink(raw); // орг-ссылка — только сервер
    }, 0);
  }, [mapLink, resolveOrgLink]);

  const setFormat = useCallback(
    (nextOnline: boolean) => {
      setOnline(nextOnline);
      if (nextOnline) {
        // Онлайн — только даты (решение владельца 2026-09-20): точку сносим,
        // поле ссылки и адрес чистим, их ошибки снимаем.
        setFields((prev) => ({ ...prev, address: '', lat: '', lon: '' }));
        setMapLink('');
        setErrs((prev) => prev.filter((e) => e.field !== 'geo' && e.field !== 'lat' && e.field !== 'lon' && e.field !== 'address'));
      }
    },
    [],
  );

  // Копирование ссылки — тост «Скопировано» (эталон); если буфер недоступен,
  // показываем саму ссылку, чтобы её можно было скопировать руками.
  const copyInviteLink = useCallback(
    (url: string) => {
      hapticImpact('light');
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        showToast(url);
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () => showToast(t('manage.btn.copied')),
        () => showToast(url),
      );
    },
    [showToast],
  );

  // W36: список контролёров события. Ответ staff_* всегда несёт `staff`
  // (готовые строки для показа) — им и обновляем состояние, без перезапроса.
  const loadStaff = useCallback(async () => {
    const res = await postJson(MANAGE_API, { initData, action: 'staff_list', eventId });
    if (res.kind === 'json' && res.data['ok'] && Array.isArray(res.data['staff'])) {
      setStaffItems(res.data['staff'] as StaffItem[]);
    }
  }, [eventId, initData]);

  // W55: добавление — только по telegram_id кандидата (DAT-1). Логин
  // резолвится в addByLogin точным совпадением username; цифры ID больше
  // не принимаем (вердикт владельца 2026-09-19).
  const addStaff = useCallback(async (telegramId: string) => {
    const target = telegramId.trim();
    if (staffBusy || target === '') return;
    setStaffFieldError('');
    setStaffResult('');
    setStaffBusy(true);
    const res = await postJson(MANAGE_API, { initData, action: 'staff_add', eventId, staffTelegramId: target });
    setStaffBusy(false);
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok']) {
        if (Array.isArray(d['staff'])) setStaffItems(d['staff'] as StaffItem[]);
        setSearchQuery('');
        setCandidates([]);
        setStaffResult(typeof d['text'] === 'string' ? String(d['text']) : '');
        return;
      }
      if (d['error'] === 'validation') {
        const errs2 = (d['fields'] as Record<string, unknown>) || {};
        const key = errs2['telegram_id'] ? String(errs2['telegram_id']) : 'manage.err.bad_telegram_id';
        setStaffFieldError(t(key));
        return;
      }
    }
    setStaffResult(errorTextFor(res as never));
  }, [eventId, initData, staffBusy, errorTextFor]);

  const normLogin = (s: string): string => s.trim().replace(/^@+/, '').toLowerCase();

  // W55: кнопка «Добавить» при вводе: точный логин среди кандидатов (уже
  // загруженных или свежим запросом) → addStaff; иначе — login_not_found.
  const addByLogin = useCallback(async () => {
    const login = normLogin(searchQuery);
    if (staffBusy || searchBusy || login === '') return;
    const matchIn = (list: StaffCandidate[]): StaffCandidate | undefined =>
      list.find((c) => c.username.replace(/^@/, '').toLowerCase() === login);
    const loaded = matchIn(candidates);
    if (loaded) {
      void addStaff(loaded.telegram_id);
      return;
    }
    setSearchBusy(true);
    const res = await postJson(MANAGE_API, { initData, action: 'staff_search', eventId, query: searchQuery.trim() });
    setSearchBusy(false);
    let list: StaffCandidate[] = [];
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok'] && Array.isArray(d['candidates'])) {
        list = d['candidates'] as StaffCandidate[];
        setCandidates(list);
      }
    }
    const hit = matchIn(list);
    if (hit) {
      void addStaff(hit.telegram_id);
      return;
    }
    setStaffFieldError(t('manage.staff.login_not_found'));
  }, [searchQuery, candidates, eventId, initData, staffBusy, searchBusy, addStaff]);

  // W55: живой инлайн-поиск с дебаунсом — отдельный запрос на каждое
  // нажатие не шлём. Запрос короче 2 символов не отправляем вовсе —
  // базу без запроса не светим (решение W44, сохранено).
  const searchStaff = useCallback(async (q: string) => {
    const query = q.trim();
    if (query.length < 2 || staffBusy || searchBusy) {
      if (query.length < 2) setCandidates([]);
      return;
    }
    setSearchBusy(true);
    const res = await postJson(MANAGE_API, { initData, action: 'staff_search', eventId, query });
    setSearchBusy(false);
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok'] && Array.isArray(d['candidates'])) {
        setCandidates(d['candidates'] as StaffCandidate[]);
        return;
      }
    }
    setCandidates([]);
  }, [eventId, initData, staffBusy, searchBusy]);

  // W55: живой инлайн-поиск с дебаунсом — запрос уходит из секции, без шита.
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => void searchStaff(searchQuery), 400);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchStaff]);

  const revokeStaff = useCallback(
    async (id: string) => {
      if (staffBusy) return;
      setStaffFieldError('');
      setStaffResult('');
      setStaffBusy(true);
      const res = await postJson(MANAGE_API, { initData, action: 'staff_remove', eventId, staffTelegramId: id });
      setStaffBusy(false);
      if (res.kind === 'json') {
        const d = res.data as Record<string, unknown>;
        if (d['ok']) {
          if (Array.isArray(d['staff'])) setStaffItems(d['staff'] as StaffItem[]);
          setStaffResult(typeof d['text'] === 'string' ? String(d['text']) : '');
          return;
        }
      }
      setStaffResult(errorTextFor(res as never));
    },
    [eventId, initData, staffBusy, errorTextFor],
  );

  // W10 (OWN-14): создать одноразовую ссылку-инвайт на это событие.
  // Сервер (staff-invite) проверяет initData и права staff+чаптер, кладёт
  // sha256 токена в staff_invites и отдаёт ссылку ?start=s<eventId>-<token>.
  const createStaffInvite = useCallback(async () => {
    if (inviteBusy || eventId === '') return;
    setStaffFieldError('');
    setInviteBusy(true);
    const res = await postJson(STAFF_INVITE_API, { initData, eventId });
    setInviteBusy(false);
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok'] && typeof d['inviteLink'] === 'string' && String(d['inviteLink']) !== '') {
        setStaffInviteUrl(String(d['inviteLink']));
        return;
      }
    }
    setStaffResult(errorTextFor(res as never));
  }, [eventId, initData, inviteBusy, errorTextFor]);

  // W13: участники события. Ответ всегда несёт counters+rows+csv+json —
  // ими и обновляем состояние, без перезапроса (как staff_list у W36).
  const loadParts = useCallback(async () => {
    setPartsError('');
    const res = await postJson(MANAGE_API, { initData, action: 'participants', eventId });
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok'] && d['counters'] && Array.isArray(d['rows'])) {
        setParts({
          counters: d['counters'] as { registered: number; checked_in: number; cancelled: number },
          rows: d['rows'] as PartRow[],
          csv: typeof d['csv'] === 'string' ? String(d['csv']) : '',
          json: typeof d['json'] === 'string' ? String(d['json']) : '[]',
        });
        return;
      }
    }
    setPartsError(errorTextFor(res as never));
  }, [eventId, initData, errorTextFor]);

  // W45 (Q53): отзывы события — один запрос, без срезов (список обычно
  // короткий); average уже посчитан сервером.
  const loadFeedback = useCallback(async () => {
    setFeedbackError('');
    const res = await postJson(MANAGE_API, { initData, action: 'feedback_list', eventId });
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok'] && Array.isArray(d['rows'])) {
        setFeedback({
          average: typeof d['average'] === 'number' ? d['average'] : Number(d['average']) || 0,
          count: typeof d['count'] === 'number' ? d['count'] : Number(d['count']) || 0,
          rows: d['rows'] as FeedbackRow[],
        });
        return;
      }
    }
    setFeedbackError(errorTextFor(res as never));
  }, [eventId, initData, errorTextFor]);

  // W13: экспорт — скачивание готовой серверной строки через blob.
  // BOM уже первый символ csv (сервер), JSON — без BOM. Имя файла —
  // participants-<eventId>.csv/json.
  const downloadExport = useCallback(
    (kind: 'csv' | 'json') => {
      if (!parts) return;
      const text = kind === 'csv' ? parts.csv : parts.json;
      if (!text) return;
      const blob = new Blob([text], {
        type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'participants-' + eventId + '.' + kind;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [parts, eventId],
  );

  // W13: срезы списка (фильтры OWN-7) — клиентские, из загруженных rows.
  // Статус пришедшего — по непустому checked_in_at (IDM-2), как на сервере.
  const partsSlice = useCallback(
    (f: PartsFilter): PartRow[] => {
      if (!parts) return [];
      if (f === 'all') return parts.rows;
      if (f === 'checked_in') return parts.rows.filter((p) => p.checked_in_at !== '');
      if (f === 'cancelled') return parts.rows.filter((p) => p.status === 'cancelled');
      return parts.rows.filter((p) => p.status === 'registered' && p.checked_in_at === '');
    },
    [parts],
  );

  const partStatusKey = useCallback((p: PartRow): string => {
    if (p.checked_in_at !== '') return 'myreg.status.checked_in';
    if (p.status === 'cancelled') return 'myreg.status.cancelled';
    return 'myreg.status.registered';
  }, []);

  // Хвост времени чекина для списка: сервер отдаёт «DD.MM.YYYY HH:mm» —
  // показываем «HH:mm», как в эталоне.
  const partTime = useCallback((p: PartRow): string => {
    const s = p.checked_in_at;
    const i = s.lastIndexOf(' ');
    return i >= 0 ? s.slice(i + 1) : s;
  }, []);

  // Подтверждение выхода заменяет содержимое — наверх.
  useEffect(() => {
    if (confirmExit) window.scrollTo(0, 0);
  }, [confirmExit]);

  // theme and i18n load
  useEffect(() => {
    setupThemeListener();
    const tg2 = getTelegram();
    if (tg2) {
      try {
        tg2.ready();
        tg2.expand();
      } catch {}
      if (tg2.onEvent) tg2.onEvent('themeChanged', () => setupThemeListener());
    }
  }, []);

  useEffect(() => {
    // initial title from hash
    void loadI18n().then((d) => {
      setDictLoaded(true);
      const isEdit = Boolean(propEventId);
      const key = isEdit ? 'manage.title.edit' : 'manage.list.title';
      const tt = d[key] || (isEdit ? 'Правка события' : 'События');
      setTitleText(tt);
      document.title = t(key);

      if (!tg || !initData) {
        showLoadFail(t('manage.err.not_in_telegram'));
        return;
      }
      if (propEventId === 'new') {
        // Вердикт W49 (W50): создание — из чата сразу на форму, кнопки
        // создания в списке нет. 'new' — не id события, а новая запись.
        setEventId('');
        startNew();
      } else if (propEventId) {
        setEventId(propEventId);
        void load(propEventId);
      } else {
        // W37: без :id — список событий чаптера, форма создания — по кнопке.
        setEventId('');
        setShowForm(false);
        setListLoaded(false);
        setListItems([]);
        void loadList();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propEventId]);

  // W36: список контролёров — один раз на событие: после загрузки формы и после
  // создания (eventId появляется из ответа save). Ошибка загрузки списка форму
  // не трогает — секция останется пустой.
  // W13: участники грузятся тем же жизненным циклом (один запрос на событие).
  useEffect(() => {
    setStaffItems([]);
    setSearchQuery('');
    setCandidates([]);
    setStaffFieldError('');
    setStaffResult('');
    setParts(null);
    setPartsError('');
    setPartsFilter('all');
    setFeedback(null);
    setFeedbackError('');
    if (showForm && eventId && initData) {
      void loadStaff();
      void loadParts();
      void loadFeedback();
    }
  }, [showForm, eventId, initData, loadStaff, loadParts, loadFeedback]);

  // W42: черновик создания — в localStorage, пока события нет на сервере.
  useEffect(() => {
    if (!showForm || eventId || done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, step, online, mapLink }));
    } catch {}
  }, [showForm, eventId, done, fields, step, online, mapLink]);

  // W47: подтверждение закрытия Mini App — только пока на экране есть
  // несохранённый черновик (создание) или несохранённые правки; после
  // публикации/сохранения и на выходе без изменений выключается. Это не
  // защита данных (черновик и так переживает закрытие), а защита от ощущения
  // потери.
  const draftTouched = useCallback(() => {
    if (!eventId) {
      if (step > 0 || online || mapLink.trim() !== '') return true;
      return FIELDS.some((n) => String(fields[n] || '').trim() !== '');
    }
    return isDirty();
  }, [eventId, step, online, mapLink, fields, isDirty]);

  useEffect(() => {
    setClosingConfirmation(showForm && !done && !confirmExit && draftTouched());
  }, [showForm, done, confirmExit, draftTouched]);

  // Уход со страницы не должен оставлять подтверждение включённым.
  useEffect(() => () => setClosingConfirmation(false), []);

  const canPublish = !origStatus || origStatus === 'draft';
  const plate = plateFromLocal(fields['starts_at']);
  // W53: таб рассылки — сегменты из загруженных участников (прототип
  // renderBroadcastTab; строки all_consent в ответе participants нет —
  // пропущена осознанно, см. журнал W53).
  const bcastNoShow = parts ? parts.rows.filter((p) => p.status === 'registered' && p.checked_in_at === '').length : 0;
  const bcastEndsMs = tashMs(fields['ends_at']);
  const bcastNoShowLocked = !isFinite(bcastEndsMs) || bcastEndsMs > Date.now();
  const bcastEndsWhen = endsWhen(fields['ends_at']);
  const previewStatus = origStatus || 'draft';
  const capLimit = capacityLimit(fields['capacity'], fields['overbook_pct']);
  // «Опубликовать» включена только на валидной форме — состояние эталона.
  const publishReady = clientErrors(fields, true, { online, mapLink }).length === 0;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, paddingBottom: showForm ? 120 : 16 }}>
      <h1 className="empty-heading" id="title">
        {titleText}
      </h1>
      {statusText && (
        <p className="empty-desc" id="status" role="status">
          {statusText}
        </p>
      )}

      {showLoadfail && (
        <div className="card result bad" id="loadfail">
          <p className="empty-heading" id="loadfailText">
            {loadfailText}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            id="retry"
            onClick={() => (loadfailRetryable ? (retryTarget === 'list' ? void loadList() : void load()) : backToList())}
          >
            {loadfailRetryable ? t('manage.btn.retry') : t('manage.btn.back')}
          </button>
        </div>
      )}

      {dictLoaded && !eventId && !showForm && !showLoadfail && (
        <section id="events">
          {/* Вердикт W49 (W50): кнопки создания в списке нет — создание
              приходит из чата сразу на форму #/manage/new. */}
          {listLoaded && listItems.length === 0 && (
            <div className="empty-state" id="events-empty">
              <div className="empty-icon">
                <Icon name="calendar" size={22} />
              </div>
              <div className="empty-heading">{t('manage.list.empty')}</div>
            </div>
          )}
          {listItems.length > 0 && (
            <ul id="events-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {listItems.map((ev) => {
                const p = utcToPlate(ev.starts_at);
                const ms = utcMs(ev.starts_at);
                const past = isFinite(ms) && ms < Date.now();
                return (
                  <li key={ev.id}>
                    <a className={`event-card${past ? ' past' : ''}`} href={`#/manage/${ev.id}`}>
                      <div className="date-plate">
                        <span className="month">{p.month}</span>
                        <span className="day">{p.day}</span>
                        <span className="weekday">{p.weekday}</span>
                      </div>
                      <div className="event-body">
                        <div className="event-top">
                          <span className="event-status">{t(`status.${ev.status}`)}</span>
                          {ev.isAuthor && <span className="badge mono">{t('manage.list.author')}</span>}
                        </div>
                        <h3 className="event-title">{ev.title}</h3>
                        <div className="event-meta">
                          <span className="meta-item">{utcToTime(ev.starts_at)}</span>
                        </div>
                        {/* W50 (вердикт W49): сканер — в строке списка, видно
                            только контролёру (гейт — staffIds с сервера). */}
                        {staffIds[ev.id] && !past && (
                          <div className="app-actions" style={{ marginTop: 8 }}>
                            <a
                              className="btn btn-secondary"
                              href={`#/scan?event_id=${encodeURIComponent(ev.id)}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t('menu.btn.scanner')}
                            </a>
                          </div>
                        )}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {showForm && (
        <section id="wizard">
          {/* «К списку» — только правка: из создания убрано по решению владельца. */}
          {!confirmExit && !!eventId && (
            <button type="button" className="btn btn-ghost btn-sm" id="back-to-list" onClick={backToList} style={{ marginBottom: 10 }}>
              <Icon name="arrow-left" />
              {t('manage.btn.back')}
            </button>
          )}

          {/* W53: табы правки — как в эталоне (tabs-wrap/tabs-scroll/tabs).
              Только при открытом событии; создание — визард без табов. */}
          {showForm && eventId && (
            <div className="tabs-wrap" id="manage-tabs">
              <div className="tabs-scroll">
                <div className="tabs" role="tablist">
                  {(
                    [
                      ['event', t('proto.tab_event')],
                      ['participants', t('owner.event.btn.participants')],
                      ['broadcast', t('owner.event.btn.broadcast')],
                      ['staff', t('manage.staff.title')],
                    ] as [ManageTab, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={manageTab === key}
                      className={`tab${manageTab === key ? ' active' : ''}`}
                      id={`mtab-${key}`}
                      onClick={() => {
                        hapticImpact('light');
                        setManageTab(key);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(!eventId || manageTab === 'event') && (confirmExit ? (
            <div className="card result bad" id="exit-confirm">
              <p className="empty-heading">{t('manage.exit.confirm')}</p>
              <div className="chip-row" style={{ marginBottom: 0 }}>
                <button type="button" className="btn btn-destructive" id="exit-yes" onClick={leaveForm}>
                  {t('manage.exit.btn')}
                </button>
                <button type="button" className="btn btn-secondary" id="exit-no" onClick={() => setConfirmExit(false)}>
                  {t('common.btn.cancel')}
                </button>
              </div>
            </div>
          ) : done ? (
            <>
              <div className="sheet-success" id="wizard-done">
                <div className="success-icon">
                  <Icon name="check-circle" size={34} />
                </div>
                <div className="success-title">{t('manage.chat.published', { title: fields['title'] })}</div>
              </div>
              {inviteLink && inviteLink.eventId === eventId && (
                <section className="card invite-card" id="invite" style={{ marginTop: 16 }}>
                  <div className="card-title" id="invite-title">
                    {t('manage.invite.title')}
                  </div>
                  <div className="invite-link" id="invite-link">
                    {inviteLink.url}
                  </div>
                  <p className="app-muted" id="invite-hint">
                    {t('manage.invite.hint')}
                  </p>
                  <div className="app-actions">
                    <button type="button" className="btn btn-primary" id="invite-copy" onClick={() => copyInviteLink(inviteLink.url)}>
                      <Icon name="copy" />
                      {t('manage.btn.copy')}
                    </button>
                    <a
                      className="btn btn-outline"
                      id="invite-share"
                      href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink.url)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Icon name="share" />
                      {t('manage.btn.share')}
                    </a>
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              <div className="wizard-head">
                <div className="step-dots" aria-hidden="true">
                  {STEP_KEYS.map((_, i) => (
                    <span
                      key={i}
                      className={`step-dot${i < step ? ' done' : ''}${i === step ? ' active' : ''}${errs.some((e) => e.step === i) ? ' warn' : ''}`}
                    />
                  ))}
                </div>
                <span className="wizard-step-label">{t('manage.step.label', { n: step + 1, m: STEP_KEYS.length })}</span>
              </div>
              {draftRestored && (
                <p className="helper" id="draft-restored">
                  {t('manage.draft.restored')}
                </p>
              )}
              <h2 className="empty-heading wizard-title">{t(STEP_KEYS[step])}</h2>

              {step === 0 && (
                <div className="form-section">
                  <div className="field">
                    <label className="label" htmlFor="f-title">
                      {t('field.title')}
                    </label>
                    <input
                      className={`input ${fieldError('title') ? 'error' : ''}`}
                      id="f-title"
                      name="title"
                      maxLength={200}
                      autoComplete="off"
                      value={fields['title']}
                      onChange={(e) => setField('title', e.target.value)}
                    />
                    {fieldError('title') && (
                      <p className="helper error" id="e-title">
                        {fieldError('title')}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="f-description">
                      {t('field.description')}
                    </label>
                    <textarea
                      className={`textarea ${fieldError('description') ? 'error' : ''}`}
                      id="f-description"
                      name="description"
                      rows={4}
                      maxLength={4000}
                      value={fields['description']}
                      onChange={(e) => setField('description', e.target.value)}
                    />
                    <p className="helper">{t('manage.hint.description')}</p>
                    {fieldError('description') && (
                      <p className="helper error" id="e-description">
                        {fieldError('description')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="form-section">
                  <div className="field">
                    <span className="label">{t('manage.geo.format')}</span>
                    {/* Формат — первое поле шага (решение владельца 2026-09-20):
                        онлайн — только даты, офлайн — адрес + ссылка. */}
                    <div className="chip-row" role="group" aria-label={t('manage.geo.format')}>
                      <button
                        type="button"
                        className={`btn btn-secondary btn-sm${online ? ' active' : ''}`}
                        aria-pressed={online}
                        onClick={() => setFormat(true)}
                      >
                        {t('manage.geo.online')}
                      </button>
                      <button
                        type="button"
                        className={`btn btn-secondary btn-sm${!online ? ' active' : ''}`}
                        aria-pressed={!online}
                        onClick={() => setFormat(false)}
                      >
                        {t('manage.geo.offline')}
                      </button>
                    </div>
                  </div>

                  {!online && (
                    <>
                      <div className="field">
                        <label className="label" htmlFor="f-address">
                          {t('field.address')}
                        </label>
                        <input
                          className={`input ${fieldError('address') ? 'error' : ''}`}
                          id="f-address"
                          name="address"
                          maxLength={300}
                          autoComplete="street-address"
                          value={fields['address']}
                          onChange={(e) => setField('address', e.target.value)}
                        />
                        <p className="helper">{t('manage.hint.address')}</p>
                        {fieldError('address') && (
                          <p className="helper error" id="e-address">
                            {fieldError('address')}
                          </p>
                        )}
                      </div>

                      <div className="field">
                        <label className="label" htmlFor="f-geolink">
                          {t('manage.geo.link')}
                        </label>
                        <input
                          className={`input ${fieldError('geo') ? 'error' : ''}`}
                          id="f-geolink"
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          placeholder={t('manage.geo.link_placeholder')}
                          value={mapLink}
                          onChange={(e) => onLinkChange(e.target.value)}
                          onPaste={() => onLinkPaste()}
                        />
                        {(() => {
                          // Ошибка валидации («Далее»/«Опубликовать») уже
                          // показана строкой ниже — не дублируем.
                          if (fieldError('geo')) return null;
                          const parsed = parseYandexLink(mapLink.trim());
                          if (parsed) return null;
                          if (mapLink.trim()) {
                            return (
                              <p className="helper error" id="e-geolink">
                                {t('manage.geo.link_bad')}
                              </p>
                            );
                          }
                          return <p className="helper">{t('manage.geo.none')}</p>;
                        })()}
                        {fieldError('geo') && (
                          <p className="helper error" id="e-geo">
                            {fieldError('geo')}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label className="label" htmlFor="f-starts_at">
                      {t('field.starts_at')}
                    </label>
                    <input
                      className={`input ${fieldError('starts_at') ? 'error' : ''}`}
                      id="f-starts_at"
                      name="starts_at"
                      type="datetime-local"
                      step={60}
                      value={fields['starts_at']}
                      onChange={(e) => setField('starts_at', e.target.value)}
                    />
                    <p className="helper">{t('manage.hint.datetime')}</p>
                    {fieldError('starts_at') && (
                      <p className="helper error" id="e-starts_at">
                        {fieldError('starts_at')}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="f-ends_at">
                      {t('field.ends_at')}
                    </label>
                    <input
                      className={`input ${fieldError('ends_at') ? 'error' : ''}`}
                      id="f-ends_at"
                      name="ends_at"
                      type="datetime-local"
                      step={60}
                      value={fields['ends_at']}
                      onChange={(e) => setField('ends_at', e.target.value)}
                    />
                    {fieldError('ends_at') && (
                      <p className="helper error" id="e-ends_at">
                        {fieldError('ends_at')}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <label className="label" htmlFor="f-reg_deadline_at">
                      {t('field.reg_deadline_at')}
                    </label>
                    <input
                      className={`input ${fieldError('reg_deadline_at') ? 'error' : ''}`}
                      id="f-reg_deadline_at"
                      name="reg_deadline_at"
                      type="datetime-local"
                      step={60}
                      value={fields['reg_deadline_at']}
                      onChange={(e) => setField('reg_deadline_at', e.target.value)}
                    />
                    {fieldError('reg_deadline_at') && (
                      <p className="helper error" id="e-reg_deadline_at">
                        {fieldError('reg_deadline_at')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="form-section">
                  <div className="app-row2">
                    <div className="field">
                      <label className="label" htmlFor="f-capacity">
                        {t('field.capacity')}
                      </label>
                      <input
                        className={`input ${fieldError('capacity') ? 'error' : ''}`}
                        id="f-capacity"
                        name="capacity"
                        inputMode="numeric"
                        autoComplete="off"
                        value={fields['capacity']}
                        onChange={(e) => setField('capacity', e.target.value)}
                      />
                      <p className="helper">{t('manage.hint.capacity')}</p>
                      {fieldError('capacity') && (
                        <p className="helper error" id="e-capacity">
                          {fieldError('capacity')}
                        </p>
                      )}
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="f-overbook_pct">
                        {t('field.overbook_pct')}
                      </label>
                      <input
                        className={`input ${fieldError('overbook_pct') ? 'error' : ''}`}
                        id="f-overbook_pct"
                        name="overbook_pct"
                        inputMode="numeric"
                        autoComplete="off"
                        value={fields['overbook_pct']}
                        onChange={(e) => setField('overbook_pct', e.target.value)}
                      />
                      <p className="helper">{t('manage.hint.overbook')}</p>
                      {fieldError('overbook_pct') && (
                        <p className="helper error" id="e-overbook_pct">
                          {fieldError('overbook_pct')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="capacity-live" id="capacity-limit">
                    {capLimit !== null && <span className="capacity-live-value">{capLimit}</span>}
                    <span className="capacity-live-text">{limitText(fields['capacity'], fields['overbook_pct'])}</span>
                  </div>
                </div>
              )}

              {step === LAST_STEP && (
                <div className="form-section">
                  <p className="app-muted" id="review-hint">
                    {t('manage.review.hint')}
                  </p>
                  <div className={`event-card preview${plate ? '' : ' no-plate'}`} id="review-card">
                    {plate && (
                      <div className="date-plate">
                        <span className="month">{plate.month}</span>
                        <span className="day">{plate.day}</span>
                        <span className="weekday">{plate.weekday}</span>
                      </div>
                    )}
                    <div className="event-body">
                      <div className="event-top">
                        <span className="event-status">{t(`status.${previewStatus}`)}</span>
                      </div>
                      <h3 className="event-title">{fields['title'] || t('field.title')}</h3>
                      <div className="event-meta">
                        {fields['starts_at'] && (
                          <span className="meta-item">
                            <Icon name="calendar" size={12} />
                            {humanLocal(fields['starts_at'])}
                          </span>
                        )}
                        {fields['address'] && (
                          <span className="meta-item">
                            <Icon name="map-pin" size={12} />
                            {fields['address']}
                          </span>
                        )}
                      </div>
                      {fields['description'] && <p className="app-muted">{fields['description']}</p>}
                    </div>
                  </div>

                  {canPublish && (
                    <button
                      type="button"
                      className="btn btn-outline btn-block"
                      id="save-draft"
                      disabled={busy}
                      style={{ marginTop: 14 }}
                      onClick={() => void submit('draft')}
                    >
                      {t('manage.btn.save_draft')}
                    </button>
                  )}

                  {!canPublish && (
                    <>
                      {inviteLink && inviteLink.eventId === eventId && (
                        <section className="card invite-card" id="invite" style={{ marginTop: 16 }}>
                          <div className="card-title" id="invite-title">
                            {t('manage.invite.title')}
                          </div>
                          <div className="invite-link" id="invite-link">
                            {inviteLink.url}
                          </div>
                          <p className="app-muted" id="invite-hint">
                            {t('manage.invite.hint')}
                          </p>
                          <div className="app-actions">
                            <button type="button" className="btn btn-primary" id="invite-copy" onClick={() => copyInviteLink(inviteLink.url)}>
                              <Icon name="copy" />
                              {t('manage.btn.copy')}
                            </button>
                            <a
                              className="btn btn-outline"
                              id="invite-share"
                              href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink.url)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Icon name="share" />
                              {t('manage.btn.share')}
                            </a>
                          </div>
                        </section>
                      )}

                      {origStatus === 'published' && (
                        <button
                          type="button"
                          className="btn btn-destructive btn-block"
                          id="cancel-event"
                          disabled={busy}
                          style={{ marginTop: 16 }}
                          onClick={() => setCancelSheet(true)}
                        >
                          {t('owner.event.btn.cancel_event')}
                        </button>
                      )}
                    </>
                  )}

                  {errs.length > 0 && (
                    <p className="helper error" id="review-error">
                      {t('manage.err.validation')}
                    </p>
                  )}

                </div>
              )}

              <div className="sticky-actions">
                {step > 0 && (
                  <button type="button" className="btn btn-secondary" id="wizard-prev" onClick={prevStep}>
                    {t('common.btn.back')}
                  </button>
                )}
                {step < LAST_STEP ? (
                  <button type="button" className="btn btn-primary btn-lg" id="wizard-next" onClick={nextStep}>
                    {t('manage.btn.next')}
                  </button>
                ) : canPublish ? (
                  <button type="button" className="btn btn-primary btn-lg" id="publish" disabled={busy || !publishReady} onClick={publish}>
                    {t('manage.btn.publish')}
                  </button>
                ) : origStatus === 'published' ? (
                  <button type="button" className="btn btn-primary btn-lg" id="save-published" disabled={busy} onClick={() => void submit('published')}>
                    {t('manage.btn.save')}
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary btn-lg" id="save-status" disabled={busy} onClick={() => void submit(origStatus)}>
                    {t('manage.btn.save')}
                  </button>
                )}
              </div>
            </>
          ))}
{eventId && manageTab === 'participants' && (
                <section className="card" id="participants" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="parts-title">
                    {t('participants.title', { title: fields['title'] })}
                  </h2>
                  {partsError ? (
                    <>
                      <p className="helper error" id="parts-error" role="alert">
                        {partsError}
                      </p>
                      <button type="button" className="btn btn-secondary btn-sm" id="parts-retry" onClick={() => void loadParts()}>
                        {t('manage.btn.retry')}
                      </button>
                    </>
                  ) : !parts ? (
                    <p className="empty-desc" id="parts-loading">
                      {t('manage.loading')}
                    </p>
                  ) : (
                    <>
                      <div id="parts-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '12px 0' }}>
                        <div className="stat-card" style={{ padding: 12 }}>
                          <div className="stat-label">{t('manage.parts.stat_registered')}</div>
                          <div className="stat-value" style={{ fontSize: 26 }}>
                            {parts.counters.registered}
                          </div>
                        </div>
                        <div className="stat-card" style={{ padding: 12 }}>
                          <div className="stat-label">{t('manage.parts.stat_checked_in')}</div>
                          <div className="stat-value" style={{ fontSize: 26, color: 'var(--success)' }}>
                            {parts.counters.checked_in}
                          </div>
                        </div>
                        <div className="stat-card" style={{ padding: 12 }}>
                          <div className="stat-label">{t('manage.parts.stat_cancelled')}</div>
                          <div className="stat-value" style={{ fontSize: 26, color: 'var(--warning)' }}>
                            {parts.counters.cancelled}
                          </div>
                        </div>
                      </div>
                      <div className="tabs" id="parts-filter" role="tablist" style={{ marginBottom: 12 }}>
                        {(
                          [
                            ['all', 'participants.filter.btn.all', parts.rows.length],
                            ['checked_in', 'participants.filter.btn.checked_in', parts.counters.checked_in],
                            ['no_show', 'participants.filter.btn.no_show', parts.rows.filter((p) => p.status === 'registered' && p.checked_in_at === '').length],
                            ['cancelled', 'participants.filter.btn.cancelled', parts.counters.cancelled],
                          ] as [PartsFilter, string, number][]
                        ).map(([key, label, count]) => (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={partsFilter === key}
                            className={`tab${partsFilter === key ? ' active' : ''}`}
                            id={`f-${key}`}
                            onClick={() => setPartsFilter(key)}
                          >
                            {t(label)}
                            <span className="count">{count}</span>
                          </button>
                        ))}
                      </div>
                      {partsSlice(partsFilter).length === 0 ? (
                        <p className="empty-desc" id="parts-empty">
                          {t('participants.empty')}
                        </p>
                      ) : (
                        <ul id="parts-list" style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {partsSlice(partsFilter).map((p) => (
                            <li key={p.telegram_id} data-telegram-id={p.telegram_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span className="avatar-initials" aria-hidden="true">
                                {candidateInitials(p.name, '')}
                              </span>
                              <span style={{ flexGrow: 1, minWidth: 0 }}>
                                <span style={{ display: 'block' }}>{p.name}</span>
                                <span className="app-muted" style={{ display: 'block' }}>
                                  {t(partStatusKey(p))}
                                </span>
                              </span>
                              {p.checked_in_at !== '' && <span className="app-muted">{partTime(p)}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="app-actions" style={{ marginTop: 0 }}>
                        <button type="button" className="btn btn-outline" id="parts-export-csv" disabled={!parts.rows.length} onClick={() => downloadExport('csv')}>
                          {t('export.btn.csv')}
                        </button>
                        <button type="button" className="btn btn-outline" id="parts-export-json" disabled={!parts.rows.length} onClick={() => downloadExport('json')}>
                          {t('export.btn.json')}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}
              {eventId && manageTab === 'participants' && (
                <section className="card" id="feedback" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="feedback-title">
                    {t('manage.feedback.title', { title: fields['title'] })}
                  </h2>
                  {feedbackError ? (
                    <>
                      <p className="helper error" id="feedback-error" role="alert">
                        {feedbackError}
                      </p>
                      <button type="button" className="btn btn-secondary btn-sm" id="feedback-retry" onClick={() => void loadFeedback()}>
                        {t('manage.btn.retry')}
                      </button>
                    </>
                  ) : !feedback ? (
                    <p className="empty-desc" id="feedback-loading">
                      {t('manage.loading')}
                    </p>
                  ) : feedback.count === 0 ? (
                    <p className="empty-desc" id="feedback-empty">
                      {t('manage.feedback.empty')}
                    </p>
                  ) : (
                    <>
                      <p className="app-muted" id="feedback-average">
                        {t('manage.feedback.average', { avg: String(feedback.average), count: String(feedback.count) })}
                      </p>
                      <ul id="feedback-list" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {feedback.rows.map((r, i) => (
                          <li key={r.telegram_id + '-' + i} data-telegram-id={r.telegram_id} className="card" style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="avatar-initials" aria-hidden="true">
                                  {candidateInitials(r.name, '')}
                                </span>
                                <span>{r.name}</span>
                              </span>
                              <span aria-label={t('manage.feedback.rating_label', { rating: String(r.rating) })} style={{ display: 'flex', gap: 2 }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Icon key={i} name="star" size={14} filled={i <= r.rating} />
                                ))}
                              </span>
                            </div>
                            <p className="app-muted" style={{ margin: '8px 0 0' }}>
                              {r.comment || t('manage.feedback.no_comment')}
                            </p>
                            <p className="app-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                              {r.submitted_at}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              )}
                            {eventId && manageTab === 'broadcast' && (
                <>
                  <div className="card" id="bcast-hint" style={{ marginTop: 16 }}>
                    <p className="app-muted">{t('proto.broadcast_chat_hint')}</p>
                  </div>
                  {tg && (
                    <div className="sheet-actions" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-lg btn-block"
                        id="bcast-open-chat"
                        onClick={() => {
                          try {
                            tg.close();
                          } catch {}
                        }}
                      >
                        {t('proto.open_chat')}
                      </button>
                    </div>
                  )}
                  <section className="card list-card" id="bcast-segments" style={{ marginTop: 16 }}>
                    <div className="card-title" id="bcast-segments-title" style={{ padding: '16px 16px 4px' }}>
                      {t('bcast.ask.segment')}
                    </div>
                    {partsError ? (
                      <>
                        <p className="helper error" id="bcast-error" role="alert">
                          {partsError}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          id="bcast-retry"
                          style={{ margin: '0 16px 16px' }}
                          onClick={() => void loadParts()}
                        >
                          {t('manage.btn.retry')}
                        </button>
                      </>
                    ) : !parts ? (
                      <p className="empty-desc" id="bcast-loading" style={{ padding: 16 }}>
                        {t('manage.loading')}
                      </p>
                    ) : (
                      <>
                        <div className="list-row">
                          <span className="body">{t('bcast.segment.registered')}</span>
                          <span className="tail">{parts.counters.registered}</span>
                        </div>
                        <div className="list-row">
                          <span className="body">{t('bcast.segment.checked_in')}</span>
                          <span className="tail">{parts.counters.checked_in}</span>
                        </div>
                        <div className="list-row">
                          <span className="body">{t('bcast.segment.no_show')}</span>
                          <span className="tail">{bcastNoShowLocked ? '—' : bcastNoShow}</span>
                          {bcastNoShowLocked && <Icon name="clock" size={15} />}
                        </div>
                        {bcastNoShowLocked && bcastEndsWhen !== '' && (
                          <div className="helper" id="bcast-noshow-locked" style={{ padding: '4px 16px 12px' }}>
                            {t('bcast.segment.no_show_locked', { when: bcastEndsWhen })}
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </>
              )}
{eventId && manageTab === 'staff' && (
                <section className="card" id="staff" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="staff-title">
                    {t('manage.staff.title')}
                  </h2>
                  <p className="app-muted" id="staff-hint" style={{ margin: '8px 0 0' }}>
                    {t('proto.staff_hint')}
                  </p>
                  {staffItems.length === 0 ? (
                    <p className="empty-desc" id="staff-empty">
                      {t('manage.staff.empty')}
                    </p>
                  ) : (
                    <ul id="staff-list" style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {staffItems.map((s) => (
                        <li key={s.telegram_id} data-telegram-id={s.telegram_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            <span className="avatar-initials" aria-hidden="true">
                              {candidateInitials(s.name, s.username) || '?'}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', fontWeight: 500, overflowWrap: 'anywhere' }}>{s.name || s.item}</span>
                              {s.sub !== '' && (
                                <span className="app-muted" style={{ display: 'block', fontSize: 12 }}>
                                  {s.sub}
                                </span>
                              )}
                            </span>
                          </span>
                          <button type="button" className="btn btn-outline btn-sm" disabled={staffBusy} onClick={() => void revokeStaff(s.telegram_id)}>
                            {t('manage.staff.btn.revoke')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* W55: ввод по логину инлайн (вердикт владельца 2026-09-19):
                      поле + кнопка в секции, совпадения — списком ниже, шита нет. */}
                  <div className="field" style={{ marginTop: 16 }}>
                    <label className="label" htmlFor="f-staff-login">
                      {t('manage.staff.login_label')}
                    </label>
                    <div className="row" style={{ display: 'flex', gap: 12 }}>
                      <input
                        className={`input ${staffFieldError ? 'error' : ''}`}
                        id="f-staff-login"
                        name="staff_username"
                        type="text"
                        autoComplete="off"
                        maxLength={33}
                        placeholder={t('manage.staff.login_placeholder')}
                        value={searchQuery}
                        disabled={staffBusy}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setStaffFieldError('');
                        }}
                      />
                      <button type="button" className="btn btn-primary" id="staff-add" disabled={staffBusy || searchBusy || searchQuery.trim() === ''} onClick={() => void addByLogin()}>
                        {t('manage.staff.btn.add')}
                      </button>
                    </div>
                    <p className="helper">{t('manage.staff.login_hint')}</p>
                    {staffFieldError && (
                      <p className="helper error" id="e-staff-login">
                        {staffFieldError}
                      </p>
                    )}
                    {staffResult && (
                      <p className="helper" id="staff-result" role="status">
                        {staffResult}
                      </p>
                    )}
                  </div>
                  {searchQuery.trim().length >= 2 && (
                    candidates.length === 0 && !searchBusy ? (
                      <p className="empty-desc" id="staff-search-empty">
                        {t('manage.staff.login_not_found')}
                      </p>
                    ) : (
                      <ul id="staff-search-list" style={{ listStyle: 'none', margin: '12px 0 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {candidates.map((c) => (
                          <li key={c.telegram_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="avatar-initials" aria-hidden="true">
                              {candidateInitials(c.name, c.username)}
                            </span>
                            <span style={{ flexGrow: 1, minWidth: 0 }}>
                              <span style={{ display: 'block' }}>{c.name === '' ? `@${c.username.replace(/^@/, '')}` : c.name}</span>
                              {c.username !== '' && (
                                <span className="app-muted" style={{ display: 'block' }}>
                                  @{c.username.replace(/^@/, '')}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={staffBusy}
                              onClick={() => void addStaff(c.telegram_id)}
                            >
                              {t('manage.staff.btn.add')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                  {/* W10 (OWN-14): одноразовая ссылка-инвайт — альтернатива логину.
                      Создаётся здесь, в Mini App; в чат карточка не приходит
                      (вердикт владельца 2026-09-21, прототип). */}
                  <div className="field" style={{ marginTop: 18 }}>
                    {staffInviteUrl === '' ? (
                      <button type="button" className="btn btn-outline" id="staff-invite" disabled={staffBusy || inviteBusy} onClick={() => void createStaffInvite()}>
                        {t('staff.btn.invite')}
                      </button>
                    ) : (
                      <>
                        <label className="label" htmlFor="staff-invite-link">
                          {t('staff.btn.invite')}
                        </label>
                        <input
                          className="input"
                          id="staff-invite-link"
                          type="text"
                          readOnly
                          value={staffInviteUrl}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                        <p className="helper">{t('staff.invite.hint')}</p>
                        <div className="row" style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                          <button type="button" className="btn btn-primary" id="staff-invite-copy" onClick={() => copyInviteLink(staffInviteUrl)}>
                            {t('manage.btn.copy')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            id="staff-invite-share"
                            onClick={() => window.open('https://t.me/share/url?url=' + encodeURIComponent(staffInviteUrl), '_blank', 'noopener')}
                          >
                            {t('manage.btn.share')}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}
        </section>
      )}

      <Sheet open={cancelSheet} title={t('owner.event.btn.cancel_event')} onClose={() => setCancelSheet(false)}>
        <p className="app-muted">{t('manage.cancel.confirm', { title: fields['title'] })}</p>
        <div className="sheet-actions">
          <button type="button" className="btn btn-destructive" id="cancel-yes" disabled={busy} onClick={() => void submit('cancelled')}>
            {t('common.btn.confirm')}
          </button>
          <button type="button" className="btn btn-secondary" id="cancel-no" onClick={() => setCancelSheet(false)}>
            {t('common.btn.cancel')}
          </button>
        </div>
      </Sheet>

      {toast && (
        <div className="toast show" id="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
