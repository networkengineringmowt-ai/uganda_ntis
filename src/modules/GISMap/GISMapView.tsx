import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import {
  MapContainer, TileLayer, Marker, Tooltip,
  ZoomControl, GeoJSON, useMap,
} from 'react-leaflet';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Play, Pause, SkipBack, Layers, Info, Camera, X,
  ChevronLeft, ChevronRight, ExternalLink, Clock, Download,
} from 'lucide-react';
import { downloadGeoJSON, downloadKML, downloadShapefileZip } from '../../utils/downloads';
import { useBMS } from '../../store/BMSContext';
import type { Structure, ActiveView } from '../../types';
import {
  conditionColor, conditionLabel, conditionBadge,
  formatDate, formatUGX, CONDITION_COLORS,
} from '../../utils/helpers';
import { usePhotoLoader } from '../PhotoTwin/usePhotoLoader';

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
const CENTER: [number, number] = [1.373, 32.29];
type LayerFilter = 'all' | 'bridge' | 'culvert';

// ── Bold road symbology by surface & class ───────────────────────────────────
const ROAD_SURFACE_COLORS: Record<string, string> = {
  Bituminous: '#ef4444',   // Bold red — paved/tarmac
  Unsealed:   '#f59e0b',   // Warm amber — gravel/earth
};
const ROAD_CLASS_WEIGHTS: Record<string, number> = { A: 3.5, B: 2.5, C: 1.8, M: 3 };

type DisplayStructure = Structure & { displayRating: number };

// (Infrastructure layers — ferries, airports, weighbridges, ports — are shown on the Road Network Map)

// ── Icon helpers ──────────────────────────────────────────────────────────────
const iconCache = new Map<string, L.DivIcon>();

/** Map zoom level → icon pixel size (scales naturally with zoom). */
function getIconSize(zoom: number): number {
  return Math.max(12, Math.min(36, Math.round(6 + zoom * 1.5)));
  // z6→15 z7→16 z8→18 z10→21 z12→24 z14→27 z16→30
}

/**
 * Arch bridge silhouette — arch rib over deck with hangers.
 * Same base size for all bridges at a given zoom; critical adds a dashed ring.
 */
function makeBridgeIcon(critical: boolean, sz: number): L.DivIcon {
  const key = `bridge|${sz}|${critical}`;
  if (iconCache.has(key)) return iconCache.get(key)!;
  const id = `bf${sz}${critical ? 'c' : ''}`;
  const html = `<svg viewBox="0 0 32 32" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <defs>
      <filter id="${id}sh"><feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#0369a1" flood-opacity="0.75"/></filter>
    </defs>
    <rect x="1" y="18" width="4" height="8" rx="0.5" fill="#075985"/>
    <rect x="27" y="18" width="4" height="8" rx="0.5" fill="#075985"/>
    <path d="M 3,18 Q 16,5 29,18" fill="none" stroke="#22d3ee" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="10" y1="11" x2="10" y2="18" stroke="#67e8f9" stroke-width="1" opacity="0.75"/>
    <line x1="16" y1="7" x2="16" y2="18" stroke="#67e8f9" stroke-width="1.3" opacity="0.9"/>
    <line x1="22" y1="11" x2="22" y2="18" stroke="#67e8f9" stroke-width="1" opacity="0.75"/>
    <rect x="1" y="17" width="30" height="5" rx="1.5" fill="#0891b2" stroke="#67e8f9" stroke-width="1.2" filter="url(#${id}sh)"/>
    <rect x="4" y="17.8" width="24" height="1.5" rx="0.5" fill="rgba(255,255,255,0.3)"/>
    ${critical ? `<circle cx="16" cy="18" r="19" fill="none" stroke="#ff2d78" stroke-width="2" stroke-dasharray="5 3" opacity="0.9"/>` : ''}
  </svg>`;
  const icon = L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
  iconCache.set(key, icon);
  return icon;
}

/**
 * Culvert pipe cross-section — concentric rings showing barrel opening.
 * Same base size for all culverts at a given zoom; critical adds a dashed ring.
 */
