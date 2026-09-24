/// <reference types="vite/client" />

// W47: нативная кнопка «Назад» в шапке Telegram (Bot API 6.1+). Не элемент
// страницы — замещает системный жест там, где hash не меняется.
interface TelegramBackButton {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

// W47: тактильный отклик (Bot API 6.1+).
interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  selectionChanged: () => void;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: unknown;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  // W53: таб рассылки — «Перейти в чат»: страница закрывается, пользователь
  // возвращается в чат с ботом и пересылает ему сообщение (сценарий W14).
  close: () => void;
  openTelegramLink?: (url: string) => void;
  // W72: открытие внешней ссылки (карты) — Bot API 6.1+.
  openLink?: (url: string, opts?: { try_instant_view?: boolean }) => void;
  closeScanQrPopup: () => void;
  showScanQrPopup: (params: Record<string, unknown>, cb: (...args: unknown[]) => void) => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  LocationManager?: {
    init: (cb: () => void) => void;
    isLocationAvailable?: boolean;
    isAccessGranted?: boolean;
    isAccessRequested?: boolean;
    openSettings?: () => void;
    getLocation: (cb: (loc: { latitude: number; longitude: number } | null) => void) => void;
  };
  MainButton?: unknown;
  BackButton?: TelegramBackButton;
  HapticFeedback?: TelegramHapticFeedback;
  // W47: подтверждение закрытия (Bot API 6.2+) и отключение вертикальных
  // свайпов (7.7+). Пол Bot API продукта задаёт Safe Area API (8.0+, W48).
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
  disableVerticalSwipes: () => void;
  isVersionAtLeast?: (version: string) => boolean;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
