// Утилиты Telegram WebApp — чистый доступ к window.Telegram.WebApp
export function getTelegram(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  const tg = window.Telegram?.WebApp;
  return tg ?? null;
}

export function getInitData(): string {
  const tg = getTelegram();
  return tg?.initData ?? '';
}

// W25: язык Mini App и язык, на котором отвечает сервер. Источник — профиль
// Telegram (`user.language_code`), поддерживаются ru/uz/en, всё остальное —
// ru (дефолт проекта). Вне Telegram (браузер, стенд) — тоже ru.
// W114: явный выбор языка в табе «Профиль» хранится в localStorage и
// перебивает язык Telegram — и для словаря, и для заголовка `ap-parent-run-locale`
// (lib/api.ts), на котором сервер отвечает.
const SUPPORTED_LANGS = ['ru', 'uz', 'en'];

// W124: на части клиентов (macOS Desktop) `initDataUnsafe.user` пуст в момент
// старта, хотя сырой `initData` уже несёт `user.language_code`. Читаем язык
// напрямую из initData — значение влияет только на язык интерфейса, тогда как
// `telegram_id` и права по-прежнему считает сервер из проверенного initData
// (DAT-1), так что доверять сырому значению здесь безопасно.
function langFromInitData(initData: string): string {
  if (!initData) return '';
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return '';
    const u = JSON.parse(raw) as { language_code?: unknown };
    return String(u?.language_code ?? '')
      .toLowerCase()
      .split('-')[0];
  } catch {
    return '';
  }
}

export function getLang(): string {
  try {
    const stored = String(localStorage.getItem('aiqadam.lang') || '').toLowerCase();
    if (SUPPORTED_LANGS.includes(stored)) return stored;
  } catch {
    /* localStorage недоступен — не критично */
  }
  const raw = String(getTelegram()?.initDataUnsafe?.user?.language_code ?? '').toLowerCase();
  const base = raw.split('-')[0];
  if (SUPPORTED_LANGS.includes(base)) return base;
  const fromInitData = langFromInitData(getInitData());
  return SUPPORTED_LANGS.includes(fromInitData) ? fromInitData : 'ru';
}

export function isInTelegram(): boolean {
  const tg = getTelegram();
  return Boolean(tg && tg.initData);
}

// W72 (#124): открыть внешнюю ссылку (карты) — в Telegram нативным openLink,
// иначе новой вкладкой. Ошибка косметическая: если ссылку открыть не удалось,
// ничего не ломаем.
export function openExternal(url: string): void {
  if (!url) return;
  const openLink = getTelegram()?.openLink;
  if (typeof openLink === 'function') {
    try {
      openLink(url);
      return;
    } catch {}
  }
  window.open(url, '_blank', 'noopener');
}

// W47: тактильный отклик. Клиент без HapticFeedback (или вызов вне Telegram)
// молча ничего не делает — отклик косметический, ошибка недопустима.
export function hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
  const hf = getTelegram()?.HapticFeedback;
  if (!hf) return;
  try {
    hf.impactOccurred(style);
  } catch {}
}

export function hapticNotification(type: 'error' | 'success' | 'warning'): void {
  const hf = getTelegram()?.HapticFeedback;
  if (!hf) return;
  try {
    hf.notificationOccurred(type);
  } catch {}
}

// W47: подтверждение закрытия Mini App — включается только там, где на экране
// есть несохранённый черновик (защита от ощущения потери, ADR-0003: сам
// черновик переживает закрытие).
export function setClosingConfirmation(on: boolean): void {
  const tg = getTelegram();
  if (!tg) return;
  try {
    if (on) tg.enableClosingConfirmation();
    else tg.disableClosingConfirmation();
  } catch {}
}
