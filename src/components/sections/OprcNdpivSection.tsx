import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from 'react-leaflet';
import { WaterLayers } from '../../shared/WaterLayers';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  Cell, PieChart, Pie, Legend, ResponsiveContainer,
} from 'recharts';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import { TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OprcLot {
  lot_id: string; name: string; region: string; roads: string[];
  total_km: number; contractor: string; contract_value_usd: number;
  start_date: string; end_date: string; performance_score: number;
  status: string; paved_km: number; unpaved_km: number;
  centroid: [number, number];
}
interface NdpivProject {
  project_id: string; name: string; road_links: string[]; region: string;
  priority: string; type: string; status: string;
  budget_usd: number; disbursed_usd: number;
  length_km: number; completion_pct: number; target_year: number;
  centroid: [number, number];
}
interface OprcNdpivData { oprc_lots: OprcLot[]; ndpiv_projects: NdpivProject[] }

// ─── Colour helpers ───────────────────────────────────────────────────────────
function perfColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}
function statusColor(status: string): string {
  switch (status) {
    case 'Construction': return '#3b82f6';
    case 'Procurement':  return '#8b5cf6';
    case 'Completed':    return '#22c55e';
    default:             return '#6b7280';
  }
}
function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

// ─── Diamond DivIcon factory (safe at module level — no DOM access) ───────────
function makeDiamond(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};transform:rotate(45deg);border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 8px ${color}80;"></div>`,
    iconSize:   [18, 18] as L.PointExpression,
    iconAnchor: [9,  9]  as L.PointExpression,
    popupAnchor:[0, -12] as L.PointExpression,
  });
}
const ICONS: Record<string, L.DivIcon> = {
  Construction: makeDiamond('#3b82f6'),
  Procurement:  makeDiamond('#8b5cf6'),
  Completed:    makeDiamond('#22c55e'),
  _default:     makeDiamond('#6b7280'),
};
function diamondIcon(status: string): L.DivIcon {
  return ICONS[status] ?? ICONS['_default'];
}

// ─── Glass card style ─────────────────────────────────────────────────────────
const GLASS: React.CSSProperties = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
};

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ title, value, sub, accent }: { title: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{ ...GLASS, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, lineHeight: 1, textShadow: `0 0 16px ${accent}60` }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(100,116,139,0.8)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

// ─── Layer toggle button ──────────────────────────────────────────────────────
function LayerToggle({ label, active, onToggle, color }: { label: string; active: boolean; onToggle: () => void; color: string }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', borderRadius: 8, marginBottom: 4,
        border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? `rgba(${hexRgb(color)},0.1)` : 'rgba(255,255,255,0.03)',
        color: active ? color : 'rgba(148,163,184,0.6)',
        fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
      }}
    >
      <span style={{
        width: 10, height: 10, borderRadius: 2, flexShrink: 0,
        background: active ? color : 'rgba(255,255,255,0.15)',
        boxShadow: active ? `0 0 6px ${color}80` : 'none',
        transition: 'all 0.15s',
      }} />
      {label}
    </button>
  );
}

