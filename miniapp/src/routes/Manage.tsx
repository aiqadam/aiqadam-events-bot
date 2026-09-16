import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { postJson, MANAGE_API } from '../lib/api';
import { utcToLocalInput, utcToPlate, utcToTime, utcMs } from '../lib/dates';

const FIELDS = ['title', 'description', 'address', 'lat', 'lon', 'starts_at', 'ends_at', 'reg_deadline_at', 'capacity', 'overbook_pct'] as const;

// Черновик нового ивента переживает уход со страницы (W42): localStorage,
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
type StaffItem = { telegram_id: string; item: string };
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
type RecentPlace = { address: string; lat: string; lon: string };
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

function mapUrl(lat: string, lon: string): string {
  return 'https://yandex.ru/maps/?pt=' + lon + ',' + lat + '&z=17&l=map';
}

function fmtCoord(v: string): string {
  const n = Number(String(v).replace(',', '.'));
  return isFinite(n) ? n.toFixed(5) : String(v);
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
function clientErrors(f: Record<string, string>, strict: boolean): StepError[] {
  const out: StepError[] = [];
  const add = (step: number, field: string, key: string, vars?: Record<string, string | number>) => {
    out.push({ step, field, text: t(key, vars) });
  };
  const title = (f['title'] || '').trim();
  if (strict && !title) add(0, 'title', 'manage.err.required');
  else if (title && (title.length < 2 || title.length > 200)) add(0, 'title', 'manage.err.title_length');
  if ((f['description'] || '').length > 4000) add(0, 'description', 'manage.err.description_length');

  const address = (f['address'] || '').trim();
  if (strict && !address) add(1, 'address', 'manage.err.required');
  else if (address && (address.length < 2 || address.length > 300)) add(1, 'address', 'manage.err.address_length');
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

export default function Manage({ eventId: propEventId }: { eventId: string }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const [eventId, setEventId] = useState(propEventId);
  const newIdRef = useRef(genNewId());
  const [origStatus, setOrigStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [dictLoaded, setDictLoaded] = useState(false);
  const [titleText, setTitleText] = useState('Новый ивент');
  const [statusText, setStatusText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showLoadfail, setShowLoadfail] = useState(false);
  const [loadfailText, setLoadfailText] = useState('');
  const [loadfailRetryable, setLoadfailRetryable] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // W42: визард — шаг, ошибки шагов (клиентские и серверные), экран успеха.
  const [step, setStep] = useState(0);
  const [errs, setErrs] = useState<StepError[]>([]);
  const [done, setDone] = useState(false);
  const [doneText, setDoneText] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // Снимок полей на момент загрузки/сохранения — чтобы «К списку» не терял
  // несохранённые правки молча (дизайн-ревью W42).
  const loadedRef = useRef<Record<string, string> | null>(null);

  // form fields
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY_FIELDS });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [locateVisible, setLocateVisible] = useState(false);

  // гео: панель ссылки, недавние места
  const [geoPanel, setGeoPanel] = useState(false);
  const [geoInput, setGeoInput] = useState('');
  const [geoError, setGeoError] = useState('');
  const [geoNote, setGeoNote] = useState('');

  // W36: секция «Контролёры» — только у существующего ивента (нужен eventId).
  const [staffItems, setStaffItems] = useState<StaffItem[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffIdInput, setStaffIdInput] = useState('');
  const [staffFieldError, setStaffFieldError] = useState('');
  const [staffResult, setStaffResult] = useState('');

  // W37: список ивентов чаптера (#/manage без :id) и ссылка регистрации,
  // которая живёт на экране (сервер отдаёт её в `load` и `save`).
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [retryTarget, setRetryTarget] = useState<'list' | 'form'>('form');
  const [inviteLink, setInviteLink] = useState<{ eventId: string; url: string } | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // keep prop sync (when hash changes)
  useEffect(() => setEventId(propEventId), [propEventId]);

  const applyStatus = useCallback((st: string) => {
    setOrigStatus(st);
  }, []);

  const setField = useCallback((name: string, value: string) => {
    setResult(null);
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
      loadedRef.current = next;
      applyStatus(String(ev['status'] || 'draft'));
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

  const setBusyState = useCallback((on: boolean, key?: string) => {
    setBusy(on);
    setStatusText(on && key ? t(key) : '');
  }, []);

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
      setResult(null);
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
      setInviteCopied(false);
      setStatusText('');
      setStep(0);
      setErrs([]);
      setDone(false);
      setDraftRestored(false);
      setShowForm(true);
    },
    [eventId, initData, errorTextFor, fillForm, showLoadFail],
  );

  // W37: список ивентов своего чаптера — вход в правку без команд (ADR-0025).
  const loadList = useCallback(async () => {
    setShowLoadfail(false);
    setShowForm(false);
    setResult(null);
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
  }, [initData, errorTextFor, showLoadFail]);

  const resetFormState = useCallback(() => {
    setStep(0);
    setErrs([]);
    setDone(false);
    setDoneText('');
    setDraftRestored(false);
    setConfirmCancel(false);
    setConfirmExit(false);
    setGeoPanel(false);
    setGeoInput('');
    setGeoError('');
    setGeoNote('');
  }, []);

  const leaveForm = useCallback(() => {
    resetFormState();
    // Если форма открыта из списка, hash ведёт на ивент — возвращаем его
    // на #/manage (App пересоберёт роут); после создания hash не менялся.
    if (window.location.hash && window.location.hash !== '#/manage') {
      window.location.hash = '#/manage';
      return;
    }
    setEventId('');
    setShowForm(false);
    setResult(null);
    setInviteLink(null);
    void loadList();
  }, [loadList, resetFormState]);

  const isDirty = useCallback(() => {
    if (!eventId) return false;
    const base = loadedRef.current;
    if (!base) return false;
    return FIELDS.some((n) => String(fields[n] || '').trim() !== String(base[n] || '').trim());
  }, [eventId, fields]);

  // «К списку» не теряет несохранённые правки молча: спрашиваем (дизайн-ревью).
  const backToList = useCallback(() => {
    if (!done && isDirty()) {
      setConfirmExit(true);
      return;
    }
    leaveForm();
  }, [done, isDirty, leaveForm]);

  // W42: создание — визард с черновиком в localStorage (уход со страницы его
  // не теряет); после сохранения на сервере черновик больше не нужен.
  const startNew = useCallback(() => {
    // Ключ идемпотентности — один на открытие формы (ADR-0003): повторное
    // «Сохранить» апсертит ту же запись. Новое открытие формы — новый ключ,
    // иначе второе создание перезаписало бы первый ивент (ревью W42, блокер).
    newIdRef.current = genNewId();
    let next = { ...EMPTY_FIELDS };
    let nextStep = 0;
    let restored = false;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { fields?: Record<string, string>; step?: number };
        if (d && d.fields && typeof d.fields === 'object') {
          next = { ...EMPTY_FIELDS, ...d.fields };
          nextStep = Math.min(LAST_STEP, Math.max(0, Number(d.step) || 0));
          restored = true;
        }
      }
    } catch {}
    setFields(next);
    loadedRef.current = next;
    setStep(nextStep);
    setErrs([]);
    setFieldErrors({});
    setDone(false);
    setDoneText('');
    setConfirmCancel(false);
    setDraftRestored(restored);
    setShowForm(true);
    setResult(null);
    setTitleText(t('manage.title.new'));
    applyStatus('');
  }, [applyStatus]);

  const submit = useCallback(
    async (status: string) => {
      if (busy) return;
      setConfirmCancel(false);
      clearErrors();
      setResult(null);
      const collecting = collect(status);
      setBusyState(true, 'manage.saving');
      const res = await postJson(MANAGE_API, {
        initData,
        action: 'save',
        eventId,
        newId: eventId ? '' : newIdRef.current,
        fields: collecting,
      });
      setBusyState(false);
      if (res.kind !== 'json') {
        setResult({ ok: false, text: errorTextFor(res as never) });
        return;
      }
      const d = res.data as Record<string, unknown>;
      if (d['ok']) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        loadedRef.current = collecting;
        if (d['eventId']) setEventId(String(d['eventId']));
        applyStatus(status);
        // После публикации экран успеха живёт как «Новый ивент» (прототип);
        // после черновика/правки форма — уже правка существующего ивента.
        setTitleText(t(status === 'published' && origStatus !== 'published' ? 'manage.title.new' : 'manage.title.edit'));
        const inv = typeof d['inviteLink'] === 'string' ? String(d['inviteLink']) : '';
        setInviteCopied(false);
        setInviteLink(inv ? { eventId: String(d['eventId'] || eventId), url: inv } : null);
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.saved.updated');
        if (status === 'published' && origStatus !== 'published') {
          // Публикация заканчивается экраном успеха со ссылкой, а не прыжком
          // в чат (W42; чат-факт приходит карточкой — W37).
          setDoneText(txt);
          setDone(true);
          setResult(null);
        } else {
          setResult({ ok: true, text: txt });
        }
        return;
      }
      if (d['error'] === 'validation') {
        const errFields = (d['fields'] as Record<string, unknown>) || {};
        showFieldErrors(errFields);
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.err.validation');
        setResult({ ok: false, text: txt });
        // Прыгаем на первый шаг с ошибкой, чтобы человек её увидел (W42).
        const first = Object.keys(errFields).find((k) => STEP_OF_FIELD[k] !== undefined);
        if (first !== undefined) setStep(STEP_OF_FIELD[first]);
        return;
      }
      setResult({ ok: false, text: errorTextFor(res as never) });
    },
    [busy, clearErrors, collect, eventId, initData, origStatus, applyStatus, errorTextFor, setBusyState, showFieldErrors],
  );

  // Шаг проверяется на «Далее» — как в эталоне (дизайн-ревью W42): пустые
  // обязательные поля не пропускаем, точки шагов с ошибками помечаются.
  const nextStep = useCallback(() => {
    const e = clientErrors(fields, true).filter((x) => x.step === step);
    if (e.length) {
      setErrs(e);
      return;
    }
    setErrs([]);
    setStep((s) => Math.min(LAST_STEP, s + 1));
  }, [fields, step]);

  const prevStep = useCallback(() => {
    setErrs([]);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const publish = useCallback(() => {
    const e = clientErrors(fields, true);
    if (e.length) {
      setErrs(e);
      setStep(e[0].step);
      return;
    }
    void submit('published');
  }, [fields, submit]);

  const applyGeoLink = useCallback(() => {
    const parsed = parseYandexLink(geoInput);
    if (!parsed || !coordsInRange(parsed.lat, parsed.lon)) {
      setGeoError(t('manage.geo.link_bad'));
      return;
    }
    setGeo(parsed.lat, parsed.lon);
    setGeoInput('');
    setGeoError('');
    setGeoNote(t('manage.geo.link_applied'));
    setGeoPanel(false);
  }, [geoInput, setGeo]);

  const applyRecent = useCallback(
    (r: RecentPlace) => {
      const la = Number(String(r.lat || '').replace(',', '.'));
      const lo = Number(String(r.lon || '').replace(',', '.'));
      if (r.lat !== '' && r.lon !== '' && coordsInRange(la, lo)) setGeo(la, lo);
      setFields((prev) => ({ ...prev, address: r.address }));
      setGeoNote('');
      setGeoPanel(false);
    },
    [setGeo],
  );

  // W36: список контролёров ивента. Ответ staff_* всегда несёт `staff`
  // (готовые строки для показа) — им и обновляем состояние, без перезапроса.
  const loadStaff = useCallback(async () => {
    const res = await postJson(MANAGE_API, { initData, action: 'staff_list', eventId });
    if (res.kind === 'json' && res.data['ok'] && Array.isArray(res.data['staff'])) {
      setStaffItems(res.data['staff'] as StaffItem[]);
    }
  }, [eventId, initData]);

  const addStaff = useCallback(async () => {
    if (staffBusy) return;
    setStaffFieldError('');
    setStaffResult('');
    setStaffBusy(true);
    const res = await postJson(MANAGE_API, { initData, action: 'staff_add', eventId, staffTelegramId: staffIdInput.trim() });
    setStaffBusy(false);
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok']) {
        if (Array.isArray(d['staff'])) setStaffItems(d['staff'] as StaffItem[]);
        setStaffIdInput('');
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
  }, [eventId, initData, staffBusy, staffIdInput, errorTextFor]);

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

  // locate setup
  useEffect(() => {
    if (!dictLoaded) return;
    const tg2 = getTelegram();
    const lm = tg2?.LocationManager;
    if (lm && typeof lm.init === 'function') {
      setLocateVisible(true);
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setLocateVisible(true);
    } else {
      setLocateVisible(false);
    }
  }, [dictLoaded]);

  const handleLocate = useCallback(() => {
    const tg2 = getTelegram();
    const lm = tg2?.LocationManager;
    if (lm && typeof lm.init === 'function') {
      try {
        lm.init(() => {
          if (!lm.isLocationAvailable || (!lm.isAccessGranted && lm.isAccessRequested)) {
            if (typeof lm.openSettings === 'function') lm.openSettings();
            return;
          }
          lm.getLocation((loc) => {
            if (loc && typeof loc.latitude === 'number') setGeo(loc.latitude, loc.longitude);
          });
        });
      } catch {}
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { timeout: 10000 },
      );
    }
  }, [setGeo]);

  // Подтверждение отмены может оказаться выше вьюпорта, если его открыли
  // из sticky-бара, когда страница прокручена вниз (дизайн-ревью, круг 3):
  // доводим карточку до центра экрана, иначе нажатие выглядит как «ничего
  // не произошло». Подтверждение выхода заменяет содержимое — наверх.
  useEffect(() => {
    if (!confirmCancel) return;
    const el = document.getElementById('cancel-confirm');
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
  }, [confirmCancel]);

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
      const tt = d[key] || (isEdit ? 'Правка ивента' : 'Ивенты');
      setTitleText(tt);
      document.title = t(key);

      if (!tg || !initData) {
        showLoadFail(t('manage.err.not_in_telegram'));
        return;
      }
      if (propEventId) {
        setEventId(propEventId);
        void load(propEventId);
      } else {
        // W37: без :id — список ивентов чаптера, форма создания — по кнопке.
        setEventId('');
        setShowForm(false);
        setListLoaded(false);
        setListItems([]);
        void loadList();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propEventId]);

  // W36: список контролёров — один раз на ивент: после загрузки формы и после
  // создания (eventId появляется из ответа save). Ошибка загрузки списка форму
  // не трогает — секция останется пустой.
  useEffect(() => {
    setStaffItems([]);
    setStaffIdInput('');
    setStaffFieldError('');
    setStaffResult('');
    if (showForm && eventId && initData) void loadStaff();
  }, [showForm, eventId, initData, loadStaff]);

  // W42: черновик создания — в localStorage, пока ивента нет на сервере.
  useEffect(() => {
    if (!showForm || eventId || done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ fields, step }));
    } catch {}
  }, [showForm, eventId, done, fields, step]);

  // W42: недавние места — адреса своих ивентов из уже загруженного списка
  // (сервер отдаёт address/lat/lon только для isAuthor-строк).
  const recents = useMemo<RecentPlace[]>(() => {
    const seen = new Set<string>();
    const out: RecentPlace[] = [];
    listItems
      .filter((e) => e.isAuthor && String(e.address || '').trim() !== '')
      .slice()
      .sort((a, b) => {
        const am = utcMs(a.starts_at);
        const bm = utcMs(b.starts_at);
        return (isFinite(bm) ? bm : 0) - (isFinite(am) ? am : 0);
      })
      .forEach((e) => {
        const address = String(e.address || '').trim();
        if (seen.has(address)) return;
        seen.add(address);
        out.push({ address, lat: String(e.lat || ''), lon: String(e.lon || '') });
      });
    return out.slice(0, 5);
  }, [listItems]);

  const canPublish = !origStatus || origStatus === 'draft';
  const plate = plateFromLocal(fields['starts_at']);
  const previewStatus = origStatus || 'draft';
  const capLimit = capacityLimit(fields['capacity'], fields['overbook_pct']);

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
          <div className="field actions" style={{ marginBottom: 16 }}>
            <button type="button" className="btn btn-primary btn-lg" id="new-event" onClick={startNew}>
              {t('manage.btn.new')}
            </button>
          </div>
          {listLoaded && listItems.length === 0 && (
            <p className="empty-desc" id="events-empty">
              {t('manage.list.empty')}
            </p>
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
          {!confirmExit && (
            <button type="button" className="btn btn-secondary btn-sm" id="back-to-list" onClick={backToList} style={{ marginBottom: 12 }}>
              {t('manage.btn.back')}
            </button>
          )}

          {confirmExit ? (
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
              <div className="card result ok" id="wizard-done">
                <p className="empty-heading">{doneText || t('manage.saved.created')}</p>
              </div>
              {inviteLink && inviteLink.eventId === eventId && (
                <section className="card" id="invite" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="invite-title">
                    {t('manage.invite.title')}
                  </h2>
                  <p className="empty-desc" id="invite-hint">
                    {t('manage.invite.hint')}
                  </p>
                  <p className="mono" id="invite-link" style={{ wordBreak: 'break-all', marginBottom: 12 }}>
                    {inviteLink.url}
                  </p>
                  <div className="row" style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="invite-copy"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteLink.url).then(
                          () => setInviteCopied(true),
                          () => setInviteCopied(false),
                        );
                      }}
                    >
                      {inviteCopied ? t('manage.btn.copied') : t('manage.btn.copy')}
                    </button>
                    <a
                      className="btn btn-outline"
                      id="invite-share"
                      href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink.url)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
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
                    <span className="label">{t('field.geo')}</span>
                    <div className="chip-row">
                      <button
                        type="button"
                        className="btn btn-outline"
                        id="geo-link"
                        onClick={() => {
                          setGeoPanel((v) => !v);
                          setGeoError('');
                        }}
                      >
                        {t('manage.geo.link')}
                      </button>
                      {locateVisible && (
                        <button type="button" className="btn btn-outline" id="locate" onClick={handleLocate}>
                          {t('manage.btn.locate')}
                        </button>
                      )}
                    </div>

                    {geoPanel && (
                      <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                        <input
                          className={`input ${geoError ? 'error' : ''}`}
                          id="f-geo-link"
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          placeholder={t('manage.geo.link_placeholder')}
                          value={geoInput}
                          onChange={(e) => {
                            setGeoInput(e.target.value);
                            setGeoError('');
                          }}
                        />
                        {geoError && (
                          <p className="helper error" id="e-geo-link">
                            {geoError}
                          </p>
                        )}
                        <div style={{ marginTop: 12 }}>
                          <button type="button" className="btn btn-primary" id="geo-apply" disabled={geoInput.trim() === ''} onClick={applyGeoLink}>
                            {t('manage.geo.link_apply')}
                          </button>
                        </div>
                        {recents.length > 0 && (
                          <>
                            <p className="label" style={{ marginTop: 16 }}>
                              {t('manage.geo.recent')}
                            </p>
                            <div className="chip-row" id="geo-recent">
                              {recents.map((r) => (
                                <button key={r.address} type="button" className="btn btn-outline chip-place" onClick={() => applyRecent(r)}>
                                  <span className="chip-label">{r.address}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {fields['lat'] !== '' && fields['lon'] !== '' ? (
                      <>
                        <p className="helper" id="geo-coords">
                          {t('manage.geo.coords', { lat: fmtCoord(fields['lat']), lon: fmtCoord(fields['lon']) })}
                        </p>
                        <a className="helper" id="geo-map" href={mapUrl(fields['lat'], fields['lon'])} target="_blank" rel="noreferrer">
                          {t('event.card.btn_map')}
                        </a>
                      </>
                    ) : (
                      <p className="helper" id="geo-none">
                        {t('manage.geo.none')}
                      </p>
                    )}
                    {geoNote && (
                      <p className="helper" id="geo-note" role="status">
                        {geoNote}
                      </p>
                    )}
                    {fieldError('geo') && (
                      <p className="helper error" id="e-geo">
                        {fieldError('geo')}
                      </p>
                    )}
                  </div>

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
                  <div className="row" style={{ display: 'flex', gap: 12 }}>
                    <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
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
                    <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
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
                  <p className="helper" id="review-hint">
                    {t('manage.review.hint')}
                  </p>
                  <div className="event-card preview" id="review-card">
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
                        {fields['starts_at'] && <span className="meta-item">{humanLocal(fields['starts_at'])}</span>}
                        {fields['address'] && <span className="meta-item">{fields['address']}</span>}
                      </div>
                      {fields['description'] && <p className="event-desc">{fields['description']}</p>}
                    </div>
                  </div>

                  {confirmCancel && (
                    <div className="card result bad" id="cancel-confirm" style={{ marginTop: 16 }}>
                      <p className="empty-heading">{t('manage.cancel.confirm', { title: fields['title'] })}</p>
                      <div className="chip-row" style={{ marginBottom: 0 }}>
                        <button type="button" className="btn btn-destructive" id="cancel-yes" disabled={busy} onClick={() => void submit('cancelled')}>
                          {t('common.btn.confirm')}
                        </button>
                        <button type="button" className="btn btn-secondary" id="cancel-no" onClick={() => setConfirmCancel(false)}>
                          {t('common.btn.cancel')}
                        </button>
                      </div>
                    </div>
                  )}

              {inviteLink && inviteLink.eventId === eventId && (
                <section className="card" id="invite" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="invite-title">
                    {t('manage.invite.title')}
                  </h2>
                  <p className="empty-desc" id="invite-hint">
                    {t('manage.invite.hint')}
                  </p>
                  <p className="mono" id="invite-link" style={{ wordBreak: 'break-all', marginBottom: 12 }}>
                    {inviteLink.url}
                  </p>
                  <div className="row" style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      id="invite-copy"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteLink.url).then(
                          () => setInviteCopied(true),
                          () => setInviteCopied(false),
                        );
                      }}
                    >
                      {inviteCopied ? t('manage.btn.copied') : t('manage.btn.copy')}
                    </button>
                    <a
                      className="btn btn-outline"
                      id="invite-share"
                      href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink.url)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('manage.btn.share')}
                    </a>
                  </div>
                </section>
              )}

              {eventId && (
                <section className="card" id="staff" style={{ marginTop: 16 }}>
                  <h2 className="empty-heading" id="staff-title">
                    {t('manage.staff.title')}
                  </h2>
                  {staffItems.length === 0 ? (
                    <p className="empty-desc" id="staff-empty">
                      {t('manage.staff.empty')}
                    </p>
                  ) : (
                    <ul id="staff-list" style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {staffItems.map((s) => (
                        <li key={s.telegram_id} data-telegram-id={s.telegram_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                          <span>{s.item}</span>
                          <button type="button" className="btn btn-outline btn-sm" disabled={staffBusy} onClick={() => void revokeStaff(s.telegram_id)}>
                            {t('manage.staff.btn.revoke')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="field">
                    <label className="label" htmlFor="f-staff-id">
                      {t('manage.staff.add_label')}
                    </label>
                    <div className="row" style={{ display: 'flex', gap: 12 }}>
                      <input
                        className={`input ${staffFieldError ? 'error' : ''}`}
                        id="f-staff-id"
                        name="staff_telegram_id"
                        inputMode="numeric"
                        maxLength={16}
                        autoComplete="off"
                        value={staffIdInput}
                        onChange={(e) => setStaffIdInput(e.target.value)}
                      />
                      <button type="button" className="btn btn-primary" id="staff-add" disabled={staffBusy || staffIdInput.trim() === ''} onClick={() => void addStaff()}>
                        {t('manage.staff.btn.add')}
                      </button>
                    </div>
                    {staffFieldError && (
                      <p className="helper error" id="e-staff-id">
                        {staffFieldError}
                      </p>
                    )}
                    {staffResult && (
                      <p className="helper" id="staff-result" role="status">
                        {staffResult}
                      </p>
                    )}
                  </div>
                </section>
              )}
                </div>
              )}

              <div className="sticky-actions">
                {busy && (
                  <p className="helper sticky-status" role="status">
                    {t('manage.saving')}
                  </p>
                )}
                {result && (
                  <p className={`helper sticky-status ${result.ok ? 'ok' : 'error'}`} id="result" role="status">
                    {result.text}
                  </p>
                )}
                {step > 0 && (
                  <button type="button" className="btn btn-secondary btn-lg" id="wizard-prev" onClick={prevStep}>
                    {t('common.btn.back')}
                  </button>
                )}
                {step < LAST_STEP ? (
                  <button type="button" className="btn btn-primary btn-lg" id="wizard-next" onClick={nextStep}>
                    {t('manage.btn.next')}
                  </button>
                ) : canPublish ? (
                  <>
                    <button type="button" className="btn btn-secondary btn-lg" id="save-draft" disabled={busy} onClick={() => void submit('draft')}>
                      {t('manage.btn.save_draft')}
                    </button>
                    <button type="button" className="btn btn-primary btn-lg" id="publish" disabled={busy} onClick={publish}>
                      {t('manage.btn.publish')}
                    </button>
                  </>
                ) : origStatus === 'published' ? (
                  <>
                    <button type="button" className="btn btn-primary btn-lg" id="save-published" disabled={busy} onClick={() => void submit('published')}>
                      {t('manage.btn.save')}
                    </button>
                    <button type="button" className="btn btn-destructive btn-lg" id="cancel-event" disabled={busy} onClick={() => setConfirmCancel(true)}>
                      {t('owner.event.btn.cancel_event')}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-primary btn-lg" id="save-status" disabled={busy} onClick={() => void submit(origStatus)}>
                    {t('manage.btn.save')}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}


    </main>
  );
}
