/**
 * Uganda National Roads — Local Data-Entry Write-Back Server
 * ───────────────────────────────────────────────────────────
 * Minimal Express server that persists all data-entry submissions to the
 * G: Drive repository (captures/<table>.jsonl) — the CANONICAL data store.
 * Supabase is an optional read-mirror only (SUPABASE_MIRROR=on). Trusted
 * local operators (DNR/UNRA field staff using the React app on a local
 * network) submit condition surveys, encroachment reports, gazette
 * updates, work orders, etc.; run drive_sync.py afterwards to fold the
 * captures into the app data bundle.
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
import fs from 'node:fs';
import path from 'node:path';

const PORT        = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CORS_ORIGIN  = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

// Supabase is OPTIONAL — the canonical store is the G: Drive repository.
// Credentials are only needed for the legacy mirror (SUPABASE_MIRROR=on).
const supabaseAdmin = (SUPABASE_URL && SERVICE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
if (!supabaseAdmin) {
  console.warn('[info] No Supabase credentials — running in G: Drive-only mode (mirror disabled).');
}

// ── G: Drive data store (canonical) ───────────────────────────────────────────
// All write-backs are persisted as JSONL files in the Google Drive repository.
// Supabase is only mirrored when SUPABASE_MIRROR=on.
const DRIVE_DIR = process.env.DRIVE_DATA_DIR
  || 'G:/My Drive/MOWT/Uganda National Road Network Repository/captures';
const MIRROR = (process.env.SUPABASE_MIRROR || 'off').toLowerCase() === 'on' && !!supabaseAdmin;

function persistDrive(table, op, records) {
  const dir = DRIVE_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${table}.jsonl`);
  const stamp = new Date().toISOString();
  const lines = records.map(r => JSON.stringify({ _op: op, _at: stamp, ...r })).join('\n') + '\n';
  fs.appendFileSync(file, lines, 'utf-8');
  return file;
}

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
    // Canonical store: append to the G: Drive JSONL for this table.
    const file = persistDrive(table, 'insert', payload);
    // Optional Supabase mirror (SUPABASE_MIRROR=on in server/.env)
    let mirrored = false;
    if (MIRROR) {
      const onConflict = typeof req.query.upsert === 'string' && req.query.upsert.trim();
      const q = onConflict
        ? supabaseAdmin.from(table).upsert(payload, { onConflict }).select()
        : supabaseAdmin.from(table).insert(payload).select();
      const { error } = await q;
      mirrored = !error;
      if (error) console.warn(`[mirror] supabase ${table}: ${error.message}`);
    }
    res.status(201).json({ inserted: payload.length, store: 'gdrive', file, mirrored });
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
    const file = persistDrive(table, 'update', [{ [cfg.idColumn]: id, ...patch }]);
    let mirrored = false;
    if (MIRROR) {
      const { error } = await supabaseAdmin.from(table).update(patch).eq(cfg.idColumn, id).select();
      mirrored = !error;
      if (error) console.warn(`[mirror] supabase ${table}: ${error.message}`);
    }
    res.json({ updated: 1, store: 'gdrive', file, mirrored });
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
    const file = persistDrive('road_reserve_records', 'insert', payload);
    let mirrored = false;
    if (MIRROR) {
      const { error } = await supabaseAdmin.from('road_reserve_records').insert(payload).select();
      mirrored = !error;
      if (error) console.warn(`[mirror] supabase road_reserve_records: ${error.message}`);
    }
    res.status(201).json({ inserted: payload.length, store: 'gdrive', file, mirrored });
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
    const file = persistDrive('road_reserve_records', 'update', [{ [cfg.idColumn]: id, ...patch }]);
    let mirrored = false;
    if (MIRROR) {
      const { error } = await supabaseAdmin
        .from('road_reserve_records').update(patch).eq(cfg.idColumn, id).select();
      mirrored = !error;
      if (error) console.warn(`[mirror] supabase road_reserve_records: ${error.message}`);
    }
    res.json({ updated: 1, store: 'gdrive', file, mirrored });
  } catch (err) {
    handleError(res, err);
  }
});

// ── Fable 5 chat proxy ────────────────────────────────────────────────────────
// Proxies the Road Asset Bot's LLM chat to the Claude API so the Anthropic key
// stays server-side (set ANTHROPIC_API_KEY in server/.env). Body:
//   { messages: [{role:'user'|'assistant', content:string}, ...], system: string }
app.post('/api/bot/chat', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured in server/.env' });
    }
    const { messages, system } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Body must include non-empty "messages"' });
    }
    let Anthropic;
    try {
      ({ default: Anthropic } = await import('@anthropic-ai/sdk'));
    } catch {
      return res.status(503).json({ error: 'Run "npm install" in server/ (missing @anthropic-ai/sdk)' });
    }
    const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
    const response = await anthropic.messages.create({
      model: 'claude-fable-5',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: typeof system === 'string' ? system : undefined,
      messages,
    });
    const block = response.content.find(b => b.type === 'text');
    res.json({ text: block ? block.text : '', usage: response.usage });
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
  console.log(`  Data store    ${DRIVE_DIR}  (G: Drive, canonical)`);
  console.log(`  Supabase      ${MIRROR ? `mirror ON → ${SUPABASE_URL}` : 'mirror off'}`);
  console.log(`  CORS origins  ${CORS_ORIGIN.join(', ')}`);
  console.log(`  Writable tables: ${Object.keys(WRITABLE_TABLES).join(', ')}\n`);
});
