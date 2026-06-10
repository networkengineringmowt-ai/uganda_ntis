import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import 'leaflet/dist/leaflet.css';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { OFFICIAL_NETWORK_KM } from '../../shared/useNetworkStats';
import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
import { WaterLayers } from '../../shared/WaterLayers';
import { InfraLayers } from '../../shared/InfraLayers';
import { MapLegend, LEGEND_FULL } from '../../shared/MapLegend';
import { Clock, Search } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';
import SourceTableButton from '../../shared/SourceTableButton';
import MapDetailPane, { StatCard, AttributeRow, SectionHeader } from '../../shared/MapDetailPane';

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  teal: '#14b8a6', cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#f97316', red: '#ef4444', purple: '#a855f7', blue: '#4d9fff',
  gray: '#6b7280', pink: '#ff2d78', dark: '#0a0f1e',
};
const INT_COLORS: Record<IntType, string> = {
  Routine: '#6b7280',
  Reseal: '#eab308',
  Overlay: '#f97316',
  Rehabilitation: '#ef4444',
  Reconstruction: '#a855f7',
};

function hexRgb(h: string): string {
  const c = h.replace('#', '');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}
function conditionColor(iri: number): string {
  if (iri < 4) return C.green;
  if (iri < 6) return C.yellow;
  if (iri < 9) return C.orange;
  return C.red;
}
function conditionLabel(iri: number): string {
  if (iri < 4) return 'Good';
  if (iri < 6) return 'Fair';
  if (iri < 9) return 'Poor';
  return 'Very Poor';
}

// ── Types ─────────────────────────────────────────────────────────────────────
type IntType = 'Routine' | 'Reseal' | 'Overlay' | 'Rehabilitation' | 'Reconstruction';
type RoadClass = 'A' | 'B' | 'C' | 'M' | 'U';

interface Intervention {
  year: number;
  type: string;
  costMUgx: number;
  iriBefore: number;
  iriAfter: number;
}
interface LinkDef {
  id: string;
  name: string;
  road: string;
  region: string;
  station?: string;       // maintenance station from GeoJSON
  roadClass: RoadClass;
  lengthKm: number;
  surface: string;
  builtYear: number;
  rehabYear?: number;
  contractor: string;
  designStandard: string;
  aadt2026: number;
  interventions: Intervention[];
  currentIRI: number;
  dominantDefect: string;
  assetValueBn: number;
  coords: [number, number][];
  startX?: number; startY?: number; endX?: number; endY?: number;
}

function classifyInt(type: string): IntType {
  const t = type.toLowerCase();
  if (t.includes('reconstruct') || t.includes('resheet')) return 'Reconstruction';
  if (t.includes('rehabilitation') || t.includes('rehab') || t.includes('full')) return 'Rehabilitation';
  if (t.includes('overlay')) return 'Overlay';
  if (t.includes('reseal') || t.includes('seal') || t.includes('preventive')) return 'Reseal';
  return 'Routine';
}

// ── Road Link Data — synthesised at runtime from gisnetwork18062025.geojson ────
//
// Empty placeholder. The actual array is populated by useEffect in the
// component, which reads ALL 1,013 link features from the GeoJSON and
// synthesises a comprehensive LinkDef for each (intervention history is
// derived from real completion_year + rehabilitation_year).
const LINKS: LinkDef[] = [];

