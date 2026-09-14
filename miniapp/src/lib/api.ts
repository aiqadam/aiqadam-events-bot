// Общий fetch с таймаутом 15с и тремя исходами: network / server / json
// Копия логики из ticket.html:166, index.html:175, manage.html:223 — теперь один модуль.

export const FETCH_TIMEOUT_MS = 30000;

export type ApiResult =
  | { kind: 'network'; message: string }
  | { kind: 'server'; http: number }
  | { kind: 'json'; http: number; data: Record<string, unknown> };

export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, FETCH_TIMEOUT_MS) : 0;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    });
    const raw = await r.text();
    let data: Record<string, unknown> | null = null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
    if (timer) clearTimeout(timer);
    if (!data) return { kind: 'server', http: r.status };
    return { kind: 'json', http: r.status, data };
  } catch (e) {
    if (timer) clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    // AbortError + флаг таймаута → точный диагноз, иначе CORS/сеть
    const detail = timedOut ? 'timeout ' + FETCH_TIMEOUT_MS + 'ms' : msg;
    return { kind: 'network', message: detail };
  }
}

// Специфичные для трёх роутов URL — захардкожены как в ванили (Q14: events-dev)
export const MY_QR_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/WYmnxVM4xPAWZA1IvNZok/sync';
export const CHECKIN_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/rKoDYtiIVdbzlW59b57uH/sync';
export const MANAGE_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/CcGPwuW4ws5hkcaOPerEG/sync';
