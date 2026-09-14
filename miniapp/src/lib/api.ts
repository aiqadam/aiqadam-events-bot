// Общий fetch с таймаутом 15с и тремя исходами: network / server / json
// Копия логики из ticket.html:166, index.html:175, manage.html:223 — теперь один модуль.

export const FETCH_TIMEOUT_MS = 15000;

export type ApiResult =
  | { kind: 'network' }
  | { kind: 'server'; http: number }
  | { kind: 'json'; http: number; data: Record<string, unknown> };

export async function postJson(url: string, body: unknown): Promise<ApiResult> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS) : 0;

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
  } catch {
    if (timer) clearTimeout(timer);
    return { kind: 'network' };
  }
}

// Специфичные для трёх роутов URL — захардкожены как в ванили (Q14: events-dev)
export const MY_QR_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/WYmnxVM4xPAWZA1IvNZok/sync';
export const CHECKIN_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/rKoDYtiIVdbzlW59b57uH/sync';
export const MANAGE_API = 'https://app.flow.aiqadam.org/api/v1/webhooks/CcGPwuW4ws5hkcaOPerEG/sync';
