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
