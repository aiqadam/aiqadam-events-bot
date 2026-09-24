import { t } from '../lib/i18n';
import { hasNativeBackButton } from '../lib/nav';
import Icon from './Icon';

// W70 (#122): экранный фолбэк нативной «Назад» — для клиентов без BackButton
// (в т.ч. Telegram Desktop до Bot API 6.1). При рабочей нативной кнопке не
// рисуется: дубль запрещён (MINIAPP-UX п.1). Вид — как у «К списку» в manage
// (`btn btn-ghost btn-sm` + стрелка), новых стилей нет.
export default function BackButton({ show, onBack }: { show: boolean; onBack: () => void }) {
  if (!show || hasNativeBackButton()) return null;
  return (
    <button type="button" className="btn btn-ghost btn-sm" id="back-fallback" onClick={onBack} style={{ marginBottom: 10 }}>
      <Icon name="arrow-left" />
      {t('common.btn.back')}
    </button>
  );
}
