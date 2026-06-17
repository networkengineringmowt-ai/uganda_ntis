/**
 * romdasReaders — in-browser readers/processors for ROMDAS survey files, the
 * client-side counterpart of the Python ingest (uganda-npms-ai-backend).
 *
 *  • PGR (.pgr) — proprietary Ladybug image stream. We carve the embedded JPEG
 *    frames straight out of the byte stream (SOI ff d8 ff … EOI ff d9), exactly
 *    like data_pipeline/ingest_rbf_pgr.py, and hand back object URLs to preview.
 *  • RBF (.rbf/.csv/.txt) — Roughness Bump File: chainage-indexed roughness /
 *    IRI. We parse it tolerantly (auto delimiter + header detection) into
 *    chainage→roughness records and aggregate to fixed survey sections with a
 *    VCI estimate + condition band.
 *
 * Everything runs locally in the browser — no upload — so operators can open a
 * raw survey file in the PMS Data View and read it immediately.
 */

// ── PGR: carve JPEG frames from the Ladybug stream ───────────────────────────
export interface PgrFrame { index: number; url: string; bytes: number }

export function carvePgrFrames(buf: ArrayBuffer, maxFrames = 250): PgrFrame[] {
  const d = new Uint8Array(buf);
  const frames: PgrFrame[] = [];
  let i = 0, start = -1, n = 0;
  while (i < d.length - 1 && n < maxFrames) {
    if (start < 0 && d[i] === 0xff && d[i + 1] === 0xd8 && d[i + 2] === 0xff) {
      start = i; i += 3; continue;
    }
    if (start >= 0 && d[i] === 0xff && d[i + 1] === 0xd9) {
      const slice = d.subarray(start, i + 2);
      const url = URL.createObjectURL(new Blob([slice], { type: 'image/jpeg' }));
      frames.push({ index: n, url, bytes: slice.length });
      n++; start = -1; i += 2; continue;
    }
    i++;
  }
  return frames;
}

// ── RBF: roughness file → chainage records ───────────────────────────────────
export interface RbfRecord { chainage_m: number; roughness: number; iri: number }

/** Tolerant parse of a ROMDAS RBF / CSV roughness export. */
export function parseRbf(text: string): RbfRecord[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  // detect delimiter
  const delim = (lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',');
  const cells = (l: string) => l.split(delim).map(s => s.trim());
  // locate header row (first row with a chainage-like + roughness-like column)
  let headerIdx = -1, chCol = 0, rgCol = 1;
  for (let r = 0; r < Math.min(lines.length, 8); r++) {
    const hs = cells(lines[r]).map(s => s.toLowerCase());
    const ch = hs.findIndex(h => /chain|station|dist|km|m\b|position/.test(h));
    const rg = hs.findIndex(h => /iri|rough|bi\b|bump|nasra|m\/km/.test(h));
    if (ch >= 0 && rg >= 0) { headerIdx = r; chCol = ch; rgCol = rg; break; }
  }
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;   // headerless → assume col0=chainage, col1=roughness
  const out: RbfRecord[] = [];
  for (let r = start; r < lines.length; r++) {
    const c = cells(lines[r]);
    const ch = parseFloat(c[chCol]); const rg = parseFloat(c[rgCol]);
    if (!Number.isFinite(ch) || !Number.isFinite(rg)) continue;
    // RBF roughness is often already IRI (m/km); if it looks like counts/km, scale.
    const iri = rg > 30 ? rg / 100 : rg;
    out.push({ chainage_m: ch < 1000 && headerIdx >= 0 ? ch * 1000 : ch, roughness: rg, iri });
  }
  return out;
}

// ── Aggregate to fixed survey sections + VCI / condition ─────────────────────
export interface SectionRow {
  section: number; start_m: number; end_m: number;
  iri: number; vci: number; condition: string; color: string; n: number;
}

const band = (vci: number): [string, string] =>
  vci >= 85 ? ['Very Good', '#00ff88'] : vci >= 75 ? ['Good', '#7CFC00']
  : vci >= 65 ? ['Fair', '#ffd23f'] : vci >= 55 ? ['Poor', '#ff8c00'] : ['Very Poor', '#ff2d78'];

/** IRI → VCI proxy: 100 at IRI≤2, ~0 by IRI≥14 (linear), for a quick condition read. */
export function iriToVci(iri: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - (iri - 2) * (100 / 12))));
}

export function aggregateSections(recs: RbfRecord[], interval = 100): SectionRow[] {
  if (!recs.length) return [];
  const sorted = [...recs].sort((a, b) => a.chainage_m - b.chainage_m);
  const rows: SectionRow[] = [];
  const max = sorted[sorted.length - 1].chainage_m;
  let s = Math.floor(sorted[0].chainage_m / interval) * interval, idx = 0, sec = 1;
  while (s <= max) {
    const e = s + interval;
    const chunk = sorted.filter(r => r.chainage_m >= s && r.chainage_m < e);
    if (chunk.length) {
      const iri = chunk.reduce((a, r) => a + r.iri, 0) / chunk.length;
      const vci = iriToVci(iri);
      const [condition, color] = band(vci);
      rows.push({ section: sec++, start_m: s, end_m: e, iri: +iri.toFixed(2), vci, condition, color, n: chunk.length });
    }
    s = e; idx++;
    if (idx > 100000) break;
  }
  return rows;
}

/** Release carved-frame object URLs to free memory. */
export function releaseFrames(frames: PgrFrame[]): void {
  frames.forEach(f => { try { URL.revokeObjectURL(f.url); } catch { /* noop */ } });
}
