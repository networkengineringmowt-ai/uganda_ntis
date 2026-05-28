import { useState, useMemo, useEffect, useCallback, type CSSProperties } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, ZoomControl, useMap } from 'react-leaflet';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import 'leaflet/dist/leaflet.css';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';
import { Clock, Search } from 'lucide-react';

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
  roadClass: RoadClass;
  lengthKm: number;
  surface: string;
  builtYear: number;
  contractor: string;
  designStandard: string;
  aadt2026: number;
  interventions: Intervention[];
  currentIRI: number;
  dominantDefect: string;
  assetValueBn: number;
  coords: [number, number][];
}

function classifyInt(type: string): IntType {
  const t = type.toLowerCase();
  if (t.includes('reconstruct') || t.includes('resheet')) return 'Reconstruction';
  if (t.includes('rehabilitation') || t.includes('rehab') || t.includes('full')) return 'Rehabilitation';
  if (t.includes('overlay')) return 'Overlay';
  if (t.includes('reseal') || t.includes('seal') || t.includes('preventive')) return 'Reseal';
  return 'Routine';
}

// ── Road Link Data ─────────────────────────────────────────────────────────────
const LINKS: LinkDef[] = [
  {
    id: 'A1_K_J', name: 'Kampala–Jinja', road: 'A109',
    region: 'Central', roadClass: 'A', lengthKm: 82, surface: 'Bituminous',
    builtYear: 1958, contractor: 'Public Works (GoU)', designStandard: 'Class A dual carriageway',
    aadt2026: 30909, dominantDefect: 'Cracking & Rutting',
    interventions: [
      { year: 1996, type: 'Full Rehabilitation', costMUgx: 4200, iriBefore: 8.2, iriAfter: 2.1 },
      { year: 2005, type: 'Structural Overlay',  costMUgx: 2800, iriBefore: 6.8, iriAfter: 2.8 },
      { year: 2014, type: 'Reseal + Overlay',    costMUgx: 3500, iriBefore: 5.9, iriAfter: 2.4 },
      { year: 2021, type: 'Routine Maintenance', costMUgx:  580, iriBefore: 4.8, iriAfter: 4.2 },
      { year: 2023, type: 'Thin Overlay',        costMUgx: 1800, iriBefore: 5.1, iriAfter: 2.9 },
    ],
    currentIRI: 3.8, assetValueBn: 42.6,
    coords: [[0.3476, 32.5825], [0.3529, 32.7561], [0.3743, 32.9108], [0.4244, 33.2041]],
  },
  {
    id: 'A1_K_MP', name: 'Kampala–Masaka–Mbarara', road: 'A109/A109',
    region: 'Western', roadClass: 'A', lengthKm: 266, surface: 'Bituminous',
    builtYear: 1965, contractor: 'Public Works (GoU)', designStandard: 'Class A single carriageway',
    aadt2026: 14200, dominantDefect: 'Fatigue cracking',
    interventions: [
      { year: 1993, type: 'Full Rehabilitation', costMUgx: 12400, iriBefore: 9.5, iriAfter: 2.0 },
      { year: 2004, type: 'Structural Overlay',  costMUgx:  8200, iriBefore: 7.2, iriAfter: 2.5 },
      { year: 2012, type: 'Routine Maintenance', costMUgx:  1200, iriBefore: 5.8, iriAfter: 5.0 },
      { year: 2015, type: 'Rehabilitation',      costMUgx: 14500, iriBefore: 8.8, iriAfter: 1.9 },
    ],
    currentIRI: 4.6, assetValueBn: 138.3,
    coords: [[0.3476, 32.5825], [-0.1333, 31.9333], [-0.3335, 31.7371], [-0.6143, 30.6574]],
  },
  {
    id: 'B1_G_K', name: 'Gulu–Kampala (Karuma)', road: 'A1',
    region: 'Northern', roadClass: 'A', lengthKm: 345, surface: 'Bituminous',
    builtYear: 2018, contractor: 'CHICO (China)', designStandard: 'Class A dual carriageway',
    aadt2026: 3800, dominantDefect: 'Edge cracking',
    interventions: [
      { year: 2020, type: 'Routine Maintenance', costMUgx:  580, iriBefore: 2.2, iriAfter: 2.0 },
      { year: 2023, type: 'Preventive Seal',     costMUgx: 1200, iriBefore: 3.4, iriAfter: 2.3 },
    ],
    currentIRI: 2.8, assetValueBn: 245.0,
    coords: [[2.7788, 32.2994], [2.2449, 32.2404], [1.2050, 32.2955], [0.3476, 32.5825]],
  },
  {
    id: 'B5_M_T', name: 'Mbale–Tororo', road: 'A109',
    region: 'Eastern', roadClass: 'B', lengthKm: 58, surface: 'Bituminous',
    builtYear: 1972, contractor: 'Public Works (GoU)', designStandard: 'Class B single carriageway',
    aadt2026: 6200, dominantDefect: 'Potholes & Rutting',
    interventions: [
      { year: 1998, type: 'Full Rehabilitation', costMUgx: 2800, iriBefore: 9.8, iriAfter: 2.2 },
      { year: 2009, type: 'Structural Overlay',  costMUgx: 1900, iriBefore: 6.4, iriAfter: 2.8 },
      { year: 2017, type: 'Routine Maintenance', costMUgx:  480, iriBefore: 4.6, iriAfter: 4.0 },
      { year: 2019, type: 'Reseal',              costMUgx:  780, iriBefore: 5.2, iriAfter: 2.6 },
    ],
    currentIRI: 5.4, assetValueBn: 30.2,
    coords: [[1.0637, 34.1754], [0.8800, 34.1800], [0.6928, 34.1828]],
  },
  {
    id: 'C6_KAS_BUN', name: 'Kasese–Bundibugyo', road: 'C4',
    region: 'Western', roadClass: 'C', lengthKm: 69, surface: 'Unsealed',
    builtYear: 1980, contractor: 'District Works', designStandard: 'Class C gravel road',
    aadt2026: 850, dominantDefect: 'Gravel loss & Erosion',
    interventions: [
      { year: 2001, type: 'Gravel Resheet', costMUgx: 620, iriBefore: 14.2, iriAfter: 7.5 },
      { year: 2011, type: 'Gravel Resheet', costMUgx: 840, iriBefore: 16.0, iriAfter: 6.8 },
      { year: 2020, type: 'Gravel Resheet', costMUgx: 960, iriBefore: 15.5, iriAfter: 7.2 },
    ],
    currentIRI: 9.8, assetValueBn: 8.1,
    coords: [[0.1833, 30.0833], [0.4500, 30.0750], [0.7167, 30.0667]],
  },
];

