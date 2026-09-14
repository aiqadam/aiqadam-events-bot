import { useEffect, useState, useCallback, useRef } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram } from '../lib/telegram';
import { setupThemeListener } from '../lib/theme';
import { postJson, MANAGE_API } from '../lib/api';
import { utcToLocalInput } from '../lib/dates';

const FIELDS = ['title', 'description', 'address', 'lat', 'lon', 'starts_at', 'ends_at', 'reg_deadline_at', 'capacity', 'overbook_pct'] as const;

const ALLOWED: Record<string, string[]> = {
  '': ['draft', 'published'],
  draft: ['draft', 'published'],
  published: ['published', 'cancelled'],
  cancelled: ['cancelled'],
  finished: ['finished'],
};

function genNewId(): string {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).slice(0, 12);
}

type EventData = Record<string, unknown>;

export default function Manage({ eventId: propEventId }: { eventId: string }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';
  const [eventId, setEventId] = useState(propEventId);
  const newIdRef = useRef(genNewId());
  const [origStatus, setOrigStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [dictLoaded, setDictLoaded] = useState(false);
  const [titleText, setTitleText] = useState('Новый ивент');
  const [statusText, setStatusText] = useState(''); // status line below title
  const [showForm, setShowForm] = useState(false);
  const [showLoadfail, setShowLoadfail] = useState(false);
  const [loadfailText, setLoadfailText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // form fields
  const [fields, setFields] = useState<Record<string, string>>({
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
  });
  const [statusValue, setStatusValue] = useState('published');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [hasPhoto, setHasPhoto] = useState(false);
  const [locateVisible, setLocateVisible] = useState(false);

  // keep prop sync (when hash changes)
  useEffect(() => setEventId(propEventId), [propEventId]);

  const applyStatus = useCallback((st: string) => {
    setOrigStatus(st);
    const allowed = ALLOWED[st] || ALLOWED[''];
    // statusValue should be current status if allowed else first allowed
    // vanilla: checked = (name === (st || 'published'))
    const desired = st || 'published';
    if (allowed.includes(desired)) setStatusValue(desired);
    else setStatusValue(allowed[0] || 'draft');
  }, []);

  const clearErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const showFieldErrors = useCallback((errFields: Record<string, unknown>) => {
    const mapped: Record<string, string> = {};
    Object.keys(errFields || {}).forEach((name) => {
      const key = String(errFields[name]);
      mapped[name] = t(key);
    });
    setFieldErrors(mapped);
  }, []);

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
      const st = String(ev['status'] || 'draft');
      applyStatus(st);
      setHasPhoto(ev['hasPhoto'] === true || ev['hasPhoto'] === 'true');
    },
    [applyStatus],
  );

  const collect = useCallback(() => {
    const out: Record<string, string> = {};
    FIELDS.forEach((n) => {
      out[n] = String((fields[n] || '')).trim();
    });
    out['status'] = statusValue;
    return out;
  }, [fields, statusValue]);

  const setBusyState = useCallback(
    (on: boolean, key?: string) => {
      setBusy(on);
      setStatusText(on && key ? t(key) : '');
    },
    [],
  );

  const errorTextFor = useCallback((res: { kind: string; http?: number; data?: Record<string, unknown> }) => {
    if (res.kind === 'network') return t('manage.err.network');
    if (res.kind === 'server') return t('manage.err.server');
    const d = res.data as Record<string, unknown>;
    if (typeof d['text'] === 'string' && d['text']) return String(d['text']);
    return t('manage.err.server');
  }, []);

  const showLoadFail = useCallback((text: string) => {
    setShowForm(false);
    setLoadfailText(text);
    setShowLoadfail(true);
    setStatusText('');
  }, []);

  const load = useCallback(async () => {
    setShowLoadfail(false);
    setResult(null);
    setStatusText(t('manage.loading'));
    const res = await postJson(MANAGE_API, { initData, action: 'load', eventId });
    if (res.kind !== 'json' || !res.data['ok'] || !res.data['event']) {
      showLoadFail(errorTextFor(res as never));
      return;
    }
    fillForm(res.data['event'] as EventData);
    setStatusText('');
    setShowForm(true);
  }, [eventId, initData, errorTextFor, fillForm, showLoadFail]);

  const save = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (busy) return;
      clearErrors();
      setResult(null);
      const collecting = collect();
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
        if (d['eventId']) setEventId(String(d['eventId']));
        applyStatus(collecting['status']);
        setTitleText(t('manage.title.edit'));
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.saved.updated');
        setResult({ ok: true, text: txt });
        return;
      }
      if (d['error'] === 'validation') {
        showFieldErrors((d['fields'] as Record<string, unknown>) || {});
        const txt = typeof d['text'] === 'string' && d['text'] ? String(d['text']) : t('manage.err.validation');
        setResult({ ok: false, text: txt });
        return;
      }
      setResult({ ok: false, text: errorTextFor(res as never) });
    },
    [busy, clearErrors, collect, eventId, initData, applyStatus, errorTextFor, setBusyState, showFieldErrors],
  );

  const updateSubmitLabel = useCallback(() => {
    const publishNow = statusValue === 'published' && origStatus !== 'published';
    return t(publishNow ? 'manage.btn.publish' : 'manage.btn.save');
  }, [statusValue, origStatus]);

  // locate setup
  useEffect(() => {
    if (!dictLoaded) return;
    const tg2 = getTelegram();
    const lm = tg2?.LocationManager;
    const setGeo = (lat: number, lon: number) => {
      setFields((prev) => ({
        ...prev,
        lat: String(Math.round(lat * 1e6) / 1e6),
        lon: String(Math.round(lon * 1e6) / 1e6),
      }));
    };
    if (lm && typeof lm.init === 'function') {
      setLocateVisible(true);
      // listener added on click, not here
      // we just make button visible; its click handler below will use lm
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setLocateVisible(true);
    } else {
      setLocateVisible(false);
    }
    // we keep setGeo inside click handler below
    void setGeo;
  }, [dictLoaded]);

  const handleLocate = useCallback(() => {
    const tg2 = getTelegram();
    const lm = tg2?.LocationManager;
    const setGeo = (lat: number, lon: number) => {
      setFields((prev) => ({
        ...prev,
        lat: String(Math.round(lat * 1e6) / 1e6),
        lon: String(Math.round(lon * 1e6) / 1e6),
      }));
    };
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
  }, []);

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
      const isEdit = Boolean(eventId);
      const key = isEdit ? 'manage.title.edit' : 'manage.title.new';
      const tt = d[key] || (isEdit ? 'Правка ивента' : 'Новый ивент');
      setTitleText(tt);
      document.title = t(key);

      if (!tg || !initData) {
        showLoadFail(t('manage.err.not_in_telegram'));
        return;
      }
      if (eventId) {
        void load();
      } else {
        setShowForm(true);
        applyStatus('');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // When eventId changes after creation, need to update URL hash? Not needed — App keeps hash, but we update local eventId
  // Also need to update title when status changes etc.
  useEffect(() => {
    if (dictLoaded) {
      const isEdit = Boolean(eventId);
      // keep title as edit after creation, as vanilla does
      // vanilla after save sets titleEl.textContent = t('manage.title.edit')
      // So we keep titleText as is; but initial load sets correctly
    }
  }, [dictLoaded, eventId]);

  const allowed = ALLOWED[origStatus] || ALLOWED[''];

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
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
          <button type="button" className="btn btn-secondary" id="retry" onClick={() => void load()}>
            {t('manage.btn.retry')}
          </button>
        </div>
      )}

      {showForm && (
        <form id="form" noValidate onSubmit={save} hidden={false}>
          <div className="field">
            <label className="label" htmlFor="f-title">
              {t('field.title')}
            </label>
            <input className={`input ${fieldErrors['title'] ? 'error' : ''}`} id="f-title" name="title" maxLength={200} autoComplete="off" value={fields['title']} onChange={(e) => setFields((p) => ({ ...p, title: e.target.value }))} />
            {fieldErrors['title'] && (
              <p className="helper error" id="e-title">
                {fieldErrors['title']}
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="f-description">
              {t('field.description')}
            </label>
            <textarea className={`textarea ${fieldErrors['description'] ? 'error' : ''}`} id="f-description" name="description" rows={4} maxLength={4000} value={fields['description']} onChange={(e) => setFields((p) => ({ ...p, description: e.target.value }))} />
            <p className="helper">{t('manage.hint.description')}</p>
            {fieldErrors['description'] && (
              <p className="helper error" id="e-description">
                {fieldErrors['description']}
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="f-address">
              {t('field.address')}
            </label>
            <input className={`input ${fieldErrors['address'] ? 'error' : ''}`} id="f-address" name="address" maxLength={300} autoComplete="street-address" value={fields['address']} onChange={(e) => setFields((p) => ({ ...p, address: e.target.value }))} />
            <p className="helper">{t('manage.hint.address')}</p>
            {fieldErrors['address'] && (
              <p className="helper error" id="e-address">
                {fieldErrors['address']}
              </p>
            )}
          </div>

          <div className="field">
            <span className="label">{t('field.geo')}</span>
            <div className="row" style={{ display: 'flex', gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
                <label className="label" htmlFor="f-lat">
                  {t('field.lat')}
                </label>
                <input className={`input ${fieldErrors['geo'] ? 'error' : ''}`} id="f-lat" name="lat" inputMode="decimal" autoComplete="off" value={fields['lat']} onChange={(e) => setFields((p) => ({ ...p, lat: e.target.value }))} />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
                <label className="label" htmlFor="f-lon">
                  {t('field.lon')}
                </label>
                <input className={`input ${fieldErrors['geo'] ? 'error' : ''}`} id="f-lon" name="lon" inputMode="decimal" autoComplete="off" value={fields['lon']} onChange={(e) => setFields((p) => ({ ...p, lon: e.target.value }))} />
              </div>
            </div>
            <p className="helper">{t('manage.hint.geo')}</p>
            {fieldErrors['geo'] && (
              <p className="helper error" id="e-geo">
                {fieldErrors['geo']}
              </p>
            )}
            {locateVisible && (
              <p>
                <button type="button" className="btn btn-outline btn-sm" id="locate" onClick={handleLocate}>
                  {t('manage.btn.locate')}
                </button>
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="f-starts_at">
              {t('field.starts_at')}
            </label>
            <input className={`input ${fieldErrors['starts_at'] ? 'error' : ''}`} id="f-starts_at" name="starts_at" type="datetime-local" step={60} value={fields['starts_at']} onChange={(e) => setFields((p) => ({ ...p, starts_at: e.target.value }))} />
            <p className="helper">{t('manage.hint.datetime')}</p>
            {fieldErrors['starts_at'] && (
              <p className="helper error" id="e-starts_at">
                {fieldErrors['starts_at']}
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="f-ends_at">
              {t('field.ends_at')}
            </label>
            <input className={`input ${fieldErrors['ends_at'] ? 'error' : ''}`} id="f-ends_at" name="ends_at" type="datetime-local" step={60} value={fields['ends_at']} onChange={(e) => setFields((p) => ({ ...p, ends_at: e.target.value }))} />
            {fieldErrors['ends_at'] && (
              <p className="helper error" id="e-ends_at">
                {fieldErrors['ends_at']}
              </p>
            )}
          </div>

          <div className="field">
            <label className="label" htmlFor="f-reg_deadline_at">
              {t('field.reg_deadline_at')}
            </label>
            <input className={`input ${fieldErrors['reg_deadline_at'] ? 'error' : ''}`} id="f-reg_deadline_at" name="reg_deadline_at" type="datetime-local" step={60} value={fields['reg_deadline_at']} onChange={(e) => setFields((p) => ({ ...p, reg_deadline_at: e.target.value }))} />
            {fieldErrors['reg_deadline_at'] && (
              <p className="helper error" id="e-reg_deadline_at">
                {fieldErrors['reg_deadline_at']}
              </p>
            )}
          </div>

          <div className="row" style={{ display: 'flex', gap: 12 }}>
            <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
              <label className="label" htmlFor="f-capacity">
                {t('field.capacity')}
              </label>
              <input className={`input ${fieldErrors['capacity'] ? 'error' : ''}`} id="f-capacity" name="capacity" inputMode="numeric" autoComplete="off" value={fields['capacity']} onChange={(e) => setFields((p) => ({ ...p, capacity: e.target.value }))} />
              <p className="helper">{t('manage.hint.capacity')}</p>
              {fieldErrors['capacity'] && (
                <p className="helper error" id="e-capacity">
                  {fieldErrors['capacity']}
                </p>
              )}
            </div>
            <div className="field" style={{ flex: 1, minWidth: 0, marginTop: 0 }}>
              <label className="label" htmlFor="f-overbook_pct">
                {t('field.overbook_pct')}
              </label>
              <input className={`input ${fieldErrors['overbook_pct'] ? 'error' : ''}`} id="f-overbook_pct" name="overbook_pct" inputMode="numeric" autoComplete="off" value={fields['overbook_pct']} onChange={(e) => setFields((p) => ({ ...p, overbook_pct: e.target.value }))} />
              <p className="helper">{t('manage.hint.overbook')}</p>
              {fieldErrors['overbook_pct'] && (
                <p className="helper error" id="e-overbook_pct">
                  {fieldErrors['overbook_pct']}
                </p>
              )}
            </div>
          </div>

          <div className="field">
            <span className="label">{t('field.status')}</span>
            <div className="choices" id="choices" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['draft', 'published', 'cancelled', 'finished'] as const).map((st) => (
                <label key={st} className="control-row" data-status={st} hidden={!allowed.includes(st)} style={{ display: !allowed.includes(st) ? 'none' : undefined }}>
                  <input className="radio" type="radio" name="status" value={st} checked={statusValue === st} onChange={() => setStatusValue(st)} />
                  <span>{t(`status.${st}`)}</span>
                </label>
              ))}
            </div>
            {fieldErrors['status'] && (
              <p className="helper error" id="e-status">
                {fieldErrors['status']}
              </p>
            )}
          </div>

          {hasPhoto && (
            <p className="helper" id="photoHint">
              {t('manage.hint.photo')}
            </p>
          )}

          <div className="field actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fieldErrors['_form'] && (
              <p className="helper error" id="e-form">
                {fieldErrors['_form']}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-lg" id="submit" disabled={busy}>
              {updateSubmitLabel()}
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className={`card result ${result.ok ? 'ok' : 'bad'}`} id="result" role="status">
          <p className="empty-heading" id="resultText">
            {result.text}
          </p>
        </div>
      )}
    </main>
  );
}
