import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import Icon from '../components/Icon';
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
type StaffCandidate = { telegram_id: string; name: string; username: string };
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

// Орг-ссылка (её даёт «Поделиться»): https://yandex.com/maps/org/<slug>/<oid>…
// Координат в ней нет — их достаёт сервер через Геокодер (W42, Q55).
const ORG_LINK_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,6}\/maps\/org\//i;
const YANDEX_MAPS_RE = /^https?:\/\/(?:[a-z0-9-]+\.)*yandex\.[a-z.]{2,6}\/maps\//i;

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

// Шит — паттерн эталона (prototypes/proto.css `.app-sheet`): ручка, шапка
// с крестиком, тело. В WebView позиционируется fixed, поверх sticky-бара.
// W44: инициалы для аватара кандидата — кружок с буквами, как в прототипе.
// Фото из Bot API не тянем; цвета — только семантические токены бренда.
function candidateInitials(name: string, username: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return username.replace(/^@/, '').slice(0, 2).toUpperCase();
}

function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  // Пока шит открыт, фон не прокручивается (дизайн-ревью W42, круг 4):
  // колесо над подложкой уводило визард из-под модалки.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="app-sheet">
      <div className="app-sheet-backdrop" onClick={onClose} />
      <div className="app-sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="app-sheet-grab" />
        <div className="app-sheet-head">
          <span className="app-sheet-title">{title}</span>
          <button type="button" className="app-sheet-close" aria-label={t('common.btn.close')} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="app-sheet-body">{children}</div>
      </div>
    </div>
  );
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
  // несохранённые правки молча (дизайн-ревью W42).
  const loadedRef = useRef<Record<string, string> | null>(null);
  // Счётчик запросов resolve_geo: поздний ответ при закрытом шите не применяем
  // (дизайн-ревью, круг 6).
  const geoReqRef = useRef(0);

  // form fields
  const [fields, setFields] = useState<Record<string, string>>({ ...EMPTY_FIELDS });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [locateVisible, setLocateVisible] = useState(false);

  // гео: шит ссылки, недавние места
  const [geoSheet, setGeoSheet] = useState(false);
  const [geoInput, setGeoInput] = useState('');
  const [geoError, setGeoError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);

  // W36: секция «Контролёры» — только у существующего ивента (нужен eventId).
  const [staffItems, setStaffItems] = useState<StaffItem[]>([]);
  const [staffLoaded, setStaffLoaded] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffIdInput, setStaffIdInput] = useState('');
  const [staffFieldError, setStaffFieldError] = useState('');
  const [staffResult, setStaffResult] = useState('');

  // W44: поиск кандидатов в контролёры — шит с выбором тапом (вердикт W41).
  // Источник — участники ивента + staff чаптера (Q51); кого нет в списке —
  // ручной ввод ID ниже остаётся запасным путём.
  const [searchSheet, setSearchSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);

  // W37: список ивентов чаптера (#/manage без :id) и ссылка регистрации,
  // которая живёт на экране (сервер отдаёт её в `load` и `save`).
  const [listItems, setListItems] = useState<ListItem[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [retryTarget, setRetryTarget] = useState<'list' | 'form'>('form');
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
      // Серверные ошибки полей не переезжают на другой ивент (ревью W42,
      // круг 4): карта ключей не привязана к шагу, «starts_past» с ивента A
      // горел бы под валидной датой ивента B, пока поле не тронут.
      setFieldErrors({});
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
    setFieldErrors({});
    setDone(false);
    setDraftRestored(false);
    setCancelSheet(false);
    setConfirmExit(false);
    geoReqRef.current += 1; // ответ resolve_geo в полёте уже не применяется
    setGeoSheet(false);
    setGeoInput('');
    setGeoError('');
    setGeoBusy(false);
  }, []);

  // Закрытие шита ссылки: отменяет и поздний ответ resolve_geo (круг 6).
  const closeGeoSheet = useCallback(() => {
    geoReqRef.current += 1;
    setGeoBusy(false);
    setGeoSheet(false);
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
  // У создания правки не теряются — черновик лежит в localStorage, поэтому
  // подтверждение выхода нужно только у существующего ивента (эталон не
  // спрашивает вовсе; это исправление дефекта, см. журнал W42).
  const backToList = useCallback(() => {
    if (!done && eventId && isDirty()) {
      setConfirmExit(true);
      return;
    }
    leaveForm();
  }, [done, eventId, isDirty, leaveForm]);

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
        showToast(errorTextFor(res as never));
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
        const errFields = (d['fields'] as Record<string, unknown>) || {};
        showFieldErrors(errFields);
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.err.validation');
        showToast(txt);
        // Прыгаем на первый шаг с ошибкой, чтобы человек её увидел (W42).
        const first = Object.keys(errFields).find((k) => STEP_OF_FIELD[k] !== undefined);
        if (first !== undefined) setStep(STEP_OF_FIELD[first]);
        return;
      }
      showToast(errorTextFor(res as never));
    },
    [busy, clearErrors, collect, eventId, initData, origStatus, applyStatus, errorTextFor, showFieldErrors, showToast, leaveForm],
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

  // W42: ссылку на место разбираем на клиенте; орг-ссылка (в ней координат
  // нет) уходит на сервер — Геокодер возвращает точку и адрес (Q55). Пока
  // идёт запрос, кнопка выключена, чтобы не отправить два.
  const applyGeoLink = useCallback(async () => {
    if (geoBusy) return;
    const raw = geoInput.trim();
    // Орг-ссылка всегда уходит на сервер: координат в ней нет, а `ll`/`pt`
    // в такой ссылке задают центр карты, а не точку (ревью W42, круг 5).
    if (!ORG_LINK_RE.test(raw)) {
      const parsed = parseYandexLink(raw);
      if (parsed && coordsInRange(parsed.lat, parsed.lon)) {
        setGeo(parsed.lat, parsed.lon);
        setGeoInput('');
        setGeoError('');
        setGeoSheet(false);
        showToast(t('manage.geo.link_applied'));
        return;
      }
      if (!YANDEX_MAPS_RE.test(raw)) {
        setGeoError(t('manage.geo.link_bad'));
        return;
      }
    }
    // Пока идёт запрос, кнопка, поле и «Недавние места» выключены, а поздний
    // ответ не применяется, если шит уже закрыли (дизайн-ревью, круг 6) —
    // иначе ответ перетирал бы выбор, сделанный после нажатия.
    const reqId = ++geoReqRef.current;
    setGeoBusy(true);
    setGeoError('');
    const res = await postJson(MANAGE_API, { initData, action: 'resolve_geo', link: raw });
    if (geoReqRef.current !== reqId) return;
    setGeoBusy(false);
    if (res.kind === 'json' && res.data['ok']) {
      const la = Number(res.data['lat']);
      const lo = Number(res.data['lon']);
      if (coordsInRange(la, lo)) {
        setGeo(la, lo);
        // Адрес подставляем, только если поле пустое: введённое вручную не трогаем.
        const addr = typeof res.data['address'] === 'string' ? res.data['address'].trim() : '';
        if (addr) setFields((prev) => (String(prev['address'] || '').trim() ? prev : { ...prev, address: addr }));
        setGeoInput('');
        setGeoError('');
        setGeoSheet(false);
        showToast(t('manage.geo.link_applied'));
        return;
      }
    }
    const d = res.kind === 'json' ? (res.data as Record<string, unknown>) : null;
    const errFields = d && d['fields'] && typeof d['fields'] === 'object' ? (d['fields'] as Record<string, unknown>) : null;
    const key = errFields && typeof errFields['geo'] === 'string' ? String(errFields['geo']) : '';
    setGeoError(key ? t(key) : errorTextFor(res as never));
  }, [geoBusy, geoInput, initData, setGeo, showToast, errorTextFor]);

  const applyRecent = useCallback(
    (r: RecentPlace) => {
      const la = Number(String(r.lat || '').replace(',', '.'));
      const lo = Number(String(r.lon || '').replace(',', '.'));
      if (r.lat !== '' && r.lon !== '' && coordsInRange(la, lo)) setGeo(la, lo);
      setFields((prev) => ({ ...prev, address: r.address }));
      closeGeoSheet();
    },
    [setGeo, closeGeoSheet],
  );

  // Копирование ссылки — тост «Скопировано» (эталон); если буфер недоступен,
  // показываем саму ссылку, чтобы её можно было скопировать руками.
  const copyInviteLink = useCallback(
    (url: string) => {
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

  // W36: список контролёров ивента. Ответ staff_* всегда несёт `staff`
  // (готовые строки для показа) — им и обновляем состояние, без перезапроса.
  const loadStaff = useCallback(async () => {
    const res = await postJson(MANAGE_API, { initData, action: 'staff_list', eventId });
    if (res.kind === 'json' && res.data['ok'] && Array.isArray(res.data['staff'])) {
      setStaffItems(res.data['staff'] as StaffItem[]);
    }
  }, [eventId, initData]);

  const addStaff = useCallback(async (id?: string) => {
    if (staffBusy) return;
    // W44: из шита поиска приходит готовый telegram_id кандидата; запись идёт
    // тем же staff_add — решение и запись только по telegram_id (DAT-1).
    const target = (id === undefined ? staffIdInput : id).trim();
    if (target === '') return;
    setStaffFieldError('');
    setStaffResult('');
    setStaffBusy(true);
    const res = await postJson(MANAGE_API, { initData, action: 'staff_add', eventId, staffTelegramId: target });
    setStaffBusy(false);
    if (res.kind === 'json') {
      const d = res.data as Record<string, unknown>;
      if (d['ok']) {
        if (Array.isArray(d['staff'])) setStaffItems(d['staff'] as StaffItem[]);
        if (id === undefined) setStaffIdInput('');
        else {
          // Добавление из поиска: шит закрываем, итог — строкой в секции.
          setSearchSheet(false);
          setSearchQuery('');
          setCandidates([]);
        }
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

  // W44: поиск кандидатов (manage-api action staff_search). Сервер отдаёт
  // только совпадения (топ-20); запрос короче 2 символов не отправляем вовсе —
  // базу без запроса не светим (решение при взятии пакета).
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

  // W44: живой поиск с дебаунсом — отдельный запрос на каждое нажатие не шлём.
  useEffect(() => {
    if (!searchSheet) return;
    if (searchQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => void searchStaff(searchQuery), 400);
    return () => window.clearTimeout(timer);
  }, [searchSheet, searchQuery, searchStaff]);

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

  // Отказ/недоступность геолокации не оставляем молча (дизайн-ревью W42,
  // круг 4): «кнопка не работает» — худший из возможных исходов.
  const handleLocate = useCallback(() => {
    const tg2 = getTelegram();
    const lm = tg2?.LocationManager;
    if (lm && typeof lm.init === 'function') {
      try {
        lm.init(() => {
          if (!lm.isLocationAvailable || (!lm.isAccessGranted && lm.isAccessRequested)) {
            showToast(t('manage.geo.locate_failed'));
            if (typeof lm.openSettings === 'function') lm.openSettings();
            return;
          }
          lm.getLocation((loc) => {
            if (loc && typeof loc.latitude === 'number') setGeo(loc.latitude, loc.longitude);
            else showToast(t('manage.geo.locate_failed'));
          });
        });
      } catch {
        showToast(t('manage.geo.locate_failed'));
      }
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeo(pos.coords.latitude, pos.coords.longitude),
        () => showToast(t('manage.geo.locate_failed')),
        { timeout: 10000 },
      );
      return;
    }
    showToast(t('manage.geo.locate_failed'));
  }, [setGeo, showToast]);

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
  // «Опубликовать» включена только на валидной форме — состояние эталона.
  const publishReady = clientErrors(fields, true).length === 0;

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
          <div className="field actions" style={{ marginBottom: 14 }}>
            <button type="button" className="btn btn-primary btn-lg" id="new-event" onClick={startNew}>
              <Icon name="plus" />
              {t('manage.btn.new')}
            </button>
          </div>
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
            <button type="button" className="btn btn-ghost btn-sm" id="back-to-list" onClick={backToList} style={{ marginBottom: 10 }}>
              <Icon name="arrow-left" />
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
                          setGeoSheet(true);
                          setGeoError('');
                        }}
                      >
                        <Icon name="link" />
                        {t('manage.geo.link')}
                      </button>
                      {locateVisible && (
                        <button type="button" className="btn btn-outline" id="locate" onClick={handleLocate}>
                          <Icon name="navigation" />
                          {t('manage.btn.locate')}
                        </button>
                      )}
                    </div>

                    {fields['lat'] !== '' && fields['lon'] !== '' ? (
                      <>
                        <div className="loc-preview" aria-hidden="true">
                          <div className="loc-grid" />
                          <span className="loc-pin">
                            <Icon name="map-pin" size={20} />
                          </span>
                        </div>
                        <p className="helper" id="geo-coords">
                          {t('manage.geo.coords', { lat: fmtCoord(fields['lat']), lon: fmtCoord(fields['lon']) })}
                        </p>
                        <a className="loc-link" id="geo-map" href={mapUrl(fields['lat'], fields['lon'])} target="_blank" rel="noreferrer">
                          {t('event.card.btn_map')}
                          <Icon name="external" size={14} />
                        </a>
                      </>
                    ) : (
                      <p className="helper" id="geo-none">
                        {t('manage.geo.none')}
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
                  <button
                    type="button"
                    className="btn btn-secondary"
                    id="staff-search-open"
                    disabled={staffBusy}
                    onClick={() => {
                      setSearchQuery('');
                      setCandidates([]);
                      setSearchSheet(true);
                    }}
                  >
                    {t('manage.staff.search_open')}
                  </button>
                </section>
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
          )}
        </section>
      )}

      <Sheet open={geoSheet} title={t('manage.geo.link')} onClose={closeGeoSheet}>
        <p className="app-muted">{t('manage.hint.geo')}</p>
        <input
          className={`input ${geoError ? 'error' : ''}`}
          id="f-geo-link"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder={t('manage.geo.link_placeholder')}
          value={geoInput}
          disabled={geoBusy}
          onChange={(e) => {
            setGeoInput(e.target.value);
            setGeoError('');
          }}
        />
        {geoError && (
          <p className="helper error" id="e-geo-link" role="alert">
            {geoError}
          </p>
        )}
        {recents.length > 0 && (
          <>
            <div className="section-label">{t('manage.geo.recent')}</div>
            <div className="sheet-actions" id="geo-recent">
              {recents.map((r) => (
                <button
                  key={r.address}
                  type="button"
                  className="btn btn-outline"
                  disabled={geoBusy}
                  onClick={() => applyRecent(r)}
                >
                  <span className="chip-label">{r.address}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-primary"
            id="geo-apply"
            disabled={geoInput.trim() === '' || geoBusy}
            aria-busy={geoBusy}
            onClick={() => void applyGeoLink()}
          >
            {geoBusy ? t('manage.geo.searching') : t('manage.geo.link_apply')}
          </button>
        </div>
      </Sheet>

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

      <Sheet open={searchSheet} title={t('manage.staff.search_title')} onClose={() => setSearchSheet(false)}>
        <div className="field">
          <label className="label" htmlFor="f-staff-search">
            {t('manage.staff.search_label')}
          </label>
          <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ display: 'flex', flexShrink: 0 }} aria-hidden="true">
              <Icon name="search" size={18} />
            </span>
            <input
              className="input"
              id="f-staff-search"
              type="search"
              autoComplete="off"
              maxLength={100}
              placeholder={t('manage.staff.search_placeholder')}
              value={searchQuery}
              disabled={staffBusy}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <p className="helper">{t('manage.staff.search_hint')}</p>
        </div>
        {searchQuery.trim().length >= 2 && candidates.length === 0 && !searchBusy ? (
          <p className="empty-desc" id="staff-search-empty">
            {t('manage.staff.search_nobody')}
          </p>
        ) : (
          <ul id="staff-search-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        )}
      </Sheet>

      {toast && (
        <div className="toast show" id="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
