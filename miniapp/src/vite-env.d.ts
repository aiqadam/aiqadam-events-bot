/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: unknown;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
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
