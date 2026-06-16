import type { UserRole } from './authTypes';

/**
 * ALLOWED USERS — the single place to manage who can sign in.
 * Email format: first.lastname@unra.go.ug. The part before the @ also works
 * as a username at the login screen (e.g. "prisca.nanjehe").
 *
 * Passwords are per LEVEL, not per user (hardcoded as requested —
 * the password is simply the level name):
 *   rms   → rms     NRMS platform field data capture (mobile shell)
 *   bms   → bms     NBMS standalone field data capture (mobile shell)
 *   tis   → tis     NTIS standalone field data capture (mobile shell)
 *   super → super   dashboards & reports of everything, read-only
 *   admin → admin   everything, all at once
 *
 * Edit the rows below to add/remove staff. NOTE: this ships in the public
 * bundle — it is an access-tier gate for trusted staff, not real security.
 */
export interface AllowedUser {
  name: string;
  email: string;
  role: UserRole;
  region?: string;
  department?: string;
}

export const LEVEL_PASSWORDS: Record<UserRole, string> = {
  rms:   'rms',
  bms:   'bms',
  tis:   'tis',
  super: 'super',
  admin: 'admin',
};

export const ALLOWED_USERS: AllowedUser[] = [
  // ── ADMIN — full platform, admin tools, data audit, capture ────────────────
  { name: 'Prisca Nanjehe',   email: 'prisca.nanjehe@unra.go.ug',   role: 'admin', department: 'DNR · GIS & Asset Management' },
  { name: 'Moses Kiggundu',   email: 'moses.kiggundu@unra.go.ug',   role: 'admin', department: 'DNR · Systems' },

  // ── SUPER — dashboard view of everything + reports; no input, no admin ─────
  { name: 'Grace Namuli',     email: 'grace.namuli@unra.go.ug',     role: 'super', department: 'Directorate of National Roads' },
  { name: 'Peter Ssemanda',   email: 'peter.ssemanda@unra.go.ug',   role: 'super', department: 'Planning & Programming' },
  { name: 'Florence Adong',   email: 'florence.adong@unra.go.ug',   role: 'super', department: 'Monitoring & Evaluation' },

  // ── RMS — NRMS platform field data entry only (mobile interface) ───────────
  { name: 'Robert Okello',    email: 'robert.okello@unra.go.ug',    role: 'rms', region: 'Northern', department: 'Field Survey' },
  { name: 'Agnes Nakato',     email: 'agnes.nakato@unra.go.ug',     role: 'rms', region: 'Central',  department: 'Field Survey' },
  { name: 'James Tumwine',    email: 'james.tumwine@unra.go.ug',    role: 'rms', region: 'Western',  department: 'Field Survey' },
  { name: 'Sarah Namatovu',   email: 'sarah.namatovu@unra.go.ug',   role: 'rms', region: 'Central',  department: 'Field Survey' },
  { name: 'Isaac Wandera',    email: 'isaac.wandera@unra.go.ug',    role: 'rms', region: 'Eastern',  department: 'Field Survey' },

  // ── BMS — NBMS standalone field data entry (bridge inspections) ────────────
  { name: 'David Opio',       email: 'david.opio@unra.go.ug',       role: 'bms', region: 'Northern', department: 'Bridge Inspections' },
  { name: 'Mary Acan',        email: 'mary.acan@unra.go.ug',        role: 'bms', region: 'Eastern',  department: 'Bridge Inspections' },
  { name: 'Samuel Kasule',    email: 'samuel.kasule@unra.go.ug',    role: 'bms', region: 'Central',  department: 'Bridge Inspections' },

  // ── TIS — NTIS standalone field data entry (traffic counts) ────────────────
  { name: 'Patrick Mugisha',  email: 'patrick.mugisha@unra.go.ug',  role: 'tis', region: 'Western',  department: 'Traffic Surveys' },
  { name: 'Catherine Akello', email: 'catherine.akello@unra.go.ug', role: 'tis', region: 'Northern', department: 'Traffic Surveys' },
  { name: 'Joseph Mutumba',   email: 'joseph.mutumba@unra.go.ug',   role: 'tis', region: 'Central',  department: 'Traffic Surveys' },
];
