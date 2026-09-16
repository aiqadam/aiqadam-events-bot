import { useEffect, useState, lazy, Suspense } from 'react';
import Ticket from './routes/Ticket';
import Scan from './routes/Scan';

// ticket+scan — один чанк (статические импорты), manage — lazy (отдельный чанк), qrcode — lazy внутри Ticket
const Manage = lazy(() => import('./routes/Manage'));
const Events = lazy(() => import('./routes/Events'));

type Route =
  | { name: 'ticket'; eventId: string }
  | { name: 'scan'; eventId: string }
  | { name: 'manage'; eventId: string }
  | { name: 'events'; tab: 'mine' | 'upcoming' | 'past' }
  | { name: 'notfound'; hash: string };

function parseHash(hash: string): Route {
  // hash like "#/ticket?event_id=abc" or "#/manage/abc123" or "#/manage" or ""
  const raw = hash.startsWith('#') ? hash.slice(1) : hash; // "/ticket?event_id=..."
  if (!raw || raw === '/') {
    return { name: 'notfound', hash: hash || '' };
  }
  const [pathPart, queryPart] = raw.split('?');
  const search = new URLSearchParams(queryPart || '');
  const getEventId = () => search.get('event_id') || '';

  if (pathPart === '/ticket' || pathPart === '/ticket/') {
    return { name: 'ticket', eventId: getEventId() };
  }
  if (pathPart === '/scan' || pathPart === '/scan/') {
    return { name: 'scan', eventId: getEventId() };
  }
  if (pathPart === '/manage' || pathPart === '/manage/') {
    // also support legacy ?event_id
    const q = getEventId();
    return { name: 'manage', eventId: q || '' };
  }
  if (pathPart.startsWith('/manage/')) {
    const id = pathPart.slice('/manage/'.length).split('/')[0] || '';
    return { name: 'manage', eventId: id };
  }
  if (pathPart === '/events' || pathPart === '/events/') {
    // W38/W43: каталог; `?tab=past` открывает прошедшие, `?tab=mine` — «Мои билеты»,
    // без параметра — «Мои билеты» первым табом (вердикт W41, прототип).
    const q = search.get('tab');
    const tab = q === 'past' ? 'past' : q === 'upcoming' ? 'upcoming' : 'mine';
    return { name: 'events', tab };
  }
  // legacy support: ticket.html?event_id= etc — если кто-то открыл старый URL без hash, hash будет пустой, но location.search содержит event_id
  // Мы не можем отличить, но App может проверить location.search как fallback для ticket/scan
  return { name: 'notfound', hash };
}

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const route = parseHash(hash);

  // Если пустой hash но есть search ?event_id — попробуем угадать (legacy ticket link)
  // Это не хэш-роут, но для совместимости покажем билет
  if (route.name === 'notfound' && !hash) {
    const qs = new URLSearchParams(window.location.search);
    const eid = qs.get('event_id');
    if (eid) {
      // считаем что хотели ticket
      return (
        <Suspense fallback={<p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>Загрузка…</p>}>
          <Ticket eventId={eid} />
        </Suspense>
      );
    }
    // иначе покажем подсказку с навигацией
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <div className="card">
          <h1 className="empty-heading">AI Qadam Events</h1>
          <p className="empty-desc">Откройте экран по кнопке из бота.</p>
          <p className="empty-desc" style={{ marginTop: 12 }}>
            <a className="btn btn-secondary" href="#/events">Афиша</a>{' '}
            <a className="btn btn-secondary" href="#/ticket">Билет</a>{' '}
            <a className="btn btn-secondary" href="#/scan">Сканер</a>{' '}
            <a className="btn btn-secondary" href="#/manage">Форма</a>
          </p>
        </div>
      </main>
    );
  }

  if (route.name === 'notfound') {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <div className="card">
          <h1 className="empty-heading">Страница не найдена</h1>
          <p className="empty-desc">Проверьте ссылку. Доступные экраны:</p>
          <p className="empty-desc">
            <a className="btn btn-secondary" href="#/events">Афиша</a>{' '}
            <a className="btn btn-secondary" href="#/ticket">Билет</a>{' '}
            <a className="btn btn-secondary" href="#/scan">Сканер</a>{' '}
            <a className="btn btn-secondary" href="#/manage">Форма</a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<p className="empty-desc" style={{ textAlign: 'center', padding: 32 }}>Загрузка…</p>}>
      {route.name === 'ticket' && <Ticket eventId={route.eventId} />}
      {route.name === 'scan' && <Scan eventId={route.eventId} />}
      {route.name === 'manage' && <Manage eventId={route.eventId} />}
      {route.name === 'events' && <Events tab={route.tab} />}
    </Suspense>
  );
}
