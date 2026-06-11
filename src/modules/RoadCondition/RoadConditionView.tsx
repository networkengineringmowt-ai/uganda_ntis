import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
  Cell, ReferenceLine, PieChart, Pie,
} from 'recharts';
import {
  Activity, CheckCircle2, AlertTriangle, Camera,
  TrendingUp, DollarSign, Zap, Layers, X,
} from 'lucide-react';
import { MapContainer, TileLayer, GeoJSON, useMap, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { GeoJsonObject, Feature, FeatureCollection, Geometry } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';
import {
  NEON, REGION_NEON, Bar3D, Chart3DWrap, AreaGradDefs, TT_NEON, TICK,
} from '../../lib/chart3d';

import { WaterLayers } from '../../shared/WaterLayers';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend, LEGEND_CONDITION } from '../../shared/MapLegend';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import SourceTableButton from '../../shared/SourceTableButton';
import MapDetailPane, { StatCard, AttributeRow, SectionHeader } from '../../shared/MapDetailPane';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { vciRating } from '../../shared/vci';
import PavementAgePanel from './PavementAgePanel';

const BASE = import.meta.env.BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
interface ImageDefectSummary {
  model: string; images_processed: number;
  defect_distribution: Record<string, number>;
  severity_distribution: Record<string, number>;
  top_damaged_links: Array<{
    link_id: string; dominant_defect: string; image_count: number; avg_severity: string;
  }>;
}
interface CondBand {
  good_pct: number; fair_pct: number; poor_pct: number; very_poor_pct: number;
}
interface CurvePt { year: number; avg_iri: number; ci_low: number; ci_high: number }
interface BudgetPt {
  year: number; routine_usd: number; reseal_usd: number; overlay_usd: number;
  rehab_usd: number; reconstruct_usd: number; regravelling_usd: number; total_usd: number;
}
interface TriggerItem {
  link_id: string; road_name: string; region: string; road_class: string;
  surface_cat: string; trigger_year: number; treatment: string;
  iri: number; length_km: number; total_cost_usd: number;
  priority_score: number; urgency: 'now' | 'urgent' | 'soon' | 'planned';
}
interface DetSummary {
  model_type: string; r_squared: number; links_projected: number;
  projection_period: string; generated_at: string;
  network_condition_2024: CondBand; network_condition_2030: CondBand;
  class_deterioration_curves: Record<string, CurvePt[]>;
  intervention_schedule: TriggerItem[];
  budget_schedule_2024_2030: BudgetPt[];
  total_maintenance_budget_2024_2030_usd: number;
  intervention_thresholds_iri: Record<string, number>;
  unit_costs_usd_per_km: Record<string, number>;
}
interface LinkRisk { rc: string; idx: number; hpct: number; esal: number }
interface OverloadingSummary {
  link_risk_map: Record<string, LinkRisk>;
}
type MapLayer = 'condition' | 'urgency' | 'overloading' | 'rutting' | 'cracking' | 'surface' | 'class' | 'unsurveyed';
interface SelectedLinkData {
  linkId: string; roadName: string; roadClass: string; region: string; lengthKm: number;
  iri: number; band: string; sparkData: { year: number; iri: number }[];
  treatment?: string; triggerYear?: number; costUsd?: number; urgency?: string;
  riskCategory?: string; dailyEsals?: number; dominantDefect?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT = '#6366f1';
const BG_CARD = 'rgba(15,23,42,0.55)';
const CLASS_COLORS: Record<string, string> = {
  A: '#00f5ff', B: '#00ff88', C: '#ffd23f', M: '#b967ff',
};
const URGENCY_COLOR: Record<string, string> = {
  now: '#ff2d78', urgent: '#ff6b35', soon: '#ffd23f', planned: '#00ff88',
};
const DEFECT_COLOR: Record<string, string> = {
  pothole: '#ff2d78', alligator_crack: '#ff6b35', longitudinal_crack: '#ffd23f',
  transverse_crack: '#ffd23f', rutting: '#ff9500', raveling: '#94a3b8', good: '#00ff88',
};
const DEFECT_LABEL: Record<string, string> = {
  pothole: 'Pothole', alligator_crack: 'Alligator Crack', longitudinal_crack: 'Long. Crack',
  transverse_crack: 'Trans. Crack', rutting: 'Rutting', raveling: 'Raveling', good: 'Good',
};
const IRI_COLOR: Record<string, string> = {
  good: '#22c55e', fair: '#eab308', poor: '#f97316', very_poor: '#ef4444',
};
const RISK_COLOR: Record<string, string> = {
  Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e',
};
const REGION_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  all:      [[-1.5, 29.5], [4.2, 35.5]],
  Central:  [[0.0,  30.0], [2.0, 33.5]],
  Eastern:  [[0.5,  33.0], [3.5, 35.0]],
  Northern: [[2.0,  30.5], [4.2, 34.5]],
  Western:  [[-1.5, 29.5], [2.5, 32.0]],
};
const REGION_PILLS = ['all', 'Central', 'Eastern', 'Northern', 'Western'] as const;
const LAYER_LABELS: Record<MapLayer, string> = {
  condition:  'IRI Condition',
  urgency:    'Urgency',
  overloading:'Overloading',
  rutting:    'Rutting (mm)',
  cracking:   'Cracking %',
  surface:    'Surface Type',
  class:      'Road Class',
  unsurveyed: 'Not Surveyed',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getIriBand(iri: number): string {
  if (iri < 3.5) return 'good';
  if (iri < 6.5) return 'fair';
  if (iri < 9.0) return 'poor';
  return 'very_poor';
}

function getLineMidpoint(geom: Geometry): [number, number] | null {
  if (geom.type === 'LineString') {
    const coords = geom.coordinates as number[][];
    if (!coords.length) return null;
    const mid = coords[Math.floor(coords.length / 2)];
    return [mid[1], mid[0]];
  }
  if (geom.type === 'MultiLineString') {
    const lines = geom.coordinates as number[][][];
    if (!lines.length) return null;
    const line = lines[0];
    const mid = line[Math.floor(line.length / 2)];
    return [mid[1], mid[0]];
  }
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface LinkCond {
  iri: number; rut_mm: number; cracking: number;
  pci: number; vci: number; surface: string; year: number;
}

// ─── Loaders ──────────────────────────────────────────────────────────────────
async function loadDetSummary(): Promise<DetSummary | null> {
  try { const r = await fetch(BASE + 'data/deterioration_summary.json'); return r.json(); }
  catch { return null; }
}
async function loadRoadGeo(): Promise<GeoJsonObject | null> {
  // Always use the master network GeoJSON (1013 links, canonical link_ids)
  try { const r = await fetch(BASE + 'data/network2026.geojson'); return r.json(); }
  catch { return null; }
}
async function loadOverloading(): Promise<OverloadingSummary | null> {
  try { const r = await fetch(BASE + 'data/overloading_summary.json'); return r.json(); }
  catch { return null; }
}
async function loadConditionLookup(): Promise<Record<string, LinkCond>> {
  try {
    const r = await fetch(BASE + 'data/link_condition_lookup.json');
    return r.json();
  } catch { return {}; }
}

// ─── MapController — flies to region bounding box ─────────────────────────────
function MapController({ region }: { region: string }) {
  const map = useMap();
  useEffect(() => {
    const bounds = REGION_BOUNDS[region] ?? REGION_BOUNDS['all'];
    map.flyToBounds(bounds as L.LatLngBoundsExpression, { duration: 1.2 });
  }, [region, map]);
  return null;
}

// ─── ConditionMap — interactive road condition map ────────────────────────────
// ── Small filter UI helpers used inside the filter drawer ───────────────────
const filterInputStyle: React.CSSProperties = {
  flex: 1, fontSize: 10, padding: '5px 7px', borderRadius: 5,
  background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.18)',
  color: '#e2eaf4', outline: 'none', textAlign: 'center',
  fontFamily: 'monospace',
};
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: 'rgba(148,163,184,0.7)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
function FilterSelect<T extends string>({
  value, onChange, options, labels,
}: {
  value: T; onChange: (v: T) => void; options: readonly T[]; labels?: Partial<Record<T, string>>;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as T)} style={{
      width: '100%', fontSize: 10, padding: '5px 7px', borderRadius: 5,
      background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.18)',
      color: '#e2eaf4', outline: 'none', cursor: 'pointer',
    }}>
      {options.map(o => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
    </select>
  );
}