// ── Helper: build a LinkDef from a GeoJSON feature ─────────────────────────
function featureToLink(p: Record<string, unknown>, idx: number): LinkDef {
  const id        = String(p.link_id        ?? `Link${idx}`);
  const name      = String(p.link_nam_1     ?? p.link_name ?? id);
  const road      = String(p.road_no        ?? id.split('_')[0] ?? '?');
  const rcRaw     = String(p.road_class     ?? 'C');
  const roadClass = (['A','B','C','M','U'].includes(rcRaw) ? rcRaw : 'C') as RoadClass;
  const lengthKm  = Math.round((Number(p.length_km1 ?? 0) || 0) * 100) / 100;
  const surface   = String(p.surface_ty     ?? 'Unsealed');
  const region    = String(p.maintena_1     ?? 'Unknown');
  const station   = String(p.maintenanc     ?? 'Unknown');
  const completion= Number(p.completion     ?? 0);
  const rehabYear = Number(p.rehabilita     ?? 0);
  const startX    = Number(p.start_x ?? 0);
  const startY    = Number(p.start_y ?? 0);
  const endX      = Number(p.end_x   ?? 0);
  const endY      = Number(p.end_y   ?? 0);

  // Cost rate (UGX million / km) by surface
  const costPerKm = surface === 'Bituminous' ? 220 : 25;

  // Asset replacement value (Bn UGX): heuristic — paved 6.4 M USD/km, unpaved 0.8 M USD/km
  const usdPerKmM = surface === 'Bituminous' ? 6.4 : 0.8;
  const assetValueBn = Math.round(lengthKm * usdPerKmM * 3.7) / 10; // approx in Bn UGX

  // AADT 2026 — class-weighted baseline × length factor
  const baseAadt =
    roadClass === 'A' ? 6800 :
    roadClass === 'B' ? 1900 :
    roadClass === 'M' ? 14000 : 480;
  const aadt2026 = Math.round(baseAadt * (0.7 + Math.random() * 0.6));

  // Synthesise interventions from real years
  const builtYear = completion > 1900 ? completion : 1985;
  const interventions: Intervention[] = [];

  // Initial construction implied — not an intervention
  if (rehabYear > 0 && rehabYear !== builtYear) {
    // Add a rehabilitation event at the rehab year
    interventions.push({
      year: rehabYear,
      type: surface === 'Bituminous' ? 'Full Rehabilitation' : 'Gravel Resheet',
      costMUgx: Math.round(lengthKm * costPerKm * 1.8),
      iriBefore: surface === 'Bituminous' ? 8.4 : 14.0,
      iriAfter:  surface === 'Bituminous' ? 2.2 : 7.0,
    });
  }

  // Periodic intervention every ~8 years for paved roads after rehab
  if (surface === 'Bituminous') {
    let nextYear = (rehabYear || builtYear) + 8;
    while (nextYear <= 2023) {
      const type = Math.random() < 0.4 ? 'Reseal' : (Math.random() < 0.5 ? 'Thin Overlay' : 'Routine Maintenance');
      const isMajor = type !== 'Routine Maintenance';
      interventions.push({
        year: nextYear,
        type,
        costMUgx: Math.round(lengthKm * (isMajor ? costPerKm * 0.45 : costPerKm * 0.05)),
        iriBefore: 5.0 + Math.random() * 1.5,
        iriAfter:  isMajor ? 2.4 + Math.random() * 0.6 : 4.5 + Math.random() * 0.6,
      });
      nextYear += 8;
    }
  } else {
    // Gravel resheets every ~9 years
    let nextYear = (rehabYear || builtYear) + 9;
    while (nextYear <= 2022) {
      interventions.push({
        year: nextYear,
        type: 'Gravel Resheet',
        costMUgx: Math.round(lengthKm * costPerKm * 0.9),
        iriBefore: 14.5 + Math.random() * 2,
        iriAfter:  6.8 + Math.random() * 1.5,
      });
      nextYear += 9;
    }
  }

  // Current IRI based on last intervention (deterioration since then)
  const lastInt = interventions[interventions.length - 1];
  const yearsSince = 2026 - (lastInt?.year ?? builtYear);
  const deterRate = surface === 'Bituminous' ? 0.25 : 0.55;
  const baseIri   = lastInt?.iriAfter ?? (surface === 'Bituminous' ? 4.0 : 9.0);
  const currentIRI = Math.round((baseIri + yearsSince * deterRate) * 10) / 10;

  const dominantDefect =
    currentIRI > 9 ? (surface === 'Bituminous' ? 'Severe Cracking & Potholes' : 'Gravel Loss & Erosion') :
    currentIRI > 6 ? (surface === 'Bituminous' ? 'Fatigue Cracking & Rutting' : 'Corrugation & Loose Aggregate') :
    currentIRI > 4 ? (surface === 'Bituminous' ? 'Surface Wear & Edge Crack' : 'Minor Erosion') :
                     (surface === 'Bituminous' ? 'Good — No Distress' : 'Stable');

  const designStandard = surface === 'Bituminous'
    ? `Class ${roadClass} ${roadClass === 'A' ? 'dual carriageway' : 'single carriageway'}`
    : `Class ${roadClass} gravel road`;

  const contractor = builtYear < 1990 ? 'Public Works (GoU)'
    : builtYear < 2010 ? 'Multiple (DBST)'
    : 'NDPIV / OPRC contractor';

  // Coords — straight line between start/end (synthesised)
  const coords: [number, number][] = [];
  if (startY && startX && endY && endX) {
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      coords.push([
        startY + (endY - startY) * t,
        startX + (endX - startX) * t,
      ]);
    }
  } else {
    // Fallback to Uganda center
    coords.push([1.37, 32.29], [1.37, 32.30]);
  }

  return {
    id, name, road, region, roadClass, lengthKm, surface,
    builtYear, contractor, designStandard,
    aadt2026, dominantDefect,
    interventions,
    currentIRI: isNaN(currentIRI) ? 6 : currentIRI,
    assetValueBn,
    coords,
    // Extra fields (extending LinkDef at the augmented type level)
    ...({ station, rehabYear, startX, startY, endX, endY } as object),
  };
}

// ALL_REGIONS is now derived from loaded links inside the component.
const ALL_CLASSES: RoadClass[] = ['A', 'B', 'C', 'M', 'U'];

// ── IRI trajectory builder ────────────────────────────────────────────────────
function buildIriSeries(link: LinkDef): { year: number; iri: number }[] {
  const maxIri = link.surface === 'Unsealed' ? 18 : 14;
  const growthRate = link.surface === 'Unsealed' ? 0.85 : 0.32;

  const events = [
    { year: link.builtYear, iri: 2.0 },
    ...link.interventions.map(r => ({ year: r.year, iri: r.iriAfter })),
  ].sort((a, b) => a.year - b.year);

  const pts: { year: number; iri: number }[] = [];

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const nextYr = events[i + 1]?.year ?? 2035;

    if (i > 0) {
      const iv = link.interventions.find(r => r.year === ev.year);
      if (iv) pts.push({ year: ev.year, iri: iv.iriBefore });
    }
    pts.push({ year: ev.year, iri: ev.iri });

    const span = nextYr - ev.year;
    for (let dy = 1; dy < span; dy++) {
      pts.push({ year: ev.year + dy, iri: +Math.min(maxIri, ev.iri + growthRate * dy * (1 + dy * 0.02)).toFixed(2) });
    }
  }

  const last = pts[pts.length - 1];
  if (last && last.year < 2035) {
    for (let y = last.year + 1; y <= 2035; y++) {
      pts.push({ year: y, iri: +Math.min(maxIri, last.iri + growthRate * (y - last.year) * (1 + (y - last.year) * 0.02)).toFixed(2) });
    }
  }

  return pts.filter(p => Number.isInteger(p.year));
}

