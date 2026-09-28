import { useCallback, useEffect, useMemo, useState } from 'react';
import { t, loadI18n, getLangCode } from '../lib/i18n';
import { getTelegram, hapticNotification, hapticImpact } from '../lib/telegram';
import { useBackButton } from '../lib/useBackButton';
import { setupThemeListener } from '../lib/theme';
import { postJson, reportApi } from '../lib/api';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';

// W123 (Q62): шестая страница SPA — форма сообщения о проблеме
// (docs/adr/0050-sixth-miniapp-page-report.md). Собирает то, чего не видно
// в прогонах: вёрстку, i18n, «кнопка не реагирует», пустой экран при успешном
// ответе API. Входы — таб «Профиль» (#/report?from=profile) и кнопка в меню
// бота (#/report?from=menu). Staff-гейта нет: пожаловаться может любой, у кого
// валидный initData; страница только показывает ответ report-api. Поля
// контекста (экран, версия, событие) прикладываются сами, их не вводят.

const KINDS: Array<{ key: string; label: string }> = [
  { key: 'broken', label: 'report.kind.broken' },
  { key: 'text', label: 'report.kind.text' },
  { key: 'message', label: 'report.kind.message' },
  { key: 'other', label: 'report.kind.other' },
];

export default function Report({
  eventId,
  from = '',
  fromApp = false,
}: {
  eventId: string;
  from?: string;
  fromApp?: boolean;
}) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';

  // «Назад» — только если форма открыта изнутри приложения (из «Профиля»),
  // не из кнопки в чате (правило MINIAPP-UX п.1).
  useBackButton(fromApp, () => window.history.back());

  const [dictLoaded, setDictLoaded] = useState(false);
  const [kind, setKind] = useState('broken');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setupThemeListener();
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {
        // WebView вне Telegram — ready/expand недоступны, страница остаётся читаемой.
      }
    }
  }, [tg]);

  useEffect(() => {
    void loadI18n().then(() => {
      setDictLoaded(true);
      document.title = t('report.title');
    });
  }, []);

  // Контекст — то, что человек вводить не должен: язык, платформа, версия
  // клиента. Строкой JSON (поле `context` — TEXT, DATA-MODEL).
  const context = useMemo(() => {
    const c: Record<string, string> = { lang: getLangCode() };
    if (tg?.platform) c.platform = String(tg.platform);
    if (tg?.version) c.version = String(tg.version);
    return JSON.stringify(c);
  }, [tg]);

  const submit = useCallback(async () => {
    if (busy || !text.trim()) return;
    if (!tg || !initData) {
      hapticNotification('error');
      setError(t('report.not_in_telegram'));
      return;
    }
    setBusy(true);
    setError('');
    // Конфиг среды резолвится здесь, а не на старте приложения: в среде без
    // ключа `report` (prod promote — отдельный шаг) падает только этот экран.
    let url = '';
    try {
      url = reportApi();
    } catch {
      setBusy(false);
      hapticNotification('error');
      setError(t('report.error.server'));
      return;
    }
    const res = await postJson(url, {
      initData,
      kind,
      text,
      // Откуда открыли форму — 'profile' | 'menu' | 'report' (прямой вход).
      route: from || 'report',
      eventId: eventId || '',
      appVersion: tg.version ? String(tg.version) : '',
      context,
    });
    setBusy(false);
    if (res.kind === 'network') {
      hapticNotification('error');
      setError(t('report.error.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
      setError(t('report.error.server'));
      return;
    }
    const d = res.data;
    if (d['ok']) {
      hapticNotification('success');
      setDone(true);
      return;
    }
    const txt = typeof d['text'] === 'string' && d['text'] ? d['text'] : t('report.error.unknown');
    hapticNotification('error');
    setError(txt);
  }, [busy, text, tg, initData, kind, from, eventId, context]);

  if (!dictLoaded) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <p className="empty-desc">{t('report.loading')}</p>
      </main>
    );
  }

  if (done) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <div className="sheet-success" id="report-done">
          <div className="success-icon">
            <Icon name="check-circle" size={34} />
          </div>
          <div className="success-title">{t('report.done_title')}</div>
          <div className="app-muted">{t('report.done')}</div>
        </div>
        <div className="app-actions">
          <a className="btn btn-primary" id="report-to-events" href="#/events">
            <Icon name="external" />
            {t('report.to_events')}
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <BackButton show={fromApp} onBack={() => window.history.back()} />
      <h1 className="app-title">{t('report.title')}</h1>
      <p className="app-muted">{t('report.lead')}</p>

      <div className="form-section">
        <div className="section-label">{t('report.kind_label')}</div>
        <div className="chip-row" role="radiogroup" aria-label={t('report.kind_label')}>
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={'btn btn-outline' + (kind === k.key ? ' active' : '')}
              id={'report-kind-' + k.key}
              aria-pressed={kind === k.key}
              onClick={() => {
                hapticImpact('light');
                setKind(k.key);
              }}
            >
              {t(k.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="field">
          <label className="label" htmlFor="report-text">
            {t('report.text_label')}
          </label>
          <textarea
            className="textarea"
            id="report-text"
            rows={5}
            maxLength={2000}
            placeholder={t('report.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
      </div>

      <p className="helper">{t('report.context')}</p>

      {error && (
        <div className="card result bad" id="report-error">
          <p className="empty-heading">{error}</p>
        </div>
      )}

      <div className="app-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          id="report-submit"
          disabled={!text.trim() || busy}
          aria-busy={busy}
          onClick={() => void submit()}
        >
          {t('report.submit')}
        </button>
      </div>
    </main>
  );
}
