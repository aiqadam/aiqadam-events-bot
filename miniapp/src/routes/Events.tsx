import { useEffect, useState, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { postJson, EVENTS_API } from '../lib/api';
import { utcToPlate, utcToWhen } from '../lib/dates';
import Icon from '../components/Icon';

// W38: каталог `#/events` — PAR-3 экраном (ADR-0023). Данные отдаёт events-api
// без initData (афиша публична); тап по ивенту уводит в чат по deep link
// из registerLink — регистрацию и согласия несёт reg-start, не эта страница.

type CatalogEvent = {
  id: string;
  title: string;
  address: string;
  startsAt: string;
  endsAt: string;
  status: string;
  registerLink: string;
};

export type EventsTab = 'upcoming' | 'past';

export default function Events({ tab: routeTab }: { tab: EventsTab }) {
  const [dictLoaded, setDictLoaded] = useState(false);
  const [tab, setTab] = useState<EventsTab>(routeTab);
  const [upcoming, setUpcoming] = useState<CatalogEvent[]>([]);
  const [past, setPast] = useState<CatalogEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadfail, setLoadfail] = useState('');

  const load = useCallback(async () => {
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
    setLoaded(true);
  }, []);

  useEffect(() => {
    setupThemeListener();
    const tg = getTelegram();
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {}
    }
    void loadI18n().then(() => setDictLoaded(true));
    void load();
  }, [load]);

  useEffect(() => {
    if (dictLoaded) document.title = t(tab === 'past' ? 'events.list.past_title' : 'events.list.upcoming_title');
  }, [dictLoaded, tab]);

  // Таб живёт в hash — W43 откроет «Мои билеты» диплинком `#/events?tab=mine`.
  // replaceState, а не hashchange: переключение не перерисовывает приложение целиком.
  const switchTab = useCallback((key: EventsTab) => {
    setTab(key);
    try {
      history.replaceState(null, '', '#/events?tab=' + key);
    } catch {}
  }, []);

  const openRegister = useCallback(
    (url: string) => (e: MouseEvent<HTMLAnchorElement>) => {
      const tg = getTelegram();
      if (tg && typeof tg.openTelegramLink === 'function') {
        e.preventDefault();
        tg.openTelegramLink(url);
      }
    },
    [],
  );

  const items = tab === 'past' ? past : upcoming;
  const titleKey = tab === 'past' ? 'events.list.past_title' : 'events.list.upcoming_title';
  const emptyKey = tab === 'past' ? 'events.list.empty_past' : 'events.list.empty_upcoming';

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1 className="empty-heading" id="title">
        {dictLoaded ? t(titleKey) : ''}
      </h1>

      <div className="tabs" id="events-tabs" style={{ marginBottom: 16 }}>
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
          <button type="button" className="btn btn-secondary" id="retry" onClick={() => void load()}>
            {t('manage.btn.retry')}
          </button>
        </div>
      )}

      {!loadfail && !loaded && (
        <p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>
          {dictLoaded ? t('events.loading') : ''}
        </p>
      )}

      {!loadfail && loaded && items.length === 0 && (
        <div className="empty-state" id="events-empty">
          <div className="empty-icon">
            <Icon name="calendar" size={22} />
          </div>
          <div className="empty-heading">{t(emptyKey)}</div>
        </div>
      )}

      {!loadfail && loaded && items.length > 0 && (
        <ul id="events-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {items.map((ev, i) => (
            <li key={ev.id || String(i)}>
              <EventCard ev={ev} past={tab === 'past'} onRegister={openRegister} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EventCard({ ev, past, onRegister }: { ev: CatalogEvent; past: boolean; onRegister: (url: string) => (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const p = utcToPlate(ev.startsAt);
  const when = utcToWhen(ev.startsAt);
  const registerable = !past && Boolean(ev.registerLink);
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
        {registerable && (
          <div className="app-actions" style={{ marginTop: 0 }}>
            <a className="btn btn-primary" id="register" href={ev.registerLink} onClick={onRegister(ev.registerLink)}>
              <Icon name="external" />
              {t('event.card.btn_register')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
