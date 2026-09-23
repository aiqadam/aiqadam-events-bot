import { useCallback, useEffect, useState } from 'react';
import { t, loadI18n } from '../lib/i18n';
import { getTelegram, hapticNotification } from '../lib/telegram';
import { useBackButton } from '../lib/useBackButton';
import { setupThemeListener } from '../lib/theme';
import { postJson, FEEDBACK_API } from '../lib/api';
import Icon from '../components/Icon';
import BackButton from '../components/BackButton';

// W45 (ADR-0028, Q53): пятая страница SPA — форма отзыва после события.
// Вход — только по факту участия (регистрация с чекином на конкретный
// eventId); сервер (feedback-api) решает права, страница только показывает
// то, что он ответил. Одно событие — один отзыв: повторное открытие
// подгружает уже отправленный отзыв, повторная отправка перезаписывает его
// (Q53), а не создаёт второй.

type LoadState = 'loading' | 'ready' | 'error';

export default function Feedback({ eventId, fromApp = false }: { eventId: string; fromApp?: boolean }) {
  const tg = getTelegram();
  const initData = tg?.initData ?? '';

  // W47/W70: «Назад» — только если форма открыта изнутри приложения
  // (из «Прошедших»), не из кнопки в чате (правило MINIAPP-UX п.1).
  useBackButton(fromApp, () => window.history.back());

  const [dictLoaded, setDictLoaded] = useState(false);
  const [state, setState] = useState<LoadState>('loading');
  const [errorText, setErrorText] = useState('');
  const [retryable, setRetryable] = useState(false);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [given, setGiven] = useState(false);

  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const showError = useCallback((text: string, retry: boolean) => {
    hapticNotification('error');
    setErrorText(text);
    setRetryable(retry);
    setState('error');
  }, []);

  const load = useCallback(async () => {
    if (!tg || !initData) {
      showError(t('feedback.not_in_telegram'), false);
      return;
    }
    if (!eventId) {
      showError(t('feedback.no_event'), false);
      return;
    }
    setState('loading');
    const res = await postJson(FEEDBACK_API, { initData, eventId, action: 'load' });
    if (res.kind === 'network') {
      showError(t('feedback.error.network'), true);
      return;
    }
    if (res.kind === 'server') {
      showError(t('feedback.error.server'), true);
      return;
    }
    const d = res.data;
    if (d['ok']) {
      setGiven(d['given'] === true);
      setRating(typeof d['rating'] === 'number' ? d['rating'] : Number(d['rating']) || 0);
      setComment(typeof d['comment'] === 'string' ? d['comment'] : '');
      setState('ready');
      return;
    }
    const txt = typeof d['text'] === 'string' && d['text'] ? d['text'] : t('feedback.error.unknown');
    // forbidden (не был на событии) и invalid_init_data — не чинятся повтором.
    showError(txt, false);
  }, [tg, initData, eventId, showError]);

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
      document.title = t('feedback.title');
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    if (busy || rating < 1) return;
    setBusy(true);
    setSubmitError('');
    const res = await postJson(FEEDBACK_API, { initData, eventId, action: 'submit', rating, comment });
    setBusy(false);
    if (res.kind === 'network') {
      hapticNotification('error');
      setSubmitError(t('feedback.error.network'));
      return;
    }
    if (res.kind === 'server') {
      hapticNotification('error');
      setSubmitError(t('feedback.error.server'));
      return;
    }
    const d = res.data;
    if (d['ok']) {
      hapticNotification('success');
      setDone(true);
      return;
    }
    const txt = typeof d['text'] === 'string' && d['text'] ? d['text'] : t('feedback.error.unknown');
    hapticNotification('error');
    setSubmitError(txt);
  }, [busy, rating, comment, initData, eventId]);

  if (!dictLoaded) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <p className="empty-desc">{t('feedback.loading')}</p>
      </main>
    );
  }

  if (state === 'loading') {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <p className="empty-desc">{t('feedback.loading')}</p>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <div className="card result bad">
          <p className="empty-heading">{errorText}</p>
        </div>
        {retryable && (
          <div className="app-actions">
            <button type="button" className="btn btn-secondary" id="retry" onClick={() => void load()}>
              {t('feedback.retry')}
            </button>
          </div>
        )}
      </main>
    );
  }

  if (done || given) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, textAlign: 'center' }}>
        <BackButton show={fromApp} onBack={() => window.history.back()} />
        <div className="sheet-success" id="feedback-done">
          <div className="success-icon">
            <Icon name="check-circle" size={34} />
          </div>
          <div className="success-title">{t('feedback.done_title')}</div>
          <div className="app-muted">{t('feedback.done')}</div>
        </div>
        <div className="app-actions">
          <a className="btn btn-primary" id="to-events" href="#/events?tab=past">
            <Icon name="external" />
            {t('feedback.to_events')}
          </a>
        </div>
      </main>
    );
  }

  // ready, ещё не отправлял (given=false, done=false) — форма.
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <BackButton show={fromApp} onBack={() => window.history.back()} />
      <h1 className="app-title">{t('feedback.title')}</h1>
      <p className="app-muted">{t('feedback.lead')}</p>

      <div className="form-section">
        <div className="section-label">{t('feedback.rate')}</div>
        <div className="rating" style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label={t('feedback.rate')}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className="btn btn-outline"
              id={`star-${i}`}
              aria-pressed={i <= rating}
              aria-label={String(i)}
              onClick={() => setRating(i)}
              style={{ padding: 8 }}
            >
              <Icon name="star" size={28} filled={i <= rating} />
            </button>
          ))}
        </div>
        {rating === 0 && <p className="helper">{t('feedback.rate_hint')}</p>}
      </div>

      <div className="form-section">
        <div className="field">
          <label className="label" htmlFor="feedback-comment">
            {t('feedback.text')}
          </label>
          <textarea
            className="textarea"
            id="feedback-comment"
            rows={4}
            maxLength={2000}
            placeholder={t('feedback.placeholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>

      {submitError && (
        <div className="card result bad" id="submit-error">
          <p className="empty-heading">{submitError}</p>
        </div>
      )}

      <div className="app-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          id="submit"
          disabled={rating === 0 || busy}
          aria-busy={busy}
          onClick={() => void submit()}
        >
          {t('feedback.submit')}
        </button>
      </div>
    </main>
  );
}
