import { useEffect, useState, useCallback, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { postJson, EVENTS_API, REG_API, STAFF_EVENTS_API } from '../lib/api';
import { utcToPlate, utcToWhen, utcMs } from '../lib/dates';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';

// W38/W43: каталог `#/events` — PAR-3/PAR-4 экраном (ADR-0023).
// Публичный срез читает events-api (без initData); «Мои билеты», регистрация
// и отмена — reg-api (initData обязателен). Регистрация идёт внутри Mini App,
// в чат уводит только ссылка-приглашение у тех, кто открыл каталог вне Telegram.

type CatalogEvent = {
  id: string;
  title: string;
  address: string;
  startsAt: string;
  endsAt: string;
  regDeadlineAt: string;
  status: string;
  registerLink: string;
};

type MineRow = {
  eventId: string;
  status: string;
  registeredAt: string;
  checkedInAt: string;
};

export type EventsTab = 'mine' | 'upcoming' | 'past';

type MineState = 'off' | 'loading' | 'ready' | 'error';

export default function Events({ tab: routeTab }: { tab: EventsTab }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const inTelegram = Boolean(initData);

  const [dictLoaded, setDictLoaded] = useState(false);
  const [tab, setTab] = useState<EventsTab>(routeTab);
  const [upcoming, setUpcoming] = useState<CatalogEvent[]>([]);
  const [past, setPast] = useState<CatalogEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [loadfail, setLoadfail] = useState('');
  const [mine, setMine] = useState<MineRow[]>([]);
  const [mineState, setMineState] = useState<MineState>(inTelegram ? 'loading' : 'off');
  const [mineError, setMineError] = useState('');
  // W50 (вердикт W49): сканер — рядом с ивентом, видно только контролёру.
  // Чьи кнопки — решает staff-events-api, страница только рисует; тихо нет —
  // значит нет (ошибка здесь — не отказ экрана).
  const [staffIds, setStaffIds] = useState<Record<string, boolean>>({});

  // Шит регистрации
  const [sheetEvent, setSheetEvent] = useState<CatalogEvent | null>(null);
  const [pdn, setPdn] = useState(false);
  const [mkt, setMkt] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetDone, setSheetDone] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoadfail('');
    const res = await postJson(EVENTS_API, {});
    if (res.kind === 'network') {
      setLoadfail(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      setLoadfail(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (!d['ok'] || !Array.isArray(d['upcoming']) || !Array.isArray(d['past'])) {
      setLoadfail(t('events.err.server'));
      return;
    }
    setUpcoming(d['upcoming'] as CatalogEvent[]);
    setPast(d['past'] as CatalogEvent[]);
    setEventsLoaded(true);
  }, []);

  const loadMine = useCallback(async () => {
    if (!inTelegram) return;
    setMineState('loading');
    setMineError('');
    const res = await postJson(REG_API, { action: 'mine', initData });
    if (res.kind === 'network') {
      setMineState('error');
      setMineError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      setMineState('error');
      setMineError(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (d['ok'] && Array.isArray(d['mine'])) {
      setMine(d['mine'] as MineRow[]);
      setMineState('ready');
      return;
    }
    setMineState('error');
    setMineError(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('events.err.server'));
  }, [inTelegram, initData]);

  const loadStaffEvents = useCallback(async () => {
    if (!inTelegram) return;
    const res = await postJson(STAFF_EVENTS_API, { initData });
    if (res.kind !== 'json') return;
    const d = res.data;
    if (d['ok'] && Array.isArray(d['eventIds'])) {
      const set: Record<string, boolean> = {};
      (d['eventIds'] as unknown[]).forEach((id) => {
        if (typeof id === 'string' && id) set[id] = true;
      });
      setStaffIds(set);
    }
  }, [inTelegram, initData]);

  useEffect(() => {
    setupThemeListener();
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {}
    }
    void loadI18n().then(() => setDictLoaded(true));
    void loadEvents();
    void loadMine();
    void loadStaffEvents();
  }, [tg, loadEvents, loadMine, loadStaffEvents]);

  useEffect(() => {
    if (dictLoaded) {
      const key = tab === 'mine' ? 'events.tab.mine' : tab === 'past' ? 'events.list.past_title' : 'events.list.upcoming_title';
      document.title = t(key);
    }
  }, [dictLoaded, tab]);

  // Таб живёт в hash — диплинк `#/events?tab=…` (кнопки меню W43).
  const switchTab = useCallback((key: EventsTab) => {
    setTab(key);
    try {
      history.replaceState(null, '', '#/events?tab=' + key);
    } catch {}
  }, []);

  const eventsById = useMemo(() => {
    const map: Record<string, CatalogEvent> = {};
    upcoming.concat(past).forEach((e) => {
      if (e.id) map[e.id] = e;
    });
    return map;
  }, [upcoming, past]);

  // Регистрации вызывающего известны → на карточке «Показать QR», а не «Зарегистрироваться».
  const registeredIds = useMemo(() => {
    const set: Record<string, boolean> = {};
    mine.forEach((r) => {
      if (r.status === 'registered' || r.status === 'checked_in') set[r.eventId] = true;
    });
    return set;
  }, [mine]);

  const openSheet = useCallback((ev: CatalogEvent) => {
    setSheetEvent(ev);
    setPdn(false);
    setMkt(false);
    setSheetError('');
    setSheetBusy(false);
    setSheetDone(false);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetEvent(null);
  }, []);

  const submitRegistration = useCallback(async () => {
    if (!sheetEvent || sheetBusy) return;
    setSheetBusy(true);
    setSheetError('');
    const res = await postJson(REG_API, {
      action: 'register',
      initData,
      eventId: sheetEvent.id,
      consentPdn: true,
      consentMarketing: mkt,
    });
    setSheetBusy(false);
    if (res.kind === 'network') {
      setSheetError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      setSheetError(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (d['ok']) {
      // IDM-1: повтор даёт тот же результат — «уже зарегистрированы», без второго подтверждения.
      setSheetDone(true);
      void loadMine();
      return;
    }
    setSheetError(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('events.err.server'));
  }, [sheetEvent, sheetBusy, initData, mkt, loadMine]);

  const openTicket = useCallback(
    (eventId: string) => () => {
      closeSheet();
      window.location.hash = '#/ticket?event_id=' + encodeURIComponent(eventId);
    },
    [closeSheet],
  );

  const openRegister = useCallback(
    (ev: CatalogEvent) => (e: MouseEvent<HTMLAnchorElement>) => {
      // Вне Telegram зарегистрироваться нечем — ведём по deep link в чат (как W38).
      const tgg = getTelegram();
      if (!tgg || !tgg.initData) return;
      e.preventDefault();
      openSheet(ev);
    },
    [openSheet],
  );

  const tabTitle = tab === 'mine' ? 'events.tab.mine' : tab === 'past' ? 'events.list.past_title' : 'events.list.upcoming_title';
  const mineRows = mine
    .map((r) => ({ row: r, ev: eventsById[r.eventId] }))
    .filter((x) => Boolean(x.ev));
  // Будущие регистрации — по возрастанию старта, затем прошедшие — по убыванию.
  mineRows.sort((a, b) => {
    const am = utcMs(a.ev!.startsAt);
    const bm = utcMs(b.ev!.startsAt);
    const now = Date.now();
    const aPast = isFinite(am) && am < now;
    const bPast = isFinite(bm) && bm < now;
    if (aPast !== bPast) return aPast ? 1 : -1;
    if (!isFinite(am) || !isFinite(bm)) return 0;
    return aPast ? bm - am : am - bm;
  });

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1 className="empty-heading" id="title">
        {dictLoaded ? t(tabTitle) : ''}
      </h1>

      <div className="tabs" id="events-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={`tab${tab === 'mine' ? ' active' : ''}`} id="tab-mine" onClick={() => switchTab('mine')}>
          {dictLoaded ? t('events.tab.mine') : ''}
        </button>
        <button type="button" className={`tab${tab === 'upcoming' ? ' active' : ''}`} id="tab-upcoming" onClick={() => switchTab('upcoming')}>
          {dictLoaded ? t('events.list.btn.upcoming') : ''}
        </button>
        <button type="button" className={`tab${tab === 'past' ? ' active' : ''}`} id="tab-past" onClick={() => switchTab('past')}>
          {dictLoaded ? t('events.list.btn.past') : ''}
        </button>
      </div>

      {loadfail && (
        <div className="card result bad" id="loadfail">
          <p className="empty-heading" id="loadfailText">
            {loadfail}
          </p>
          <button type="button" className="btn btn-secondary" id="retry" onClick={() => void loadEvents()}>
            {t('manage.btn.retry')}
          </button>
        </div>
      )}

      {!loadfail && tab === 'mine' && (
        <MineTab
          dictLoaded={dictLoaded}
          inTelegram={inTelegram}
          state={mineState}
          error={mineError}
          rows={mineRows}
          onRetry={() => void loadMine()}
          onOpenTicket={openTicket}
        />
      )}

      {!loadfail && tab !== 'mine' && !eventsLoaded && (
        <p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>
          {dictLoaded ? t('events.loading') : ''}
        </p>
      )}

      {!loadfail && tab !== 'mine' && eventsLoaded && (tab === 'upcoming' ? upcoming : past).length === 0 && (
        <div className="empty-state" id="events-empty">
          <div className="empty-icon">
            <Icon name="calendar" size={22} />
          </div>
          <div className="empty-heading">{t(tab === 'past' ? 'events.list.empty_past' : 'events.list.empty_upcoming')}</div>
        </div>
      )}

      {!loadfail && tab !== 'mine' && eventsLoaded && (tab === 'upcoming' ? upcoming : past).length > 0 && (
        <ul id="events-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(tab === 'upcoming' ? upcoming : past).map((ev, i) => (
            <li key={ev.id || String(i)}>
              <EventCard
                ev={ev}
                past={tab === 'past'}
                registered={Boolean(registeredIds[ev.id])}
                canScan={Boolean(staffIds[ev.id])}
                inTelegram={inTelegram}
                onRegister={openRegister}
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet open={Boolean(sheetEvent)} title={t('reg.sheet.title')} onClose={closeSheet}>
        {sheetEvent && (
          <RegistrationSheet
            ev={sheetEvent}
            pdn={pdn}
            mkt={mkt}
            busy={sheetBusy}
            error={sheetError}
            done={sheetDone}
            onPdn={() => setPdn(!pdn)}
            onMkt={() => setMkt(!mkt)}
            onSubmit={() => void submitRegistration()}
            onTicket={openTicket(sheetEvent.id)}
          />
        )}
      </Sheet>
    </main>
  );
}

function MineTab({
  dictLoaded,
  inTelegram,
  state,
  error,
  rows,
  onRetry,
  onOpenTicket,
}: {
  dictLoaded: boolean;
  inTelegram: boolean;
  state: MineState;
  error: string;
  rows: { row: MineRow; ev: CatalogEvent | undefined }[];
  onRetry: () => void;
  onOpenTicket: (eventId: string) => () => void;
}) {
  if (!inTelegram) {
    return (
      <div className="empty-state" id="mine-foreign-browser">
        <div className="empty-icon">
          <Icon name="ticket" size={22} />
        </div>
        <div className="empty-heading">{t('ticket.not_in_telegram')}</div>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="card result bad" id="mine-fail">
        <p className="empty-heading">{error}</p>
        <button type="button" className="btn btn-secondary" id="mine-retry" onClick={onRetry}>
          {t('manage.btn.retry')}
        </button>
      </div>
    );
  }
  if (state === 'loading' && rows.length === 0) {
    return (
      <p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>
        {dictLoaded ? t('events.loading') : ''}
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="empty-state" id="mine-empty">
        <div className="empty-icon">
          <Icon name="ticket" size={22} />
        </div>
        <div className="empty-heading">{t('myreg.empty')}</div>
      </div>
    );
  }
  return (
    <ul id="mine-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rows.map(({ row, ev }) => (
        <li key={row.eventId}>
          <MineCard row={row} ev={ev as CatalogEvent} onOpenTicket={onOpenTicket} />
        </li>
      ))}
    </ul>
  );
}

function MineCard({ row, ev, onOpenTicket }: { row: MineRow; ev: CatalogEvent; onOpenTicket: (eventId: string) => () => void }) {
  const p = utcToPlate(ev.startsAt);
  const when = utcToWhen(ev.startsAt);
  const ms = utcMs(ev.startsAt);
  const upcoming = isFinite(ms) && ms > Date.now();
  const statusKey = row.status === 'checked_in' ? 'myreg.status.checked_in' : upcoming ? 'myreg.status.registered' : 'myreg.status.registered';
  const showQr = row.status === 'registered' && upcoming;
  return (
    <div className="event-card">
      <div className="date-plate">
        <span className="month">{p.month}</span>
        <span className="day">{p.day}</span>
        <span className="weekday">{p.weekday}</span>
      </div>
      <div className="event-body">
        <div className="event-top">
          <span className="event-status">{t(statusKey)}</span>
        </div>
        <h3 className="event-title">{ev.title}</h3>
        <div className="event-meta">
          {when && <span className="meta-item">{when}</span>}
          {ev.address && (
            <span className="meta-item">
              <Icon name="map-pin" size={12} />
              {ev.address}
            </span>
          )}
        </div>
        {showQr && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-primary" href={`#/ticket?event_id=${encodeURIComponent(ev.id)}`} onClick={onOpenTicket(ev.id)}>
              <Icon name="external" />
              {t('reg.qr.button')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({
  ev,
  past,
  registered,
  canScan,
  inTelegram,
  onRegister,
}: {
  ev: CatalogEvent;
  past: boolean;
  registered: boolean;
  canScan: boolean;
  inTelegram: boolean;
  onRegister: (ev: CatalogEvent) => (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const p = utcToPlate(ev.startsAt);
  const when = utcToWhen(ev.startsAt);
  // Кнопка не показывается после дедлайна — но решает всё равно сервер
  // (reg-api перепроверяет срок: опоздавший запрос получает понятный отказ).
  const deadlineMs = utcMs(ev.regDeadlineAt);
  const deadlineOpen = !isFinite(deadlineMs) || deadlineMs > Date.now();
  const action = !past && (registered ? 'qr' : ev.registerLink && deadlineOpen ? 'register' : '');
  // Вкладка «Прошедшие» показывает завершённые: статус `finished` в таблице
  // ставит ещё не собранный lifecycle (W12), а событие уже прошло — выводим
  // его из времени, чтобы не показывать «опубликован» на прошедшем ивенте.
  const statusKey = past ? 'status.finished' : 'status.published';
  return (
    <div className={`event-card${past ? ' past' : ''}`}>
      <div className="date-plate">
        <span className="month">{p.month}</span>
        <span className="day">{p.day}</span>
        <span className="weekday">{p.weekday}</span>
      </div>
      <div className="event-body">
        <div className="event-top">
          <span className="event-status">{t(statusKey)}</span>
        </div>
        <h3 className="event-title">{ev.title}</h3>
        <div className="event-meta">
          {when && <span className="meta-item">{when}</span>}
          {ev.address && (
            <span className="meta-item">
              <Icon name="map-pin" size={12} />
              {ev.address}
            </span>
          )}
        </div>
        {action === 'qr' && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-primary" id="ticket" href={`#/ticket?event_id=${encodeURIComponent(ev.id)}`}>
              <Icon name="external" />
              {t('reg.qr.button')}
            </a>
          </div>
        )}
        {action === 'register' && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-primary" id="register" href={ev.registerLink} onClick={onRegister(ev)}>
              <Icon name="external" />
              {t('event.card.btn_register')}
            </a>
          </div>
        )}
        {/* W50 (вердикт W49): сканер — рядом с ивентом, видно только
            контролёру (canScan — из staff-events-api, решает сервер). */}
        {canScan && !past && (
          <div className="app-actions" style={{ marginTop: 8 }}>
            <a className="btn btn-secondary" id="scan" href={`#/scan?event_id=${encodeURIComponent(ev.id)}`}>
              {t('menu.btn.scanner')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function RegistrationSheet({
  ev,
  pdn,
  mkt,
  busy,
  error,
  done,
  onPdn,
  onMkt,
  onSubmit,
  onTicket,
}: {
  ev: CatalogEvent;
  pdn: boolean;
  mkt: boolean;
  busy: boolean;
  error: string;
  done: boolean;
  onPdn: () => void;
  onMkt: () => void;
  onSubmit: () => void;
  onTicket: () => void;
}) {
  const when = utcToWhen(ev.startsAt);
  if (done) {
    return (
      <>
        <div className="sheet-success" id="reg-done">
          <div className="success-icon">
            <Icon name="check-circle" size={34} />
          </div>
          <div className="success-title">{t('reg.done.header')}</div>
          <div className="app-muted">{t('reg.done.hint')}</div>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-primary btn-lg" id="reg-ticket" onClick={onTicket}>
            <Icon name="external" />
            {t('reg.qr.button')}
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="card-title">{ev.title}</div>
      <div className="app-muted">{when}{ev.address ? ' · ' + ev.address : ''}</div>
      <label className="control-row" htmlFor="reg-pdn">
        <input id="reg-pdn" type="checkbox" className="checkbox" checked={pdn} onChange={onPdn} />
        <span>{t('reg.pdn.label')}</span>
      </label>
      <label className="control-row" htmlFor="reg-mkt">
        <input id="reg-mkt" type="checkbox" className="checkbox" checked={mkt} onChange={onMkt} />
        <span>{t('reg.mkt.label')}</span>
      </label>
      <div className="helper">{t('reg.mkt.hint')}</div>
      {error && (
        <div className="card result bad" id="reg-error">
          <p className="empty-heading">{error}</p>
        </div>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-lg" id="reg-submit" disabled={!pdn || busy} aria-busy={busy} onClick={onSubmit}>
          {t('event.card.btn_register')}
        </button>
      </div>
    </>
  );
}
