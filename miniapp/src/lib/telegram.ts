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
