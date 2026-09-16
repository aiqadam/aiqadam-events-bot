import { useEffect, useRef, useState, useCallback } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { postJson, MY_QR_API, EVENTS_API, REG_API } from '../lib/api';
import { utcMs } from '../lib/dates';
import Icon from '../components/Icon';
import Sheet from '../components/Sheet';

const QR_MAX = 224;

export default function Ticket({ eventId }: { eventId: string }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const qrElRef = useRef<HTMLDivElement>(null);
  const qrPayloadRef = useRef('');
  const qrDrawnRef = useRef(0);
  const [dictLoaded, setDictLoaded] = useState(false);
  const [statusKey, setStatusKey] = useState<string>('');
  const [errorText, setErrorText] = useState<string>('');
  const [isError, setIsError] = useState(false);
  const [retryable, setRetryable] = useState(false);
  const [showRetry, setShowRetry] = useState(false);

  // W43: отмена регистрации (PAR-5) — с экрана билета, до старта ивента.
  const [canCancel, setCanCancel] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelled, setCancelled] = useState('');

  // Для заголовка после i18n
  const [title, setTitle] = useState('AI Qadam Events');

  const qrSize = useCallback(() => {
    const el = qrElRef.current;
    if (!el) return QR_MAX;
    const inner = el.clientWidth - 64;
    if (!(inner > 0)) return QR_MAX;
    return Math.min(QR_MAX, Math.floor(inner));
  }, []);

  const drawQr = useCallback(async () => {
    const payload = qrPayloadRef.current;
    if (!payload || !qrElRef.current) return;
    const size = qrSize();
    if (size === qrDrawnRef.current) return;
    qrDrawnRef.current = size;
    const el = qrElRef.current;
    // Без innerHTML через разметку из данных — только DOM
    while (el.firstChild) el.removeChild(el.firstChild);
    try {
      // lazy qrcode — только на ticket; поддержка обоих форм экспорта (namespace vs default)
      const mod: Record<string, unknown> = await import('qrcode');
      const QRCode = (mod as { toCanvas?: unknown }).toCanvas
        ? (mod as { toCanvas: (c: HTMLCanvasElement, t: string, o: unknown) => Promise<void> })
        : ((mod as { default?: { toCanvas: (c: HTMLCanvasElement, t: string, o: unknown) => Promise<void> } }).default as { toCanvas: (c: HTMLCanvasElement, t: string, o: unknown) => Promise<void> });
      if (!QRCode || typeof QRCode.toCanvas !== 'function') throw new Error('qrcode toCanvas missing: ' + Object.keys(mod).join(','));
      const canvas = document.createElement('canvas');
      // margin 0 — зона покоя даёт CSS padding 32px, не QR; цвет по умолчанию чёрный на белом (бренд: Dark code on light ground)
      await QRCode.toCanvas(canvas, payload, {
        errorCorrectionLevel: 'H',
        width: size,
        margin: 0,
      });
      el.appendChild(canvas);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // покажем ошибку прямо в плите, чтобы ревью в life было видно без devtools
      const err = document.createElement('div');
      err.style.fontSize = '12px';
      err.style.wordBreak = 'break-all';
      err.style.color = 'var(--destructive)';
      err.textContent = 'QR render failed: ' + msg + ' payload=' + payload;
      el.appendChild(err);
      // также в статус
      setErrorText('QR render failed: ' + msg);
      setIsError(true);
      setRetryable(true);
      setShowRetry(true);
      setStatusKey('');
    }
  }, [qrSize]);

  const renderQr = useCallback(
    (payload: string) => {
      qrPayloadRef.current = payload;
      qrDrawnRef.current = 0;
      void drawQr();
      // ResizeObserver пересчёт при изменении ширины плиты
      if (typeof ResizeObserver !== 'undefined' && qrElRef.current) {
        const ro = new ResizeObserver(() => void drawQr());
        ro.observe(qrElRef.current);
        // cleanup будет при размонтировании — observer остаётся на время страницы
      } else {
        window.addEventListener('resize', () => void drawQr());
        window.addEventListener('orientationchange', () => void drawQr());
      }
    },
    [drawQr],
  );

  const showError = useCallback((text: string, retry: boolean) => {
    setErrorText(text);
    setIsError(true);
    setRetryable(retry);
    setShowRetry(retry);
    setStatusKey('');
  }, []);

  const showStatus = useCallback((key: string) => {
    setStatusKey(key);
    setErrorText('');
    setIsError(false);
    setRetryable(false);
    setShowRetry(false);
  }, []);

  const handleQr = useCallback(
    (res: { kind: string; message?: string; data?: Record<string, unknown> }) => {
      if (res.kind === 'network') {
        const det = (res as { message?: string }).message ? ' (' + (res as { message: string }).message + ')' : '';
        showError(t('ticket.error.network') + det, true);
        return;
      }
      if (res.kind === 'server') {
        showError(t('ticket.error.server'), true);
        return;
      }
      const data = res.data as Record<string, unknown>;
      if (data['ok'] && data['payload']) {
        renderQr(String(data['payload']));
        showStatus('ticket.show_at_entrance');
      } else if (data['error'] === 'not_registered' || data['error'] === 'invalid_init_data') {
        const txt = typeof data['text'] === 'string' && data['text'] ? String(data['text']) : t('ticket.error.unknown');
        showError(txt, false);
      } else {
        showError(t('ticket.error.unknown'), true);
      }
    },
    [renderQr, showError, showStatus],
  );

  const requestQr = useCallback(async () => {
    const res = await postJson(MY_QR_API, { initData, eventId });
    return res;
  }, [initData, eventId]);

  // Отмена показывается только для активной регистрации до старта ивента:
  // статус и старт — из reg-api (`mine`) и events-api (публичная афиша).
  const loadCancelInfo = useCallback(async () => {
    if (!tg || !initData || !eventId) return;
    try {
      const [mineRes, eventsRes] = await Promise.all([
        postJson(REG_API, { action: 'mine', initData }),
        postJson(EVENTS_API, {}),
      ]);
      if (mineRes.kind !== 'json' || eventsRes.kind !== 'json') return;
      const mineRows = Array.isArray(mineRes.data['mine']) ? (mineRes.data['mine'] as Array<Record<string, unknown>>) : [];
      const row = mineRows.find((r) => String(r['eventId'] || '') === eventId);
      if (!row || String(row['status'] || '') !== 'registered') return;
      const list = ([] as Array<Record<string, unknown>>)
        .concat(Array.isArray(eventsRes.data['upcoming']) ? (eventsRes.data['upcoming'] as Array<Record<string, unknown>>) : [])
        .concat(Array.isArray(eventsRes.data['past']) ? (eventsRes.data['past'] as Array<Record<string, unknown>>) : []);
      const ev = list.find((e) => String(e['id'] || '') === eventId);
      const startMs = ev ? utcMs(String(ev['startsAt'] || '')) : NaN;
      if (isFinite(startMs) && startMs > Date.now()) setCanCancel(true);
    } catch {
      // не смогли выяснить — кнопку не показываем (отмена не критична для показа QR)
    }
  }, [tg, initData, eventId]);

  const cancelRegistration = useCallback(async () => {
    if (cancelBusy) return;
    setCancelBusy(true);
    setCancelError('');
    const res = await postJson(REG_API, { action: 'cancel', initData, eventId });
    setCancelBusy(false);
    if (res.kind === 'network') {
      setCancelError(t('events.err.network'));
      return;
    }
    if (res.kind === 'server') {
      setCancelError(t('events.err.server'));
      return;
    }
    const d = res.data as Record<string, unknown>;
    if (d['ok']) {
      setCancelConfirm(false);
      setCanCancel(false);
      setCancelled(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('cancel.kept'));
      return;
    }
    setCancelError(typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('events.err.server'));
  }, [cancelBusy, initData, eventId]);

  const retry = useCallback(() => {
    showStatus('ticket.loading');
    void requestQr().then(handleQr);
  }, [requestQr, handleQr, showStatus]);

  useEffect(() => {
    setupThemeListener();
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {}
    }
  }, [tg]);

  // Запрос QR сразу, не дожидаясь словаря — на плохой связи это единственное, ради чего страницу открыли.
  const qrRequestRef = useRef<Promise<{ kind: string; data?: Record<string, unknown> }> | null>(null);
  useEffect(() => {
    if (tg && initData && eventId) {
      qrRequestRef.current = requestQr() as Promise<{ kind: string; data?: Record<string, unknown> }>;
      void loadCancelInfo();
    } else {
      qrRequestRef.current = null;
    }
  }, [tg, initData, eventId, requestQr, loadCancelInfo]);

  useEffect(() => {
    void loadI18n().then((d) => {
      setDictLoaded(true);
      const tt = d['ticket.title'] || 'Ваш QR для входа';
      setTitle(tt);
      document.title = t('ticket.title');

      if (!tg || !initData) {
        setErrorText(t('ticket.not_in_telegram'));
        setIsError(true);
        setShowRetry(false);
        return;
      }
      if (!eventId) {
        setErrorText(t('ticket.no_event'));
        setIsError(true);
        setShowRetry(false);
        return;
      }
      // retry кнопка текст — нужен словарь
      // покажем загрузку и дождёмся QR запроса
      setStatusKey('ticket.loading');
      setIsError(false);
      if (qrRequestRef.current) {
        void qrRequestRef.current.then(handleQr);
      } else {
        void requestQr().then(handleQr);
      }
    });
  }, [eventId, handleQr, initData, requestQr, tg]);

  // Обновляем заголовок когда dict загружен
  useEffect(() => {
    if (dictLoaded) {
      setTitle(t('ticket.title'));
    }
  }, [dictLoaded]);

  const statusText = cancelled || (statusKey ? t(statusKey) : errorText);
  const retryLabel = t('ticket.retry');

  return (
    <main style={{ maxWidth: 384, margin: '0 auto', padding: 16, textAlign: 'center' }}>
      <div className={`card ticket-card ${isError && !cancelled ? 'error' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <h1 className="empty-heading" id="title">
          {title}
        </h1>
        {!cancelled && <div ref={qrElRef} className="qr-plate" data-theme="light" id="qr" />}
        <p className="empty-desc msg" id="status" role="status" style={{ margin: '16px 0 0' }}>
          {statusText}
        </p>
        {showRetry && retryable && (
          <button type="button" className="btn btn-secondary" id="retry" onClick={retry}>
            {retryLabel}
          </button>
        )}
        {cancelled && (
          <a className="btn btn-primary" id="to-mine" href="#/events?tab=mine">
            <Icon name="external" />
            {t('events.tab.mine')}
          </a>
        )}
        {canCancel && !cancelled && (
          <button type="button" className="btn btn-outline btn-block" id="cancel-reg" onClick={() => { setCancelError(''); setCancelConfirm(true); }}>
            {t('myreg.btn.cancel')}
          </button>
        )}
      </div>

      <Sheet open={cancelConfirm} title={t('myreg.btn.cancel')} onClose={() => setCancelConfirm(false)}>
        <div className="app-muted" id="cancel-confirm-text">
          {t('cancel.confirm', { title })}
        </div>
        {cancelError && (
          <div className="card result bad" id="cancel-error">
            <p className="empty-heading">{cancelError}</p>
          </div>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-destructive btn-block" id="cancel-yes" disabled={cancelBusy} aria-busy={cancelBusy} onClick={() => void cancelRegistration()}>
            {t('cancel.btn.confirm')}
          </button>
          <button type="button" className="btn btn-secondary btn-block" id="cancel-no" onClick={() => setCancelConfirm(false)}>
            {t('cancel.btn.keep')}
          </button>
        </div>
      </Sheet>
    </main>
  );
}
