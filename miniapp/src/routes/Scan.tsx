import { useEffect, useRef, useState, useCallback } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { CHECKIN_API, CHECKIN_COUNTER_API } from '../lib/api';
import Icon, { type IconName } from '../components/Icon';

const RESULT_MS = 1600;

// Вердикт: тон, иконка и подпись — как в прототипе (`renderScan`).
const VERDICT: Record<string, { tone: string; icon: IconName; sub?: string }> = {
  ok: { tone: 'ok', icon: 'check-circle', sub: 'checkin.sub_ok' },
  already: { tone: 'warn', icon: 'clock', sub: 'checkin.sub_already' },
  wrong_event: { tone: 'bad', icon: 'alert', sub: 'checkin.sub_denied' },
  not_registered: { tone: 'bad', icon: 'x-circle', sub: 'checkin.sub_denied' },
  invalid: { tone: 'bad', icon: 'alert', sub: 'checkin.sub_denied' },
};

type View =
  | { kind: 'verdict'; status: string; text: string; sub?: string }
  | { kind: 'error'; icon: IconName; text: string; sub?: string; retryable: boolean }
  | null;

export default function Scan({ eventId: propEventId }: { eventId: string }) {
  const eventIdRef = useRef(propEventId);

  const [title, setTitle] = useState('AI Qadam Events');
  const [statusKey, setStatusKey] = useState<string>('');
  const [view, setView] = useState<View>(null);
  const [paused, setPaused] = useState(false);
  const [rescanLabel, setRescanLabel] = useState('Продолжить');
  const [counters, setCounters] = useState<{ registered: number; checkedIn: number } | null>(null);

  const stoppedRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastPayloadRef = useRef('');
  const lastAtRef = useRef(0);

  const setStatus = useCallback((key: string) => setStatusKey(key), []);

  const showVerdict = useCallback((status: string, text: string) => {
    const v = VERDICT[status] || VERDICT.invalid;
    setView({ kind: 'verdict', status, text, sub: v.sub });
  }, []);

  const stopAll = useCallback((icon: IconName, text: string, retryable: boolean, sub?: string) => {
    stoppedRef.current = true;
    setStatusKey('');
    setView({ kind: 'error', icon, text, retryable, sub });
    const tg2 = getTelegram();
    if (tg2?.closeScanQrPopup) {
      try {
        tg2.closeScanQrPopup();
      } catch {}
    }
  }, []);

  const openScanner = useCallback(() => {
    if (stoppedRef.current) return;
    const tg2 = getTelegram();
    if (!tg2 || !tg2.showScanQrPopup) {
      stopAll('alert', t('scan.unsupported'), false);
      return;
    }
    setPaused(false);
    setStatus('scan.hint');
    try {
      // Подсказка под заголовком нативного сканера (Bot API 6.4+, до 64 символов).
      tg2.showScanQrPopup({ text: t('scan.hint') }, (...args: unknown[]) => {
        let err: string | null = null;
        let result: unknown = null;
        if (args.length === 2 && typeof args[0] === 'string') {
          err = args[0] as string;
          result = args[1];
        } else {
          result = args[0];
        }
        if (err || !result) return;
        let text = '';
        if (typeof result === 'string') text = result;
        else if (result && typeof result === 'object') {
          const r = result as Record<string, unknown>;
          text = String(r['text'] ?? r['data'] ?? '');
        }
        onScannedRef.current(text);
      });
    } catch {
      stopAll('alert', t('scan.unsupported'), false);
    }
  }, [setStatus, stopAll]);

  // onScanned defined after openScanner to avoid circular deps — use ref
  const onScannedRef = useRef<(text: string) => void>(() => {});
  const onScanned = useCallback(
    (text: string) => {
      if (!text || stoppedRef.current || inFlightRef.current) return;
      const now = Date.now();
      if (text === lastPayloadRef.current && now - lastAtRef.current < 1400) return;
      lastPayloadRef.current = text;
      lastAtRef.current = now;
      inFlightRef.current = true;
      const tg2 = getTelegram();
      if (tg2?.closeScanQrPopup) {
        try {
          tg2.closeScanQrPopup();
        } catch {}
      }
      setStatus('scan.checking');
      fetch(CHECKIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getTelegram()?.initData, eventId: eventIdRef.current, payload: text }),
      })
        .then((r) => r.json().then((d) => ({ http: r.status, body: d })))
        .then((res) => {
          const d = res.body as Record<string, unknown>;
          inFlightRef.current = false;
          if (!d || typeof d['text'] !== 'string') {
            stopAll('alert', t('scan.error_server'), true);
            return;
          }
          const st = (d['status'] as string) || '';
          if (st === 'invalid_init_data') {
            stopAll('clock', String(d['text']), false, 'scan.reopen_app');
          } else if (st === 'forbidden') {
            stopAll('shield', String(d['text']), false);
          } else {
            showVerdict(st || 'already', String(d['text']));
            if (st === 'ok') {
              setCounters((c) =>
                c ? { registered: c.registered, checkedIn: Math.min(c.registered, c.checkedIn + 1) } : c,
              );
            }
            setTimeout(() => {
              if (!stoppedRef.current) openScanner();
            }, RESULT_MS);
          }
        })
        .catch(() => {
          inFlightRef.current = false;
          stopAll('alert', t('scan.network_error'), true);
        });
    },
    [openScanner, showVerdict, stopAll],
  );
  onScannedRef.current = onScanned;

  const loadCounters = useCallback(async () => {
    const eid = eventIdRef.current;
    const tg2 = getTelegram();
    if (!eid || !tg2?.initData || !CHECKIN_COUNTER_API) return;
    try {
      const r = await fetch(CHECKIN_COUNTER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg2.initData, eventId: eid }),
      });
      const d = (await r.json()) as Record<string, unknown>;
      if (!d || d['ok'] !== true) return;
      const registered = Number(d['registered']);
      const checkedIn = Number(d['checked_in']);
      if (Number.isFinite(registered) && Number.isFinite(checkedIn)) {
        setCounters({ registered, checkedIn });
      }
    } catch {}
  }, []);

  const resume = useCallback(() => {
    stoppedRef.current = false;
    setPaused(false);
    setView(null);
    openScanner();
  }, [openScanner]);

  useEffect(() => {
    setupThemeListener();
  }, []);

  useEffect(() => {
    eventIdRef.current = propEventId;
  }, [propEventId]);

  useEffect(() => {
    void loadI18n().then((d) => {
      setTitle(d['scan.title'] || 'Сканер чекина');
      document.title = t('scan.title');
      setRescanLabel(t('scan.rescan'));

      const tg2 = getTelegram();
      if (!d || Object.keys(d).length === 0) {
        stopAll('alert', t('scan.network_error'), true);
        return;
      }
      if (!tg2 || !tg2.initData) {
        stopAll('alert', t('scan.not_in_telegram'), false);
        return;
      }
      const eid = propEventId || new URLSearchParams(window.location.hash.split('?')[1] || window.location.search).get('event_id') || '';
      if (!eid) {
        stopAll('calendar', t('scan.no_event'), false);
        return;
      }
      try {
        tg2.ready();
        tg2.expand();
      } catch {}
      if (tg2.onEvent) {
        tg2.onEvent('scanQrPopupClosed', () => {
          if (!stoppedRef.current && !inFlightRef.current) {
            stoppedRef.current = true;
            setStatusKey('');
            setPaused(true);
          }
        });
      }
      void loadCounters();
      openScanner();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = statusKey ? t(statusKey) : '';
  const progress =
    counters && counters.registered > 0 ? Math.round((counters.checkedIn / counters.registered) * 100) : 0;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1 className="empty-heading" id="title">
        {title}
      </h1>

      {view?.kind === 'verdict' && (
        <div className={`verdict ${view.status === 'ok' ? 'ok' : view.status === 'already' ? 'warn' : 'bad'}`} id="result" role="status">
          <span className="verdict-icon">
            <Icon name={VERDICT[view.status]?.icon || 'alert'} size={22} />
          </span>
          <div className="verdict-body">
            <div className="verdict-text" id="resultText">{view.text}</div>
            {view.sub && <div className="verdict-sub" id="resultSub">{t(view.sub)}</div>}
          </div>
        </div>
      )}

      {view?.kind === 'error' && (
        <div className="scan-state" id="result" role="status">
          <div className="state-icon">
            <Icon name={view.icon} size={24} />
          </div>
          <div className="state-title" id="resultText">{view.text}</div>
          {view.sub && <div className="empty-desc" id="resultSub">{t(view.sub)}</div>}
          <button
            className="btn btn-primary"
            id="errorAction"
            onClick={() => (view.retryable ? resume() : (window.location.hash = '#/events'))}
          >
            {view.retryable ? rescanLabel : t('common.btn.close')}
          </button>
        </div>
      )}

      <p className="empty-desc" id="status" style={{ minHeight: '1.5em' }}>
        {paused ? t('scan.hint') : statusText}
      </p>

      {counters && (
        <div className="scan-progress" id="progress">
          <div className="scan-progress-bar">
            <div className="scan-progress-fill" style={{ width: progress + '%' }} />
          </div>
          <div className="scan-progress-label">
            {t('checkin.counter', { checked_in: counters.checkedIn, registered: counters.registered })}
          </div>
        </div>
      )}

      {paused && (
        <button className="btn btn-primary btn-lg" id="rescan" onClick={resume}>
          {rescanLabel}
        </button>
      )}
    </main>
  );
}
