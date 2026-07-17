import { useEffect, useState, useMemo } from 'react';
import { GeoJSON, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import { INFRA_SYMBOLS } from './mapSymbols';

interface GeoJSONData {
  type: string;
  features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
}

// ── Module-level singleton cache ───────────────────────────────────────────────
let _ferryRoutes: GeoJSONData | null = null;
let _ferryPoints: GeoJSONData | null = null;
let _weighbridges: GeoJSONData | null = null;
let _airports: GeoJSONData | null = null;
let _airfields: GeoJSONData | null = null;
let _railExisting: GeoJSONData | null = null;
let _railProposed: GeoJSONData | null = null;
let _maintenance: GeoJSONData | null = null;
let _infraPromise: Promise<void> | null = null;

function loadInfraData(): Promise<void> {
  if (_infraPromise) return _infraPromise;
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL;
  _infraPromise = Promise.all([
    fetch(`${base}data/ferryroutes.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/ferry.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/new_weigh_bridges.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/airports.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/ug_airfields.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/rail_existing.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/rail_proposed_ea_sg_plan.geojson`).then(r => r.json()).catch(() => null),
    fetch(`${base}data/maintenance_stations.geojson`).then(r => r.json()).catch(() => null),
  ]).then(([ferryRoutes, ferryPoints, weighbridges, airports, airfields, railExisting, railProposed, maintenance]) => {
    _ferryRoutes  = ferryRoutes;
    _ferryPoints  = ferryPoints;
    _weighbridges = weighbridges;
    _airports     = airports;
    _airfields    = airfields;
    _railExisting = railExisting;
    _railProposed = railProposed;
    _maintenance  = maintenance;
  });
  return _infraPromise;
}

function useInfraLayers() {
  const allLoaded = _ferryRoutes !== null && _railExisting !== null;
  const [ready, setReady] = useState(allLoaded);
  useEffect(() => {
    if (ready) return;
    loadInfraData().then(() => setReady(true));
  }, [ready]);
  return {
    ferryRoutes: _ferryRoutes,
    ferryPoints: _ferryPoints,
    weighbridges: _weighbridges,
    airports: _airports,
    airfields: _airfields,
    railExisting: _railExisting,
    railProposed: _railProposed,
    maintenance: _maintenance,
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const FERRY_STYLE = INFRA_SYMBOLS.ferryLine as PathOptions;

function railExistingStyle(f: GeoJSONData['features'][number]): PathOptions {
  const status = String(f.properties.status ?? '');
  if (status === 'Operational') return INFRA_SYMBOLS.railOperational as PathOptions;
  return INFRA_SYMBOLS.railNonOp as PathOptions;
}

const RAIL_PROPOSED_STYLE = INFRA_SYMBOLS.railProposed as PathOptions;

// ── Uganda bounding box validator ──────────────────────────────────────────────
function inUganda(lon: number, lat: number): boolean {
  return lon >= 29.5 && lon <= 35.1 && lat >= -1.55 && lat <= 4.3;
}

// ── Zoom-aware sizing ──────────────────────────────────────────────────────────
function iconSizeForZoom(zoom: number): number {
  if (zoom > 12) return 12;
  if (zoom >= 11) return 10;
  if (zoom >= 8)  return 7;
  return 4;
}

// Simple solid circle — used at zoom < 10 for performance
function makeSimpleCircle(size: number, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1px solid rgba(255,255,255,0.4);box-sizing:border-box;"></div>`,
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor:[0, -(size / 2 + 2)] as L.PointExpression,
  });
}

// ── SVG DivIcon factories ──────────────────────────────────────────────────────
function makePlaneIcon(size: number, bg: string, glow: string, emoji = '✈'): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.55)}px;filter:drop-shadow(0 0 4px ${glow});line-height:1;border:1.5px solid rgba(255,255,255,0.35);">${emoji}</div>`,
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor:[0, -(size / 2 + 4)] as L.PointExpression,
  });
}

function makeScaleIcon(size: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(249,115,22,0.85);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.55)}px;filter:drop-shadow(0 0 4px rgba(249,115,22,0.6));line-height:1;border:1.5px solid rgba(255,255,255,0.35);">⚖</div>`,
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor:[0, -(size / 2 + 4)] as L.PointExpression,
  });
}

function makeBoatIcon(size: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(6,182,212,0.85);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.55)}px;filter:drop-shadow(0 0 4px rgba(6,182,212,0.6));line-height:1;border:1.5px solid rgba(255,255,255,0.35);">⛴</div>`,
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor:[0, -(size / 2 + 4)] as L.PointExpression,
  });
}

