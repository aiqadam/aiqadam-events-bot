// Тема — из Telegram, механизмом самого бренда ([data-theme]).
// Без JS остаётся светлая тема из :root, страница читается.

export function applyTheme() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const tg = window.Telegram?.WebApp;
  const scheme = tg && tg.colorScheme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', scheme);
}

export function setupThemeListener(): () => void {
  applyTheme();
  const tg = window.Telegram?.WebApp;
  if (tg && tg.onEvent) {
    const handler = () => applyTheme();
    tg.onEvent('themeChanged', handler);
    return () => {
      // offEvent может отсутствовать в старых клиентах
      if (tg.offEvent) {
        try {
          tg.offEvent('themeChanged', handler);
        } catch {}
      }
    };
  }
  return () => {};
}
