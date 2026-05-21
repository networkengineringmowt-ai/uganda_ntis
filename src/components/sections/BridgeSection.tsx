/**
 * BridgeSection — real-data BMS overview ingested from Bridges and Culverts 2026.xlsx
 * 515 bridges · 452 culverts · condition map · charts · critical table · DQ flags
 */
import { useEffect, useState, useMemo } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Popup, ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  AlertTriangle, CheckCircle, Activity,
  MapPin, Filter, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BridgeFeatureProps {
  id: string; name: string; road: string; road_name: string;
  condition: string; span_m: number | null; width_m: number | null;
  load_class_tonnes: number | null; year_built: number | null;
  structure_type: string; last_inspection: string;
  region: string; type: 'bridge' | 'culvert';
}
interface GeoFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: BridgeFeatureProps;
}
interface CriticalEntry {
  id: string; name: string; road: string; road_name: string;
  condition: string; span_m: number | null;
  load_class_tonnes: number | null; last_inspection: string;
  lat: number | null; lon: number | null; type: string;
}
interface DQFlag { id: string; name: string; issues: string[] }
interface BridgeSummary {
  total_bridges: number; total_culverts: number;
  bridges_with_gps: number; culverts_with_gps: number;
  condition_distribution_bridges: Record<string, number>;
  condition_distribution_culverts: Record<string, number>;
  by_structure_type_bridges: Record<string, number>;
  by_structure_type_culverts: Record<string, number>;
  by_road_class: Record<string, number>;
  critical_structures: CriticalEntry[];
  data_quality_flags: DQFlag[];
  bridges_geojson: { type: 'FeatureCollection'; features: GeoFeature[] };
  culverts_geojson: { type: 'FeatureCollection'; features: GeoFeature[] };
}

// ── Palette ───────────────────────────────────────────────────────────────────
const COND_COLOR: Record<string, string> = {
  Good:     '#22c55e',
  Fair:     '#eab308',
  Poor:     '#f97316',
  Critical: '#ef4444',
  Unknown:  '#64748b',
};
const ACCENT = '#3b82f6';
const BG     = '#0a0f1e';
const GLASS  = 'rgba(15,23,42,0.55)';

function condScore(dist: Record<string, number>): number {
  const W: Record<string, number> = { Good: 4, Fair: 3, Poor: 2, Critical: 1, Unknown: 0 };
  let total = 0; let count = 0;
  for (const [k, v] of Object.entries(dist)) { total += (W[k] ?? 0) * v; count += v; }
  return count ? +(total / count).toFixed(2) : 0;
}

