import { useEffect, useRef, useState, useCallback } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { CHECKIN_API } from '../lib/api';

const RESULT_MS = 1600;

const TONE: Record<string, string> = {
  ok: 'ok',
  already: 'warn',
  wrong_event: 'bad',
  not_registered: 'bad',
  invalid: 'bad',
  forbidden: 'bad',
  invalid_init_data: 'bad',
};

type ResultState = { tone: string; text: string; sub?: string } | null;

export default function Scan({ eventId: propEventId }: { eventId: string }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const eventIdRef = useRef(propEventId);

  const [title, setTitle] = useState('AI Qadam Events');
  const [statusKey, setStatusKey] = useState<string>(''); // key for t()
  const [statusRaw, setStatusRaw] = useState<string>(''); // raw text when needed? but we use t
  const [result, setResult] = useState<ResultState>(null);
  const [showRescan, setShowRescan] = useState(false);
  const [rescanLabel, setRescanLabel] = useState('Продолжить');

  const stoppedRef = useRef(false);
  const inFlightRef = useRef(false);
  const lastPayloadRef = useRef('');
  const lastAtRef = useRef(0);

  const setStatus = useCallback((key: string) => {
    setStatusKey(key);
    setStatusRaw('');
  }, []);

  const hideResult = useCallback(() => {
    setResult(null);
  }, []);

  const showResult = useCallback((status: string, text: string, subKey?: string) => {
    const tone = TONE[status] || 'bad';
    setResult({ tone, text, sub: subKey ? t(subKey) : undefined });
  }, []);

  const offerRescan = useCallback(() => {
    stoppedRef.current = false;
    setRescanLabel(t('scan.rescan'));
    setShowRescan(true);
  }, []);

  const stopAll = useCallback(
    (status: string, text: string, subKey?: string) => {
      stoppedRef.current = true;
      hideResult();
      showResult(status, text, subKey);
      setStatusKey('');
      setStatusRaw('');
      const tg2 = getTelegram();
      if (tg2?.closeScanQrPopup) {
        try {
          tg2.closeScanQrPopup();
        } catch {}
      }
    },
    [hideResult, showResult],
  );

  const closePopup = useCallback(() => {
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
      stopAll('forbidden', t('scan.unsupported'));
      return;
    }
    hideResult();
    setStatus('scan.hint');
    try {
      tg2.showScanQrPopup({}, (...args: unknown[]) => {
        // vanilla: args = [err?, result?]
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
        onScanned(text);
      });
    } catch {
      stopAll('forbidden', t('scan.unsupported'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideResult, setStatus, stopAll]);

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
      closePopup();
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
            stopAll('forbidden', t('scan.error_server'));
            offerRescan();
            return;
          }
          const st = (d['status'] as string) || '';
          if (st === 'invalid_init_data') {
            stopAll('invalid_init_data', String(d['text']), 'scan.reopen_app');
          } else if (st === 'forbidden') {
            stopAll('forbidden', String(d['text']));
          } else {
            showResult(st || 'already', String(d['text']));
            setTimeout(() => {
              if (!stoppedRef.current) openScanner();
            }, RESULT_MS);
          }
        })
        .catch(() => {
          inFlightRef.current = false;
          stopAll('forbidden', t('scan.network_error'));
          offerRescan();
        });
    },
    [closePopup, offerRescan, openScanner, showResult, stopAll],
  );
  onScannedRef.current = onScanned;

  // wrapper for openScanner's callback to use latest onScanned
  useEffect(() => {
    // keep ref updated
  }, [onScanned]);

  const handleRescan = useCallback(() => {
    setShowRescan(false);
    openScanner();
  }, [openScanner]);

  useEffect(() => {
    setupThemeListener();
  }, []);

  useEffect(() => {
    // eventId from prop (hash query) — keep ref
    eventIdRef.current = propEventId;
  }, [propEventId]);

  useEffect(() => {
    void loadI18n().then((d) => {
      const tt = d['scan.title'] || 'Сканер чекина';
      setTitle(tt);
      document.title = t('scan.title');
      setRescanLabel(t('scan.rescan'));

      const tg2 = getTelegram();
      if (!d || Object.keys(d).length === 0) {
        // mimic vanilla: if err then stopAll forbidden network_error
        // In vanilla, err truthy when fetch i18n fails -> stopAll forbidden network_error
        // Our loadI18n resolves to {} on error, not err flag. We treat empty dict as error
        stopAll('forbidden', t('scan.network_error'));
        return;
      }
      if (!tg2 || !tg2.initData) {
        stopAll('forbidden', t('scan.not_in_telegram'));
        return;
      }
      const eid = propEventId || new URLSearchParams(window.location.hash.split('?')[1] || window.location.search).get('event_id') || '';
      if (!eid) {
        stopAll('forbidden', t('scan.no_event'));
        return;
      }
      // success path — ready
      try {
        tg2.ready();
        tg2.expand();
      } catch {}
      if (tg2.onEvent) {
        tg2.onEvent('themeChanged', () => {
          // theme already handled via setupThemeListener
        });
        tg2.onEvent('scanQrPopupClosed', () => {
          if (!stoppedRef.current && !inFlightRef.current) {
            setStatus('scan.hint');
            offerRescan();
          }
        });
      }
      openScanner();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // openScanner uses showResult etc which are stable

  const statusText = statusKey ? t(statusKey) : statusRaw;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1 className="empty-heading" id="title">
        {title}
      </h1>
      {result && (
        <div className={`card result ${result.tone}`} id="result" role="status">
          <p className="empty-heading" id="resultText">
            {result.text}
          </p>
          {result.sub && <p className="empty-desc" id="resultSub">{result.sub}</p>}
        </div>
      )}
      <p className="empty-desc" id="status" style={{ minHeight: '1.5em' }}>
        {statusText}
      </p>
      {showRescan && (
        <button className="btn btn-primary btn-lg" id="rescan" onClick={handleRescan}>
          {rescanLabel}
        </button>
      )}
    </main>
  );
}