// ─── Section header label ─────────────────────────────────────────────────────
function PanelLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {text}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OprcNdpivSection() {
  const [data,            setData]            = useState<OprcNdpivData | null>(null);
  const [showOprc,        setShowOprc]        = useState(true);
  const [showNdpiv,       setShowNdpiv]       = useState(true);
  const [regionFilter,    setRegionFilter]    = useState('All');
  const [selectedLot,     setSelectedLot]     = useState<OprcLot | null>(null);
  const [selectedProject, setSelectedProject] = useState<NdpivProject | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/oprc_ndpiv.json`)
      .then(r => r.json())
      .then((d: OprcNdpivData) => setData(d))
      .catch(() => {});
  }, []);

  const regions = useMemo(() =>
    data ? ['All', ...Array.from(new Set(data.oprc_lots.map(l => l.region))).sort()] : ['All'],
    [data],
  );
  const lots = useMemo(() =>
    !data ? [] : regionFilter === 'All' ? data.oprc_lots : data.oprc_lots.filter(l => l.region === regionFilter),
    [data, regionFilter],
  );
  const projects = useMemo(() =>
    !data ? [] : regionFilter === 'All' ? data.ndpiv_projects : data.ndpiv_projects.filter(p => p.region === regionFilter),
    [data, regionFilter],
  );

  const totalKm     = useMemo(() => lots.reduce((s, l) => s + l.total_km, 0), [lots]);
  const totalValue  = useMemo(() => lots.reduce((s, l) => s + l.contract_value_usd, 0), [lots]);
  const avgScore    = useMemo(() => lots.length ? Math.round(lots.reduce((s, l) => s + l.performance_score, 0) / lots.length) : 0, [lots]);
  const totalBudget = useMemo(() => projects.reduce((s, p) => s + p.budget_usd, 0), [projects]);

  const barData = useMemo(() => lots.map(l => ({ name: l.lot_id, score: l.performance_score })), [lots]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: statusColor(name) }));
  }, [projects]);

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
        <div style={{ textAlign: 'center', fontSize: 12 }}>Loading OPRC &amp; NDP IV data…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', color: '#e2e8f0' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(185,103,255,0.25), rgba(59,130,246,0.2))',
          border: '1px solid rgba(185,103,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={15} style={{ color: '#b967ff' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em' }}>OPRC &amp; NDP IV</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            Output &amp; Performance-based Road Contracts · National Development Plan IV Investments
          </div>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        <SummaryCard title="Active OPRC Lots"     value={String(lots.length)}                 sub={`${totalKm.toLocaleString()} km under contract`}  accent="#00f5ff" />
        <SummaryCard title="Total Contract Value" value={`$${(totalValue/1e6).toFixed(0)}M`}  sub="USD · all active lots"                             accent="#00ff88" />
        <SummaryCard title="Avg Performance"      value={`${avgScore}/100`}                   sub="Weighted across lots"                              accent={perfColor(avgScore)} />
        <SummaryCard title="NDP IV Projects"      value={String(projects.length)}             sub={`$${(totalBudget/1e6).toFixed(0)}M total budget`}  accent="#b967ff" />
      </div>

      {/* ── Region filter pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {regions.map(r => (
          <button key={r} onClick={() => setRegionFilter(r)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            background: regionFilter === r ? 'rgba(185,103,255,0.15)' : 'transparent',
            border: `1px solid ${regionFilter === r ? 'rgba(185,103,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
            color: regionFilter === r ? '#b967ff' : '#94a3b8',
            transition: 'all 0.15s',
          }}>{r}</button>
        ))}
      </div>

      {/* ── 3-column layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 320px', gap: 12, alignItems: 'start' }}>

        {/* ── LEFT: layers + legend + lot list ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Map Layers" />
            <LayerToggle label="Show OPRC Lots"       active={showOprc}  onToggle={() => setShowOprc(v => !v)}  color="#00f5ff" />
            <LayerToggle label="Show NDP IV Projects" active={showNdpiv} onToggle={() => setShowNdpiv(v => !v)} color="#b967ff" />
          </div>

          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="OPRC Performance" />
            {([['#22c55e','High (≥ 85)'],['#f59e0b','Medium (70–84)'],['#ef4444','Low (< 70)']] as [string,string][]).map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, boxShadow: `0 0 5px ${c}70`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{l}</span>
              </div>
            ))}
            <PanelLabel text="NDP IV Status" />
            {([['#3b82f6','Construction'],['#8b5cf6','Procurement'],['#6b7280','Design / Planning'],['#22c55e','Completed']] as [string,string][]).map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, background: c, transform: 'rotate(45deg)', boxShadow: `0 0 5px ${c}70`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{l}</span>
              </div>
            ))}
          </div>

          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text={`OPRC Lots (${lots.length})`} />
            {lots.map(lot => {
              const isSel = selectedLot?.lot_id === lot.lot_id;
              const pc = perfColor(lot.performance_score);
              return (
                <button key={lot.lot_id}
                  onClick={() => { setSelectedLot(isSel ? null : lot); setSelectedProject(null); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                    border: `1px solid ${isSel ? `rgba(${hexRgb(pc)},0.4)` : 'transparent'}`,
                    background: isSel ? `rgba(${hexRgb(pc)},0.1)` : 'rgba(255,255,255,0.03)',
                    color: '#e2e8f0', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{lot.lot_id}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: pc }}>{lot.performance_score}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{lot.total_km} km · {lot.region}</div>
                  {isSel && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                      <div style={{ fontWeight: 600 }}>{lot.contractor}</div>
                      <div style={{ marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>Paved: {lot.paved_km} km</span>
                        <span>Unpaved: {lot.unpaved_km} km</span>
                      </div>
                      <div style={{ marginTop: 2 }}>${(lot.contract_value_usd/1e6).toFixed(1)}M · ends {lot.end_date.slice(0,4)}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTRE: Leaflet map ───────────────────────────────────────────── */}
        <div style={{ ...GLASS, height: 700, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={[1.373, 32.29]} zoom={7} style={{ width: '100%', height: '100%' }} zoomControl>
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels}  />
            <WaterLayers />

            {showOprc && lots.map(lot => {
              const pc   = perfColor(lot.performance_score);
              const isSel = selectedLot?.lot_id === lot.lot_id;
              return (
                <CircleMarker key={lot.lot_id}
                  center={lot.centroid}
                  radius={isSel ? 24 : 20}
                  pathOptions={{ color: pc, fillColor: pc, fillOpacity: isSel ? 0.5 : 0.28, weight: isSel ? 3 : 2 }}
                  eventHandlers={{ click: () => { setSelectedLot(l => l?.lot_id === lot.lot_id ? null : lot); setSelectedProject(null); } }}
                >
                  <Popup>
                    <div style={{ minWidth: 170, fontFamily: 'system-ui,sans-serif' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{lot.name}</div>
                      <div>Score: <b style={{ color: pc }}>{lot.performance_score}/100</b></div>
                      <div>Length: {lot.total_km} km · {lot.region}</div>
                      <div>Contractor: {lot.contractor}</div>
                      <div>Contract: ${(lot.contract_value_usd/1e6).toFixed(1)}M USD</div>
                      <div>Roads: {lot.roads.join(', ')}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {showNdpiv && projects.map(proj => (
              <Marker key={proj.project_id}
                position={proj.centroid}
                icon={diamondIcon(proj.status)}
                eventHandlers={{ click: () => { setSelectedProject(p => p?.project_id === proj.project_id ? null : proj); setSelectedLot(null); } }}
              >
                <Popup>
                  <div style={{ minWidth: 190, fontFamily: 'system-ui,sans-serif' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{proj.name}</div>
                    <div>Status: <b style={{ color: statusColor(proj.status) }}>{proj.status}</b></div>
                    <div>Completion: {proj.completion_pct}%</div>
                    <div>Length: {proj.length_km} km · {proj.region}</div>
                    <div>Budget: ${(proj.budget_usd/1e6).toFixed(0)}M · Disbursed: ${(proj.disbursed_usd/1e6).toFixed(0)}M</div>
                    <div>Target year: {proj.target_year}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* ── RIGHT: detail + charts + table ───────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Selected item detail */}
          {(selectedLot || selectedProject) && (
            <div style={{ ...GLASS, padding: 14, borderColor: 'rgba(185,103,255,0.22)' }}>
              <PanelLabel text={selectedLot ? 'OPRC Lot Detail' : 'NDP IV Project Detail'} />
              {selectedLot && (() => {
                const pc = perfColor(selectedLot.performance_score);
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>{selectedLot.name}</div>
                    <div style={{ color: '#94a3b8', marginBottom: 3 }}>{selectedLot.contractor}</div>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                      <span style={{ color: '#94a3b8' }}>Paved: <b style={{ color: '#22c55e' }}>{selectedLot.paved_km} km</b></span>
                      <span style={{ color: '#94a3b8' }}>Unpaved: <b style={{ color: '#f59e0b' }}>{selectedLot.unpaved_km} km</b></span>
                    </div>
                    <div style={{ color: '#94a3b8' }}>Value: <b style={{ color: '#00ff88' }}>${(selectedLot.contract_value_usd/1e6).toFixed(1)}M</b></div>
                    <div style={{ color: '#94a3b8', marginTop: 3 }}>Period: {selectedLot.start_date} → {selectedLot.end_date}</div>
                    <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ width: `${selectedLot.performance_score}%`, height: '100%', background: pc, borderRadius: 2, boxShadow: `0 0 4px ${pc}60` }} />
                    </div>
                    <div style={{ marginTop: 3, fontSize: 10, color: '#64748b' }}>Performance: {selectedLot.performance_score}/100</div>
                  </div>
                );
              })()}
              {selectedProject && (() => {
                const sc = statusColor(selectedProject.status);
                return (
                  <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>{selectedProject.name}</div>
                    <div style={{ color: '#94a3b8', marginBottom: 2 }}>{selectedProject.type} · {selectedProject.region}</div>
                    <div style={{ color: '#94a3b8', marginBottom: 2 }}>
                      Priority: <b style={{ color: selectedProject.priority === 'High' ? '#ef4444' : selectedProject.priority === 'Medium' ? '#f59e0b' : '#94a3b8' }}>{selectedProject.priority}</b>
                    </div>
                    <div style={{ color: '#94a3b8', marginBottom: 2 }}>Budget: <b style={{ color: '#00ff88' }}>${(selectedProject.budget_usd/1e6).toFixed(0)}M</b> · Disbursed: ${(selectedProject.disbursed_usd/1e6).toFixed(0)}M</div>
                    <div style={{ color: '#94a3b8' }}>Target: {selectedProject.target_year} · {selectedProject.length_km} km</div>
                    <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ width: `${selectedProject.completion_pct}%`, height: '100%', background: sc, borderRadius: 2, boxShadow: `0 0 4px ${sc}60` }} />
                    </div>
                    <div style={{ marginTop: 3, fontSize: 10, color: '#64748b' }}>Completion: {selectedProject.completion_pct}%</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Bar chart: performance by lot */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Performance by OPRC Lot" />
            <ResponsiveContainer width="100%" height={155}>
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} tickFormatter={(s: string) => s.replace('OPRC-','')} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                <ReTooltip
                  contentStyle={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v) => [`${v}/100`, 'Score']}
                  labelFormatter={(l: string) => l.replace('OPRC-', 'Lot ')}
                />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {lots.map((lot, i) => <Cell key={i} fill={perfColor(lot.performance_score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Donut chart: NDP IV by status */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="NDP IV by Status" />
            <ResponsiveContainer width="100%" height={155}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56} paddingAngle={2} dataKey="value" nameKey="name">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />)}
                </Pie>
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} />
                <ReTooltip contentStyle={{ background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Progress bars: project completion */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Project Completion" />
            {projects.map(proj => (
              <div key={proj.project_id} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: '#94a3b8', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {proj.name}
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: statusColor(proj.status), flexShrink: 0, marginLeft: 4 }}>
                    {proj.completion_pct}%
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{
                    width: `${proj.completion_pct}%`, height: '100%',
                    background: statusColor(proj.status), borderRadius: 2,
                    boxShadow: `0 0 4px ${statusColor(proj.status)}60`,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Budget disbursement table */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Budget Disbursement" />
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <th style={{ textAlign: 'left',  padding: '3px 5px 7px', fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Project</th>
                  <th style={{ textAlign: 'right', padding: '3px 5px 7px', fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Budget</th>
                  <th style={{ textAlign: 'right', padding: '3px 5px 7px', fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Disbursed</th>
                  <th style={{ textAlign: 'right', padding: '3px 5px 7px', fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>%</th>
                  <th style={{ textAlign: 'left',  padding: '3px 5px 7px', fontSize: 8, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(proj => {
                  const disbPct = Math.round((proj.disbursed_usd / proj.budget_usd) * 100);
                  const sc = statusColor(proj.status);
                  return (
                    <tr key={proj.project_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '5px 5px', fontSize: 9, color: '#cbd5e1', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={proj.name}>
                        {proj.name}
                      </td>
                      <td style={{ padding: '5px 5px', fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>${(proj.budget_usd/1e6).toFixed(0)}M</td>
                      <td style={{ padding: '5px 5px', fontSize: 9, color: '#94a3b8', textAlign: 'right' }}>${(proj.disbursed_usd/1e6).toFixed(0)}M</td>
                      <td style={{ padding: '5px 5px', fontSize: 9, fontWeight: 700, textAlign: 'right', color: sc }}>{disbPct}%</td>
                      <td style={{ padding: '5px 5px' }}>
                        <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 3, background: `${sc}20`, color: sc, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {proj.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