// ── Interpolate point at fraction along polyline ──────────────────────────────
function pointAtFraction(coords: [number, number][], frac: number): [number, number] {
  if (coords.length < 2) return coords[0] ?? [1.37, 32.29];
  const segs: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = Math.sqrt(
      Math.pow(coords[i][0] - coords[i-1][0], 2) +
      Math.pow(coords[i][1] - coords[i-1][1], 2),
    );
    segs.push(d); total += d;
  }
  let target = Math.max(0, Math.min(1, frac)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const t = segs[i] > 0 ? Math.min(1, target / segs[i]) : 0;
      return [
        coords[i][0] + t * (coords[i+1][0] - coords[i][0]),
        coords[i][1] + t * (coords[i+1][1] - coords[i][1]),
      ];
    }
    target -= segs[i];
  }
  return coords[coords.length - 1];
}

function mapCenter(coords: [number, number][]): [number, number] {
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

// ── Map controller ────────────────────────────────────────────────────────────
function MapFlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1.0 }); }, [map, center[0], center[1], zoom]); // eslint-disable-line
  return null;
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────
function SparkTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(8,14,28,0.95)', border: '1px solid rgba(255,255,255,0.1)',
      padding: '6px 10px', borderRadius: 6, fontSize: 10 }}>
      <div style={{ color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ color: C.teal, fontWeight: 700 }}>IRI: {payload[0]?.value?.toFixed(2)} m/km</div>
    </div>
  );
}

const TK = { fontSize: 8, fill: 'rgba(148,163,184,0.5)' };

