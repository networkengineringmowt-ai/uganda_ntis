/**
 * MediaSection — Storytelling media showcase.
 * Hero carousel (5 slides, 5s auto-rotate, crossfade) + 4 curated story sections.
 * Hover zoom + slide-up caption overlay. Fullscreen lightbox with keyboard nav.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const BASE = import.meta.env.BASE_URL;

// ─── Curated content ──────────────────────────────────────────────────────────
interface Slide { src: string; title: string; caption: string }
interface StoryImage { src: string; caption: string; alt: string }
interface StorySection { id: string; title: string; subtitle: string; color: string; images: StoryImage[] }

const HERO_SLIDES: Slide[] = [
  { src:'media/kampala_flyover.png',
    title:'Kampala Flyover — Urban Road Infrastructure',
    caption:'Grade-separated interchange reducing congestion · Class M motorway network, Kampala' },
  { src:'media/northern_bypass.png',
    title:'Northern Bypass — Kampala Ring Road',
    caption:'M3 outer ring road · Bwaise–Kyebando corridor · 17.5 km dual carriageway' },
  { src:'media/kee_aerial2.png',
    title:'Kampala Eastern Expressway — Aerial View',
    caption:'Planned KEE alignment photographed during feasibility study · Eastern corridor' },
  { src:'media/bridges/bridge_b001_1.jpg',
    title:'Victoria Nile Bridge — Owen Falls, Jinja',
    caption:'Bridge B001 · Strategic A1 trunk road crossing · Jinja maintenance region' },
  { src:'media/roads/road_y_A001N1_LINK01_0.jpg',
    title:'A1 Highway — Kampala–Jinja Corridor',
    caption:"Uganda's highest-volume road link · 30,909 AADT · ROMDAS pavement survey 2025" },
];

const STORIES: StorySection[] = [
  {
    id:'network', color:'#00f5ff',
    title:'National Road Network',
    subtitle:"21,292 km of paved and unpaved roads connecting Uganda's regions — surveyed with ROMDAS technology",
    images: [
      { src:'media/roads/road_y_A001_LINK07_0.jpg', alt:'A1 northern',
        caption:'A1 Trunk Road — Northern Segment · ROMDAS pavement rating survey' },
      { src:'media/roads/road_y_A002_LINK05_0.jpg', alt:'A2 Malaba',
        caption:'A2 Highway — Tororo-Malaba Border Corridor · Class A trunk road' },
      { src:'media/roads/road_y_M3LINK01_LHS_0.jpg', alt:'M3 bypass',
        caption:'M3 Northern Bypass — Left-hand survey strip · Kampala outer ring' },
    ],
  },
  {
    id:'bridges', color:'#00ff88',
    title:'Bridge Infrastructure',
    subtitle:'1,019 registered structures under Bridge Management System monitoring — inspected to NBI standards',
    images: [
      { src:'media/bridges/bridge_b001_2.jpg', alt:'B001 inspection',
        caption:'B001 Victoria Nile Bridge — Load inspection, Jinja maintenance area' },
      { src:'media/bridges/bridge_b100_1.jpg', alt:'B100 Northern',
        caption:'B100 Bridge — Northern Corridor structural assessment 2025' },
      { src:'media/bridges/bridge_b050_1.jpg', alt:'B050 Eastern',
        caption:'B050 Bridge — Eastern region infrastructure connectivity' },
    ],
  },
  {
    id:'surveys', color:'#ffd23f',
    title:'Monitoring & Surveys',
    subtitle:'ROMDAS pavement condition surveys and manual traffic count programmes across the network',
    images: [
      { src:'media/gallery/romdas.jpg', alt:'ROMDAS vehicle',
        caption:'ROMDAS Survey Vehicle — Automated Pavement Condition Rating System' },
      { src:'media/gallery/TC_00008.jpg', alt:'Traffic count Kampala',
        caption:'Manual Traffic Count — Central Region node · ATC baseline survey' },
      { src:'media/gallery/TC_00009.jpg', alt:'Traffic count Northern',
        caption:'ATC Station Monitoring — Northern Region survey deployment' },
    ],
  },
  {
    id:'performance', color:'#b967ff',
    title:'Annual Performance',
    subtitle:'Network performance monitoring imagery from annual DNR/UNRA assessment programmes',
    images: [
      { src:'media/gallery/TC_00010.jpg', alt:'Annual survey',
        caption:'Traffic Survey 2025 — Annual Network Assessment Programme' },
      { src:'media/bridges/bridge_b001_3.jpg', alt:'Bridge condition',
        caption:'Structural Integrity Assessment — Bridge B001 condition survey' },
      { src:'media/roads/road_y_A007_LINK04_0.jpg', alt:'A7 Western',
        caption:'A7 Road Link — Western Region pavement survey 2025' },
    ],
  },
];

// Additional bridge thumbnails for portfolio strip
const BRIDGE_STRIP = [
  'media/bridges/bridge_b001_1.jpg',
  'media/bridges/bridge_b050_1.jpg',
  'media/bridges/bridge_b100_1.jpg',
  'media/bridges/bridge_b037_1.jpg',
  'media/bridges/bridge_b039_1.jpg',
  'media/bridges/bridge_b040_1.jpg',
];

// ─── Helper: accent rgb string ────────────────────────────────────────────────
const ACCENT_RGB: Record<string,string> = {
  '#00f5ff':'0,245,255', '#00ff88':'0,255,136',
  '#ffd23f':'255,210,63', '#b967ff':'185,103,255',
};
function accentRgb(col: string) { return ACCENT_RGB[col] ?? '148,163,184'; }

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, startIdx, onClose }: { images: StoryImage[]; startIdx: number; onClose: () => void }) {
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
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.94)', display:'flex', alignItems:'center', justifyContent:'center',
      backdropFilter:'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'92vw',
        maxHeight:'92vh', display:'flex', flexDirection:'column', gap:10 }}>
        <img src={`${BASE}${item.src}`} alt={item.alt}
          style={{ maxWidth:'90vw', maxHeight:'82vh', objectFit:'contain', borderRadius:12, display:'block' }}
          onError={e => { (e.target as HTMLImageElement).style.opacity='0'; }}/>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 4px' }}>
          <span style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>{item.caption}</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ color:'rgba(148,163,184,0.4)', fontSize:11 }}>{idx+1}/{images.length}</span>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.12)', border:'none',
              borderRadius:8, padding:'4px 12px', color:'white', cursor:'pointer', fontSize:12 }}>✕</button>
          </div>
        </div>
        {images.length > 1 && <>
          <button onClick={e => { e.stopPropagation(); nav(-1); }} style={{ position:'absolute', left:-52,
            top:'42%', background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.2)',
            borderRadius:'50%', width:42, height:42, color:'white', fontSize:22, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <button onClick={e => { e.stopPropagation(); nav(1); }} style={{ position:'absolute', right:-52,
            top:'42%', background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.2)',
            borderRadius:'50%', width:42, height:42, color:'white', fontSize:22, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </>}
      </div>
    </div>
  );
}

// ─── Hero carousel ────────────────────────────────────────────────────────────
function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(0); // tracks what's rendered (after transition)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback((next: number) => {
    setCurrent(next);
    setTimeout(() => setVisible(next), 450);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => advance((current + 1) % HERO_SLIDES.length), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, advance]);

  return (
    <div style={{ position:'relative', width:'100%', height:420, overflow:'hidden',
      borderRadius:16, background:'#020508', border:'1px solid rgba(255,255,255,0.05)' }}>
      {HERO_SLIDES.map((slide, i) => (
        <div key={i} style={{ position:'absolute', inset:0,
          opacity: i === current ? 1 : 0,
          transition:'opacity 0.5s ease-in-out', pointerEvents: i===current?'auto':'none' }}>
          <img src={`${BASE}${slide.src}`} alt={slide.title}
            style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center',
              display:'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display='none'; }}/>
          <div style={{ position:'absolute', inset:0,
            background:'linear-gradient(to top,rgba(2,5,8,0.9) 0%,rgba(2,5,8,0.15) 55%,transparent 100%)' }}/>
          <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'26px 30px' }}>
            <div style={{ fontSize:9, fontWeight:800, color:'rgba(0,245,255,0.75)',
              textTransform:'uppercase', letterSpacing:'0.18em', marginBottom:6 }}>
              Uganda National Road Network · UNRA
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', lineHeight:1.25,
              textShadow:'0 2px 28px rgba(0,0,0,0.9)', marginBottom:7 }}>
              {slide.title}
            </div>
            <div style={{ fontSize:12, color:'rgba(226,234,244,0.75)', lineHeight:1.5,
              maxWidth:580, textShadow:'0 1px 12px rgba(0,0,0,0.95)' }}>
              {slide.caption}
            </div>
          </div>
        </div>
      ))}

      {/* Dot indicators */}
      <div style={{ position:'absolute', bottom:20, right:24, display:'flex', gap:7, alignItems:'center' }}>
        {HERO_SLIDES.map((_, i) => (
          <button key={i} onClick={() => advance(i)}
            style={{ width: i===current?22:7, height:7, borderRadius:4,
              border:'none', cursor:'pointer', transition:'all 0.3s',
              background: i===current?'#00f5ff':'rgba(255,255,255,0.35)',
              boxShadow: i===current?'0 0 9px rgba(0,245,255,0.7)':'none' }}/>
        ))}
      </div>

      {/* Arrows */}
      {[{dir:-1,side:'left'},{dir:1,side:'right'}].map(({dir,side}) => (
        <button key={side}
          onClick={() => advance((current + dir + HERO_SLIDES.length) % HERO_SLIDES.length)}
          style={{ position:'absolute', [side]:16, top:'50%', transform:'translateY(-50%)',
            background:'rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.14)',
            borderRadius:'50%', width:40, height:40, color:'rgba(255,255,255,0.85)',
            fontSize:22, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {dir<0?'‹':'›'}
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
      style={{ position:'relative', overflow:'hidden', borderRadius:12, cursor:'pointer',
        background:'rgba(10,16,30,0.8)',
        border:`1px solid rgba(${accentRgb(accentCol)},0.14)`,
        transform: hov ? 'scale(1.033)' : 'scale(1)',
        boxShadow: hov ? '0 14px 44px rgba(0,0,0,0.65)' : 'none',
        transition:'transform 0.3s ease, box-shadow 0.3s ease',
        aspectRatio:'16/10' }}>
      <img src={`${BASE}${image.src}`} alt={image.alt} loading="lazy"
        onError={() => setOk(false)}
        style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block',
          transform: hov ? 'scale(1.07)' : 'scale(1)', transition:'transform 0.38s ease' }}/>
      {/* Slide-up caption */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0,
        background:'linear-gradient(transparent, rgba(2,5,8,0.93))',
        padding: hov ? '30px 13px 13px' : '18px 13px 10px',
        transform: hov ? 'translateY(0)' : 'translateY(25%)',
        opacity: hov ? 1 : 0.55,
        transition:'all 0.32s ease' }}>
        <p style={{ margin:0, fontSize:11, fontWeight:600, color:'rgba(226,234,244,0.9)',
          lineHeight:1.4, textShadow:'0 1px 8px rgba(0,0,0,0.9)' }}>
          {image.caption}
        </p>
      </div>
      {/* Expand icon */}
      <div style={{ position:'absolute', top:9, right:9,
        opacity: hov ? 0.85 : 0, transition:'opacity 0.2s',
        background:'rgba(0,0,0,0.5)', borderRadius:6, padding:'2px 7px',
        color:'rgba(255,255,255,0.9)', fontSize:14 }}>⛶</div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MediaSection() {
  const [lightbox, setLightbox] = useState<{ images: StoryImage[]; idx: number } | null>(null);

  return (
    <section style={{ padding:'28px 24px 52px', minHeight:'100vh',
      color:'#e2eaf4', fontFamily:"'Inter','Segoe UI',sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(0,245,255,0.55)',
          letterSpacing:'0.18em', textTransform:'uppercase', marginBottom:3 }}>
          Uganda National Roads · UNRA / Department of National Roads
        </div>
        <div style={{ fontSize:22, fontWeight:900, color:'#00f5ff', lineHeight:1.2,
          textShadow:'0 0 22px rgba(0,245,255,0.35)' }}>
          Media Gallery
        </div>
        <p style={{ color:'rgba(148,163,184,0.6)', fontSize:12, marginTop:6,
          maxWidth:620, lineHeight:1.55 }}>
          Road network imagery, bridge inspection photography, ROMDAS pavement surveys and annual
          monitoring documentation from across Uganda's 21,292 km national road network.
        </p>
      </div>

      {/* Hero carousel */}
      <div style={{ marginBottom:44 }}>
        <HeroCarousel/>
      </div>

      {/* Story sections */}
      {STORIES.map((story, si) => (
        <div key={story.id} style={{ marginBottom:44 }}>
          <div style={{ marginBottom:16, paddingBottom:10,
            borderBottom:`1px solid rgba(${accentRgb(story.color)},0.14)` }}>
            <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase',
              letterSpacing:'0.14em', marginBottom:3,
              color:`rgba(${accentRgb(story.color)},0.6)` }}>
              {si+1}. {story.title}
            </div>
            <p style={{ margin:0, fontSize:11, color:'rgba(148,163,184,0.55)', lineHeight:1.45 }}>
              {story.subtitle}
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
            {story.images.map((img, i) => (
              <StoryCard key={img.src} image={img} accentCol={story.color}
                onClick={() => setLightbox({ images: story.images, idx: i })}/>
            ))}
          </div>
        </div>
      ))}

      {/* Bridge portfolio strip */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:9, fontWeight:800, color:'rgba(0,212,170,0.55)',
          textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:4 }}>
          Bridge Inspection Portfolio
        </div>
        <p style={{ margin:'0 0 12px', fontSize:11, color:'rgba(148,163,184,0.5)' }}>
          Structural photography from the 1,019-structure bridge registry
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8 }}>
          {BRIDGE_STRIP.map((src, i) => {
            const img: StoryImage = {
              src, alt:`Bridge ${src.split('/').pop()?.replace('.jpg','')}`,
              caption:`Bridge inspection · ${src.split('/').pop()?.replace('bridge_b','B').replace('_1.jpg','').toUpperCase()}`,
            };
            return (
              <StoryCard key={src} image={img} accentCol="#00ff88"
                onClick={() => setLightbox({ images: [img], idx: 0 })}/>
            );
          })}
        </div>
      </div>

      {lightbox && (
        <Lightbox images={lightbox.images} startIdx={lightbox.idx}
          onClose={() => setLightbox(null)}/>
      )}
    </section>
  );
}
