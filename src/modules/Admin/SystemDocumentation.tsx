/**
 * SystemDocumentation — "System Documentation" tab of the Admin interface.
 * Generated, detailed documentation of the whole platform: architecture,
 * data stores, access control, audit trail, server API, scripts, standards.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, FileDown } from 'lucide-react';

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
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return DOCS;
    return DOCS.filter(s => JSON.stringify(s).toLowerCase().includes(needle));
  }, [q]);

  // ── Branded, colored, print-to-PDF document ─────────────────────────────────
  function downloadPdf() {
    const logo = new URL(`${import.meta.env.BASE_URL}mowt.jpg`, location.href).href;
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const body = DOCS.map(sec => `
      <section>
        <h2>${esc(sec.title)}</h2>
        ${sec.body.map(b => `
          ${b.h ? `<h3>${esc(b.h)}</h3>` : ''}
          ${b.p ? `<p>${esc(b.p)}</p>` : ''}
          ${b.bullets ? `<table class="kv">${b.bullets.map(x => {
            const i = x.indexOf(':') > 0 && x.indexOf(':') < 48 ? x.indexOf(':') : x.indexOf(' — ');
            const k = i > 0 ? x.slice(0, i) : ''; const v = i > 0 ? x.slice(i + (x[i] === ':' ? 1 : 3)) : x;
            return `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`;
          }).join('')}</table>` : ''}
          ${b.table ? `<table class="grid"><thead><tr>${b.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${b.table.rows.map(r => `<tr>${r.map((c, i2) => `<td class="${i2 === 0 ? 'first' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
        `).join('')}
      </section>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>UGROADS — System Documentation</title>
      <style>
        @page { margin: 14mm 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #16243a; margin: 0; font-size: 10.5px; line-height: 1.55; }
        header { display: flex; align-items: center; gap: 14px; border-bottom: 4px solid #0a3d62;
                 padding-bottom: 10px; margin-bottom: 14px; }
        header img { width: 58px; height: 58px; object-fit: contain; }
        header .t1 { font-size: 19px; font-weight: 800; color: #0a3d62; }
        header .t2 { font-size: 11px; color: #c0392b; font-weight: 700; }
        header .t3 { font-size: 9.5px; color: #555; }
        section { page-break-inside: avoid; margin-bottom: 12px; border: 1px solid #d7e1ec;
                  border-radius: 6px; overflow: hidden; }
        h2 { background: linear-gradient(90deg, #0a3d62, #1565a8); color: #fff; font-size: 12px;
             margin: 0; padding: 7px 12px; }
        h3 { color: #c0392b; font-size: 10.5px; margin: 10px 12px 2px; }
        p { margin: 8px 12px; }
        table { border-collapse: collapse; width: calc(100% - 24px); margin: 6px 12px 10px; }
        .kv td { border: 1px solid #e2e9f2; padding: 4px 8px; vertical-align: top; }
        .kv .k { width: 220px; font-weight: 700; color: #0a3d62; background: #f2f7fc; }
        .grid th { background: #0a3d62; color: #fff; text-align: left; padding: 5px 8px; font-size: 9.5px; }
        .grid td { border: 1px solid #d7e1ec; padding: 4px 8px; vertical-align: top; }
        .grid td.first { font-weight: 700; color: #0a3d62; background: #f2f7fc; white-space: nowrap; }
        .grid tr:nth-child(even) td { background: #fafcff; }
        .grid tr:nth-child(even) td.first { background: #ecf3fb; }
        footer { margin-top: 16px; border-top: 2px solid #0a3d62; padding-top: 6px;
                 font-size: 8.5px; color: #777; display: flex; justify-content: space-between; }
      </style></head><body>
      <header>
        <img src="${logo}" alt="MoWT" />
        <div>
          <div class="t1">Uganda National Roads Management Platform</div>
          <div class="t2">System Documentation — NRMS v4.0</div>
          <div class="t3">Department of National Roads · Ministry of Works &amp; Transport · Generated ${new Date().toISOString().slice(0, 10)}</div>
        </div>
      </header>
      ${body}
      <footer><span>UGROADS · DNR · Ministry of Works &amp; Transport</span><span>Canonical store: G: Drive repository</span></footer>
      <script>window.onload = () => setTimeout(() => window.print(), 350);</scr` + `ipt></body></html>`;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow pop-ups to export the PDF.'); return; }
    w.document.write(html);
    w.document.close();
  }

  const TH: React.CSSProperties = {
    textAlign: 'left', padding: '4px 8px', fontSize: 9, fontWeight: 800, color: '#fff',
    background: 'rgba(77,159,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em',
    border: '1px solid rgba(77,159,255,0.25)',
  };
  const TD: React.CSSProperties = {
    padding: '4px 8px', fontSize: 10.5, color: 'rgba(203,213,225,0.88)',
    border: '1px solid rgba(77,159,255,0.14)', verticalAlign: 'top',
  };

  return (
    <div style={{ padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <img src={`${import.meta.env.BASE_URL}mowt.jpg`} alt="MoWT"
          style={{ width: 30, height: 30, borderRadius: 7, background: '#fff', padding: 2, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={15} color="#4d9fff" />
            <span style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>System Documentation</span>
          </div>
          <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.65)' }}>
            NRMS v4.0 · complete platform reference · mirrored as DOCUMENTATION.md · view here or download the branded PDF
          </div>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…"
          style={{ background: 'rgba(10,16,30,0.9)', border: '1px solid rgba(77,159,255,0.25)', borderRadius: 7,
            color: '#e2e8f0', fontSize: 11, padding: '7px 10px', width: 170 }} />
        <button onClick={downloadPdf} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', cursor: 'pointer',
          background: 'linear-gradient(90deg, rgba(192,57,43,0.25), rgba(192,57,43,0.12))',
          border: '1px solid rgba(239,68,68,0.45)', borderRadius: 8, color: '#fca5a5',
          fontSize: 11, fontWeight: 800 }}>
          <FileDown size={13} /> Download PDF
        </button>
      </div>

      {/* Narrow-margin documentation grid — all sections open by default */}
      {visible.map(sec => {
        const isOpen = q.trim() ? true : !closed[sec.id];
        return (
          <div key={sec.id} style={{ marginBottom: 6, background: 'rgba(8,14,28,0.7)',
            border: '1px solid rgba(77,159,255,0.18)', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setClosed(o => ({ ...o, [sec.id]: isOpen }))} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px',
              background: 'linear-gradient(90deg, rgba(10,61,98,0.55), rgba(77,159,255,0.12))',
              border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {isOpen ? <ChevronDown size={13} color="#4d9fff" /> : <ChevronRight size={13} color="rgba(148,163,184,0.6)" />}
              <span style={{ fontSize: 11.5, fontWeight: 800, color: '#9bd0ff' }}>{sec.title}</span>
            </button>
            {isOpen && (
              <div style={{ padding: '4px 10px 8px' }}>
                {sec.body.map((b, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    {b.h && <div style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24', margin: '4px 0 3px' }}>{b.h}</div>}
                    {b.p && <div style={{ fontSize: 10.5, color: 'rgba(203,213,225,0.82)', lineHeight: 1.55, margin: '2px 0' }}>{b.p}</div>}
                    {b.bullets && (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {b.bullets.map((x, j) => {
                            const ci = x.indexOf(':') > 0 && x.indexOf(':') < 48 ? x.indexOf(':') : x.indexOf(' — ');
                            const k = ci > 0 ? x.slice(0, ci) : '';
                            const v = ci > 0 ? x.slice(ci + (x[ci] === ':' ? 1 : 3)) : x;
                            return (
                              <tr key={j}>
                                <td style={{ ...TD, width: 210, fontWeight: 700, color: '#9bd0ff',
                                  background: 'rgba(77,159,255,0.07)', whiteSpace: 'normal' }}>{k}</td>
                                <td style={TD}>{v}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    {b.table && (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>{b.table.head.map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                        <tbody>
                          {b.table.rows.map((r, j) => (
                            <tr key={j}>{r.map((c, k2) => (
                              <td key={k2} style={{ ...TD, fontWeight: k2 === 0 ? 700 : 400,
                                color: k2 === 0 ? '#9bd0ff' : (TD.color as string),
                                background: k2 === 0 ? 'rgba(77,159,255,0.07)' : undefined }}>{c}</td>
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
      <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.5)', marginTop: 8 }}>
        Generated 2026-06-11 · Uganda NRMS v4.0 · DNR · Ministry of Works &amp; Transport
      </div>
    </div>
  );
}
