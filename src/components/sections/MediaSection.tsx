/**
 * MediaAndDocumentGallery — Unified media showcase and document archive.
 * 1. Hero carousel (5 slides, 5s auto-rotate, crossfade)
 * 2. Curated photo story sections (hover zoom, lightbox)
 * 3. Bridge inspection portfolio strip
 * 4. Interactive media library (manifest-driven grid, filter by type & category)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { hexRgb } from '../../lib/chart3d';

const BASE = import.meta.env.BASE_URL;

// ─── Curated photo content ────────────────────────────────────────────────────
interface Slide  { src: string; title: string; caption: string }
interface StoryImage { src: string; caption: string; alt: string }
interface StorySection { id: string; title: string; subtitle: string; color: string; images: StoryImage[] }

const HERO_SLIDES: Slide[] = [
  { src: 'media/kampala_flyover.png',
    title: 'Kampala Flyover — Urban Road Infrastructure',
    caption: 'Grade-separated interchange reducing congestion · Class M motorway network, Kampala' },
  { src: 'media/northern_bypass.png',
    title: 'Northern Bypass — Kampala Ring Road',
    caption: 'M3 outer ring road · Bwaise–Kyebando corridor · 17.5 km dual carriageway' },
  { src: 'media/kee_aerial2.png',
    title: 'Kampala Eastern Expressway — Aerial View',
    caption: 'Planned KEE alignment photographed during feasibility study · Eastern corridor' },
  { src: 'media/bridges/bridge_b001_1.jpg',
    title: 'Victoria Nile Bridge — Owen Falls, Jinja',
    caption: 'Bridge B001 · Strategic A1 trunk road crossing · Jinja maintenance region' },
  { src: 'media/roads/road_y_A001N1_LINK01_0.jpg',
    title: 'A1 Highway — Kampala–Jinja Corridor',
    caption: "Uganda's highest-volume road link · 30,909 AADT · ROMDAS pavement survey 2025" },
];

const STORIES: StorySection[] = [
  {
    id: 'network', color: '#00f5ff',
    title: 'National Road Network',
    subtitle: "21,160 km (mapped) of paved and unpaved roads connecting Uganda's regions — surveyed with ROMDAS technology",
    images: [
      { src: 'media/roads/road_y_A001_LINK07_0.jpg', alt: 'A1 northern',
        caption: 'A1 Trunk Road — Northern Segment · ROMDAS pavement rating survey' },
      { src: 'media/roads/road_y_A002_LINK05_0.jpg', alt: 'A2 Malaba',
        caption: 'A2 Highway — Tororo-Malaba Border Corridor · Class A trunk road' },
      { src: 'media/roads/road_y_M3LINK01_LHS_0.jpg', alt: 'M3 bypass',
        caption: 'M3 Northern Bypass — Left-hand survey strip · Kampala outer ring' },
    ],
  },
  {
    id: 'bridges', color: '#00ff88',
    title: 'Bridge Infrastructure',
    subtitle: '1,019 registered structures under Bridge Management System monitoring — inspected to NBI standards',
    images: [
      { src: 'media/bridges/bridge_b001_2.jpg', alt: 'B001 inspection',
        caption: 'B001 Victoria Nile Bridge — Load inspection, Jinja maintenance area' },
      { src: 'media/bridges/bridge_b100_1.jpg', alt: 'B100 Northern',
        caption: 'B100 Bridge — Northern Corridor structural assessment 2025' },
      { src: 'media/bridges/bridge_b050_1.jpg', alt: 'B050 Eastern',
        caption: 'B050 Bridge — Eastern region infrastructure connectivity' },
    ],
  },
  {
    id: 'surveys', color: '#ffd23f',
    title: 'Monitoring & Surveys',
    subtitle: 'ROMDAS pavement condition surveys and manual traffic count programmes across the network',
    images: [
      { src: 'media/gallery/romdas.jpg', alt: 'ROMDAS vehicle',
        caption: 'ROMDAS Survey Vehicle — Automated Pavement Condition Rating System' },
      { src: 'media/gallery/TC_00008.jpg', alt: 'Traffic count Kampala',
        caption: 'Manual Traffic Count — Central Region node · ATC baseline survey' },
      { src: 'media/gallery/TC_00009.jpg', alt: 'Traffic count Northern',
        caption: 'ATC Station Monitoring — Northern Region survey deployment' },
    ],
  },
  {
    id: 'performance', color: '#b967ff',
    title: 'Annual Performance',
    subtitle: 'Network performance monitoring imagery from annual DNR/Department of National Roads assessment programmes',
    images: [
      { src: 'media/gallery/TC_00010.jpg', alt: 'Annual survey',
        caption: 'Traffic Survey 2025 — Annual Network Assessment Programme' },
      { src: 'media/bridges/bridge_b001_3.jpg', alt: 'Bridge condition',
        caption: 'Structural Integrity Assessment — Bridge B001 condition survey' },
      { src: 'media/roads/road_y_A007_LINK04_0.jpg', alt: 'A7 Western',
        caption: 'A7 Road Link — Western Region pavement survey 2025' },
    ],
  },
];

const BRIDGE_STRIP = [
  'media/bridges/bridge_b001_1.jpg',
  'media/bridges/bridge_b050_1.jpg',
  'media/bridges/bridge_b100_1.jpg',
  'media/bridges/bridge_b037_1.jpg',
  'media/bridges/bridge_b039_1.jpg',
  'media/bridges/bridge_b040_1.jpg',
];

const ACCENT_RGB: Record<string, string> = {
  '#00f5ff': '0,245,255', '#00ff88': '0,255,136',
  '#ffd23f': '255,210,63', '#b967ff': '185,103,255',
};
function accentRgb(col: string) { return ACCENT_RGB[col] ?? '148,163,184'; }

// ─── Story lightbox ───────────────────────────────────────────────────────────
function StoryLightbox({ images, startIdx, onClose }: { images: StoryImage[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx);
  const nav = useCallback((d: number) => setIdx(i => (i + d + images.length) % images.length), [images.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  nav(-1);
      if (e.key === 'ArrowRight') nav(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, nav]);
  const item = images[idx];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '92vw',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <img src={`${BASE}${item.src}`} alt={item.alt}
          style={{ maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12, display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
          <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{item.caption}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 11 }}>{idx + 1}/{images.length}</span>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none',
              borderRadius: 8, padding: '4px 12px', color: 'white', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        </div>
        {images.length > 1 && <>
          <button onClick={e => { e.stopPropagation(); nav(-1); }} style={{ position: 'absolute', left: -52,
            top: '42%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 42, height: 42, color: 'white', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={e => { e.stopPropagation(); nav(1); }} style={{ position: 'absolute', right: -52,
            top: '42%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 42, height: 42, color: 'white', fontSize: 22, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </>}
      </div>
    </div>
  );
}

// ─── Hero carousel ────────────────────────────────────────────────────────────
function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback((next: number) => {
    setCurrent(next);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => advance((current + 1) % HERO_SLIDES.length), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, advance]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 420, overflow: 'hidden',
      borderRadius: 16, background: '#020508', border: '1px solid rgba(255,255,255,0.05)' }}>
      {HERO_SLIDES.map((slide, i) => (
        <div key={i} style={{ position: 'absolute', inset: 0,
          opacity: i === current ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out', pointerEvents: i === current ? 'auto' : 'none' }}>
          <img src={`${BASE}${slide.src}`} alt={slide.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}/>
          <div style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(to top,rgba(2,5,8,0.9) 0%,rgba(2,5,8,0.15) 55%,transparent 100%)' }}/>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '26px 30px' }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(0,245,255,0.75)',
              textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 6 }}>
              Uganda National Road Network · Department of National Roads
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.25,
              textShadow: '0 2px 28px rgba(0,0,0,0.9)', marginBottom: 7 }}>
              {slide.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(226,234,244,0.75)', lineHeight: 1.5,
              maxWidth: 580, textShadow: '0 1px 12px rgba(0,0,0,0.95)' }}>
              {slide.caption}
            </div>
          </div>
        </div>
      ))}

      {/* Dot indicators */}
      <div style={{ position: 'absolute', bottom: 20, right: 24, display: 'flex', gap: 7, alignItems: 'center' }}>
        {HERO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => advance(i)}
            style={{ width: i === current ? 22 : 7, height: 7, borderRadius: 4,
              border: 'none', cursor: 'pointer', transition: 'all 0.3s',
              background: i === current ? '#00f5ff' : 'rgba(255,255,255,0.35)',
              boxShadow: i === current ? '0 0 9px rgba(0,245,255,0.7)' : 'none' }}/>
        ))}
      </div>

      {/* Arrows */}
      {[{ dir: -1, side: 'left' }, { dir: 1, side: 'right' }].map(({ dir, side }) => (
        <button key={side}
          onClick={() => advance((current + dir + HERO_SLIDES.length) % HERO_SLIDES.length)}
          style={{ position: 'absolute', [side]: 16, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '50%', width: 40, height: 40, color: 'rgba(255,255,255,0.85)',
            fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dir < 0 ? '‹' : '›'}
        </button>
      ))}
    </div>
  );
}

