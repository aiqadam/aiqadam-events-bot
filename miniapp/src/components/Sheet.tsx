import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { t } from '../lib/i18n';
import Icon from './Icon';

// Шит — паттерн эталона (prototypes/proto.css `.app-sheet`): ручка, шапка
// с крестиком, тело. Вынесен из Manage.tsx при W43 для переиспользования
// каталогом и экраном билета (копия третьей была бы лишней).
export default function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  // Пока шит открыт, фон не прокручивается (дизайн-ревью W42, круг 4).
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="app-sheet">
      <div className="app-sheet-backdrop" onClick={onClose} />
      <div className="app-sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="app-sheet-grab" />
        <div className="app-sheet-head">
          <span className="app-sheet-title">{title}</span>
          <button type="button" className="app-sheet-close" aria-label={t('common.btn.close')} onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="app-sheet-body">{children}</div>
      </div>
    </div>
  );
}
