# Uganda National Roads Management Platform — System Documentation

> Generated 2026-06-11 · NRMS v4.0 · Department of National Roads, Ministry of Works & Transport.
> The same content is browsable in-app: **Admin Tools → Sources & Evidence** (admin level).

## 1 · Platform overview
Single-page React 18 + TypeScript + Vite application unifying RMS, PMS, BMS, traffic,
road reserve, budget, lifecycle and investment views over one canonical dataset.
Hosted statically on GitHub Pages (`gh-pages` branch) — dashboards need no server.

## 2 · Architecture & data flow
- **Read path:** `public/data/` JSON/GeoJSON (bundled from the G: repository) loads first;
  Supabase is only a fallback when a bundle file is missing.
- **Write path:** capture forms POST to the local data-entry server →
  `captures/<table>.jsonl` in the G: repository (source of truth) → optional Supabase
  mirror (`SUPABASE_MIRROR=on`) → `drive_sync.py` folds captures back into the bundle.
- **Offline:** captures fall back to the mirror then a local queue; audit events queue
  in localStorage (cap 500) and flush when the server is reachable.

## 3 · Data stores
| Store | Location | Role |
|---|---|---|
| G: Drive repository | `G:\My Drive\MOWT\Uganda National Road Network Repository` | **Canonical** — data, manuals, schema, scripts |
| App data bundle | `uganda-roads/public/data/` (44+ files) | What the deployed site reads |
| Field captures | `captures/<table>.jsonl` | Append-only submissions |
| Audit logs | `logs/audit_YYYY-MM.jsonl` | Logins, views, changes |
| Supabase mirror | project `udionwmqmjcfzbdhoetv`, 42 tables | Optional; public read-only (RLS) |
| Git | `priscananjehe1996/uganda-roads` (main + gh-pages) | Versioned source + deploys |

## 4 · Access control — three levels, three interfaces
| Level | Password | Interface |
|---|---|---|
| `rms` | `rms` | Mobile-first field capture only (no dashboards, no bot) |
| `super` | `super` | Every dashboard/report + exports, strictly read-only |
| `admin` | `admin` | Everything: super + Admin Tools, Activity Log, Data Audit, capture |

Roster: `src/modules/Auth/allowedUsers.ts` (`first.lastname@unra.go.ug`; the local part
also works as a username). Whole app sits behind the login gate (`AppGate`), views are
filtered by `permissions.ts`, capture entry points hidden for non-admin.
**Limitation:** credentials ship in the public bundle — access tiering, not secrecy.

## 5 · Audit trail — track & trace
Every login, failed attempt, logout, **page view** and **data change** is logged to
`logs/audit_YYYY-MM.jsonl`. Client module `src/modules/Auth/auditLog.ts`; server
auto-audits writes with `x-user-email`/`x-user-role`. Viewer: **Admin Tools →
Activity Log** (summary cards, per-user login table, filterable trail, CSV export).

## 6 · Local data-entry server (`server/`)
Express, port 3001, runs without Supabase credentials (Drive-only mode).
Endpoints: `GET /health` · `GET /api/admin/tables` · `POST /api/admin/:table[?upsert=]`
· `PATCH /api/admin/:table/:id` · road-reserve convenience routes · `POST /api/audit`
· `GET /api/audit?month=` · `POST /api/bot/chat` (Fable 5 proxy).
Env (`server/.env`, gitignored): `DRIVE_DATA_DIR`, `SUPABASE_MIRROR`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. Writes restricted to a 12-table allowlist.

## 7 · Security model
- Public anon key: SELECT-only — `supabase_enable_rls.sql` (RLS on all 42 tables, no write policies).
- `supabase_free_space.sql`: TRUNCATE everything (G: is canonical).
- service_role + Anthropic keys: server-side env only; never bundled. Rotate after exposure.
- Login screen shows no credential hints.

## 8 · Build & deployment
Edit in the G: clone → copy changed files to `C:\tmp\uganda-build` (node_modules can't
live on Drive) → `npx tsc -b` → `npx vite build` → overlay `dist/` onto the gh-pages
worktree → push. Overlay deploys keep old hashed assets for cached clients.
Live: https://priscananjehe1996.github.io/uganda-roads/

## 9 · Scripts (G: root + `scripts/`)
`drive_sync.py` (captures → bundle) · `scripts/export_bundle.py` (RoadAtlas bundle.json)
· `etl_all.py` (re-upload mirror) · `supabase_schema.sql` · `supabase_enable_rls.sql`
· `supabase_free_space.sql` · `supabase_secure_grants.sql` (legacy).

## 10 · UNRA standards
VCI bands: Very Good ≥85 · Good 75–84.9 · Fair 65–74.9 · Poor 55–64.9 · Very Poor <55.
Visual Inspections Manual (Feb 2012) codified in `src/shared/unraStandards.ts`:
1–5 defect grading, 6 paved + 9 unpaved defects, 11 continuous + 9 discrete inventory
items, 8-way categorisation, 16-manual registry. Network: 21,302 km, 1,017 links,
~30% paved, 546 bridges, 6 maintenance regions (NDPIV FY25-26).

## 11 · Module directory
RMS hub · Pavement Management · Traffic Information · Bridge Management · Road Reserve
· Projects & Works/Tracker · Public Investment · Budget & Maintenance · Life Cycle
· Global Case Studies (195 countries) · Sources & Evidence · Admin Tools
(Activity Log / Mind Map / Data Audit / this documentation) · Road Asset Bot (Fable 5).

## 12 · Operations runbook
1. Start server: `cd server && npm run dev`.
2. After field sessions: `python drive_sync.py`, rebuild, deploy.
3. Refresh atlas bundle: `python scripts/export_bundle.py`.
4. Manage users: edit `allowedUsers.ts`, rebuild, deploy.
5. Review activity: Admin Tools → Activity Log (or `logs/audit_*.jsonl`).
6. Bug register / outstanding actions: `BUGS.md`.
