/**
 * directory — the "active directory" of platform users + the access-approval
 * workflow. New @unra.go.ug users land as `pending` and must be approved by an
 * admin before they can use the app; admins can revoke access. Legacy roster
 * users (allowedUsers.ts) are auto-accepted and never gated.
 *
 * Backing store mirrors auditLog: the data-entry server persists the directory
 * to the G: Drive repo (directory/users.json) — the shared, canonical store.
 * When the server is unreachable (public static site) it falls back to this
 * browser's localStorage so the flow still works locally; it reconciles with
 * the server the next time one is reachable.
 */
import type { UserRole } from './authTypes';
import { ALLOWED_USERS } from './allowedUsers';

const DIR_URL   = 'http://localhost:3001/api/directory';
const LOCAL_KEY = 'idm_directory';

export type AccessStatus = 'active' | 'pending' | 'revoked' | 'rejected' | 'new';

export interface DirEntry {
  email: string;
  name?: string;
  role?: UserRole | string;
  status: Exclude<AccessStatus, 'new'>;
  requestedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  region?: string;
  department?: string;
}

// Bootstrap admins — the ONLY accounts auto-accepted right now. Everyone else
// (including other roster names) must request access and be approved by an
// admin. To pre-approve more staff, add their @unra.go.ug emails here.
const AUTO_ACCEPT = new Set<string>([
  'prisca.nanjehe@unra.go.ug',
]);
export const isLegacyUser = (email: string) => email.trim().toLowerCase().endsWith('@unra.go.ug') || AUTO_ACCEPT.has(email.trim().toLowerCase());

// ── localStorage fallback ─────────────────────────────────────────────────────
function readLocal(): Record<string, DirEntry> {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}'); } catch { return {}; }
}
function writeLocal(map: Record<string, DirEntry>) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(map)); } catch { /* full — ignore */ }
}
function upsertLocal(e: DirEntry) {
  const m = readLocal(); m[e.email.toLowerCase()] = e; writeLocal(m);
}

async function serverGet(): Promise<DirEntry[] | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(DIR_URL, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()).users as DirEntry[];
  } catch { return null; }
}

async function serverPost(body: Record<string, unknown>): Promise<DirEntry | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch(DIR_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()).user as DirEntry;
  } catch { return null; }
}

/** Current access status for an email (legacy → active; server, then local). */
export async function getStatus(email: string): Promise<AccessStatus> {
  const id = email.trim().toLowerCase();
  if (isLegacyUser(id)) return 'active';
  const fromServer = await serverGet();
  if (fromServer) {
    const e = fromServer.find(u => u.email.toLowerCase() === id);
    if (e) { upsertLocal(e); return e.status; }   // cache server truth locally
    return 'new';
  }
  return readLocal()[id]?.status ?? 'new';
}

/** Raise an access request for a brand-new user (idempotent). */
export async function requestAccess(u: { email: string; name?: string; role?: string }): Promise<void> {
  const id = u.email.trim().toLowerCase();
  if (isLegacyUser(id)) return;
  const entry: DirEntry = {
    email: id, name: u.name, role: u.role, status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const saved = await serverPost({ action: 'request', email: id, name: u.name, role: u.role });
  upsertLocal(saved ?? entry);
}

/** Full directory for the admin Identity Manager (legacy users merged as active). */
export async function listDirectory(): Promise<DirEntry[]> {
  const legacy: DirEntry[] = ALLOWED_USERS.map(u => ({
    email: u.email.toLowerCase(), name: u.name, role: u.role, status: 'active',
    region: u.region, department: u.department, decidedBy: 'roster (auto-accepted)',
  }));
  const server = await serverGet();
  const dynamic = server ?? Object.values(readLocal());
  // Merge: a decided directory entry overrides the legacy default for the same email.
  const byEmail = new Map<string, DirEntry>();
  legacy.forEach(e => byEmail.set(e.email, e));
  dynamic.forEach(e => byEmail.set(e.email.toLowerCase(), e));
  return [...byEmail.values()].sort((a, b) =>
    (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1)
    || (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
}

/** Admin decision. action: approve | reject | revoke | restore */
export async function decide(
  email: string, action: 'approve' | 'reject' | 'revoke' | 'restore',
  by: string, role?: string,
): Promise<void> {
  const id = email.trim().toLowerCase();
  const saved = await serverPost({ action, email: id, by, role });
  const status: DirEntry['status'] =
    action === 'reject' ? 'rejected' : action === 'revoke' ? 'revoked' : 'active';
  upsertLocal(saved ?? {
    ...(readLocal()[id] ?? { email: id }), status,
    decidedAt: new Date().toISOString(), decidedBy: by, role,
  });
}
