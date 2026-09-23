import { useEffect, useState, useCallback, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram, hapticImpact, hapticNotification } from '../lib/telegram';
import { useBackButton } from '../lib/useBackButton';
import { setupThemeListener } from '../lib/theme';
import { postJson, EVENTS_API, REG_API, STAFF_EVENTS_API } from '../lib/api';
import { utcToPlate, utcToWhen, utcMs } from '../lib/dates';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';
import Toast, { useToast } from '../components/Toast';

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

export type EventsTab = 'mine' | 'upcoming' | 'past' | 'profile';

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
  // W50 / PAR-8: профиль для шита регистрации и таба «Профиль».
  const [profile, setProfile] = useState({ first: '', last: '', position: '', company: '', city: '' });
  // W60: согласие на рассылку — таб «Профиль» позволяет переключить его без
  // новой регистрации (чат больше не переспрашивает при повторной записи).
  const [profileMkt, setProfileMkt] = useState(false);
  const [profileState, setProfileState] = useState<MineState>(inTelegram ? 'loading' : 'off');
  const [profileMsg, setProfileMsg] = useState('');
  const [pdnDone, setPdnDone] = useState('');
  // W73 (#125, ADR-0039): самоудаление аккаунта — только свой, по initData.
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // Шит регистрации: поля профиля (видны, пока профиль неполон).
  const [sheetProf, setSheetProf] = useState({ first: '', last: '', position: '', company: '', city: '' });
  const [profileNeeded, setProfileNeeded] = useState(false);
  // W50 (вердикт W49): сканер — рядом с событием, видно только контролёру.
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

  // W65/PAR-9: «Поделиться событием» — обычный пользователь отправляет ссылку
  // регистрации (OWN-6; сервер уже отдаёт её карточке как `registerLink`)
  // в Telegram или копирует. Ссылка — текстом на экране, а не системный share
  // (MINIAPP-UX п. 7), поэтому действия живут в шите.
  const [shareEvent, setShareEvent] = useState<CatalogEvent | null>(null);
  const { toast, showToast } = useToast();

  const loadEvents = useCallback(async () => {
    setLoadfail('');
    const res = await postJson(EVENTS_API, {});
    if (res.kind === 'network') {
      hapticNotification('error');
      setLoadfail(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
      setLoadfail(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (!d['ok'] || !Array.isArray(d['upcoming']) || !Array.isArray(d['past'])) {
      hapticNotification('error');
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
      hapticNotification('error');
      setMineState('error');
      setMineError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
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
    hapticNotification('error');
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

  const loadProfile = useCallback(async () => {
    if (!inTelegram) return;
    setProfileState('loading');
    const res = await postJson(REG_API, { action: 'profile_get', initData });
    if (res.kind !== 'json' || !res.data['ok']) {
      hapticNotification('error');
      setProfileState('error');
      return;
    }
    const p = (res.data['profile'] || {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    setProfile({ first: s(p['first']), last: s(p['last']), position: s(p['position']), company: s(p['company']), city: s(p['city']) });
    setProfileMkt(Boolean(res.data['consentMarketing']));
    setPdnDone(s(res.data['pdnDone']));
    setProfileState('ready');
  }, [inTelegram, initData]);

  const saveProfile = useCallback(async () => {
    setProfileMsg('');
    const res = await postJson(REG_API, {
      action: 'profile_save',
      initData,
      profileFirst: profile.first,
      profileLast: profile.last,
      profilePosition: profile.position,
      profileCompany: profile.company,
      profileCity: profile.city,
      consentMarketing: profileMkt,
    });
    if (res.kind !== 'json' || !res.data['ok']) {
      const d = res.kind === 'json' ? (res.data as Record<string, unknown>) : null;
      hapticNotification('error');
      setProfileMsg(d && typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('events.err.server'));
      return;
    }
    const p = (res.data['profile'] || {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    setProfile({ first: s(p['first']), last: s(p['last']), position: s(p['position']), company: s(p['company']), city: s(p['city']) });
    setProfileMkt(Boolean(res.data['consentMarketing']));
    setProfileMsg(t('manage.saved.updated'));
  }, [initData, profile, profileMkt]);

  // W73 (#125, ADR-0039): удаление своего аккаунта — сервер берёт telegram_id
  // из initData, тело чужой id не удаляет. Подтверждение обязательно (confirm).
  const deleteAccount = useCallback(async () => {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    const res = await postJson(REG_API, { action: 'delete_account', initData, confirm: true });
    setDeleteBusy(false);
    if (res.kind === 'network') {
      hapticNotification('error');
      setDeleteError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
      setDeleteError(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (d['ok']) {
      hapticNotification('success');
      setDeleteSheet(false);
      setProfile({ first: '', last: '', position: '', company: '', city: '' });
      setProfileMkt(false);
      setPdnDone('');
      setProfileMsg(t('profile.delete.done'));
      showToast(t('profile.delete.done'));
      void loadMine();
      return;
    }
    hapticNotification('error');
    setDeleteError(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('profile.delete.failed'));
  }, [deleteBusy, initData, loadMine, showToast]);

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
    void loadProfile();
  }, [tg, loadEvents, loadMine, loadStaffEvents, loadProfile]);

  useEffect(() => {
    if (dictLoaded) {
      const key = tab === 'mine' ? 'events.tab.mine' : tab === 'past' ? 'events.list.past_title' : 'events.list.upcoming_title';
      document.title = t(key);
    }
  }, [dictLoaded, tab]);

  // Таб живёт в hash — диплинк `#/events?tab=…` (кнопки меню W43).
  // W51: вход из бота (`#/events` без таба = «Мои билеты») при уже открытом
  // каталоге обязан переключать таб — routeTab синхронизируется, а не только
  // читается на монтировании.
  useEffect(() => {
    setTab(routeTab);
  }, [routeTab]);
  const switchTab = useCallback((key: EventsTab) => {
    hapticImpact('light');
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
  // Повтор даёт QR, а не отказ: reg-api проверяет existing раньше гейтов (ревью W50).
  const registeredIds = useMemo(() => {
    const set: Record<string, boolean> = {};
    mine.forEach((r) => {
      if (r.status === 'registered' || r.status === 'checked_in') set[r.eventId] = true;
    });
    return set;
  }, [mine]);

  // Прошлое событие с чекином — вход на отзыв (прототип ticketRow/eventCardEl).
  const attendedIds = useMemo(() => {
    const set: Record<string, boolean> = {};
    mine.forEach((r) => {
      if (r.checkedInAt) set[r.eventId] = true;
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
    // Шит знает профиль: заполнен — не показываем поля, нет — предзаполняем
    // сохранённым и просим дописать (сервер примет вместе с регистрацией).
    setSheetProf({ ...profile });
    setProfileNeeded(profile.first === '' || profile.last === '' || profile.position === '' || profile.city === '');
  }, [profile]);

  const closeSheet = useCallback(() => {
    setSheetEvent(null);
  }, []);

  const closeShare = useCallback(() => {
    setShareEvent(null);
  }, []);

  // Копирование ссылки — тост «Скопировано» (эталон); буфер недоступен —
  // показываем саму ссылку, чтобы её можно было скопировать руками (как manage).
  const copyLink = useCallback(
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

  const openShare = useCallback((ev: CatalogEvent) => {
    hapticImpact('light');
    setShareEvent(ev);
  }, []);

  // W47: нативная «Назад» на корневом каталоге скрыта; при открытом шите
  // (регистрации или «поделиться») закрывает шит, а не весь Mini App.
  useBackButton(Boolean(sheetEvent) || Boolean(shareEvent) || deleteSheet, () => {
    if (deleteSheet) {
      setDeleteSheet(false);
      return;
    }
    if (shareEvent) closeShare();
    else closeSheet();
  });

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
      profileFirst: sheetProf.first,
      profileLast: sheetProf.last,
      profilePosition: sheetProf.position,
      profileCompany: sheetProf.company,
      profileCity: sheetProf.city,
    });
    setSheetBusy(false);
    if (res.kind === 'network') {
      hapticNotification('error');
      setSheetError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
      setSheetError(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (d['ok']) {
      hapticNotification('success');
      // IDM-1: повтор даёт тот же результат — «уже зарегистрированы», без второго подтверждения.
      setSheetDone(true);
      void loadMine();
      void loadProfile();
      return;
    }
    if (d['error'] === 'profile_required') setProfileNeeded(true);
    hapticNotification('error');
    setSheetError(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('events.err.server'));
  }, [sheetEvent, sheetBusy, initData, mkt, sheetProf, loadMine, loadProfile]);

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

  // W51: заголовка над табами нет — как в прототипе (renderEvents: сразу
  // табы, активный таб и есть название экрана). document.title — для истории.
  const tabTitle =
    tab === 'mine'
      ? 'events.tab.mine'
      : tab === 'past'
        ? 'events.list.past_title'
        : tab === 'profile'
          ? 'profile.tab'
          : 'events.list.upcoming_title';
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
        <button type="button" className={`tab${tab === 'profile' ? ' active' : ''}`} id="tab-profile" onClick={() => switchTab('profile')}>
          {dictLoaded ? t('profile.tab') : ''}
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
          onShare={openShare}
        />
      )}

      {!loadfail && tab === 'profile' && (
        <ProfileTab
          dictLoaded={dictLoaded}
          inTelegram={inTelegram}
          state={profileState}
          profile={profile}
          mkt={profileMkt}
          pdnDone={pdnDone}
          msg={profileMsg}
          onChange={(k, v) => {
            setProfile((p) => ({ ...p, [k]: v }));
            setProfileMsg('');
          }}
          onMktChange={() => {
            setProfileMkt((v) => !v);
            setProfileMsg('');
          }}
          onSave={() => void saveProfile()}
          onDelete={() => {
            setDeleteError('');
            setDeleteSheet(true);
          }}
        />
      )}

      {!loadfail && (tab === 'upcoming' || tab === 'past') && !eventsLoaded && (
        <p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>
          {dictLoaded ? t('events.loading') : ''}
        </p>
      )}

      {!loadfail && (tab === 'upcoming' || tab === 'past') && eventsLoaded && (tab === 'upcoming' ? upcoming : past).length === 0 && (
        <div className="empty-state" id="events-empty">
          <div className="empty-icon">
            <Icon name="calendar" size={22} />
          </div>
          <div className="empty-heading">{t(tab === 'past' ? 'events.list.empty_past' : 'events.list.empty_upcoming')}</div>
        </div>
      )}

      {!loadfail && (tab === 'upcoming' || tab === 'past') && eventsLoaded && (tab === 'upcoming' ? upcoming : past).length > 0 && (
        <ul id="events-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(tab === 'upcoming' ? upcoming : past).map((ev, i) => (
            <li key={ev.id || String(i)}>
              <EventCard
                ev={ev}
                past={tab === 'past'}
                registered={Boolean(registeredIds[ev.id])}
                attended={Boolean(attendedIds[ev.id])}
                canScan={Boolean(staffIds[ev.id])}
                inTelegram={inTelegram}
                onRegister={openRegister}
                onShare={openShare}
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
            profileNeeded={profileNeeded}
            prof={sheetProf}
            onProf={(k, v) => setSheetProf((p) => ({ ...p, [k]: v }))}
            onPdn={() => setPdn(!pdn)}
            onMkt={() => setMkt(!mkt)}
            onSubmit={() => void submitRegistration()}
            onTicket={openTicket(sheetEvent.id)}
          />
        )}
      </Sheet>

      <Sheet open={Boolean(shareEvent)} title={t('events.share.title')} onClose={closeShare}>
        {shareEvent && <ShareSheet ev={shareEvent} onCopy={copyLink} />}
      </Sheet>

      {/* W73 (#125, ADR-0039): подтверждение удаления аккаунта. Разрушительная
          кнопка — не первая и только после явного подтверждения. */}
      <Sheet open={deleteSheet} title={t('profile.delete.title')} onClose={() => setDeleteSheet(false)}>
        <p className="app-muted">{t('profile.delete.confirm')}</p>
        {deleteError && (
          <div className="card result bad" id="delete-error">
            <p className="empty-heading">{deleteError}</p>
          </div>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-destructive" id="profile-delete-yes" disabled={deleteBusy} aria-busy={deleteBusy} onClick={() => void deleteAccount()}>
            {t('profile.delete.btn')}
          </button>
          <button type="button" className="btn btn-secondary" id="profile-delete-no" onClick={() => setDeleteSheet(false)}>
            {t('profile.delete.cancel')}
          </button>
        </div>
      </Sheet>

      {toast && <Toast text={toast} />}
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
  onShare,
}: {
  dictLoaded: boolean;
  inTelegram: boolean;
  state: MineState;
  error: string;
  rows: { row: MineRow; ev: CatalogEvent | undefined }[];
  onRetry: () => void;
  onOpenTicket: (eventId: string) => () => void;
  onShare: (ev: CatalogEvent) => void;
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
          <MineCard row={row} ev={ev as CatalogEvent} onOpenTicket={onOpenTicket} onShare={onShare} />
        </li>
      ))}
    </ul>
  );
}

function MineCard({
  row,
  ev,
  onOpenTicket,
  onShare,
}: {
  row: MineRow;
  ev: CatalogEvent;
  onOpenTicket: (eventId: string) => () => void;
  onShare: (ev: CatalogEvent) => void;
}) {
  const p = utcToPlate(ev.startsAt);
  const when = utcToWhen(ev.startsAt);
  // W51: билет живёт до конца события, а не до старта — иначе в дверях зала
  // (событие уже начался) QR открыть нельзя. Прошлое с чекином ведёт на отзыв.
  const endMs = utcMs(ev.endsAt || ev.startsAt);
  const ended = isFinite(endMs) ? endMs <= Date.now() : false;
  const attended = row.checkedInAt !== '';
  const statusKey = row.status === 'checked_in' ? 'myreg.status.checked_in' : 'myreg.status.registered';
  const showQr = !ended;
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
            <button type="button" className="btn btn-outline" id="share" onClick={() => onShare(ev)}>
              <Icon name="share" />
              {t('manage.btn.share')}
            </button>
          </div>
        )}
        {!showQr && attended && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-outline" href={`#/feedback?event_id=${encodeURIComponent(ev.id)}`}>
              {t('afterword.feedback_btn')}
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
  attended,
  canScan,
  inTelegram,
  onRegister,
  onShare,
}: {
  ev: CatalogEvent;
  past: boolean;
  registered: boolean;
  attended: boolean;
  canScan: boolean;
  inTelegram: boolean;
  onRegister: (ev: CatalogEvent) => (e: MouseEvent<HTMLAnchorElement>) => void;
  onShare: (ev: CatalogEvent) => void;
}) {
  const p = utcToPlate(ev.startsAt);
  const when = utcToWhen(ev.startsAt);
  // Кнопка не показывается после дедлайна — но решает всё равно сервер
  // (reg-api перепроверяет срок: опоздавший запрос получает понятный отказ).
  const deadlineMs = utcMs(ev.regDeadlineAt);
  const deadlineOpen = !isFinite(deadlineMs) || deadlineMs > Date.now();
  // W51: зарегистрированному — всегда QR (повтор даёт QR, а не profile_required);
  // с закрытым дедлайном — объяснение вместо пустого места; прошлое с чекином —
  // отзыв (прототип eventCardEl).
  const action =
    past
      ? attended
        ? 'feedback'
        : ''
      : registered
        ? 'qr'
        : ev.registerLink && deadlineOpen
          ? 'register'
          : ev.registerLink
            ? 'closed'
            : '';
  // Вкладка «Прошедшие» показывает завершённые: статус `finished` в таблице
  // ставит ещё не собранный lifecycle (W12), а событие уже прошло — выводим
  // его из времени, чтобы не показывать «опубликован» на прошедшем событии.
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
        {action === 'closed' && (
          <div className="app-muted" id="reg-closed" style={{ marginTop: 8 }}>
            {t('reg.deadline_passed', { when: utcToWhen(ev.regDeadlineAt) })}
          </div>
        )}
        {action === 'feedback' && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-outline" id="feedback" href={`#/feedback?event_id=${encodeURIComponent(ev.id)}`}>
              {t('afterword.feedback_btn')}
            </a>
          </div>
        )}
        {/* W50 (вердикт W49): сканер — рядом с событием, видно только
            контролёру (canScan — из staff-events-api, решает сервер). */}
        {canScan && !past && (
          <div className="app-actions" style={{ marginTop: 8 }}>
            <a className="btn btn-secondary" id="scan" href={`#/scan?event_id=${encodeURIComponent(ev.id)}`}>
              {t('menu.btn.scanner')}
            </a>
          </div>
        )}
        {/* PAR-9/W65: поделиться событием доступно обычному пользователю;
            на прошедшем события ссылка регистрации смысла не несёт. */}
        {!past && (
          <div className="app-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-outline" id="share" onClick={() => onShare(ev)}>
              <Icon name="share" />
              {t('manage.btn.share')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// W65/PAR-9: шит «Поделиться событием». Ссылка — текстом на экране, действия
// «Скопировать» и «Поделиться» (t.me/share/url) — как у овнера в manage
// (MINIAPP-UX п. 7: система не даёт надёжного inline-шаринга из WebView).
function ShareSheet({ ev, onCopy }: { ev: CatalogEvent; onCopy: (url: string) => void }) {
  const when = utcToWhen(ev.startsAt);
  const link = ev.registerLink;
  const shareHref = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(ev.title)}`;
  return (
    <>
      <div className="card-title">{ev.title}</div>
      <div className="app-muted">
        {when}
        {ev.address ? ' · ' + ev.address : ''}
      </div>
      <div className="invite-link" id="share-link">
        {link}
      </div>
      <p className="app-muted">{t('events.share.hint')}</p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-lg" id="share-copy" onClick={() => onCopy(link)}>
          <Icon name="copy" />
          {t('manage.btn.copy')}
        </button>
        <a className="btn btn-outline" id="share-tg" href={shareHref} target="_blank" rel="noopener noreferrer">
          <Icon name="share" />
          {t('manage.btn.share')}
        </a>
      </div>
    </>
  );
}

function ProfileTab({
  dictLoaded,
  inTelegram,
  state,
  profile,
  mkt,
  pdnDone,
  msg,
  onChange,
  onMktChange,
  onSave,
  onDelete,
}: {
  dictLoaded: boolean;
  inTelegram: boolean;
  state: MineState;
  profile: { first: string; last: string; position: string; company: string; city: string };
  mkt: boolean;
  pdnDone: string;
  msg: string;
  onChange: (k: 'first' | 'last' | 'position' | 'company' | 'city', v: string) => void;
  onMktChange: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  if (!inTelegram) {
    return (
      <div className="card result bad">
        <div className="empty-heading">{t('ticket.not_in_telegram')}</div>
      </div>
    );
  }
  if (state === 'loading' || !dictLoaded) {
    return (
      <p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>
        {t('events.loading')}
      </p>
    );
  }
  if (state === 'error') {
    return (
      <div className="card result bad">
        <div className="empty-heading">{t('events.err.server')}</div>
      </div>
    );
  }
  const field = (
    id: string,
    label: string,
    k: 'first' | 'last' | 'position' | 'company' | 'city',
    hint?: string,
  ) => (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        className="input"
        id={id}
        type="text"
        autoComplete="off"
        value={profile[k]}
        onChange={(e) => onChange(k, e.target.value)}
      />
      {hint && <div className="helper">{hint}</div>}
    </div>
  );
  return (
    <div className="form-section">
      <p className="app-muted">{t('profile.head_note')}</p>
      {field('pf-first', t('profile.first'), 'first')}
      {field('pf-last', t('profile.last'), 'last')}
      {field('pf-position', t('profile.position'), 'position')}
      {field('pf-company', t('profile.company'), 'company', t('profile.company_hint'))}
      {field('pf-city', t('profile.city'), 'city')}
      <label className="control-row" htmlFor="pf-mkt">
        <input id="pf-mkt" type="checkbox" className="checkbox" checked={mkt} onChange={onMktChange} />
        <span>{t('reg.mkt.label')}</span>
      </label>
      {pdnDone && <p className="helper">{pdnDone}</p>}
      {msg && (
        <p className="helper" role="status">
          {msg}
        </p>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-lg" id="profile-save" onClick={onSave}>
          {t('manage.btn.save')}
        </button>
      </div>
      {/* W73 (#125, ADR-0039): самоудаление аккаунта (GDPR) — внизу, после
          сохранения, разрушительная кнопка не первая. */}
      <div className="app-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-destructive btn-block" id="profile-delete" onClick={onDelete}>
          {t('profile.delete.btn')}
        </button>
      </div>
      <p className="helper">{t('profile.delete.hint')}</p>
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
  profileNeeded,
  prof,
  onProf,
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
  profileNeeded: boolean;
  prof: { first: string; last: string; position: string; company: string; city: string };
  onProf: (k: 'first' | 'last' | 'position' | 'company' | 'city', v: string) => void;
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
      {profileNeeded && (
        <>
          <div className="field">
            <label className="label" htmlFor="reg-first">
              {t('profile.first')}
            </label>
            <input id="reg-first" className="input" type="text" autoComplete="off" value={prof.first} onChange={(e) => onProf('first', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="reg-last">
              {t('profile.last')}
            </label>
            <input id="reg-last" className="input" type="text" autoComplete="off" value={prof.last} onChange={(e) => onProf('last', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="reg-position">
              {t('profile.position')}
            </label>
            <input id="reg-position" className="input" type="text" autoComplete="off" value={prof.position} onChange={(e) => onProf('position', e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="reg-company">
              {t('profile.company')}
            </label>
            <input id="reg-company" className="input" type="text" autoComplete="off" value={prof.company} onChange={(e) => onProf('company', e.target.value)} />
            <div className="helper">{t('profile.company_hint')}</div>
          </div>
          <div className="field">
            <label className="label" htmlFor="reg-city">
              {t('profile.city')}
            </label>
            <input id="reg-city" className="input" type="text" autoComplete="off" value={prof.city} onChange={(e) => onProf('city', e.target.value)} />
          </div>
        </>
      )}
      {profileNeeded && (
        <>
          <label className="control-row" htmlFor="reg-pdn">
            <input id="reg-pdn" type="checkbox" className="checkbox" checked={pdn} onChange={onPdn} />
            <span>{t('reg.pdn.label')}</span>
          </label>
          <label className="control-row" htmlFor="reg-mkt">
            <input id="reg-mkt" type="checkbox" className="checkbox" checked={mkt} onChange={onMkt} />
            <span>{t('reg.mkt.label')}</span>
          </label>
          <div className="helper">{t('reg.mkt.hint')}</div>
        </>
      )}
      {error && (
        <div className="card result bad" id="reg-error">
          <p className="empty-heading">{error}</p>
        </div>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-lg" id="reg-submit" disabled={(profileNeeded && !pdn) || busy} aria-busy={busy} onClick={onSubmit}>
          {t('event.card.btn_register')}
        </button>
      </div>
    </>
  );
}
