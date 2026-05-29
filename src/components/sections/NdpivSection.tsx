import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS, ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';
import { InfraLayers } from '../../shared/InfraLayers';
import { BarChart2 } from 'lucide-react';
import { ModuleNavBar } from '../../shared/ModuleNavBar';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NdpivProject {
  project_id: string; name: string; road_links: string[]; region: string;
  priority: string; type: string; status: string;
  budget_usd: number; disbursed_usd: number;
  length_km: number; completion_pct: number; target_year: number;
  centroid: [number, number];
}
interface OprcNdpivData { oprc_lots: unknown[]; ndpiv_projects: NdpivProject[] }

// ─── Categorical colour maps ──────────────────────────────────────────────────
const CATEGORY_COLOR: Record<string, string> = {
  'Roads':             '#3b82f6',
  'Bridges':           '#f97316',
  'Urban Roads':       '#a855f7',
  'Rehabilitation':    '#22c55e',
  'New Construction':  '#06b6d4',
};
function categoryColor(type: string): string { return CATEGORY_COLOR[type] ?? '#6b7280'; }

const STATUS_CLR: Record<string, string> = {
  'Construction': '#3b82f6', 'Procurement': '#8b5cf6',
  'Completed':    '#22c55e', 'Design / Planning': '#f59e0b',
};
function statusColor(s: string): string { return STATUS_CLR[s] ?? '#6b7280'; }

const TT_STYLE = { background: 'rgba(8,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 };

// ─── Diamond DivIcon factory — colored by project CATEGORY ───────────────────
const ICONS: Record<string, L.DivIcon> = Object.fromEntries(
  Object.entries(CATEGORY_COLOR).map(([type, color]) => [
    type,
    L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:${color};transform:rotate(45deg);border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 10px ${color}90;"></div>`,
      iconSize:   [18, 18] as L.PointExpression,
      iconAnchor: [9,  9]  as L.PointExpression,
      popupAnchor:[0, -12] as L.PointExpression,
    }),
  ]),
);
const DEFAULT_ICON = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#6b7280;transform:rotate(45deg);border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 6px #6b728080;"></div>`,
  iconSize:   [18, 18] as L.PointExpression,
  iconAnchor: [9,  9]  as L.PointExpression,
  popupAnchor:[0, -12] as L.PointExpression,
});
function diamondIcon(type: string): L.DivIcon { return ICONS[type] ?? DEFAULT_ICON; }

function roadStyle(feature?: GeoJSON.Feature): L.PathOptions {
  const surf = (feature?.properties as { surface?: string })?.surface ?? '';
  const s = ROAD_STYLES[surfaceCategory(surf)];
  return { color: s.color, weight: s.weight, opacity: s.opacity, dashArray: s.dashArray };
}

const GLASS: React.CSSProperties = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
};

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

function PanelLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      {text}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NdpivSection() {
  const [data,            setData]            = useState<OprcNdpivData | null>(null);
  const [regionFilter,    setRegionFilter]    = useState('All');
  const [selectedProject, setSelectedProject] = useState<NdpivProject | null>(null);
  const [roadGeo,         setRoadGeo]         = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}road_network.geojson`)
      .then(r => r.json())
      .then(setRoadGeo)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}data/oprc_ndpiv.json`)
      .then(r => r.json())
      .then((d: OprcNdpivData) => setData(d))
      .catch(() => {});
  }, []);

  const regions = useMemo(() =>
    data ? ['All', ...Array.from(new Set(data.ndpiv_projects.map(p => p.region))).sort()] : ['All'],
    [data],
  );
  const projects = useMemo(() =>
    !data ? [] : regionFilter === 'All' ? data.ndpiv_projects : data.ndpiv_projects.filter(p => p.region === regionFilter),
    [data, regionFilter],
  );

  const totalBudget    = useMemo(() => projects.reduce((s, p) => s + p.budget_usd, 0), [projects]);
  const totalDisbursed = useMemo(() => projects.reduce((s, p) => s + p.disbursed_usd, 0), [projects]);
  const avgCompletion  = useMemo(() =>
    projects.length ? Math.round(projects.reduce((s, p) => s + p.completion_pct, 0) / projects.length) : 0,
    [projects],
  );

  // Clustered by category: budget vs disbursed
  const categoryCluster = useMemo(() => {
    const m: Record<string, { budget: number; disbursed: number; count: number }> = {};
    projects.forEach(p => {
      if (!m[p.type]) m[p.type] = { budget: 0, disbursed: 0, count: 0 };
      m[p.type].budget    += p.budget_usd / 1e6;
      m[p.type].disbursed += p.disbursed_usd / 1e6;
      m[p.type].count++;
    });
    return Object.entries(m).map(([type, v]) => ({
      type: type.split(' ')[0], // abbreviate
      fullType: type,
      budget:    Math.round(v.budget),
      disbursed: Math.round(v.disbursed),
      count: v.count,
    }));
  }, [projects]);

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
        <div style={{ textAlign: 'center', fontSize: 12 }}>Loading NDP IV data…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', color: '#e2e8f0' }}>
      <ModuleNavBar module="Projects" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(185,103,255,0.25), rgba(59,130,246,0.2))',
          border: '1px solid rgba(185,103,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BarChart2 size={15} style={{ color: '#b967ff' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em' }}>NDP IV Investments</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            National Development Plan IV · Road Infrastructure Projects
          </div>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <SummaryCard title="NDP IV Projects"    value={String(projects.length)}              sub={`${projects.reduce((s,p)=>s+p.length_km,0).toLocaleString()} km total`} accent="#b967ff" />
        <SummaryCard title="Total Budget"        value={`$${(totalBudget/1e6).toFixed(0)}M`} sub="USD committed"                                                           accent="#00ff88" />
        <SummaryCard title="Avg Completion"      value={`${avgCompletion}%`}                 sub={`$${(totalDisbursed/1e6).toFixed(0)}M disbursed`}                        accent="#3b82f6" />
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

        {/* ── LEFT: legend ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Project Category" />
            {Object.entries(CATEGORY_COLOR).map(([type, c]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, background: c, transform: 'rotate(45deg)', boxShadow: `0 0 5px ${c}70`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{type}</span>
              </div>
            ))}
          </div>

          {/* Clustered bar: budget vs disbursed by category */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Budget vs Disbursed by Category (USD M)" />
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={categoryCluster} margin={{ top: 4, right: 4, left: -18, bottom: 28 }}
                barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="type" tick={{ fill: '#64748b', fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
                <ReTooltip contentStyle={TT_STYLE}
                  formatter={(v: number, name: string) => [`$${v}M`, name]}
                  labelFormatter={(_: unknown, pl: { payload?: { fullType?: string } }[]) => pl[0]?.payload?.fullType ?? ''}
                />
                <Bar dataKey="budget"    name="Budget"    radius={[3,3,0,0]}>
                  {categoryCluster.map(d => <Cell key={d.type} fill={categoryColor(d.fullType)} fillOpacity={0.5} />)}
                </Bar>
                <Bar dataKey="disbursed" name="Disbursed" radius={[3,3,0,0]}>
                  {categoryCluster.map(d => <Cell key={d.type} fill={categoryColor(d.fullType)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── CENTRE: Leaflet map ───────────────────────────────────────────── */}
        <div style={{ ...GLASS, height: 680, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={[1.373, 32.29]} zoom={7} style={{ width: '100%', height: '100%' }} zoomControl>
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels}  />
            <WaterLayers />
            <InfraLayers />
            {roadGeo && <GeoJSON key="roads" data={roadGeo} style={roadStyle} />}

            {projects.map(proj => (
              <Marker key={proj.project_id}
                position={proj.centroid}
                icon={diamondIcon(proj.type)}
                eventHandlers={{ click: () => setSelectedProject(p => p?.project_id === proj.project_id ? null : proj) }}
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

        {/* ── RIGHT: detail + progress + budget table ───────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {selectedProject && (() => {
            const sc = statusColor(selectedProject.status);
            return (
              <div style={{ ...GLASS, padding: 14, borderColor: 'rgba(185,103,255,0.22)' }}>
                <PanelLabel text="NDP IV Project Detail" />
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
              </div>
            );
          })()}

          {/* Progress bars */}
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