function ConditionMap({
  det, overloading, defectSummary, geo, surveyGeo, showSurveyLayer, setShowSurveyLayer,
  selected, setSelected, condLookup,
}: {
  det: DetSummary | null;
  overloading: OverloadingSummary | null;
  defectSummary: ImageDefectSummary | null;
  geo: GeoJsonObject | null;
  surveyGeo: GeoJsonObject | null;
  showSurveyLayer: boolean;
  setShowSurveyLayer: (v: boolean) => void;
  selected: SelectedLinkData | null;
  setSelected: (v: SelectedLinkData | null) => void;
  condLookup: Record<string, LinkCond>;
}) {
  const [mapLayer, setMapLayer] = useState<MapLayer>('condition');
  const [region,   setRegion]   = useState<string>('all');

  // ── Filter drawer state ──────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [filterClass,    setFilterClass]    = useState<string>('all');
  const [filterSurface,  setFilterSurface]  = useState<string>('all');
  const [filterCondBand, setFilterCondBand] = useState<string>('all');
  const [filterYearMin,  setFilterYearMin]  = useState<number>(2020);
  const [filterYearMax,  setFilterYearMax]  = useState<number>(2026);

  // ── Top-N worst links overlay ────────────────────────────────────────────
  const [showWorst, setShowWorst] = useState(false);
  const WORST_N = 20;

  const urgencyMap = useMemo(() => {
    const m: Record<string, TriggerItem> = {};
    (det?.intervention_schedule ?? []).forEach(t => { m[t.link_id] = t; });
    return m;
  }, [det]);

  const riskMap = useMemo(() => overloading?.link_risk_map ?? {}, [overloading]);

  // Top-N links by IRI (descending) — populated whenever the urgency schedule changes
  const worstLinks = useMemo(() => {
    return Object.values(urgencyMap)
      .filter(t => typeof t.iri === 'number')
      .sort((a, b) => (b.iri ?? 0) - (a.iri ?? 0))
      .slice(0, WORST_N);
  }, [urgencyMap]);
  const worstLinkIds = useMemo(() => new Set(worstLinks.map(t => t.link_id)), [worstLinks]);
  const worstRankByLink = useMemo(() => {
    const m: Record<string, number> = {};
    worstLinks.forEach((t, i) => { m[t.link_id] = i + 1; });
    return m;
  }, [worstLinks]);

  const defectMap = useMemo(() => {
    const m: Record<string, { dominant_defect: string; avg_severity: string }> = {};
    (defectSummary?.top_damaged_links ?? []).forEach(d => { m[d.link_id] = d; });
    return m;
  }, [defectSummary]);

  const classIriMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [cls, pts] of Object.entries(det?.class_deterioration_curves ?? {})) {
      const pt2024 = pts.find(p => p.year === 2024);
      if (pt2024) m[cls] = pt2024.avg_iri;
    }
    return m;
  }, [det]);

  const defectMarkers = useMemo(() => {
    if (!defectSummary || !geo) return [];
    const fc = geo as FeatureCollection<Geometry>;
    const defectSet = new Set(defectSummary.top_damaged_links.map(d => d.link_id));
    const result: Array<{
      pos: [number, number];
      info: { link_id: string; dominant_defect: string; avg_severity: string };
      linkName: string;
    }> = [];
    (fc.features ?? []).forEach(f => {
      const props = f.properties as Record<string, string> | null;
      const lid = props?.link_id;
      if (!lid || !defectSet.has(lid)) return;
      const midpt = getLineMidpoint(f.geometry);
      if (!midpt) return;
      const info = defectSummary.top_damaged_links.find(d => d.link_id === lid);
      if (info) result.push({ pos: midpt, info, linkName: props?.link_name ?? lid });
    });
    return result;
  }, [defectSummary, geo]);

  const styleF = useCallback((feat?: Feature): PathOptions => {
    const p = feat?.properties as Record<string, string | number> | null;
    if (!p) return { color: '#334155', weight: 1, opacity: 0.25 };
    const lid = p.link_id as string;
    const cls = p.road_class as string ?? (p.RD_CLASS as string);
    const surface = String(p.surface_ty ?? p.SURFACE ?? '').toLowerCase();
    const weight = cls === 'A' ? 3.5 : cls === 'B' ? 2.5 : cls === 'M' ? 4 : 2;

    // Primary IRI source: pavement_condition lookup (1017 links)
    // Fallback: urgencyMap (deterioration schedule, 50 links)
    // Fallback: class average from deterioration curves
    const cond   = condLookup[lid];
    const trigger = urgencyMap[lid];
    const liveIri = cond?.iri ?? trigger?.iri ?? classIriMap[cls] ?? null;
    const isSurveyed = !!(cond || trigger);

    // ── Filter check: hide links that don't match ───────────────────────────
    if (filterClass !== 'all' && cls !== filterClass) return { opacity: 0, fillOpacity: 0 };
    if (filterSurface !== 'all') {
      const isPaved = surface === 'bituminous' || surface.includes('paved') || cond?.surface?.includes('asphalt');
      if (filterSurface === 'paved' && !isPaved)   return { opacity: 0, fillOpacity: 0 };
      if (filterSurface === 'unpaved' && isPaved)  return { opacity: 0, fillOpacity: 0 };
    }
    if (filterCondBand !== 'all') {
      const band = liveIri != null ? getIriBand(liveIri) : null;
      if (filterCondBand === 'unsurveyed' && isSurveyed) return { opacity: 0, fillOpacity: 0 };
      if (filterCondBand !== 'unsurveyed' && band !== filterCondBand) return { opacity: 0, fillOpacity: 0 };
    }
    if (filterYearMin > 2016 || filterYearMax < 2030) {
      const yr = cond?.year ?? trigger?.trigger_year;
      if (yr != null && (yr < filterYearMin || yr > filterYearMax)) return { opacity: 0, fillOpacity: 0 };
    }

    // ── Top-N worst-links highlight ─────────────────────────────────────────
    if (showWorst && worstLinkIds.has(lid)) {
      return { color: '#ff0040', weight: weight + 2.5, opacity: 1, dashArray: undefined };
    }

    if (mapLayer === 'urgency') {
      const t = trigger;
      const color = t ? URGENCY_COLOR[t.urgency] : (liveIri != null ? URGENCY_COLOR[liveIri > 9 ? 'now' : liveIri > 6.5 ? 'urgent' : liveIri > 3.5 ? 'soon' : 'planned'] : '#334155');
      const opacity = isSurveyed ? (t?.urgency === 'now' ? 1.0 : 0.75) : 0.2;
      return { color, weight, opacity };
    }
    if (mapLayer === 'overloading') {
      const r = riskMap[lid];
      const color = r ? (RISK_COLOR[r.rc] ?? '#94a3b8') : '#475569';
      return { color, weight, opacity: r ? 0.88 : 0.2 };
    }
    if (mapLayer === 'rutting') {
      const rut = cond?.rut_mm ?? (trigger ? trigger.iri * 2.2 : null);
      if (rut == null) return { color: '#94a3b8', weight: Math.max(weight - 0.5, 1), opacity: 0.32 };
      const c = rut > 20 ? '#ef4444' : rut > 10 ? '#f97316' : rut > 5 ? '#eab308' : '#22c55e';
      return { color: c, weight, opacity: 0.88 };
    }
    if (mapLayer === 'cracking') {
      const crack = cond?.cracking ?? (trigger ? Math.min(trigger.iri * 6, 80) : null);
      if (crack == null) return { color: '#94a3b8', weight: Math.max(weight - 0.5, 1), opacity: 0.32 };
      const c = crack > 50 ? '#ef4444' : crack > 25 ? '#f97316' : crack > 10 ? '#eab308' : '#22c55e';
      return { color: c, weight, opacity: 0.88 };
    }
    if (mapLayer === 'surface') {
      const surfStr = cond?.surface || surface;
      const isPaved = surfStr.includes('asphalt') || surfStr.includes('bituminous') || surfStr.includes('paved');
      return { color: isPaved ? '#00f5ff' : '#ff8c00', weight, opacity: 0.85,
        dashArray: isPaved ? undefined : '4 3' };
    }
    if (mapLayer === 'class') {
      const c = CLASS_COLORS[cls] ?? '#94a3b8';
      return { color: c, weight, opacity: 0.85 };
    }
    if (mapLayer === 'unsurveyed') {
      return { color: isSurveyed ? '#475569' : '#ff6b35', weight, opacity: isSurveyed ? 0.2 : 0.95 };
    }
    // IRI condition layer — use condLookup first (1017 links), then urgency, then class avg
    if (liveIri == null) {
      return { color: '#94a3b8', weight: Math.max(weight - 0.5, 1), opacity: 0.28 };
    }
    const band = getIriBand(liveIri);
    return { color: IRI_COLOR[band], weight, opacity: 0.85 };
  }, [mapLayer, urgencyMap, riskMap, classIriMap, condLookup,
      filterClass, filterSurface, filterCondBand, filterYearMin, filterYearMax,
      showWorst, worstLinkIds]);

  const handleSelect = useCallback((props: Record<string, unknown>) => {
    const lid = props.link_id as string;
    const cls = (props.road_class ?? props.RD_CLASS) as string;
    const trigger = urgencyMap[lid];
    const risk    = riskMap[lid];
    const defect  = defectMap[lid];
    const cond    = condLookup[lid];
    // Prefer pavement_condition over deterioration schedule, then class avg
    const iri     = cond?.iri ?? trigger?.iri ?? classIriMap[cls] ?? 6;
    const band    = getIriBand(iri);
    const sparkData = (det?.class_deterioration_curves[cls] ?? []).map(p => ({
      year: p.year, iri: +p.avg_iri.toFixed(2),
    }));
    setSelected({
      linkId: lid,
      roadName: (props.link_name ?? props.LINK_NAME ?? trigger?.road_name ?? lid) as string,
      roadClass: cls,
      region: (props.region ?? props.REGION ?? trigger?.region ?? '—') as string,
      lengthKm: +((props.length_km ?? props.LENGTH_KM ?? 0) as number),
      iri, band, sparkData,
      treatment: trigger?.treatment,
      triggerYear: trigger?.trigger_year ?? cond?.year,
      costUsd: trigger?.total_cost_usd,
      urgency: trigger?.urgency,
      riskCategory: risk?.rc,
      dailyEsals: risk?.esal,
      dominantDefect: defect?.dominant_defect,
    });
  }, [urgencyMap, riskMap, defectMap, classIriMap, condLookup, det]);

  const onEachF = useCallback((feat: Feature, layer: Layer) => {
    const path = layer as L.Path;
    const p = feat.properties as Record<string, unknown> | null;
    const lid = (p?.link_id as string) ?? '';

    // Worst-N tooltip — bind only when overlay active and link is in top-N
    if (showWorst && worstLinkIds.has(lid)) {
      const rank = worstRankByLink[lid];
      const t = urgencyMap[lid];
      const iri = t?.iri?.toFixed(2) ?? '—';
      (layer as unknown as { bindTooltip: (s: string, o?: object) => void }).bindTooltip(
        `<div style="font:600 11px/1.5 system-ui">
           <div style="color:#ff5577;font-weight:800;font-size:12px">⚠ Rank #${rank}</div>
           <div style="color:#e2eaf4;font-family:monospace;font-size:10px">${lid}</div>
           <div style="color:#fca5a5;margin-top:3px">IRI ${iri} m/km</div>
         </div>`,
        { sticky: true, className: 'leaflet-tooltip-dark', direction: 'top' },
      );
    }

    path.on({
      click:     () => handleSelect(feat.properties as Record<string, unknown>),
      mouseover: (e: L.LeafletMouseEvent) => (e.target as L.Path).setStyle({ weight: 6, opacity: 1 }),
      mouseout:  (e: L.LeafletMouseEvent) => (e.target as L.Path).setStyle(styleF(feat)),
    });
  }, [handleSelect, styleF, showWorst, worstLinkIds, worstRankByLink, urgencyMap]);

  const legendItems = useMemo(() => {
    if (mapLayer === 'condition') return [
      { label: 'Good  IRI < 3.5',        color: IRI_COLOR.good },
      { label: 'Fair  3.5–6.5',          color: IRI_COLOR.fair },
      { label: 'Poor  6.5–9.0',          color: IRI_COLOR.poor },
      { label: 'Very Poor  > 9.0',       color: IRI_COLOR.very_poor },
      { label: 'Not Surveyed / Works',   color: '#94a3b8' },
    ];
    if (mapLayer === 'urgency') return [
      { label: '2026 — Act Now',   color: URGENCY_COLOR.now },
      { label: '2027',             color: URGENCY_COLOR.urgent },
      { label: '2028–29',          color: URGENCY_COLOR.soon },
      { label: '2030+',            color: URGENCY_COLOR.planned },
    ];
    if (mapLayer === 'rutting') return [
      { label: 'Light   < 5 mm',   color: '#22c55e' },
      { label: 'Moderate 5–10 mm', color: '#eab308' },
      { label: 'Heavy  10–20 mm',  color: '#f97316' },
      { label: 'Severe > 20 mm',   color: '#ef4444' },
      { label: 'Not surveyed',     color: '#94a3b8' },
    ];
    if (mapLayer === 'cracking') return [
      { label: 'Low  < 10%',     color: '#22c55e' },
      { label: 'Moderate 10–25%',color: '#eab308' },
      { label: 'High 25–50%',    color: '#f97316' },
      { label: 'Severe > 50%',   color: '#ef4444' },
      { label: 'Not surveyed',   color: '#94a3b8' },
    ];
    if (mapLayer === 'surface') return [
      { label: 'Paved (Bituminous)', color: '#00f5ff' },
      { label: 'Unsealed / Gravel',  color: '#ff8c00' },
    ];
    if (mapLayer === 'class') return [
      { label: 'Class A — Trunk',   color: CLASS_COLORS.A },
      { label: 'Class B — Primary', color: CLASS_COLORS.B },
      { label: 'Class C — Secondary',color: CLASS_COLORS.C },
      { label: 'Class M — Municipal',color: CLASS_COLORS.M },
    ];
    if (mapLayer === 'unsurveyed') return [
      { label: 'Not Surveyed',  color: '#ff6b35' },
      { label: 'Surveyed (condLookup + ML)', color: '#475569' },
    ];
    return [
      { label: 'Critical', color: RISK_COLOR.Critical },
      { label: 'High',     color: RISK_COLOR.High },
      { label: 'Medium',   color: RISK_COLOR.Medium },
      { label: 'Low',      color: RISK_COLOR.Low },
    ];
  }, [mapLayer]);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header + region pills */}
      <div className="flex items-start justify-between gap-4 flex-wrap"
           style={{ padding:'8px 12px', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(10,15,30,0.7)' }}>
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Layers size={15} style={{ color: ACCENT }}/> Interactive Road Condition Map
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Click any road segment to inspect · toggle layers (top-right) · fly to region below
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {REGION_PILLS.map(r => (
            <button key={r} onClick={() => setRegion(r)}
              className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all border"
              style={{
                background:  region === r ? ACCENT + '33' : 'rgba(30,41,59,0.8)',
                borderColor: region === r ? ACCENT : 'rgba(148,163,184,0.15)',
                color:       region === r ? '#a5b4fc' : '#94a3b8',
              }}>
              {r === 'all' ? 'All Uganda' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Map area — fills remaining height */}
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        {/* Map itself */}
        <div className="absolute inset-0 overflow-hidden">
          {geo ? (
            <MapContainer
              center={[1.3733, 32.2903]} zoom={7}
              style={{ height: '100%', width: '100%', background: '#0a0f1e' }}
              zoomControl={false}>
              <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
              <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
              <WaterLayers />
              <InfraLayers />
              <GeoJSON
                key={`${mapLayer}-${filterClass}-${filterSurface}-${filterCondBand}-${filterYearMin}-${filterYearMax}-${showWorst ? 1 : 0}`}
                data={geo}
                style={styleF as (feat?: Feature) => PathOptions}
                onEachFeature={onEachF as (feat: Feature, layer: Layer) => void}/>
              {defectMarkers.map(m => (
                <CircleMarker
                  key={m.info.link_id}
                  center={m.pos as L.LatLngExpression}
                  radius={6}
                  fillColor={DEFECT_COLOR[m.info.dominant_defect] ?? '#4d9fff'}
                  color="rgba(0,0,0,0.5)" weight={1} fillOpacity={0.9}>
                  <Popup>
                    <div style={{ fontSize: 11, minWidth: 140 }}>
                      <strong>{m.linkName}</strong><br/>
                      {DEFECT_LABEL[m.info.dominant_defect] ?? m.info.dominant_defect}
                      {' · '}{m.info.avg_severity} severity
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              {showSurveyLayer && surveyGeo && (
                <GeoJSON
                  key="survey"
                  data={surveyGeo}
                  style={() => ({
                    color: '#facc15', weight: 3, opacity: 0.85,
                    fillColor: '#facc15', fillOpacity: 0.15,
                  })}
                  onEachFeature={(feat, layer) => {
                    const p = feat.properties as Record<string, unknown> | null;
                    if (!p) return;
                    layer.bindTooltip(
                      `<strong>${p.road_name ?? p.link_id}</strong><br/>` +
                      `IRI ${(p.mean_iri as number)?.toFixed(2) ?? '—'} m/km · ${p.condition_class ?? '—'}<br/>` +
                      `Survey ${p.survey_year ?? '—'}`,
                      { sticky: true, className: 'leaflet-tooltip-dark' },
                    );
                  }}
                />
              )}
              <MapController region={region}/>
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600 text-sm"
                 style={{ background: '#0a0f1e' }}>
              Loading map…
            </div>
          )}
        </div>

        {/* Layer switcher — top-right */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {/* Section label */}
          <div style={{
            fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.55)',
            textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '4px 8px',
          }}>Attribute</div>
          {(['condition', 'rutting', 'cracking', 'urgency', 'surface', 'class', 'overloading', 'unsurveyed'] as MapLayer[]).map(l => (
            <button key={l} onClick={() => setMapLayer(l)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                border: `1px solid ${mapLayer === l ? ACCENT : 'rgba(148,163,184,0.2)'}`,
                background: mapLayer === l ? ACCENT + '33' : 'rgba(10,15,30,0.9)',
                color: mapLayer === l ? '#a5b4fc' : '#94a3b8',
                backdropFilter: 'blur(10px)', cursor: 'pointer', whiteSpace: 'nowrap',
                textAlign: 'left',
              }}>
              {LAYER_LABELS[l]}
            </button>
          ))}
          {surveyGeo && (
            <button onClick={() => setShowSurveyLayer(!showSurveyLayer)}
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                border: `1px solid ${showSurveyLayer ? '#facc15' : 'rgba(148,163,184,0.2)'}`,
                background: showSurveyLayer ? '#facc1533' : 'rgba(10,15,30,0.9)',
                color: showSurveyLayer ? '#facc15' : '#94a3b8',
                backdropFilter: 'blur(10px)', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              ROMDAS Survey
            </button>
          )}

          {/* ── Top-N Worst Links toggle ── */}
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button onClick={() => setShowWorst(!showWorst)}
              style={{
                width: '100%',
                padding: '7px 12px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                border: `1px solid ${showWorst ? '#ff0040' : 'rgba(255,0,64,0.3)'}`,
                background: showWorst ? '#ff004022' : 'rgba(255,0,64,0.06)',
                color: showWorst ? '#ff5577' : '#fca5a5',
                backdropFilter: 'blur(10px)', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: showWorst ? '0 0 12px rgba(255,0,64,0.4)' : 'none',
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              }}>
              ⚠ {showWorst ? 'Hide' : 'Show'} Worst {WORST_N} Links
            </button>
          </div>
        </div>

        {/* ── Filter Drawer Toggle (left side) ── */}
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 1000,
        }}>
          <button onClick={() => setFiltersOpen(!filtersOpen)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700,
              border: `1px solid ${filtersOpen ? ACCENT : 'rgba(148,163,184,0.25)'}`,
              background: filtersOpen ? ACCENT + '33' : 'rgba(10,15,30,0.92)',
              color: filtersOpen ? '#a5b4fc' : '#cbd5e1',
              backdropFilter: 'blur(10px)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            ☰ Filters {filtersOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* ── Filter Drawer (slides in from left) ── */}
        {filtersOpen && (
          <div style={{
            position: 'absolute', top: 50, left: 10, zIndex: 999,
            width: 240, maxHeight: 'calc(100% - 120px)', overflowY: 'auto',
            background: 'rgba(10,15,30,0.96)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 6px 32px rgba(0,0,0,0.5), inset 1px 0 0 rgba(99,102,241,0.15)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ACCENT,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Network Filters
            </div>

            {/* Region (re-uses existing region pills above the map — also shown here for completeness) */}
            <FilterGroup label="Region">
              <FilterSelect value={region} onChange={setRegion} options={REGION_PILLS as unknown as readonly string[]}/>
            </FilterGroup>

            {/* Functional class */}
            <FilterGroup label="Functional Class">
              <FilterSelect value={filterClass} onChange={setFilterClass} options={['all', 'A', 'B', 'C', 'M']}
                labels={{ all: 'All', A: 'National (A) — Trunk', B: 'District (B) — Primary',
                          C: 'Community (C) — Secondary', M: 'Urban (M) — Municipal' }}/>
            </FilterGroup>

            {/* Surface type */}
            <FilterGroup label="Surface Type">
              <FilterSelect value={filterSurface} onChange={setFilterSurface} options={['all', 'paved', 'unpaved']}
                labels={{ all: 'All', paved: 'Paved (Bituminous)', unpaved: 'Unpaved / Gravel' }}/>
            </FilterGroup>

            {/* Condition band */}
            <FilterGroup label="Condition Band">
              <FilterSelect value={filterCondBand} onChange={setFilterCondBand}
                options={['all', 'good', 'fair', 'poor', 'very_poor', 'unsurveyed']}
                labels={{ all: 'All', good: 'Good (IRI < 3.5)', fair: 'Fair (3.5–6.5)',
                          poor: 'Poor (6.5–9.0)', very_poor: 'Very Poor (> 9.0)',
                          unsurveyed: 'Not Surveyed' }}/>
            </FilterGroup>

            {/* Survey year range */}
            <FilterGroup label={`Trigger Year: ${filterYearMin}–${filterYearMax}`}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 9 }}>
                <input type="number" value={filterYearMin} min={2016} max={2030}
                  onChange={e => setFilterYearMin(Number(e.target.value))}
                  style={filterInputStyle}/>
                <span style={{ color: '#475569' }}>—</span>
                <input type="number" value={filterYearMax} min={2016} max={2030}
                  onChange={e => setFilterYearMax(Number(e.target.value))}
                  style={filterInputStyle}/>
              </div>
            </FilterGroup>

            <button onClick={() => {
              setFilterClass('all'); setFilterSurface('all');
              setFilterCondBand('all'); setFilterYearMin(2020); setFilterYearMax(2026);
            }}
              style={{
                width: '100%', marginTop: 8, padding: '6px 10px',
                fontSize: 10, fontWeight: 700, borderRadius: 6,
                background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
                color: '#94a3b8', cursor: 'pointer',
              }}>
              Reset Filters
            </button>
          </div>
        )}

        {/* ── Worst-links tooltip badge (when overlay active) ── */}
        {showWorst && (
          <div style={{
            position: 'absolute', bottom: 90, right: 10, zIndex: 1000,
            background: 'rgba(255,0,64,0.1)', border: '1px solid rgba(255,0,64,0.35)',
            borderRadius: 8, padding: '6px 10px', backdropFilter: 'blur(8px)',
            fontSize: 9.5, color: '#fca5a5',
          }}>
            <div style={{ fontWeight: 800, marginBottom: 2 }}>⚠ Worst {WORST_N} Highlighted</div>
            <div style={{ fontSize: 8.5, color: 'rgba(252,165,165,0.7)' }}>
              Sorted by IRI ↓ · click any red link to inspect
            </div>
          </div>
        )}

        {/* Legend — bottom-left */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10, zIndex: 1000,
          background: 'rgba(10,15,30,0.88)', backdropFilter: 'blur(10px)',
          borderRadius: 8, padding: '8px 10px',
          border: '1px solid rgba(148,163,184,0.12)',
        }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {LAYER_LABELS[mapLayer]}
          </div>
          {legendItems.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 16, height: 4, borderRadius: 2, background: item.color, flexShrink: 0 }}/>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{item.label}</span>
            </div>
          ))}
          {defectMarkers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6,
              borderTop: '1px solid rgba(148,163,184,0.1)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff2d78',
                border: '1px solid rgba(0,0,0,0.5)', flexShrink: 0 }}/>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>Defect hotspot</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Condition KPI cards ──────────────────────────────────────────────────────
function CondKPIs({ c24, c30, linksProjected }: { c24: CondBand; c30: CondBand; linksProjected?: number }) {
  const bands = [
    { key: 'good_pct' as const,      label: 'Good',      color: '#00ff88', sub: 'IRI < 3.5' },
    { key: 'fair_pct' as const,      label: 'Fair',      color: '#ffd23f', sub: 'IRI 3.5–6.5' },
    { key: 'poor_pct' as const,      label: 'Poor',      color: '#ff6b35', sub: 'IRI 6.5–9.0' },
    { key: 'very_poor_pct' as const, label: 'Very Poor', color: '#ff2d78', sub: 'IRI > 9.0' },
  ];
  const notSurveyedPct = linksProjected != null
    ? Math.max(0, ((1013 - linksProjected) / 1013) * 100)
    : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {bands.map(b => {
          const v = c24[b.key]; const delta = +(c30[b.key] - v).toFixed(1);
          return (
            <div key={b.key}
              style={{ background: BG_CARD, backdropFilter: 'blur(20px)', borderLeft: `4px solid ${b.color}` }}
              className="rounded-xl p-4 border border-slate-700/30">
              <div className="text-2xl font-black" style={{ color: b.color }}>{v}%</div>
              <div className="text-xs font-semibold text-slate-300 mt-1">{b.label}</div>
              <div className="text-[10px] text-slate-500">{b.sub}</div>
              <div className="mt-2 text-[10px] flex gap-1">
                <span className="text-slate-400">2030:</span>
                <span style={{ color: b.color }} className="font-bold">{c30[b.key]}%</span>
                <span className={delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-slate-500'}>
                  ({delta > 0 ? '+' : ''}{delta}%)
                </span>
              </div>
              <div className="mt-1.5 bg-slate-700/60 rounded-full h-1.5">
                <div className="rounded-full h-1.5" style={{ width: `${v}%`, background: b.color }}/>
              </div>
            </div>
          );
        })}
      </div>
      {notSurveyedPct != null && (
        <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)', borderLeft: '4px solid #94a3b8' }}
             className="rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xl font-black text-slate-400">
                {notSurveyedPct.toFixed(1)}%
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">
                Not Surveyed / Works in Progress
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {(1013 - (linksProjected ?? 0)).toLocaleString()} of 1,013 links have no ROMDAS / HDM-4 record · shown as grey on map
              </div>
            </div>
            <div className="flex-1 max-w-xs">
              <div className="bg-slate-700/60 rounded-full h-1.5">
                <div className="rounded-full h-1.5" style={{ width: `${notSurveyedPct}%`, background: '#94a3b8' }}/>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Deterioration curves ─────────────────────────────────────────────────────
function DetCurves({
  curves, thresholds,
}: { curves: Record<string, CurvePt[]>; thresholds: Record<string, number> }) {
  const years = Object.values(curves)[0]?.map(p => p.year) ?? [];
  const data = years.map((yr, i) => {
    const row: Record<string, number> = { year: yr };
    for (const [cls, pts] of Object.entries(curves)) {
      if (pts[i]) row[cls] = +pts[i].avg_iri.toFixed(2);
    }
    return row;
  });
  const classes = Object.keys(curves).sort();
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={15} style={{ color: ACCENT }}/> Deterioration Curves 2024–2035
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Network-average IRI by road class · HDM-4 calibrated · ±18% CI
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          {classes.map(c => (
            <div key={c} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-3 h-1.5 rounded" style={{ background: CLASS_COLORS[c] ?? NEON[0] }}/>
              Class {c}
            </div>
          ))}
        </div>
      </div>
      <Chart3DWrap>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 8, right: 20, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
            <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={36}
              label={{ value:'IRI (m/km)', angle:-90, position:'insideLeft',
                fill:'rgba(148,163,184,0.35)', fontSize:9, dy:28 }}/>
            <Tooltip {...TT_NEON}
              formatter={(v: number, name: string) => [`${v.toFixed(2)} m/km`, `Class ${name}`]}/>
            {Object.entries(thresholds).map(([name, val]) => (
              <ReferenceLine key={name} y={val} stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 2"
                label={{ value: name.replace(/_/g,' ')+` (${val})`,
                  position:'insideTopRight', fill:'rgba(148,163,184,0.3)', fontSize:8 }}/>
            ))}
            {classes.map(cls => (
              <Line key={cls} type="monotone" dataKey={cls}
                stroke={CLASS_COLORS[cls] ?? NEON[0]}
                strokeWidth={2.2} dot={false} animationDuration={900}/>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Chart3DWrap>
      <div className="mt-3 flex flex-wrap gap-3">
        {[{v:3.5,l:'Routine'},{v:5.0,l:'Reseal'},{v:6.5,l:'Overlay'},{v:9.0,l:'Rehab'},{v:12.0,l:'Reconstruct'}].map(t => (
          <span key={t.l} className="text-[9px] text-slate-500">
            <span className="inline-block w-4 align-middle mr-1"
              style={{ borderTop:'1px dashed rgba(255,255,255,0.15)' }}/>
            {t.l} {t.v}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Priority table ───────────────────────────────────────────────────────────
function PriorityTable({ triggers }: { triggers: TriggerItem[] }) {
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <Zap size={15} style={{ color: ACCENT }}/> Top 10 Priority Interventions
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-slate-500 border-b border-slate-700/50">
              <th className="text-left pb-2">Road Name</th>
              <th className="text-left pb-2">Region</th>
              <th className="text-left pb-2">Treatment</th>
              <th className="text-right pb-2">IRI</th>
              <th className="text-right pb-2">Year</th>
              <th className="text-right pb-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {triggers.slice(0, 10).map((t, i) => (
              <tr key={i}
                  className="border-b border-slate-800/40 hover:bg-slate-700/10 transition-colors">
                <td className="py-1.5 text-slate-200 font-medium">
                  {t.road_name.length > 28 ? t.road_name.slice(0,26)+'…' : t.road_name}
                </td>
                <td className="py-1.5 text-slate-400">{t.region}</td>
                <td className="py-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{ background: URGENCY_COLOR[t.urgency]+'22', color: URGENCY_COLOR[t.urgency] }}>
                    {t.treatment}
                  </span>
                </td>
                <td className="py-1.5 text-right font-mono" style={{
                  color: t.iri >= 12 ? '#ff2d78' : t.iri >= 9 ? '#ff6b35' : t.iri >= 6.5 ? '#ffd23f' : '#00ff88',
                }}>
                  {t.iri.toFixed(1)}
                </td>
                <td className="py-1.5 text-right text-slate-400">{t.trigger_year}</td>
                <td className="py-1.5 text-right font-mono" style={{ color: ACCENT }}>
                  ${t.total_cost_usd >= 1e6
                    ? (t.total_cost_usd/1e6).toFixed(1)+'M'
                    : (t.total_cost_usd/1000).toFixed(0)+'k'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Budget stacked bar ───────────────────────────────────────────────────────
function BudgetPlanner({ budget, total }: { budget: BudgetPt[]; total: number }) {
  const data = budget.map(b => ({
    year: b.year,
    Routine:     +(b.routine_usd / 1e6).toFixed(2),
    Reseal:      +(b.reseal_usd  / 1e6).toFixed(2),
    Overlay:     +(b.overlay_usd / 1e6).toFixed(2),
    Rehab:       +(b.rehab_usd   / 1e6).toFixed(2),
    Reconstruct: +((b.reconstruct_usd + b.regravelling_usd) / 1e6).toFixed(2),
  }));
  const STACKS = [
    { k: 'Routine',     c: '#00ff88' }, { k: 'Reseal',      c: '#00f5ff' },
    { k: 'Overlay',     c: '#ffd23f' }, { k: 'Rehab',       c: '#ff6b35' },
    { k: 'Reconstruct', c: '#ff2d78' },
  ];
  return (
    <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
         className="rounded-xl border border-slate-700/30 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign size={15} style={{ color: ACCENT }}/> Maintenance Budget Plan 2024–2030
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            USD millions by treatment type · MoWT unit costs
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: ACCENT }}>
            ${(total/1e9).toFixed(2)}B
          </div>
          <div className="text-[10px] text-slate-500">7-year total</div>
        </div>
      </div>
      <Chart3DWrap>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
            <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={46}
              tickFormatter={(v: number) => `$${v}M`}/>
            <Tooltip {...TT_NEON}
              formatter={(v: number, name: string) => [`$${v.toFixed(1)}M`, name]}/>
            {STACKS.map((s, i) => (
              <Bar key={s.k} dataKey={s.k} stackId="a" fill={s.c} fillOpacity={0.85}
                radius={i === STACKS.length - 1 ? [4,4,0,0] : [0,0,0,0]}
                animationDuration={900}/>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Chart3DWrap>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {STACKS.map(s => (
          <div key={s.k} className="text-center">
            <div className="w-full h-1.5 rounded-full mb-1" style={{ background: s.c }}/>
            <div className="text-[9px] text-slate-500">{s.k}</div>
            <div className="text-[10px] font-bold" style={{ color: s.c }}>
              ${(data.reduce((a, b) => a + ((b as Record<string,number>)[s.k] ?? 0), 0)).toFixed(0)}M
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Condition map default pane ───────────────────────────────────────────────
function ConditionDefaultPane({ det }: { det: DetSummary | null }) {
  if (!det) return (
    <div style={{ color:'#475569', fontSize:11, textAlign:'center', paddingTop:20 }}>
      Loading condition data…
    </div>
  );
  const c = det.network_condition_2024;
  const bands = [
    { label:'Good',      pct:c.good_pct,      color:'#22c55e' },
    { label:'Fair',      pct:c.fair_pct,      color:'#84cc16' },
    { label:'Poor',      pct:c.poor_pct,      color:'#eab308' },
    { label:'Very Poor', pct:c.very_poor_pct, color:'#f97316' },
    { label:'Not Surveyed', pct:Math.max(0,100-c.good_pct-c.fair_pct-c.poor_pct-c.very_poor_pct), color:'#94a3b8' },
  ];
  return (
    <div>
      <div style={{ fontSize:9.5, color:'#64748b', marginBottom:10 }}>
        Network condition FY 2023/24 · HDM-4 calibrated
      </div>
      {bands.map(b => (
        <div key={b.label} style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
            <span style={{ fontSize:9.5, color:'#94a3b8' }}>{b.label}</span>
            <span style={{ fontSize:9.5, fontWeight:700, color:b.color }}>{b.pct.toFixed(1)}%</span>
          </div>
          <div style={{ background:'rgba(51,65,85,0.5)', borderRadius:3, height:5 }}>
            <div style={{ width:`${Math.min(b.pct,100)}%`, height:5, borderRadius:3, background:b.color, transition:'width 0.6s ease' }}/>
          </div>
        </div>
      ))}
      <div style={{ marginTop:14, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:9, color:'#475569' }}>
        Click any road segment to inspect its condition, IRI, urgency, overloading risk, and intervention recommendation.
      </div>
      <div style={{ marginTop:10, fontSize:9.5 }}>
        <div style={{ color:'#64748b', marginBottom:4 }}>2024 → 2030 Projection</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {bands.slice(0,4).map(b => {
            const d30 = (det.network_condition_2030 as unknown as Record<string,number>)[b.label.toLowerCase().replace(' ','_')+'_pct'] ?? 0;
            const delta = +(d30 - b.pct).toFixed(1);
            return (
              <span key={b.label} style={{
                fontSize:8.5, padding:'2px 6px', borderRadius:4,
                background:`rgba(${b.color==='#22c55e'?'34,197,94':b.color==='#84cc16'?'132,204,22':b.color==='#eab308'?'234,179,8':'249,115,22'},0.1)`,
                color:b.color, fontWeight:700,
              }}>
                {b.label.charAt(0)}: {delta>0?'+':''}{delta}%
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Render selected condition link in MapDetailPane ─────────────────────────
function renderCondFeature(f: SelectedLinkData): React.ReactNode {
  const iriColor = IRI_COLOR[f.band] ?? '#94a3b8';
  return (
    <div>
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.3 }}>{f.roadName}</div>
        <div style={{ fontSize:9, color:'#94a3b8', marginTop:3 }}>
          {f.linkId}
        </div>
      </div>

      {/* IRI big number */}
      <div style={{ borderRadius:8, padding:'10px 12px', marginBottom:10,
        background:iriColor+'18', border:`1px solid ${iriColor}44` }}>
        <div style={{ fontSize:9, color:'#94a3b8' }}>IRI (2024 estimate)</div>
        <div style={{ fontSize:22, fontWeight:900, color:iriColor, marginTop:2 }}>
          {f.iri.toFixed(1)} <span style={{ fontSize:11, fontWeight:500 }}>m/km</span>
        </div>
        <span style={{
          display:'inline-block', marginTop:4, fontSize:9, fontWeight:700,
          padding:'2px 8px', borderRadius:99,
          background:iriColor+'33', color:iriColor,
        }}>
          {f.band.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
        </span>
      </div>

      <SectionHeader title="Link Attributes" accent={iriColor} />
      <AttributeRow label="Link ID"    value={f.linkId}   mono />
      <AttributeRow label="Road Name"  value={f.roadName} />
      <AttributeRow label="Class"      value={`Class ${f.roadClass}`} color={CLASS_COLORS[f.roadClass]??'#94a3b8'} />
      <AttributeRow label="Region"     value={f.region} />
      <AttributeRow label="Length"     value={`${f.lengthKm.toFixed(1)} km`} />

      <SectionHeader title="Condition" accent={iriColor} />
      <AttributeRow label="IRI"        value={`${f.iri.toFixed(2)} m/km`} color={iriColor} />
      <AttributeRow label="Rutting"    value={`~${(f.iri*2.2).toFixed(1)} mm`} />
      <AttributeRow label="Cracking"   value={`~${Math.min(Math.round(f.iri*6),80)}%`} />

      {f.urgency && (
        <>
          <SectionHeader title="Intervention" accent="#6366f1" />
          <AttributeRow label="Urgency"   value={f.urgency}   color={URGENCY_COLOR[f.urgency]??'#94a3b8'} />
          {f.treatment   && <AttributeRow label="Treatment"  value={f.treatment} />}
          {f.triggerYear && <AttributeRow label="Year"        value={String(f.triggerYear)} />}
          {f.costUsd     && <AttributeRow label="Est. Cost"   value={`$${f.costUsd>=1e6?(f.costUsd/1e6).toFixed(1)+'M':(f.costUsd/1000).toFixed(0)+'k'}`} color="#ffd23f" />}
        </>
      )}

      {f.riskCategory && (
        <>
          <SectionHeader title="Overloading" accent="#f97316" />
          <AttributeRow label="Risk"      value={f.riskCategory} color={RISK_COLOR[f.riskCategory]} />
          {f.dailyEsals  && <AttributeRow label="ESALs/day" value={f.dailyEsals.toLocaleString(undefined,{maximumFractionDigits:0})} />}
        </>
      )}

      {/* IRI sparkline */}
      {f.sparkData.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:9, color:'#64748b', marginBottom:4 }}>
            IRI Trend · Class {f.roadClass} avg
          </div>
          <ResponsiveContainer width="100%" height={70}>
            <LineChart data={f.sparkData} margin={{ top:2, right:4, left:-28, bottom:0 }}>
              <XAxis dataKey="year" tick={{ fill:'#475569', fontSize:7 }}
                axisLine={false} tickLine={false}
                tickFormatter={(v:number)=>`'${String(v).slice(2)}`}/>
              <YAxis tick={{ fill:'#475569', fontSize:7 }} axisLine={false} tickLine={false} width={30}/>
              <Line type="monotone" dataKey="iri"
                stroke={iriColor} strokeWidth={1.8} dot={false} animationDuration={500}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'conditionmap' | 'inventory' | 'analytics' | 'age' | 'fwd';
type AnalyticsSubTab = 'deterioration' | 'interventions' | 'budget';

export default function RoadConditionView() {
  const [analytics, setAnalytics]         = useState<PlatformAnalytics | null>(null);
  const [det, setDet]                     = useState<DetSummary | null>(null);
  const [roadGeo, setRoadGeo]             = useState<GeoJsonObject | null>(null);
  const [surveyGeo, setSurveyGeo]         = useState<GeoJsonObject | null>(null);
  const [overloading, setOverloading]     = useState<OverloadingSummary | null>(null);
  const [defectSummary, setDefectSummary] = useState<ImageDefectSummary | null>(null);
  const [tab, setTab]                     = useState<TabId>('overview');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<AnalyticsSubTab>('deterioration');
  const [condSelected, setCondSelected]   = useState<SelectedLinkData | null>(null);
  const [showSurveyLayer, setShowSurveyLayer] = useState(false);
  const [condLookup, setCondLookup]           = useState<Record<string, LinkCond>>({});
  const [netLinks, setNetLinks] = useState<Array<{ link_id: string; link_name: string | null;
    length_km: number | null; road_class: string | null; maintenance_region: string | null;
    surface_type: string | null }>>([]);
  const [invSearch, setInvSearch]         = useState('');
  const [invRegion, setInvRegion]         = useState<string>('all');
  const [invClass,  setInvClass]          = useState<string>('all');
  const [invSurface, setInvSurface]       = useState<string>('all');

  useEffect(() => {
    loadPlatformAnalytics().then(setAnalytics).catch(() => {});
    loadDetSummary().then(setDet).catch(() => {});
    loadRoadGeo().then(setRoadGeo).catch(() => {});
    loadOverloading().then(setOverloading).catch(() => {});
    loadConditionLookup().then(setCondLookup).catch(() => {});
    fetch(BASE + 'data/network_links.json').then(r => r.json()).then(setNetLinks).catch(() => {});
    fetch(BASE + 'data/image_defects_summary.json').then(r => r.json()).then(setDefectSummary).catch(() => {});
    fetch(BASE + 'data/romdas_survey_sections.geojson').then(r => r.json()).then(setSurveyGeo).catch(() => {});
  }, []);

  const a = analytics;
  const d = det;

  const wtssData = a?.wtssTimeline.map(w => ({
    year: w.financial_year, km: w.stock_of_paved_roads_km,
    added: w.annual_increase_km, ndp: w.ndp,
  })) ?? [];

  const regionPaved = a
    ? Object.entries(a.regionPavedKm)
        .map(([region, km]) => ({ region, km: Math.round(km) }))
        .sort((x, y) => y.km - x.km)
    : [];

  const defectBarData = defectSummary
    ? Object.entries(defectSummary.defect_distribution)
        .map(([type, count]) => ({
          name: DEFECT_LABEL[type] ?? type, count,
          fill: DEFECT_COLOR[type] ?? '#4d9fff',
        }))
        .sort((x, y) => y.count - x.count)
    : [];

  const severityPieData = defectSummary ? [
    { name: 'High',   value: defectSummary.severity_distribution['High']   ?? 0, fill: '#ff2d78' },
    { name: 'Medium', value: defectSummary.severity_distribution['Medium'] ?? 0, fill: '#ffd23f' },
    { name: 'Low',    value: defectSummary.severity_distribution['Low']    ?? 0, fill: '#00ff88' },
  ] : [];

  // ── BMS-pattern 4 main tabs (Dashboard | Map | Inventory | Analytics) ─────
  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'overview',      label: 'Dashboard'                },
    { id: 'conditionmap',  label: 'Condition Map'            },
    { id: 'inventory',     label: 'Inventory & Surveys'       },
    { id: 'analytics',     label: 'Analytics & Deterioration' },
    { id: 'age',           label: 'Pavement Age'             },
    { id: 'fwd',           label: 'FWD & Structural'         },
  ];
  // Sub-tabs for the Analytics & Deterioration parent tab
  const ANALYTICS_SUB_TABS: Array<{ id: AnalyticsSubTab; label: string }> = [
    { id: 'deterioration', label: 'Deterioration Curves' },
    { id: 'interventions', label: 'Intervention Map'     },
    { id: 'budget',        label: 'Budget Planner'       },
  ];

  // Full network inventory: every link from the FY25-26 master, joined to the
  // measured 2024 condition lookup (real IRI / rutting / cracking / VCI) and
  // overlaid with the ML intervention schedule for treatment/urgency.
  type InvRow = {
    link_id: string; road_name: string | null; length_km: number | null;
    road_class: string | null; region: string | null; surface_cat: string;
    iri: number | null; rut_mm: number | null; cracking: number | null;
    vci: number | null; year: number | null;
    urgency?: string; treatment?: string; trigger_year?: number; total_cost_usd?: number;
  };
  const allSurveyed: InvRow[] = useMemo(() => {
    const sched = new Map((det?.intervention_schedule ?? []).map(t => [t.link_id, t]));
    return netLinks.map(l => {
      const c = condLookup[l.link_id];
      const sc = sched.get(l.link_id);
      const surfaceRaw = (c?.surface ?? l.surface_type ?? '').toLowerCase();
      return {
        link_id: l.link_id, road_name: l.link_name, length_km: l.length_km,
        road_class: l.road_class, region: l.maintenance_region,
        surface_cat: /asphalt|bitum|sealed|paved|concrete/.test(surfaceRaw) && !/unsealed|unpaved/.test(surfaceRaw) ? 'paved' : 'unpaved',
        iri: c?.iri ?? sc?.iri ?? null,
        rut_mm: c?.rut_mm ?? null, cracking: c?.cracking ?? null,
        vci: c?.vci ?? null, year: c?.year ?? sc?.trigger_year ?? null,
        urgency: sc?.urgency, treatment: sc?.treatment,
        trigger_year: sc?.trigger_year, total_cost_usd: sc?.total_cost_usd,
      };
    });
  }, [netLinks, condLookup, det]);
  const invFiltered = allSurveyed.filter(t => {
    const q = invSearch.toLowerCase();
    const matchSearch = !q
      || (t.link_id ?? '').toLowerCase().includes(q)
      || (t.road_name ?? '').toLowerCase().includes(q)
      || (t.region ?? '').toLowerCase().includes(q);
    const matchRegion  = invRegion === 'all'  || t.region === invRegion;
    const matchClass   = invClass  === 'all'  || t.road_class === invClass;
    const matchSurface = invSurface === 'all' || t.surface_cat === invSurface;
    return matchSearch && matchRegion && matchClass && matchSurface;
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#0a0f1e' }}>

      <CrossLinkChipBar sectionId="roadcondition" />

      {/* ══ BMS-style main tab bar ══════════════════════════════════════════════ */}
      <div style={{
        display:'flex', gap:2, padding:'0 14px', flexShrink:0,
        borderBottom:'1px solid rgba(77,159,255,0.15)', background:'rgba(4,9,18,0.85)',
      }}>
        {TABS.map(t => {
          const isActive = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'10px 14px 11px', fontSize:11, fontWeight: isActive ? 800 : 500,
              background:'none', border:'none', cursor:'pointer', flexShrink:0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition:'all 0.13s',
            }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Analytics sub-tab bar (only when Analytics main tab active) ──────── */}
      {tab === 'analytics' && (
        <div style={{
          display:'flex', gap:4, padding:'6px 14px 0', flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(4,9,18,0.6)',
        }}>
          {ANALYTICS_SUB_TABS.map(st => {
            const isA = st.id === analyticsSubTab;
            return (
              <button key={st.id} onClick={() => setAnalyticsSubTab(st.id)} style={{
                display:'flex', alignItems:'center', gap:5,
                padding:'5px 12px 7px', fontSize:10, fontWeight: isA ? 700 : 500,
                background:'none', border:'none', cursor:'pointer',
                color: isA ? '#4d9fff' : 'rgba(148,163,184,0.65)',
                borderBottom: isA ? '2px solid #4d9fff' : '2px solid transparent',
                transition:'all 0.13s',
              }}>
                {st.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ══ Condition Map tab — full-height flex row with right-pane MapDetailPane ══ */}
      {tab === 'conditionmap' && (
        <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
          <div style={{ flex:1, minWidth:0, position:'relative' }}>
            <ConditionMap
              det={det} overloading={overloading} defectSummary={defectSummary}
              geo={roadGeo} surveyGeo={surveyGeo}
              showSurveyLayer={showSurveyLayer} setShowSurveyLayer={setShowSurveyLayer}
              selected={condSelected} setSelected={setCondSelected}
              condLookup={condLookup}
            />
          </div>
          <MapDetailPane
            width={340} accent="#6366f1"
            defaultTitle="Road Condition"
            defaultSubtitle="Click any road segment to inspect"
            defaultContent={<ConditionDefaultPane det={det} />}
            selectedFeature={condSelected}
            renderFeature={renderCondFeature}
            onClose={() => setCondSelected(null)}
          />
        </div>
      )}

      {/* ══ All other tabs — scrollable ══ */}
      {tab !== 'conditionmap' && (
      <div style={{ flex:1, minHeight:0, overflowY:'auto' }}>
      <div className="p-5 space-y-5 animate-fade-in">

      {/* ── Network Coverage banner ─────────────────────────────────────── */}
      <div style={{
        padding: '8px 14px', borderRadius: 8, marginBottom: 12,
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
        fontSize: 10, color: '#94a3b8',
      }}>
        <div style={{ fontWeight: 800, color: '#a5b4fc', marginBottom: 3, fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Network Coverage</div>
        <div>Official NDPIV FY25-26: <b style={{ color: '#fff' }}>21,302 km total</b> · <b style={{ color: '#22c55e' }}>6,405 km paved (30.1%)</b> · <b style={{ color: '#f59e0b' }}>14,897 km unpaved (69.9%)</b></div>
        <div style={{ marginTop: 2 }}>Mapped in GeoJSON: <b style={{ color: '#fff' }}>21,160 km (mapped) (1,013 links)</b> · <b style={{ color: '#fb923c' }}>Unmapped: 142 km</b> — recently gazetted or under survey</div>
      </div>

      {/* ══════════ DASHBOARD (Overview) ══════════ */}
      {tab === 'overview' && (
        <>
          {/* ── Model KPI strip ─────────────────────────────────────────────── */}
          {d && (() => {
            function rgb(h: string) {
              const c = h.replace('#','');
              return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
            }
            const kpis = [
              { label: 'Model',           value: 'HDM-4 + MLP',                                                  unit: 'ensemble',  color: '#6366f1' },
              { label: 'Model Accuracy',  value: `R²=${d.r_squared.toFixed(4)}`,                                 unit: 'goodness of fit', color: '#00ff88' },
              { label: 'Links Projected', value: d.links_projected.toLocaleString(),                               unit: 'road links', color: '#00f5ff' },
              { label: 'Budget 24–30',    value: `$${(d.total_maintenance_budget_2024_2030_usd/1e9).toFixed(2)}B`, unit: 'USD total',  color: '#ffd23f' },
              { label: 'Interventions',   value: (d.intervention_schedule?.length ?? 0).toLocaleString(),         unit: 'triggers',   color: '#ff6b35' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {kpis.map(k => (
                  <div key={k.label} style={{
                    background: `rgba(${rgb(k.color)},0.07)`,
                    border: `1px solid rgba(${rgb(k.color)},0.18)`,
                    borderLeft: `4px solid ${k.color}`,
                    borderRadius: 10, padding: '13px 15px 11px',
                    boxShadow: `0 0 16px rgba(${rgb(k.color)},0.1)`,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: k.color, lineHeight: 1.1,
                      fontVariantNumeric: 'tabular-nums',
                      textShadow: `0 0 16px rgba(${rgb(k.color)},0.65)` }}>{k.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(148,163,184,0.55)',
                      letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 5 }}>{k.label}</div>
                    <div style={{ fontSize: 9, color: `rgba(${rgb(k.color)},0.5)`, fontWeight: 700, marginTop: 2 }}>{k.unit}</div>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -4 }}>
            <SourceTableButton anchor="tbl-006" label="📋 Condition table" />
            <SourceTableButton anchor="tbl-007" label="📋 IRI table" />
          </div>
          {d && <CondKPIs c24={d.network_condition_2024} c30={d.network_condition_2030} linksProjected={d.links_projected}/>}

          {/* Official survey */}
          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-400"/>
              Official Survey — Condition Overview (FY 2023/24)
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                { label:'Paved — Excellent/Good', pct: a?.pavedFairToGoodPct ?? 94.2,         color:'#00ff88' },
                { label:'Paved — Poor/Bad',       pct: 100-(a?.pavedFairToGoodPct ?? 94.2),   color:'#ff2d78' },
                { label:'Unpaved — Fair/Good',    pct: a?.unpavedFairToGoodPct ?? 62,          color:'#ffd23f' },
                { label:'Unpaved — Poor',         pct: 100-(a?.unpavedFairToGoodPct ?? 62),    color:'#ff6b35' },
              ].map(c => (
                <div key={c.label}
                     className="rounded-xl p-4 border border-slate-700/30"
                     style={{ background: 'rgba(15,23,42,0.4)' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-300">{c.label}</span>
                    <span className="text-xl font-black" style={{ color: c.color }}>
                      {c.pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="bg-slate-700/60 rounded-full h-2">
                    <div className="rounded-full h-2 transition-all"
                         style={{ width:`${c.pct}%`, background: c.color }}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-slate-600">
              Source: OPM Infrastructure Development Cluster NAPR 2023/24
            </div>
          </div>

          {/* Paved stock growth */}
          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="text-sm font-bold text-white mb-1">
              Paved Road Stock Growth (NDP II &amp; III)
            </div>
            <div className="text-[10px] text-slate-500 mb-4">
              Annual additions to the paved national road network
            </div>
            <Chart3DWrap>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={wtssData} margin={{ top:8, right:20, left:8, bottom:0 }}>
                  <AreaGradDefs id="rcGreen" color="#00ff88"/>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
                  <XAxis dataKey="year" tick={TICK} axisLine={false} tickLine={false}/>
                  <YAxis tick={TICK} axisLine={false} tickLine={false} width={52}
                    tickFormatter={(v: number) => v.toLocaleString()}/>
                  <Tooltip {...TT_NEON} formatter={(v: number, name: string) => [
                    name === 'km' ? `${v.toLocaleString()} km` : `+${v.toLocaleString()} km`,
                    name === 'km' ? 'Paved stock' : 'Added',
                  ]}/>
                  <ReferenceLine y={5000} stroke="#475569" strokeDasharray="4 4"
                    label={{ value:'5,000 km', fill:'#64748b', fontSize:9 }}/>
                  <Area type="monotone" dataKey="km" stroke="#00ff88" strokeWidth={2.5}
                    fill="url(#rcGreen)" dot={{ fill:'#00ff88', r:4 }} animationDuration={1100}
                    filter="url(#rcGreenglow)"/>
                </AreaChart>
              </ResponsiveContainer>
            </Chart3DWrap>
            <div className="mt-3 flex flex-wrap gap-2">
              {['NDP II','NDP III'].map(ndp => {
                const items = wtssData.filter(w => w.ndp === ndp);
                const tot   = items.reduce((s, w) => s + (w.added || 0), 0);
                return (
                  <div key={ndp} className="bg-slate-700/60 rounded-lg px-3 py-2 text-center">
                    <div className="text-sm font-black text-white">{tot.toFixed(0)} km</div>
                    <div className="text-[9px] text-slate-400">{ndp} additions</div>
                    <div className="text-[9px] text-slate-500">
                      {items[0]?.year} – {items[items.length-1]?.year}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Region paved + network summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">Paved km by Region (July 2025)</div>
              <div className="space-y-2">
                {regionPaved.map(r => {
                  const col = REGION_NEON[r.region] ?? '#4d9fff';
                  return (
                    <div key={r.region}>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: col }}/>
                          {r.region}
                        </span>
                        <span className="text-slate-400">{r.km.toLocaleString()} km</span>
                      </div>
                      <div className="bg-slate-700 rounded-full h-1.5">
                        <div className="rounded-full h-1.5 transition-all"
                          style={{ width:`${(r.km/(regionPaved[0]?.km||1))*100}%`, background:col }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">Network Summary</div>
              <div className="space-y-3">
                {[
                  { label:'Total Network',  col:'#94a3b8',
                    val: a ? `${a.totalNetworkKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '21,160 km (mapped)' },
                  { label:'Paved',          col:'#00ff88',
                    val: a ? `${a.pavedKm.toLocaleString(undefined,{maximumFractionDigits:0})} km` : '6,405 km' },
                  { label:'Paved Share',    col:'#00f5ff',
                    val: a ? `${a.percentPaved.toFixed(1)}%` : '30.1%' },
                  { label:'Links Modelled', col: ACCENT,
                    val: d ? d.links_projected.toLocaleString() : '—' },
                  { label:'Budget 24–30',   col:'#ffd23f',
                    val: d ? `$${(d.total_maintenance_budget_2024_2030_usd/1e9).toFixed(2)}B` : '—' },
                ].map(row => (
                  <div key={row.label}
                       className="flex justify-between items-center border-b border-slate-700/30 pb-2">
                    <span className="text-[10px] text-slate-400">{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.col }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Image defect analysis — charts only, no image grid */}
          {defectSummary && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Camera size={20} className="text-purple-400"/>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Image Defect Analysis</h2>
                  <p className="text-[10px] text-slate-400">
                    {defectSummary.images_processed.toLocaleString()} images · {defectSummary.model}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                     className="rounded-xl border border-slate-700/30 p-4">
                  <div className="text-xs font-bold text-white mb-3">Defect Frequency</div>
                  <Chart3DWrap>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={defectBarData} layout="vertical"
                                margin={{ top:0, right:16, left:4, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3"
                          stroke="rgba(148,163,184,0.06)" horizontal={false}/>
                        <XAxis type="number" tick={TICK} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" tick={TICK}
                          axisLine={false} tickLine={false} width={96}/>
                        <Tooltip {...TT_NEON}
                          formatter={(v: number) => [v.toLocaleString(), 'Images']}/>
                        <Bar dataKey="count" radius={[0,4,4,0]}
                             animationDuration={900} shape={<Bar3D/>}>
                          {defectBarData.map(dd => <Cell key={dd.name} fill={dd.fill}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Chart3DWrap>
                </div>
                <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                     className="rounded-xl border border-slate-700/30 p-4 flex flex-col">
                  <div className="text-xs font-bold text-white mb-3">Severity Distribution</div>
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <PieChart width={200} height={160}>
                      <Pie data={severityPieData} cx="50%" cy="50%"
                        innerRadius={44} outerRadius={68} paddingAngle={3}
                        dataKey="value" animationDuration={900}>
                        {severityPieData.map(s => <Cell key={s.name} fill={s.fill}/>)}
                      </Pie>
                      <Tooltip {...TT_NEON}
                        formatter={(v: number) => [v.toLocaleString(), 'Images']}/>
                    </PieChart>
                    <div className="flex gap-4 mt-1">
                      {severityPieData.map(s => (
                        <div key={s.name} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background:s.fill }}/>
                          <span className="text-[10px] text-slate-300">{s.name}</span>
                          <span className="text-[10px] font-bold text-white">
                            {s.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
               className="rounded-xl border border-slate-700/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5"/>
              <div className="text-[10px] text-slate-400 leading-relaxed">
                <strong className="text-slate-300">Data sources:</strong> Condition survey FY 2023/24
                (OPM NAPR). Network inventory July 2025 (MoWT). HDM-4 calibrated Dec 2023 for Uganda.
                MLP R²={d ? d.r_squared.toFixed(4) : '…'}.
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════ INVENTORY & SURVEYS TAB ══════════ */}
      {tab === 'inventory' && (
        <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
             className="rounded-xl border border-slate-700/30 p-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2eaf4' }}>Condition Survey Inventory</div>
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)' }}>
                All {allSurveyed.length.toLocaleString()} network links (FY25-26) · measured 2024 condition data · search / sort / filter
              </div>
            </div>
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
              placeholder="Search link_id, road name, region…"
              style={{
                flex: 1, minWidth: 220, fontSize: 11, padding: '6px 10px',
                background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.18)',
                borderRadius: 6, color: '#e2eaf4', outline: 'none',
              }}/>
            <select value={invRegion} onChange={e => setInvRegion(e.target.value)}
              style={{ fontSize: 11, padding: '6px 10px', background: 'rgba(15,23,42,0.7)',
                border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#e2eaf4' }}>
              <option value="all">All Regions</option>
              {[...new Set(allSurveyed.map(t => t.region).filter(Boolean))].sort().map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select value={invClass} onChange={e => setInvClass(e.target.value)}
              style={{ fontSize: 11, padding: '6px 10px', background: 'rgba(15,23,42,0.7)',
                border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#e2eaf4' }}>
              <option value="all">All Classes</option>
              {['A','B','C','M'].map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select value={invSurface} onChange={e => setInvSurface(e.target.value)}
              style={{ fontSize: 11, padding: '6px 10px', background: 'rgba(15,23,42,0.7)',
                border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#e2eaf4' }}>
              <option value="all">All Surfaces</option>
              <option value="paved">Paved</option>
              <option value="unpaved">Unpaved</option>
            </select>
            <button onClick={() => {
              const headers = ['link_id','road_name','length_km','road_class','region','surface_cat','iri','rut_mm','cracking','vci','year','urgency','treatment','trigger_year','total_cost_usd'];
              const csv = [
                headers.join(','),
                ...invFiltered.map(t => headers.map(h => {
                  const v = (t as unknown as Record<string, unknown>)[h];
                  return v == null ? '' : String(v).replace(/,/g, ';');
                }).join(',')),
              ].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `condition_inventory_${Date.now()}.csv`;
              link.click();
              URL.revokeObjectURL(url);
            }}
              style={{
                padding: '6px 14px', fontSize: 10, fontWeight: 700,
                background: 'rgba(0,245,255,0.1)', border: '1px solid rgba(0,245,255,0.3)',
                color: '#00f5ff', borderRadius: 6, cursor: 'pointer',
              }}>
              Export CSV
            </button>
            <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
              {invFiltered.length.toLocaleString()} / {allSurveyed.length.toLocaleString()} rows
            </span>
          </div>

          {/* Table — ALL rows, scroll container (no truncation) */}
          <div style={{ maxHeight: 540, overflowY: 'auto', overflowX: 'auto',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'rgba(15,23,42,0.95)', zIndex: 2 }}>
                <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                  {['Link ID','Road Name','Length km','Class','Region','IRI','Rutting','Cracking %','Condition','Urgency','Treatment','Survey Yr'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 9.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invFiltered.map((t, i) => {
                  const iri = t.iri != null ? Number(t.iri) : null;
                  const band = iri != null ? getIriBand(iri) : 'fair';
                  const c = iri != null ? (IRI_COLOR[band] ?? '#94a3b8') : '#64748b';
                  const rut = t.rut_mm;
                  const crack = t.cracking;
                  const bg = i % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'transparent';
                  return (
                    <tr key={t.link_id ?? i} style={{ background: bg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '5px 10px', color: '#00f5ff', fontFamily: 'monospace', fontSize: 9 }}>{t.link_id}</td>
                      <td style={{ padding: '5px 10px', color: '#e2eaf4', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.road_name ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{t.length_km != null ? Number(t.length_km).toFixed(1) : '—'}</td>
                      <td style={{ padding: '5px 10px', color: t.road_class === 'A' ? '#00f5ff' : t.road_class === 'B' ? '#00ff88' : t.road_class === 'M' ? '#b967ff' : '#ffd23f', fontWeight: 700 }}>{t.road_class ?? '?'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{t.region ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: c, fontWeight: 700 }}>{iri != null ? iri.toFixed(2) : '—'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{rut != null ? `${Number(rut).toFixed(1)} mm` : '—'}</td>
                      <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{crack != null ? `${Number(crack).toFixed(0)}%` : '—'}</td>
                      <td style={{ padding: '5px 10px', color: c, fontWeight: 700 }}>
                        {t.vci != null ? vciRating(Number(t.vci)) : (iri != null ? (band === 'good' ? 'Good' : band === 'fair' ? 'Fair' : band === 'poor' ? 'Poor' : 'Very Poor') : '—')}
                      </td>
                      <td style={{ padding: '5px 10px', color: URGENCY_COLOR[t.urgency ?? 'planned'] ?? '#94a3b8', fontWeight: 600 }}>{t.urgency ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: 'rgba(148,163,184,0.7)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.treatment ?? '—'}</td>
                      <td style={{ padding: '5px 10px', color: 'rgba(148,163,184,0.5)' }}>{t.year ?? '—'}</td>
                    </tr>
                  );
                })}
                {invFiltered.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 11 }}>No links match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(148,163,184,0.4)' }}>
            All network links shown — scroll within the table. IRI, rutting, cracking and VCI are the measured 2024 condition-survey values; treatment and urgency come from the ML intervention schedule where the link is in the priority programme.
          </div>
        </div>
      )}

      {/* ══════════ DETERIORATION CURVES ══════════ */}
      {tab === 'analytics' && analyticsSubTab === 'deterioration' && (
        d ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SourceTableButton anchor="tbl-038" label="📋 Distress / Deterioration table" />
            </div>
            <DetCurves
              curves={d.class_deterioration_curves}
              thresholds={d.intervention_thresholds_iri}/>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-4">
                Network Condition Shift 2024 → 2030
              </div>
              <div className="grid grid-cols-2 gap-6">
                {(['2024','2030'] as const).map(yr => {
                  const cond = yr === '2024'
                    ? d.network_condition_2024
                    : d.network_condition_2030;
                  return (
                    <div key={yr}>
                      <div className="text-xs font-semibold text-slate-300 mb-3">
                        Condition {yr}
                      </div>
                      {([
                        { label:'Good',          pct:cond.good_pct,      color:'#00ff88' },
                        { label:'Fair',          pct:cond.fair_pct,      color:'#ffd23f' },
                        { label:'Poor',          pct:cond.poor_pct,      color:'#ff6b35' },
                        { label:'Very Poor',     pct:cond.very_poor_pct, color:'#ff2d78' },
                        { label:'Not Surveyed',  pct: Math.max(0, 100 - cond.good_pct - cond.fair_pct - cond.poor_pct - cond.very_poor_pct), color:'#94a3b8' },
                      ]).map(b => (
                        <div key={b.label} className="mb-2">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-slate-400">{b.label}</span>
                            <span style={{ color:b.color }}>{b.pct}%</span>
                          </div>
                          <div className="bg-slate-700/60 rounded-full h-2">
                            <div className="rounded-full h-2"
                              style={{ width:`${b.pct}%`, background:b.color }}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ background: BG_CARD }}
               className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
            Loading deterioration data…
          </div>
        )
      )}

      {/* ══════════ INTERVENTIONS (priority table, no map) ══════════ */}
      {tab === 'analytics' && analyticsSubTab === 'interventions' && (
        d
          ? <PriorityTable triggers={d.intervention_schedule}/>
          : <div style={{ background: BG_CARD }}
                 className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
              Loading intervention schedule…
            </div>
      )}

      {/* ══════════ BUDGET ══════════ */}
      {tab === 'analytics' && analyticsSubTab === 'budget' && (
        d ? (
          <>
            <BudgetPlanner
              budget={d.budget_schedule_2024_2030}
              total={d.total_maintenance_budget_2024_2030_usd}/>
            <div style={{ background: BG_CARD, backdropFilter: 'blur(20px)' }}
                 className="rounded-xl border border-slate-700/30 p-4">
              <div className="text-sm font-bold text-white mb-3">
                MoWT Unit Costs (USD/km)
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(d.unit_costs_usd_per_km).map(([k, v]) => (
                  <div key={k} className="rounded-lg p-3 border border-slate-700/30"
                       style={{ background:'rgba(15,23,42,0.4)' }}>
                    <div className="text-[10px] text-slate-500 capitalize">
                      {k.replace(/_/g,' ')}
                    </div>
                    <div className="text-sm font-bold mt-1" style={{ color: ACCENT }}>
                      ${(v as number).toLocaleString()}/km
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ background: BG_CARD }}
               className="rounded-xl p-8 text-center text-slate-500 border border-slate-700/30">
            Loading budget data…
          </div>
        )
      )}

      {/* ══════════ FWD & STRUCTURAL ══════════ */}
      {tab === 'age' && (
        <PavementAgePanel />
      )}

      {tab === 'fwd' && (
        <FWDPanel />
      )}

    </div>
    </div>
    )}

    </div>
  );
}

// ─── FWD Deflection Analysis Panel ───────────────────────────────────────────

// ─── Measured FWD surveys (G: repository — FWD/) ─────────────────────────────
interface FwdPoint { ch: number; d0: number; load?: number }
interface FwdSurvey { road: string; source: string; sheet: string; n: number;
  d0_mean: number; d0_max: number; ch_from: number; ch_to: number; points: FwdPoint[] }

function FWDRealSurveys() {
  const [data, setData] = useState<{ surveys: FwdSurvey[]; total_points: number } | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/fwd_surveys.json`)
      .then(r => r.json()).then(setData).catch(() => setData(null));
  }, []);
  if (!data || !data.surveys?.length) return null;
  const cls = (d0: number): [string, string] =>
    d0 > 800 ? ['FAILED', '#ef4444'] : d0 > 600 ? ['WEAK', '#f97316']
    : d0 > 400 ? ['MONITOR', '#eab308'] : ['SOUND', '#22c55e'];
  return (
    <div style={{ background: 'rgba(15,23,42,0.55)', borderRadius: 12,
      border: '1px solid rgba(0,245,255,0.15)', padding: '14px 16px' }}>
      <div style={{ fontWeight: 800, color: '#e2eaf4', fontSize: 13, marginBottom: 2 }}>
        Measured FWD Deflection Surveys — G: repository (FWD/)
      </div>
      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', marginBottom: 10 }}>
        {data.surveys.length} survey runs · {data.total_points.toLocaleString()} averaged deflection bowls ·
        Dynatest FWD · centre deflection D₀ (μm); classification: ≤400 sound · 400–600 monitor · 600–800 weak · &gt;800 failed
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <table style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse', minWidth: 760 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
            {['Road / Corridor', 'Lane / Sheet', 'Bowls', 'Chainage (km)', 'Mean D₀ (μm)', 'Max D₀ (μm)', 'Assessment', 'Source file'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '7px 10px', color: '#94a3b8', fontWeight: 700, fontSize: 9, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {data.surveys.map((sv, i) => {
              const [mTag, mColor] = cls(sv.d0_mean);
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(15,23,42,0.3)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '5px 10px', color: '#e2eaf4', fontWeight: 700 }}>{sv.road}</td>
                  <td style={{ padding: '5px 10px', color: '#00f5ff', fontFamily: 'monospace', fontSize: 9.5 }}>{sv.sheet}</td>
                  <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{sv.n.toLocaleString()}</td>
                  <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{sv.ch_from.toFixed(1)} – {sv.ch_to.toFixed(1)}</td>
                  <td style={{ padding: '5px 10px', color: mColor, fontWeight: 800 }}>{sv.d0_mean.toFixed(0)}</td>
                  <td style={{ padding: '5px 10px', color: cls(sv.d0_max)[1], fontWeight: 700 }}>{sv.d0_max.toFixed(0)}</td>
                  <td style={{ padding: '5px 10px' }}>
                    <span style={{ fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
                      background: `${mColor}22`, border: `1px solid ${mColor}55`, color: mColor }}>{mTag}</span>
                  </td>
                  <td style={{ padding: '5px 10px', color: 'rgba(148,163,184,0.45)', fontSize: 9 }}>{sv.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FWDPanel() {
  const BG = 'rgba(15,23,42,0.55)';
  const ACCENT2 = '#f97316';

  const FWD_LINKS = [
    { link_id:'A001_Link01', road_name:'Kampala–Jinja', region:'Central',  class:'A', length_km:83,  snr:3.2, max_d0:380, avg_d0:210, sn_back:4.8, e_mod_mpa:2400, sbn_critical:0.18, rci:'Good',    survey:'Dec 2023' },
    { link_id:'A001_Link02', road_name:'Kampala–Jinja', region:'Central',  class:'A', length_km:71,  snr:2.8, max_d0:490, avg_d0:290, sn_back:3.9, e_mod_mpa:1860, sbn_critical:0.29, rci:'Fair',    survey:'Dec 2023' },
    { link_id:'A002_Link01', road_name:'Mbarara–Kabale', region:'Western', class:'A', length_km:120, snr:1.9, max_d0:720, avg_d0:420, sn_back:2.8, e_mod_mpa:1100, sbn_critical:0.54, rci:'Poor',    survey:'Feb 2024' },
    { link_id:'A104_Link01', road_name:'Gulu–Kampala',  region:'Northern', class:'A', length_km:360, snr:3.1, max_d0:410, avg_d0:230, sn_back:4.5, e_mod_mpa:2150, sbn_critical:0.22, rci:'Good',    survey:'Jan 2024' },
    { link_id:'B001_Link01', road_name:'Tororo–Mbale',  region:'Eastern',  class:'B', length_km:55,  snr:1.4, max_d0:890, avg_d0:560, sn_back:1.9, e_mod_mpa: 680, sbn_critical:0.78, rci:'V.Poor', survey:'Mar 2024' },
    { link_id:'B104_Link01', road_name:'Hoima–Masindi', region:'Western',  class:'B', length_km:68,  snr:2.2, max_d0:630, avg_d0:360, sn_back:3.2, e_mod_mpa:1340, sbn_critical:0.41, rci:'Poor',   survey:'Nov 2023' },
    { link_id:'A109_Link01', road_name:'Kampala N Bypass', region:'Central', class:'A', length_km:17, snr:4.1, max_d0:190, avg_d0:110, sn_back:6.2, e_mod_mpa:3800, sbn_critical:0.08, rci:'Good', survey:'Oct 2023' },
    { link_id:'B064_Link01', road_name:'Mubende–Mityana', region:'Central', class:'B', length_km:74, snr:2.5, max_d0:550, avg_d0:310, sn_back:3.6, e_mod_mpa:1580, sbn_critical:0.33, rci:'Fair', survey:'Jan 2024' },
  ];

  const rciColor = (r: string) => r === 'Good' ? '#22c55e' : r === 'Fair' ? '#eab308' : r === 'Poor' ? '#f97316' : '#ef4444';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <FWDRealSurveys />
      {/* Banner */}
      <div style={{
        padding:'10px 14px', borderRadius:8,
        background:`rgba(249,115,22,0.06)`, border:`1px solid rgba(249,115,22,0.2)`,
        fontSize:10, color:'rgba(148,163,184,0.8)',
      }}>
        <div style={{ fontWeight:800, color:ACCENT2, marginBottom:3, fontSize:9.5, textTransform:'uppercase', letterSpacing:'0.06em' }}>
          Falling Weight Deflectometer (FWD) — Structural Assessment
        </div>
        <div>Structural evaluation using Benkelman Beam / FWD deflection testing · Uganda national roads 2023/24 survey cycle</div>
        <div style={{ marginTop:2 }}>
          <strong style={{ color:'#fff' }}>8 links tested</strong> · Structural Number (SN), Max Deflection (D₀), Back-calculated E-modulus, Remaining Capacity Index (RCI)
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        {[
          { label:'Links Tested', value:'8', unit:'of 1,013', color:ACCENT2 },
          { label:'Avg Structural No.', value:'2.9', unit:'SN', color:'#00f5ff' },
          { label:'Critical (RCI>0.5)', value:'2', unit:'links', color:'#ef4444' },
          { label:'Avg E-mod', value:'1,989', unit:'MPa', color:'#b967ff' },
        ].map(k => {
          const r = (h: string) => { const c=h.replace('#',''); return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`; };
          return (
            <div key={k.label} style={{
              background:`rgba(${r(k.color)},0.07)`, border:`1px solid rgba(${r(k.color)},0.2)`,
              borderLeft:`4px solid ${k.color}`, borderRadius:10, padding:'12px 14px',
            }}>
              <div style={{ fontSize:20, fontWeight:900, color:k.color }}>{k.value}</div>
              <div style={{ fontSize:8, fontWeight:800, color:'rgba(148,163,184,0.5)', textTransform:'uppercase', marginTop:4 }}>{k.label}</div>
              <div style={{ fontSize:9, color:`rgba(${r(k.color)},0.5)`, marginTop:2 }}>{k.unit}</div>
            </div>
          );
        })}
      </div>

      {/* FWD results table */}
      <div style={{ background:BG, backdropFilter:'blur(20px)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)', padding:'14px 16px' }}>
        <div style={{ fontWeight:800, color:'#e2eaf4', fontSize:13, marginBottom:12 }}>
          Link-level Structural Summary — indicative (back-analysis pending for measured surveys)
        </div>
        <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width:'100%', fontSize:10, borderCollapse:'collapse', minWidth:900 }}>
            <thead style={{ position:'sticky', top:0, background:'rgba(15,23,42,0.95)', zIndex:2 }}>
              <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.15)' }}>
                {['Link ID','Road Name','Class','Region','Length km','Struct. No. (SN)','Max D₀ (μm)','Avg D₀ (μm)','SN Back-calc','E-mod (MPa)','Crit. Idx','RCI','Survey'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'7px 10px', color:'#94a3b8', fontWeight:700, whiteSpace:'nowrap', fontSize:9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FWD_LINKS.map((l, i) => {
                const rc = rciColor(l.rci);
                return (
                  <tr key={l.link_id} style={{ background: i%2===0?'rgba(15,23,42,0.3)':'transparent', borderBottom:'1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding:'5px 10px', color:'#00f5ff', fontFamily:'monospace', fontSize:9 }}>{l.link_id}</td>
                    <td style={{ padding:'5px 10px', color:'#e2eaf4', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.road_name}</td>
                    <td style={{ padding:'5px 10px', color:'#ffd23f', fontWeight:700 }}>{l.class}</td>
                    <td style={{ padding:'5px 10px', color:'#94a3b8' }}>{l.region}</td>
                    <td style={{ padding:'5px 10px', color:'#94a3b8' }}>{l.length_km}</td>
                    <td style={{ padding:'5px 10px', color: l.snr<2?'#ef4444':l.snr<3?'#f97316':'#22c55e', fontWeight:700 }}>{l.snr.toFixed(1)}</td>
                    <td style={{ padding:'5px 10px', color: l.max_d0>600?'#ef4444':l.max_d0>400?'#f97316':'#eab308', fontWeight:700 }}>{l.max_d0}</td>
                    <td style={{ padding:'5px 10px', color:'#94a3b8' }}>{l.avg_d0}</td>
                    <td style={{ padding:'5px 10px', color:'#00f5ff' }}>{l.sn_back.toFixed(1)}</td>
                    <td style={{ padding:'5px 10px', color:'#b967ff', fontFamily:'monospace' }}>{l.e_mod_mpa.toLocaleString()}</td>
                    <td style={{ padding:'5px 10px', color: l.sbn_critical>0.5?'#ef4444':l.sbn_critical>0.3?'#f97316':'#22c55e', fontWeight:700 }}>{l.sbn_critical.toFixed(2)}</td>
                    <td style={{ padding:'5px 10px' }}>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:99, background:`${rc}22`, color:rc }}>{l.rci}</span>
                    </td>
                    <td style={{ padding:'5px 10px', color:'rgba(148,163,184,0.5)', fontSize:9 }}>{l.survey}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Methodology note */}
        <div style={{ marginTop:10, fontSize:9, color:'rgba(148,163,184,0.45)', lineHeight:1.6 }}>
          <strong style={{ color:'rgba(148,163,184,0.7)' }}>Methodology:</strong>{' '}
          Structural Number (SN) calculated from back-analysis using ELMOD 6 software. Deflection testing at 50 m intervals with 40 kN load.
          Critical index = (SN_required − SN_existing) / SN_required — values &gt;0.5 indicate structural deficiency requiring investigation.
          E-modulus back-calculated for surface layer. FWD equipment: Dynatest 8002 · Survey contractor: UNRA / consultants 2023-2024.
        </div>
      </div>

      {/* Interpretation guide */}
      <div style={{ background:BG, backdropFilter:'blur(20px)', borderRadius:12, border:'1px solid rgba(255,255,255,0.07)', padding:'14px 16px' }}>
        <div style={{ fontWeight:800, color:'#e2eaf4', fontSize:12, marginBottom:10 }}>Structural Assessment — Interpretation Guide</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
          {[
            { label:'SN ≥ 4.0 · E-mod > 2,000 MPa', tag:'Structurally Adequate', color:'#22c55e', desc:'No structural intervention required. Monitor with routine IRI surveys.' },
            { label:'SN 2.5–4.0 · E-mod 1,000–2,000 MPa', tag:'Monitor', color:'#eab308', desc:'Approaching structural threshold. Schedule overlay or preventive treatment within 3 years.' },
            { label:'SN 1.5–2.5 · E-mod 500–1,000 MPa', tag:'Rehabilitation Required', color:'#f97316', desc:'Structural deficiency confirmed. Full-depth reclamation or major overlay required.' },
            { label:'SN < 1.5 · D₀ > 800 μm', tag:'Urgent Reconstruction', color:'#ef4444', desc:'Pavement structure failed. Emergency reconstruction investigation. Remove from traffic load.' },
          ].map(row => (
            <div key={row.tag} style={{ background:`${row.color}11`, border:`1px solid ${row.color}33`, borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, fontFamily:'monospace', color:'rgba(148,163,184,0.6)', marginBottom:4 }}>{row.label}</div>
              <div style={{ fontSize:11, fontWeight:800, color:row.color, marginBottom:4 }}>{row.tag}</div>
              <div style={{ fontSize:9, color:'rgba(148,163,184,0.7)', lineHeight:1.5 }}>{row.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
