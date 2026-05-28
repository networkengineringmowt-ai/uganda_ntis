import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, GeoJSON as GeoJSONLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS, ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip as ReTooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import {
  Construction, AlertTriangle, Clock,
  Search, X, ChevronLeft, ChevronRight, Camera,
} from 'lucide-react';
import { loadEnhancedProjects, type Project } from '../../data/appStore';

// ── Under-construction corridor definitions ───────────────────────────────────
interface UCorridor {
  id: string; name: string; km: number;
  funder: string; contractor: string; lot: string;
  completion: string; status: string;
  positions: [number, number][];  // [lat, lng] pairs for Leaflet Polyline
}

const UNDER_CONSTRUCTION: UCorridor[] = [
  {
    id: 'neramp-lot1',
    name: 'Kamdini – Lira – Soroti – Koloin',
    km: 216,
    funder: 'World Bank (NERAMP)',
    contractor: 'Mota-Engil Consortium',
    lot: 'OPRC Lot 1',
    completion: 'June 2027',
    status: 'Under Construction',
    positions: [[2.22, 32.27], [2.25, 32.90], [1.95, 33.25], [1.72, 33.61], [1.42, 33.82]],
  },
  {
    id: 'hoima-wanseko',
    name: 'Hoima – Butiaba – Wanseko (Oil Road)',
    km: 111,
    funder: 'GoU / TotalEnergies',
    contractor: 'China Harbour Engineering',
    lot: 'Albertine Oil Road',
    completion: 'December 2026',
    status: 'Under Construction',
    positions: [[1.43, 31.35], [1.62, 31.38], [1.83, 31.40], [2.05, 31.42], [2.19, 31.39]],
  },
  {
    id: 'northern-bypass',
    name: 'Kampala Northern Bypass (Phase 2)',
    km: 17,
    funder: 'African Development Bank',
    contractor: 'China Harbour Engineering',
    lot: 'Urban Bypass',
    completion: 'March 2027',
    status: 'Under Construction',
    positions: [[0.35, 32.68], [0.41, 32.68], [0.44, 32.62], [0.44, 32.52], [0.43, 32.46], [0.36, 32.46]],
  },
  {
    id: 'kla-jinja-exp',
    name: 'Kampala – Jinja Expressway',
    km: 76,
    funder: 'GoU / PPP',
    contractor: 'China Road & Bridge Corp.',
    lot: 'Expressway',
    completion: 'TBD 2028',
    status: 'Under Construction',
    positions: [[0.32, 32.58], [0.36, 32.72], [0.40, 32.90], [0.43, 33.06], [0.45, 33.20]],
  },
];

// ── Colour helpers ────────────────────────────────────────────────────────────
const FUNDER_COLORS: Record<string, string> = {
  GOU: '#3b82f6', GoU: '#3b82f6',
  AFDB: '#10b981', AfDB: '#10b981',
  'BADEA': '#f59e0b', 'OFID': '#f59e0b',
  'World Bank': '#8b5cf6',
  ADB: '#06b6d4', JICA: '#ec4899', EU: '#f97316',
  EXIM: '#a855f7', 'CHINA EXIM': '#a855f7',
};
function funderColor(agency: string): string {
  for (const [key, color] of Object.entries(FUNDER_COLORS)) {
    if (agency.toUpperCase().includes(key.toUpperCase())) return color;
  }
  return '#64748b';
}

const STATUS_STYLE = {
  planned:  { border: '#3b82f6', badge: 'text-blue-400 bg-blue-900/30 border-blue-800/50' },
  ongoing:  { border: '#f59e0b', badge: 'text-amber-400 bg-amber-900/30 border-amber-800/50' },
  complete: { border: '#22c55e', badge: 'text-green-400 bg-green-900/30 border-green-800/50' },
} as const;

// ── Works-type categorical colors ─────────────────────────────────────────────
const WORKS_COLOR: Record<string, string> = {
  'Routine Maintenance':  '#6b7280',
  'Periodic Maintenance': '#eab308',
  'Rehabilitation':       '#f97316',
  'Reconstruction':       '#ef4444',
  'New Construction':     '#22c55e',
};
type WorksType = keyof typeof WORKS_COLOR;

