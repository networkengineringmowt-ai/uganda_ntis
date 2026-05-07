/**
 * ImagesSection — BMS inspection photo gallery
 * Grid of bridge/culvert inspection photographs from field surveys.
 * Probes /s-photos/ (Vite dev middleware serving S:\PHOTOS on internal network).
 * Falls back to condition-coloured placeholder when server is unavailable.
 *
 * Real photo source: KKATT Consultants 2018-19 survey
 * Bridges with confirmed photos: B001, B026-B116 selected, B158-B161
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Camera, Search, X, Download, ChevronLeft, ChevronRight, ImageOff,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { hexRgb } from '../../lib/chart3d';
import { conditionColor, conditionLabel } from '../../utils/helpers';
import { usePhotoLoader } from '../../modules/PhotoTwin/usePhotoLoader';
import type { Structure } from '../../types';

// Bridge folders confirmed to have 2018-19 KKATT inspection photos
const KNOWN_PHOTO_FOLDERS = new Set([
  'B001',
  'B026','B027','B028','B029','B030',
  'B042',
  'B050','B051','B052','B053','B054','B055','B056','B057',
  'B060',
  'B094','B095','B096','B098','B099',
  'B100','B101','B102','B103','B104','B105','B106','B107','B108','B109',
  'B112','B113','B114','B115','B116',
  'B158','B159','B160','B161',
]);

function folderFromId(id: string): string | null {
  const m = id.match(/^(?:BRG|CUL)-(.+)$/);
  if (m) return m[1];
  if (/^[A-Z]/.test(id)) return id;
  return null;
}

// Lightweight single-thumbnail probe — tries 4 common filenames, no full scan
function useThumbnail(folder: string | null): { url: string | null; ready: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!folder) { setReady(true); return; }
    let resolved = false;
    let done = 0;
    const candidates = [
      `/s-photos/${folder}/${folder}_18_01.JPG`,
      `/s-photos/${folder}/${folder}_18_01.jpg`,
      `/s-photos/${folder}/${folder}_08_01.JPG`,
      `/s-photos/${folder}/${folder}_08_01.jpg`,
    ];
    const imgs: HTMLImageElement[] = [];
    candidates.forEach(src => {
      const img = new Image();
      imgs.push(img);
      img.onload = () => { if (!resolved) { resolved = true; setUrl(src); setReady(true); } };
      img.onerror = () => { done++; if (done === candidates.length && !resolved) setReady(true); };
      img.src = src;
    });
    return () => { resolved = true; imgs.forEach(i => { i.src = ''; }); };
  }, [folder]);

  return { url, ready };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ImagesSection() {
  const { state } = useBMS();
  const { structures } = state;

  const [search,       setSearch]       = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [lightboxStr,  setLightboxStr]  = useState<Structure | null>(null);

  const regions = useMemo(
    () => [...new Set(structures.map(s => s.region).filter(Boolean))].sort(),
    [structures],
  );

  const filtered = useMemo(() => {
    let list = structures.filter(s => {
      if (filterType   && s.type    !== filterType)   return false;
      if (filterRegion && s.region  !== filterRegion) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.road.toLowerCase().includes(q) ||
          (s.region ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
    // known-photos first, then worst condition first
    return list.sort((a, b) => {
      const aHas = KNOWN_PHOTO_FOLDERS.has(folderFromId(a.id) ?? '');
      const bHas = KNOWN_PHOTO_FOLDERS.has(folderFromId(b.id) ?? '');
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.conditionRating - b.conditionRating;
    });
  }, [structures, search, filterRegion, filterType]);

  const knownPhotoCount = useMemo(
    () => structures.filter(s => KNOWN_PHOTO_FOLDERS.has(folderFromId(s.id) ?? '')).length,
    [structures],
  );

  const clearFilters = () => { setSearch(''); setFilterRegion(''); setFilterType(''); };
  const hasFilters   = search || filterRegion || filterType;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-slate-900/80 border-b border-slate-700/60 px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Camera size={20} style={{ color: '#00f5ff' }} />
              Inspection Photo Gallery
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {knownPhotoCount} structures with confirmed photos · KKATT 2018–19 field survey
            </p>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Structures', value: structures.length },
              { label: 'With photos', value: knownPhotoCount },
              { label: 'Survey', value: '2018–19' },
            ].map(s => (
              <div key={s.label} className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center">
                <div className="text-sm font-black text-white">{s.value}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="bms-input pl-9 py-1.5 text-xs w-full"
              placeholder="Search name, ID, road…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="bms-input py-1.5 text-xs" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            <option value="bridge">Bridges</option>
            <option value="culvert">Culverts</option>
          </select>
          <select className="bms-input py-1.5 text-xs" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
            <option value="">All regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-700/60 hover:bg-slate-600/60 transition-colors"
            >
              <X size={11} /> Clear
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">{filtered.length} shown</span>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
            <ImageOff size={40} />
            <p className="text-sm">No structures match the current filters</p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}
          >
            {filtered.map(s => (
              <PhotoCard
                key={s.id}
                structure={s}
                hasPhoto={KNOWN_PHOTO_FOLDERS.has(folderFromId(s.id) ?? '')}
                onClick={() => setLightboxStr(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxStr && (
        <Lightbox structure={lightboxStr} onClose={() => setLightboxStr(null)} />
      )}
    </div>
  );
}

// ─── Photo card ───────────────────────────────────────────────────────────────

function PhotoCard({
  structure: s, hasPhoto, onClick,
}: { structure: Structure; hasPhoto: boolean; onClick: () => void }) {
  const folder = folderFromId(s.id);
  const { url: thumb, ready } = useThumbnail(hasPhoto ? folder : null);
  const accent = conditionColor(s.conditionRating);

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid rgba(${hexRgb(accent)}, 0.18)`,
        background: 'rgba(15,23,42,0.85)',
      }}
    >
      {/* Thumbnail */}
      <div className="relative w-full overflow-hidden" style={{ height: 136 }}>
        {!ready && hasPhoto ? (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: `rgba(${hexRgb(accent)},0.05)` }}>
            <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
          </div>
        ) : thumb ? (
          <img
            src={thumb}
            alt={s.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: `rgba(${hexRgb(accent)},0.04)` }}
          >
            <Camera size={26} style={{ color: accent, opacity: 0.4 }} />
            {!hasPhoto && <span className="text-[9px] text-slate-600 uppercase tracking-wider">On request</span>}
          </div>
        )}

        {/* Condition badge */}
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-black"
          style={{
            background: `rgba(${hexRgb(accent)},0.2)`,
            border: `1px solid rgba(${hexRgb(accent)},0.45)`,
            color: accent,
          }}
        >
          {s.conditionRating}/5
        </div>

        {hasPhoto && (
          <div
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-bold"
            style={{ background: 'rgba(0,245,255,0.12)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.25)' }}
          >
            PHOTO
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
            View
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="px-2.5 py-2">
        <div className="font-bold text-xs text-white truncate">{s.name}</div>
        <div className="text-[10px] text-slate-500 truncate mt-0.5">{s.road}</div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] font-mono text-blue-400">{s.id}</span>
          <span className="text-[9px] text-slate-600">{s.region}</span>
        </div>
        <div className="text-[9px] text-slate-600 mt-0.5">
          KM {s.chainage.toFixed(1)} · {conditionLabel(s.conditionRating)}
        </div>
      </div>
    </button>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ structure: s, onClose }: { structure: Structure; onClose: () => void }) {
  const { photos, loading } = usePhotoLoader(s.id);
  const [current, setCurrent] = useState(0);
  const accent = conditionColor(s.conditionRating);

  const prev = () => setCurrent(c => Math.max(0, c - 1));
  const next = () => setCurrent(c => Math.min(photos.length - 1, c + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photos.length, onClose]);

  const photo = photos[current] ?? null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/96 flex flex-col" onClick={onClose}>

      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
        style={{ background: 'rgba(2,5,8,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="px-2 py-1 rounded text-xs font-bold flex-shrink-0"
          style={{ background: `rgba(${hexRgb(accent)},0.15)`, color: accent }}
        >
          {s.id}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{s.name}</div>
          <div className="text-[10px] text-slate-500">{s.road} · KM {s.chainage.toFixed(1)}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {photo && (
            <a
              href={photo.url}
              download={photo.filename}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-700 hover:bg-slate-600 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Download size={12} /> Download
            </a>
          )}
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center min-h-0 relative"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-slate-500">
            <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
            <span className="text-sm">Loading photos…</span>
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-slate-500 text-center px-8">
            <Camera size={48} className="opacity-30" />
            <div className="text-sm">No photos found for {s.id}</div>
            <div className="text-xs text-slate-600">
              Photos are served from the internal network (S:\PHOTOS\{folderFromId(s.id) ?? s.id}\)
            </div>
          </div>
        ) : photo ? (
          <img
            key={photo.url}
            src={photo.url}
            alt={`${s.name} — ${photo.year}`}
            className="max-w-[90vw] max-h-[72vh] object-contain"
          />
        ) : null}

        {/* Prev / Next */}
        {photos.length > 1 && (
          <>
            <button
              disabled={current === 0}
              onClick={e => { e.stopPropagation(); prev(); }}
              className="absolute left-4 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              disabled={current === photos.length - 1}
              onClick={e => { e.stopPropagation(); next(); }}
              className="absolute right-4 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center disabled:opacity-20 transition-colors"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {/* Footer: counter + thumbnail strip */}
      {photos.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 overflow-x-auto"
          style={{ background: 'rgba(2,5,8,0.92)', backdropFilter: 'blur(8px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          onClick={e => e.stopPropagation()}
        >
          <span className="text-xs text-slate-500 flex-shrink-0 font-mono">{current + 1} / {photos.length}</span>
          <div className="flex gap-1.5">
            {photos.map((p, i) => (
              <button
                key={p.url}
                onClick={() => setCurrent(i)}
                className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden transition-all ${i === current ? 'ring-2 ring-blue-500' : 'opacity-40 hover:opacity-90'}`}
              >
                <img src={p.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          {photo && (
            <span className="ml-auto text-[9px] text-slate-600 flex-shrink-0 font-mono">
              {s.id} · {photo.year}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

