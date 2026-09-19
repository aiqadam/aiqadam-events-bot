/// <reference types="vite/client" />

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
  BackButton?: unknown;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
