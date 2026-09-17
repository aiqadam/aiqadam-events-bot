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

// Специфичные для трёх роутов URL — захардкожены как в ванили (Q14: events-dev)
export const MY_QR_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/WYmnxVM4xPAWZA1IvNZok/sync';
export const CHECKIN_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/rKoDYtiIVdbzlW59b57uH/sync';
export const MANAGE_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/CcGPwuW4ws5hkcaOPerEG/sync';
// W38: публичный каталог — без initData, читает events-api.
export const EVENTS_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/wEdKdE4RBGKIzWkl4MJHG/sync';
// W43: регистрация и «Мои билеты» — initData обязателен.
export const REG_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/SiYL8m6k4oy4YunAdZ1W7/sync';
// W45 (Q53): форма отзыва #/feedback — initData обязателен, доступ по факту участия.
export const FEEDBACK_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/DgmYgxiEXBz0roebYRBUj/sync';
