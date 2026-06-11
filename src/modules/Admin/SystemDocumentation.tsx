/**
 * SystemDocumentation — "Sources & Evidence" tab of the Admin interface.
 * Generated, detailed documentation of the whole platform: architecture,
 * data stores, access control, audit trail, server API, scripts, standards.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen } from 'lucide-react';

interface DocSection { id: string; title: string; body: Array<{ h?: string; p?: string; bullets?: string[]; table?: { head: string[]; rows: string[][] } }> }

const DOCS: DocSection[] = [
  {
    id: 'overview', title: '1 · Platform Overview',
    body: [
      { p: 'The Uganda National Roads Management Platform (UGROADS, NRMS v4.0) is a single-page React application for the Department of National Roads, Ministry of Works & Transport. It unifies RMS (road management), PMS (pavement), BMS (bridges), traffic, road reserve, budget, lifecycle and investment views over one canonical dataset.' },
      { bullets: [
        'Frontend: React 18 + TypeScript + Vite, dark glassmorphism design system (src/shared/glass.ts)',
        'Hosting: static build on GitHub Pages (gh-pages branch); no server required to view dashboards',
        'Canonical data store: the Google Drive repository "G:\\My Drive\\MOWT\\Uganda National Road Network Repository"',
        'Optional mirror: Supabase Postgres (42 tables) — read-only to the public, opt-in for writes',
        'Local data-entry server: Express (server/, port 3001) for writes, audit logging and the Fable 5 bot proxy',
      ]},
    ],
  },
  {
    id: 'architecture', title: '2 · Architecture & Data Flow',
    body: [
      { h: 'Read path (dashboards)', bullets: [
        'Build time: data files in public/data/ are bundled from the G: repository and served statically',
        'Runtime: views load bundled JSON/GeoJSON first; Supabase is only a fallback if a bundle file is missing',
        'network_stats, TCS stations, bridge works, condition lookups, GIS layers — all Drive-first',
      ]},
      { h: 'Write path (field capture)', bullets: [
        'Capture forms POST to the local data-entry server (http://localhost:3001)',
        'The server appends each submission to captures/<table>.jsonl in the G: repository (source of truth)',
        'If SUPABASE_MIRROR=on in server/.env, the write is also mirrored to Supabase',
        'drive_sync.py folds captures into app_data/ and public/data/captures_<table>.json for the next build',
      ]},
      { h: 'Offline behaviour', bullets: [
        'If the server is unreachable, capture falls back to the Supabase mirror, then to a local queue',
        'Audit events queue in browser localStorage (cap 500) and flush when the server is next reachable',
      ]},
    ],
  },
  {
    id: 'datastores', title: '3 · Data Stores',
    body: [
      { table: { head: ['Store', 'Location', 'Role'], rows: [
        ['G: Drive repository', 'G:\\My Drive\\MOWT\\Uganda National Road Network Repository', 'CANONICAL — all data, manuals, schema, scripts'],
        ['App data bundle', 'uganda-roads/public/data/ (44+ JSON/GeoJSON files)', 'What the deployed site reads'],
        ['Field captures', 'captures/<table>.jsonl (G: root)', 'Append-only submissions from the data-entry server'],
        ['Audit logs', 'logs/audit_YYYY-MM.jsonl (G: root)', 'Logins, failed logins, page views, changes'],
        ['Supabase mirror', 'Project udionwmqmjcfzbdhoetv (42 tables)', 'Optional mirror; RLS read-only for the public'],
        ['Git history', 'github.com/priscananjehe1996/uganda-roads (main + gh-pages)', 'Versioned source + deploys'],
      ]}},
      { p: 'Key bundle files: network2026.geojson (road network), network_links.json (1,017 links, FY25-26), network_stats.json, link_condition_lookup.json, bridges2026.geojson (546, BMS inventory + element conditions + predicted 2026 AADT), tcs_stations.json, traffic/ROMDAS/overloading summaries, bundle.json (RoadAtlas), plus rail/ferry/airport/hydrology layers.' },
    ],
  },
  {
    id: 'access', title: '4 · Access Control — Three Levels, Three Interfaces',
    body: [
      { table: { head: ['Level', 'Password', 'Interface'], rows: [
        ['rms', 'rms', 'Mobile-first field capture shell ONLY — capture forms + own submissions, no dashboards, no bot'],
        ['super', 'super', 'Every dashboard, map and report + CSV/Excel export — strictly read-only, no input/audit/admin'],
        ['admin', 'admin', 'Everything at once: all of super + Admin Tools, Activity Log, Data Audit, Data Capture, Pending Submissions'],
      ]}},
      { bullets: [
        'Allowed users: src/modules/Auth/allowedUsers.ts — emails as first.lastname@unra.go.ug; the part before @ also works as a username',
        'One hardcoded password per level (the level name); the whole app sits behind the login gate',
        'Enforcement: AppGate routes the interface by role; canAccessView() blocks admin-only views; CaptureButton hides for non-admin',
        'LIMITATION: credentials ship in the public bundle — this is an access-tier gate for trusted staff, not protection for confidential data',
      ]},
    ],
  },
  {
    id: 'audit', title: '5 · Audit Trail — Track & Trace',
    body: [
      { bullets: [
        'Every login, failed login attempt, logout, page view and data change is logged',
        'Events are written to logs/audit_YYYY-MM.jsonl in the G: repository (one JSON line each, monthly files)',
        'Client: src/modules/Auth/auditLog.ts posts events to the server; offline events queue in localStorage and flush later',
        'Server: every insert/update is auto-audited with the acting user (x-user-email / x-user-role headers)',
        'Viewer: Admin Tools → Activity Log — summary cards, per-user login summary, filterable event trail, month selector, CSV export',
      ]},
    ],
  },
  {
    id: 'server', title: '6 · Local Data-Entry Server (server/)',
    body: [
      { p: 'Express server on port 3001. Runs fully without Supabase credentials ("Drive-only mode"). Start: cd server && npm install && npm run dev.' },
      { table: { head: ['Endpoint', 'Purpose'], rows: [
        ['GET /health', 'Liveness check'],
        ['GET /api/admin/tables', 'List the table allowlist'],
        ['POST /api/admin/:table[?upsert=cols]', 'Insert/upsert records → captures/<table>.jsonl (+ optional mirror)'],
        ['PATCH /api/admin/:table/:id', 'Update a record (audited, Drive-first)'],
        ['POST/PATCH /api/admin/road-reserve/records', 'Road reserve convenience endpoints'],
        ['POST /api/audit', 'Ingest audit events from the app'],
        ['GET /api/audit?month=YYYY-MM', 'Serve the audit trail to the Activity Log'],
        ['POST /api/bot/chat', 'Fable 5 proxy (ANTHROPIC_API_KEY stays server-side)'],
      ]}},
      { h: 'Environment (server/.env — gitignored)', bullets: [
        'DRIVE_DATA_DIR — capture directory (default: G:/.../captures)',
        'SUPABASE_MIRROR — on|off (default off)',
        'SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — only needed when the mirror is on',
        'ANTHROPIC_API_KEY — enables the LLM bot proxy',
        'Writes are restricted to an explicit 12-table allowlist; there is no write-to-any-table endpoint',
      ]},
    ],
  },
  {
    id: 'security', title: '7 · Security Model',
    body: [
      { bullets: [
        'Public anon Supabase key: SELECT-only. supabase_enable_rls.sql enables RLS on all 42 tables with a read-only anon policy and zero write policies',
        'service_role key: lives ONLY in server/.env (gitignored); never in the browser bundle. Rotate after any exposure',
        'supabase_free_space.sql: TRUNCATEs all tables (G: is canonical) to keep the free-tier server empty',
        'Anthropic API key: server-side env, or operator-pasted browser localStorage — never committed or bundled',
        'Login gate: access-tiering only (see §4); audit trail provides accountability',
        'Login screen shows no credentials or roster hints',
      ]},
    ],
  },
  {
    id: 'build', title: '8 · Build & Deployment Workflow',
    body: [
      { bullets: [
        'Source of truth: the G: Drive clone (git repo, branch main)',
        'Builds run on local disk (C:\\tmp\\uganda-build) because node_modules cannot live on Google Drive',
        'Steps: copy changed src → tsc -b (typecheck) → vite build → overlay dist/ onto the gh-pages worktree → push',
        'Deploys are overlay-style: old hashed assets remain so cached clients keep working',
        'Live site: https://priscananjehe1996.github.io/uganda-roads/',
      ]},
    ],
  },
  {
    id: 'scripts', title: '9 · Scripts & Tooling (G: root + uganda-roads/scripts)',
    body: [
      { table: { head: ['Script', 'Purpose'], rows: [
        ['drive_sync.py', 'Fold captures/*.jsonl into app_data/ + public/data/captures_<table>.json'],
        ['scripts/export_bundle.py', 'Generate public/data/bundle.json (region intelligence, bridge corridors, digital twin, catalog)'],
        ['etl_all.py / scripts/etl_all.py', 'Re-upload datasets to the Supabase mirror (uses SUPABASE_SERVICE_ROLE_KEY)'],
        ['supabase_schema.sql', 'Full 42-table schema'],
        ['supabase_enable_rls.sql', 'Enable RLS everywhere, read-only anon policy'],
        ['supabase_free_space.sql', 'TRUNCATE all tables + VACUUM to free the server'],
        ['supabase_secure_grants.sql', 'Legacy grant-level write revoke (superseded by RLS script)'],
      ]}},
    ],
  },
  {
    id: 'standards', title: '10 · UNRA Standards & Methodology',
    body: [
      { h: 'VCI condition bands (platform convention)', table: { head: ['Band', 'VCI'], rows: [
        ['Very Good', '≥ 85'], ['Good', '75 – 84.9'], ['Fair', '65 – 74.9'], ['Poor', '55 – 64.9'], ['Very Poor', '< 55'],
      ]}},
      { h: 'Visual Inspections Manual (Feb 2012) — codified in src/shared/unraStandards.ts', bullets: [
        'Defect grading: 1–5 scale (degree × extent)',
        '6 paved defect types; 9 unpaved defect types',
        'Inventory: 11 continuous + 9 discrete items, 8-way categorisation',
        '16-document Asset Management Manuals registry (0. Manuals/Asset Management Manuals)',
      ]},
      { p: 'Network reference: 21,302 km (NDPIV FY25-26), 1,017 links, ~30% paved, 546 bridges, 6 maintenance regions.' },
    ],
  },
  {
    id: 'modules', title: '11 · Module Directory',
    body: [
      { table: { head: ['Section', 'Contents'], rows: [
        ['RMS — Road Mgmt System', 'Network overview, road inventory (manual taxonomy), GIS map, atlas'],
        ['Pavement Management', 'Condition surveys, VCI/IRI/rutting analytics, maintenance programme, ROMDAS'],
        ['Traffic Information', 'TCS stations, AADT, projections, growth factors, overloading, trends & risk'],
        ['Bridge Management', 'Registry (483), inspections, condition, priority, works, photo twin'],
        ['Road Reserve Management', 'Encroachment register, gazette status, usage applications (MOWT Form 2)'],
        ['Projects & Works / Tracker', 'Ongoing projects, progress vs plan, OPRC'],
        ['Public Investment / Budget', 'PIM pipeline, budget & maintenance financing'],
        ['Life Cycle Management', 'Intervention timeline map, deterioration modelling, HDM-4'],
        ['Global Case Studies', '195-country road-agency literature matrix'],
        ['Sources & Evidence', 'Dataset catalogue, tabular summaries, downloads, spec audit'],
        ['Admin Tools', 'Activity Log (audit) · Platform Mind Map · Data Audit · this documentation'],
        ['Road Asset Bot', 'Fable 5 LLM assistant grounded in platform data (server proxy or local key)'],
      ]}},
    ],
  },
  {
    id: 'ops', title: '12 · Operations Runbook',
    body: [
      { bullets: [
        'Start data-entry server: cd uganda-roads/server && npm run dev (terminal stays open)',
        'After field sessions: python drive_sync.py, then rebuild + deploy to publish captured data',
        'Refresh RoadAtlas bundle: python scripts/export_bundle.py',
        'Manage users: edit src/modules/Auth/allowedUsers.ts, rebuild, deploy',
        'Review activity: Admin Tools → Activity Log (or open logs/audit_*.jsonl directly in G:)',
        'Archive logs: monthly files in logs/ can be moved/deleted freely; Google Drive keeps file version history',
        'Bug register & outstanding actions: uganda-roads/BUGS.md',
      ]},
    ],
  },
];

export default function SystemDocumentation() {
  const [open, setOpen] = useState<Record<string, boolean>>({ overview: true });
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DOCS;
    return DOCS.filter(s => JSON.stringify(s).toLowerCase().includes(needle));
  }, [q]);

  const TH: React.CSSProperties = {
    textAlign: 'left', padding: '5px 9px', fontSize: 9, fontWeight: 800, color: 'rgba(148,163,184,0.7)',
    textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(77,159,255,0.18)',
  };
  const TD: React.CSSProperties = {
    padding: '5px 9px', fontSize: 11, color: 'rgba(203,213,225,0.85)',
    borderBottom: '1px solid rgba(255,255,255,0.04)', verticalAlign: 'top',
  };

  return (
    <div style={{ padding: '14px 16px', maxWidth: 980 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <BookOpen size={18} color="#4d9fff" />
        <div style={{ fontSize: 16, fontWeight: 900, color: '#e2eaf4' }}>System Documentation — Sources &amp; Evidence</div>
      </div>
      <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.65)', marginBottom: 12 }}>
        Generated reference for the whole platform: architecture, data stores, access control, audit, server API, scripts, standards and operations.
        Mirrored as DOCUMENTATION.md in the repository root.
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the documentation…"
        style={{ width: '100%', maxWidth: 420, boxSizing: 'border-box', marginBottom: 14,
          background: 'rgba(10,16,30,0.9)', border: '1px solid rgba(77,159,255,0.25)', borderRadius: 8,
          color: '#e2e8f0', fontSize: 12, padding: '8px 12px' }} />

      {visible.map(s => {
        const isOpen = q.trim() ? true : !!open[s.id];
        return (
          <div key={s.id} style={{ marginBottom: 8, background: 'rgba(8,14,28,0.7)',
            border: '1px solid rgba(77,159,255,0.13)', borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setOpen(o => ({ ...o, [s.id]: !isOpen }))} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {isOpen ? <ChevronDown size={14} color="#4d9fff" /> : <ChevronRight size={14} color="rgba(148,163,184,0.6)" />}
              <span style={{ fontSize: 12.5, fontWeight: 800, color: isOpen ? '#4d9fff' : '#cbd5e1' }}>{s.title}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 16px 14px 35px' }}>
                {s.body.map((b, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    {b.h && <div style={{ fontSize: 11, fontWeight: 800, color: '#e2eaf4', marginBottom: 5 }}>{b.h}</div>}
                    {b.p && <div style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.8)', lineHeight: 1.65 }}>{b.p}</div>}
                    {b.bullets && (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {b.bullets.map((x, j) => (
                          <li key={j} style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.8)', lineHeight: 1.7 }}>{x}</li>
                        ))}
                      </ul>
                    )}
                    {b.table && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                        <thead><tr>{b.table.head.map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                        <tbody>
                          {b.table.rows.map((r, j) => (
                            <tr key={j}>{r.map((c, k) => (
                              <td key={k} style={{ ...TD, fontWeight: k === 0 ? 700 : 400,
                                color: k === 0 ? '#9bd0ff' : TD.color, whiteSpace: k === 0 ? 'nowrap' : 'normal' }}>{c}</td>
                            ))}</tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{ fontSize: 9.5, color: 'rgba(100,116,139,0.5)', marginTop: 10 }}>
        Generated 2026-06-11 · Uganda NRMS v4.0 · DNR · Ministry of Works &amp; Transport
      </div>
    </div>
  );
}
