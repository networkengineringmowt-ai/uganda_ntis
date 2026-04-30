/**
 * Shared 3-D / neon chart utilities for Uganda Roads Platform.
 * Import from any view that renders recharts.
 */

// ── Neon colour palette ───────────────────────────────────────────────────────
export const NEON = [
  '#00f5ff', '#00ff88', '#ffd23f', '#ff6b35',
  '#ff2d78', '#b967ff', '#00d4aa', '#4d9fff',
] as const;

export const REGION_NEON: Record<string, string> = {
  Central:          '#00f5ff',
  Eastern:          '#ffd23f',
  Northern:         '#00ff88',
  Western:          '#b967ff',
  Southern:         '#ff2d78',
  'North Eastern':  '#ff6b35',
};

// ── Colour helpers ────────────────────────────────────────────────────────────
export function lightenHex(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.min(255,Math.round(r+(255-r)*amt))},${Math.min(255,Math.round(g+(255-g)*amt))},${Math.min(255,Math.round(b+(255-b)*amt))})`;
}
export function darkenHex(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgb(${Math.max(0,Math.round(r*(1-amt)))},${Math.max(0,Math.round(g*(1-amt)))},${Math.max(0,Math.round(b*(1-amt)))})`;
}
export function hexRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
}

// ── Shared axis / grid styling ────────────────────────────────────────────────
export const TICK    = { fill: 'rgba(148,163,184,0.5)',  fontSize: 10 } as const;
export const TICK_SM = { fill: 'rgba(148,163,184,0.45)', fontSize:  9 } as const;
export const AX_LINE = { stroke: 'rgba(148,163,184,0.08)' } as const;

// Neon tooltip styles
export const TT_NEON = {
  contentStyle: { background: 'rgba(2,5,8,0.97)', border: '1px solid rgba(0,245,255,0.2)', borderRadius: 10 },
  labelStyle:   { color: '#00f5ff', fontSize: 11, fontWeight: 700 },
  itemStyle:    { color: '#94a3b8', fontSize: 10 },
} as const;

// ── Glow SVG filter defs (embed once per chart with unique prefix) ─────────────
export function GlowDefs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}glow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      {NEON.map((c, i) => (
        <linearGradient key={i} id={`${id}ng${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={c} stopOpacity={0.95}/>
          <stop offset="100%" stopColor={c} stopOpacity={0.28}/>
        </linearGradient>
      ))}
    </defs>
  );
}

// ── Universal 3-D bar shape ───────────────────────────────────────────────────
// Works for both vertical (default) and horizontal (layout="vertical") BarCharts.
// When a <Cell fill={color}> is used, that colour is forwarded as props.fill.
export function Bar3D(props: any) {
  const { x, y, width, height, fill, index } = props;
  if (!height || height <= 0 || !width || width <= 0) return null;

  // Determine colour: use Cell/Bar fill if it's a hex/rgb colour; else cycle NEON
  const isUrl  = typeof fill === 'string' && fill.startsWith('url(');
  const color  = (fill && !isUrl) ? fill : NEON[(index ?? 0) % NEON.length];

  // Horizontal bar detection: bar is wider than twice its height
  const isH    = width > height * 2;
  const d      = isH ? Math.min(height * 0.35, 7) : Math.min(width * 0.32, 12);
  const light  = lightenHex(color, 0.44);
  const dark   = darkenHex(color, 0.4);

  return (
    <g style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}>
      {/* Main face */}
      <rect x={x} y={y} width={width} height={height} fill={color}/>
      {/* Top / depth face */}
      <polygon
        fill={light}
        points={`${x},${y} ${x+d},${y-d} ${x+width+d},${y-d} ${x+width},${y}`}
      />
      {/* Right / end face (only for vertical bars — looks odd on horizontal) */}
      {!isH && (
        <polygon
          fill={dark}
          points={`${x+width},${y} ${x+width+d},${y-d} ${x+width+d},${y+height-d} ${x+width},${y+height}`}
        />
      )}
    </g>
  );
}

// ── 3D chart container (perspective tilt wrapper) ─────────────────────────────
export function Chart3DWrap({ children, tilt = 1.5 }: { children: React.ReactNode; tilt?: number }) {
  return (
    <div style={{
      transform: `perspective(1100px) rotateX(${tilt}deg)`,
      transformOrigin: 'center top',
    }}>
      {children}
    </div>
  );
}

// ── Neon gradient area defs (for AreaChart) ───────────────────────────────────
export function AreaGradDefs({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor={color} stopOpacity={0.55}/>
        <stop offset="100%" stopColor={color} stopOpacity={0.02}/>
      </linearGradient>
      <filter id={`${id}glow`} x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}