// ─── Story image card ─────────────────────────────────────────────────────────
function StoryCard({ image, accentCol, onClick }: {
  image: StoryImage; accentCol: string; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const [ok,  setOk]  = useState(true);
  if (!ok) return null;
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, cursor: 'pointer',
        background: 'rgba(10,16,30,0.8)',
        border: `1px solid rgba(${accentRgb(accentCol)},0.14)`,
        transform: hov ? 'scale(1.033)' : 'scale(1)',
        boxShadow: hov ? '0 14px 44px rgba(0,0,0,0.65)' : 'none',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        aspectRatio: '16/10' }}>
      <img src={`${BASE}${image.src}`} alt={image.alt} loading="lazy"
        onError={() => setOk(false)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block',
          transform: hov ? 'scale(1.07)' : 'scale(1)', transition: 'transform 0.38s ease' }}/>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(2,5,8,0.93))',
        padding: hov ? '30px 13px 13px' : '18px 13px 10px',
        transform: hov ? 'translateY(0)' : 'translateY(25%)',
        opacity: hov ? 1 : 0.55,
        transition: 'all 0.32s ease' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(226,234,244,0.9)',
          lineHeight: 1.4, textShadow: '0 1px 8px rgba(0,0,0,0.9)' }}>
          {image.caption}
        </p>
      </div>
      <div style={{ position: 'absolute', top: 9, right: 9,
        opacity: hov ? 0.85 : 0, transition: 'opacity 0.2s',
        background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 7px',
        color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>⛶</div>
    </div>
  );
}

