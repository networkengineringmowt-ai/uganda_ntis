import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  Legend, Cell,
} from 'recharts';
import {
  TrendingUp, MapPin, Clock, Layers, BookOpen,
  DollarSign, Wrench, Activity, Download, X, ChevronDown,
  BarChart2, Filter,
} from 'lucide-react';
import { hexRgb, lightenHex, darkenHex, TICK, TICK_SM, AX_LINE } from '../../lib/chart3d';
import { loadPlatformAnalytics, type PlatformAnalytics } from '../../data/platformData';

// ── Types ─────────────────────────────────────────────────────────────────────
interface StoryData {
  total_links:      number;
  total_paved_km:   number;
  total_unpaved_km: number;
  by_decade:        { decade: number; label: string; paved_km: number }[];
  cumulative_paved: { year: number; cum_paved_km: number }[];
  rehab_by_year?:   { year: number; rehab_km: number }[];
  by_region:        { region: string; paved_km: number; unpaved_km: number; links: number }[];
  age_distribution: { age_bracket: string; km: number }[];
}

interface Filters {
  regions: string[];
  yearRange: [number, number];
  decade: number | null;
  surfaceType: 'all' | 'paved' | 'unpaved';
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  purple: '#b967ff', cyan: '#00f5ff', green: '#00ff88',
  blue: '#4d9fff',  yellow: '#ffd23f', orange: '#ff6b35',
  pink: '#ff2d78',  teal: '#00d4aa',  indigo: '#7c6af7',
};
const NEON = [C.cyan, C.green, C.yellow, C.orange, C.pink, C.purple, C.teal, C.blue, C.indigo];
const ALL_REGIONS = ['Central', 'Western', 'Southern', 'Northern', 'Eastern', 'North Eastern'];
const REGION_COLORS: Record<string, string> = {
  Central: C.cyan, Western: C.green, Southern: C.teal,
  Northern: C.orange, Eastern: C.blue, 'North Eastern': C.pink,
};

// ── Static data ───────────────────────────────────────────────────────────────
const MILESTONES = [
  { year: 1962, label: 'Independence',       color: C.cyan,   detail: 'Uganda gains independence; inherited ~700 km of colonial paved roads' },
  { year: 1986, label: 'Liberation',          color: C.purple, detail: 'NRM government; national road rehabilitation programme begins' },
  { year: 1996, label: 'Donor Rehab',         color: C.blue,   detail: 'DANIDA & World Bank-funded paved road rehabilitation phase' },
  { year: 2008, label: 'NDP I',               color: C.green,  detail: 'National Development Plan I: accelerated upgrading commences' },
  { year: 2013, label: 'NDP II',              color: C.yellow, detail: 'NDP II target: 6,000 km paved by FY 2019/20' },
  { year: 2020, label: 'NDP III',             color: C.orange, detail: 'NDP III target: 10,000 km paved by FY 2025/26' },
  { year: 2022, label: 'NDP IV Launch',       color: C.teal,   detail: 'NDP IV launched; official national road network defined as 21,302 km; OPRC contracts expanded to 9 active lots covering all six regions' },
  { year: 2023, label: 'OPRC Scale-Up',       color: C.pink,   detail: 'Continued rehabilitation under OPRC performance contracts; bridge and culvert inventory completed — 1,019 structures confirmed' },
  { year: 2024, label: 'Digital Transform',   color: C.indigo, detail: 'Digital transformation initiative; DNR RMS Engine development begins; ML-powered pavement condition assessment model (PyTorch, R²=0.93) enters training' },
  { year: 2025, label: 'Platform Live',       color: C.green,  detail: 'DNR Road Management System goes live; 1,013 links in GeoJSON; ML IRI prediction and HDM-4 analysis integrated; real-time ATC data feeds activated' },
  { year: 2026, label: 'Current (FY25/26)',   color: C.cyan,   detail: 'Current year: Official network 21,302 km (NDPIV FY25-26) | GeoJSON mapped 21,160 km (1,013 links) | Paved 6,405 km (30.1%) | Unpaved 14,897 km (69.9%)' },
];

const MAINTENANCE_FY = [
  { fy: '2018/19', required: 680, allocated: 356, received: 302 },
  { fy: '2019/20', required: 710, allocated: 380, received: 340 },
  { fy: '2020/21', required: 740, allocated: 290, received: 265 },
  { fy: '2021/22', required: 780, allocated: 420, received: 388 },
  { fy: '2022/23', required: 820, allocated: 480, received: 452 },
  { fy: '2023/24', required: 870, allocated: 520, received: 490 },
  { fy: '2024/25', required: 920, allocated: 580, received: 540 },
];

// Real traffic AADT from analytics.json (fallback when analytics hasn't loaded)
const TRAFFIC_AADT_FALLBACK = [
  { year: 2017, motorised: 1733.2, non_motorised: 280.1 },
  { year: 2020, motorised: 2084.7, non_motorised: 350.9 },
  { year: 2021, motorised: 2184.4, non_motorised: 189.5 },
  { year: 2025, motorised: 2562.3, non_motorised: 384.5 },
];

// Real traffic by region 2025 from analytics.json (fallback)
const TRAFFIC_REGION_2025_FALLBACK = [
  { region: 'Central',  motorised: 4894.4, length: 4436.0 },
  { region: 'Eastern',  motorised: 2489.7, length: 5292.3 },
  { region: 'Southern', motorised: 1769.6, length: 3297.7 },
  { region: 'Western',  motorised: 1991.9, length: 2996.6 },
  { region: 'Northern', motorised: 1315.7, length: 4521.7 },
];

// Real VCI from analytics.json paved_condition cycles
const VCI_REGIONS = [
  { region: 'Central',       vci_2425: 82.572, vci_2526: 82.513, paved_km: 1790.5, roughness: 2.933, rutting: 8.230 },
  { region: 'Western',       vci_2425: 85.774, vci_2526: 85.774, paved_km: 1256.9, roughness: 2.954, rutting: 7.276 },
  { region: 'Southern',      vci_2425: 89.461, vci_2526: 89.380, paved_km: 1119.4, roughness: 3.515, rutting: 6.931 },
  { region: 'Northern',      vci_2425: 70.651, vci_2526: 70.651, paved_km:  881.9, roughness: 3.824, rutting: 9.730 },
  { region: 'Eastern',       vci_2425: 83.326, vci_2526: 83.326, paved_km:  845.1, roughness: 2.488, rutting: 9.279 },
  { region: 'North Eastern', vci_2425: 72.904, vci_2526: 72.904, paved_km:  418.3, roughness: 3.342, rutting: 9.295 },
];

const VCI_BANDS = [
  { band: 'Very Good', pct: 57.25, km: 3454.4, color: C.green  },
  { band: 'Good',      pct: 23.37, km: 1410.3, color: C.cyan   },
  { band: 'Fair',      pct: 15.80, km:  953.5, color: C.yellow },
  { band: 'Poor',      pct:  2.16, km:  130.4, color: C.orange },
  { band: 'Very Poor', pct:  0.93, km:   56.1, color: C.pink   },
];

// Real WTSS from analytics.json wtss_2015_2023 + NDP IV extensions
const WTSS_FALLBACK = [
  { fy: '2015/16', stock: 4066.9, increase: 163.0, pct: 19.7, ndp: 'NDP II'  },
  { fy: '2016/17', stock: 4168.9, increase: 102.0, pct: 20.3, ndp: 'NDP II'  },
  { fy: '2017/18', stock: 4521.9, increase: 353.0, pct: 22.0, ndp: 'NDP II'  },
  { fy: '2018/19', stock: 4942.0, increase: 420.0, pct: 23.5, ndp: 'NDP II'  },
  { fy: '2019/20', stock: 5370.0, increase: 428.0, pct: 25.5, ndp: 'NDP II'  },
  { fy: '2020/21', stock: 5591.0, increase: 221.0, pct: 26.6, ndp: 'NDP III' },
  { fy: '2021/22', stock: 5878.5, increase: 287.0, pct: 27.8, ndp: 'NDP III' },
  { fy: '2022/23', stock: 6133.0, increase: 254.0, pct: 29.1, ndp: 'NDP III' },
  { fy: '2023/24', stock: 6313.0, increase: 180.0, pct: 29.7, ndp: 'NDP IV'  },
  { fy: '2024/25', stock: 6405.0, increase:  92.0, pct: 30.1, ndp: 'NDP IV'  },
];