function inferWorksType(name: string): WorksType {
  const n = name.toLowerCase();
  if (n.includes('reconstruction') || n.includes('emergency recon'))     return 'Reconstruction';
  if (n.includes('rehabilitation') || n.includes('rehab'))               return 'Rehabilitation';
  if (n.includes('remedial') || n.includes('periodic'))                  return 'Periodic Maintenance';
  if (n.includes('routine') || n.includes('maintenance') && !n.includes('periodic')) return 'Routine Maintenance';
  return 'New Construction'; // upgrading / expressway / bypass / new road
}

const MARKER_COLOR: Record<Project['status'], string> = {
  planned:  '#3b82f6',
  ongoing:  '#f59e0b',
  complete: '#22c55e',
};

// ── Map controller: flies to target on change ─────────────────────────────────
function MapController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 10, { duration: 0.8 });
  }, [target, map]);
  return null;
}

// ── Progress bar strip ────────────────────────────────────────────────────────
function ProgressBar({ planned, actual, financial }: {
  planned: number | null; actual: number | null; financial: number | null;
}) {
  return (
    <div className="space-y-1 mt-2">
      {[
        { label: 'Physical',  val: actual,    color: '#3b82f6' },
        { label: 'Financial', val: financial, color: '#10b981' },
        { label: 'Planned',   val: planned,   color: '#475569' },
      ].map(b => (
        <div key={b.label}>
          <div className="flex justify-between text-[8px] text-slate-500 mb-0.5">
            <span>{b.label}</span>
            <span>{b.val !== null ? `${b.val.toFixed(0)}%` : '—'}</span>
          </div>
          <div className="bg-slate-700 rounded-full h-1.5">
            {b.val !== null && (
              <div className="rounded-full h-1.5 transition-all"
                style={{ width: `${Math.min(b.val, 100)}%`, background: b.color }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Photo strip ───────────────────────────────────────────────────────────────
function PhotoStrip({ photos, onPhotoClick }: {
  photos: string[];
  onPhotoClick: (src: string) => void;
}) {
  if (!photos.length) return null;
  return (
    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
      {photos.map((src, i) => (
        <button
          key={i}
          onClick={e => { e.stopPropagation(); onPhotoClick(src); }}
          className="flex-shrink-0 relative"
          style={{ width: 72, height: 52 }}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover rounded"
            style={{ background: '#1e293b' }}
            onError={e => {
              const t = e.currentTarget;
              t.style.display = 'none';
              const ph = t.nextElementSibling as HTMLElement | null;
              if (ph) ph.style.display = 'flex';
            }}
          />
          {/* Placeholder shown when img fails */}
          <div
            className="absolute inset-0 rounded flex items-center justify-center bg-slate-800 border border-slate-700"
            style={{ display: 'none' }}
          >
            <Camera size={14} className="text-slate-600" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Lightbox overlay ──────────────────────────────────────────────────────────
function Lightbox({ src, caption, onClose, onPrev, onNext, hasPrev, hasNext }: {
  src: string; caption: string; onClose: () => void;
  onPrev: () => void; onNext: () => void; hasPrev: boolean; hasNext: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-1.5"
      >
        <X size={20} />
      </button>
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 text-white/70 hover:text-white bg-black/40 rounded-full p-2"
        >
          <ChevronRight size={24} />
        </button>
      )}
      <img
        src={src}
        alt={caption}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
      <div className="absolute bottom-4 text-xs text-white/60 text-center px-4 max-w-xl">
        {caption}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const UGANDA_CENTER: [number, number] = [1.37, 32.3];

export default function ProjectsView() {
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTarget,  setFlyTarget]  = useState<[number, number] | null>(null);
  const [search,     setSearch]     = useState('');
  const [regionF,    setRegionF]    = useState('all');
  const [statusF,    setStatusF]    = useState<'all' | 'planned' | 'ongoing' | 'complete'>('all');
  const [lightbox,   setLightbox]   = useState<{ photos: string[]; idx: number; caption: string } | null>(null);

  const cardListRef = useRef<HTMLDivElement>(null);
  const [roadsGeo, setRoadsGeo] = useState<GeoJSON.FeatureCollection | null>(null);

  // Load projects and road network base layer
  useEffect(() => {
    loadEnhancedProjects()
      .then(p => { setProjects(p); setLoading(false); })
      .catch(() => setLoading(false));

    fetch(`${import.meta.env.BASE_URL}road_network.geojson`)
      .then(r => r.json())
      .then(setRoadsGeo)
      .catch(() => {/* road base layer optional */});

    // Inject CSS for marching-ants animation on under-construction corridors
    const s = document.createElement('style');
    s.id = 'uc-road-anim';
    s.textContent = `
      @keyframes pv-march { to { stroke-dashoffset: -24; } }
      .uc-road-line { animation: pv-march 0.9s linear infinite !important; }
    `;
    document.head.appendChild(s);
    return () => { document.getElementById('uc-road-anim')?.remove(); };
  }, []);

  const regions = useMemo(() => {
    const s = new Set<string>();
    projects.forEach(p => p.regions.split(',').forEach(r => s.add(r.trim())));
    return [...s].filter(Boolean).sort();
  }, [projects]);

  const filtered = useMemo(() => projects.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.project_name.toLowerCase().includes(q) &&
          !p.location.toLowerCase().includes(q)) return false;
    }
    if (regionF !== 'all' && !p.regions.includes(regionF)) return false;
    if (statusF !== 'all' && p.status !== statusF) return false;
    return true;
  }), [projects, search, regionF, statusF]);

  const stats = useMemo(() => ({
    planned:  projects.filter(p => p.status === 'planned').length,
    ongoing:  projects.filter(p => p.status === 'ongoing').length,
    complete: projects.filter(p => p.status === 'complete').length,
    totalKm:  projects.reduce((s, p) => s + p.parsed_length_km, 0),
  }), [projects]);

  const scrollToCard = useCallback((id: string) => {
    if (!cardListRef.current) return;
    const el = cardListRef.current.querySelector(`[data-project-id="${id}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  function selectFromCard(p: Project) {
    setSelectedId(p.id);
    setFlyTarget([p.lat, p.lng]);
  }

  function selectFromMap(p: Project) {
    setSelectedId(p.id);
    scrollToCard(p.id);
  }

  function openLightbox(photos: string[], idx: number, caption: string) {
    setLightbox({ photos, idx, caption });
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-amber-500 animate-spin mx-auto" />
          <div className="text-sm text-slate-400">Loading projects…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header + KPIs ── */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Construction size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Projects & Road Development</h1>
            <p className="text-[10px] text-slate-400">
              Ongoing road upgrading &amp; construction · FY 2024/25
            </p>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total km',  value: `${stats.totalKm.toFixed(0)}`, unit: 'km',    color: '#f59e0b' },
            { label: 'Planned',   value: `${stats.planned}`,            unit: 'proj',  color: '#3b82f6' },
            { label: 'Ongoing',   value: `${stats.ongoing}`,            unit: 'proj',  color: '#f59e0b' },
            { label: 'Complete',  value: `${stats.complete}`,           unit: 'proj',  color: '#22c55e' },
          ].map(k => (
            <div key={k.label} className="bms-card py-2 px-3 text-center">
              <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── OPRC + NDP IV info cards ── */}
        <div className="grid grid-cols-2 gap-2">

          {/* OPRC Card */}
          <div style={{
            background: 'rgba(253,211,77,0.05)',
            border: '1px solid rgba(253,211,77,0.25)',
            borderLeft: '3px solid #fcd34d',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              🚧 NERAMP OPRC — Output-Performance Road Contracts
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>
              <span style={{ color: '#fcd34d', fontWeight: 700 }}>Lot 1 (216 km)</span>
              {' '}Kamdini–Lira–Soroti–Koloin · Mota-Engil · World Bank · Completion Jun 2027
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginTop: 2 }}>
              <span style={{ color: '#fcd34d', fontWeight: 700 }}>Lot 2 (307 km)</span>
              {' '}Soroti–Moroto–Kotido · In procurement · World Bank NERAMP
            </div>
            <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.5)', marginTop: 4 }}>
              NERAMP = North East Road Asset Management Programme · 10-yr performance contracts
            </div>
          </div>

          {/* NDP IV Card */}
          <div style={{
            background: 'rgba(77,159,255,0.05)',
            border: '1px solid rgba(77,159,255,0.25)',
            borderLeft: '3px solid #4d9fff',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4d9fff', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
              📋 NDP IV Targets · FY 2025/26 – 2029/30
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5 }}>
              <span style={{ color: '#00ff88', fontWeight: 700 }}>1,200+ km</span>
              {' '}new paved roads (upgrading gravel-to-bituminous)
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.8)', lineHeight: 1.5, marginTop: 2 }}>
              <span style={{ color: '#00f5ff', fontWeight: 700 }}>Key priorities:</span>
              {' '}Albertine oil roads · GKMA improvements · Northern Bypass Ph 2 · border connectivity
            </div>
            <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.5)', marginTop: 4 }}>
              Target: 35% paved network by 2030 · Current baseline: ~30.1% (6,405 km)
            </div>
          </div>

        </div>

        {/* Works-type clustered bar chart */}
        {(() => {
          const wt: Record<string, { count: number; km: number }> = {};
          projects.forEach(p => {
            const t = inferWorksType(p.project_name);
            if (!wt[t]) wt[t] = { count: 0, km: 0 };
            wt[t].count++;
            wt[t].km += Math.round(p.parsed_length_km);
          });
          const data = Object.entries(wt)
            .map(([type, v]) => ({ type: type.replace(' ', '\n').split(' ')[0], fullType: type, ...v }))
            .sort((a, b) => b.km - a.km);
          return (
            <div style={{
              background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Projects by Works Type — Count &amp; Length (km)
              </div>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={data} margin={{ top: 2, right: 6, left: -24, bottom: 0 }}
                  barCategoryGap="20%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="fullType" tick={{ fill: '#64748b', fontSize: 8 }}
                    tickFormatter={(s: string) => s.split(' ')[0]} />
                  <YAxis yAxisId="cnt" tick={{ fill: '#64748b', fontSize: 8 }} />
                  <YAxis yAxisId="km" orientation="right" tick={{ fill: '#64748b', fontSize: 8 }} />
                  <ReTooltip
                    contentStyle={{ background: 'rgba(8,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                    formatter={(v: number, name: string) => [name === 'count' ? `${v} projects` : `${v} km`, name === 'count' ? 'Projects' : 'Total km']}
                    labelFormatter={(l: string) => l}
                  />
                  <Bar yAxisId="cnt" dataKey="count" name="count" radius={[3,3,0,0]} maxBarSize={28}>
                    {data.map(d => <Cell key={d.fullType} fill={WORKS_COLOR[d.fullType] ?? '#64748b'} />)}
                  </Bar>
                  <Bar yAxisId="km" dataKey="km" name="km" radius={[3,3,0,0]} maxBarSize={28}>
                    {data.map(d => <Cell key={d.fullType} fill={WORKS_COLOR[d.fullType] ?? '#64748b'} fillOpacity={0.4} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 4 }}>
                {Object.entries(WORKS_COLOR).map(([type, c]) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: '#64748b' }}>{type}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search projects, location…"
              className="bms-input pl-7 w-full text-xs"
            />
          </div>
          <select value={regionF} onChange={e => setRegionF(e.target.value)} className="bms-input text-xs">
            <option value="all">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={statusF} onChange={e => setStatusF(e.target.value as typeof statusF)} className="bms-input text-xs">
            <option value="all">All Status</option>
            <option value="planned">Planned</option>
            <option value="ongoing">Ongoing</option>
            <option value="complete">Complete</option>
          </select>
          <span className="text-[10px] text-slate-500">{filtered.length} / {projects.length}</span>
        </div>
      </div>

      {/* ── Map + Cards split ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden border-t border-slate-800">

        {/* Left: Leaflet map */}
        <div className="flex-shrink-0" style={{ width: '40%', position: 'relative' }}>
          <MapContainer
            center={UGANDA_CENTER}
            zoom={7}
            style={{ width: '100%', height: '100%' }}
            zoomControl
          >
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
            <WaterLayers />
            <MapController target={flyTarget} />

            {/* ── Road network base layer ── */}
            {roadsGeo && (
              <GeoJSONLayer
                key="roads-base"
                data={roadsGeo as GeoJSON.GeoJsonObject}
                style={(feature) => {
                  const surface: string = (feature?.properties as { surface?: string })?.surface ?? '';
                  const cat = surfaceCategory(surface);
                  const sym = ROAD_STYLES[cat === 'unknown' ? 'unknown' : cat];
                  return {
                    color: sym.color,
                    weight: sym.weight,
                    opacity: sym.opacity,
                    dashArray: sym.dashArray,
                  };
                }}
              />
            )}

            {/* ── Under-construction corridors (animated yellow dashes) ── */}
            {UNDER_CONSTRUCTION.map(c => (
              <Polyline
                key={c.id}
                positions={c.positions}
                pathOptions={{
                  color: '#FCD34D',
                  weight: 5,
                  opacity: 0.92,
                  dashArray: '12 6',
                  className: 'uc-road-line',
                }}
              >
                <Popup>
                  <div style={{ fontSize: 11, minWidth: 210, maxWidth: 250 }}>
                    <div style={{ fontWeight: 800, fontSize: 12, color: '#1e293b', borderBottom: '1.5px solid #fcd34d', paddingBottom: 4, marginBottom: 6 }}>
                      🚧 {c.name}
                    </div>
                    <table style={{ fontSize: 10, borderCollapse: 'collapse', width: '100%' }}>
                      {[
                        ['Lot / Category', c.lot],
                        ['Length', `${c.km} km`],
                        ['Funder', c.funder],
                        ['Contractor', c.contractor],
                        ['Status', c.status],
                        ['Est. Completion', c.completion],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ color: '#64748b', paddingRight: 8, paddingBottom: 3, fontWeight: 600, verticalAlign: 'top' }}>{k}</td>
                          <td style={{ color: '#111827', fontWeight: 700 }}>{v}</td>
                        </tr>
                      ))}
                    </table>
                  </div>
                </Popup>
              </Polyline>
            ))}

            {filtered.map(p => {
              const isSelected  = selectedId === p.id;
              const worksColor  = WORKS_COLOR[inferWorksType(p.project_name)] ?? '#64748b';
              const statusColor = MARKER_COLOR[p.status];
              return (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color:       isSelected ? '#fff' : statusColor,
                    fillColor:   worksColor,
                    fillOpacity: isSelected ? 0.95 : 0.75,
                    weight:      isSelected ? 3 : 2,
                  }}
                  eventHandlers={{ click: () => selectFromMap(p) }}
                >
                  <Popup>
                    <div style={{ fontSize: 11, maxWidth: 200 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>{p.project_name}</div>
                      <div style={{ color: '#94a3b8', fontSize: 10 }}>{p.location}</div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 8 }}>
                        <span style={{ color: '#f59e0b' }}>{p.parsed_length_km.toFixed(0)} km</span>
                        <span style={{ color: statusColor, textTransform: 'capitalize' }}>{p.status}</span>
                      </div>
                      {p.actual_progress_pct !== null && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 9, color: '#64748b' }}>Physical progress</div>
                          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, marginTop: 2 }}>
                            <div style={{ background: '#3b82f6', width: `${Math.min(p.actual_progress_pct, 100)}%`, height: '100%', borderRadius: 4 }} />
                          </div>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{p.actual_progress_pct.toFixed(0)}%</div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Map legend */}
          <div style={{
            position: 'absolute', bottom: 20, left: 8, zIndex: 1000,
            background: 'rgba(2,5,8,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '6px 10px',
          }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Works Type</div>
            {Object.entries(WORKS_COLOR).map(([type, c]) => (
              <div key={type} className="flex items-center gap-1.5 mb-1">
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 9, color: '#94a3b8' }}>{type}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 5, paddingTop: 5 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Status (ring)</div>
              {(['planned', 'ongoing', 'complete'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5 mb-1 last:mb-0">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${MARKER_COLOR[s]}`, background: 'transparent' }} />
                  <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'capitalize' }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 5, paddingTop: 5 }}>
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke={ROAD_STYLES.paved.color} strokeWidth="2.5"/>
                </svg>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>Paved road</span>
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke={ROAD_STYLES.unpaved.color} strokeWidth="1.5" strokeDasharray="3 2"/>
                </svg>
                <span style={{ fontSize: 9, color: '#94a3b8' }}>Unpaved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="18" height="5" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#FCD34D" strokeWidth="3" strokeDasharray="5 2"/>
                </svg>
                <span style={{ fontSize: 9, color: '#fcd34d' }}>Under construction</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: scrollable card list */}
        <div
          ref={cardListRef}
          className="flex-1 min-w-0 overflow-y-auto p-3 space-y-2"
          style={{ background: '#020508' }}
        >
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 text-xs py-12">No projects match the current filters.</div>
          )}

          {filtered.map(p => {
            const isSelected = selectedId === p.id;
            const ss = STATUS_STYLE[p.status];
            const wc = WORKS_COLOR[inferWorksType(p.project_name)] ?? '#64748b';
            return (
              <div
                key={p.id}
                data-project-id={p.id}
                onClick={() => selectFromCard(p)}
                className="rounded-lg p-3 cursor-pointer transition-all"
                style={{
                  background:    isSelected ? 'rgba(245,158,11,0.06)' : 'rgba(15,23,42,0.8)',
                  border:        `1px solid ${isSelected ? ss.border : 'rgba(51,65,85,0.6)'}`,
                  borderLeft:    `3px solid ${wc}`,
                  boxShadow:     isSelected ? `0 0 0 1px ${wc}40, 0 4px 20px ${wc}12` : 'none',
                }}
              >
                {/* Title row */}
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-white leading-snug line-clamp-2">
                      {p.project_name}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                      <span>{p.location}</span>
                      <span>·</span>
                      <span className="text-amber-400 font-semibold">{p.parsed_length_km.toFixed(0)} km</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border capitalize ${ss.badge}`}>
                      {p.status}
                    </span>
                    {p.behind_schedule && (
                      <span className="flex items-center gap-0.5 text-[8px] text-red-400 font-semibold">
                        <AlertTriangle size={8} /> Behind
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bars */}
                <ProgressBar
                  planned={p.planned_progress_pct}
                  actual={p.actual_progress_pct}
                  financial={p.financial_progress_pct}
                />

                {/* Photo strip */}
                <PhotoStrip
                  photos={p.progressPhotos}
                  onPhotoClick={src => {
                    const idx = p.progressPhotos.indexOf(src);
                    openLightbox(p.progressPhotos, idx >= 0 ? idx : 0, p.project_name);
                  }}
                />

                {/* Footer */}
                <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between text-[9px]">
                  <div>
                    <span className="text-slate-500">Funder · </span>
                    <span style={{ color: funderColor(p.funding_agency) }}>
                      {p.funding_agency.length > 20 ? p.funding_agency.slice(0, 20) + '…' : p.funding_agency}
                    </span>
                  </div>
                  {p.target_completion_date && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock size={8} />
                      {p.target_completion_date}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          src={lightbox.photos[lightbox.idx]}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
          hasPrev={lightbox.idx > 0}
          hasNext={lightbox.idx < lightbox.photos.length - 1}
          onPrev={() => setLightbox(lb => lb ? { ...lb, idx: lb.idx - 1 } : lb)}
          onNext={() => setLightbox(lb => lb ? { ...lb, idx: lb.idx + 1 } : lb)}
        />
      )}
    </div>
  );
}
