import { getTelegram } from './telegram';

// W70 (#122): есть ли нативная кнопка «Назад» в шапке Telegram и умеет ли
// клиент её показывать (Bot API 6.1+). Если нет — экран рисует свою
// (components/BackButton.tsx), иначе получился бы дубль (MINIAPP-UX п.1).
export function hasNativeBackButton(): boolean {
  const tg = getTelegram();
  if (!tg?.BackButton) return false;
  if (typeof tg.isVersionAtLeast === 'function') {
    try {
      return tg.isVersionAtLeast('6.1');
    } catch {
      return true;
    }
  }
  return true;
}
