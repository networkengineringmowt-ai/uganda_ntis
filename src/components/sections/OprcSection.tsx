import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
  Cell, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS, ROAD_STYLES, surfaceCategory } from '../../shared/mapSymbols';
import { WaterLayers } from '../../shared/WaterLayers';
import { TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OprcLot {
  lot_id: string; name: string; region: string; roads: string[];
  total_km: number; contractor: string; contract_value_usd: number;
  start_date: string; end_date: string; performance_score: number;
  status: string; paved_km: number; unpaved_km: number;
  centroid: [number, number];
}
interface OprcNdpivData { oprc_lots: OprcLot[]; ndpiv_projects: unknown[] }

// ─── Categorical colour maps ──────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  'Active':           '#06b6d4',
  'Completed':        '#22c55e',
  'Defects Liability':'#eab308',
  'Suspended':        '#f97316',
  'Procurement':      '#a855f7',
};
function statusColor(s: string): string { return STATUS_COLOR[s] ?? '#64748b'; }
function perfColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}
function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
const TT_STYLE = { background: 'rgba(8,14,28,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 };

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
export default function OprcSection() {
  const [data,         setData]         = useState<OprcNdpivData | null>(null);
  const [regionFilter, setRegionFilter] = useState('All');
  const [selectedLot,  setSelectedLot]  = useState<OprcLot | null>(null);
  const [roadGeo,      setRoadGeo]      = useState<GeoJSON.FeatureCollection | null>(null);

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
    data ? ['All', ...Array.from(new Set(data.oprc_lots.map(l => l.region))).sort()] : ['All'],
    [data],
  );
  const lots = useMemo(() =>
    !data ? [] : regionFilter === 'All' ? data.oprc_lots : data.oprc_lots.filter(l => l.region === regionFilter),
    [data, regionFilter],
  );

  const totalKm    = useMemo(() => lots.reduce((s, l) => s + l.total_km, 0), [lots]);
  const totalValue = useMemo(() => lots.reduce((s, l) => s + l.contract_value_usd, 0), [lots]);
  const avgScore   = useMemo(() => lots.length ? Math.round(lots.reduce((s, l) => s + l.performance_score, 0) / lots.length) : 0, [lots]);

  // Clustered bar: performance score + km per lot
  const clusterData = useMemo(() => lots.map(l => ({
    name: l.lot_id.replace('OPRC-', ''),
    score: l.performance_score,
    km: Math.round(l.total_km),
    status: l.status,
  })), [lots]);

  // Status-grouped clustered bars: count + km by status
  const statusCluster = useMemo(() => {
    const m: Record<string, { count: number; km: number }> = {};
    lots.forEach(l => {
      if (!m[l.status]) m[l.status] = { count: 0, km: 0 };
      m[l.status].count++;
      m[l.status].km += Math.round(l.total_km);
    });
    return Object.entries(m).map(([status, v]) => ({ status, ...v }));
  }, [lots]);

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
        <div style={{ textAlign: 'center', fontSize: 12 }}>Loading OPRC data…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px', color: '#e2e8f0' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(77,159,255,0.15))',
          border: '1px solid rgba(0,245,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <TrendingUp size={15} style={{ color: '#00f5ff' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.01em' }}>OPRC Contracts</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
            Output &amp; Performance-based Road Contracts · UNRA
          </div>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <SummaryCard title="Active OPRC Lots"     value={String(lots.length)}                sub={`${totalKm.toLocaleString()} km under contract`} accent="#00f5ff" />
        <SummaryCard title="Total Contract Value" value={`$${(totalValue/1e6).toFixed(0)}M`} sub="USD · all active lots"                          accent="#00ff88" />
        <SummaryCard title="Avg Performance"      value={`${avgScore}/100`}                  sub="Weighted across lots"                           accent={perfColor(avgScore)} />
      </div>

      {/* ── Region filter pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {regions.map(r => (
          <button key={r} onClick={() => setRegionFilter(r)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            background: regionFilter === r ? 'rgba(0,245,255,0.12)' : 'transparent',
            border: `1px solid ${regionFilter === r ? 'rgba(0,245,255,0.45)' : 'rgba(255,255,255,0.1)'}`,
            color: regionFilter === r ? '#00f5ff' : '#94a3b8',
            transition: 'all 0.15s',
          }}>{r}</button>
        ))}
      </div>

      {/* ── 3-column layout ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 300px', gap: 12, alignItems: 'start' }}>

        {/* ── LEFT: legend + lot list ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Contract Status" />
            {(Object.entries(STATUS_COLOR) as [string,string][]).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c,
                  boxShadow: `0 0 6px ${c}80`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{s}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Performance</div>
              {(['#22c55e', '#f59e0b', '#ef4444'] as const).map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: '#64748b' }}>{['High ≥85','Med 70–84','Low <70'][i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text={`OPRC Lots (${lots.length})`} />
            {lots.map(lot => {
              const isSel = selectedLot?.lot_id === lot.lot_id;
              const pc    = perfColor(lot.performance_score);
              return (
                <button key={lot.lot_id}
                  onClick={() => setSelectedLot(isSel ? null : lot)}
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
        <div style={{ ...GLASS, height: 680, overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={[1.373, 32.29]} zoom={7} style={{ width: '100%', height: '100%' }} zoomControl>
            <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery} />
            <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels}  />
            <WaterLayers />
            {roadGeo && <GeoJSON key="roads" data={roadGeo} style={roadStyle} />}

            {lots.map(lot => {
              const sc    = statusColor(lot.status);
              const pc    = perfColor(lot.performance_score);
              const isSel = selectedLot?.lot_id === lot.lot_id;
              return (
                <CircleMarker key={lot.lot_id}
                  center={lot.centroid}
                  radius={isSel ? 22 : 18}
                  pathOptions={{ color: sc, fillColor: pc, fillOpacity: isSel ? 0.55 : 0.3, weight: isSel ? 3 : 2 }}
                  eventHandlers={{ click: () => setSelectedLot(l => l?.lot_id === lot.lot_id ? null : lot) }}
                >
                  <Popup>
                    <div style={{ minWidth: 170, fontFamily: 'system-ui,sans-serif' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{lot.name}</div>
                      <div>Status: <b style={{ color: sc }}>{lot.status}</b></div>
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
          </MapContainer>
        </div>

        {/* ── RIGHT: detail + charts ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {selectedLot && (() => {
            const pc = perfColor(selectedLot.performance_score);
            return (
              <div style={{ ...GLASS, padding: 14, borderColor: 'rgba(0,245,255,0.22)' }}>
                <PanelLabel text="OPRC Lot Detail" />
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
              </div>
            );
          })()}

          {/* Clustered: Score + km per lot */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Performance Score & Network km — by OPRC Lot" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={clusterData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                <YAxis yAxisId="score" domain={[0,100]} tick={{ fontSize: 8, fill: '#64748b' }} />
                <YAxis yAxisId="km" orientation="right" tick={{ fontSize: 8, fill: '#64748b' }} />
                <ReTooltip contentStyle={TT_STYLE}
                  formatter={(v: number, name: string) => [name === 'score' ? `${v}/100` : `${v} km`, name === 'score' ? 'Score' : 'Network km']} />
                <Legend iconSize={7} wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} />
                <Bar yAxisId="score" dataKey="score" name="Perf Score" radius={[3,3,0,0]} maxBarSize={18}>
                  {clusterData.map((d, i) => <Cell key={i} fill={perfColor(lots[i]?.performance_score ?? 0)} />)}
                </Bar>
                <Bar yAxisId="km" dataKey="km" name="Network km" fill="rgba(0,245,255,0.45)" radius={[3,3,0,0]} maxBarSize={18}>
                  {clusterData.map((d, i) => <Cell key={i} fill={statusColor(d.status)} opacity={0.65} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clustered: Lot count + km by contract status */}
          <div style={{ ...GLASS, padding: 14 }}>
            <PanelLabel text="Lots & Network km by Contract Status" />
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={statusCluster} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="status" tick={{ fontSize: 8, fill: '#64748b' }} tickFormatter={(s:string) => s.split(' ')[0]} />
                <YAxis yAxisId="cnt" tick={{ fontSize: 8, fill: '#64748b' }} />
                <YAxis yAxisId="km" orientation="right" tick={{ fontSize: 8, fill: '#64748b' }} />
                <ReTooltip contentStyle={TT_STYLE}
                  formatter={(v: number, name: string) => [name === 'count' ? `${v} lots` : `${v} km`, name === 'count' ? 'Lots' : 'Total km']} />
                <Legend iconSize={7} wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} />
                <Bar yAxisId="cnt" dataKey="count" name="Lots" radius={[3,3,0,0]} maxBarSize={20}>
                  {statusCluster.map((d, i) => <Cell key={i} fill={statusColor(d.status)} />)}
                </Bar>
                <Bar yAxisId="km" dataKey="km" name="km" radius={[3,3,0,0]} maxBarSize={20}>
                  {statusCluster.map((d, i) => <Cell key={i} fill={statusColor(d.status)} opacity={0.5} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
