/**
 * Uganda National Roads — Local Data-Entry Write-Back Server
 * ───────────────────────────────────────────────────────────
 * Minimal Express server that performs PRIVILEGED writes to Supabase using
 * the service_role key (bypasses Row Level Security). It exists so that
 * trusted local operators (DNR/UNRA field staff using the React app on a
 * local network) can submit condition surveys, encroachment reports,
 * gazette updates, work orders, etc. without the public anon key needing
 * INSERT/UPDATE/DELETE rights on sensitive tables.
 *
 * SECURITY
 *  - The service_role key lives ONLY in server/.env (gitignored). It must
 *    NEVER be sent to, or embedded in, the browser bundle.
 *  - This server is intended to run on a trusted local network / VPN, not
 *    be exposed directly to the public internet. Add real authentication
 *    (e.g. Supabase Auth JWT verification) before doing that.
 *  - Writes are restricted to an explicit table allowlist below — there is
 *    no generic "write to any table" endpoint.
 *
 * Run:
 *    cd server && npm install && npm run dev
 *
 * The React app (Vite) should call this server at http://localhost:3001
 * for any write/update/delete operation; reads can continue to go straight
 * to Supabase via the public anon key (see src/lib/supabase.ts).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const PORT        = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGIN  = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '\n[FATAL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    '        Copy server/.env.example to server/.env and fill in real values\n' +
    '        from Supabase Dashboard → Settings → API.\n'
  );
  process.exit(1);
}

// Admin client — service_role key bypasses RLS. SERVER-SIDE ONLY.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

// ── Request log (lightweight) ────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'uganda-roads-data-entry-server', time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// Table allowlist — only these tables may be written to via this server, and
// only via the operations listed. This intentionally excludes reference/
// lookup tables (e.g. hdm4_calibration, network_stats) that should be
// maintained through migrations/SQL, not the field data-entry UI.
// ─────────────────────────────────────────────────────────────────────────────
const WRITABLE_TABLES = {
  // RMS — condition survey submissions from the field
  road_link_condition:        { ops: ['insert', 'update'], idColumn: 'id' },
  // BMS — bridge inspection / condition / works write-back
  structure_condition_history:{ ops: ['insert', 'update'], idColumn: 'id' },
  inspections:                { ops: ['insert', 'update'], idColumn: 'id' },
  work_orders:                { ops: ['insert', 'update'], idColumn: 'id' },
  bridge_documents:           { ops: ['insert'],            idColumn: 'id' },
  // PMS — maintenance programme updates
  maintenance_programme:      { ops: ['insert', 'update'], idColumn: 'id' },
  // Road Reserve Management — encroachment register & gazette status
  road_reserve_records:       { ops: ['insert', 'update'], idColumn: 'id' },
  road_reserve_encroachments: { ops: ['insert', 'update'], idColumn: 'id' },
  road_reserve_gazette:       { ops: ['insert', 'update'], idColumn: 'id' },
  // Road Reserve Usage applications (MOWT Form 2) — PII; service_role only.
  // The anon key has SELECT-only on these (see supabase_schema.sql), so all
  // applicant registration + application/permit writes MUST come through here.
  road_reserve_applicants:    { ops: ['insert', 'update'], idColumn: 'id' },
  road_reserve_applications:  { ops: ['insert', 'update'], idColumn: 'id' },
  // Project tracking
  project_tracker:            { ops: ['insert', 'update'], idColumn: 'id' },
};

function assertWritable(table, op) {
  const cfg = WRITABLE_TABLES[table];
  if (!cfg) {
    const err = new Error(`Table "${table}" is not in the write-back allowlist`);
    err.status = 403;
    throw err;
  }
  if (!cfg.ops.includes(op)) {
    const err = new Error(`Operation "${op}" is not permitted on "${table}"`);
    err.status = 403;
    throw err;
  }
  return cfg;
}

// ── List allowlisted tables (for the admin UI to introspect) ─────────────────
app.get('/api/admin/tables', (_req, res) => {
  res.json({
    tables: Object.entries(WRITABLE_TABLES).map(([table, cfg]) => ({ table, ...cfg })),
  });
});

// ── Generic insert: POST /api/admin/:table ───────────────────────────────────
// Body: { record: {...} } or { records: [{...}, ...] }
app.post('/api/admin/:table', async (req, res) => {
  const { table } = req.params;
  try {
    assertWritable(table, 'insert');
    const payload = req.body?.records ?? (req.body?.record ? [req.body.record] : null);
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: 'Request body must include "record" or non-empty "records"' });
    }
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select();
    if (error) throw Object.assign(new Error(error.message), { status: 400, details: error });
    res.status(201).json({ inserted: data?.length ?? 0, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Generic update: PATCH /api/admin/:table/:id ───────────────────────────────
// Body: { patch: {...} }
app.patch('/api/admin/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  try {
    const cfg = assertWritable(table, 'update');
    const patch = req.body?.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Request body must include a "patch" object' });
    }
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq(cfg.idColumn, id)
      .select();
    if (error) throw Object.assign(new Error(error.message), { status: 400, details: error });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: `No row in "${table}" with ${cfg.idColumn} = ${id}` });
    }
    res.json({ updated: data.length, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Convenience endpoints — Road Reserve Management write-back ───────────────
// These wrap the generic handlers with friendlier paths for the
// RoadReserveSection "Encroachment Register" and "Gazette & Legal Status"
// tabs once they're connected to live data (see // TODO comments in
// src/modules/RoadReserve/RoadReserveSection.tsx).

app.post('/api/admin/road-reserve/records', async (req, res) => {
  try {
    assertWritable('road_reserve_records', 'insert');
    const payload = req.body?.records ?? (req.body?.record ? [req.body.record] : null);
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ error: 'Request body must include "record" or non-empty "records"' });
    }
    const { data, error } = await supabaseAdmin.from('road_reserve_records').insert(payload).select();
    if (error) throw Object.assign(new Error(error.message), { status: 400, details: error });
    res.status(201).json({ inserted: data?.length ?? 0, data });
  } catch (err) {
    handleError(res, err);
  }
});

app.patch('/api/admin/road-reserve/records/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const cfg = assertWritable('road_reserve_records', 'update');
    const patch = req.body?.patch;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return res.status(400).json({ error: 'Request body must include a "patch" object' });
    }
    const { data, error } = await supabaseAdmin
      .from('road_reserve_records')
      .update(patch)
      .eq(cfg.idColumn, id)
      .select();
    if (error) throw Object.assign(new Error(error.message), { status: 400, details: error });
    if (!data || data.length === 0) {
      return res.status(404).json({ error: `No road_reserve_records row with id = ${id}` });
    }
    res.json({ updated: data.length, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Error helper ──────────────────────────────────────────────────────────────
function handleError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message, details: err.details });
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`\n  Uganda Roads — Data-Entry Write-Back Server`);
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  Listening on  http://localhost:${PORT}`);
  console.log(`  Supabase URL  ${SUPABASE_URL}`);
  console.log(`  CORS origins  ${CORS_ORIGIN.join(', ')}`);
  console.log(`  Writable tables: ${Object.keys(WRITABLE_TABLES).join(', ')}\n`);
});
