import { useCallback, useEffect, useRef, useState } from 'react';

// Тост — короткое подтверждение результата (эталон `.proto-toast`).
// Вынесен из Manage.tsx при W65 для переиспользования каталогом (#/events):
// копирование ссылки-приглашения показывает тот же тост, третья копия
// состояния была бы лишней (тот же довод, что у Sheet, W43).
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((text: string, sticky = false) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(text);
    if (!sticky) {
      timer.current = window.setTimeout(() => setToast(null), 2500);
    }
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { toast, setToast, showToast };
}

export default function Toast({ text }: { text: string }) {
  return (
    <div className="toast show" id="toast" role="status">
      {text}
    </div>
  );
}
