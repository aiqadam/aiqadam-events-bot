// Общий fetch с таймаутом 15с и тремя исходами: network / server / json
// Копия логики из ticket.html:166, index.html:175, manage.html:223 — теперь один модуль.

export const FETCH_TIMEOUT_MS = 15000;

export type ApiResult =
  | { kind: 'network'; message: string }
  | { kind: 'server'; http: number }
  | { kind: 'json'; http: number; data: Record<string, unknown> };

export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  // Таймаут через Promise.race без AbortSignal — WebView iPhone виснет с signal, а text/plain ломает парсинг body на триггере.
  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const raw = await r.text();
    let data: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
    if (!data) return { kind: 'server', http: r.status } as ApiResult;
    return { kind: 'json', http: r.status, data } as ApiResult;
  });

  const timeoutPromise = new Promise<ApiResult>((_, reject) =>
    setTimeout(() => reject(new Error('timeout ' + FETCH_TIMEOUT_MS + 'ms')), FETCH_TIMEOUT_MS),
  );

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { kind: 'network', message: msg };
  }
}

// Среды различаются хостом и картой webhook-flowId (ADR-0042, W105): значения
// подставляются на сборке из miniapp/.env.dev / .env.prod (Vite mode). В бандл
// попадает конфиг ровно одной среды — чужой адрес туда не протекает.
const API_BASE = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

function readFlowIds(): Record<string, string> {
  try {
    const parsed = JSON.parse(String(import.meta.env.VITE_FLOW_IDS ?? '{}'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}
const FLOW_IDS = readFlowIds();

function endpoint(key: string): string {
  const id = FLOW_IDS[key];
  if (!API_BASE || !id) {
    console.error(`Mini App: не задан конфиг вебхука "${key}" (VITE_API_BASE/VITE_FLOW_IDS)`);
    return '';
  }
  return `${API_BASE}/api/v1/webhooks/${id}/sync`;
}

export const MY_QR_API = endpoint('myQr');
export const CHECKIN_API = endpoint('checkin');
export const MANAGE_API = endpoint('manage');
// W38: публичный каталог — без initData, читает events-api.
export const EVENTS_API = endpoint('events');
// W43: регистрация и «Мои билеты» — initData обязателен.
export const REG_API = endpoint('reg');
// W45 (Q53): форма отзыва #/feedback — initData обязателен, доступ по факту участия.
export const FEEDBACK_API = endpoint('feedback');
// W50 (вердикт W49): чьи кнопки сканера в каталоге — решает сервер по event_staff.
export const STAFF_EVENTS_API = endpoint('staffEvents');
// W62: счётчики «Отмечено X из Y» для сканера — читает сервер по event_staff
// конкретного события один раз при открытии экрана (в checkin-api не трогаем).
export const CHECKIN_COUNTER_API = endpoint('checkinCounter');
// W10 (OWN-14): создание одноразовой ссылки-инвайта контролёра (24 ч, один раз).
export const STAFF_INVITE_API = endpoint('staffInvite');