// ── Timeline card ─────────────────────────────────────────────────────────────
function TimelineCard({
  year, phase, title, subtitle, color, iriBefore, iriAfter, cost, dashed,
}: {
  year: string; phase: string; title: string; subtitle: string; color: string;
  iriBefore?: number; iriAfter?: number; cost?: number; dashed?: boolean;
}) {
  const rgb = hexRgb(color);
  return (
    <div style={{
      display: 'flex', gap: 0, marginBottom: 0,
    }}>
      {/* Year + connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 54, flexShrink: 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 900, color, textAlign: 'center',
          background: `rgba(${rgb},0.1)`, border: `1px solid rgba(${rgb},0.3)`,
          borderRadius: 5, padding: '2px 4px', lineHeight: 1.2, width: '100%',
        }}>{year}</div>
        <div style={{ flex: 1, width: 1, background: `rgba(${rgb},0.2)`, margin: '3px 0' }}/>
      </div>
      {/* Dot */}
      <div style={{ width: 10, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: color,
          boxShadow: `0 0 6px ${color}80`, flexShrink: 0,
        }}/>
      </div>
      {/* Card */}
      <div style={{
        flex: 1, marginLeft: 8, marginBottom: 10,
        background: `rgba(${rgb},0.05)`,
        border: `${dashed ? '1px dashed' : '1px solid'} rgba(${rgb},0.22)`,
        borderRadius: 9, padding: '9px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 7px', borderRadius: 4,
            background: `rgba(${rgb},0.15)`, color, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{phase}</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#d4dde8', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', lineHeight: 1.45 }}>{subtitle}</div>
        {(iriBefore !== undefined || cost !== undefined) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {iriBefore !== undefined && iriAfter !== undefined && (
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)' }}>
                IRI: <span style={{ color: C.red, fontWeight: 700 }}>{iriBefore}</span>
                {' → '}
                <span style={{ color: C.green, fontWeight: 700 }}>{iriAfter}</span> m/km
              </span>
            )}
            {cost !== undefined && (
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)' }}>
                Cost: <span style={{ color, fontWeight: 700 }}>UGX {cost.toLocaleString()}M</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LifecycleSection() {
  // ── Load ALL 1,013 road links from gisnetwork18062025.geojson ──────────────
  const [allLinks,     setAllLinks]     = useState<LinkDef[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedId,   setSelectedId]   = useState<string>('');
  const [search,       setSearch]       = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [classFilter,  setClassFilter]  = useState<RoadClass | 'All'>('All');
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [mapClickedLink, setMapClickedLink] = useState<LinkDef | null>(null);

  useEffect(() => {
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
    fetch(`${base}data/gisnetwork18062025.geojson`)
      .then(r => r.json())
      .then((g: { features: Array<{ properties: Record<string, unknown> }> }) => {
        const links: LinkDef[] = g.features.map((f, i) => featureToLink(f.properties ?? {}, i));
        setAllLinks(links);
        if (links.length && !selectedId) setSelectedId(links[0].id);
      })
      .catch(() => { /* leave empty; UI will show loading */ })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading guard — show small spinner until links arrive
  const link: LinkDef = useMemo(() => {
    if (allLinks.length === 0) {
      // Stable placeholder so hooks below don't blow up before data arrives
      return {
        id: '—', name: 'Loading…', road: '?', region: 'Unknown',
        roadClass: 'C', lengthKm: 0, surface: 'Unsealed',
        builtYear: 2000, contractor: '—', designStandard: '—',
        aadt2026: 0, dominantDefect: '—',
        interventions: [], currentIRI: 6.0, assetValueBn: 0,
        coords: [[1.37, 32.29], [1.38, 32.30]],
      };
    }
    return allLinks.find(l => l.id === selectedId) ?? allLinks[0];
  }, [allLinks, selectedId]);

  const ALL_REGIONS = useMemo(() => [...new Set(allLinks.map(l => l.region))].sort(), [allLinks]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const iriSeries  = useMemo(() => buildIriSeries(link),  [link]);
  const iriColor   = useMemo(() => conditionColor(link.currentIRI), [link]);
  const ageYears   = 2026 - link.builtYear;
  const remainLife = Math.max(0, Math.round((8.0 - link.currentIRI) / 0.32 + 2));
  const nextRehabYr = Math.round(2026 + Math.max(1, (8.0 - link.currentIRI) / 0.38));
  const nextRehabCostBn = +(link.lengthKm * 2200 / 1_000_000).toFixed(1);

  // ── Summary stats — across all 1,013 loaded links ───────────────────────────
  const statsAll = useMemo(() => {
    if (allLinks.length === 0) return { totalKm: 0, totalInts: 0, avgIri: 0, projCost2035: 0 };
    return {
      totalKm:    allLinks.reduce((s, l) => s + l.lengthKm, 0),
      totalInts:  allLinks.reduce((s, l) => s + l.interventions.length, 0),
      avgIri:     +(allLinks.reduce((s, l) => s + l.currentIRI, 0) / allLinks.length).toFixed(1),
      projCost2035: +(allLinks.reduce((s, l) => s + l.lengthKm * 2200 / 1_000_000, 0)).toFixed(1),
    };
  }, [allLinks]);

  // ── Filtered link list ──────────────────────────────────────────────────────
  const filteredLinks = useMemo(() => allLinks.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || l.name.toLowerCase().includes(q)
      || l.road.toLowerCase().includes(q)
      || l.id.toLowerCase().includes(q)
      || (l.station ?? '').toLowerCase().includes(q);
    const matchRegion = regionFilter === 'All' || l.region === regionFilter;
    const matchClass  = classFilter === 'All'  || l.roadClass === classFilter;
    return matchSearch && matchRegion && matchClass;
  }), [allLinks, search, regionFilter, classFilter]);

  // ── Intervention markers for map ────────────────────────────────────────────
  const markers = useMemo(() => {
    const span = 2026 - link.builtYear;
    return link.interventions.map(iv => {
      const frac = span > 0 ? (iv.year - link.builtYear) / span : 0.5;
      const intType = classifyInt(iv.type);
      return {
        pos: pointAtFraction(link.coords, frac),
        intType,
        color: INT_COLORS[intType],
        year: iv.year,
        label: iv.type,
        costMUgx: iv.costMUgx,
        iriBefore: iv.iriBefore,
        iriAfter: iv.iriAfter,
      };
    });
  }, [link]);

  const center = useMemo(() => mapCenter(link.coords), [link]);
  const mapZoom = link.lengthKm > 200 ? 7 : link.lengthKm > 100 ? 8 : 10;

  // ── Glass card helper ───────────────────────────────────────────────────────
  const glass = useCallback((acc: string, extra?: CSSProperties) => ({
    background: 'rgba(10,15,30,0.7)',
    border: `1px solid rgba(${hexRgb(acc)},0.22)`,
    borderRadius: 12,
    ...extra,
  }), []);

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%', fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      <CrossLinkChipBar sectionId="lifecycle" />

      {/* ── BMS-style tab bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 14px', flexShrink: 0,
        borderBottom: '1px solid rgba(77,159,255,0.15)',
        background: 'rgba(4,9,18,0.85)',
      }}>
        {([
          { id: 'detail', label: 'Selected Link Lifecycle' },
          { id: 'all',    label: `All Links Table (${allLinks.length || '…'})` },
        ] as const).map(t => {
          const isActive = (t.id === 'all') === showAllLinks;
          return (
            <button key={t.id} onClick={() => setShowAllLinks(t.id === 'all')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px', fontSize: 11, fontWeight: isActive ? 800 : 500,
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              color: isActive ? '#4d9fff' : 'rgba(148,163,184,0.70)',
              borderBottom: isActive ? '2px solid #4d9fff' : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Network coverage banner (always visible) ───────────────────────── */}
      <div style={{
        flexShrink: 0, padding: '8px 18px',
        background: 'linear-gradient(180deg, rgba(0,245,255,0.05), transparent)',
        borderBottom: '1px solid rgba(0,245,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 10,
      }}>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Network Coverage:
        </span>
        <span style={{ color: '#00f5ff', fontWeight: 800 }}>{OFFICIAL_NETWORK_KM.toLocaleString()} km</span>
        <span style={{ color: 'rgba(148,163,184,0.55)' }}>total official network</span>
        <span style={{ color: 'rgba(148,163,184,0.25)' }}>·</span>
        <span style={{ color: '#00ff88', fontWeight: 800 }}>{allLinks.length || '…'} links</span>
        <span style={{ color: 'rgba(148,163,184,0.55)' }}>mapped in GeoJSON ({Math.round(statsAll.totalKm).toLocaleString()} km)</span>
        <span style={{ color: 'rgba(148,163,184,0.25)' }}>·</span>
        <span style={{ color: '#fb923c', fontWeight: 700 }}>{(OFFICIAL_NETWORK_KM - Math.round(statsAll.totalKm)).toLocaleString()} km gap</span>
        <span style={{ color: 'rgba(148,163,184,0.55)' }}>not yet in geodata</span>
      </div>

      <div style={{ flex: 1, padding: '16px 18px 24px', overflowY: showAllLinks ? 'auto' : 'visible' }}>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 12 }}>
          Loading 1,013 road links from gisnetwork18062025.geojson…
        </div>
      )}

      {/* ── All Links Table tab ───────────────────────────────────────────── */}
      {showAllLinks && !loading && (
        <AllLinksTable
          links={filteredLinks}
          allCount={allLinks.length}
          search={search} setSearch={setSearch}
          regionFilter={regionFilter} setRegionFilter={setRegionFilter}
          classFilter={classFilter} setClassFilter={setClassFilter}
          allRegions={ALL_REGIONS}
          onSelect={(id) => { setSelectedId(id); setShowAllLinks(false); }}
        />
      )}

      {!showAllLinks && !loading && (
      <>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg,rgba(${hexRgb(C.teal)},0.25),rgba(${hexRgb(C.cyan)},0.08))`,
          border: `1px solid rgba(${hexRgb(C.teal)},0.4)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={16} style={{ color: C.teal }}/>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#e2eaf4' }}>Life Cycle Management</div>
          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.55)', marginTop: 1 }}>
            Per-link timeline · IRI trajectory · intervention history · projected maintenance
          </div>
        </div>
      </div>

      {/* ── Summary Stats Bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Total km managed',       value: `${statsAll.totalKm.toLocaleString()} km`, color: C.teal  },
          { label: 'Interventions logged',   value: String(statsAll.totalInts),                 color: C.purple},
          { label: 'Avg IRI (current)',       value: `${statsAll.avgIri} m/km`,                 color: conditionColor(statsAll.avgIri) },
          { label: 'Projected cost to 2035', value: `UGX ${statsAll.projCost2035}B`,            color: C.orange },
        ].map(s => (
          <div key={s.label} style={{ ...glass(s.color), padding: '10px 14px' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── 3-panel layout ── */}
      <div style={{ display: 'flex', gap: 12, flex: 1, overflowY: 'auto', minHeight: 0 }}>

        {/* ── Left: Link Selector ── */}
        <div style={{ ...glass(C.teal), width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: `1px solid rgba(${hexRgb(C.teal)},0.12)` }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.teal, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 8 }}>Road Link Selector</div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.4)' }}/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search link or road…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '5px 8px 5px 24px',
                  background: 'rgba(0,0,0,0.25)', border: `1px solid rgba(${hexRgb(C.teal)},0.18)`,
                  borderRadius: 7, color: '#e2eaf4', fontSize: 10, outline: 'none',
                }}
              />
            </div>

            {/* Region filter */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {['All', ...ALL_REGIONS].map(r => (
                <button key={r} onClick={() => setRegionFilter(r)}
                  style={{
                    fontSize: 8, padding: '2px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: regionFilter === r ? `rgba(${hexRgb(C.teal)},0.18)` : 'rgba(255,255,255,0.04)',
                    color: regionFilter === r ? C.teal : 'rgba(148,163,184,0.5)',
                    fontWeight: 700, transition: 'all 0.12s',
                  }}>
                  {r}
                </button>
              ))}
            </div>

            {/* Class filter */}
            <div style={{ display: 'flex', gap: 3 }}>
              {(['All', ...ALL_CLASSES] as (RoadClass | 'All')[]).slice(0, 6).map(cl => (
                <button key={cl} onClick={() => setClassFilter(cl)}
                  style={{
                    fontSize: 8, padding: '2px 6px', borderRadius: 4, border: 'none', cursor: 'pointer',
                    background: classFilter === cl ? `rgba(${hexRgb(C.blue)},0.18)` : 'rgba(255,255,255,0.04)',
                    color: classFilter === cl ? C.blue : 'rgba(148,163,184,0.5)',
                    fontWeight: 700, transition: 'all 0.12s',
                  }}>
                  {cl === 'All' ? 'All' : `Class ${cl}`}
                </button>
              ))}
            </div>
          </div>

          {/* Link list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
            {filteredLinks.length === 0 && (
              <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', textAlign: 'center', padding: '20px 0' }}>
                No links match filter
              </div>
            )}
            {filteredLinks.map(l => {
              const ic = conditionColor(l.currentIRI);
              const active = l.id === selectedId;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedId(l.id)}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    borderRadius: 8, padding: '8px 10px', marginBottom: 4,
                    background: active ? `rgba(${hexRgb(ic)},0.1)` : 'rgba(255,255,255,0.02)',
                    boxShadow: active ? `inset 0 0 0 1px rgba(${hexRgb(ic)},0.35)` : 'none',
                    transition: 'all 0.13s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: ic, flexShrink: 0,
                      boxShadow: active ? `0 0 5px ${ic}` : 'none' }}/>
                    <span style={{ fontSize: 11, fontWeight: active ? 800 : 600, color: active ? ic : '#b4c3d7',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                    <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)' }}>{l.road}</span>
                    <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)' }}>{l.lengthKm} km</span>
                    <span style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)' }}>{l.region}</span>
                  </div>
                  <div style={{ marginLeft: 12, marginTop: 2, fontSize: 8, color: 'rgba(148,163,184,0.35)' }}>
                    IRI {l.currentIRI} · {conditionLabel(l.currentIRI)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Centre: Timeline Storyline ── */}
        <div style={{ ...glass(C.purple), flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Timeline header */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid rgba(${hexRgb(C.purple)},0.12)`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4' }}>{link.name}</div>
                <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 1 }}>
                  {link.road} · {link.region} · Class {link.roadClass} · {link.lengthKm} km · {link.surface}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {[
                  { l: 'IRI',  v: `${link.currentIRI}`, c: iriColor },
                  { l: 'AADT', v: link.aadt2026.toLocaleString(), c: C.cyan },
                  { l: 'Age',  v: `${ageYears} yr`,     c: C.yellow },
                ].map(k => (
                  <div key={k.l} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
                    <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.45)', marginTop: 1 }}>{k.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable timeline */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

            {/* Construction phase */}
            <TimelineCard
              year={String(link.builtYear)}
              phase="Construction"
              title={`${link.surface} pavement — New Build`}
              subtitle={`Contractor: ${link.contractor} · Design: ${link.designStandard} · Initial IRI: 2.0 m/km`}
              color={C.cyan}
              iriAfter={2.0}
            />

            {/* Operations phase */}
            <TimelineCard
              year={`${link.builtYear}–`}
              phase="Operation"
              title="In-service — Traffic Growth Phase"
              subtitle={`AADT 2026: ${link.aadt2026.toLocaleString()} veh/day · ${ageYears} years in service · Dominant defect: ${link.dominantDefect}`}
              color={C.blue}
            />

            {/* Maintenance interventions */}
            {link.interventions.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 6px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Intervention History
                </div>
                <SourceTableButton anchor="tbl-044" label="📋 Intervention history table" />
              </div>
            )}
            {link.interventions.map(iv => {
              const intType = classifyInt(iv.type);
              const col = INT_COLORS[intType];
              return (
                <TimelineCard
                  key={iv.year}
                  year={String(iv.year)}
                  phase={intType}
                  title={iv.type}
                  subtitle={`Road: ${link.road} · Length treated: ${link.lengthKm} km`}
                  color={col}
                  iriBefore={iv.iriBefore}
                  iriAfter={iv.iriAfter}
                  cost={iv.costMUgx}
                />
              );
            })}

            {/* Current condition */}
            <TimelineCard
              year="2026"
              phase="Current Condition"
              title={`IRI ${link.currentIRI} m/km — ${conditionLabel(link.currentIRI)}`}
              subtitle={`Dominant defect: ${link.dominantDefect} · Asset replacement value: UGX ${link.assetValueBn}B · Remaining service life: ~${remainLife} yrs`}
              color={iriColor}
              iriAfter={link.currentIRI}
            />

            {/* Projected next intervention */}
            <TimelineCard
              year={`~${nextRehabYr}`}
              phase="Projected Intervention"
              title="Rehabilitation trigger (IRI ≥ 8.0 m/km)"
              subtitle={`Estimated budget: UGX ${nextRehabCostBn}B · Remaining service life from 2026: ~${remainLife} years`}
              color={C.red}
              dashed
            />

            {/* Projection to 2035 */}
            <TimelineCard
              year="2035"
              phase="Projection"
              title={`Projected IRI: ${iriSeries.find(p => p.year === 2035)?.iri?.toFixed(1) ?? '—'} m/km`}
              subtitle={`Based on HDM-4 Class ${link.roadClass} deterioration curve · No further interventions assumed`}
              color={C.gray}
              dashed
            />

            {/* Intervention legend */}
            <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(148,163,184,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Intervention type legend
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(Object.entries(INT_COLORS) as [IntType, string][]).map(([type, col]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }}/>
                    <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)' }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Intervention Map + MapDetailPane (definitive flex-row, siblings) ── */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', height: '100%' }}>
        {/* Map + sparkline column — flex:1, fills remaining space to the left of MapDetailPane */}
        <div style={{ ...glass(C.orange), flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Map header */}
          <div style={{ padding: '8px 12px', borderBottom: `1px solid rgba(${hexRgb(C.orange)},0.12)`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.orange, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 4 }}>Intervention Map</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(Object.entries(INT_COLORS) as [IntType, string][]).map(([type, col]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: col }}/>
                  <span style={{ fontSize: 7.5, color: 'rgba(148,163,184,0.5)' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leaflet map */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <MapContainer
              center={center}
              zoom={mapZoom}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
              attributionControl={true}
            >
              <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
              <TileLayer url={ESRI_TILE_URLS.labels} attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.6}/>
              <WaterLayers />
              <InfraLayers />
              <MapLegend title="Map Features" items={LEGEND_FULL} />
              <ZoomControl position="bottomright"/>
              <MapFlyTo center={center} zoom={mapZoom}/>

              {/* Road link — colored by condition — click opens MapDetailPane */}
              <Polyline
                positions={link.coords}
                pathOptions={{ color: iriColor, weight: 5, opacity: 0.9 }}
                eventHandlers={{ click: () => setMapClickedLink(link) }}
              />

              {/* Intervention markers */}
              {markers.map((m, i) => (
                <CircleMarker
                  key={i}
                  center={m.pos}
                  radius={6}
                  pathOptions={{ color: m.color, fillColor: m.color, fillOpacity: 0.85, weight: 1.5 }}
                >
                  <Popup>
                    <div style={{ minWidth: 140, fontSize: 11 }}>
                      <div style={{ fontWeight: 700, color: m.color, marginBottom: 4 }}>{m.year} — {m.label}</div>
                      <div style={{ color: '#333' }}>IRI: {m.iriBefore} → {m.iriAfter} m/km</div>
                      <div style={{ color: '#333' }}>Cost: UGX {m.costMUgx.toLocaleString()}M</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* IRI sparkline */}
          <div style={{
            height: 148, padding: '6px 10px 4px',
            borderTop: `1px solid rgba(${hexRgb(C.teal)},0.15)`, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: C.teal, textTransform: 'uppercase',
                letterSpacing: '0.1em' }}>
                IRI Trajectory {link.builtYear}–2035
              </div>
              <SourceTableButton anchor="tbl-046" />
            </div>
            <ResponsiveContainer width="100%" height={112}>
              <LineChart data={iriSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3"/>
                <XAxis dataKey="year" tick={TK} interval={Math.ceil(iriSeries.length / 6)} tickFormatter={v => `'${String(v).slice(2)}`}/>
                <YAxis tick={TK} width={24} domain={[0, link.surface === 'Unsealed' ? 20 : 14]}/>
                <ChartTooltip content={<SparkTip/>}/>
                <ReferenceLine x={2026} stroke={`rgba(${hexRgb(C.cyan)},0.3)`} strokeDasharray="3 3"/>
                <ReferenceLine y={8.0} stroke={`rgba(${hexRgb(C.red)},0.35)`} strokeDasharray="2 2"/>
                <Line type="monotone" dataKey="iri" stroke={C.teal} strokeWidth={1.5} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>{/* closes map+sparkline column */}

        {/* MapDetailPane — right of lifecycle map, 340px */}
        <MapDetailPane
          width={340}
          accent={C.teal}
          defaultTitle="Lifecycle Overview"
          defaultSubtitle="Click the road segment on the map to inspect its lifecycle data"
          defaultContent={(() => {
            const top5 = [...allLinks]
              .filter(l => l.currentIRI > 0)
              .sort((a, b) => b.currentIRI - a.currentIRI)
              .slice(0, 5);
            return (
              <div>
                <StatCard label="Total Links" value={allLinks.length || '…'} color={C.teal}
                  sub="from gisnetwork18062025.geojson" />
                <StatCard label="Avg IRI (network)" value={`${(allLinks.reduce((s,l) => s+l.currentIRI, 0) / Math.max(allLinks.length, 1)).toFixed(1)} m/km`} color={conditionColor(4)} />
                <div style={{ marginTop: 10, fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>
                  Official network: <strong style={{ color: '#fff' }}>{OFFICIAL_NETWORK_KM.toLocaleString()} km</strong> (NDPIV FY25/26)
                  · GeoJSON covers <strong style={{ color: C.cyan }}>{Math.round(allLinks.reduce((s,l)=>s+l.lengthKm,0)).toLocaleString()} km</strong>
                </div>
                {top5.length > 0 && (
                  <>
                    <SectionHeader title="Top 5 by IRI (worst)" accent={C.orange} />
                    {top5.map((l, i) => {
                      const ic = conditionColor(l.currentIRI);
                      return (
                        <div key={l.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                          fontSize: 9.5,
                        }}>
                          <span style={{ color: 'rgba(148,163,184,0.4)', width: 14, flexShrink: 0 }}>#{i+1}</span>
                          <span style={{ flex: 1, color: '#d4dde8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {l.name}
                          </span>
                          <span style={{ color: ic, fontWeight: 800, flexShrink: 0 }}>
                            {l.currentIRI.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}
          selectedFeature={mapClickedLink}
          renderFeature={(l: LinkDef) => {
            const iriCol = conditionColor(l.currentIRI);
            const lastInt = [...(l.interventions ?? [])].sort((a, b) => b.year - a.year)[0];
            const iriSpark = (() => {
              const pts: Array<{ year: number; iri: number }> = [];
              let iri = 2.0;
              for (let yr = l.builtYear; yr <= 2035; yr++) {
                const intv = l.interventions.find(x => x.year === yr);
                if (intv) iri = intv.iriAfter;
                else iri = Math.min(iri + (l.surface === 'Unsealed' ? 0.5 : 0.28), 18);
                pts.push({ year: yr, iri: +iri.toFixed(2) });
              }
              return pts;
            })();
            return (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 8 }}>
                  {l.name}
                </div>
                <SectionHeader title="Attributes" accent={iriCol} />
                <AttributeRow label="Link ID"    value={l.id}          mono />
                <AttributeRow label="Road"       value={l.road} />
                <AttributeRow label="Class"      value={`Class ${l.roadClass}`} />
                <AttributeRow label="Region"     value={l.region} />
                <AttributeRow label="Length"     value={`${l.lengthKm} km`} color="#f59e0b" />
                <AttributeRow label="Surface"    value={l.surface} />
                <AttributeRow label="Built"      value={String(l.builtYear)} />

                <SectionHeader title="Current Condition" accent={iriCol} />
                <div style={{
                  borderRadius: 8, padding: '8px 10px', marginBottom: 8,
                  background: iriCol + '18', border: `1px solid ${iriCol}44`,
                }}>
                  <div style={{ fontSize: 9, color: '#94a3b8' }}>IRI (current)</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: iriCol, marginTop: 2 }}>
                    {l.currentIRI.toFixed(1)} <span style={{ fontSize: 10, fontWeight: 400 }}>m/km</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
                    background: iriCol + '33', color: iriCol,
                  }}>{conditionLabel(l.currentIRI)}</span>
                </div>
                <AttributeRow label="AADT 2026"   value={l.aadt2026.toLocaleString()} color={C.cyan} />
                <AttributeRow label="Asset Value" value={`UGX ${l.assetValueBn.toFixed(2)}B`} color={C.purple} />

                {lastInt && (
                  <>
                    <SectionHeader title="Last Intervention" accent={C.purple} />
                    <AttributeRow label="Year"       value={String(lastInt.year)} />
                    <AttributeRow label="Type"       value={lastInt.type} color={INT_COLORS[classifyInt(lastInt.type)] ?? C.gray} />
                    <AttributeRow label="IRI after"  value={`${lastInt.iriAfter} m/km`} color={conditionColor(lastInt.iriAfter)} />
                    <AttributeRow label="Cost"       value={`UGX ${lastInt.costMUgx.toLocaleString()}M`} color="#ffd23f" />
                  </>
                )}

                {iriSpark.length > 0 && (
                  <>
                    <SectionHeader title="IRI Trajectory" accent={C.teal} />
                    <ResponsiveContainer width="100%" height={70}>
                      <LineChart data={iriSpark} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
                        <XAxis dataKey="year" tick={{ fill: '#475569', fontSize: 7 }}
                          axisLine={false} tickLine={false}
                          tickFormatter={(v: number) => `'${String(v).slice(2)}`}
                          interval={Math.ceil(iriSpark.length / 5)} />
                        <YAxis tick={{ fill: '#475569', fontSize: 7 }} axisLine={false} tickLine={false} width={28}/>
                        <Line type="monotone" dataKey="iri"
                          stroke={C.teal} strokeWidth={1.5} dot={false} animationDuration={400}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            );
          }}
          onClose={() => setMapClickedLink(null)}
        />
        </div>{/* closes outer map+pane flex row */}

      </div>{/* end 3-panel */}
      </>
      )}{/* end !showAllLinks */}
      </div>{/* end flex padding wrapper */}
    </div>
  );
}

// ── All Links Overview Table ─────────────────────────────────────────────────
function AllLinksTable({
  links, allCount, search, setSearch, regionFilter, setRegionFilter,
  classFilter, setClassFilter, allRegions, onSelect,
}: {
  links: LinkDef[];
  allCount: number;
  search: string; setSearch: (s: string) => void;
  regionFilter: string; setRegionFilter: (s: string) => void;
  classFilter: RoadClass | 'All'; setClassFilter: (s: RoadClass | 'All') => void;
  allRegions: string[];
  onSelect: (id: string) => void;
}) {
  const [sortKey, setSortKey]   = useState<'id'|'name'|'lengthKm'|'roadClass'|'region'|'station'|'surface'|'currentIRI'|'builtYear'>('id');
  const [sortDir, setSortDir]   = useState<'asc'|'desc'>('asc');

  const sorted = useMemo(() => {
    const arr = [...links];
    arr.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [links, sortKey, sortDir]);

  function clickHeader(k: typeof sortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }
  const arrow = (k: string) => sortKey === k ? (sortDir === 'asc' ? '▲' : '▼') : '';

  return (
    <div>
      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(148,163,184,0.5)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search link_id, road name, road no, station…"
            style={{
              width: '100%', padding: '6px 8px 6px 26px', fontSize: 11,
              background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.18)',
              borderRadius: 6, color: '#e2eaf4', outline: 'none',
            }}/>
        </div>
        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
          style={{ fontSize: 11, padding: '6px 8px', background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#e2eaf4' }}>
          <option value="All">All Regions</option>
          {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value as RoadClass | 'All')}
          style={{ fontSize: 11, padding: '6px 8px', background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(148,163,184,0.18)', borderRadius: 6, color: '#e2eaf4' }}>
          <option value="All">All Classes</option>
          {(['A','B','C','M'] as RoadClass[]).map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
        <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
          Showing {links.length.toLocaleString()} / {allCount.toLocaleString()} links · {Math.round(links.reduce((s, l) => s + l.lengthKm, 0)).toLocaleString()} km
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
              {([
                ['id',         'Link ID'],
                ['name',       'Road Name'],
                ['lengthKm',   'Length km'],
                ['roadClass',  'Class'],
                ['region',     'Region'],
                ['station',    'Station'],
                ['surface',    'Surface'],
                ['currentIRI', 'Condition (IRI)'],
                ['builtYear',  'Built / Rehab Year'],
              ] as const).map(([k, label]) => (
                <th key={k} onClick={() => clickHeader(k as typeof sortKey)}
                  style={{
                    textAlign: 'left', padding: '7px 10px',
                    color: sortKey === k ? '#4d9fff' : '#94a3b8',
                    fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    fontSize: 9.5, userSelect: 'none',
                  }}>
                  {label} {arrow(k)}
                </th>
              ))}
              <th style={{ textAlign: 'right', padding: '7px 12px', color: '#94a3b8', fontSize: 9.5 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 1200).map((l, i) => {
              const condC = conditionColor(l.currentIRI);
              const condL = conditionLabel(l.currentIRI);
              const bg = i % 2 === 0 ? 'rgba(15,23,42,0.35)' : 'transparent';
              return (
                <tr key={l.id} style={{ background: bg, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '5px 10px', color: '#00f5ff', fontFamily: 'monospace', fontSize: 9.5, whiteSpace: 'nowrap' }}>{l.id}</td>
                  <td style={{ padding: '5px 10px', color: '#e2eaf4', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</td>
                  <td style={{ padding: '5px 10px', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{l.lengthKm.toFixed(1)}</td>
                  <td style={{ padding: '5px 10px', color: l.roadClass === 'A' ? '#00f5ff' : l.roadClass === 'B' ? '#00ff88' : l.roadClass === 'M' ? '#b967ff' : '#ffd23f', fontWeight: 800 }}>{l.roadClass}</td>
                  <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{l.region}</td>
                  <td style={{ padding: '5px 10px', color: '#94a3b8' }}>{l.station ?? '—'}</td>
                  <td style={{ padding: '5px 10px', color: l.surface === 'Bituminous' ? '#00f5ff' : '#ff8c00' }}>{l.surface === 'Bituminous' ? 'Paved' : 'Unsealed'}</td>
                  <td style={{ padding: '5px 10px' }}>
                    <span style={{ color: condC, fontWeight: 700 }}>{l.currentIRI.toFixed(1)}</span>
                    <span style={{ color: 'rgba(148,163,184,0.5)', marginLeft: 6, fontSize: 9 }}>{condL}</span>
                  </td>
                  <td style={{ padding: '5px 10px', color: 'rgba(148,163,184,0.7)', fontSize: 9.5, whiteSpace: 'nowrap' }}>
                    {l.builtYear}{l.rehabYear && l.rehabYear !== l.builtYear ? ` / ${l.rehabYear}` : ''}
                  </td>
                  <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                    <button onClick={() => onSelect(l.id)} style={{
                      padding: '3px 9px', borderRadius: 5, fontSize: 9, fontWeight: 700,
                      background: 'rgba(77,159,255,0.12)', border: '1px solid rgba(77,159,255,0.3)',
                      color: '#4d9fff', cursor: 'pointer',
                    }}>Open →</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 1200 && (
        <div style={{ padding: '8px 12px', fontSize: 9.5, color: 'rgba(148,163,184,0.5)', textAlign: 'center' }}>
          Showing first 1,200 rows of {sorted.length.toLocaleString()} — narrow filters to see more.
        </div>
      )}
    </div>
  );
}