const ALL_REGIONS = [...new Set(LINKS.map(l => l.region))].sort();
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
  const [selectedId,   setSelectedId]   = useState<string>(LINKS[0].id);
  const [search,       setSearch]       = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [classFilter,  setClassFilter]  = useState<RoadClass | 'All'>('All');

  const link = LINKS.find(l => l.id === selectedId) ?? LINKS[0];

  // ── Derived values ──────────────────────────────────────────────────────────
  const iriSeries  = useMemo(() => buildIriSeries(link),  [link]);
  const iriColor   = useMemo(() => conditionColor(link.currentIRI), [link]);
  const ageYears   = 2026 - link.builtYear;
  const remainLife = Math.max(0, Math.round((8.0 - link.currentIRI) / 0.32 + 2));
  const nextRehabYr = Math.round(2026 + Math.max(1, (8.0 - link.currentIRI) / 0.38));
  const nextRehabCostBn = +(link.lengthKm * 2200 / 1_000_000).toFixed(1);

  // ── Summary stats ───────────────────────────────────────────────────────────
  const statsAll = useMemo(() => ({
    totalKm:    LINKS.reduce((s, l) => s + l.lengthKm, 0),
    totalInts:  LINKS.reduce((s, l) => s + l.interventions.length, 0),
    avgIri:     +(LINKS.reduce((s, l) => s + l.currentIRI, 0) / LINKS.length).toFixed(1),
    projCost2035: +(LINKS.reduce((s, l) => s + l.lengthKm * 2200 / 1_000_000, 0)).toFixed(1),
  }), []);

  // ── Filtered link list ──────────────────────────────────────────────────────
  const filteredLinks = useMemo(() => LINKS.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase())
      || l.road.toLowerCase().includes(search.toLowerCase());
    const matchRegion = regionFilter === 'All' || l.region === regionFilter;
    const matchClass  = classFilter === 'All'  || l.roadClass === classFilter;
    return matchSearch && matchRegion && matchClass;
  }), [search, regionFilter, classFilter]);

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
    <div style={{ padding: '16px 18px 24px', minHeight: '100%', fontFamily: "'Inter','Segoe UI',sans-serif" }}>

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
      <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 260px)', minHeight: 600 }}>

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

        {/* ── Right: Intervention Map + Sparkline ── */}
        <div style={{ ...glass(C.orange), width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
              <ZoomControl position="bottomright"/>
              <MapFlyTo center={center} zoom={mapZoom}/>

              {/* Road link — colored by condition */}
              <Polyline
                positions={link.coords}
                pathOptions={{ color: iriColor, weight: 5, opacity: 0.9 }}
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
            <div style={{ fontSize: 8, fontWeight: 700, color: C.teal, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 4 }}>
              IRI Trajectory {link.builtYear}–2035
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
        </div>

      </div>{/* end 3-panel */}
    </div>
  );
}
