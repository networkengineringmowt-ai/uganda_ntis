/**
 * VideosSection — Road survey video player with georeferenced Uganda minimap
 *
 * Survey video files live on the internal ROMDAS server (not GitHub Pages).
 * A demo playback mode simulates progress and moves a dot along the road on
 * the SVG minimap, demonstrating the georeferenced playback concept.
 * When a real <video> src is present the dot tracks actual currentTime.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Video, Play, Pause, Download, MapPin, Film, Info,
} from 'lucide-react';

// ─── Uganda SVG minimap helpers ───────────────────────────────────────────────
const MIN_LNG = 29.5, MAX_LNG = 35.0;
const MIN_LAT = -1.5, MAX_LAT = 4.5;
const MAP_W   = 220,  MAP_H   = 240;

function toSvg(lng: number, lat: number): [number, number] {
  const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * MAP_W;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * MAP_H;
  return [parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1))];
}

function coords2path(pts: [number, number][]): string {
  return pts.map(([lng, lat], i) => {
    const [x, y] = toSvg(lng, lat);
    return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');
}

function interpolate(pts: [number, number][], t: number): [number, number] {
  if (pts.length < 2) { const [x, y] = toSvg(pts[0][0], pts[0][1]); return [x, y]; }
  const seg  = t * (pts.length - 1);
  const i    = Math.min(Math.floor(seg), pts.length - 2);
  const frac = seg - i;
  const [x0, y0] = toSvg(pts[i][0],   pts[i][1]);
  const [x1, y1] = toSvg(pts[i+1][0], pts[i+1][1]);
  return [x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac];
}

// Simplified Uganda border (~14 vertices, clockwise from NW)
const BORDER_COORDS: [number, number][] = [
  [29.6, 4.2], [31.5, 3.85], [32.0, 3.65], [34.0, 4.22],
  [34.8, 3.0],  [34.7, 1.2], [34.6, -0.4], [33.9, -1.0],
  [31.8, -1.4], [30.7, -0.9], [29.6, -0.4], [29.6, 1.5],
  [29.6, 4.2],
];
const BORDER_PTS = BORDER_COORDS
  .map(([lng, lat]) => { const [x, y] = toSvg(lng, lat); return `${x},${y}`; })
  .join(' ');

// Background road lines
const BG_ROADS: [number, number][][] = [
  [[32.58, 0.32], [33.0, 0.38], [34.18, 0.63]],          // A109 E
  [[32.58, 0.32], [31.73, -0.34], [30.65, 0.61]],         // A109 SW
  [[32.58, 0.32], [32.30, 1.5], [32.30, 2.77], [32.20, 3.3]], // A7 N
  [[32.58, 0.32], [32.46, 0.05]],                          // M2 Entebbe
  [[30.28, 0.67], [30.00, 0.18]],                          // W roads
  [[34.17, 1.08], [33.35, 1.72]],                          // B65
];

const KAMPALA = toSvg(32.58, 0.32);

// ─── Condition colours ────────────────────────────────────────────────────────
const COND_COLOR: Record<number, string> = {
  5: '#22c55e', 4: '#84cc16', 3: '#f59e0b', 2: '#f97316', 1: '#ef4444',
};
const COND_LABEL: Record<number, string> = {
  5: 'Excellent', 4: 'Good', 3: 'Fair', 2: 'Poor', 1: 'Critical',
};

// ─── Sample video catalogue ───────────────────────────────────────────────────
// No .mp4 files found locally; using representative sample data.
// Set `src` to a real path when video files are available.
interface SurveyVideo {
  id:          string;
  roadName:    string;
  roadNo:      string;
  region:      string;
  surveyDate:  string;
  lengthKm:    number;
  condition:   1 | 2 | 3 | 4 | 5;
  surveyType:  string;
  route:       [number, number][];
  src?:        string; // local or Drive URL — undefined = demo only
}

const VIDEOS: SurveyVideo[] = [
  {
    id: 'v-kj-2324', roadName: 'Kampala – Jinja Road', roadNo: 'A109',
    region: 'Central', surveyDate: '2023-11-15', lengthKm: 82.4,
    condition: 3, surveyType: 'Pavement + 360°',
    route: [[32.58,0.32],[32.9,0.38],[33.2,0.42],[33.5,0.44],[34.18,0.63]],
  },
  {
    id: 'v-ke-2324', roadName: 'Entebbe Expressway', roadNo: 'M2',
    region: 'Central', surveyDate: '2023-10-02', lengthKm: 36.0,
    condition: 5, surveyType: 'Pavement',
    route: [[32.58,0.32],[32.52,0.22],[32.46,0.05]],
  },
  {
    id: 'v-ga-2223', roadName: 'Gulu – Atiak Road', roadNo: 'A45',
    region: 'Northern', surveyDate: '2022-09-18', lengthKm: 55.2,
    condition: 2, surveyType: 'Pavement',
    route: [[32.30,2.77],[32.25,3.10],[32.10,3.42]],
  },
  {
    id: 'v-mk-2122', roadName: 'Mbale – Soroti Road', roadNo: 'B65',
    region: 'Eastern', surveyDate: '2022-07-05', lengthKm: 112.0,
    condition: 3, surveyType: 'Pavement + 360°',
    route: [[34.17,1.08],[33.70,1.45],[33.35,1.72]],
  },
  {
    id: 'v-fp-2122', roadName: 'Fort Portal – Kasese Road', roadNo: 'A109W',
    region: 'Western', surveyDate: '2022-03-20', lengthKm: 65.8,
    condition: 4, surveyType: 'Pavement',
    route: [[30.28,0.67],[30.08,0.52],[30.00,0.18]],
  },
  {
    id: 'v-km-2122', roadName: 'Kampala – Masaka Road', roadNo: 'A109S',
    region: 'Central', surveyDate: '2022-01-10', lengthKm: 135.0,
    condition: 3, surveyType: 'Pavement + 360°',
    route: [[32.58,0.32],[32.09,-0.10],[31.73,-0.34]],
  },
];

const DEMO_DURATION = 90; // seconds for a complete demo sweep

// ─── Component ────────────────────────────────────────────────────────────────

export default function VideosSection() {
  const [selected,  setSelected]  = useState<SurveyVideo>(VIDEOS[0]);
  const [progress,  setProgress]  = useState(0);   // 0–1
  const [playing,   setPlaying]   = useState(false);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const startRef   = useRef(0);                    // epoch ms at progress=0

  // ── Demo timer (no real video src) ─────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    // Recompute start so current progress is preserved across pause/resume
    startRef.current = Date.now() - progress * DEMO_DURATION * 1000;
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - startRef.current) / (DEMO_DURATION * 1000));
      setProgress(p);
      if (p >= 1) { setPlaying(false); setProgress(0); }
    }, 80);
    return () => clearInterval(id);
  }, [playing, selected]);

  // ── Real video timeupdate ───────────────────────────────────────────────────
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => { if (vid.duration > 0) setProgress(vid.currentTime / vid.duration); };
    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, []);

  const handleSelect = (v: SurveyVideo) => {
    setSelected(v);
    setPlaying(false);
    setProgress(0);
  };

  const toggleDemo = () => {
    if (progress >= 1) setProgress(0);
    setPlaying(p => !p);
  };

  const dot       = interpolate(selected.route, progress);
  const routePath = coords2path(selected.route);
  const cc        = COND_COLOR[selected.condition];

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar: video list ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-900/50 overflow-y-auto">
        <div className="px-3 py-3 border-b border-slate-700/60">
          <div className="text-xs font-black text-white flex items-center gap-2">
            <Film size={13} style={{ color: '#ff6b35' }}/> Survey Videos
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{VIDEOS.length} road surveys indexed</div>
        </div>

        {VIDEOS.map(v => {
          const active = selected.id === v.id;
          const vc     = COND_COLOR[v.condition];
          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-700/30 transition-all
                ${active ? 'border-l-2 border-l-orange-500' : 'hover:bg-slate-700/40'}`}
              style={active ? { background: 'rgba(255,107,53,0.08)' } : undefined}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{v.roadName}</div>
                  <div className="text-[9px] text-slate-500">{v.roadNo} · {v.region}</div>
                </div>
                <span
                  className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black"
                  style={{ background: `${vc}22`, color: vc, border: `1px solid ${vc}44` }}
                >
                  {v.condition}/5
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-600">
                <span>{v.lengthKm} km</span>
                <span>·</span>
                <span>{v.surveyType}</span>
                <span>·</span>
                <span>{v.surveyDate.slice(0,4)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header bar */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b border-slate-700/60"
          style={{ background: 'rgba(2,5,8,0.88)', backdropFilter: 'blur(8px)' }}
        >
          <Video size={16} style={{ color: '#ff6b35' }} />
          <div className="min-w-0">
            <div className="text-sm font-black text-white truncate">{selected.roadName}</div>
            <div className="text-[10px] text-slate-500">{selected.roadNo} · {selected.region} · {selected.surveyDate}</div>
          </div>
          <div className="ml-auto flex items-center gap-3 flex-shrink-0">
            <span
              className="px-2 py-1 rounded text-[10px] font-black"
              style={{ background: `${cc}22`, color: cc, border: `1px solid ${cc}44` }}
            >
              {COND_LABEL[selected.condition]}
            </span>
            <span className="text-[10px] text-slate-500">{selected.lengthKm} km</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex gap-4 flex-wrap xl:flex-nowrap">

            {/* Video + controls */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">

              {/* HTML5 player */}
              <div className="rounded-xl overflow-hidden border border-slate-700/60 bg-black">
                <video
                  ref={videoRef}
                  controls
                  className="w-full block"
                  style={{ maxHeight: 360 }}
                  src={selected.src}
                  key={selected.id}
                >
                  Your browser does not support the video element.
                </video>
              </div>

              {/* Info + demo controls */}
              <div
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{ background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.15)' }}
              >
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <Info size={13} style={{ color: '#ff6b35', flexShrink: 0, marginTop: 1 }}/>
                  <span>
                    Survey video files are stored on the internal ROMDAS server.
                    Use <strong className="text-slate-300">Demo Playback</strong> to preview the georeferenced track on the minimap.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleDemo}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex-shrink-0"
                    style={{
                      background: 'rgba(255,107,53,0.12)',
                      border: '1px solid rgba(255,107,53,0.35)',
                      color: '#ff6b35',
                    }}
                  >
                    {playing ? <Pause size={13}/> : <Play size={13}/>}
                    {playing ? 'Pause' : progress > 0 ? 'Resume' : 'Demo Playback'}
                  </button>

                  <input
                    type="range" min={0} max={1000} value={Math.round(progress * 1000)}
                    onChange={e => { setPlaying(false); setProgress(Number(e.target.value) / 1000); }}
                    className="flex-1"
                    style={{ accentColor: '#ff6b35' }}
                  />

                  <span className="text-[10px] text-slate-500 font-mono w-12 text-right flex-shrink-0">
                    {(progress * selected.lengthKm).toFixed(1)} km
                  </span>

                  <button
                    disabled
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-800/60 cursor-not-allowed flex-shrink-0"
                    title="Download — connect to the ROMDAS server for access"
                  >
                    <Download size={11}/> Download
                  </button>
                </div>
              </div>
            </div>

            {/* Minimap */}
            <div
              className="flex-shrink-0 rounded-xl p-3 flex flex-col gap-2"
              style={{
                width: 256,
                background: 'rgba(2,5,8,0.92)',
                border: '1px solid rgba(255,107,53,0.15)',
                alignSelf: 'flex-start',
              }}
            >
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={10} style={{ color: '#ff6b35' }}/> Georeferenced Track
              </div>

              <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                {/* Uganda outline */}
                <polygon
                  points={BORDER_PTS}
                  fill="rgba(15,23,42,0.85)"
                  stroke="rgba(100,116,139,0.35)"
                  strokeWidth="1.5"
                />

                {/* Lake Victoria (simplified) */}
                <ellipse cx="130" cy="226" rx="28" ry="20"
                  fill="rgba(30,58,138,0.25)" stroke="rgba(59,130,246,0.25)" strokeWidth="0.8"/>
                {/* Lake Albert */}
                <ellipse cx="22" cy="108" rx="8" ry="18"
                  fill="rgba(30,58,138,0.25)" stroke="rgba(59,130,246,0.2)" strokeWidth="0.8"/>

                {/* Background roads */}
                {BG_ROADS.map((pts, i) => (
                  <path key={i} d={coords2path(pts)} fill="none" stroke="rgba(100,116,139,0.2)" strokeWidth="1"/>
                ))}

                {/* Selected road (highlighted) */}
                <path d={routePath} fill="none" stroke={cc} strokeWidth="3" strokeLinecap="round" opacity={0.85}/>

                {/* Kampala marker */}
                <circle cx={KAMPALA[0]} cy={KAMPALA[1]} r="3" fill="rgba(255,255,255,0.5)"/>

                {/* Animated survey dot */}
                <circle cx={dot[0]} cy={dot[1]} r="10"
                  fill="none" stroke={cc} strokeWidth="1.5" opacity={0.35}/>
                <circle cx={dot[0]} cy={dot[1]} r="5.5"
                  fill={cc} opacity={0.95}
                  style={{ filter: `drop-shadow(0 0 5px ${cc})` }}/>
              </svg>

              {/* Legend */}
              <div className="text-[9px] text-slate-600 space-y-1 mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-0.5 rounded" style={{ background: cc }}/>
                  <span className="text-slate-500 truncate">{selected.roadName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cc }}/>
                  <span>{(progress * selected.lengthKm).toFixed(1)} km of {selected.lengthKm} km surveyed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white/40 flex-shrink-0"/>
                  <span>Kampala</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
