import { useEffect, useRef } from 'react';
import { getTelegram } from './telegram';

// W47: нативная кнопка «Назад» в шапке Telegram (Bot API 6.1+).
// `enabled` — показывать ли её на текущем экране; `onBack` — что делать по
// тапу. Корневые экраны без логического «назад» её скрывают: системный жест
// закрывает Mini App, это штатное поведение, а не регрессия.
export function useBackButton(enabled: boolean, onBack: () => void): void {
  // Колбэк меняется каждый рендер — держим его в ref, чтобы не переподключать
  // обработчик на каждое изменение состояния формы.
  const cbRef = useRef(onBack);
  useEffect(() => {
    cbRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    const bb = getTelegram()?.BackButton;
    if (!bb) return;
    if (!enabled) {
      try {
        bb.hide();
      } catch {}
      return;
    }
    const handler = () => cbRef.current();
    try {
      bb.onClick(handler);
      bb.show();
    } catch {}
    return () => {
      try {
        bb.offClick(handler);
      } catch {}
      try {
        bb.hide();
      } catch {}
    };
  }, [enabled]);
}