function makeWrenchIcon(size: number): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(234,179,8,0.85);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.55)}px;filter:drop-shadow(0 0 4px rgba(234,179,8,0.5));line-height:1;border:1.5px solid rgba(255,255,255,0.35);">🔧</div>`,
    iconSize:   [size, size] as L.PointExpression,
    iconAnchor: [size / 2, size / 2] as L.PointExpression,
    popupAnchor:[0, -(size / 2 + 4)] as L.PointExpression,
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export function InfraLayers() {
  const { ferryRoutes, ferryPoints, weighbridges, airports, airfields, railExisting, railProposed, maintenance } = useInfraLayers();

  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const icons = useMemo(() => {
    const sz = iconSizeForZoom(zoom);
    const simple = zoom < 10;
    return {
      airportIntl:     simple ? makeSimpleCircle(sz, '#60a5fa') : makePlaneIcon(sz, 'rgba(30,58,138,0.9)',  '#60a5fa'),
      airportDomestic: simple ? makeSimpleCircle(sz, '#818cf8') : makePlaneIcon(sz, 'rgba(67,56,202,0.85)', '#818cf8'),
      airfield:        simple ? makeSimpleCircle(sz, '#94a3b8') : makePlaneIcon(sz, 'rgba(51,65,85,0.8)',   '#94a3b8'),
      weighbridge:     simple ? makeSimpleCircle(sz, '#f97316') : makeScaleIcon(sz),
      ferry:           simple ? makeSimpleCircle(sz, '#06b6d4') : makeBoatIcon(sz),
      maintHQ:         simple ? makeSimpleCircle(sz, '#eab308') : makeWrenchIcon(sz),
      maintStation:    simple ? makeSimpleCircle(sz, '#ca8a04') : makeWrenchIcon(sz),
      maintDepot:      simple ? makeSimpleCircle(sz, '#92400e') : makeWrenchIcon(sz),
    };
  }, [zoom]);

  return (
    <>
      {/* ── Railways (very pale — decorative only) ── */}
      {railExisting && (
        <GeoJSON
          key="il-rail-existing"
          data={railExisting as never}
          style={f => railExistingStyle(f as GeoJSONData['features'][number])}
        />
      )}
      {railProposed && (
        <GeoJSON
          key="il-rail-proposed"
          data={railProposed as never}
          style={() => RAIL_PROPOSED_STYLE}
        />
      )}

      {/* ── Ferry routes (line) ── */}
      {ferryRoutes && (
        <GeoJSON
          key="il-ferry-routes"
          data={ferryRoutes as never}
          style={() => FERRY_STYLE}
        />
      )}

      {/* ── Ferry crossing points ── */}
      {ferryPoints?.features.map((f, i) => {
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        if (!inUganda(coords[0], coords[1])) return null;
        return (
          <Marker
            key={`ferry-pt-${zoom}-${i}`}
            position={[coords[1], coords[0]]}
            icon={icons.ferry}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12 }}>
                <strong>⛴ {String(p.ferry_cros ?? p.remarks ?? 'Ferry')}</strong>
                {p.water_body && <div style={{ color: '#64748b' }}>{String(p.water_body)}</div>}
                {p.remarks && p.remarks !== p.ferry_cros && (
                  <div style={{ color: '#64748b' }}>{String(p.remarks)}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* ── Weighbridges ── */}
      {weighbridges?.features.map((f, i) => {
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        if (!coords || coords.length < 2) return null;
        if (!inUganda(coords[0], coords[1])) return null;
        const wbType = String(p.type ?? '');
        return (
          <Marker
            key={`wb-${zoom}-${i}`}
            position={[coords[1], coords[0]]}
            icon={icons.weighbridge}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12, color: '#1e293b' }}>
                <strong>⚖ {String(p.eng_name ?? 'Weighbridge')}</strong>
                <div style={{ color: '#64748b' }}>{wbType}</div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* ── Airports ── */}
      {airports?.features.map((f, i) => {
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        if (!inUganda(coords[0], coords[1])) return null;
        const cls = String(p.class ?? '');
        const isIntl = cls.toLowerCase().includes('international');
        return (
          <Marker
            key={`airport-${zoom}-${i}`}
            position={[coords[1], coords[0]]}
            icon={isIntl ? icons.airportIntl : icons.airportDomestic}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12, color: '#1e293b' }}>
                <strong>✈ {String(p.name ?? p.town ?? 'Airport')}</strong>
                <div style={{ color: '#64748b' }}>{cls}</div>
                {p.country && <div style={{ color: '#64748b' }}>{String(p.country)}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* ── Airfields ── */}
      {airfields?.features.map((f, i) => {
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        if (!inUganda(coords[0], coords[1])) return null;
        return (
          <Marker
            key={`airfield-${zoom}-${i}`}
            position={[coords[1], coords[0]]}
            icon={icons.airfield}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12, color: '#1e293b' }}>
                <strong>✈ {String(p.f9 ?? p.AIRPNAME ?? 'Airfield')}</strong>
                {p.category && <div style={{ color: '#64748b' }}>{String(p.category)}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* ── Maintenance Stations ── */}
      {maintenance?.features.map((f, i) => {
        const p = f.properties;
        const coords = f.geometry.coordinates as [number, number];
        if (!inUganda(coords[0], coords[1])) return null;
        const stationType = String(p.type ?? '');
        const icon = stationType === 'Regional HQ'
          ? icons.maintHQ
          : stationType === 'Station'
          ? icons.maintStation
          : icons.maintDepot;
        return (
          <Marker
            key={`maint-${zoom}-${i}`}
            position={[coords[1], coords[0]]}
            icon={icon}
          >
            <Popup>
              <div style={{ fontFamily: "'Inter','Segoe UI',sans-serif", fontSize: 12, color: '#1e293b' }}>
                <strong>🔧 {String(p.name ?? 'Maintenance Station')}</strong>
                <div style={{ color: '#64748b' }}>{String(p.region ?? '')} · {stationType}</div>
                {p.district && <div style={{ color: '#94a3b8', fontSize: 11 }}>{String(p.district)}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
