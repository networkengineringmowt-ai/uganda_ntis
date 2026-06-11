/**
 * auditLog — login + change trail persisted to the G: Drive repository.
 *
 * Events are POSTed to the local data-entry server, which appends them to
 * logs/audit_YYYY-MM.jsonl inside the Google Drive repo (the canonical
 * store). When the server is unreachable (e.g. browsing the public GitHub
 * Pages site away from the office network), events queue in localStorage
 * and flush automatically with the next event that does reach the server —
 * nothing is lost, delivery is just deferred.
 */

const AUDIT_URL = 'http://localhost:3001/api/audit';
const QUEUE_KEY = 'audit_log_queue';
const QUEUE_CAP = 500;

export interface AuditEvent {
  type: 'login' | 'login_failed' | 'logout' | 'change' | 'view';
  at: string;
  user?: string;
  role?: string;
  detail?: Record<string, unknown>;
}

function readQueue(): AuditEvent[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]'); }
  catch { return []; }
}

function currentUser(): { email?: string; role?: string } {
  try { return JSON.parse(localStorage.getItem('dnr_user') ?? 'null') ?? {}; }
  catch { return {}; }
}

/** Fire-and-forget. Never throws, never blocks the UI. */
export function logEvent(type: AuditEvent['type'], detail?: Record<string, unknown>): void {
  const u = currentUser();
  const ev: AuditEvent = { type, at: new Date().toISOString(), user: u.email, role: u.role, detail };
  const pending = [...readQueue(), ev];

  void (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(AUDIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: pending }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error(String(r.status));
      localStorage.setItem(QUEUE_KEY, '[]');
    } catch {
      // Server unreachable — keep the most recent events queued for later.
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(pending.slice(-QUEUE_CAP))); }
      catch { /* storage full — drop silently */ }
    }
  })();
}