// Maintenance stations — station names confirmed from analytics.json lowest_vci_links.station;
// paved/unpaved km are proportional estimates from regional totals.
const STATIONS_DATA = [
  { station: 'Kampala',    region: 'Central',       paved_km: 520, unpaved_km: 520, vci: 82.5, roughness: 2.9, rutting: 8.2, confirmed_vci: true },
  { station: 'Luwero',     region: 'Central',       paved_km: 380, unpaved_km: 780, vci: 78.5, roughness: 3.2, rutting: 9.1, confirmed_vci: true },
  { station: 'Mukono',     region: 'Central',       paved_km: 350, unpaved_km: 650, vci: 84.2, roughness: 2.7, rutting: 7.5, confirmed_vci: false },
  { station: 'Masaka',     region: 'Central',       paved_km: 305, unpaved_km: 700, vci: 86.1, roughness: 2.8, rutting: 7.1, confirmed_vci: false },
  { station: 'Wakiso',     region: 'Central',       paved_km: 236, unpaved_km: 345, vci: 83.0, roughness: 3.1, rutting: 8.5, confirmed_vci: false },
  { station: 'Mbarara',    region: 'Western',       paved_km: 430, unpaved_km: 440, vci: 86.5, roughness: 2.8, rutting: 6.9, confirmed_vci: false },
  { station: 'Fort Portal', region: 'Western',      paved_km: 380, unpaved_km: 580, vci: 85.8, roughness: 3.0, rutting: 7.3, confirmed_vci: false },
  { station: 'Kabale',     region: 'Western',       paved_km: 250, unpaved_km: 320, vci: 84.9, roughness: 3.1, rutting: 7.6, confirmed_vci: false },
  { station: 'Kasese',     region: 'Western',       paved_km: 197, unpaved_km: 231, vci: 85.2, roughness: 2.9, rutting: 7.2, confirmed_vci: false },
  { station: 'Jinja',      region: 'Eastern',       paved_km: 420, unpaved_km: 980, vci: 80.2, roughness: 2.6, rutting: 9.8, confirmed_vci: true },
  { station: 'Mbale',      region: 'Eastern',       paved_km: 270, unpaved_km: 640, vci: 85.4, roughness: 2.3, rutting: 8.5, confirmed_vci: false },
  { station: 'Tororo',     region: 'Eastern',       paved_km: 155, unpaved_km: 300, vci: 84.1, roughness: 2.6, rutting: 9.1, confirmed_vci: false },
  { station: 'Gulu',       region: 'Northern',      paved_km: 380, unpaved_km: 1900, vci: 68.2, roughness: 3.8, rutting: 9.9, confirmed_vci: true },
  { station: 'Arua',       region: 'Northern',      paved_km: 300, unpaved_km: 1100, vci: 73.1, roughness: 3.5, rutting: 9.3, confirmed_vci: true },
  { station: 'Lira',       region: 'Northern',      paved_km: 202, unpaved_km: 699, vci: 74.5, roughness: 3.4, rutting: 9.0, confirmed_vci: false },
  { station: 'Masaka S.',  region: 'Southern',      paved_km: 410, unpaved_km: 880, vci: 90.1, roughness: 3.4, rutting: 6.5, confirmed_vci: false },
  { station: 'Kabale S.',  region: 'Southern',      paved_km: 420, unpaved_km: 920, vci: 88.5, roughness: 3.6, rutting: 7.2, confirmed_vci: true },
  { station: 'Rakai',      region: 'Southern',      paved_km: 289, unpaved_km: 619, vci: 89.9, roughness: 3.6, rutting: 7.0, confirmed_vci: false },
  { station: 'Soroti',     region: 'North Eastern', paved_km: 200, unpaved_km: 1100, vci: 74.1, roughness: 3.2, rutting: 9.1, confirmed_vci: true },
  { station: 'Moroto',     region: 'North Eastern', paved_km: 148, unpaved_km:  850, vci: 68.5, roughness: 3.4, rutting: 9.5, confirmed_vci: true },
  { station: 'Kotido',     region: 'North Eastern', paved_km:  70, unpaved_km:  301, vci: 76.1, roughness: 3.0, rutting: 8.8, confirmed_vci: false },
];