function makeCulvertIcon(critical: boolean, sz: number): L.DivIcon {
  const key = `culvert|${sz}|${critical}`;
  if (iconCache.has(key)) return iconCache.get(key)!;
  const html = `<svg viewBox="0 0 24 24" width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;display:block">
    <circle cx="12" cy="12" r="11" fill="#b45309" stroke="#fef3c7" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="7.5" fill="#92400e"/>
    <circle cx="12" cy="12" r="5.5" fill="#0c0601"/>
    <ellipse cx="12" cy="15.5" rx="3.5" ry="1.5" fill="#1e40af" opacity="0.55"/>
    <ellipse cx="9.5" cy="9" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.22)" transform="rotate(-30,9.5,9)"/>
    ${critical ? `<circle cx="12" cy="12" r="14" fill="none" stroke="#ff2d78" stroke-width="2" stroke-dasharray="5 3" opacity="0.9"/>` : ''}
  </svg>`;
  const icon = L.divIcon({ className: '', html, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] });
  iconCache.set(key, icon);
  return icon;
}


// ── Zoom tracker — child component inside MapContainer ────────────────────────
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onZoom(map.getZoom());
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map, onZoom]);
  return null;
}

// ─── Main map view ────────────────────────────────────────────────────────────
export default function GISMapView() {
  const { state } = useBMS();
  const { structures } = state;

  const [activeYear,  setActiveYear]  = useState(2024);
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [condFilter,  setCondFilter]  = useState<number[]>([1, 2, 3, 4, 5]);
  const [selected,    setSelected]    = useState<DisplayStructure | null>(null);
  const [roadGeo,     setRoadGeo]     = useState<GeoJSON.FeatureCollection | null>(null);
  const [zoom,        setZoom]        = useState(7);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleZoom  = useCallback((z: number) => setZoom(z), []);

  // Load road network GeoJSON
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}road_network.geojson`)
      .then(r => r.json())
      .then(setRoadGeo)
      .catch(() => {});
  }, []);

  const roadStyle = useCallback((feature?: GeoJSON.Feature): L.PathOptions => {
    const surf   = (feature?.properties as { surface?: string })?.surface ?? 'Unsealed';
    const cls    = (feature?.properties as { road_class?: string })?.road_class ?? 'C';
    const paved  = surf === 'Bituminous';
    const weight = ROAD_CLASS_WEIGHTS[cls] ?? 1.5;
    return {
      color:     ROAD_SURFACE_COLORS[surf] ?? '#64748b',
      weight,
      opacity:   paved ? 0.82 : 0.65,
      dashArray: paved ? undefined : '5 5',
    };
  }, []);

  // Time-series animation
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setActiveYear(prev => {
          const next = prev + 1;
          if (next > 2024) { setIsPlaying(false); return 2024; }
          return next;
        });
      }, 900);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying]);

  function handlePlay() {
    if (activeYear === 2024) setActiveYear(2018);
    setIsPlaying(p => !p);
  }

  const displayStructures = useMemo<DisplayStructure[]>(() =>
    structures
      .filter(s => layerFilter === 'all' || s.type === layerFilter)
      .map(s => {
        const hist = s.conditionHistory.find(h => h.year === activeYear);
        return { ...s, displayRating: (hist?.rating ?? s.conditionRating) as number };
      })
      .filter(s => condFilter.includes(s.displayRating)),
    [structures, activeYear, layerFilter, condFilter],
  );

  const yearStats = useMemo(() => {
    const cnt: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    displayStructures.forEach(s => cnt[s.displayRating]++);
    return cnt;
  }, [displayStructures]);

  function toggleCond(r: number) {
    setCondFilter(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">

      {/* ── Map canvas ── */}
      <MapContainer
        center={CENTER} zoom={7}
        style={{ flex: 1, height: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <ZoomTracker onZoom={handleZoom} />

        <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
        <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
        {roadGeo && (
          <GeoJSON
            data={roadGeo as GeoJSON.GeoJsonObject}
            style={(f: unknown) => roadStyle(f as GeoJSON.Feature)}
          />
        )}

        {/* ── Structures — type-based 3D icons (condition only in filter/panel) ── */}
        {displayStructures.map(s => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={s.type === 'bridge' ? makeBridgeIcon(s.displayRating <= 2, getIconSize(zoom)) : makeCulvertIcon(s.displayRating <= 2, getIconSize(zoom))}
            eventHandlers={{ click: () => setSelected(s) }}
            zIndexOffset={s.displayRating <= 2 ? 1000 : s.type === 'bridge' ? 500 : 0}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#111827', marginBottom: 2 }}>{s.name}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#374151' }}>
                {s.type === 'bridge' ? '⬤ Bridge' : '◆ Major Culvert'} · {s.road}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', marginTop: 1 }}>
                {s.region} · Built {s.yearBuilt} · {s.spanLength * s.noOfSpans}m
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, marginTop: 3,
                padding: '2px 6px', borderRadius: 4, display: 'inline-block',
                background: s.displayRating <= 2 ? '#fee2e2' : s.displayRating === 3 ? '#fef3c7' : '#dcfce7',
                color: s.displayRating <= 2 ? '#dc2626' : s.displayRating === 3 ? '#d97706' : '#16a34a' }}>
                Rating {s.displayRating} — {conditionLabel(s.displayRating)}
              </div>
            </Tooltip>
          </Marker>
        ))}

      </MapContainer>

      {/* ── Left control panel ── */}
      <div className="absolute top-4 left-4 z-[1000] space-y-3 max-w-[250px]">

        {/* Title card */}
        <div className="bg-slate-900/92 backdrop-blur border border-slate-700 rounded-xl px-4 py-3">
          <div className="text-xs font-bold text-white">Bridges & Major Culverts</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{displayStructures.length} structures shown</div>
        </div>

        {/* Layer filter */}
        <div className="bg-slate-900/92 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={11} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Layer</span>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'bridge', 'culvert'] as LayerFilter[]).map(f => (
              <button key={f} onClick={() => setLayerFilter(f)}
                className={`text-[10px] px-2 py-1 rounded font-semibold capitalize transition-colors ${
                  layerFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}>
                {f === 'all' ? 'All' : f === 'bridge' ? '● Bridges' : '◆ Culverts'}
              </button>
            ))}
          </div>
        </div>

        {/* Condition filter */}
        <div className="bg-slate-900/92 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Condition Filter</div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map(r => (
              <button key={r} onClick={() => toggleCond(r)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left ${
                  condFilter.includes(r) ? 'bg-slate-700' : 'bg-transparent opacity-35'
                }`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CONDITION_COLORS[r] }} />
                <span className="text-[10px] text-slate-300 flex-1">{r} – {conditionLabel(r)}</span>
                <span className="text-[10px] text-slate-500">{yearStats[r] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Symbol legend */}
        <div className="bg-slate-900/92 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Symbol Key</div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 32 32" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="18" width="4" height="8" rx="0.5" fill="#075985"/><rect x="27" y="18" width="4" height="8" rx="0.5" fill="#075985"/><path d="M 3,18 Q 16,5 29,18" fill="none" stroke="#22d3ee" strokeWidth="2.8" strokeLinecap="round"/><line x1="10" y1="11" x2="10" y2="18" stroke="#67e8f9" strokeWidth="1" opacity="0.75"/><line x1="16" y1="7" x2="16" y2="18" stroke="#67e8f9" strokeWidth="1.3" opacity="0.9"/><line x1="22" y1="11" x2="22" y2="18" stroke="#67e8f9" strokeWidth="1" opacity="0.75"/><rect x="1" y="17" width="30" height="5" rx="1.5" fill="#0891b2" stroke="#67e8f9" strokeWidth="1.2"/></svg>
              <span className="text-[10px] text-slate-300">Bridge (arch silhouette)</span>
            </div>
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#b45309" stroke="#fef3c7" strokeWidth="1.2"/><circle cx="12" cy="12" r="7.5" fill="#92400e"/><circle cx="12" cy="12" r="5.5" fill="#0c0601"/><ellipse cx="12" cy="15.5" rx="3.5" ry="1.5" fill="#1e40af" opacity="0.55"/><ellipse cx="9.5" cy="9" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.22)" transform="rotate(-30,9.5,9)"/></svg>
              <span className="text-[10px] text-slate-300">Major Culvert (pipe section)</span>
            </div>
            <div className="border-t border-slate-700 pt-1.5 mt-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-1.5 rounded" style={{background:'#ef4444'}}/>
                <span className="text-[9px] text-slate-400">Paved road (solid · bold)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-1.5 rounded" style={{background:'#f59e0b', backgroundImage:'repeating-linear-gradient(90deg,#f59e0b,#f59e0b 4px,transparent 4px,transparent 7px)'}}/>
                <span className="text-[9px] text-slate-400">Unpaved road (dashed)</span>
              </div>
            </div>
            <div className="text-[9px] text-slate-600 pt-0.5">Icon size scales with zoom · Critical = red dashed ring</div>
          </div>
        </div>

        {/* Year stats */}
        <div className="bg-slate-900/92 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Info size={10} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status {activeYear}</span>
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map(r => {
              const count = yearStats[r] || 0;
              const total = displayStructures.length || 1;
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 w-14 truncate">{conditionLabel(r)}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div className="rounded-full h-1.5 transition-all duration-500"
                      style={{ width: `${(count / total) * 100}%`, background: CONDITION_COLORS[r] }} />
                  </div>
                  <span className="text-[9px] text-slate-400 w-5 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Time series player ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]"
        style={{ left: selected ? 'calc(50% - 190px)' : '50%', transition: 'left 0.3s ease' }}>
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl px-5 py-4 shadow-2xl min-w-[480px]">
          <div className="text-center mb-3">
            <span className="text-3xl font-black text-white tracking-wide">{activeYear}</span>
            <div className="text-[10px] text-slate-400 mt-0.5">Condition Snapshot</div>
          </div>
          <div className="relative mb-3">
            <div className="flex justify-between mb-1">
              {YEARS.map(y => (
                <button key={y} onClick={() => { setIsPlaying(false); setActiveYear(y); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all ${
                    y === activeYear ? 'text-white font-bold bg-blue-600' : 'text-slate-500 hover:text-slate-300'
                  }`}>{y}</button>
              ))}
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-2 bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${((activeYear - 2018) / 6) * 100}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => { setIsPlaying(false); setActiveYear(2018); }}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
              <SkipBack size={14} />
            </button>
            <button onClick={handlePlay}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors">
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {isPlaying ? 'Pause' : 'Play 2018–2024'}
            </button>
            <div className="text-[10px] text-slate-500">
              {isPlaying
                ? <span className="text-blue-400 animate-pulse">● ANIMATING</span>
                : <span>Click a marker to inspect</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Top-right download toolbar ── */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5">
        {[
          { label: 'GeoJSON', fn: () => downloadGeoJSON(displayStructures, 'structures_filtered.geojson'), color: '#00f5ff' },
          { label: 'KML',     fn: () => downloadKML(displayStructures, 'structures_filtered.kml'),         color: '#00ff88' },
          { label: 'SHP ZIP', fn: () => downloadShapefileZip('all'),                                        color: '#b967ff' },
        ].map(({ label, fn, color }) => (
          <button
            key={label}
            onClick={fn}
            title={`Download ${label}`}
            className="flex items-center gap-1.5 bg-slate-900/92 backdrop-blur border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors"
            style={{ color }}
          >
            <Download size={10} style={{ color }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Structure detail panel ── */}
      {selected && (
        <StructurePanel
          structure={selected}
          year={activeYear}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── Structure detail panel ───────────────────────────────────────────────────
const StructurePanel = memo(function StructurePanel({
  structure: s,
  year,
  onClose,
}: {
  structure: DisplayStructure;
  year: number;
  onClose: () => void;
}) {
  const { dispatch, selectStructure, state } = useBMS();
  const [tab, setTab] = useState<'details' | 'photos'>('details');
  const { photos, loading: photosLoading, byYear } = usePhotoLoader(s.id);

  // Photo viewer state
  const [photoIdx, setPhotoIdx]     = useState(0);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [lightbox, setLightbox]     = useState(false);

  const visiblePhotos = useMemo(() =>
    yearFilter ? (byYear[yearFilter] ?? []) : photos,
    [photos, byYear, yearFilter],
  );
  const currentPhoto = visiblePhotos[photoIdx] ?? null;
  const availYears   = Object.keys(byYear).sort();

  // Reset on structure change
  useEffect(() => { setPhotoIdx(0); setYearFilter(null); setTab('details'); }, [s.id]);
  // Clamp index
  useEffect(() => {
    if (photoIdx >= visiblePhotos.length && visiblePhotos.length > 0) setPhotoIdx(0);
  }, [visiblePhotos.length, photoIdx]);

  function prev() { setPhotoIdx(i => (i - 1 + visiblePhotos.length) % visiblePhotos.length); }
  function next() { setPhotoIdx(i => (i + 1) % visiblePhotos.length); }

  function openPhotoTwin() {
    selectStructure(s.id);
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'phototwin' as ActiveView });
  }
  function openRegistry() {
    selectStructure(s.id);
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'registry' as ActiveView });
  }

  const condColor = conditionColor(s.displayRating);
  const typeColor = s.type === 'bridge' ? '#0891b2' : '#f59e0b';
  const isBridge = s.type === 'bridge';
  const ageYrs = new Date().getFullYear() - s.yearBuilt;

  return (
    <>
      {/* Slide-in panel */}
      <div className="absolute top-0 right-0 bottom-0 z-[1001] w-[400px] flex flex-col
                      bg-slate-900 border-l border-slate-700 shadow-2xl
                      animate-slide-in-right overflow-hidden">

        {/* ── Panel header ── */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700"
          style={{ borderTop: `3px solid ${typeColor}` }}>
          <div className="flex items-start gap-3">
            {/* 3D type icon */}
            <div className="mt-0.5 flex-shrink-0">
              {isBridge
                ? <svg viewBox="0 0 32 32" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="18" width="4" height="8" rx="0.5" fill="#075985"/><rect x="27" y="18" width="4" height="8" rx="0.5" fill="#075985"/><path d="M 3,18 Q 16,5 29,18" fill="none" stroke="#22d3ee" strokeWidth="2.8" strokeLinecap="round"/><line x1="10" y1="11" x2="10" y2="18" stroke="#67e8f9" strokeWidth="1" opacity="0.75"/><line x1="16" y1="7" x2="16" y2="18" stroke="#67e8f9" strokeWidth="1.3" opacity="0.9"/><line x1="22" y1="11" x2="22" y2="18" stroke="#67e8f9" strokeWidth="1" opacity="0.75"/><rect x="1" y="17" width="30" height="5" rx="1.5" fill="#0891b2" stroke="#67e8f9" strokeWidth="1.2"/></svg>
                : <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#b45309" stroke="#fef3c7" strokeWidth="1.2"/><circle cx="12" cy="12" r="7.5" fill="#92400e"/><circle cx="12" cy="12" r="5.5" fill="#0c0601"/><ellipse cx="12" cy="15.5" rx="3.5" ry="1.5" fill="#1e40af" opacity="0.55"/><ellipse cx="9.5" cy="9" rx="2.5" ry="1.5" fill="rgba(255,255,255,0.22)" transform="rotate(-30,9.5,9)"/></svg>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white leading-tight truncate">{s.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {s.id} · {isBridge ? 'Bridge' : 'Major Culvert'} · {s.road}
              </div>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Condition strip */}
          <div className="mt-3 flex items-center gap-3">
            <span className={`badge ${conditionBadge(s.displayRating)} text-[10px]`}>
              {s.displayRating} – {conditionLabel(s.displayRating)}
            </span>
            {s.inspectionDue && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 font-semibold">
                <Clock size={9} /> Inspection overdue
              </span>
            )}
            <span className="ml-auto text-[10px] text-slate-500">Priority #{s.priorityRank}</span>
          </div>

          {/* Condition bar */}
          <div className="mt-2 bg-slate-700 rounded-full h-1.5">
            <div className="rounded-full h-1.5 transition-all"
              style={{ width: `${((s.displayRating - 1) / 4) * 100}%`, background: condColor }} />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex-shrink-0 flex border-b border-slate-700">
          {(['details', 'photos'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t === 'details' ? '📋 All Attributes' : `📷 Photos ${photos.length > 0 ? `(${photos.length})` : photosLoading ? '…' : ''}`}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── DETAILS TAB ── */}
          {tab === 'details' && (
            <div className="p-4 space-y-4">

              {/* Condition history */}
              <Section title="Condition History (2018–2024)">
                <div className="flex items-end gap-1 h-12">
                  {YEARS.map(yr => {
                    const hist = s.conditionHistory.find(h => h.year === yr);
                    const r = hist?.rating ?? s.conditionRating;
                    const h = `${((r / 5) * 100)}%`;
                    return (
                      <div key={yr} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full rounded-sm transition-all"
                          style={{ height: h, background: conditionColor(r as 1|2|3|4|5), opacity: yr === year ? 1 : 0.65 }} />
                        <span className="text-[8px] text-slate-600">{yr.toString().slice(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Location & network */}
              <Section title="Location & Network">
                <Grid>
                  <Field l="Road" v={s.road} />
                  <Field l="Road No." v={s.roadNumber || '—'} />
                  <Field l="Region" v={s.region} />
                  <Field l="Chainage" v={`${s.chainage.toFixed(1)} km`} />
                  <Field l="Maint. Area" v={s.maintenanceArea || '—'} />
                  <Field l="River / Crossing" v={s.river || s.crossingType} />
                  <Field l="Lat / Lng" v={`${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`} span />
                </Grid>
              </Section>

              {/* Physical properties */}
              <Section title="Physical Properties">
                <Grid>
                  <Field l="Type" v={isBridge ? 'Bridge' : 'Major Culvert'} />
                  <Field l="Year Built" v={`${s.yearBuilt} (${ageYrs} yrs)`} />
                  <Field l="Material" v={s.material} />
                  <Field l="Surface" v={s.surfaceType} />
                  <Field l="Total Length" v={`${(s.spanLength * s.noOfSpans).toFixed(0)} m`} />
                  <Field l="Span Length" v={`${s.spanLength} m`} />
                  <Field l="No. of Spans" v={String(s.noOfSpans)} />
                  <Field l="No. of Piers" v={String(s.noOfPiers)} />
                  <Field l="Width" v={`${s.width} m`} />
                  <Field l="No. of Lanes" v={String(s.noOfLanes)} />
                  <Field l="Crossing Type" v={s.crossingType} />
                </Grid>
              </Section>

              {/* Inspection */}
              <Section title="Inspection Status">
                <Grid>
                  <Field l="Last Inspection" v={formatDate(s.lastInspection)} />
                  <Field l="Next Inspection" v={formatDate(s.nextInspection)} />
                  <Field l="Status" v={s.inspectionDue ? '⚠ Overdue' : '✓ Current'} highlight={s.inspectionDue ? 'amber' : 'green'} />
                  <Field l="Overall Rating" v={`${s.conditionRating} – ${conditionLabel(s.conditionRating)}`} highlight={s.conditionRating <= 2 ? 'red' : undefined} />
                </Grid>
                {s.defects.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-slate-500 mb-1.5">Recorded defects</div>
                    <div className="flex flex-wrap gap-1">
                      {s.defects.map((d, i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-300 border border-red-800/50">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* Risk & priority */}
              <Section title="Risk & Priority">
                <Grid>
                  <Field l="Traffic Level" v={s.traffic} />
                  <Field l="Strategic Imp." v={`${s.strategicImportance} / 5`} />
                  <Field l="Priority Score" v={`${s.priorityScore} / 100`} highlight={s.priorityScore >= 75 ? 'red' : s.priorityScore >= 50 ? 'amber' : undefined} />
                  <Field l="Priority Rank" v={`#${s.priorityRank} of ${state.structures.length}`} />
                </Grid>
                {/* Priority score bar */}
                <div className="mt-2 bg-slate-700 rounded-full h-2">
                  <div className="rounded-full h-2 transition-all"
                    style={{
                      width: `${s.priorityScore}%`,
                      background: s.priorityScore >= 75 ? '#ef4444' : s.priorityScore >= 50 ? '#f59e0b' : '#3b82f6',
                    }} />
                </div>
              </Section>

              {/* Finance */}
              <Section title="Finance">
                <Grid>
                  <Field l="Est. Replacement" v={formatUGX(s.estimatedReplacementCost)} span />
                  {s.maintenanceCostHistory.slice(-3).map(({ year: yr, cost }) => (
                    <Field key={yr} l={`Cost ${yr}`} v={formatUGX(cost)} />
                  ))}
                </Grid>
              </Section>

              {/* Notes */}
              {s.notes && (
                <Section title="Notes">
                  <p className="text-[10px] text-slate-400 leading-relaxed">{s.notes}</p>
                </Section>
              )}
            </div>
          )}

          {/* ── PHOTOS TAB ── */}
          {tab === 'photos' && (
            <div className="flex flex-col h-full">
              {photosLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                  <span className="text-xs">Scanning photo archive…</span>
                </div>
              ) : photos.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 p-6 text-center">
                  <Camera size={32} className="opacity-30" />
                  <div className="text-sm font-semibold text-slate-500">No photos found</div>
                  <div className="text-[10px]">No survey photos are archived for {s.name}</div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Year filter pills */}
                  <div className="flex-shrink-0 flex gap-1.5 px-3 pt-3 pb-2 overflow-x-auto">
                    <button
                      onClick={() => { setYearFilter(null); setPhotoIdx(0); }}
                      className={`text-[9px] px-2 py-1 rounded-full font-semibold flex-shrink-0 transition-colors ${
                        !yearFilter ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                      }`}>
                      All ({photos.length})
                    </button>
                    {availYears.map(yr => (
                      <button key={yr}
                        onClick={() => { setYearFilter(yr); setPhotoIdx(0); }}
                        className={`text-[9px] px-2 py-1 rounded-full font-semibold flex-shrink-0 transition-colors ${
                          yearFilter === yr ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
                        }`}>
                        {yr} ({byYear[yr]?.length ?? 0})
                      </button>
                    ))}
                  </div>

                  {/* Hero photo */}
                  <div className="flex-shrink-0 relative mx-3 rounded-lg overflow-hidden bg-slate-800"
                    style={{ aspectRatio: '4/3' }}>
                    {currentPhoto ? (
                      <>
                        <img
                          src={currentPhoto.url}
                          alt={currentPhoto.filename}
                          className="w-full h-full object-cover cursor-zoom-in"
                          onClick={() => setLightbox(true)}
                        />
                        {/* Nav arrows */}
                        {visiblePhotos.length > 1 && (
                          <>
                            <button onClick={prev}
                              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
                              <ChevronLeft size={16} />
                            </button>
                            <button onClick={next}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
                              <ChevronRight size={16} />
                            </button>
                          </>
                        )}
                        {/* Caption overlay */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                          <div className="text-[10px] font-semibold text-white">{currentPhoto.filename}</div>
                          <div className="text-[9px] text-slate-300">
                            {currentPhoto.year} · Photo {photoIdx + 1} of {visiblePhotos.length}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-600 text-xs">No image</div>
                    )}
                  </div>

                  {/* Thumbnail strip */}
                  <div className="flex-1 overflow-y-auto px-3 py-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      {visiblePhotos.map((p, i) => (
                        <button key={p.url} onClick={() => setPhotoIdx(i)}
                          className={`relative rounded overflow-hidden bg-slate-800 transition-all ${
                            i === photoIdx ? 'ring-2 ring-blue-500' : 'opacity-60 hover:opacity-100'
                          }`}
                          style={{ aspectRatio: '1' }}>
                          <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 text-[7px] text-center text-white bg-black/50 py-0.5">{p.year}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panel footer ── */}
        <div className="flex-shrink-0 border-t border-slate-700 p-3 flex gap-2">
          <button onClick={openPhotoTwin}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                       bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors">
            <Camera size={13} /> Full Photo Twin
          </button>
          <button onClick={openRegistry}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold
                       bg-slate-700/60 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors">
            <ExternalLink size={13} /> Open in Registry
          </button>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && currentPhoto && (
        <div className="absolute inset-0 z-[2000] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={20} />
          </button>
          <img src={currentPhoto.url} alt={currentPhoto.filename}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <div className="text-sm font-semibold text-white">{s.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{currentPhoto.filename} · {currentPhoto.year}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); prev(); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <ChevronLeft size={24} />
          </button>
          <button onClick={e => { e.stopPropagation(); next(); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
            <ChevronRight size={24} />
          </button>
        </div>
      )}
    </>
  );
});

// ─── Panel sub-components ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
        <span className="flex-1 border-t border-slate-700/60" />
        {title}
        <span className="flex-1 border-t border-slate-700/60" />
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>;
}

function Field({
  l, v, span, highlight,
}: {
  l: string;
  v: string;
  span?: boolean;
  highlight?: 'red' | 'amber' | 'green';
}) {
  const vc = highlight === 'red' ? 'text-red-400'
    : highlight === 'amber'      ? 'text-amber-400'
    : highlight === 'green'      ? 'text-green-400'
    : 'text-slate-200';
  return (
    <div className={span ? 'col-span-2' : ''}>
      <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wide">{l}</div>
      <div className={`text-[11px] font-semibold mt-0.5 ${vc}`}>{v || '—'}</div>
    </div>
  );
}

