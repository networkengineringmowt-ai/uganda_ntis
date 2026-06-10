import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMap } from 'react-leaflet';
import { createPortal } from 'react-dom';
import L from 'leaflet';

export interface LegendItem {
  color: string;
  label: string;
  dash?: boolean;
  circle?: boolean;
  hollow?: boolean;
}

interface Props {
  title?: string;
  items: LegendItem[];
  position?: 'bottomright' | 'bottomleft' | 'topright' | 'topleft';
}

function LegendContent({ title, items }: { title?: string; items: LegendItem[] }) {
  // Long legends (15+ items, e.g. LEGEND_FULL) collapse to a compact header by
  // default and expand on click — keeps the map clear of clutter while still
  // giving access to the full key. Short legends render fully open, no toggle.
  const collapsible = items.length > 8;
  const [open, setOpen] = useState(!collapsible);

  return (
    <div style={{
      background: 'rgba(8,14,28,0.9)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: collapsible ? '7px 10px' : '10px 12px',
      minWidth: 130,
      maxWidth: 195,
      backdropFilter: 'blur(8px)',
      pointerEvents: 'auto',
      fontFamily: "'Inter','Segoe UI',sans-serif",
      boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
    }}>
      {title && (
        <div
          onClick={collapsible ? () => setOpen(o => !o) : undefined}
          style={{
            fontSize: 9, fontWeight: 900, color: 'rgba(148,163,184,0.6)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: open ? 7 : 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
            cursor: collapsible ? 'pointer' : 'default',
            userSelect: 'none',
          }}
        >
          <span>{title}{collapsible && !open ? ` · ${items.length}` : ''}</span>
          {collapsible && (open
            ? <ChevronUp size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
            : <ChevronDown size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
          )}
        </div>
      )}
      {open && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 5,
          maxHeight: collapsible ? 'min(46vh, 360px)' : 'none',
          overflowY: collapsible ? 'auto' : 'visible',
          paddingRight: collapsible ? 4 : 0,
        }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {item.circle ? (
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: item.hollow ? 'transparent' : item.color,
                  border: `2px solid ${item.color}`,
                  boxSizing: 'border-box',
                }} />
              ) : (
                <div style={{
                  width: 18, height: 3, flexShrink: 0,
                  background: item.dash ? 'transparent' : item.color,
                  borderTop: item.dash ? `2px dashed ${item.color}` : 'none',
                  marginTop: item.dash ? 1 : 0,
                }} />
              )}
              <span style={{ fontSize: 10, color: '#d4dde8', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MapLegend({ title, items, position = 'bottomright' }: Props) {
  const map = useMap();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    class LegendCtrl extends L.Control {
      onAdd() {
        const div = L.DomUtil.create('div', 'map-legend-control');
        L.DomEvent.disableClickPropagation(div);
        setContainer(div);
        return div;
      }
    }
    const ctrl = new LegendCtrl({ position });
    ctrl.addTo(map);
    return () => { ctrl.remove(); };
  }, [map, position]);

  if (!container) return null;
  return createPortal(<LegendContent title={title} items={items} />, container);
}

// ── Pre-built legend item sets (ESRI convention order) ────────────────────────
// ROAD NETWORK LEGEND — by functional class then surface variant
export const LEGEND_ROAD_NETWORK: LegendItem[] = [
  { color: '#00f5ff', label: 'Class A — National Road' },
  { color: '#00ff88', label: 'Class B — National Road' },
  { color: '#f59e0b', label: 'Class C — District Road' },
  { color: '#94a3b8', label: 'Class M — Municipal', dash: true },
  { color: '#C8A84B', label: 'Unpaved / Gravel', dash: true },
];

// BRIDGE & STRUCTURE LEGEND — Point features on map
export const LEGEND_STRUCTURES: LegendItem[] = [
  { color: '#0891b2', label: 'Bridge', circle: true },
  { color: '#f59e0b', label: 'Major Culvert', circle: true },
];

// STRUCTURE CONDITION LEGEND — Color-coded by rating (1=worst, 5=best)
export const LEGEND_STRUCTURE_CONDITION: LegendItem[] = [
  { color: '#ef4444', label: '1 – Poor (Critical)' },
  { color: '#f97316', label: '2 – Bad' },
  { color: '#eab308', label: '3 – Fair' },
  { color: '#84cc16', label: '4 – Good' },
  { color: '#22c55e', label: '5 – Excellent' },
];

// PAVEMENT CONDITION LEGEND — HDM-4 / SATCC TRH17 IRI thresholds
export const LEGEND_CONDITION: LegendItem[] = [
  { color: '#22c55e', label: 'Good   IRI ≤ 3.5 m/km', circle: true },
  { color: '#84cc16', label: 'Fair   IRI 3.5–5.5', circle: true },
  { color: '#eab308', label: 'Poor   IRI 5.5–8.0', circle: true },
  { color: '#f97316', label: 'Bad    IRI 8.0–12.0', circle: true },
  { color: '#ef4444', label: 'Very Bad  IRI > 12.0', circle: true },
];