// ── Leaflet map markers ───────────────────────────────────────────────────────
function StructureMap({ features, showCulverts }: {
  features: GeoFeature[];
  showCulverts: boolean;
}) {
  const visible = useMemo(
    () => features.filter(f => showCulverts || f.properties.type === 'bridge'),
    [features, showCulverts],
  );
  return (
    <MapContainer
      center={[1.3733, 32.2903]}
      zoom={7}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
      <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels}  />
      <ZoomControl position="bottomright" />
      {visible.map((f, i) => {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties;
        const col = COND_COLOR[p.condition] ?? COND_COLOR.Unknown;
        return (
          <CircleMarker
            key={`${p.id}-${i}`}
            center={[lat, lon]}
            radius={p.type === 'bridge' ? 5 : 3}
            pathOptions={{
              color: col, fillColor: col, fillOpacity: 0.85, weight: 1,
            }}
          >
            <Popup>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <strong>{p.name || p.id}</strong><br/>
                <span style={{ color: '#666' }}>{p.road} · {p.road_name}</span><br/>
                <span style={{ color: col, fontWeight: 700 }}>{p.condition}</span>
                {p.span_m != null && <><br/>Span: {p.span_m} m</>}
                {p.width_m != null && <> · Width: {p.width_m} m</>}
                {p.year_built != null && <><br/>Built: {p.year_built}</>}
                {p.load_class_tonnes != null && <><br/>Load class: {p.load_class_tonnes} t</>}
                {p.last_inspection && <><br/>Inspected: {p.last_inspection}</>}
                <br/><span style={{ color: '#999', fontSize: 11 }}>{p.structure_type}</span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

// ── Sortable critical table ───────────────────────────────────────────────────
type SortKey = 'name' | 'road' | 'condition' | 'span_m' | 'load_class_tonnes' | 'last_inspection';

function CriticalTable({ rows }: { rows: CriticalEntry[] }) {
  const [sort, setSort] = useState<SortKey>('condition');
  const [dir,  setDir]  = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const copy = [...rows];
    const ORDER: Record<string, number> = { Critical: 0, Poor: 1, Fair: 2, Good: 3, Unknown: 4 };
    copy.sort((a, b) => {
      let cmp = 0;
      if (sort === 'condition')          cmp = (ORDER[a.condition] ?? 9) - (ORDER[b.condition] ?? 9);
      else if (sort === 'name')          cmp = (a.name || '').localeCompare(b.name || '');
      else if (sort === 'road')          cmp = (a.road || '').localeCompare(b.road || '');
      else if (sort === 'span_m')        cmp = (a.span_m ?? 0) - (b.span_m ?? 0);
      else if (sort === 'load_class_tonnes') cmp = (a.load_class_tonnes ?? 0) - (b.load_class_tonnes ?? 0);
      else if (sort === 'last_inspection')   cmp = (a.last_inspection || '').localeCompare(b.last_inspection || '');
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [rows, sort, dir]);

  function toggle(k: SortKey) {
    if (k === sort) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(k); setDir('asc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (k !== sort) return <ArrowUpDown size={11} style={{ opacity: 0.3 }}/>;
    return dir === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>;
  }

  const colStyle: React.CSSProperties = {
    padding: '6px 10px', fontSize: 11, fontWeight: 700,
    color: 'rgba(148,163,184,0.7)', textAlign: 'left',
    borderBottom: '1px solid rgba(59,130,246,0.15)', cursor: 'pointer',
    userSelect: 'none', whiteSpace: 'nowrap',
  };
  const cellStyle: React.CSSProperties = {
    padding: '7px 10px', fontSize: 12, color: '#c8d5e6', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {([
              ['name',              'Name / ID'],
              ['road',              'Road'],
              ['condition',         'Condition'],
              ['span_m',            'Span (m)'],
              ['load_class_tonnes', 'Load (t)'],
              ['last_inspection',   'Last Inspection'],
            ] as [SortKey, string][]).map(([k, lbl]) => (
              <th key={k} style={colStyle} onClick={() => toggle(k)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {lbl} <SortIcon k={k} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            }}>
              <td style={cellStyle}>
                <span style={{ fontWeight: 700, color: '#e2eaf4' }}>{row.name || row.id}</span>
                <span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{row.type}</span>
              </td>
              <td style={cellStyle}>{row.road}</td>
              <td style={{ ...cellStyle, fontWeight: 700, color: COND_COLOR[row.condition] ?? '#94a3b8' }}>
                {row.condition}
              </td>
              <td style={cellStyle}>{row.span_m ?? '—'}</td>
              <td style={cellStyle}>{row.load_class_tonnes ?? '—'}</td>
              <td style={cellStyle}>{row.last_inspection || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: GLASS, backdropFilter: 'blur(20px)',
      border: `1px solid rgba(${hexRgb(color)},0.18)`,
      borderRadius: 14, padding: '18px 22px',
      flex: 1, minWidth: 180,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ color, filter: `drop-shadow(0 0 6px ${color})` }}>{icon}</span>
        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 34, fontWeight: 900, color, lineHeight: 1,
        textShadow: `0 0 20px ${color}50` }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(100,116,139,0.7)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function hexRgb(hex: string) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0,2),16),
    parseInt(h.slice(2,4),16),
    parseInt(h.slice(4,6),16),
  ].join(',');
}

// ── Main section ──────────────────────────────────────────────────────────────
export default function BridgeSection() {
  const [data,         setData]         = useState<BridgeSummary | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [showCulverts, setShowCulverts] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'map' | 'charts' | 'table' | 'dq'>('map');

  useEffect(() => {
    fetch('data/bridges_summary.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const allFeatures = useMemo(() => {
    if (!data) return [];
    const arr: GeoFeature[] = [...data.bridges_geojson.features];
    if (showCulverts) arr.push(...data.culverts_geojson.features);
    return arr;
  }, [data, showCulverts]);

  const condDonutBr = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.condition_distribution_bridges)
      .map(([name, value]) => ({ name, value, color: COND_COLOR[name] ?? '#64748b' }));
  }, [data]);

  const condDonutCu = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.condition_distribution_culverts)
      .map(([name, value]) => ({ name, value, color: COND_COLOR[name] ?? '#64748b' }));
  }, [data]);

  const structTypeBars = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_structure_type_bridges)
      .map(([name, value]) => ({ name: name.replace(' Bridge','').replace(' Culvert',''), value }))
      .sort((a,b) => b.value - a.value);
  }, [data]);

  const roadClassBars = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.by_road_class)
      .map(([name, value]) => ({ name: `Class ${name}`, value }))
      .sort((a,b) => b.value - a.value);
  }, [data]);

  const avgScore = useMemo(() =>
    data ? condScore(data.condition_distribution_bridges) : 0,
    [data],
  );

  const critCount = (data?.condition_distribution_bridges['Critical'] ?? 0) +
                    (data?.condition_distribution_culverts['Critical'] ?? 0);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: 300, color: '#64748b', gap: 10 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%',
        border: '2px solid rgba(59,130,246,0.3)', borderTopColor: ACCENT,
        animation: 'spin 0.8s linear infinite' }} />
      Loading bridge data…
    </div>
  );
  if (error) return (
    <div style={{ padding: 32, color: '#ef4444', textAlign: 'center' }}>
      Failed to load bridge data: {error}
    </div>
  );
  if (!data) return null;

  const hd: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: 'rgba(59,130,246,0.7)',
    textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 16,
  };
  const glassCard: React.CSSProperties = {
    background: GLASS, backdropFilter: 'blur(20px)',
    border: '1px solid rgba(59,130,246,0.12)', borderRadius: 14,
    padding: '20px 22px',
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: 'none',
    background: active ? ACCENT : 'rgba(255,255,255,0.04)',
    color: active ? '#fff' : 'rgba(200,214,230,0.7)',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ background: BG, minHeight: '100%', padding: '20px 24px 40px', fontFamily: 'inherit' }}>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#e2eaf4',
          letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: ACCENT, filter: `drop-shadow(0 0 8px ${ACCENT})` }}>
            <Activity size={22}/>
          </span>
          Bridge &amp; Culvert Management
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Uganda National Roads Authority — BMS 2026 dataset · {data.total_bridges} bridges · {data.total_culverts} culverts
        </div>
      </div>

      {/* ── KPI bar ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <KpiCard
          label="Total Bridges"
          value={data.total_bridges.toLocaleString()}
          sub={`${data.bridges_with_gps} georeferenced`}
          color={ACCENT}
          icon={<MapPin size={18}/>}
        />
        <KpiCard
          label="Total Culverts"
          value={data.total_culverts.toLocaleString()}
          sub={`${data.culverts_with_gps} georeferenced`}
          color="#8b5cf6"
          icon={<MapPin size={18}/>}
        />
        <KpiCard
          label="Critical Structures"
          value={critCount}
          sub="Bridges + culverts requiring urgent action"
          color="#ef4444"
          icon={<AlertTriangle size={18}/>}
        />
        <KpiCard
          label="Avg Condition Score"
          value={`${avgScore} / 4`}
          sub="Good=4 · Fair=3 · Poor=2 · Critical=1"
          color={avgScore >= 3 ? '#22c55e' : avgScore >= 2 ? '#eab308' : '#ef4444'}
          icon={<CheckCircle size={18}/>}
        />
      </div>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, alignItems: 'center' }}>
        {(['map','charts','table','dq'] as const).map(t => (
          <button key={t} style={tabBtn(activeTab===t)} onClick={() => setActiveTab(t)}>
            {t === 'map'    ? 'Structure Map'  :
             t === 'charts' ? 'Condition Charts':
             t === 'table'  ? 'Critical Structures':
                              `DQ Flags (${data.data_quality_flags.length})`}
          </button>
        ))}
        {(activeTab === 'map') && (
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center',
            gap: 7, fontSize: 12, color: 'rgba(200,214,230,0.7)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showCulverts}
              onChange={e => setShowCulverts(e.target.checked)}
              style={{ accentColor: '#8b5cf6' }}/>
            Show culverts
          </label>
        )}
      </div>

      {/* ══ MAP TAB ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'map' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
          {/* Map */}
          <div style={{ ...glassCard, padding: 0, overflow: 'hidden', borderRadius: 14, height: 540 }}>
            <StructureMap features={allFeatures} showCulverts={showCulverts} />
          </div>

          {/* Legend + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={glassCard}>
              <div style={hd}>Condition Legend</div>
              {Object.entries(COND_COLOR).filter(([k]) => k !== 'Unknown').map(([cond, col]) => (
                <div key={cond} style={{ display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%',
                    background: col, display: 'inline-block',
                    boxShadow: `0 0 6px ${col}` }}/>
                  <span style={{ color: '#c8d5e6' }}>{cond}</span>
                  <span style={{ marginLeft: 'auto', color: col, fontWeight: 700 }}>
                    {data.condition_distribution_bridges[cond] ?? 0}
                  </span>
                </div>
              ))}
            </div>
            <div style={glassCard}>
              <div style={hd}>By Road Class</div>
              {Object.entries(data.by_road_class)
                .sort((a,b) => b[1]-a[1])
                .map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:12, marginBottom:6, color:'#c8d5e6' }}>
                    <span>Class {k}</span>
                    <span style={{ color: ACCENT, fontWeight: 700 }}>{v}</span>
                  </div>
              ))}
            </div>
            <div style={glassCard}>
              <div style={hd}>Structure Types</div>
              {Object.entries(data.by_structure_type_bridges)
                .sort((a,b) => b[1]-a[1])
                .map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:11, marginBottom:5, color:'#c8d5e6' }}>
                    <span style={{ flex:1, paddingRight:6 }}>{k}</span>
                    <span style={{ color:'#22c55e', fontWeight:700 }}>{v}</span>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ CHARTS TAB ════════════════════════════════════════════════════════ */}
      {activeTab === 'charts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Bridge condition donut */}
          <div style={glassCard}>
            <div style={hd}>Bridge Overall Condition</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={condDonutBr} cx="50%" cy="50%" innerRadius={65} outerRadius={100}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {condDonutBr.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b',
                    borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${v} bridges`, n]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Culvert condition donut */}
          <div style={glassCard}>
            <div style={hd}>Culvert Overall Condition</div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={condDonutCu} cx="50%" cy="50%" innerRadius={65} outerRadius={100}
                  dataKey="value" nameKey="name" paddingAngle={2}>
                  {condDonutCu.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b',
                    borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string) => [`${v} culverts`, n]}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Structure type bar */}
          <div style={glassCard}>
            <div style={hd}>Bridges by Structure Type</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={structTypeBars} layout="vertical"
                margin={{ top: 0, right: 20, bottom: 0, left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={68}/>
                <Tooltip
                  contentStyle={{ background:'#0f172a', border:'1px solid #1e293b',
                    borderRadius:8, fontSize:12 }}
                />
                <Bar dataKey="value" fill={ACCENT} radius={[0,4,4,0]} name="Bridges"/>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By road class bar */}
          <div style={glassCard}>
            <div style={hd}>Bridges by Road Class</div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={roadClassBars}
                margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }}/>
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }}/>
                <Tooltip
                  contentStyle={{ background:'#0f172a', border:'1px solid #1e293b',
                    borderRadius:8, fontSize:12 }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4,4,0,0]} name="Bridges"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ CRITICAL TABLE TAB ════════════════════════════════════════════════ */}
      {activeTab === 'table' && (
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }}/>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e2eaf4' }}>
              Critical &amp; Poor Structures — {data.critical_structures.length} flagged
            </span>
          </div>
          <CriticalTable rows={data.critical_structures} />
        </div>
      )}

      {/* ══ DATA QUALITY TAB ══════════════════════════════════════════════════ */}
      {activeTab === 'dq' && (
        <div style={glassCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Filter size={16} style={{ color: '#eab308' }}/>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#e2eaf4' }}>
              Data Quality — {data.data_quality_flags.length} records need review
            </span>
          </div>
          {data.data_quality_flags.length === 0 ? (
            <div style={{ color: '#22c55e', textAlign: 'center', padding: 24 }}>
              No data quality issues found.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['ID', 'Name', 'Issues'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700,
                      color: 'rgba(148,163,184,0.7)', textAlign: 'left',
                      borderBottom: '1px solid rgba(234,179,8,0.15)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data_quality_flags.map((row, i) => (
                  <tr key={i} style={{ background: i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: '#94a3b8' }}>{row.id}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: '#c8d5e6', fontWeight: 600 }}>
                      {row.name}
                    </td>
                    <td style={{ padding: '7px 12px' }}>
                      {row.issues.map((iss, j) => (
                        <span key={j} style={{
                          display: 'inline-block', marginRight: 6,
                          padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          background: iss.includes('Missing GPS') ? 'rgba(239,68,68,0.15)'
                            : iss.includes('condition') ? 'rgba(234,179,8,0.15)'
                            : 'rgba(100,116,139,0.15)',
                          color: iss.includes('Missing GPS') ? '#ef4444'
                            : iss.includes('condition') ? '#eab308'
                            : '#94a3b8',
                          border: `1px solid ${iss.includes('Missing GPS') ? 'rgba(239,68,68,0.3)'
                            : iss.includes('condition') ? 'rgba(234,179,8,0.3)'
                            : 'rgba(100,116,139,0.3)'}`,
                        }}>
                          {iss}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
