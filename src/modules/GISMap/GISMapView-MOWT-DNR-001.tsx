import { useState, useEffect, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, CircleMarker, Popup,
  ZoomControl,
} from 'react-leaflet';
import { WaterLayers } from '../../shared/WaterLayers';
import { ESRI_TILE_URLS, ESRI_ATTRIBUTIONS } from '../../shared/mapSymbols';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, SkipBack, Layers, Info, Camera, ExternalLink } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Structure, ActiveView } from '../../types';
import { conditionColor, conditionLabel, conditionBadge, formatDate } from '../../utils/helpers';
import { CONDITION_COLORS } from '../../utils/helpers';

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
const CENTER: [number, number] = [1.373, 32.29];

type LayerFilter = 'all' | 'bridge' | 'culvert';

export default function GISMapView() {
  const { state } = useBMS();
  const { structures } = state;

  // Time series state
  const [activeYear,    setActiveYear]    = useState(2024);
  const [isPlaying,     setIsPlaying]     = useState(false);
  const [layerFilter,   setLayerFilter]   = useState<LayerFilter>('all');
  const [condFilter,    setCondFilter]    = useState<number[]>([1, 2, 3, 4, 5]);
  const [popup,         setPopup]         = useState<Structure | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate through years
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
    if (activeYear === 2024) { setActiveYear(2018); }
    setIsPlaying(p => !p);
  }

  // Derive condition at selected year
  const displayStructures = useMemo(() => {
    return structures
      .filter(s => layerFilter === 'all' || s.type === layerFilter)
      .map(s => {
        const hist = s.conditionHistory.find(h => h.year === activeYear);
        const rating = hist?.rating ?? s.conditionRating;
        return { ...s, displayRating: rating };
      })
      .filter(s => condFilter.includes(s.displayRating));
  }, [structures, activeYear, layerFilter, condFilter]);

  // Stats for the year
  const yearStats = useMemo(() => {
    const byCond: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    displayStructures.forEach(s => byCond[s.displayRating]++);
    return byCond;
  }, [displayStructures]);

  function toggleCond(r: number) {
    setCondFilter(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r],
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Map */}
      <MapContainer
        center={CENTER}
        zoom={7}
        style={{ flex: 1, height: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />

        <TileLayer url={ESRI_TILE_URLS.imagery} attribution={ESRI_ATTRIBUTIONS.imagery}/>
        <TileLayer url={ESRI_TILE_URLS.labels}  attribution={ESRI_ATTRIBUTIONS.labels} opacity={0.7}/>
        <WaterLayers />

        {/* Markers */}
        {displayStructures.map(s => (
          <CircleMarker
            key={`${s.id}-${activeYear}`}
            center={[s.lat, s.lng]}
            radius={s.type === 'bridge' ? 7 : 5}
            pathOptions={{
              color:       conditionColor(s.displayRating),
              fillColor:   conditionColor(s.displayRating),
              fillOpacity: 0.85,
              weight:      s.displayRating <= 2 ? 2.5 : 1.5,
            }}
            eventHandlers={{ click: () => setPopup(s) }}
          >
            <Popup maxWidth={320} className="bms-popup">
              <StructurePopup structure={s} year={activeYear} />
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* ─── Left control panel ─── */}
      <div className="absolute top-4 left-4 z-[1000] space-y-3 max-w-[260px]">
        {/* Title */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-4 py-3">
          <div className="text-xs font-bold text-white">Uganda Bridge Network</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{displayStructures.length} structures shown</div>
        </div>

        {/* Layer filter */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Layer Filter</span>
          </div>
          <div className="flex gap-1.5">
            {(['all', 'bridge', 'culvert'] as LayerFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setLayerFilter(f)}
                className={`text-[10px] px-2.5 py-1 rounded-md font-semibold capitalize transition-colors
                  ${layerFilter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
              >{f === 'all' ? 'All' : f === 'bridge' ? 'Bridges' : 'Culverts'}</button>
            ))}
          </div>
        </div>

        {/* Condition legend + filter */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Condition Filter</div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map(r => (
              <button
                key={r}
                onClick={() => toggleCond(r)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all text-left
                  ${condFilter.includes(r)
                    ? 'bg-slate-700'
                    : 'bg-transparent opacity-40'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CONDITION_COLORS[r] }} />
                <span className="text-[10px] text-slate-300 flex-1">
                  {r} – {conditionLabel(r)}
                </span>
                <span className="text-[10px] text-slate-500">{yearStats[r] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Year stats */}
        <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl p-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <Info size={10} className="inline mr-1" />Network Status {activeYear}
          </div>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map(r => {
              const count = yearStats[r] || 0;
              const total = displayStructures.length || 1;
              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 w-16 truncate">{conditionLabel(r)}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-1">
                    <div
                      className="rounded-full h-1 transition-all duration-500"
                      style={{ width: `${(count / total) * 100}%`, background: CONDITION_COLORS[r] }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Time series player ─── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-slate-900/95 backdrop-blur border border-slate-700 rounded-2xl px-5 py-4 shadow-2xl min-w-[520px]">
          {/* Year display */}
          <div className="text-center mb-3">
            <span className="text-3xl font-black text-white tracking-wide">{activeYear}</span>
            <div className="text-[10px] text-slate-400 mt-0.5">Condition Snapshot</div>
          </div>

          {/* Timeline scrubber */}
          <div className="relative mb-3">
            <div className="flex justify-between mb-1">
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => { setIsPlaying(false); setActiveYear(y); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all ${
                    y === activeYear
                      ? 'text-white font-bold bg-blue-600'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >{y}</button>
              ))}
            </div>
            <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${((activeYear - 2018) / (2024 - 2018)) * 100}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => { setIsPlaying(false); setActiveYear(2018); }}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              <SkipBack size={14} />
            </button>

            <button
              onClick={handlePlay}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {isPlaying ? 'Pause' : 'Play Animation'}
            </button>

            <div className="text-[10px] text-slate-500 text-center">
              {isPlaying && <span className="text-blue-400 animate-pulse">● ANIMATING</span>}
              {!isPlaying && <span>Click Play to animate 2018–2024</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Popup content ────────────────────────────────────────────────────────────
function StructurePopup({ structure: s, year }: { structure: Structure & { displayRating: number }; year: number }) {
  const { dispatch, selectStructure } = useBMS();

  function openPhotoTwin() {
    selectStructure(s.id);
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'phototwin' as ActiveView });
  }

  function openRegistry() {
    selectStructure(s.id);
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'registry' as ActiveView });
  }

  return (
    <div className="p-4 min-w-[280px]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-sm text-white leading-tight">{s.name}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{s.id} · {s.type}</div>
        </div>
        <span className={`badge ${conditionBadge(s.displayRating)} flex-shrink-0`}>
          {s.displayRating} – {conditionLabel(s.displayRating)}
        </span>
      </div>

      {/* Condition bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>Condition {year}</span>
          <span style={{ color: conditionColor(s.displayRating) }}>{conditionLabel(s.displayRating)}</span>
        </div>
        <div className="bg-slate-700 rounded-full h-2">
          <div
            className="rounded-full h-2 transition-all"
            style={{
              width:      `${((s.displayRating - 1) / 4) * 100}%`,
              background: conditionColor(s.displayRating),
            }}
          />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
        <PopField label="Road"       value={s.road} />
        <PopField label="Region"     value={s.region} />
        <PopField label="Chainage"   value={`${s.chainage.toFixed(1)} km`} />
        <PopField label="Year Built" value={String(s.yearBuilt)} />
        <PopField label="Span"       value={`${s.spanLength} m`} />
        <PopField label="Lanes"      value={String(s.noOfLanes)} />
        <PopField label="Material"   value={s.material} />
        <PopField label="Traffic"    value={s.traffic} />
        <PopField label="Last Insp." value={formatDate(s.lastInspection)} />
        <PopField label="Priority"   value={`#${s.priorityRank} (${s.priorityScore}/100)`} />
      </div>

      {/* River */}
      {s.river && (
        <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-700 pt-2">
          Crosses: <span className="text-slate-300">{s.river}</span>
        </div>
      )}

      {/* Coords */}
      <div className="mt-2 text-[10px] text-slate-600 font-mono">
        {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
      </div>

      {/* ─── Action buttons ─── */}
      <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
        <button
          onClick={openPhotoTwin}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold
                     bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 transition-colors"
        >
          <Camera size={12} /> Photos &amp; Twin
        </button>
        <button
          onClick={openRegistry}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold
                     bg-slate-700/60 hover:bg-slate-600 text-slate-300 border border-slate-600 transition-colors"
        >
          <ExternalLink size={12} /> Details
        </button>
      </div>
    </div>
  );
}

function PopField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-300 font-medium truncate">{value}</div>
    </div>
  );
}