// TRAFFIC VOLUME LEGEND — AADT (Annual Average Daily Traffic) correct app thresholds
export const LEGEND_TRAFFIC: LegendItem[] = [
  { color: '#00ff88', label: 'AADT < 2,000   Low', circle: true },
  { color: '#ffd23f', label: 'AADT 2k–8k   Medium', circle: true },
  { color: '#ff6b35', label: 'AADT 8k–15k  High', circle: true },
  { color: '#ff2d78', label: 'AADT > 15k   Very High', circle: true },
];

// INFRASTRUCTURE LEGEND — ESRI order: lines → airports → ground transport → maintenance
export const LEGEND_INFRA: LegendItem[] = [
  { color: '#4ade80', label: 'Railway (Operational)', dash: true },
  { color: '#06b6d4', label: 'Ferry Route', dash: true },
  { color: '#60a5fa', label: 'Int\'l Airport', circle: true },
  { color: '#818cf8', label: 'Domestic Airport', circle: true },
  { color: '#f97316', label: 'Weighbridge Station', circle: true },
  { color: '#06b6d4', label: 'Ferry Crossing', circle: true },
  { color: '#eab308', label: 'Maintenance Station', circle: true },
];

// PROJECT STATUS LEGEND — Road project phases
export const LEGEND_PROJECTS: LegendItem[] = [
  { color: '#22c55e', label: 'Completed', circle: true },
  { color: '#3b82f6', label: 'Ongoing', circle: true },
  { color: '#fbbf24', label: 'Planned', circle: true },
  { color: '#f97316', label: 'Stalled', circle: true },
  { color: '#64748b', label: 'Not Started', circle: true },
];

// CONGESTION LEGEND — Traffic congestion levels
export const LEGEND_CONGESTION: LegendItem[] = [
  { color: '#22c55e', label: 'Free Flow', circle: true },
  { color: '#84cc16', label: 'Moderate', circle: true },
  { color: '#fbbf24', label: 'Heavy', circle: true },
  { color: '#ef4444', label: 'Severe', circle: true },
];

// ── ESRI-convention component sets ────────────────────────────────────────────

// 1. Road lines by functional class (colors match app CLASS_COLORS)
export const LEGEND_ROAD_CLASSES: LegendItem[] = [
  { color: '#00f5ff', label: 'Class A — National Road' },
  { color: '#00ff88', label: 'Class B — National Road' },
  { color: '#f59e0b', label: 'Class C — District Road' },
  { color: '#94a3b8', label: 'Class M — Municipal', dash: true },
  { color: '#C8A84B', label: 'Unpaved / Gravel', dash: true },
];

// 2. Transport lines
export const LEGEND_LINES: LegendItem[] = [
  { color: '#4ade80', label: 'Railway (Operational)', dash: true },
  { color: '#475569', label: 'Railway (Non-op)', dash: true },
  { color: '#06b6d4', label: 'Ferry Route', dash: true },
];

// 3. Area features
export const LEGEND_AREAS: LegendItem[] = [
  { color: '#059669', label: 'National Park / Forest Reserve', hollow: true },
  { color: '#94a3b8', label: 'District Boundary', hollow: true },
];

// 4. Points by importance (intl airport → maintenance depot)
export const LEGEND_POINTS_FULL: LegendItem[] = [
  { color: '#60a5fa', label: 'Int\'l Airport', circle: true },
  { color: '#818cf8', label: 'Domestic Airport', circle: true },
  { color: '#94a3b8', label: 'Airfield', circle: true },
  { color: '#f97316', label: 'Weighbridge Station', circle: true },
  { color: '#06b6d4', label: 'Ferry Crossing', circle: true },
  { color: '#eab308', label: 'Maintenance HQ', circle: true },
  { color: '#ca8a04', label: 'Maintenance Station', circle: true },
  { color: '#92400e', label: 'Maintenance Depot', circle: true },
];

// 5. Water features (at bottom — ESRI convention)
export const LEGEND_WATER: LegendItem[] = [
  { color: '#1e3a5f', label: 'Lake / Water Body', hollow: true },
  { color: '#1d4ed8', label: 'River / Stream', dash: true },
];

// LEGEND_FULL — all feature types in ESRI cartographic order for maps with
// roads + InfraLayers + WaterLayers:
//   1. Roads (by class/condition — most important)
//   2. Points of interest (stations, airports, ferries)
//   3. Area features (regions, districts, reserves)
//   4. Linear features (rivers, railways, ferry routes)
//   5. Base reference (scale bar / north arrow rendered separately on the map)
export const LEGEND_FULL: LegendItem[] = [
  ...LEGEND_ROAD_CLASSES,
  ...LEGEND_POINTS_FULL,
  ...LEGEND_AREAS,
  ...LEGEND_LINES,
  ...LEGEND_WATER,
];
