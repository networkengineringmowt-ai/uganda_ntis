/**
 * MindMapSection — Platform Data Pipeline Workflow
 * Blueprint / engineering-schematic styled SVG diagram with:
 *  - 7 layers (L1=Triggers, L2=Processing, L3=Agents, L4=Outputs,
 *              L5=Algorithms & Logic, L6=Data Hub, L7=Platform sections)
 *  - Orthogonal (right-angle) edge routing
 *  - Click-to-inspect panel + hover dimension-annotation callout
 *  - Layer toggles styled as blueprint switches
 *  - Zoom/pan
 *
 * Architecture (v3.0): everything is written into the Supabase-backed
 * Unified DB (41 tables — see supabase_schema.sql). The Algorithms / Queries /
 * Decision-Tree layer reads the Unified DB and, together with the DB itself,
 * feeds the Tabular Summaries Hub. EVERY platform section (RMS, Road Reserve,
 * PMS, BMS, TIS, …) consumes the hub via SourceTableButton.
 */
import { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

const LAYERS = [1, 2, 3, 4, 5, 6, 7] as const;
type Layer = typeof LAYERS[number];

interface Node {
  id:      string;
  label:   string;
  sub:     string;
  layer:   Layer;
  x:       number;
  y:       number;
  w:       number;
  h:       number;
  color:   string;
  detail:  string;
}

interface Edge {
  from:  string;
  to:    string;
  label?: string;
}

// ── Node data ─────────────────────────────────────────────────────────────────

const NODES: Node[] = [
  // ── L1 — Triggers (x=40) ──────────────────────────────────────────────────
  { id:'trig-daily',   label:'Schedule Trigger',     sub:'Daily 06:00 EAT',           layer:1, x: 40,  y:130,  w:150, h:68, color:'#10b981',
    detail:'Runs every day at 06:00 EAT via cron. Fires the Python ETL chain in sequence: DB export → analytics → ML update → Supabase upsert → deploy.' },
  { id:'trig-onpush',  label:'Git Push Trigger',      sub:'main branch push',           layer:1, x: 40,  y:235,  w:150, h:68, color:'#06b6d4',
    detail:'Fires on every push to main. Runs Vite build then deploys to GitHub Pages via the /c/tmp/ghdep worktree.' },
  { id:'trig-entry',   label:'Data-Entry Writes',     sub:'service_role server',        layer:1, x: 40,  y:340,  w:150, h:68, color:'#22d3ee',
    detail:'server/index.js — trusted local write-back server. Field staff submit condition surveys, encroachment reports, road-reserve usage permits (MOWT Form 2), bridge inspections, work orders. Uses the Supabase service_role key to write privileged rows into the Unified DB (allowlisted tables only).' },

  // ── L2 — Processing (x=250) ───────────────────────────────────────────────
  { id:'proc-export',  label:'DB Export / ETL',       sub:'Python · upload_to_supabase',layer:2, x:250,  y:130,  w:155, h:68, color:'#3b82f6',
    detail:'scripts/etl/ingest_all_sources.py + upload_to_supabase.py — reads ROMDAS MDB/CSV/xlsx, FWD xlsx, Maintenance plans, HDM4 network, Committed Projects; upserts into the Supabase Unified DB (41 tables).' },
  { id:'proc-analytics',label:'Analytics Engine',    sub:'Regional · Budget · ESAL',   layer:2, x:250,  y:235,  w:155, h:68, color:'#8b5cf6',
    detail:'compute_overloading.py, compute_growth_factors.py, build_master.py — generate ESAL risk scores, AADT growth factors, condition summaries, and budget alignment KPIs written back to the Unified DB.' },
  { id:'proc-build',   label:'Vite Build',            sub:'npm run build',              layer:2, x:250,  y:340,  w:155, h:68, color:'#6366f1',
    detail:'npm run build -- --outDir C:/tmp/vite_out. Produces hashed asset bundles. Runs after each commit to main. Output copied to /c/tmp/ghdep for deployment.' },

  // ── L3 — Agents (x=470) ───────────────────────────────────────────────────
  { id:'ag-ml',        label:'ML Model Agent',        sub:'PyTorch DNN · GNN',          layer:3, x:470,  y:130,  w:150, h:68, color:'#f59e0b',
    detail:'deep_ml_engine.py — multi-task DNN predicts IRI, rutting, cracking, urgency. GNN smooths predictions across network neighbours. IsolationForest detects anomalies. Results land in ml_model_metrics / link_iri_predictions.' },
  { id:'ag-qc',        label:'QC Validation',         sub:'Schema · Range checks',      layer:3, x:470,  y:235,  w:150, h:68, color:'#ec4899',
    detail:'Validates each ingested record: range checks on IRI (0–25), deflections (0–5000µm), GPS coordinates within Uganda bbox, date plausibility. Flags bad records to data_quality_flags.' },
  { id:'ag-audit',     label:'Data Audit Engine',     sub:'Coverage · Freshness',       layer:3, x:470,  y:340,  w:150, h:68, color:'#06b6d4',
    detail:'DataAuditEngine.ts — admin-only view. Checks which links have ROMDAS data, FWD, traffic counts, bridge inspections. Flags links with >3-year data gap.' },

  // ── L4 — Outputs (x=680) ──────────────────────────────────────────────────
  { id:'out-pages',    label:'GitHub Pages Deploy',   sub:'gh-pages branch',            layer:4, x:680,  y:130,  w:160, h:68, color:'#6366f1',
    detail:'git push --force origin HEAD:gh-pages from /c/tmp/ghdep worktree. Cache-safe: old hashed bundles retained. Live URL: https://priscananjehe1996.github.io/uganda-roads/' },
  { id:'out-json',     label:'Public JSON Export',    sub:'central_network_db.json',    layer:4, x:680,  y:235,  w:160, h:68, color:'#14b8a6',
    detail:'export_unified_data.py writes public/data/*.json — per-link IRI summaries, table counts, AADT, ML metrics for fast client-side reads. A cached mirror of the Unified DB.' },
  { id:'out-db',       label:'Unified DB · Supabase', sub:'Postgres · 41 tables',       layer:4, x:680,  y:340,  w:160, h:68, color:'#3ecf8e',
    detail:'Supabase Postgres (project vbidhkvzjigatfygnyc) — the single source of truth. 41 tables across all layers: RMS, BMS, TIS, PMS, Road Reserve (incl. road_reserve_applications/applicants MOWT Form 2), AI/ML analytics, lifecycle, budgeting. Reads via the anon key (src/lib/supabase.ts); privileged writes via the service_role server. Schema: supabase_schema.sql.' },

  // ── L5 — Algorithms · Queries · Decision Trees (x=900) ────────────────────
  { id:'alg-engine',   label:'Algorithm Library',     sub:'HDM-4 · ESAL · LCCA',        layer:5, x:900,  y:165,  w:170, h:66, color:'#a78bfa',
    detail:'Deterministic models computed over the Unified DB: HDM-4 deterioration curves & calibration, ESAL/axle-load scoring, priority ranking, growth-factor expansion, and life-cycle cost analysis (LCCA). Outputs feed the Tabular Summaries Hub and section KPIs.' },
  { id:'qry-views',    label:'SQL Views & Queries',   sub:'Supabase RPC · aggregates',  layer:5, x:900,  y:275,  w:170, h:66, color:'#38bdf8',
    detail:'Parameterised Supabase queries / Postgres views that aggregate the Unified DB into the shapes each section needs (e.g. regional rollups, gazette-by-year, AADT-by-link, condition-by-class). These power SourceTableButton and the live section views.' },
  { id:'dtree',        label:'Decision Trees',        sub:'rules · recommendations',    layer:5, x:900,  y:385,  w:170, h:66, color:'#fbbf24',
    detail:'Rule-based decision logic: maintenance treatment selection by IRI band, intervention timing, overloading enforcement triggers, and road-reserve permit suitability (MOWT Form 2 Part E: Suitable / Not Suitable). Drives recommendations surfaced in every downstream section.' },

  // ── L6 — Data Hub (x=1130) ────────────────────────────────────────────────
  { id:'tbl-hub',      label:'Tabular Summaries Hub', sub:'100 cited tables · Data Hub', layer:6, x:1130, y:355,  w:195, h:88, color:'#00f5ff',
    detail:'src/modules/Sources/TabularSummaries.tsx — 100 tables sourced from the Unified DB plus official UNRA/MoWT/World Bank documents. Every table carries a source citation (tbl-001 … tbl-100) and is referenced across ALL platform sections via SourceTableButton. Now reads everything from the Supabase Unified DB.' },

  // ── L7 — Platform Sections (x=1390) ───────────────────────────────────────
  { id:'sec-rms',      label:'RMS — Road Network',    sub:'tbl 001–005 · road_links',   layer:7, x:1390, y: 30,  w:180, h:50, color:'#00e5ff',
    detail:'RoadNetworkView.tsx / RMS — 1,013 national-road links, classes A/B/C/M. tbl-001-005 (inventory, length by class/region, surface type). Source: road_links + road_link_condition.' },
  { id:'sec-reserve',  label:'Road Reserve Mgmt',     sub:'road_reserve_* · tbl 047–050',layer:7, x:1390, y: 92,  w:180, h:50, color:'#00d4aa',
    detail:'RoadReserveSection.tsx — gazette & legal status, encroachment register, reserve mapping, and Road Reserve Usage permits (MOWT Form 2). Source: road_reserve_records / _encroachments / _gazette / _applications / _applicants.' },
  { id:'sec-pms',      label:'PMS — Condition',       sub:'tbl 006, 007, 038',          layer:7, x:1390, y:154,  w:180, h:50, color:'#fb923c',
    detail:'RoadConditionView.tsx — IRI/condition/urgency map. tbl-006 (IRI by class), tbl-007 (paved condition 2024), tbl-038 (ML predictions).' },
  { id:'sec-bms',      label:'BMS — Bridges',         sub:'tbl 011, 012, 072',          layer:7, x:1390, y:216,  w:180, h:50, color:'#4d9fff',
    detail:'BMSSection.tsx — 483 bridges. tbl-011 (bridge inventory), tbl-012 (condition ratings 2024), tbl-072 (priority ranking). Source: structures + inspections.' },
  { id:'sec-tis',      label:'TIS — Traffic',         sub:'tbl 008–010, 069',           layer:7, x:1390, y:278,  w:180, h:50, color:'#ffd23f',
    detail:'TrafficSection.tsx — AADT map, ATC dashboard, growth projections. tbl-008 (AADT by link), tbl-009 (vehicle composition), tbl-010 (ATC hourly), tbl-069 (TIS stations).' },
  { id:'sec-ndpiv',    label:'NDPIV Projects',        sub:'tbl 014, 086',               layer:7, x:1390, y:340,  w:180, h:50, color:'#b967ff',
    detail:'NdpivSection.tsx — NDP IV project map and table. tbl-014 (NDPIV project list), tbl-086 (funding allocations FY2025/26).' },
  { id:'sec-oprc',     label:'OPRC Lots',             sub:'tbl 013, 085',               layer:7, x:1390, y:402,  w:180, h:50, color:'#00ff88',
    detail:'OprcSection.tsx — 9 OPRC lots. tbl-013 (contract details), tbl-085 (performance monitoring).' },
  { id:'sec-overload', label:'Overloading / ESAL',    sub:'tbl 023–028',                layer:7, x:1390, y:464,  w:180, h:50, color:'#ef4444',
    detail:'OverloadingSection.tsx — 1,020 links scored. tbl-023-028 (axle load distributions, ESAL factors, overloading frequency, risk index). Source: overloading_by_link.' },
  { id:'sec-lcm',      label:'Lifecycle Mgmt',        sub:'tbl 041–046',                layer:7, x:1390, y:526,  w:180, h:50, color:'#34d399',
    detail:'LifecycleSection.tsx — IRI deterioration curves, intervention history, LCCA. tbl-041-046. Source: lifecycle_links + lifecycle_interventions.' },
  { id:'sec-budget',   label:'Budget & Maintenance',  sub:'tbl 020, 021, 074',          layer:7, x:1390, y:588,  w:180, h:50, color:'#ff2d78',
    detail:'BudgetSection.tsx — maintenance expenditure, MTEF planning. tbl-020 (maintenance budget by FY), tbl-021 (development budget), tbl-074 (M&R needs). Source: budget_fy_summary + budget_alignment.' },
  { id:'sec-projects', label:'Projects & Works',      sub:'tbl 015–019',                layer:7, x:1390, y:650,  w:180, h:50, color:'#f472b6',
    detail:'ProjectTracker — execution tracking (Gantt/Kanban), physical vs financial progress. tbl-015-019. Source: project_tracker + projects.' },
  { id:'sec-pim',      label:'Public Investment',     sub:'tbl 080–084',                layer:7, x:1390, y:712,  w:180, h:50, color:'#c084fc',
    detail:'PublicInvestmentSection.tsx — PIM funding, PPP projects, donor vs GoU split. tbl-080-084. Source: budget_fy_summary + ppp_projects.' },
  { id:'sec-global',   label:'National Case Studies',   sub:'tbl 090–100',                layer:7, x:1390, y:774,  w:180, h:50, color:'#7dd3fc',
    detail:'GlobalCaseStudiesSection.tsx — 16-country comparative RMS/BMS benchmarking. tbl-090-100. Source: global_case_studies.' },
];

// Bounding box of all node geometry — used to "fit to content" the canvas
// so there's no wasted blank space below/around the diagram.
const CONTENT_BBOX = (() => {
  const xs = NODES.flatMap(n => [n.x, n.x + n.w]);
  const ys = NODES.flatMap(n => [n.y, n.y + n.h]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
})();

const EDGES: Edge[] = [
  // L1 → L2 / L4
  { from:'trig-daily',   to:'proc-export',    label:'fires' },
  { from:'trig-daily',   to:'proc-analytics', label:'fires' },
  { from:'trig-onpush',  to:'proc-build',     label:'triggers' },
  { from:'trig-entry',   to:'out-db',         label:'writes' },
  // L2 → L3
  { from:'proc-export',  to:'ag-ml',          label:'feeds' },
  { from:'proc-export',  to:'ag-qc',          label:'validates' },
  { from:'proc-analytics',to:'ag-audit',      label:'reports' },
  // L2 → L4
  { from:'proc-build',   to:'out-pages',      label:'deploys' },
  { from:'proc-export',  to:'out-db',         label:'upserts' },
  { from:'proc-analytics',to:'out-json',      label:'exports' },
  // L3 → L4
  { from:'ag-ml',        to:'out-db',         label:'model results' },
  { from:'ag-qc',        to:'out-db',         label:'quality flags' },
  { from:'ag-audit',     to:'out-json',       label:'audit report' },
  // L4 → L5 — Unified DB feeds the algorithm / query / decision layer
  { from:'out-db',       to:'alg-engine',     label:'reads' },
  { from:'out-db',       to:'qry-views',      label:'queries' },
  { from:'out-db',       to:'dtree',          label:'rules' },
  // L4 → L6 — Tabular Summaries Hub sources EVERYTHING from the Unified DB
  { from:'out-db',       to:'tbl-hub',        label:'sources all' },
  { from:'out-json',     to:'tbl-hub',        label:'client cache' },
  // L5 → L6 — computed logic feeds the hub
  { from:'alg-engine',   to:'tbl-hub',        label:'metrics' },
  { from:'qry-views',    to:'tbl-hub',        label:'aggregates' },
  { from:'dtree',        to:'tbl-hub',        label:'recommendations' },
  // L6 hub → every platform section (RMS, Road Reserve, + all others)
  { from:'tbl-hub',      to:'sec-rms',        label:'' },
  { from:'tbl-hub',      to:'sec-reserve',    label:'' },
  { from:'tbl-hub',      to:'sec-pms',        label:'' },
  { from:'tbl-hub',      to:'sec-bms',        label:'' },
  { from:'tbl-hub',      to:'sec-tis',        label:'' },
  { from:'tbl-hub',      to:'sec-ndpiv',      label:'' },
  { from:'tbl-hub',      to:'sec-oprc',       label:'' },
  { from:'tbl-hub',      to:'sec-overload',   label:'' },
  { from:'tbl-hub',      to:'sec-lcm',        label:'' },
  { from:'tbl-hub',      to:'sec-budget',     label:'' },
  { from:'tbl-hub',      to:'sec-projects',   label:'' },
  { from:'tbl-hub',      to:'sec-pim',        label:'' },
  { from:'tbl-hub',      to:'sec-global',     label:'' },
];

const LAYER_LABELS: Record<Layer, string> = {
  1: 'L1 TRIGGERS',
  2: 'L2 PROCESSING',
  3: 'L3 AGENTS',
  4: 'L4 OUTPUTS',
  5: 'L5 ALGORITHMS & LOGIC',
  6: 'L6 DATA HUB',
  7: 'L7 PLATFORM SECTIONS',
};

// ── Drawing-zone reference (e.g. [A3]) ─────────────────────────────────────────

function zoneRef(node: Node): string {
  const col = Math.min(7, Math.floor((node.x) / 200));
  const row = Math.floor((node.y) / 150) + 1;
  return `[${String.fromCharCode(65 + col)}${row}]`;
}

// ── Orthogonal (right-angle) edge routing ────────────────────────────────────

function edgePath(from: Node, to: Node): string {
  const horizontal = to.x > from.x + from.w / 2;

  if (horizontal) {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    const midX = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  } else {
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const midY = y1 + (y2 - y1) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }
}

function arrowHead(from: Node, to: Node): { x: number; y: number; angle: number } {
  const horizontal = to.x > from.x + from.w / 2;
  if (horizontal) {
    return { x: to.x, y: to.y + to.h / 2, angle: 0 };
  } else {
    return { x: to.x + to.w / 2, y: to.y, angle: -90 };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

export default function MindMapSection() {
  const [zoom, setZoom]             = useState(0.7);
  const [pan, setPan]               = useState({ x: 20, y: 20 });
  const [visibleLayers, setVisible] = useState<Set<Layer>>(new Set(LAYERS));
  const [selected, setSelected]     = useState<Node | null>(null);
  const [hovered, setHovered]       = useState<Node | null>(null);
  const draggingRef                 = useRef<{ x: number; y: number } | null>(null);
  const canvasRef                   = useRef<HTMLDivElement | null>(null);

  // Fit the diagram exactly to the visible canvas — eliminates wasted blank
  // space below/around the nodes (computed from the real node bounding box).
  const fitToContent = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const PAD = 40;
    const cw = el.clientWidth, ch = el.clientHeight;
    if (!cw || !ch) return;
    const contentW = (CONTENT_BBOX.maxX - CONTENT_BBOX.minX) + PAD * 2;
    const contentH = (CONTENT_BBOX.maxY - CONTENT_BBOX.minY) + PAD * 2;
    const fit = Math.min(cw / contentW, ch / contentH, 1.2);
    setZoom(fit);
    setPan({
      x: (cw - contentW * fit) / 2 - (CONTENT_BBOX.minX - PAD) * fit,
      y: (ch - contentH * fit) / 2 - (CONTENT_BBOX.minY - PAD) * fit,
    });
  }, []);

  // Auto-fit on first mount and whenever the canvas is resized.
  // The canvas is rendered inside a lazy-loaded, absolutely-positioned tab
  // panel — its measured size can be 0 (or stale) on the very first layout
  // pass, so we re-run the fit across a few animation frames + a short
  // timeout to catch the size once the flex layout has fully settled.
  useLayoutEffect(() => {
    fitToContent();
    const raf1 = requestAnimationFrame(() => fitToContent());
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(() => fitToContent()));
    const t = setTimeout(() => fitToContent(), 250);

    const el = canvasRef.current;
    let ro: ResizeObserver | undefined;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => fitToContent());
      ro.observe(el);
    }
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleLayer = useCallback((l: Layer) => {
    setVisible(prev => {
      const next = new Set(prev);
      next.has(l) ? next.delete(l) : next.add(l);
      return next;
    });
  }, []);

  const visibleNodes = useMemo(
    () => NODES.filter(n => visibleLayers.has(n.layer)),
    [visibleLayers]
  );

  const visibleEdges = useMemo(
    () => EDGES.filter(e => {
      const fn = NODES.find(n => n.id === e.from);
      const tn = NODES.find(n => n.id === e.to);
      return fn && tn && visibleLayers.has(fn.layer) && visibleLayers.has(tn.layer);
    }),
    [visibleLayers]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest?.('[data-node]')) return;
    draggingRef.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    setPan(p => ({
      x: p.x + (e.clientX - draggingRef.current!.x),
      y: p.y + (e.clientY - draggingRef.current!.y),
    }));
    draggingRef.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => { draggingRef.current = null; };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.25, Math.min(3, z * (e.deltaY < 0 ? 1.12 : 0.88))));
  }, []);

  const MONO = "'JetBrains Mono','Consolas','SF Mono',monospace";

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      height: '100%', width: '100%',
      background: '#0a1628', overflow: 'hidden',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      {/* Toolbar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', flexWrap: 'wrap', rowGap: 6,
        background: 'rgba(10,22,40,0.97)',
        borderBottom: '1px solid rgba(0,188,212,0.18)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#00bcd4', letterSpacing: '0.12em', fontFamily: MONO }}>
          ▦ DATA PIPELINE — SCHEMATIC
        </span>
        <div style={{ width: 1, height: 18, background: 'rgba(0,188,212,0.18)' }} />
        {/* Layer toggles — drawn as blueprint switches */}
        {LAYERS.map(l => {
          const on = visibleLayers.has(l);
          return (
            <button key={l} onClick={() => toggleLayer(l)} style={{
              padding: '3px 10px', borderRadius: 2, fontSize: 9, fontWeight: 700, cursor: 'pointer',
              fontFamily: MONO, letterSpacing: '0.04em',
              border: on ? '1px solid #00bcd4' : '1px solid rgba(140,180,200,0.25)',
              background: on ? 'rgba(0,188,212,0.12)' : 'transparent',
              color: on ? '#00e5ff' : 'rgba(140,180,200,0.4)',
              transition: 'all 0.15s',
            }}>
              [{on ? '■' : '□'}] {LAYER_LABELS[l]}
            </button>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} style={tbBtn}>
            <ZoomIn size={14} color="#7dd3e0" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.25, z * 0.83))} style={tbBtn}>
            <ZoomOut size={14} color="#7dd3e0" />
          </button>
          <button onClick={fitToContent} title="Fit to content" style={tbBtn}>
            <RotateCcw size={14} color="#7dd3e0" />
          </button>
        </div>
        <span style={{ fontSize: 9, color: 'rgba(125,211,224,0.35)', marginLeft: 4, fontFamily: MONO }}>
          DRAG · PAN — SCROLL · ZOOM — CLICK · INSPECT
        </span>
      </div>

      {/* Canvas + detail panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG canvas */}
        <div
          ref={canvasRef}
          style={{ flex: 1, overflow: 'hidden', cursor: 'grab', position: 'relative' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg width="100%" height="100%" style={{ display: 'block' }}>
            <defs>
              <marker id="arrow-bp" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(0,229,255,0.55)" />
              </marker>
              <filter id="glow-bp">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>

              {/* Fine blueprint grid: minor 25px, major 100px */}
              <pattern id="grid-minor" width="25" height="25" patternUnits="userSpaceOnUse">
                <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(140,200,220,0.05)" strokeWidth="1" />
              </pattern>
              <pattern id="grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
                <rect width="100" height="100" fill="url(#grid-minor)" />
                <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(140,200,220,0.10)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Grid overlay (fixed to viewport, not panned/zoomed) */}
            <rect x="0" y="0" width="100%" height="100%" fill="url(#grid-major)" />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>

              {/* Edges — orthogonal routing */}
              {visibleEdges.map((edge, i) => {
                const fn = NODES.find(n => n.id === edge.from)!;
                const tn = NODES.find(n => n.id === edge.to)!;
                const d  = edgePath(fn, tn);
                const ah = arrowHead(fn, tn);
                const midX = (fn.x + fn.w/2 + tn.x + tn.w/2) / 2;
                const midY = (fn.y + fn.h/2 + tn.y + tn.h/2) / 2;
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke="rgba(0,229,255,0.45)"
                      strokeWidth="1.25" markerEnd="url(#arrow-bp)"
                      strokeDasharray="6 4" opacity="0.8">
                      <animate attributeName="stroke-dashoffset" from="20" to="0"
                        dur="1.6s" repeatCount="indefinite" />
                    </path>
                    {edge.label && (
                      <text x={midX} y={midY - 5} textAnchor="middle"
                        fontSize="8" fontFamily={MONO}
                        fill="rgba(180,220,230,0.45)" pointerEvents="none">
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes — engineering drawing boxes */}
              {visibleNodes.map(node => {
                const isSelected = selected?.id === node.id;
                const isHovered  = hovered?.id === node.id;
                const rgb = hexFromColor(node.color);
                return (
                  <g key={node.id} data-node="1"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelected(isSelected ? null : node)}
                    onMouseEnter={() => setHovered(node)}
                    onMouseLeave={() => setHovered(prev => prev?.id === node.id ? null : prev)}
                    filter={isSelected ? 'url(#glow-bp)' : undefined}
                  >
                    {/* Drawing-box fill */}
                    <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={4}
                      fill={isSelected ? `rgba(${rgb},0.42)` : `rgba(${rgb},0.22)`}
                      stroke={node.color}
                      strokeWidth={isSelected ? 3 : (isHovered ? 2.5 : 2)}
                    />
                    <rect x={node.x} y={node.y} width={5} height={node.h} fill={node.color} />
                    {/* Corner ticks (drafting-style corner marks) */}
                    {[[0,0,1,1],[1,0,-1,1],[0,1,1,-1],[1,1,-1,-1]].map(([cx,cy,dx,dy], ci) => (
                      <path key={ci}
                        d={`M ${node.x + cx*node.w} ${node.y + cy*node.h + dy*7}
                            L ${node.x + cx*node.w} ${node.y + cy*node.h}
                            L ${node.x + cx*node.w + dx*7} ${node.y + cy*node.h}`}
                        fill="none" stroke="#00e5ff" strokeWidth="1.25" opacity="0.8" />
                    ))}
                    {/* Coordinate / zone label, top-left corner */}
                    <text x={node.x + 5} y={node.y + 11}
                      fontSize="7.5" fontFamily={MONO} fontWeight="700"
                      fill="rgba(0,229,255,0.55)" pointerEvents="none">
                      {zoneRef(node)}
                    </text>
                    {/* Label */}
                    <text x={node.x + node.w/2} y={node.y + node.h/2 - 4}
                      textAnchor="middle" fontSize="11" fontWeight="900" fontFamily={MONO}
                      fill="#ffffff" pointerEvents="none" style={{ letterSpacing: '0.02em' }}>
                      {node.label}
                    </text>
                    {/* Sub-label */}
                    <text x={node.x + node.w/2} y={node.y + node.h/2 + 11}
                      textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily={MONO}
                      fill={node.color} pointerEvents="none">
                      {node.sub}
                    </text>
                  </g>
                );
              })}

              {/* Hover dimension annotation: leader line + text box */}
              {hovered && !selected && (() => {
                const n = hovered;
                const lx = n.x + n.w + 14;
                const ly = n.y - 18;
                const boxW = 188;
                return (
                  <g pointerEvents="none">
                    {/* leader line from node corner to annotation box */}
                    <path d={`M ${n.x + n.w} ${n.y} L ${lx} ${ly} L ${lx + boxW} ${ly}`}
                      fill="none" stroke="#00e5ff" strokeWidth="1" opacity="0.8" />
                    <circle cx={n.x + n.w} cy={n.y} r="2.5" fill="#00e5ff" />
                    {/* dimension-style text box */}
                    <rect x={lx} y={ly - 17} width={boxW} height={17}
                      fill="rgba(8,18,34,0.95)" stroke="#00bcd4" strokeWidth="0.75" />
                    <text x={lx + 6} y={ly - 5} fontSize="8" fontFamily={MONO} fontWeight="700"
                      fill="#00e5ff">
                      {zoneRef(n)} {n.label.toUpperCase()}
                    </text>
                  </g>
                );
              })()}

            </g>
          </svg>

          {/* Layer legend (engineering symbol key) */}
          <div style={{
            position: 'absolute', bottom: 96, left: 14,
            display: 'flex', flexDirection: 'column', gap: 4,
            pointerEvents: 'none', fontFamily: MONO,
            background: 'rgba(8,18,34,0.7)', border: '1px solid rgba(0,188,212,0.2)',
            padding: '8px 10px',
          }}>
            <div style={{ fontSize: 7.5, color: 'rgba(0,229,255,0.5)', letterSpacing: '0.1em', marginBottom: 2 }}>
              LAYER KEY
            </div>
            {LAYERS.map(l => {
              const layerNodes = NODES.filter(n => n.layer === l);
              const firstColor = layerNodes[0]?.color ?? '#94a3b8';
              return (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 7, height: 7, border: `1px solid ${firstColor}`, background: 'transparent', opacity: visibleLayers.has(l) ? 1 : 0.25 }} />
                  <span style={{ fontSize: 7.5, color: visibleLayers.has(l) ? 'rgba(200,225,232,0.65)' : 'rgba(140,180,200,0.3)' }}>
                    {LAYER_LABELS[l]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Engineering drawing title block (bottom-right) ── */}
          <div style={{
            position: 'absolute', bottom: 12, right: 14,
            width: 270, fontFamily: MONO,
            background: 'rgba(8,18,34,0.92)',
            border: '1.5px solid #00bcd4',
            color: '#cfeef5',
            pointerEvents: 'none',
          }}>
            <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(0,188,212,0.4)' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: '#00e5ff' }}>
                UGANDA NATIONAL ROADS PLATFORM
              </div>
              <div style={{ fontSize: 8, marginTop: 2, color: 'rgba(207,238,245,0.7)' }}>
                SYSTEM ARCHITECTURE v2.0
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ flex: 1, padding: '5px 10px', borderRight: '1px solid rgba(0,188,212,0.3)' }}>
                <div style={{ fontSize: 6.5, color: 'rgba(0,229,255,0.5)', letterSpacing: '0.08em' }}>DRAWN</div>
                <div style={{ fontSize: 8 }}>{TODAY}</div>
              </div>
              <div style={{ flex: 1.4, padding: '5px 10px' }}>
                <div style={{ fontSize: 6.5, color: 'rgba(0,229,255,0.5)', letterSpacing: '0.08em' }}>ISSUED BY</div>
                <div style={{ fontSize: 8 }}>DEPT. OF NATIONAL ROADS</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{
            width: 300, flexShrink: 0,
            background: 'rgba(8,18,34,0.97)',
            borderLeft: `1px solid rgba(${hexFromColor(selected.color)},0.3)`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: MONO,
          }}>
            {/* Header */}
            <div style={{
              padding: '12px 14px 10px',
              borderBottom: '1px solid rgba(0,188,212,0.18)',
              background: `linear-gradient(180deg, rgba(${hexFromColor(selected.color)},0.1), transparent)`,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 7.5, color: 'rgba(0,229,255,0.55)', marginBottom: 2 }}>
                    {zoneRef(selected)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: selected.color }}>
                    {selected.label}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(180,220,230,0.5)', marginTop: 2 }}>
                    {selected.sub}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  background: 'none', border: '1px solid rgba(0,188,212,0.3)', cursor: 'pointer', padding: 4,
                  color: 'rgba(180,220,230,0.6)',
                }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{
                marginTop: 8, display: 'inline-block',
                fontSize: 8, fontWeight: 700, padding: '2px 8px',
                background: `rgba(${hexFromColor(selected.color)},0.12)`,
                color: selected.color,
                border: `1px solid rgba(${hexFromColor(selected.color)},0.3)`,
              }}>
                {LAYER_LABELS[selected.layer]}
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', fontSize: 10, color: 'rgba(207,238,245,0.8)', lineHeight: 1.65 }}>
              {selected.detail}

              {/* Parameters & algorithms */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `2px solid ${selected.color}55` }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: selected.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
                  Parameters &amp; Algorithms
                </div>
                {(() => {
                  const a = ALGO_DETAILS[selected.id];
                  if (a) {
                    return (
                      <>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#fff', lineHeight: 1.5, marginBottom: 6 }}>{a.algo}</div>
                        {a.params.map((x, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, fontSize: 9.5, color: 'rgba(226,232,240,0.85)', lineHeight: 1.6 }}>
                            <span style={{ color: selected.color, fontWeight: 900 }}>▸</span><span>{x}</span>
                          </div>
                        ))}
                      </>
                    );
                  }
                  return (
                    <div style={{ fontSize: 9.5, color: 'rgba(226,232,240,0.8)', lineHeight: 1.65 }}>
                      <span style={{ color: selected.color, fontWeight: 900 }}>▸ </span>{selected.sub}
                      <br /><span style={{ color: selected.color, fontWeight: 900 }}>▸ </span>{selected.detail}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Connected nodes */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(0,188,212,0.18)', flexShrink: 0 }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, color: 'rgba(0,229,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Connections
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {EDGES.filter(e => e.from === selected.id || e.to === selected.id).map((e, i) => {
                  const other = NODES.find(n => n.id === (e.from === selected.id ? e.to : e.from));
                  if (!other) return null;
                  const isOut = e.from === selected.id;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 8.5, color: 'rgba(180,220,230,0.6)' }}>
                      <span style={{ color: isOut ? '#00e5ff' : '#ff8a5b', fontSize: 9, fontWeight: 800 }}>
                        {isOut ? '→' : '←'}
                      </span>
                      <span style={{ color: other.color }}>{other.label}</span>
                      {e.label && <span style={{ color: 'rgba(180,220,230,0.4)' }}>({e.label})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexFromColor(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)}`;
}

const tbBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 2, border: '1px solid rgba(0,188,212,0.3)',
  background: 'rgba(0,188,212,0.05)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ══════════════════════════════════════════════════════════════════════════════

// Parameters & algorithms per node — shown in the inspector instead of wireframes.
const ALGO_DETAILS: Record<string, { algo: string; params: string[] }> = {
  'ag-ml': {
    algo: 'PyTorch deep neural network + graph neural network over the link network',
    params: ['Inputs: IRI, rutting, AADT, ESALs, pavement age, rainfall zone',
             'DNN: 4 hidden layers · ReLU · dropout 0.2 · Adam 1e-3',
             'GNN: link-adjacency message passing, 2 hops',
             'Target: next-cycle VCI / IRI per link',
             'Validation: 80/20 split · early stopping on RMSE'] },
  'alg-engine': {
    algo: 'HDM-4 deterioration · ESAL accumulation · life-cycle cost analysis (LCCA)',
    params: ['HDM-4 RDWE roughness progression: ΔIRI = f(age, ESAL, MMP, SNC)',
             'ESAL: Σ (axle load / 8.16 t)^4.5 by vehicle class',
             'LCCA: NPV @ 12% discount, 20-year analysis period',
             'Calibrated with romdas_calibration.json coefficients'] },
  'dtree': {
    algo: 'Rule-based decision trees → maintenance recommendations',
    params: ['Thresholds: VCI bands (≥85/75/65/55) · IRI > 4.5 → periodic',
             'Treatment ladder: routine → resealing → overlay → reconstruction',
             'Bridge rules: element rating ≤ 2 → inspection work order',
             'Budget guardrail: ranked by stress score within envelope'] },
  'proc-analytics': {
    algo: 'Aggregation engine — regional, budget and ESAL summaries',
    params: ['Km-weighted VCI per region & station',
             'Growth-factor projections (compound, per ATC class)',
             'Budget per km by class & treatment',
             'Outputs feed Tabular Summaries Hub'] },
  'ag-qc': {
    algo: 'Schema + range validation before publication',
    params: ['JSON-schema checks on every exported file',
             'Range checks: VCI 0–100 · IRI 1–20 · AADT > 0',
             'Referential: every link_id must exist in the network master',
             'Failures block the deploy step'] },
  'ag-audit': {
    algo: 'Coverage & freshness audit across the data bundle',
    params: ['Coverage: links with condition / traffic / inventory data',
             'Freshness: file generation dates vs reporting year',
             'Cross-source mismatch detection (shapefile vs register)'] },
  'proc-export': {
    algo: 'Python ETL chain (pandas + geopandas)',
    params: ['Sources: NDPIV xlsx · network2026 shapefile · BMS CSV · ATC workbook',
             'refresh_2026.py · build_fwd_inventory.py · export_bundle.py',
             'Drive-first: outputs land in public/data (G: canonical)'] },
};

// Section-UI wireframe schematics (legacy, retained for reference).
// Declarative: every node maps to a small set of placeholder elements drawn with
// standard wireframe conventions (diagonal=chart, h-lines=table, circle+crosshair
// =map). Rendered in the inspect panel by <WireframeSketch/>.
// ══════════════════════════════════════════════════════════════════════════════

type WfType = 'chart' | 'table' | 'map' | 'kpi' | 'cards' | 'form' | 'tree'
            | 'db' | 'browser' | 'file' | 'gear' | 'arrow' | 'diagram' | 'panel';
interface WfEl { t: WfType; x: number; y: number; w: number; h: number; label?: string }
interface Wireframe { sidebar?: boolean; tabs?: string[]; els: WfEl[] }

const _e = (t: WfType, x: number, y: number, w: number, h: number, label?: string): WfEl => ({ t, x, y, w, h, label });

// ── Section-screen templates (sidebar + tabs + content) ───────────────────────
const secMapDetail  = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('map', 34, 20, 148, 156, 'MAP'), _e('panel', 188, 20, 88, 156, 'DETAIL')] });
const secMapTable   = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('map', 34, 20, 242, 84, 'MAP'), _e('table', 34, 112, 242, 64, 'TABLE')] });
const secKpiCharts  = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('kpi', 34, 20, 242, 22), _e('chart', 34, 50, 118, 126, 'CHART'), _e('chart', 158, 50, 118, 126, 'CHART')] });
const secMapCards   = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('map', 34, 20, 148, 156, 'MAP'), _e('cards', 188, 20, 88, 156)] });
const secMapCharts  = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('map', 34, 20, 148, 156, 'MAP'), _e('chart', 188, 20, 88, 74, 'CHART'), _e('chart', 188, 102, 88, 74, 'CHART')] });
const secChartsTbl  = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('chart', 34, 20, 242, 78, 'CHART'), _e('table', 34, 106, 242, 70, 'TABLE')] });
const secBigTable   = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('table', 34, 20, 242, 156, 'TABLE')] });
const secWorldTable = (tabs: string[]): Wireframe => ({ sidebar: true, tabs, els: [_e('map', 34, 20, 242, 94, 'WORLD MAP'), _e('table', 34, 122, 242, 54, 'TABLE')] });

// ── Pipeline-node templates (no sidebar — a process / IO sketch) ──────────────
const flow3 = (a: string, b: string, c: string): Wireframe => ({ els: [
  _e('panel', 8, 66, 70, 46, a), _e('arrow', 78, 89, 26, 0), _e('gear', 104, 66, 70, 46, b),
  _e('arrow', 174, 89, 26, 0), _e('panel', 200, 66, 72, 46, c) ] });

const WIREFRAMES: Record<string, Wireframe> = {
  // L1 — Triggers
  'trig-daily':  { els: [_e('panel', 24, 50, 96, 80, 'CRON 06:00'), _e('arrow', 120, 90, 36, 0), _e('gear', 156, 50, 100, 80, 'ETL CHAIN')] },
  'trig-onpush': flow3('git push', 'CI', 'DEPLOY'),
  'trig-entry':  flow3('FORM', 'SERVER', 'DB'),
  // L2 — Processing
  'proc-export':    flow3('SOURCES', 'ETL', 'SUPABASE'),
  'proc-analytics': flow3('DATA', 'ANALYTICS', 'KPIs'),
  'proc-build':     { els: [_e('panel', 8, 66, 70, 46, 'SRC'), _e('arrow', 78, 89, 26, 0), _e('gear', 104, 66, 70, 46, 'VITE'), _e('arrow', 174, 89, 26, 0), _e('browser', 200, 56, 72, 66, 'BUNDLE')] },
  // L3 — Agents
  'ag-ml':    flow3('DATA', 'DNN / GNN', 'IRI·VCI'),
  'ag-qc':    flow3('ROWS', 'QC', 'FLAGS'),
  'ag-audit': { sidebar: true, tabs: ['Mind Map', 'Data Audit'], els: [_e('diagram', 34, 20, 168, 156, 'CANVAS'), _e('panel', 208, 20, 68, 156, 'INSPECT')] },
  // L4 — Outputs
  'out-pages': { els: [_e('browser', 28, 26, 224, 128, 'gh-pages')] },
  'out-json':  { els: [_e('file', 88, 24, 104, 132, 'JSON')] },
  'out-db':    { els: [_e('db', 40, 30, 96, 120, 'UNIFIED DB'), _e('table', 156, 30, 116, 120, '41 TABLES')] },
  // L5 — Algorithms & Logic
  'alg-engine': { els: [_e('form', 14, 22, 104, 62, 'f(x)'), _e('chart', 14, 94, 104, 72, 'CURVE'), _e('chart', 128, 22, 138, 144, 'METRICS')] },
  'qry-views':  { els: [_e('form', 16, 22, 110, 146, 'QUERY'), _e('table', 138, 22, 126, 146, 'RESULT')] },
  'dtree':      { els: [_e('tree', 14, 16, 252, 154, 'DECISION TREE')] },
  // L6 — Data Hub
  'tbl-hub': secBigTable(['Tabular Summaries', 'Charts', 'References']),
  // L7 — Platform sections
  'sec-rms':      secMapDetail(['Overview', 'Network Map', 'Network Story', 'Architecture']),
  'sec-reserve':  secMapTable(['Overview', 'Reserve Map', 'Encroachment', 'Gazette']),
  'sec-pms':      secKpiCharts(['Dashboard', 'Condition Map', 'Inventory', 'Analytics']),
  'sec-bms':      secMapDetail(['Dashboard', 'Structure Map', 'Inventory', 'Digital Twin']),
  'sec-tis':      secMapDetail(['Overview', 'Traffic Map', 'Analytics', 'Projections']),
  'sec-ndpiv':    secMapCards(['Overview', 'NDPIV Map', 'Investment', 'Analytics']),
  'sec-oprc':     secMapCards(['Overview', 'OPRC Map', 'Contracts', 'Performance']),
  'sec-overload': secMapCharts(['Dashboard', 'Station Map', 'Analytics', 'Enforce']),
  'sec-lcm':      secMapDetail(['Dashboard', 'Lifecycle Map', 'Analytics', 'Deterioration']),
  'sec-budget':   secChartsTbl(['Overview', 'Budget Chart', 'Work Plans', 'Analytics']),
  'sec-projects': secMapCards(['Overview', 'Projects Map', 'Status', 'Analytics']),
  'sec-pim':      secChartsTbl(['Overview', 'Funding', 'PPP', 'Analytics']),
  'sec-global':   secWorldTable(['World Map', 'Cases', 'Comparative', 'Lessons', 'Matrix']),
};
const FALLBACK_WF: Wireframe = secMapTable(['Overview']);

const WF_S = 'rgba(0,188,212,0.72)';   // primary cyan line
const WF_F = 'rgba(0,188,212,0.34)';   // faint cyan
const WF_L = 'rgba(223,238,245,0.72)'; // label
const WF_MONO = "'JetBrains Mono','Consolas',monospace";

// Render one wireframe element with its standard placeholder pattern.
function drawWfEl(el: WfEl, i: number): React.ReactNode {
  const { t, x, y, w, h, label } = el;
  const cx = x + w / 2, cy = y + h / 2;
  const box = <rect x={x} y={y} width={w} height={h} fill="none" stroke={WF_S} strokeWidth="1" />;
  const lbl = label ? (
    <text x={cx} y={t === 'map' || t === 'chart' ? y + h - 5 : y + 10} textAnchor="middle"
      fontSize="6.5" fontFamily={WF_MONO} fill={WF_L} letterSpacing="0.05em">{label}</text>
  ) : null;
  const parts: React.ReactNode[] = [];

  switch (t) {
    case 'chart': // diagonal cross = image/chart placeholder + a couple of bars
      parts.push(<line x1={x} y1={y} x2={x + w} y2={y + h} stroke={WF_F} strokeWidth="0.75" />,
                 <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={WF_F} strokeWidth="0.75" />);
      for (let k = 0; k < 4; k++)
        parts.push(<rect key={'b' + k} x={x + 8 + k * (w - 16) / 4} y={y + h - 8 - (k % 3 + 1) * 7} width={(w - 16) / 4 - 3} height={(k % 3 + 1) * 7} fill={WF_F} />);
      break;
    case 'table': { // header bar + row lines
      parts.push(<rect x={x} y={y} width={w} height={11} fill={WF_F} />);
      for (let r = 1; r <= Math.max(2, Math.floor((h - 11) / 12)); r++)
        parts.push(<line key={'r' + r} x1={x} y1={y + 11 + r * 12} x2={x + w} y2={y + 11 + r * 12} stroke={WF_F} strokeWidth="0.6" />);
      break;
    }
    case 'map': { // circle + crosshair = map symbol, plus pin marks
      const r = Math.min(w, h) / 4;
      parts.push(<circle cx={cx} cy={cy - 4} r={r} fill="none" stroke={WF_F} strokeWidth="0.8" />,
                 <line x1={cx} y1={cy - 4 - r - 4} x2={cx} y2={cy - 4 + r + 4} stroke={WF_F} strokeWidth="0.6" />,
                 <line x1={cx - r - 4} y1={cy - 4} x2={cx + r + 4} y2={cy - 4} stroke={WF_F} strokeWidth="0.6" />,
                 <circle cx={x + 14} cy={y + 14} r="2" fill={WF_S} />,
                 <circle cx={x + w - 16} cy={y + h - 16} r="2" fill={WF_S} />);
      break;
    }
    case 'kpi': // a row of metric cards
      for (let k = 0; k < 4; k++)
        parts.push(<rect key={'k' + k} x={x + k * (w / 4) + 2} y={y} width={w / 4 - 5} height={h} fill="none" stroke={WF_F} strokeWidth="0.8" />);
      return <g key={i}>{parts}</g>;
    case 'cards': // 2 x N grid of cards
      for (let r = 0; r < 4; r++) for (let c = 0; c < 1; c++)
        parts.push(<rect key={'c' + r + c} x={x + 2} y={y + r * (h / 4) + 2} width={w - 4} height={h / 4 - 5} fill="none" stroke={WF_F} strokeWidth="0.8" />);
      return <g key={i}>{parts}</g>;
    case 'form': // field rows
      parts.push(box);
      for (let r = 0; r < 4; r++) {
        parts.push(<line key={'fl' + r} x1={x + 6} y1={y + 16 + r * 16} x2={x + 22} y2={y + 16 + r * 16} stroke={WF_F} strokeWidth="1" />,
                   <rect key={'fr' + r} x={x + 26} y={y + 11 + r * 16} width={w - 32} height={8} fill="none" stroke={WF_F} strokeWidth="0.7" />);
      }
      return <g key={i}>{parts}<text x={x + 6} y={y - 2} fontSize="6.5" fontFamily={WF_MONO} fill={WF_L}>{label}</text></g>;
    case 'tree': { // decision tree: root → 2 → 4
      const rootX = cx, rootY = y + 8;
      const l2 = [x + w * 0.28, x + w * 0.72], y2 = y + h * 0.42;
      const l3 = [x + w * 0.12, x + w * 0.40, x + w * 0.60, x + w * 0.88], y3 = y + h * 0.80;
      const node = (nx: number, ny: number, kk: string) => <rect key={kk} x={nx - 13} y={ny - 8} width={26} height={16} fill="none" stroke={WF_S} strokeWidth="1" />;
      parts.push(node(rootX, rootY, 'rt'));
      l2.forEach((lx, k) => parts.push(<line key={'l2l' + k} x1={rootX} y1={rootY + 8} x2={lx} y2={y2 - 8} stroke={WF_F} strokeWidth="0.7" />, node(lx, y2, 'n2' + k)));
      l3.forEach((lx, k) => parts.push(<line key={'l3l' + k} x1={l2[k < 2 ? 0 : 1]} y1={y2 + 8} x2={lx} y2={y3 - 8} stroke={WF_F} strokeWidth="0.7" />, node(lx, y3, 'n3' + k)));
      parts.push(<text x={cx} y={y + h + 2} textAnchor="middle" fontSize="6.5" fontFamily={WF_MONO} fill={WF_L}>{label}</text>);
      return <g key={i}>{parts}</g>;
    }
    case 'db': { // cylinder
      const rx = w / 2, ry = 8;
      parts.push(<ellipse cx={cx} cy={y + ry} rx={rx} ry={ry} fill="none" stroke={WF_S} strokeWidth="1" />,
                 <line x1={x} y1={y + ry} x2={x} y2={y + h - ry} stroke={WF_S} strokeWidth="1" />,
                 <line x1={x + w} y1={y + ry} x2={x + w} y2={y + h - ry} stroke={WF_S} strokeWidth="1" />,
                 <path d={`M ${x} ${y + h - ry} A ${rx} ${ry} 0 0 0 ${x + w} ${y + h - ry}`} fill="none" stroke={WF_S} strokeWidth="1" />,
                 <ellipse cx={cx} cy={y + h * 0.5} rx={rx} ry={ry} fill="none" stroke={WF_F} strokeWidth="0.6" />);
      return <g key={i}>{parts}<text x={cx} y={y + h + 1} textAnchor="middle" fontSize="6.5" fontFamily={WF_MONO} fill={WF_L}>{label}</text></g>;
    }
    case 'browser': // window with toolbar dots
      parts.push(box, <rect x={x} y={y} width={w} height={12} fill={WF_F} />);
      parts.push(<circle cx={x + 7} cy={y + 6} r="1.8" fill={WF_S} />, <circle cx={x + 13} cy={y + 6} r="1.8" fill={WF_S} />, <circle cx={x + 19} cy={y + 6} r="1.8" fill={WF_S} />);
      for (let r = 0; r < 3; r++) parts.push(<line key={'bl' + r} x1={x + 8} y1={y + 24 + r * 12} x2={x + w - 8} y2={y + 24 + r * 12} stroke={WF_F} strokeWidth="0.7" />);
      break;
    case 'file': // page with folded corner
      parts.push(<path d={`M ${x} ${y} L ${x + w - 16} ${y} L ${x + w} ${y + 16} L ${x + w} ${y + h} L ${x} ${y + h} Z`} fill="none" stroke={WF_S} strokeWidth="1" />,
                 <path d={`M ${x + w - 16} ${y} L ${x + w - 16} ${y + 16} L ${x + w} ${y + 16}`} fill="none" stroke={WF_F} strokeWidth="0.7" />);
      for (let r = 0; r < 5; r++) parts.push(<line key={'fl' + r} x1={x + 8} y1={y + 28 + r * 14} x2={x + w - 8} y2={y + 28 + r * 14} stroke={WF_F} strokeWidth="0.7" />);
      break;
    case 'gear': { // labeled box with a cog
      parts.push(box);
      const gx = cx, gy = cy - 3, gr = 9;
      parts.push(<circle cx={gx} cy={gy} r={gr} fill="none" stroke={WF_S} strokeWidth="1" />, <circle cx={gx} cy={gy} r="3" fill="none" stroke={WF_F} strokeWidth="0.8" />);
      for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2; parts.push(<line key={'g' + a} x1={gx + Math.cos(ang) * gr} y1={gy + Math.sin(ang) * gr} x2={gx + Math.cos(ang) * (gr + 3)} y2={gy + Math.sin(ang) * (gr + 3)} stroke={WF_S} strokeWidth="1" />); }
      return <g key={i}>{parts}<text x={cx} y={y + h - 4} textAnchor="middle" fontSize="6" fontFamily={WF_MONO} fill={WF_L}>{label}</text></g>;
    }
    case 'arrow': // horizontal arrow from (x,y) length w
      parts.push(<line x1={x} y1={y} x2={x + w - 4} y2={y} stroke={WF_S} strokeWidth="1" />,
                 <path d={`M ${x + w - 6} ${y - 3} L ${x + w} ${y} L ${x + w - 6} ${y + 3}`} fill="none" stroke={WF_S} strokeWidth="1" />);
      return <g key={i}>{parts}</g>;
    case 'diagram': { // mini mind-map of connected boxes
      parts.push(box);
      const cols = [x + 18, cx, x + w - 18];
      const ys = [y + 30, y + h / 2, y + h - 30];
      cols.forEach((colX, ci) => ys.forEach((ny, ri) => {
        if ((ci + ri) % 2 === 0) parts.push(<rect key={'d' + ci + ri} x={colX - 10} y={ny - 6} width={20} height={12} fill="none" stroke={WF_F} strokeWidth="0.8" />);
      }));
      parts.push(<line x1={cols[0]} y1={ys[0]} x2={cols[1]} y2={ys[1]} stroke={WF_F} strokeWidth="0.6" />,
                 <line x1={cols[1]} y1={ys[1]} x2={cols[2]} y2={ys[0]} stroke={WF_F} strokeWidth="0.6" />,
                 <line x1={cols[1]} y1={ys[1]} x2={cols[2]} y2={ys[2]} stroke={WF_F} strokeWidth="0.6" />);
      break;
    }
    case 'panel': // plain container with title bar + text lines
      parts.push(box, <rect x={x} y={y} width={w} height={11} fill={WF_F} />);
      for (let r = 0; r < Math.max(2, Math.floor((h - 14) / 12)); r++)
        parts.push(<line key={'pl' + r} x1={x + 6} y1={y + 22 + r * 12} x2={x + w - 6} y2={y + 22 + r * 12} stroke={WF_F} strokeWidth="0.6" />);
      return <g key={i}>{parts}{label && <text x={x + 5} y={y + 8} fontSize="6" fontFamily={WF_MONO} fill={WF_L}>{label}</text>}</g>;
  }
  return <g key={i}>{box}{parts}{lbl}</g>;
}

function WireframeSketch({ nodeId, color }: { nodeId: string; color: string }) {
  const wf = WIREFRAMES[nodeId] ?? FALLBACK_WF;
  const tabX0 = wf.sidebar ? 34 : 6;

  return (
    <div style={{ width: '100%', background: '#0a1628', border: `1px solid rgba(${hexFromColor(color)},0.35)`, borderRadius: 3 }}>
      <svg viewBox="0 0 280 180" width="100%" style={{ display: 'block' }}>
        {/* frame */}
        <rect x="1" y="1" width="278" height="178" fill="none" stroke="rgba(0,188,212,0.25)" strokeWidth="1" />
        {/* sidebar */}
        {wf.sidebar && (
          <g>
            <rect x="4" y="4" width="26" height="172" fill="none" stroke={WF_S} strokeWidth="1" />
            <rect x="4" y="4" width="26" height="14" fill={WF_F} />
            {Array.from({ length: 7 }).map((_, k) => (
              <line key={k} x1="8" y1={28 + k * 18} x2="26" y2={28 + k * 18} stroke={WF_F} strokeWidth="1.2" />
            ))}
          </g>
        )}
        {/* tab buttons */}
        {wf.tabs?.map((tab, k) => {
          const tw = 36, tx = tabX0 + k * (tw + 3);
          if (tx + tw > 278) return null;
          return (
            <g key={tab}>
              <rect x={tx} y={4} width={tw} height={11} fill={k === 0 ? `rgba(${hexFromColor(color)},0.5)` : 'none'} stroke={k === 0 ? color : WF_F} strokeWidth="0.8" />
              <text x={tx + tw / 2} y={12} textAnchor="middle" fontSize="5.5" fontFamily={WF_MONO} fill={k === 0 ? '#eaffff' : WF_L}>
                {tab.length > 9 ? tab.slice(0, 8) + '…' : tab}
              </text>
            </g>
          );
        })}
        {/* content elements */}
        {wf.els.map((el, i) => drawWfEl(el, i))}
      </svg>
    </div>
  );
}
