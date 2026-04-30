/**
 * PhotoTwin — Photo gallery + Digital Twin module.
 * Street-view style photo browser linked to the GIS map.
 * Tabs: Photos (street-view) | Digital Twin (SVG schematic) | Timeline (by year)
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Camera, Layers, Calendar, Search, ChevronLeft, ChevronRight,
  Maximize2, X, ZoomIn, Download, Info, RotateCcw, MapPin,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { Structure } from '../../types';
import { conditionColor, conditionLabel, conditionBadge, formatDate } from '../../utils/helpers';
import { usePhotoLoader } from './usePhotoLoader';
import BridgeSchematic from './BridgeSchematic';

type Tab = 'photos' | 'twin' | 'timeline';

export default function PhotoTwin() {
  const { state, dispatch, selectStructure } = useBMS();
  const { structures, selectedStructureId } = state;

  const [query,    setQuery]    = useState('');
  const [activeTab, setTab]     = useState<Tab>('photos');

  // Filter structures to those with photo folders (bridges mostly)
  const filteredStructures = useMemo(() => {
    let list = structures.filter(s => {
      // Has a recognisable ID pattern (B or C series or X-series)
      return /B\d+|C\d+|X\d+/.test(s.id);
    });
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.road.toLowerCase().includes(q),
      );
    }
    // Sort: selected first, then by condition (worst first)
    return list.sort((a, b) => {
      if (a.id === selectedStructureId) return -1;
      if (b.id === selectedStructureId) return 1;
      return a.conditionRating - b.conditionRating;
    });
  }, [structures, query, selectedStructureId]);

  // Auto-select first bridge on load
  useEffect(() => {
    if (!selectedStructureId && filteredStructures.length > 0) {
      const firstBridge = filteredStructures.find(s => s.type === 'bridge') ?? filteredStructures[0];
      selectStructure(firstBridge.id);
    }
  }, [filteredStructures, selectedStructureId, selectStructure]);

  const selected = useMemo(
    () => structures.find(s => s.id === selectedStructureId) ?? null,
    [structures, selectedStructureId],
  );

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      {/* ─── Left: Structure List ─── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900/50">
        {/* Search */}
        <div className="p-3 border-b border-slate-700/60">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs"
              placeholder="Search structures…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 px-1">
            {filteredStructures.length} structures with photos
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredStructures.map(s => (
            <StructureListItem
              key={s.id}
              structure={s}
              isSelected={s.id === selectedStructureId}
              onClick={() => {
                selectStructure(s.id);
                setTab('photos');
              }}
            />
          ))}
        </div>
      </div>

      {/* ─── Right: Main viewer ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2 border-b border-slate-700/60 bg-slate-900/60">
          {([
            { id: 'photos',   label: 'Street View Photos', icon: <Camera size={14} /> },
            { id: 'twin',     label: 'Digital Twin',       icon: <Layers size={14} /> },
            { id: 'timeline', label: 'Timeline by Year',   icon: <Calendar size={14} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors
                ${activeTab === t.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}

          {selected && (
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className={`badge ${conditionBadge(selected.conditionRating)}`}>
                {conditionLabel(selected.conditionRating)}
              </span>
              <span className="text-slate-500 font-mono">{selected.id}</span>
              <button
                onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'gismap' })}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] transition-colors"
                title="Locate on map"
              >
                <MapPin size={10} /> Map
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {!selected ? (
            <EmptyState />
          ) : activeTab === 'photos' ? (
            <PhotosView structure={selected} />
          ) : activeTab === 'twin' ? (
            <TwinView structure={selected} />
          ) : (
            <TimelineView structure={selected} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Structure list item ──────────────────────────────────────────────────────
function StructureListItem({
  structure: s, isSelected, onClick,
}: { structure: Structure; isSelected: boolean; onClick: () => void }) {
  const { photos } = usePhotoLoader(isSelected ? s.id : null); // only load thumb for selected
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b border-slate-700/30 text-left transition-all
        ${isSelected
          ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
          : 'hover:bg-slate-700/40'}`}
    >
      {/* Thumbnail */}
      <div
        className="w-12 h-10 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: conditionColor(s.conditionRating) + '22', border: `1px solid ${conditionColor(s.conditionRating)}44` }}
      >
        {isSelected && photos[0] ? (
          <img src={photos[0].url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <Camera size={16} style={{ color: conditionColor(s.conditionRating) }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-200 truncate">{s.name}</div>
        <div className="text-[10px] text-slate-500 truncate">{s.road}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] font-mono text-blue-400">{s.id}</span>
          {s.inspectionDue && <span className="text-[9px] text-red-400">● DUE</span>}
        </div>
      </div>

      <div
        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black"
        style={{ background: conditionColor(s.conditionRating) + '33', color: conditionColor(s.conditionRating) }}
      >
        {s.conditionRating}
      </div>
    </button>
  );
}

// ─── Photos View — Street View style ─────────────────────────────────────────
function PhotosView({ structure: s }: { structure: Structure }) {
  const { photos, loading, byYear } = usePhotoLoader(s.id);
  const [current,   setCurrent]   = useState(0);
  const [lightbox,  setLightbox]  = useState(false);
  const [yearFilter, setYearFilter] = useState<string | null>(null);

  const displayPhotos = useMemo(() => {
    if (yearFilter && byYear[yearFilter]) return byYear[yearFilter];
    return photos;
  }, [photos, byYear, yearFilter]);

  // Keyboard navigation
  const prev = useCallback(() => setCurrent(c => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent(c => Math.min(displayPhotos.length - 1, c + 1)), [displayPhotos.length]);

  useEffect(() => {
    if (current >= displayPhotos.length) setCurrent(0);
  }, [displayPhotos.length, current]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     setLightbox(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  const currentPhoto = displayPhotos[current];
  const years = Object.keys(byYear).sort();

  if (loading) return <LoadingPhotos structureId={s.id} />;

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Camera size={48} className="text-slate-600" />
        <div className="text-slate-400 text-sm">No photos found for {s.id}</div>
        <div className="text-slate-600 text-xs">
          Expected at: <code className="font-mono text-blue-400">S:\PHOTOS\{s.id.replace('BRG-','').replace('CUL-','')}\</code>
        </div>
        <BridgeSchematic structure={s} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Year filter pills */}
      {years.length > 1 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-slate-900/80 border-b border-slate-700/60 overflow-x-auto">
          <span className="text-[10px] text-slate-500 flex-shrink-0">Inspection year:</span>
          <button
            onClick={() => { setYearFilter(null); setCurrent(0); }}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex-shrink-0 transition-colors
              ${!yearFilter ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
          >
            All ({photos.length})
          </button>
          {years.map(yr => (
            <button
              key={yr}
              onClick={() => { setYearFilter(yr); setCurrent(0); }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold flex-shrink-0 transition-colors
                ${yearFilter === yr ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
            >
              {yr} ({byYear[yr].length})
            </button>
          ))}
        </div>
      )}

      {/* ─── Main photo (street-view hero) ─── */}
      <div className="flex-1 relative bg-black overflow-hidden group min-h-0">
        {currentPhoto && (
          <>
            <img
              key={currentPhoto.url}
              src={currentPhoto.url}
              alt={`${s.name} — ${currentPhoto.year} photo ${currentPhoto.index}`}
              className="w-full h-full object-contain transition-opacity duration-300"
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
            />

            {/* Overlay gradient top */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
            {/* Overlay gradient bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

            {/* Top-left: structure info */}
            <div className="absolute top-3 left-4 flex items-center gap-2">
              <div
                className="px-2 py-1 rounded-lg text-xs font-bold"
                style={{ background: conditionColor(s.conditionRating) + '33', color: conditionColor(s.conditionRating), border: `1px solid ${conditionColor(s.conditionRating)}55` }}
              >
                {s.id}
              </div>
              <div className="px-2 py-1 rounded-lg bg-black/50 text-xs text-white backdrop-blur-sm">
                {s.name}
              </div>
            </div>

            {/* Top-right: year badge + actions */}
            <div className="absolute top-3 right-4 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-blue-600/80 text-white text-xs font-bold backdrop-blur-sm">
                {currentPhoto.year}
              </span>
              <button
                onClick={() => setLightbox(true)}
                className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                title="Fullscreen"
              >
                <Maximize2 size={14} />
              </button>
              <a
                href={currentPhoto.url}
                download={currentPhoto.filename}
                className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                title="Download photo"
              >
                <Download size={14} />
              </a>
            </div>

            {/* Bottom left: photo metadata */}
            <div className="absolute bottom-16 left-4 text-xs text-white/80">
              <div className="flex items-center gap-1.5">
                <Camera size={11} />
                <span>{currentPhoto.filename}</span>
              </div>
              <div className="text-white/50 text-[10px] mt-0.5">{s.road} · KM {s.chainage.toFixed(1)}</div>
            </div>

            {/* Bottom right: counter */}
            <div className="absolute bottom-16 right-4 text-xs text-white/60 font-mono">
              {current + 1} / {displayPhotos.length}
            </div>

            {/* Navigation arrows */}
            <button
              onClick={prev}
              disabled={current === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm disabled:opacity-20 opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={next}
              disabled={current === displayPhotos.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-all backdrop-blur-sm disabled:opacity-20 opacity-0 group-hover:opacity-100"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* ─── Thumbnail strip ─── */}
      <div className="flex-shrink-0 bg-slate-900 border-t border-slate-700/60 p-2 overflow-x-auto">
        <div className="flex gap-2" style={{ width: 'max-content' }}>
          {displayPhotos.map((p, i) => (
            <button
              key={p.url}
              onClick={() => setCurrent(i)}
              className={`relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden transition-all
                ${i === current ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900' : 'opacity-60 hover:opacity-100'}`}
            >
              <img
                src={p.url}
                alt={`thumb ${i + 1}`}
                className="w-full h-full object-cover"
                onError={e => {
                  (e.target as HTMLElement).parentElement!.style.background = '#1e293b';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Year overlay on thumb */}
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-center text-white/70 leading-4">
                {p.year}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ─── Lightbox ─── */
  function Lightbox() {
    if (!lightbox || !currentPhoto) return null;
    return (
      <div
        className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center"
        onClick={() => setLightbox(false)}
      >
        <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setLightbox(false)}>
          <X size={20} />
        </button>
        <img
          src={currentPhoto.url}
          alt={`${s.name} fullscreen`}
          className="max-w-[95vw] max-h-[90vh] object-contain"
          onClick={e => e.stopPropagation()}
        />
        <div className="mt-3 text-white/60 text-xs">{currentPhoto.filename} · {s.name} · {currentPhoto.year}</div>
        <div className="flex gap-4 mt-3">
          <button onClick={e => { e.stopPropagation(); prev(); }} disabled={current === 0} className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span className="px-4 py-2 text-white/50 text-xs">{current + 1}/{displayPhotos.length}</span>
          <button onClick={e => { e.stopPropagation(); next(); }} disabled={current === displayPhotos.length - 1} className="px-4 py-2 rounded-lg bg-white/10 text-white disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        <PhotosView structure={s} />
      </div>
      <Lightbox />
    </>
  );
}

// ─── Digital Twin View ────────────────────────────────────────────────────────
function TwinView({ structure: s }: { structure: Structure }) {
  const { photos, loading } = usePhotoLoader(s.id);
  const heroPhoto = photos[0];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4 animate-slide-up">
      {/* Hero photo + schematic side by side if space allows */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Schematic */}
        <div>
          <BridgeSchematic structure={s} />
        </div>

        {/* Latest photo */}
        <div className="bms-card flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Latest Site Photo</h3>
            {heroPhoto && <span className="badge badge-blue text-[9px]">{heroPhoto.year}</span>}
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center bg-slate-700/30 rounded-lg h-48">
              <RotateCcw size={20} className="text-slate-500 animate-spin" />
            </div>
          ) : heroPhoto ? (
            <img
              src={heroPhoto.url}
              alt={s.name}
              className="w-full h-52 object-cover rounded-lg border border-slate-700"
              onError={e => { (e.target as HTMLElement).style.opacity = '0.2'; }}
            />
          ) : (
            <div className="flex items-center justify-center h-48 bg-slate-700/30 rounded-lg text-slate-500 text-xs">
              <Camera size={24} className="mr-2" /> No photos available
            </div>
          )}

          {/* Quick specs */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <SpecRow label="Year Built"    value={String(s.yearBuilt)} />
            <SpecRow label="Age"           value={`${2024 - s.yearBuilt} yrs`} />
            <SpecRow label="Material"      value={s.material} />
            <SpecRow label="Span"          value={`${s.spanLength} m × ${s.noOfSpans}`} />
            <SpecRow label="Width"         value={`${s.width} m`} />
            <SpecRow label="Crossing"      value={s.crossingType} />
            <SpecRow label="Traffic"       value={s.traffic} />
            <SpecRow label="Priority"      value={`#${s.priorityRank} (${s.priorityScore}/100)`} />
          </div>
        </div>
      </div>

      {/* Condition timeline sparkline */}
      <div className="bms-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-white">Condition History</h3>
          <div className="flex gap-1.5">
            {s.conditionHistory.map(h => (
              <div key={h.year} className="flex flex-col items-center">
                <div
                  className="w-8 rounded-sm transition-all"
                  style={{
                    height: `${h.rating * 8}px`,
                    background: conditionColor(h.rating),
                    opacity: h.year === 2024 ? 1 : 0.7,
                  }}
                />
                <span className="text-[8px] text-slate-500 mt-0.5">{String(h.year).slice(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <Info size={10} /> Current condition:
          <span className="font-bold" style={{ color: conditionColor(s.conditionRating) }}>
            {s.conditionRating}/5 — {conditionLabel(s.conditionRating)}
          </span>
          · Last inspected {formatDate(s.lastInspection)}
        </div>
      </div>

      {/* Photo count info */}
      {!loading && photos.length > 0 && (
        <div className="bms-card p-3 flex items-center gap-3">
          <Camera size={16} className="text-blue-400 flex-shrink-0" />
          <div className="text-xs text-slate-300">
            <strong className="text-white">{photos.length}</strong> inspection photos found across&nbsp;
            <strong className="text-white">{Object.keys(usePhotoYears(s.id)).length}</strong> inspection visits
            · Path: <code className="text-blue-400 font-mono text-[10px]">S:\PHOTOS\{s.id.replace('BRG-','')}\</code>
          </div>
        </div>
      )}
    </div>
  );
}

function usePhotoYears(id: string) {
  const { byYear } = usePhotoLoader(id);
  return byYear;
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({ structure: s }: { structure: Structure }) {
  const { byYear, loading } = usePhotoLoader(s.id);
  const [lightbox, setLightbox] = useState<{ url: string; filename: string } | null>(null);
  const years = Object.keys(byYear).sort();

  if (loading) return <LoadingPhotos structureId={s.id} />;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 animate-slide-up">
      {years.length === 0 && (
        <div className="text-center text-slate-500 py-12 text-sm">
          No photos found for {s.id}
        </div>
      )}

      {years.map(yr => (
        <div key={yr}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-blue-400">{yr}</span>
            </div>
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-[10px] text-slate-500">{byYear[yr].length} photos</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {byYear[yr].map((p, i) => (
              <button
                key={i}
                onClick={() => setLightbox({ url: p.url, filename: p.filename })}
                className="relative aspect-square rounded-lg overflow-hidden bg-slate-700 hover:ring-2 hover:ring-blue-500 transition-all group"
              >
                <img
                  src={p.url}
                  alt={`${yr} #${p.index}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={e => { (e.target as HTMLElement).parentElement!.style.opacity = '0.3'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn size={12} className="text-white" />
                </div>
                <div className="absolute top-1 left-1 text-[8px] text-white/60 font-mono leading-none">
                  {p.index}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox.url}
            alt="full"
            className="max-w-[90vw] max-h-[85vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          <div className="mt-3 text-white/50 text-xs">{lightbox.filename}</div>
        </div>
      )}
    </div>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
function LoadingPhotos({ structureId }: { structureId: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative w-16 h-16">
        <Camera size={32} className="absolute inset-0 m-auto text-blue-400" />
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
      </div>
      <div className="text-sm text-slate-400">Loading photos for {structureId}…</div>
      <div className="text-xs text-slate-600">Scanning <code className="font-mono text-blue-500/60">S:\PHOTOS\{structureId.replace('BRG-','').replace('CUL-','')}\</code></div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Camera size={40} className="text-slate-600" />
      <p className="text-slate-500 text-sm">Select a structure to view photos and digital twin</p>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-medium text-right truncate">{value}</span>
    </div>
  );
}