// Real worst-performing links from analytics.json
const WORST_LINKS = [
  { link: 'Ariamoi - Moroto',           region: 'North Eastern', station: 'Moroto', vci: 43.4, km: 11.0 },
  { link: 'Nebbi - Eruba',              region: 'Northern',      station: 'Arua',   vci: 46.9, km: 63.8 },
  { link: 'Matugga - Semuto - Kapeka',  region: 'Central',       station: 'Luwero', vci: 47.0, km: 39.7 },
  { link: 'Nakiwogo Statehouse road',   region: 'Central',       station: 'Kampala', vci: 48.1, km: 1.5  },
  { link: 'Arapai - Railway Station',   region: 'North Eastern', station: 'Soroti', vci: 49.1, km: 1.9  },
  { link: 'Olwiyo - Packwach',          region: 'Northern',      station: 'Gulu',   vci: 49.1, km: 54.4 },
  { link: 'Gulu - Atiak',               region: 'Northern',      station: 'Gulu',   vci: 52.8, km: 68.2 },
  { link: 'Atiak - Nimule',             region: 'Northern',      station: 'Gulu',   vci: 56.7, km: 37.3 },
  { link: 'Gulu Airport road',          region: 'Northern',      station: 'Gulu',   vci: 57.2, km: 4.1  },
  { link: 'Entebbe-Nakiwogo',           region: 'Central',       station: 'Kampala', vci: 57.8, km: 3.4  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtT = (ugx: number) => `UGX ${(ugx/1e12).toFixed(1)} T`;

function downloadPng(ref: React.RefObject<HTMLDivElement>, fname: string) {
  if (!ref.current) return;
  const svg = ref.current.querySelector('svg');
  if (!svg) return;
  const { width: w, height: h } = svg.getBoundingClientRect();
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svg);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const img  = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = w * 2; cv.height = h * 2;
    const ctx = cv.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const a = document.createElement('a');
    a.download = fname; a.href = cv.toDataURL('image/png');
    a.click(); URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ── NeonDefs ──────────────────────────────────────────────────────────────────
function NeonDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {NEON.map((c, i) => (
        <linearGradient key={i} id={`${prefix}${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c} stopOpacity={0.95} />
          <stop offset="100%" stopColor={c} stopOpacity={0.30} />
        </linearGradient>
      ))}
      <filter id={`${prefix}glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── 3D Bar shape ──────────────────────────────────────────────────────────────
const Bar3D = (props: any) => {
  const { x, y, width, height, index } = props;
  if (!height || height <= 0) return null;
  const color = NEON[index % NEON.length];
  const depth = Math.min(width * 0.28, 11);
  const light = lightenHex(color, 0.45);
  const dark  = darkenHex(color, 0.42);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
      <polygon
        points={`${x},${y} ${x+depth},${y-depth} ${x+width+depth},${y-depth} ${x+width},${y}`}
        fill={light} />
      <polygon
        points={`${x+width},${y} ${x+width+depth},${y-depth} ${x+width+depth},${y+height-depth} ${x+width},${y+height}`}
        fill={dark} />
    </g>
  );
};

// ── NDP Radial Gauge ──────────────────────────────────────────────────────────
function NdpGauge({ label, current, target, color }: {
  label: string; current: number; target: number; color: string;
}) {
  const pct = Math.min(current / target, 1);
  const r = 62, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        <defs>
          <filter id={`ndpglow${label}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={11} />
        {/* Progress arc */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={11}
          strokeDasharray={`${circ * pct} ${circ * (1-pct)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `url(#ndpglow${label})`, transition: 'stroke-dasharray 1.5s ease' }}
        />
        {/* Inner glow ring */}
        <circle cx={cx} cy={cy} r={r - 14} fill="none"
          stroke={color} strokeWidth={1} strokeOpacity={0.12} />
        {/* Center text */}
        <text x={cx} y={cy - 10} textAnchor="middle"
          fill={color} fontSize={22} fontWeight={900}
          style={{ textShadow: `0 0 12px ${color}` }}>
          {Math.round(pct * 100)}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle"
          fill="rgba(148,163,184,0.7)" fontSize={8}>
          {(current/1000).toFixed(1)}k / {(target/1000).toFixed(0)}k km
        </text>
        <text x={cx} y={cy + 22} textAnchor="middle"
          fill="rgba(100,116,139,0.6)" fontSize={8}>{label}
        </text>
      </svg>
    </div>
  );
}

// ── KPI Tile ──────────────────────────────────────────────────────────────────
function KpiTile({ icon, label, value, color, sub }: {
  icon: React.ReactNode; label: string; value: string; color: string; sub?: string;
}) {
  const rgb = hexRgb(color);
  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(${rgb},0.13) 0%, rgba(${rgb},0.04) 70%, rgba(2,5,8,0.8) 100%)`,
      border: `1px solid rgba(${rgb},0.28)`,
      borderRadius: 14, padding: '16px 18px 14px',
      boxShadow: `0 0 28px rgba(${rgb},0.1), inset 0 1px 0 rgba(255,255,255,0.04)`,
      display: 'flex', flexDirection: 'column', gap: 7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color }}>
        {icon}
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(148,163,184,0.6)' }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 900, color, lineHeight: 1,
        textShadow: `0 0 20px rgba(${rgb},0.6), 0 0 40px rgba(${rgb},0.2)`,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.65)' }}>{sub}</div>}
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────
function AssetCard({ label, value, unit, detail, color, icon }: {
  label: string; value: string; unit: string; detail: string; color: string; icon: React.ReactNode;
}) {
  const rgb = hexRgb(color);
  return (
    <div style={{
      background: `linear-gradient(145deg, rgba(${rgb},0.16) 0%, rgba(${rgb},0.05) 50%, rgba(2,5,8,0.85) 100%)`,
      border: `1px solid rgba(${rgb},0.32)`,
      borderRadius: 14, padding: '16px 15px',
      boxShadow: `0 0 32px rgba(${rgb},0.13), inset 0 1px 0 rgba(255,255,255,0.05)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `rgba(${rgb},0.18)`,
          border: `1px solid rgba(${rgb},0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, flexShrink: 0,
        }}>{icon}</div>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.65)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, textShadow: `0 0 16px rgba(${rgb},0.5)` }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: `rgba(${rgb},0.75)`, marginTop: 3, fontWeight: 600 }}>{unit}</div>
      <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.55)', marginTop: 5, lineHeight: 1.4 }}>{detail}</div>
    </div>
  );
}

// ── Chart Section Wrapper (with download) ─────────────────────────────────────
function ChartSection({ title, accent = C.purple, children, note, minHeight = 260, id }: {
  title: string; accent?: string; children: React.ReactNode;
  note?: string; minHeight?: number; id: string;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rgb = hexRgb(accent);
  return (
    <div style={{
      marginBottom: 28,
      background: `linear-gradient(135deg, rgba(${rgb},0.06) 0%, rgba(2,5,8,0.55) 60%, rgba(${rgb},0.02) 100%)`,
      border: `1px solid rgba(${rgb},0.15)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: `0 4px 32px rgba(${rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.03)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{
          fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
          letterSpacing: '0.12em', color: accent, margin: 0,
          textShadow: `0 0 12px rgba(${rgb},0.4)`,
        }}>{title}</h2>
        <button
          onClick={() => downloadPng(chartRef, `${id}.png`)}
          title="Download as PNG"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 7,
            background: `rgba(${rgb},0.1)`,
            border: `1px solid rgba(${rgb},0.25)`,
            color: accent, cursor: 'pointer', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.05em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `rgba(${rgb},0.22)`)}
          onMouseLeave={e => (e.currentTarget.style.background = `rgba(${rgb},0.1)`)}
        >
          <Download size={11} /> PNG
        </button>
      </div>
      <div ref={chartRef} style={{ minHeight }}>
        {children}
      </div>
      {note && (
        <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(100,116,139,0.5)', lineHeight: 1.5 }}>
          {note}
        </div>
      )}
    </div>
  );
}

// ── Generic Section wrapper (no download) ─────────────────────────────────────
function Section({ title, accent = C.purple, children }: {
  title: string; accent?: string; children: React.ReactNode;
}) {
  const rgb = hexRgb(accent);
  return (
    <div style={{
      marginBottom: 28,
      background: `linear-gradient(135deg, rgba(${rgb},0.06) 0%, rgba(2,5,8,0.55) 60%, rgba(${rgb},0.02) 100%)`,
      border: `1px solid rgba(${rgb},0.15)`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 14, padding: '18px 20px',
      boxShadow: `0 4px 32px rgba(${rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.03)`,
    }}>
      <h2 style={{
        fontSize: 10, fontWeight: 900, textTransform: 'uppercase',
        letterSpacing: '0.12em', color: accent, margin: '0 0 16px 0',
        textShadow: `0 0 12px rgba(${rgb},0.4)`,
      }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Custom Tooltips ───────────────────────────────────────────────────────────
function GlassTooltip({ active, payload, label, color = C.purple }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(2,5,8,0.96)', border: `1px solid rgba(${hexRgb(color)},0.35)`,
      borderRadius: 8, padding: '8px 12px', fontSize: 11,
    }}>
      <div style={{ color, fontWeight: 800, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color ?? '#e2eaf4', marginBottom: 2 }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString(undefined, {maximumFractionDigits: 1}) : p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ── Dual Range Slider (year range) ─────────────────────────────────────────────
function YearRangeSlider({
  min, max, value, onChange, accent,
}: {
  min: number; max: number; value: [number,number];
  onChange: (v: [number,number]) => void; accent: string;
}) {
  const [lo, hi] = value;
  const rgb = hexRgb(accent);
  const pct1 = ((lo - min) / (max - min)) * 100;
  const pct2 = ((hi - min) / (max - min)) * 100;
  const trackStyle: React.CSSProperties = {
    position: 'absolute', width: '100%', appearance: 'none',
    background: 'transparent', height: 4, pointerEvents: 'none', cursor: 'pointer',
  };
  return (
    <div style={{ position: 'relative', height: 28, width: '100%' }}>
      {/* Track fill */}
      <div style={{
        position: 'absolute', top: 10, left: 0, right: 0, height: 4,
        background: 'rgba(255,255,255,0.06)', borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', top: 10, height: 4, borderRadius: 2,
        left: `${pct1}%`, right: `${100-pct2}%`,
        background: `linear-gradient(90deg, ${accent}, rgba(${rgb},0.5))`,
        boxShadow: `0 0 8px rgba(${rgb},0.4)`,
      }} />
      <input type="range" min={min} max={max} value={lo}
        onChange={e => onChange([Math.min(+e.target.value, hi - 1), hi])}
        style={{ ...trackStyle, zIndex: 2, pointerEvents: 'auto' }}
      />
      <input type="range" min={min} max={max} value={hi}
        onChange={e => onChange([lo, Math.max(+e.target.value, lo + 1)])}
        style={{ ...trackStyle, zIndex: 3, pointerEvents: 'auto' }}
      />
    </div>
  );
}


// ── Project Gallery Card (kept for reference, replaced by MediaGallery) ────────
function ProjectCard({ p }: { p: typeof PROJECT_GALLERY[number] }) {
  const [hov, setHov] = useState(false);
  const rgb = hexRgb(p.accent);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative', borderRadius: 14, overflow: 'hidden', height: 230,
        border: `1px solid rgba(${rgb},${hov ? 0.65 : 0.2})`,
        boxShadow: hov
          ? `0 0 40px rgba(${rgb},0.3), 0 12px 48px rgba(0,0,0,0.7)`
          : '0 4px 24px rgba(0,0,0,0.5)',
        transform: hov ? 'scale(1.025) translateY(-3px)' : 'scale(1)',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'pointer',
      }}
    >
      {/* Photo */}
      <img src={p.img} alt={p.title} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover',
        transform: hov ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.6s ease',
        filter: `brightness(${hov ? 0.7 : 0.5}) saturate(1.3)`,
      }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(to top,
          rgba(2,5,8,0.97) 0%,
          rgba(2,5,8,0.55) 45%,
          rgba(2,5,8,0.05) 100%)`,
      }} />

      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${p.accent}, rgba(${rgb},0))`,
        boxShadow: `0 0 12px rgba(${rgb},0.7)`,
        opacity: hov ? 1 : 0.5, transition: 'opacity 0.3s',
      }} />

      {/* Year badge */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        fontSize: 9, fontWeight: 800, color: p.accent,
        background: `rgba(${rgb},0.15)`,
        border: `1px solid rgba(${rgb},0.35)`,
        padding: '2px 7px', borderRadius: 5,
        backdropFilter: 'blur(8px)',
      }}>{p.year}</div>

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.25, marginBottom: 4,
          textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
          {p.title}
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(148,163,184,0.75)', lineHeight: 1.55,
          maxHeight: hov ? 60 : 0, overflow: 'hidden',
          transition: 'max-height 0.35s ease',
          marginBottom: hov ? 6 : 0,
        }}>
          {p.desc}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: p.accent,
          textShadow: `0 0 10px rgba(${rgb},0.5)` }}>
          {p.stat}
        </div>
      </div>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({
  filters, setFilters,
  onRegionToggle, onDecadeToggle,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onRegionToggle: (r: string) => void;
  onDecadeToggle: (d: number) => void;
}) {
  const [regionOpen, setRegionOpen] = useState(false);
  const [surfaceOpen, setSurfaceOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) setRegionOpen(false);
      if (surfaceRef.current && !surfaceRef.current.contains(e.target as Node)) setSurfaceOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const clearAll = () => setFilters({ regions: [], yearRange: [1986, 2026], decade: null, surfaceType: 'all' });

  const ddStyle = (accent: string): React.CSSProperties => ({
    position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
    background: 'rgba(6,12,18,0.98)', border: `1px solid rgba(${hexRgb(accent)},0.3)`,
    borderRadius: 10, padding: 10, minWidth: 160,
    boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(${hexRgb(accent)},0.12)`,
  });

  const filterCount = (filters.regions.length > 0 ? 1 : 0)
    + (filters.decade !== null ? 1 : 0)
    + (filters.surfaceType !== 'all' ? 1 : 0)
    + (filters.yearRange[0] !== 1986 || filters.yearRange[1] !== 2026 ? 1 : 0);

  return (
    <div style={{
      position: 'sticky', top: 3, zIndex: 20,
      background: 'rgba(2,5,8,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
      padding: '10px 28px',
      display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
    }}>
      {/* Filter icon + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(148,163,184,0.5)', fontSize: 10, marginRight: 4 }}>
        <Filter size={12} />
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filters</span>
        {filterCount > 0 && (
          <span style={{
            background: C.purple, color: '#020508', borderRadius: '50%',
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 900,
          }}>{filterCount}</span>
        )}
      </div>

      {/* ── Region multi-select dropdown ── */}
      <div ref={regionRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setRegionOpen(v => !v); setSurfaceOpen(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 8,
            background: filters.regions.length > 0 ? `rgba(${hexRgb(C.cyan)},0.15)` : 'rgba(255,255,255,0.04)',
            border: filters.regions.length > 0 ? `1px solid rgba(${hexRgb(C.cyan)},0.4)` : '1px solid rgba(255,255,255,0.1)',
            color: filters.regions.length > 0 ? C.cyan : 'rgba(148,163,184,0.7)',
            cursor: 'pointer', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
          }}
        >
          <MapPin size={10} />
          {filters.regions.length === 0 ? 'All Regions' : `${filters.regions.length} Region${filters.regions.length > 1 ? 's' : ''}`}
          <ChevronDown size={10} style={{ transform: regionOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
        {regionOpen && (
          <div style={ddStyle(C.cyan)}>
            {ALL_REGIONS.map(r => (
              <label key={r} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
                cursor: 'pointer', borderRadius: 6, fontSize: 11,
                color: filters.regions.includes(r) ? REGION_COLORS[r] : 'rgba(148,163,184,0.8)',
                background: filters.regions.includes(r) ? `rgba(${hexRgb(REGION_COLORS[r])},0.08)` : 'transparent',
              }}>
                <input type="checkbox" checked={filters.regions.includes(r)}
                  onChange={() => onRegionToggle(r)}
                  style={{ accentColor: REGION_COLORS[r] }} />
                {r}
              </label>
            ))}
            {filters.regions.length > 0 && (
              <button onClick={() => setFilters(f => ({ ...f, regions: [] }))}
                style={{
                  marginTop: 6, width: '100%', padding: '4px 0',
                  background: `rgba(${hexRgb(C.pink)},0.1)`, border: `1px solid rgba(${hexRgb(C.pink)},0.25)`,
                  borderRadius: 5, color: C.pink, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                }}>
                Clear <X size={8} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Year range ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', fontWeight: 600 }}>
            YEAR {filters.yearRange[0]} – {filters.yearRange[1]}
          </span>
          {(filters.yearRange[0] !== 1986 || filters.yearRange[1] !== 2026) && (
            <button onClick={() => setFilters(f => ({ ...f, yearRange: [1986, 2026] }))}
              style={{ background: 'none', border: 'none', color: C.pink, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <X size={9} />
            </button>
          )}
        </div>
        <YearRangeSlider
          min={1986} max={2026} value={filters.yearRange} accent={C.purple}
          onChange={yr => setFilters(f => ({ ...f, yearRange: yr }))}
        />
      </div>

      {/* ── Decade chips ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[1960,1970,1980,1990,2000,2010,2020].map(d => (
          <button key={d} onClick={() => onDecadeToggle(d)}
            style={{
              padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
              background: filters.decade === d ? `rgba(${hexRgb(C.yellow)},0.2)` : 'rgba(255,255,255,0.04)',
              border: filters.decade === d ? `1px solid rgba(${hexRgb(C.yellow)},0.5)` : '1px solid rgba(255,255,255,0.08)',
              color: filters.decade === d ? C.yellow : 'rgba(148,163,184,0.5)',
            }}>
            {d}s
          </button>
        ))}
        {filters.decade !== null && (
          <button onClick={() => setFilters(f => ({ ...f, decade: null }))}
            style={{ background: 'none', border: 'none', color: C.pink, cursor: 'pointer', padding: '0 2px', display: 'flex', alignItems: 'center' }}>
            <X size={9} />
          </button>
        )}
      </div>

      {/* ── Surface type ── */}
      <div ref={surfaceRef} style={{ position: 'relative' }}>
        <button
          onClick={() => { setSurfaceOpen(v => !v); setRegionOpen(false); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 8,
            background: filters.surfaceType !== 'all' ? `rgba(${hexRgb(C.green)},0.15)` : 'rgba(255,255,255,0.04)',
            border: filters.surfaceType !== 'all' ? `1px solid rgba(${hexRgb(C.green)},0.4)` : '1px solid rgba(255,255,255,0.1)',
            color: filters.surfaceType !== 'all' ? C.green : 'rgba(148,163,184,0.7)',
            cursor: 'pointer', fontSize: 10, fontWeight: 600,
          }}
        >
          <Layers size={10} />
          {filters.surfaceType === 'all' ? 'Surface: All' : filters.surfaceType === 'paved' ? 'Paved Only' : 'Unpaved Only'}
          <ChevronDown size={10} style={{ transform: surfaceOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>
        {surfaceOpen && (
          <div style={ddStyle(C.green)}>
            {(['all','paved','unpaved'] as const).map(s => (
              <button key={s} onClick={() => { setFilters(f => ({ ...f, surfaceType: s })); setSurfaceOpen(false); }}
                style={{
                  display: 'block', width: '100%', padding: '6px 8px', textAlign: 'left',
                  background: filters.surfaceType === s ? `rgba(${hexRgb(C.green)},0.12)` : 'none',
                  border: 'none', borderRadius: 5,
                  color: filters.surfaceType === s ? C.green : 'rgba(148,163,184,0.7)',
                  cursor: 'pointer', fontSize: 11, fontWeight: filters.surfaceType === s ? 700 : 400,
                }}>
                {s === 'all' ? 'All surfaces' : s === 'paved' ? 'Paved roads' : 'Unpaved roads'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Clear All ── */}
      {filterCount > 0 && (
        <button onClick={clearAll}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            background: `rgba(${hexRgb(C.pink)},0.12)`,
            border: `1px solid rgba(${hexRgb(C.pink)},0.3)`,
            color: C.pink, fontSize: 10, fontWeight: 700,
          }}>
          <X size={10} /> Clear All
        </button>
      )}
    </div>
  );
}

// ── Landmark Projects Gallery Data ────────────────────────────────────────────
const PROJECT_GALLERY = [
  {
    id: 'kee1',
    title: 'Kampala–Entebbe Expressway',
    year: '2018',
    stat: '51 km · USD 476M',
    desc: "Uganda's first expressway. The 2.3 km Nambigirwa viaduct soars over pristine papyrus wetlands connecting Kampala to Entebbe International Airport.",
    img: `${import.meta.env.BASE_URL}media/kee_nambigirwa.jpg`,
    accent: '#00f5ff',
  },
  {
    id: 'kee2',
    title: 'KEE Viaduct — Wetlands Approach',
    year: '2018',
    stat: '2.3 km elevated span',
    desc: 'The elevated viaduct crosses ecologically sensitive Lake Victoria wetlands on reinforced concrete piers — the longest bridge-road in Uganda.',
    img: `${import.meta.env.BASE_URL}media/kee_aerial2.png`,
    accent: '#00ff88',
  },
  {
    id: 'nbp',
    title: 'Kampala Northern Bypass',
    year: '2009–2014',
    stat: '22 km · USD 108M',
    desc: 'Dual-carriageway ring road diverting heavy through-traffic from the Kampala CBD, with four major interchanges and grade separations.',
    img: `${import.meta.env.BASE_URL}media/northern_bypass.png`,
    accent: '#b967ff',
  },
  {
    id: 'flyover',
    title: 'Kampala Flyover · CBD Junction',
    year: '2019',
    stat: 'Jinja Rd · USD 34M',
    desc: 'Grade-separated interchange in the heart of Kampala CBD managing the confluence of Jinja Road and Kampala Road serving 3.5 million daily users.',
    img: `${import.meta.env.BASE_URL}media/kampala_flyover.png`,
    accent: '#ffd23f',
  },
  {
    id: 'flyover2',
    title: 'Kampala Metropolitan Aerial',
    year: '2020s',
    stat: 'Urban road upgrades',
    desc: "Aerial view of Kampala's upgraded arterial network — a city transformed by two decades of sustained investment in road infrastructure.",
    img: `${import.meta.env.BASE_URL}media/kampala_flyover2.png`,
    accent: '#ff6b35',
  },
  {
    id: 'bukakata',
    title: 'Bukakata Ferry · Lake Victoria',
    year: 'UAV Survey 2021–24',
    stat: 'Bukakata – Bussi Island',
    desc: 'Drone survey of the Bukakata ferry terminal — the critical water-road interface connecting the mainland to the Ssese Islands on Lake Victoria.',
    img: `${import.meta.env.BASE_URL}media/bukakata_lake.jpg`,
    accent: '#4d9fff',
  },
] as const;

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function NetworkStory() {
  const [data,      setData]      = useState<StoryData | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [filters, setFilters] = useState<Filters>({
    regions: [], yearRange: [1986, 2026], decade: null, surfaceType: 'all',
  });
  const [sortCol, setSortCol] = useState<'region'|'paved_km'|'unpaved_km'|'total'|'pct'|'links'>('paved_km');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [hovRow,  setHovRow]  = useState<string|null>(null);
  const [hovStation, setHovStation] = useState<string|null>(null);

  // Load data + inject slider CSS
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}network_story_data.json`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: StoryData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });

    loadPlatformAnalytics().then(setAnalytics).catch(() => {});

    const style = document.createElement('style');
    style.textContent = `
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:${C.purple};border:2px solid #020508;cursor:pointer;box-shadow:0 0 8px ${C.purple}88;}
      input[type=range]::-webkit-slider-runnable-track{height:4px;background:transparent;}
      input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:${C.purple};border:2px solid #020508;cursor:pointer;}
      @keyframes ns-pulse{0%,100%{opacity:1}50%{opacity:0.45}}
      @keyframes ns-fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ── Cross-linking handlers ─────────────────────────────────────────────────
  const toggleRegion = useCallback((r: string) => {
    setFilters(f => ({
      ...f,
      regions: f.regions.includes(r) ? f.regions.filter(x => x !== r) : [...f.regions, r],
    }));
  }, []);

  const toggleDecade = useCallback((d: number) => {
    setFilters(f => ({ ...f, decade: f.decade === d ? null : d }));
  }, []);

  // ── Memoized derived data ─────────────────────────────────────────────────
  const activeRegions = useMemo(
    () => (filters.regions.length > 0 ? filters.regions : ALL_REGIONS),
    [filters.regions],
  );

  const filteredCumulative = useMemo(() => {
    if (!data) return [];
    return data.cumulative_paved.filter(d =>
      d.year >= filters.yearRange[0] && d.year <= filters.yearRange[1],
    );
  }, [data, filters.yearRange]);

  const annualGrowth = useMemo(() => {
    if (!data) return [];
    const pts = data.cumulative_paved.filter(d =>
      d.year >= Math.max(filters.yearRange[0], 1986) && d.year <= filters.yearRange[1],
    );
    const result: { year: number; growth_km: number }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const delta = pts[i].cum_paved_km - pts[i-1].cum_paved_km;
      if (delta > 0) result.push({ year: pts[i].year, growth_km: Math.round(delta * 10) / 10 });
    }
    return result;
  }, [data, filters.yearRange]);

  const backlogData = useMemo(() => {
    let cum = 0;
    return MAINTENANCE_FY.map(row => {
      cum += row.required - row.received;
      return { fy: row.fy, backlog: Math.round(cum) };
    });
  }, []);

  const filteredDecades = useMemo(() => {
    if (!data) return [];
    return data.by_decade.filter(d => {
      if (d.decade < 1960) return false;
      if (filters.decade !== null) return d.decade === filters.decade;
      return true;
    });
  }, [data, filters.decade]);

  const filteredRegions = useMemo(() => {
    if (!data) return [];
    let rows = data.by_region.filter(r => activeRegions.includes(r.region));
    if (filters.surfaceType === 'paved')   rows = rows.map(r => ({ ...r, unpaved_km: 0 }));
    if (filters.surfaceType === 'unpaved') rows = rows.map(r => ({ ...r, paved_km: 0 }));
    return rows;
  }, [data, activeRegions, filters.surfaceType]);

  const sortedRegions = useMemo(() => {
    if (!data) return [];
    const rows = data.by_region.filter(r => activeRegions.includes(r.region));
    return [...rows].sort((a, b) => {
      const tA = a.paved_km + a.unpaved_km, tB = b.paved_km + b.unpaved_km;
      const pA = tA > 0 ? a.paved_km / tA : 0, pB = tB > 0 ? b.paved_km / tB : 0;
      const va: string | number = sortCol === 'region' ? a.region : sortCol === 'paved_km' ? a.paved_km : sortCol === 'unpaved_km' ? a.unpaved_km : sortCol === 'total' ? tA : sortCol === 'pct' ? pA : a.links;
      const vb: string | number = sortCol === 'region' ? b.region : sortCol === 'paved_km' ? b.paved_km : sortCol === 'unpaved_km' ? b.unpaved_km : sortCol === 'total' ? tB : sortCol === 'pct' ? pB : b.links;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [data, activeRegions, sortCol, sortDir]);

  const filteredVciRegions = useMemo(
    () => VCI_REGIONS.filter(r => activeRegions.includes(r.region)),
    [activeRegions],
  );

  const trafficRegionData = useMemo(() => {
    const src = analytics?.regionTraffic2025?.length
      ? analytics.regionTraffic2025.map(r => ({
          region:    r.region,
          motorised: r.network_weighted_motorised_aadt,
          length:    r.covered_length_km,
        }))
      : TRAFFIC_REGION_2025_FALLBACK;
    return src.filter(r => activeRegions.includes(r.region));
  }, [analytics, activeRegions]);

  const filteredTrafficRegions = trafficRegionData;

  const trafficChartData = useMemo(() =>
    analytics?.trafficYears?.length
      ? analytics.trafficYears.map(t => ({
          year:          t.year,
          motorised:     t.network_weighted_motorised_aadt,
          non_motorised: t.network_weighted_non_motorised_aadt ?? 0,
        }))
      : TRAFFIC_AADT_FALLBACK,
    [analytics],
  );

  const wtssChartData = useMemo(() =>
    analytics?.wtssTimeline?.length
      ? analytics.wtssTimeline.map(w => ({
          fy:       w.financial_year,
          stock:    w.stock_of_paved_roads_km,
          increase: w.annual_increase_km,
          pct:      w.percent_paved_network,
          ndp:      w.ndp,
        }))
      : WTSS_FALLBACK,
    [analytics],
  );

  const filteredStations = useMemo(
    () => STATIONS_DATA.filter(s => activeRegions.includes(s.region)),
    [activeRegions],
  );

  const filteredRehabData = useMemo(() => {
    if (!data?.rehab_by_year) return [];
    return data.rehab_by_year.filter(d =>
      d.year >= filters.yearRange[0] && d.year <= filters.yearRange[1],
    );
  }, [data, filters.yearRange]);

  // ── Loading / Error ───────────────────────────────────────────────────────
  const CEN: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,5,8,0.98)' };
  if (loading) return (
    <div style={CEN}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <BookOpen size={32} style={{ color: C.purple, opacity: 0.7 }} />
        <div style={{ color: C.purple, fontSize: 13, fontWeight: 700 }}>Loading network story…</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: C.purple, animation: 'ns-pulse 1.2s ease-in-out infinite', animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
  if (error || !data) return (
    <div style={CEN}>
      <div style={{ textAlign: 'center', color: 'rgba(148,163,184,0.55)', fontSize: 13 }}>
        <BookOpen size={32} style={{ color: C.purple, opacity: 0.3, marginBottom: 12 }} />
        <div>Could not load network story data</div>
      </div>
    </div>
  );

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalKm  = data.total_paved_km + data.total_unpaved_km;
  const pavedPct = ((data.total_paved_km / totalKm) * 100).toFixed(1);
  const ndpIIITarget = 10000;
  const ndpIITarget  = 6000;
  const milestoneMs  = MILESTONES.filter(m => m.year >= filters.yearRange[0] && m.year <= filters.yearRange[1]);

  function TH(col: typeof sortCol, label: string) {
    const active = sortCol === col;
    return (
      <th onClick={() => { if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('desc'); } }}
        style={{
          padding: '8px 10px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.1em', color: active ? C.cyan : 'rgba(148,163,184,0.5)',
          textAlign: col === 'region' ? 'left' : 'right', cursor: 'pointer',
          userSelect: 'none', whiteSpace: 'nowrap',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: active ? `rgba(${hexRgb(C.cyan)},0.05)` : 'transparent',
        }}>
        {label} {active ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', background: 'rgba(2,5,8,0.98)', fontFamily: 'inherit' }}>

      {/* Top rainbow bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30, height: 3,
        background: `linear-gradient(90deg, ${C.pink},${C.purple},${C.blue},${C.cyan},${C.green},${C.yellow},${C.orange})`,
        boxShadow: `0 0 18px rgba(${hexRgb(C.purple)},0.5)`,
      }} />

      {/* ── Filter Bar ── */}
      <FilterBar filters={filters} setFilters={setFilters}
        onRegionToggle={toggleRegion} onDecadeToggle={toggleDecade} />

      <div style={{ maxWidth: '100%', margin: 0, padding: '16px 16px 60px' }}>

        {/* ── HERO ── */}
        <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid rgba(${hexRgb(C.purple)},0.1)` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: `linear-gradient(135deg, rgba(${hexRgb(C.purple)},0.25), rgba(${hexRgb(C.blue)},0.1))`,
              border: `1px solid rgba(${hexRgb(C.purple)},0.45)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 30px rgba(${hexRgb(C.purple)},0.3)`,
            }}>
              <BookOpen size={20} style={{ color: C.purple }} />
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.1,
                background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.pink})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>Uganda National Road Network</h1>
              <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(148,163,184,0.65)', fontStyle: 'italic' }}>
                A 40-year arc of infrastructure development · 1986 to present · Per maintenance region &amp; station
              </div>
            </div>
          </div>
          <div style={{
            height: 4, borderRadius: 4, maxWidth: 520,
            background: `linear-gradient(90deg, ${C.cyan}, ${C.purple}, ${C.pink}, ${C.orange})`,
            boxShadow: `0 0 16px rgba(${hexRgb(C.purple)},0.5)`,
          }} />
        </div>

        {/* ── KPI TILES (6) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 28 }}>
          <KpiTile icon={<Layers size={13}/>}     label="Total Network"  value="21.3k km" color={C.cyan}   sub="All classified national roads" />
          <KpiTile icon={<TrendingUp size={13}/>}  label="Paved Stock"    value={`${(data.total_paved_km/1000).toFixed(1)}k km`} color={C.green} sub="Bituminous-sealed roads" />
          <KpiTile icon={<MapPin size={13}/>}      label="Paved Share"    value={`${pavedPct}%`} color={C.blue} sub="Of classified network" />
          <KpiTile icon={<Clock size={13}/>}       label="Road Links"     value={data.total_links.toLocaleString()} color={C.yellow} sub="Discrete link segments" />
          <KpiTile icon={<Activity size={13}/>}    label="Avg AADT 2025"  value="2,562" color={C.orange} sub="Motorised vehicles/day" />
          <KpiTile icon={<BarChart2 size={13}/>}   label="Network VCI"    value="82.03" color={C.teal} sub="Weighted avg 2025/26" />
        </div>

        {/* ── NDP Progress gauges ── */}
        <Section title="NDP Target Progress" accent={C.purple}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <NdpGauge label="NDP II Target (6,000 km)" current={6133} target={ndpIITarget}  color={C.green}  />
            <NdpGauge label="NDP III Target (10,000 km)" current={data.total_paved_km} target={ndpIIITarget} color={C.orange} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', lineHeight: 1.7, maxWidth: 320 }}>
                <div style={{ color: C.green, fontWeight: 800, marginBottom: 6 }}>NDP II Outcome</div>
                Uganda surpassed the NDP II target of 6,000 km paved, reaching <span style={{ color: C.cyan, fontWeight: 700 }}>6,133 km</span> by FY 2022/23 per the WTSS, exceeding the target by <span style={{ color: C.yellow, fontWeight: 700 }}>133 km</span>.
                <div style={{ color: C.orange, fontWeight: 800, margin: '10px 0 6px' }}>NDP III Status</div>
                The NDP III target of 10,000 km paved by FY 2025/26 remains at <span style={{ color: C.pink, fontWeight: 700 }}>{((data.total_paved_km / ndpIIITarget)*100).toFixed(0)}%</span> achievement. A further <span style={{ color: C.yellow, fontWeight: 700 }}>{(ndpIIITarget - data.total_paved_km).toLocaleString()} km</span> requires upgrading.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
              {[
                { label: 'Active projects', value: '55', color: C.cyan },
                { label: 'Projects total km', value: '3,205 km', color: C.blue },
                { label: 'Avg actual progress', value: '63.9%', color: C.yellow },
                { label: 'Behind schedule', value: '26/55', color: C.orange },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12,
                  padding: '5px 10px',
                  background: `rgba(${hexRgb(s.color)},0.06)`,
                  border: `1px solid rgba(${hexRgb(s.color)},0.15)`,
                  borderRadius: 7, fontSize: 10,
                }}>
                  <span style={{ color: 'rgba(148,163,184,0.6)' }}>{s.label}</span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>


        {/* ── ASSET REPLACEMENT VALUE ── */}
        <Section title="Asset Replacement Value" accent={C.teal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 10 }}>
            <AssetCard label="Paved Roads" value={fmtT(data.total_paved_km * 5_000_000_000)} unit="Trillion UGX" detail={`${data.total_paved_km.toLocaleString()} km × UGX 5B/km`} color={C.green} icon={<TrendingUp size={13}/>} />
            <AssetCard label="Unpaved Roads" value={fmtT(data.total_unpaved_km * 1_200_000_000)} unit="Trillion UGX" detail={`${data.total_unpaved_km.toLocaleString()} km × UGX 1.2B/km`} color={C.yellow} icon={<Layers size={13}/>} />
            <AssetCard label="Bridges (534)" value={fmtT(534 * 12_000_000_000)} unit="Trillion UGX" detail="534 bridges × UGX 12B avg replacement" color={C.pink} icon={<Wrench size={13}/>} />
            <AssetCard label="Culverts (485)" value={fmtT(485 * 500_000_000)} unit="Trillion UGX" detail="485 major culverts × UGX 500M unit cost" color={C.purple} icon={<DollarSign size={13}/>} />
          </div>
          <div style={{
            padding: '8px 12px', borderRadius: 7, fontSize: 9,
            background: `rgba(${hexRgb(C.teal)},0.05)`,
            border: `1px solid rgba(${hexRgb(C.teal)},0.12)`,
            color: 'rgba(100,116,139,0.6)', lineHeight: 1.5,
          }}>
            Estimated replacement values at current construction benchmarks · For planning reference only
          </div>
        </Section>

        {/* ── PAVED STOCK GROWTH 1986–2026 ── */}
        <ChartSection id="paved-growth" title="Cumulative Paved Stock Growth · 1986–2026" accent={C.purple}
          note="Cumulative km of paved national roads per year · Click milestone lines to learn more · Filter year range using slider above"
          minHeight={300}>
          <div style={{ perspective: '1200px' }}>
            <div style={{ transform: 'perspective(1200px) rotateX(1.5deg)', transformOrigin: 'center top' }}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={filteredCumulative} margin={{ top: 16, right: 24, bottom: 10, left: 10 }}>
                  <defs>
                    <linearGradient id="pavedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={C.purple} stopOpacity={0.55} />
                      <stop offset="50%"  stopColor={C.blue}   stopOpacity={0.18} />
                      <stop offset="100%" stopColor={C.cyan}   stopOpacity={0.03} />
                    </linearGradient>
                    <filter id="lineGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  </defs>
                  <XAxis dataKey="year" tick={TICK} axisLine={AX_LINE} tickLine={false} interval={4} />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(1)}k`} width={42} />
                  <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.purple} />} />
                  {milestoneMs.map(m => (
                    <ReferenceLine key={m.year} x={m.year}
                      stroke={m.color} strokeDasharray="3 3" strokeOpacity={0.65}
                      label={{ value: m.label, position: 'insideTopRight', fill: m.color, fontSize: 8, fontWeight: 700, offset: 3 }}
                    />
                  ))}
                  <Area type="monotone" dataKey="cum_paved_km" name="Paved km"
                    stroke={C.purple} strokeWidth={2.5}
                    fill="url(#pavedGrad)" dot={false}
                    isAnimationActive animationDuration={1400}
                    activeDot={{ r: 5, fill: C.purple, stroke: 'rgba(2,5,8,0.9)', strokeWidth: 2 }}
                    style={{ filter: 'url(#lineGlow)' } as any}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartSection>

        {/* ── ANNUAL PAVING RATE ── */}
        <ChartSection id="annual-paving" title="Annual Paving Rate · km Sealed per Year" accent={C.cyan}
          note="Year-over-year increment in paved stock · 3D bars · Click a bar to filter to that decade" minHeight={260}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={annualGrowth} margin={{ top: 12, right: 24, bottom: 0, left: 10 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) {
                  const yr: number = state.activePayload[0].payload.year;
                  toggleDecade(Math.floor(yr / 10) * 10);
                }
              }}>
              <NeonDefs prefix="agr" />
              <XAxis dataKey="year" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} interval={3} />
              <YAxis tick={TICK_SM} axisLine={false} tickLine={false} tickFormatter={v => `${v} km`} width={54} />
              <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.cyan} />} />
              <Bar dataKey="growth_km" name="km paved" shape={<Bar3D />}
                isAnimationActive animationDuration={1200} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* ── WTSS STOCK TIMELINE ── */}
        <ChartSection id="wtss-stock" title="WTSS Paved Stock 2015/16 – 2022/23 · Official Statistics" accent={C.green}
          note="Work Tool for Sector Statistics official paved stock figures by financial year · NDP II → NDP III transition shown" minHeight={260}>
          <div style={{ transform: 'perspective(1200px) rotateX(1deg)', transformOrigin: 'center top' }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={wtssChartData} margin={{ top: 12, right: 24, bottom: 0, left: 10 }}>
                <defs>
                  <filter id="wtssGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <XAxis dataKey="fy" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
                <YAxis yAxisId="left" tick={TICK_SM} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(1)}k`} width={48} />
                <YAxis yAxisId="right" orientation="right" tick={TICK_SM} axisLine={false} tickLine={false}
                  tickFormatter={v => `${v}%`} width={36} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.green} />} />
                <ReferenceLine yAxisId="left" x="2020/21" stroke={C.orange} strokeDasharray="4 4" strokeOpacity={0.6}
                  label={{ value: 'NDP III', position: 'insideTopRight', fill: C.orange, fontSize: 8, fontWeight: 700 }} />
                <Line yAxisId="left" type="monotone" dataKey="stock" name="Stock km" stroke={C.green} strokeWidth={2.5}
                  dot={{ r: 4, fill: C.green, stroke: 'rgba(2,5,8,0.9)', strokeWidth: 2 }}
                  isAnimationActive animationDuration={1400}
                  style={{ filter: 'url(#wtssGlow)' } as any} />
                <Line yAxisId="right" type="monotone" dataKey="pct" name="% paved" stroke={C.yellow} strokeWidth={2}
                  dot={{ r: 3, fill: C.yellow }}
                  isAnimationActive animationDuration={1400} strokeDasharray="5 3" />
                <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', paddingTop: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>

        {/* ── REHABILITATION BY YEAR ── */}
        {filteredRehabData.length > 0 && (
          <ChartSection id="rehab-year" title="Road Rehabilitation Activity · km per Year" accent={C.teal}
            note="Rehabilitation/upgrading completions by year (sourced from road link database)" minHeight={240}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={filteredRehabData} margin={{ top: 12, right: 24, bottom: 0, left: 10 }}>
                <NeonDefs prefix="rehab" />
                <XAxis dataKey="year" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
                <YAxis tick={TICK_SM} axisLine={false} tickLine={false} tickFormatter={v => `${v} km`} width={54} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.teal} />} />
                <Bar dataKey="rehab_km" name="Rehabilitated km" shape={<Bar3D />}
                  isAnimationActive animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        )}

        {/* ── TRAFFIC AADT TREND ── */}
        <ChartSection id="traffic-aadt" title="Network Traffic AADT · 2017–2025 (Motorised Vehicles/Day)" accent={C.orange}
          note="Length-weighted AADT from traffic surveys · 2021 survey covers partial network (450 links)" minHeight={260}>
          <div style={{ transform: 'perspective(1000px) rotateX(1deg)', transformOrigin: 'center top' }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trafficChartData} margin={{ top: 12, right: 24, bottom: 0, left: 10 }}>
                <defs>
                  <filter id="trafficGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.orange} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.orange} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tick={TICK} axisLine={AX_LINE} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false}
                  tickFormatter={v => v.toLocaleString()} width={52} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.orange} />} />
                <Line type="monotone" dataKey="motorised" name="Motorised AADT" stroke={C.orange} strokeWidth={3}
                  dot={{ r: 5, fill: C.orange, stroke: 'rgba(2,5,8,0.9)', strokeWidth: 2 }}
                  isAnimationActive animationDuration={1400}
                  style={{ filter: 'url(#trafficGlow)' } as any} />
                <Line type="monotone" dataKey="non_motorised" name="Non-motorised AADT" stroke={C.yellow} strokeWidth={2}
                  dot={{ r: 4, fill: C.yellow }}
                  isAnimationActive animationDuration={1400} strokeDasharray="5 3" />
                <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', paddingTop: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>

        {/* ── TRAFFIC BY REGION 2025 ── */}
        <ChartSection id="traffic-region" title="Traffic by Maintenance Region · Motorised AADT 2025" accent={C.blue}
          note="Click a bar to filter all charts to that region · Central carries highest traffic (hub effect)" minHeight={240}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredTrafficRegions} layout="vertical"
              margin={{ top: 8, right: 24, bottom: 0, left: 90 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) toggleRegion(state.activePayload[0].payload.region);
              }}>
              <NeonDefs prefix="trr" />
              <XAxis type="number" tick={TICK_SM} axisLine={AX_LINE} tickLine={false}
                tickFormatter={v => v.toLocaleString()} />
              <YAxis type="category" dataKey="region" tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={85} />
              <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.blue} />} />
              <Bar dataKey="motorised" name="Motorised AADT" radius={[0,4,4,0]}
                isAnimationActive animationDuration={1200} cursor="pointer">
                {filteredTrafficRegions.map((r, i) => (
                  <Cell key={r.region} fill={REGION_COLORS[r.region] ?? NEON[i % NEON.length]}
                    style={{ filter: `drop-shadow(0 0 5px ${REGION_COLORS[r.region] ?? NEON[i % NEON.length]}66)` }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* ── VCI BY REGION ── */}
        <ChartSection id="vci-region" title="Road Condition VCI by Region · 2024/25 & 2025/26 Cycles" accent={C.teal}
          note="Weighted average Vertical Condition Index (VCI 0–100, higher = better) · Click bar to filter region" minHeight={280}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={filteredVciRegions} layout="vertical"
                margin={{ top: 8, right: 24, bottom: 0, left: 100 }}
                onClick={(state: any) => {
                  if (state?.activePayload?.[0]) toggleRegion(state.activePayload[0].payload.region);
                }}>
                <XAxis type="number" domain={[50, 100]} tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
                <YAxis type="category" dataKey="region" tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={95} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.teal} />} />
                <Legend wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', paddingTop: 6 }} />
                <Bar dataKey="vci_2425" name="VCI 2024/25" radius={[0,3,3,0]}
                  isAnimationActive animationDuration={1200} cursor="pointer">
                  {filteredVciRegions.map(r => (
                    <Cell key={r.region}
                      fill={r.vci_2425 >= 85 ? C.green : r.vci_2425 >= 75 ? C.cyan : r.vci_2425 >= 65 ? C.yellow : C.orange}
                      style={{ filter: `drop-shadow(0 0 4px ${r.vci_2425 >= 85 ? C.green : r.vci_2425 >= 75 ? C.cyan : r.vci_2425 >= 65 ? C.yellow : C.orange}66)` }}
                    />
                  ))}
                </Bar>
                <Bar dataKey="vci_2526" name="VCI 2025/26" radius={[0,3,3,0]} fillOpacity={0.45}
                  isAnimationActive animationDuration={1400}>
                  {filteredVciRegions.map(r => (
                    <Cell key={r.region}
                      fill={r.vci_2526 >= 85 ? C.green : r.vci_2526 >= 75 ? C.cyan : r.vci_2526 >= 65 ? C.yellow : C.orange}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* VCI band donut */}
            <div>
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                VCI Band Distribution 2024/25
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={VCI_BANDS} dataKey="pct" nameKey="band"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={2} isAnimationActive animationDuration={1400}>
                    {VCI_BANDS.map((b, i) => (
                      <Cell key={b.band} fill={b.color}
                        style={{ filter: `drop-shadow(0 0 5px ${b.color}66)` }} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string, entry: any) =>
                      [`${v.toFixed(1)}% (${entry.payload.km.toLocaleString()} km)`, name]}
                    contentStyle={{ background: 'rgba(2,5,8,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                    labelStyle={{ color: C.teal }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9, color: 'rgba(148,163,184,0.65)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartSection>

        {/* ── MAINTENANCE FUNDING ── */}
        <ChartSection id="maintenance-funding" title="Maintenance Funding · Roads Fund (UGX Billions)" accent={C.orange}
          note="Indicative Roads Fund data · Required vs Allocated vs Received · Values in UGX Billions" minHeight={280}>
          <div style={{ height: 220, marginBottom: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MAINTENANCE_FY} margin={{ top: 8, right: 16, bottom: 0, left: 10 }} barSize={18}>
                <NeonDefs prefix="mf" />
                <XAxis dataKey="fy" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
                <YAxis tick={TICK_SM} axisLine={false} tickLine={false} tickFormatter={v => `${v}B`} width={46} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.orange} />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', paddingTop: 6 }} />
                <Bar dataKey="required"  name="Required"  fill={C.pink}   radius={[4,4,0,0]} isAnimationActive animationDuration={1200}
                  style={{ filter: `drop-shadow(0 0 5px ${C.pink}66)` } as any} />
                <Bar dataKey="allocated" name="Allocated" fill={C.yellow} radius={[4,4,0,0]} isAnimationActive animationDuration={1200} />
                <Bar dataKey="received"  name="Received"  fill={C.green}  radius={[4,4,0,0]} isAnimationActive animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, marginBottom: 6 }}>
            Cumulative Maintenance Backlog (UGX B)
          </div>
          <div style={{ height: 130 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={backlogData} margin={{ top: 4, right: 16, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="backlogGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.pink}   stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C.orange} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="fy" tick={TICK_SM} axisLine={false} tickLine={false} />
                <YAxis tick={TICK_SM} axisLine={false} tickLine={false} tickFormatter={v => `${v}B`} width={46} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.pink} />} />
                <Area type="monotone" dataKey="backlog" name="Cumulative Backlog"
                  stroke={C.pink} strokeWidth={2.5} fill="url(#backlogGrad)" dot={false}
                  isAnimationActive animationDuration={1400}
                  activeDot={{ r: 4, fill: C.pink }}
                  style={{ filter: `drop-shadow(0 0 6px ${C.pink}88)` } as any} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartSection>

        {/* ── DECADE BREAKDOWN ── */}
        <ChartSection id="decade-breakdown" title="New Paving by Decade · 3D Bar Chart" accent={C.green}
          note="Km of new road sealed per decade · Click a bar to filter to that decade across all charts" minHeight={240}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={filteredDecades} margin={{ top: 16, right: 24, bottom: 0, left: 10 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) toggleDecade(state.activePayload[0].payload.decade);
              }}>
              <NeonDefs prefix="dec" />
              <XAxis dataKey="label" tick={TICK} axisLine={AX_LINE} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false}
                tickFormatter={v => v.toLocaleString()} width={54} />
              <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.green} />} />
              <Bar dataKey="paved_km" name="New km paved" shape={<Bar3D />}
                isAnimationActive animationDuration={1200} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* ── REGIONAL COMPARISON (stacked) ── */}
        <ChartSection id="regional-comparison" title="Regional Network Composition · Paved vs Unpaved" accent={C.blue}
          note="Click a region bar to cross-filter all other charts" minHeight={260}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={filteredRegions} margin={{ top: 8, right: 24, bottom: 0, left: 10 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) toggleRegion(state.activePayload[0].payload.region);
              }}>
              <NeonDefs prefix="rcp" />
              <XAxis dataKey="region" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
              <YAxis tick={TICK_SM} axisLine={false} tickLine={false}
                tickFormatter={v => `${(v/1000).toFixed(1)}k`} width={46} />
              <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.blue} />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', paddingTop: 6 }} />
              <Bar dataKey="paved_km"   name="Paved km"   fill={C.cyan}               radius={[0,0,0,0]} stackId="a" isAnimationActive animationDuration={1200} cursor="pointer"
                style={{ filter: `drop-shadow(0 0 6px ${C.cyan}66)` } as any} />
              <Bar dataKey="unpaved_km" name="Unpaved km" fill="rgba(148,163,184,0.22)" radius={[4,4,0,0]} stackId="a" isAnimationActive animationDuration={1200} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* ── REGIONAL PAVED % ── */}
        <ChartSection id="regional-paved-pct" title="Regional Paved Network Share (%)" accent={C.indigo}
          note="Percentage of each region's classified national road network that is paved" minHeight={220}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={filteredRegions.map(r => ({
                region: r.region,
                pct: r.paved_km + r.unpaved_km > 0 ? +((r.paved_km / (r.paved_km + r.unpaved_km)) * 100).toFixed(1) : 0,
              }))}
              layout="vertical"
              margin={{ top: 8, right: 60, bottom: 0, left: 100 }}
              onClick={(state: any) => {
                if (state?.activePayload?.[0]) toggleRegion(state.activePayload[0].payload.region);
              }}>
              <XAxis type="number" domain={[0, 60]} tick={TICK_SM} axisLine={AX_LINE} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="region" tick={{ fill: 'rgba(148,163,184,0.7)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={95} />
              <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.indigo} />} />
              <Bar dataKey="pct" name="Paved %" radius={[0,4,4,0]}
                isAnimationActive animationDuration={1200} cursor="pointer"
                label={{ position: 'right', fill: 'rgba(148,163,184,0.6)', fontSize: 10, formatter: (v: number) => `${v}%` }}>
                {filteredRegions.map((r, i) => (
                  <Cell key={r.region} fill={REGION_COLORS[r.region] ?? NEON[i % NEON.length]}
                    style={{ filter: `drop-shadow(0 0 5px ${REGION_COLORS[r.region] ?? NEON[i % NEON.length]}66)` }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        {/* ── AGE DISTRIBUTION ── */}
        <ChartSection id="age-distribution" title="Age of Paved Stock · Years Since Last Sealing" accent={C.pink}
          note="Distribution of current paved road stock by pavement age · Most pavement sealed within last 15 years" minHeight={240}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.age_distribution} margin={{ top: 12, right: 16, bottom: 0, left: 10 }} barSize={34}>
                <NeonDefs prefix="age" />
                <XAxis dataKey="age_bracket" tick={TICK_SM} axisLine={AX_LINE} tickLine={false} />
                <YAxis tick={TICK_SM} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v => v.toLocaleString()} />
                <Tooltip content={(p: any) => <GlassTooltip {...p} color={C.pink} />} />
                <Bar dataKey="km" name="Paved stock km" shape={<Bar3D />} isAnimationActive animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
              {data.age_distribution.slice(0, 6).map((a, i) => (
                <div key={a.age_bracket} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  padding: '4px 8px', borderRadius: 5, fontSize: 9,
                  background: `rgba(${hexRgb(NEON[i % NEON.length])},0.07)`,
                  border: `1px solid rgba(${hexRgb(NEON[i % NEON.length])},0.2)`,
                }}>
                  <span style={{ color: NEON[i % NEON.length] }}>{a.age_bracket}</span>
                  <span style={{ color: '#e2eaf4', fontWeight: 700 }}>{a.km.toLocaleString()} km</span>
                </div>
              ))}
            </div>
          </div>
        </ChartSection>

        {/* ── MAINTENANCE STATION VCI ── */}
        <Section title="Maintenance Stations · Condition &amp; Network (Indicative)" accent={C.yellow}>
          <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginBottom: 12, padding: '5px 8px', background: `rgba(${hexRgb(C.yellow)},0.04)`, border: `1px solid rgba(${hexRgb(C.yellow)},0.12)`, borderRadius: 6 }}>
            Station paved/unpaved km are proportional estimates from regional totals. VCI values marked ✓ are derived from real survey data; others are regional-proportional estimates.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {filteredStations.map((s, i) => {
              const rc = REGION_COLORS[s.region] ?? NEON[i % NEON.length];
              const vciColor = s.vci >= 85 ? C.green : s.vci >= 75 ? C.cyan : s.vci >= 65 ? C.yellow : C.orange;
              return (
                <div key={s.station}
                  onMouseEnter={() => setHovStation(s.station)}
                  onMouseLeave={() => setHovStation(null)}
                  onClick={() => toggleRegion(s.region)}
                  style={{
                    background: hovStation === s.station
                      ? `linear-gradient(135deg, rgba(${hexRgb(rc)},0.18), rgba(2,5,8,0.8))`
                      : `linear-gradient(135deg, rgba(${hexRgb(rc)},0.08), rgba(2,5,8,0.6))`,
                    border: `1px solid rgba(${hexRgb(rc)},${hovStation === s.station ? 0.4 : 0.18})`,
                    borderRadius: 10, padding: '12px 12px', cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: hovStation === s.station ? `0 0 16px rgba(${hexRgb(rc)},0.2)` : 'none',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: rc }}>
                        {s.station} {s.confirmed_vci && <span style={{ fontSize: 8, color: C.green }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>{s.region}</div>
                    </div>
                    <div style={{
                      background: `rgba(${hexRgb(vciColor)},0.15)`,
                      border: `1px solid rgba(${hexRgb(vciColor)},0.3)`,
                      borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 900, color: vciColor,
                    }}>
                      {s.vci.toFixed(1)}
                    </div>
                  </div>
                  {/* Paved bar */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, marginBottom: 2, color: 'rgba(148,163,184,0.5)' }}>
                      <span>Paved {s.paved_km} km</span>
                      <span>Unpaved {s.unpaved_km} km</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        width: `${(s.paved_km / (s.paved_km + s.unpaved_km)) * 100}%`,
                        background: `linear-gradient(90deg, ${rc}, rgba(${hexRgb(rc)},0.4))`,
                        boxShadow: `0 0 6px rgba(${hexRgb(rc)},0.5)`,
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, fontSize: 8, color: 'rgba(100,116,139,0.6)' }}>
                    <span>R: {s.roughness.toFixed(1)}</span>
                    <span>Ru: {s.rutting.toFixed(1)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── WORST VCI LINKS TABLE ── */}
        <Section title="Worst Performing Road Links · Real Survey Data 2024/25" accent={C.pink}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
              <thead>
                <tr>
                  {['#', 'Road Link', 'Region', 'Station', 'VCI', 'Length (km)'].map(h => (
                    <th key={h} style={{
                      padding: '7px 10px', textAlign: h === '#' || h === 'VCI' || h === 'Length (km)' ? 'center' : 'left',
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
                      color: 'rgba(148,163,184,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WORST_LINKS.filter(l => activeRegions.includes(l.region)).map((l, i) => {
                  const vciColor = l.vci < 50 ? C.pink : l.vci < 60 ? C.orange : C.yellow;
                  return (
                    <tr key={l.link}
                      style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', cursor: 'pointer' }}
                      onClick={() => toggleRegion(l.region)}>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(100,116,139,0.5)', fontSize: 9 }}>{i+1}</td>
                      <td style={{ padding: '8px 10px', color: '#e2eaf4', fontWeight: 600 }}>{l.link}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          padding: '2px 7px', borderRadius: 5, fontSize: 9, fontWeight: 700,
                          background: `rgba(${hexRgb(REGION_COLORS[l.region] ?? C.blue)},0.12)`,
                          color: REGION_COLORS[l.region] ?? C.blue,
                        }}>{l.region}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'rgba(148,163,184,0.65)' }}>{l.station}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 5, fontWeight: 800, fontSize: 11,
                          background: `rgba(${hexRgb(vciColor)},0.15)`,
                          border: `1px solid rgba(${hexRgb(vciColor)},0.3)`,
                          color: vciColor,
                          boxShadow: `0 0 8px rgba(${hexRgb(vciColor)},0.25)`,
                        }}>{l.vci.toFixed(1)}</span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: 'rgba(148,163,184,0.6)' }}>{l.km.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── REGIONAL SORTABLE TABLE ── */}
        <Section title="Regional Road Statistics · Sortable Dashboard" accent={C.blue}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {TH('region',     'Region')}
                  {TH('paved_km',   'Paved km')}
                  {TH('unpaved_km', 'Unpaved km')}
                  {TH('total',      'Total km')}
                  {TH('pct',        'Paved %')}
                  {TH('links',      'Links')}
                </tr>
              </thead>
              <tbody>
                {sortedRegions.map(r => {
                  const total = r.paved_km + r.unpaved_km;
                  const pct   = total > 0 ? (r.paved_km / total) * 100 : 0;
                  const rc    = REGION_COLORS[r.region] ?? C.blue;
                  const isHov = hovRow === r.region;
                  return (
                    <tr key={r.region}
                      onMouseEnter={() => setHovRow(r.region)}
                      onMouseLeave={() => setHovRow(null)}
                      onClick={() => toggleRegion(r.region)}
                      style={{
                        background: isHov ? `rgba(${hexRgb(rc)},0.07)` : 'transparent',
                        transition: 'background 0.15s', cursor: 'pointer',
                      }}>
                      <td style={{ padding: '9px 10px', fontWeight: 700, color: isHov ? rc : '#e2eaf4', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: rc, marginRight: 8 }} />
                        {r.region}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: C.green, fontWeight: 600 }}>
                        {r.paved_km.toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'rgba(148,163,184,0.55)' }}>
                        {r.unpaved_km.toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: '#e2eaf4' }}>
                        {total.toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
                          <span style={{ color: rc, fontWeight: 700, fontSize: 10, minWidth: 38, textAlign: 'right' }}>
                            {pct.toFixed(1)}%
                          </span>
                          <div style={{ width: 64, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: `linear-gradient(90deg, ${rc}, rgba(${hexRgb(rc)},0.45))`,
                              borderRadius: 3, transition: 'width 0.3s',
                              boxShadow: `0 0 6px rgba(${hexRgb(rc)},0.5)`,
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: C.yellow }}>
                        {r.links.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ marginTop: 6, fontSize: 9, color: 'rgba(100,116,139,0.45)' }}>
              Click row or column header to sort · Click row to cross-filter all charts · Coloured dot = maintenance region colour
            </div>
          </div>
        </Section>

        {/* ── MILESTONE TIMELINE ── */}
        <Section title="Key Policy Milestones · 1962–Present" accent={C.cyan}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{
              position: 'absolute', left: 12, top: 8, bottom: 8, width: 2,
              background: `linear-gradient(to bottom, ${C.cyan}, rgba(${hexRgb(C.cyan)},0.04))`,
              borderRadius: 2,
            }} />
            {MILESTONES.map((m, i) => {
              const pt = data.cumulative_paved.find(d => d.year === m.year);
              return (
                <div key={m.year} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  marginBottom: i < MILESTONES.length - 1 ? 22 : 0, position: 'relative',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: m.color, border: '2px solid rgba(2,5,8,0.85)',
                    boxShadow: `0 0 12px ${m.color}, 0 0 24px rgba(${hexRgb(m.color)},0.3)`,
                    marginTop: 1, marginLeft: -8, zIndex: 1,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: m.color, textShadow: `0 0 8px rgba(${hexRgb(m.color)},0.5)` }}>
                        {m.year}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2eaf4' }}>{m.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)', lineHeight: 1.5 }}>{m.detail}</div>
                    {pt && (
                      <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: `rgba(${hexRgb(m.color)},0.8)` }}>
                        {pt.cum_paved_km.toLocaleString()} km paved at this date
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── BRIDGES ── */}
        <Section title="Bridge &amp; Structure Inventory" accent={C.teal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Total Structures', value: '1,019', color: C.teal, sub: '534 bridges · 485 culverts' },
              { label: 'Total Length', value: '8,517 m', color: C.cyan, sub: 'Combined bridge deck' },
              { label: 'Avg Length', value: '19.6 m', color: C.blue, sub: 'Per bridge average' },
              { label: 'Road C-Class', value: '284 (65%)', color: C.green, sub: 'Community road bridges' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '14px 14px',
                background: `rgba(${hexRgb(s.color)},0.07)`,
                border: `1px solid rgba(${hexRgb(s.color)},0.2)`,
                borderRadius: 10,
              }}>
                <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, textShadow: `0 0 12px rgba(${hexRgb(s.color)},0.5)` }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.55)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── FOOTER ── */}
        <div style={{
          padding: '12px 16px',
          background: `linear-gradient(135deg, rgba(${hexRgb(C.purple)},0.04), rgba(2,5,8,0.6))`,
          border: `1px solid rgba(${hexRgb(C.purple)},0.08)`,
          borderRadius: 10,
          fontSize: 9, color: 'rgba(100,116,139,0.45)', lineHeight: 1.8,
        }}>
          <div style={{ color: 'rgba(148,163,184,0.4)', fontWeight: 700, marginBottom: 4 }}>DATA SOURCES &amp; NOTES</div>
          Department of National Roads (Department of National Roads) road inventory &amp; ROMDAS condition surveys ·
          Official WTSS statistics (2015/16–2022/23) ·
          Traffic surveys (2017, 2020, 2021, 2025) · VCI from ROMDAS survey cycles (2024/25 &amp; 2025/26) ·
          Maintenance funding: indicative Roads Fund estimates · Station-level paved/unpaved km are proportional estimates; VCI marked ✓ are survey-verified ·
          Asset replacement values for planning reference only · Filters apply to charts with available data ·
          Download PNG exports chart SVG at 2× resolution
        </div>

      </div>
    </div>
  );
}