// ─── Media library (manifest-driven) ─────────────────────────────────────────

interface MediaItem {
  id: string; file: string; type: 'image' | 'pdf';
  title: string; source: string; category: string;
}

const FILTER_LABELS: Record<string, string> = {
  all: 'All', image: 'Images', pdf: 'PDFs',
  drone: 'Drone', landmark: 'Landmark', structures: 'Structures',
  condition: 'Condition', reports: 'Reports', 'field-video': 'Field Video',
  traffic: 'Traffic', documents: 'Documents', investment: 'Investment',
};

const CAT_ACCENT: Record<string, string> = {
  drone: '#00f5ff', landmark: '#ff6b35', structures: '#3B82F6',
  condition: '#ffd23f', reports: '#b967ff', 'field-video': '#00ff88',
  traffic: '#4d9fff', documents: '#94a3b8', investment: '#ffd23f',
  admin: '#94a3b8', general: '#64748b', image: '#00f5ff', pdf: '#ff6b35',
};

function MediaLightbox({ items, index, onClose, onPrev, onNext }: {
  items: MediaItem[]; index: number;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext]);

  const item = items[index];
  const url = `${BASE}media/${item.file}`;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.94)', display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <img src={url} alt={item.title}
          style={{ maxWidth: '88vw', maxHeight: '82vh', borderRadius: 12, objectFit: 'contain',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)' }} />

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: '#e2eaf4',
          textAlign: 'center', maxWidth: 600, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          {item.title}
          <span style={{ marginLeft: 8, fontSize: 10, color: 'rgba(148,163,184,0.6)',
            fontWeight: 400 }}>{index + 1} / {items.length}</span>
        </div>

        <button onClick={e => { e.stopPropagation(); onPrev(); }}
          style={{ position: 'absolute', left: -56, top: '40%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%', width: 44, height: 44, cursor: 'pointer',
            color: 'white', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}>
          ‹
        </button>

        <button onClick={e => { e.stopPropagation(); onNext(); }}
          style={{ position: 'absolute', right: -56, top: '40%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50%', width: 44, height: 44, cursor: 'pointer',
            color: 'white', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}>
          ›
        </button>

        <a href={url} download={item.file} onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '5px 12px',
            color: '#e2eaf4', fontSize: 11, textDecoration: 'none', fontWeight: 700,
            border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', gap: 5 }}>
          <Download size={11}/> Download
        </a>

        <button onClick={onClose}
          style={{ position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '5px 12px', color: '#e2eaf4', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', gap: 5 }}>
          <X size={11}/> Close
        </button>
      </div>
    </div>
  );
}

function MediaCard({ item, onOpen, accent }: { item: MediaItem; onOpen: () => void; accent: string }) {
  const [hov, setHov] = useState(false);
  const rgb = hexRgb(accent);
  const url = `${BASE}media/${item.file}`;
  const isPdf = item.type === 'pdf';

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onOpen}
      style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden', height: isPdf ? 120 : 190,
        border: `1px solid rgba(${rgb},${hov ? 0.6 : 0.18})`,
        boxShadow: hov ? `0 0 32px rgba(${rgb},0.25), 0 8px 32px rgba(0,0,0,0.6)` : '0 4px 20px rgba(0,0,0,0.45)',
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.25s ease',
        cursor: 'pointer',
        background: 'rgba(2,5,8,0.9)',
      }}>

      {!isPdf && (
        <img src={url} alt={item.title} loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', filter: `brightness(${hov ? 0.7 : 0.55}) saturate(1.2)`,
            transform: hov ? 'scale(1.06)' : 'scale(1)', transition: 'all 0.4s ease' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}

      {isPdf && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `linear-gradient(135deg, rgba(${rgb},0.12), rgba(2,5,8,0.95))` }}>
          <span style={{ fontSize: 36, opacity: 0.4 }}>📄</span>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(2,5,8,0.96) 0%, rgba(2,5,8,0.4) 50%, rgba(2,5,8,0.05) 100%)' }} />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, rgba(${rgb},0))`,
        opacity: hov ? 1 : 0.4, transition: 'opacity 0.2s' }} />

      <div style={{ position: 'absolute', top: 8, right: 8,
        fontSize: 8, fontWeight: 800, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase',
        background: `rgba(${rgb},0.15)`, border: `1px solid rgba(${rgb},0.3)`,
        padding: '2px 7px', borderRadius: 5, backdropFilter: 'blur(6px)' }}>
        {item.type}
      </div>

      {hov && (
        <a href={url} download={item.file}
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 8, left: 8,
            background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 8px',
            color: '#e2eaf4', fontSize: 10, textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
          <Download size={10}/> Save
        </a>
      )}

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#e2eaf4', lineHeight: 1.3,
          textShadow: '0 1px 4px rgba(0,0,0,0.9)', marginBottom: 3 }}>
          {item.title.length > 50 ? item.title.slice(0, 48) + '…' : item.title}
        </div>
        <div style={{ fontSize: 9, color: `rgba(${rgb},0.75)`, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {item.category} · {item.source === '12.Media' ? 'Field Photography' : 'Annual Monitoring'}
        </div>
        {isPdf && (
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, fontWeight: 800, color: accent, textDecoration: 'none',
              background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.25)`,
              padding: '2px 8px', borderRadius: 4 }}>
            Open PDF ↗
          </a>
        )}
      </div>
    </div>
  );
}

function MediaLibrary() {
  const [items,      setItems]      = useState<MediaItem[]>([]);
  const [filter,     setFilter]     = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [lbIndex,    setLbIndex]    = useState<number | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetch(`${BASE}media/manifest.json`)
      .then(r => r.json())
      .then((data: MediaItem[]) => { setItems(data.filter(i => (i.type as string) !== 'video')); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() =>
    ['all', ...Array.from(new Set(items.map(i => i.category))).sort()],
    [items]
  );

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'all') list = list.filter(i => i.type === typeFilter);
    if (filter !== 'all') list = list.filter(i => i.category === filter);
    return list;
  }, [items, filter, typeFilter]);

  const lbItems = filtered.filter(i => i.type !== 'pdf');
  const lbIndex2 = lbIndex !== null ? lbIndex : 0;

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
      Loading media library…
    </div>
  );

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.4)', fontSize: 12 }}>
      No media files found. Run the media copy script to populate public/media/.
    </div>
  );

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',  count: items.length,                          color: '#00f5ff' },
          { label: 'Images', count: items.filter(i => i.type === 'image').length, color: '#00f5ff' },
          { label: 'PDFs',   count: items.filter(i => i.type === 'pdf').length,   color: '#ff6b35' },
        ].map(s => (
          <div key={s.label} style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>
            <span style={{ fontWeight: 900, color: s.color, marginRight: 3 }}>{s.count}</span>{s.label}
          </div>
        ))}
      </div>

      {/* Type filter: Images → Videos → PDFs/Documents */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
        {['all', 'image', 'pdf'].map(t => {
          const active = typeFilter === t;
          const col = CAT_ACCENT[t] ?? '#94a3b8';
          const rgb = hexRgb(col);
          return (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
              background: active ? `rgba(${rgb},0.18)` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? col : 'rgba(255,255,255,0.08)'}`,
              color: active ? col : 'rgba(148,163,184,0.5)', transition: 'all 0.12s',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{FILTER_LABELS[t] ?? t}</button>
          );
        })}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(cat => {
          const active = filter === cat;
          const col = CAT_ACCENT[cat] ?? '#94a3b8';
          const rgb = hexRgb(col);
          return (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 5, cursor: 'pointer',
              background: active ? `rgba(${rgb},0.18)` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${active ? col : 'rgba(255,255,255,0.08)'}`,
              color: active ? col : 'rgba(148,163,184,0.5)', transition: 'all 0.12s',
            }}>{FILTER_LABELS[cat] ?? cat} {cat !== 'all' && `(${items.filter(i => i.category === cat).length})`}</button>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {filtered.map((item, idx) => {
          const accent = CAT_ACCENT[item.category] ?? '#94a3b8';
          const lbIdx = lbItems.indexOf(item);
          return (
            <MediaCard key={item.id} item={item} accent={accent}
              onOpen={() => {
                if (item.type !== 'pdf') setLbIndex(lbIdx >= 0 ? lbIdx : 0);
                else window.open(`${BASE}media/${item.file}`, '_blank');
              }} />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(148,163,184,0.35)', fontSize: 11 }}>
          No items match the selected filter.
        </div>
      )}

      {lbIndex !== null && lbItems.length > 0 && (
        <MediaLightbox
          items={lbItems}
          index={lbIndex2}
          onClose={() => setLbIndex(null)}
          onPrev={() => setLbIndex(i => ((i ?? 0) - 1 + lbItems.length) % lbItems.length)}
          onNext={() => setLbIndex(i => ((i ?? 0) + 1) % lbItems.length)}
        />
      )}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
function SectionDivider({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  const rgb = accentRgb(color) !== '148,163,184' ? accentRgb(color) : hexRgb(color);
  return (
    <div style={{ marginBottom: 20, paddingBottom: 12,
      borderBottom: `1px solid rgba(${rgb},0.2)` }}>
      <div style={{ fontSize: 13, fontWeight: 900, color, letterSpacing: '0.04em', marginBottom: 4 }}>
        {title}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'rgba(148,163,184,0.55)', lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MediaSection() {
  const [storyLightbox, setStoryLightbox] = useState<{ images: StoryImage[]; idx: number } | null>(null);

  return (
    <section style={{ padding: '12px 16px', minHeight: 0,
      color: '#e2eaf4', fontFamily: "'Inter','Segoe UI',sans-serif" }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(0,245,255,0.55)',
          letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 3 }}>
          Uganda National Roads · Department of National Roads / Department of National Roads
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#00f5ff', lineHeight: 1.2,
          textShadow: '0 0 22px rgba(0,245,255,0.35)' }}>
          Media and Document Gallery
        </div>
        <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 12, marginTop: 6,
          maxWidth: 680, lineHeight: 1.55 }}>
          Road network imagery, bridge inspection photography, ROMDAS pavement surveys,
          and annual monitoring reports from across Uganda's 21,160 km (mapped) national road network.
        </p>
      </div>

      {/* ── 1. Hero carousel (photography showcase) ── */}
      <div style={{ marginBottom: 44 }}>
        <HeroCarousel />
      </div>

      {/* ── 2. Curated photo story sections ── */}
      {STORIES.map((story, si) => (
        <div key={story.id} style={{ marginBottom: 44 }}>
          <SectionDivider
            title={`${si + 1}. ${story.title}`}
            subtitle={story.subtitle}
            color={story.color}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {story.images.map((img, i) => (
              <StoryCard key={img.src} image={img} accentCol={story.color}
                onClick={() => setStoryLightbox({ images: story.images, idx: i })}/>
            ))}
          </div>
        </div>
      ))}

      {/* ── 3. Bridge inspection portfolio strip ── */}
      <div style={{ marginBottom: 44 }}>
        <SectionDivider
          title="Bridge Inspection Portfolio"
          subtitle="Structural photography from the 1,019-structure bridge registry"
          color="#00d4aa"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
          {BRIDGE_STRIP.map((src) => {
            const img: StoryImage = {
              src, alt: `Bridge ${src.split('/').pop()?.replace('.jpg', '')}`,
              caption: `Bridge inspection · ${src.split('/').pop()?.replace('bridge_b', 'B').replace('_1.jpg', '').toUpperCase()}`,
            };
            return (
              <StoryCard key={src} image={img} accentCol="#00ff88"
                onClick={() => setStoryLightbox({ images: [img], idx: 0 })}/>
            );
          })}
        </div>
      </div>

      {/* ── 4. Interactive media and document library ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18,
          paddingBottom: 12, borderBottom: '1px solid rgba(255,107,53,0.15)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(255,107,53,0.25), rgba(255,45,120,0.1))',
            border: '1px solid rgba(255,107,53,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(255,107,53,0.25)',
            fontSize: 18,
          }}>
            🗂
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ff6b35', letterSpacing: '0.04em' }}>
              Full Media &amp; Document Archive
            </div>
            <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)', marginTop: 2 }}>
              Drone imagery, field photographs, and annual monitoring reports — filter by type or category
            </div>
          </div>
        </div>
        <MediaLibrary />
      </div>

      {/* Story lightbox */}
      {storyLightbox && (
        <StoryLightbox images={storyLightbox.images} startIdx={storyLightbox.idx}
          onClose={() => setStoryLightbox(null)}/>
      )}
    </section>
  );
}
